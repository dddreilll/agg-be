import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { Env } from '../config/env.validation';
import { dataSourceOptions } from './data-source-options';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        ...dataSourceOptions(config.get('DATABASE_URL', { infer: true })),
        // Apply pending migrations on boot, and tolerate Postgres not being up yet.
        migrationsRun: true,
        retryAttempts: 5,
        retryDelay: 2000,
      }),
    }),
  ],
})
export class DatabaseModule {}
