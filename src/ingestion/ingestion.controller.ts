import {
  Controller,
  HttpStatus,
  Post,
  Req,
  Res,
  UseInterceptors,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { IngestionProducer } from '../queue/ingestion.producer';
import { IdempotencyInterceptor } from './idempotency.interceptor';

@Controller('webhooks')
export class IngestionController {
  constructor(private readonly producer: IngestionProducer) {}

  /**
   * Webhook front door. The interceptor has already validated the payload and run
   * the idempotency guard, so this handler stays tiny: ack a duplicate (200), or
   * enqueue and accept (202). Heavy work happens off the request thread.
   */
  @Post(':platform')
  @UseInterceptors(IdempotencyInterceptor)
  async ingest(@Req() req: Request, @Res() res: Response): Promise<void> {
    const parsed = req.parsedWebhook!;

    if (req.duplicate) {
      res.status(HttpStatus.OK).json({
        status: 'duplicate',
        idempotencyKey: parsed.dedupeKey,
      });
      return;
    }

    const jobId = await this.producer.enqueue({
      platform: parsed.platform,
      orderId: parsed.orderId,
      dedupeKey: parsed.dedupeKey,
      receivedAt: new Date().toISOString(),
      requestId: req.requestId ?? 'unknown',
      raw: parsed.raw,
    });

    res.status(HttpStatus.ACCEPTED).json({
      status: 'accepted',
      idempotencyKey: parsed.dedupeKey,
      jobId,
    });
  }
}
