import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type Job } from 'bullmq';
import type { Env } from '../config/env.validation';
import { MetricsService } from '../metrics/metrics.service';
import { OrderPersistenceService } from '../orders/order-persistence.service';
import { KitchenGateway } from '../realtime/kitchen.gateway';
import { TranslationService } from '../translation/translation.service';
import { INGESTION_QUEUE, type IngestionJobData } from './jobs';

/**
 * Stubbed consumer for accepted webhooks. Today it just logs the job; the real
 * pipeline (translate → persist → broadcast) is wired up in later tasks.
 */
@Processor(INGESTION_QUEUE)
export class IngestionProcessor
  extends WorkerHost
  implements OnApplicationBootstrap
{
  private readonly logger = new Logger(IngestionProcessor.name);

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly translation: TranslationService,
    private readonly orders: OrderPersistenceService,
    private readonly kitchen: KitchenGateway,
    private readonly metrics: MetricsService,
  ) {
    super();
  }

  onApplicationBootstrap(): void {
    // The underlying BullMQ worker exists by now; tune concurrency from config.
    if (this.worker) {
      this.worker.concurrency = this.config.get('WORKER_CONCURRENCY', { infer: true });
    }
  }

  async process(job: Job<IngestionJobData>): Promise<void> {
    const start = process.hrtime.bigint();
    const { platform, orderId, dedupeKey, receivedAt, raw } = job.data;
    this.logger.log(`processing ${platform} order ${orderId} (job ${job.id}, key ${dedupeKey})`);

    // Task 2: translate the raw platform payload → unified canonical schema.
    const canonical = await this.translation.translate(platform, raw, {
      idempotencyKey: dedupeKey,
      receivedAt,
    });

    const { financials, items, internal_store_id } = canonical.order_details;
    this.logger.log(
      `translated → canonical: store ${internal_store_id}, ${items.length} item(s), ` +
        `grand_total ${financials.grand_total_cents}¢`,
    );
    this.logger.debug(JSON.stringify(canonical));

    // Task 3: persist the canonical order (idempotent on idempotency_key).
    const result = await this.orders.persist(canonical, raw);

    if (result.created) {
      // Task 4: push the new order to the store's kitchen displays in real time.
      this.kitchen.broadcastOrder(result.order!);
      this.logger.log(`persisted + broadcast order ${result.order!.id} (${dedupeKey})`);
    } else {
      this.logger.log(`order ${dedupeKey} already persisted — skipped (no re-broadcast)`);
    }

    this.metrics.jobDuration.observe(Number(process.hrtime.bigint() - start) / 1e9);
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<IngestionJobData>): void {
    this.logger.debug(`completed job ${job.id}`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<IngestionJobData> | undefined, error: Error): void {
    this.logger.error(`failed job ${job?.id ?? '?'}: ${error.message}`);
  }
}
