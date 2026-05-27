import { Module } from '@nestjs/common';
import { QueueModule } from '../queue/queue.module';
import { IdempotencyInterceptor } from './idempotency.interceptor';
import { IngestionController } from './ingestion.controller';
import { PlatformRegistry } from './platform.registry';

@Module({
  imports: [QueueModule],
  controllers: [IngestionController],
  providers: [IdempotencyInterceptor, PlatformRegistry],
})
export class IngestionModule {}
