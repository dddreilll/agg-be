import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.validation';
import { buildBullConnection } from '../redis/redis.factory';
import { TranslationModule } from '../translation/translation.module';
import { IngestionProcessor } from './ingestion.processor';
import { IngestionProducer } from './ingestion.producer';
import { INGESTION_QUEUE } from './jobs';

@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        connection: buildBullConnection(config.get('REDIS_URL', { infer: true })),
      }),
    }),
    BullModule.registerQueue({ name: INGESTION_QUEUE }),
    TranslationModule,
  ],
  providers: [IngestionProducer, IngestionProcessor],
  exports: [IngestionProducer],
})
export class QueueModule {}
