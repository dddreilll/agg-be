/** DI token for the shared ioredis client (idempotency + readiness checks). */
export const REDIS_CLIENT = Symbol('REDIS_CLIENT');
