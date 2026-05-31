import { Module } from '@nestjs/common';
import { QueueModule } from '../queue/queue.module';
import { GrabTokenController } from './grab-token.controller';
import { GrabTokenService } from './grab-token.service';
import { IdempotencyInterceptor } from './idempotency.interceptor';
import { IngestionController } from './ingestion.controller';
import { PlatformRegistry } from './platform.registry';
import { WebhookAuthGuard } from './webhook-auth.guard';

@Module({
  imports: [QueueModule],
  controllers: [IngestionController, GrabTokenController],
  providers: [IdempotencyInterceptor, PlatformRegistry, GrabTokenService, WebhookAuthGuard],
})
export class IngestionModule {}
