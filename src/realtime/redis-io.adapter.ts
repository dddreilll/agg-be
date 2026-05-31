import { INestApplicationContext, Logger } from '@nestjs/common';
import { createAdapter } from '@socket.io/redis-adapter';
import { IoAdapter } from '@nestjs/platform-socket.io';
import type { ServerOptions } from 'socket.io';
import { createSocketIoRedisClients } from '../redis/redis.factory';

/**
 * Socket.io adapter backed by Redis pub/sub.
 * Replaces the default in-memory adapter so that WebSocket room broadcasts
 * reach clients connected to any app instance — a prerequisite for horizontal scaling.
 *
 * Usage in main.ts:
 *   const adapter = new RedisIoAdapter(app, redisUrl);
 *   await adapter.connectToRedis();
 *   app.useWebSocketAdapter(adapter);
 */
export class RedisIoAdapter extends IoAdapter {
  private readonly logger = new Logger(RedisIoAdapter.name);
  private adapterConstructor!: ReturnType<typeof createAdapter>;

  constructor(
    app: INestApplicationContext,
    private readonly redisUrl: string,
  ) {
    super(app);
  }

  async connectToRedis(): Promise<void> {
    const { pub, sub } = createSocketIoRedisClients(this.redisUrl);

    await Promise.all([
      new Promise<void>((resolve, reject) => {
        pub.once('ready', resolve);
        pub.once('error', reject);
      }),
      new Promise<void>((resolve, reject) => {
        sub.once('ready', resolve);
        sub.once('error', reject);
      }),
    ]);

    this.adapterConstructor = createAdapter(pub, sub);
    this.logger.log('Redis pub/sub adapter ready');
  }

  override createIOServer(port: number, options?: ServerOptions) {
    const server = super.createIOServer(port, options);
    server.adapter(this.adapterConstructor);
    return server;
  }
}
