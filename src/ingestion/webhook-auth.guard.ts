import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { timingSafeEqual } from 'node:crypto';
import type { Env } from '../config/env.validation';
import { GrabTokenService } from './grab-token.service';

/**
 * Verifies inbound webhook authenticity before the idempotency interceptor runs.
 *
 * GrabFood  — Bearer token issued by our own POST /auth/grab-token endpoint (HMAC-SHA256).
 * Foodpanda — Static Bearer token configured in the Foodpanda Vendor Portal.
 * FB_CHATBOT — No verification (internal / dev traffic only).
 *
 * When the relevant env var is absent the guard warns and passes through (fail-open),
 * matching the idempotency strategy and keeping dev setups running without secrets.
 */
@Injectable()
export class WebhookAuthGuard implements CanActivate {
  private readonly logger = new Logger(WebhookAuthGuard.name);

  constructor(
    private readonly grabToken: GrabTokenService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const rawParam = req.params.platform;
    const platform = (Array.isArray(rawParam) ? (rawParam[0] ?? '') : rawParam)
      .trim()
      .toUpperCase();

    switch (platform) {
      case 'GRABFOOD':
        return this.verifyGrabFood(req);
      case 'FOODPANDA':
        return this.verifyFoodpanda(req);
      default:
        return true;
    }
  }

  private verifyGrabFood(req: Request): boolean {
    const token = extractBearer(req);
    if (!token) {
      this.logger.warn('GrabFood webhook: missing Authorization header');
      throw new UnauthorizedException('Missing Authorization header');
    }
    if (!this.grabToken.verify(token)) {
      this.logger.warn('GrabFood webhook: invalid or expired token');
      throw new UnauthorizedException('Invalid or expired token');
    }
    return true;
  }

  private verifyFoodpanda(req: Request): boolean {
    const expected = this.config.get('FOODPANDA_WEBHOOK_SECRET', { infer: true });
    if (!expected) {
      this.logger.warn('FOODPANDA_WEBHOOK_SECRET not set — skipping Foodpanda webhook verification');
      return true;
    }

    const token = extractBearer(req);
    if (!token) {
      this.logger.warn('Foodpanda webhook: missing Authorization header');
      throw new UnauthorizedException('Missing Authorization header');
    }

    if (!safeCompare(token, expected)) {
      this.logger.warn('Foodpanda webhook: invalid static token');
      throw new UnauthorizedException('Invalid webhook token');
    }
    return true;
  }
}

function extractBearer(req: Request): string | null {
  const auth = req.headers.authorization;
  if (typeof auth !== 'string' || !auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7).trim();
  return token || null;
}

function safeCompare(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) {
    timingSafeEqual(ba, ba);
    return false;
  }
  return timingSafeEqual(ba, bb);
}
