import type { ParsedWebhook } from '../ingestion/platform.registry';

// Properties we attach to the request as it flows through the ingestion pipeline.
declare global {
  namespace Express {
    interface Request {
      /** Correlation id (set by pino's genReqId; mirrored to the x-request-id response header). */
      requestId?: string;
      /** Validated + dedupe-keyed webhook, populated by the IdempotencyInterceptor. */
      parsedWebhook?: ParsedWebhook;
      /** True when the idempotency guard found this order already in flight. */
      duplicate?: boolean;
    }
  }
}

export {};
