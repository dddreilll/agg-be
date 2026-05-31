import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.validation';
import { OrdersModule } from '../orders/orders.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { buildBullConnection } from '../redis/redis.factory';
import { TranslationModule } from '../translation/translation.module';
import { DlqController } from './dlq.controller';
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
    OrdersModule,
    RealtimeModule,
  ],
  controllers: [DlqController],
  providers: [IngestionProducer, IngestionProcessor],
  exports: [IngestionProducer],
})
export class QueueModule {}
