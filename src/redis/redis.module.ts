import {
  Global,
  Inject,
  Logger,
  Module,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import type { Env } from '../config/env.validation';
import { REDIS_CLIENT } from './redis.constants';
import { createAppRedisClient } from './redis.factory';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): Redis =>
        createAppRedisClient(config.get('REDIS_URL', { infer: true })),
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule implements OnApplicationShutdown {
  private readonly logger = new Logger(RedisModule.name);

  constructor(@Inject(REDIS_CLIENT) private readonly client: Redis) {}

  /** Fired by Nest on SIGTERM/SIGINT (app.enableShutdownHooks) — drain in-flight commands cleanly. */
  async onApplicationShutdown(signal?: string): Promise<void> {
    this.logger.log(`closing Redis connection (signal: ${signal ?? 'n/a'})`);
    try {
      await this.client.quit();
    } catch {
      this.client.disconnect();
    }
  }
}
