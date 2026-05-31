import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Env } from '../config/env.validation';

@Injectable()
export class GrabTokenService {
  private readonly logger = new Logger(GrabTokenService.name);

  constructor(private readonly config: ConfigService<Env, true>) {}

  /**
   * Issue a short-lived HMAC-signed Bearer token for GrabFood to use in webhook calls.
   * Token format: `<base64url-payload>.<base64url-hmac-sha256-signature>`
   */
  issue(): { access_token: string; token_type: 'Bearer'; expires_in: number } {
    const secret = this.config.get('GRABFOOD_TOKEN_SECRET', { infer: true });
    if (!secret) throw new Error('GRABFOOD_TOKEN_SECRET is not configured');

    const ttl = this.config.get('GRABFOOD_TOKEN_TTL_SECONDS', { infer: true });
    const iat = Math.floor(Date.now() / 1000);
    const payload = Buffer.from(JSON.stringify({ sub: 'grabfood', iat, exp: iat + ttl })).toString(
      'base64url',
    );
    const sig = createHmac('sha256', secret).update(payload).digest('base64url');

    return { access_token: `${payload}.${sig}`, token_type: 'Bearer', expires_in: ttl };
  }

  /**
   * Verify a Bearer token received on an inbound GrabFood webhook.
   * Returns false (does NOT throw) so callers decide how to respond.
   */
  verify(token: string): boolean {
    const secret = this.config.get('GRABFOOD_TOKEN_SECRET', { infer: true });
    if (!secret) {
      this.logger.warn('GRABFOOD_TOKEN_SECRET not set — skipping GrabFood token verification');
      return true;
    }

    const dotIdx = token.lastIndexOf('.');
    if (dotIdx < 1) return false;
    const payload = token.slice(0, dotIdx);
    const sig = token.slice(dotIdx + 1);

    const expected = createHmac('sha256', secret).update(payload).digest('base64url');
    try {
      if (!timingSafeEqual(Buffer.from(sig, 'ascii'), Buffer.from(expected, 'ascii'))) return false;
    } catch {
      return false;
    }

    let claims: { exp?: unknown };
    try {
      claims = JSON.parse(Buffer.from(payload, 'base64url').toString());
    } catch {
      return false;
    }

    return typeof claims.exp === 'number' && claims.exp > Math.floor(Date.now() / 1000);
  }
}
