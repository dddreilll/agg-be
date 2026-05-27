import {
  type CallHandler,
  type ExecutionContext,
  Inject,
  Injectable,
  Logger,
  type NestInterceptor,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { Redis } from 'ioredis';
import { catchError, type Observable, throwError } from 'rxjs';
import type { Env } from '../config/env.validation';
import { REDIS_CLIENT } from '../redis/redis.constants';
import { PlatformRegistry } from './platform.registry';

/**
 * The idempotency guard, as an interceptor (not a Guard) so a duplicate can reply
 * 200 rather than the 403 a denied guard would force. It validates the payload,
 * derives the dedupe key, and does a single `SET NX PX` against Redis. The
 * controller turns the outcome (req.duplicate) into the right status code.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IdempotencyInterceptor.name);

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly registry: PlatformRegistry,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const req = context.switchToHttp().getRequest<Request>();

    // Validate + derive the dedupe key (throws 400 for malformed payloads).
    const platformParam = req.params.platform;
    const platform = Array.isArray(platformParam) ? (platformParam[0] ?? '') : platformParam;
    const parsed = this.registry.parse(platform, req.body);
    req.parsedWebhook = parsed;

    const key = `idem:${parsed.dedupeKey}`;
    const ttlMs = this.config.get('IDEMPOTENCY_TTL_SECONDS', { infer: true }) * 1000;

    let markerOwned = false;
    try {
      // NX = set only if absent → 'OK' on first delivery, null on a replay.
      const result = await this.redis.set(key, req.requestId ?? 'unknown', 'PX', ttlMs, 'NX');
      req.duplicate = result !== 'OK';
      markerOwned = result === 'OK';
    } catch (err) {
      const failOpen = this.config.get('IDEMPOTENCY_FAIL_OPEN', { infer: true });
      this.logger.warn(
        `idempotency store unavailable for ${parsed.dedupeKey} (failOpen=${failOpen}): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      if (!failOpen) {
        throw new ServiceUnavailableException('Idempotency store unavailable');
      }
      // Fail open: never drop a real order — a later DB unique constraint catches dupes.
      req.duplicate = false;
    }

    if (req.duplicate) {
      this.logger.log(`duplicate webhook ignored: ${parsed.dedupeKey}`);
      return next.handle();
    }

    // We just claimed the marker. If downstream processing (enqueue) fails, release it so
    // the platform's retry isn't silently deduped away and the order lost.
    return next.handle().pipe(
      catchError((err: unknown) => {
        if (markerOwned) {
          this.redis
            .del(key)
            .catch((delErr: unknown) =>
              this.logger.warn(`failed to roll back idempotency key ${key}: ${String(delErr)}`),
            );
        }
        return throwError(() => err);
      }),
    );
  }
}
