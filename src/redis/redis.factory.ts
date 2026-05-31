import { Logger } from '@nestjs/common';
import { Redis, type RedisOptions } from 'ioredis';

/**
 * Connection policy shared by every Redis client we open. These retry/reconnect
 * settings are what keep the service alive across the flaky telecom links the
 * Philippine merchants run on — a dropped Redis connection must self-heal, never
 * crash the process.
 */
const RESILIENCE_POLICY: RedisOptions = {
  // Backoff grows with each attempt but is capped at 2s so a long outage never busy-loops.
  retryStrategy: (times: number): number => Math.min(times * 200, 2000),
  // On a replica failover Redis replies "READONLY"; reconnect AND resend the command (2).
  reconnectOnError: (err: Error): boolean | 2 => (err.message.includes('READONLY') ? 2 : false),
  // Queue commands while briefly disconnected instead of failing instantly.
  enableOfflineQueue: true,
};

function attachLifecycleLogging(client: Redis, role: string): void {
  const logger = new Logger(`Redis:${role}`);
  // CRITICAL: with no 'error' listener, ioredis re-emits the error as an uncaught
  // exception and the Node process dies. We log it and let the retry policy recover.
  client.on('error', (err: Error) => logger.warn(`error: ${err.message}`));
  client.on('connect', () => logger.log('connecting…'));
  client.on('ready', () => logger.log('ready'));
  client.on('reconnecting', (delayMs: number) => logger.warn(`reconnecting in ${delayMs}ms`));
  client.on('close', () => logger.warn('connection closed'));
  client.on('end', () => logger.warn('connection ended (no further reconnects)'));
}

/**
 * App/idempotency client. `maxRetriesPerRequest: 3` makes commands fail fast rather
 * than hang, so the ingestion handler can stay well under the 200ms budget even if
 * Redis is degraded.
 */
export function createAppRedisClient(url: string): Redis {
  const client = new Redis(url, {
    ...RESILIENCE_POLICY,
    connectionName: 'dops-app',
    maxRetriesPerRequest: 3,
  });
  attachLifecycleLogging(client, 'app');
  return client;
}

/**
 * Two dedicated ioredis clients for Socket.io's Redis pub/sub adapter.
 * Must be separate connections: the subscriber is put in subscribe-only mode
 * and cannot issue other commands.
 */
export function createSocketIoRedisClients(url: string): { pub: Redis; sub: Redis } {
  const shared: RedisOptions = { ...RESILIENCE_POLICY, maxRetriesPerRequest: null };
  const pub = new Redis(url, { ...shared, connectionName: 'dops-socketio-pub' });
  const sub = new Redis(url, { ...shared, connectionName: 'dops-socketio-sub' });
  attachLifecycleLogging(pub, 'socketio-pub');
  attachLifecycleLogging(sub, 'socketio-sub');
  return { pub, sub };
}

/**
 * BullMQ connection options. BullMQ manages its own (blocking) connections and
 * *requires* `maxRetriesPerRequest: null`, so it gets a separate config built from
 * the same resilience policy.
 */
export function buildBullConnection(url: string): RedisOptions {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 6379,
    username: parsed.username || undefined,
    password: parsed.password || undefined,
    db: parsed.pathname.length > 1 ? Number(parsed.pathname.slice(1)) : 0,
    ...RESILIENCE_POLICY,
    connectionName: 'dops-bullmq',
    maxRetriesPerRequest: null,
  };
}
