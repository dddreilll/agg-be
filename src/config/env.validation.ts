import { z } from 'zod';

/** Parse common truthy/falsey env strings into booleans, falling back to a default. */
const booleanFromEnv = (defaultValue: boolean) =>
  z.preprocess((value) => {
    if (value === undefined || value === null || value === '') return defaultValue;
    if (typeof value === 'boolean') return value;
    return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
  }, z.boolean());

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),

  // Redis backs both the idempotency cache and the BullMQ broker.
  REDIS_URL: z.string().url().default('redis://localhost:6379'),

  // PostgreSQL — primary relational store (menus, platform mappings, orders).
  DATABASE_URL: z.string().url().default('postgres://dops:dops@localhost:5432/dops'),

  // How long a processed order's dedupe marker is retained.
  IDEMPOTENCY_TTL_SECONDS: z.coerce.number().int().positive().default(86_400),
  // If Redis is unreachable during the dedupe check: accept the order anyway (true)
  // or reject with 503 so the platform retries (false).
  IDEMPOTENCY_FAIL_OPEN: booleanFromEnv(true),

  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(5),
  // Maximum number of waiting jobs before the ingestion endpoint starts shedding load (503).
  // Unset (default) means unbounded — platforms with reliable retry should set this.
  INGESTION_QUEUE_MAX_DEPTH: z.coerce.number().int().positive().optional(),

  // GrabFood partner OAuth — used by POST /auth/grab-token and the GrabFood webhook guard.
  // If unset, GrabFood webhook auth is skipped (fail-open, for local dev).
  GRABFOOD_CLIENT_ID: z.string().min(1).optional(),
  GRABFOOD_CLIENT_SECRET: z.string().min(1).optional(),
  // Secret used to HMAC-sign the Bearer tokens we issue to GrabFood.
  GRABFOOD_TOKEN_SECRET: z.string().min(16).optional(),
  GRABFOOD_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(3600),

  // Foodpanda webhook guard — static Bearer token Foodpanda sends on every dispatch call.
  // Configured in the Foodpanda Vendor Portal. If unset, verification is skipped.
  FOODPANDA_WEBHOOK_SECRET: z.string().min(1).optional(),

  // Retention: completed/cancelled orders older than this are soft-archived (default 90 days).
  ORDER_RETENTION_DAYS: z.coerce.number().int().positive().default(90),
  // Purge: archived orders older than this are hard-deleted (default 365 days).
  ORDER_ARCHIVE_DAYS: z.coerce.number().int().positive().default(365),

  // Optional: required only when the /parse endpoint is called.
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-2.0-flash'),
});

export type Env = z.infer<typeof envSchema>;

/** Used by ConfigModule.forRoot({ validate }) — crashes the boot on bad config. */
export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  • ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }
  return parsed.data;
}
