import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';
import { MetricsService } from '../metrics/metrics.service';
import { INGESTION_QUEUE } from './jobs';

/** Refreshes the ingestion_queue_depth gauge every 15 seconds. */
@Injectable()
export class QueueDepthCollector implements OnModuleInit {
  constructor(
    @InjectQueue(INGESTION_QUEUE) private readonly queue: Queue,
    private readonly metrics: MetricsService,
  ) {}

  onModuleInit(): void {
    void this.collect();
    setInterval(() => void this.collect(), 15_000);
  }

  private async collect(): Promise<void> {
    const [waiting, active, delayed, failed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getDelayedCount(),
      this.queue.getFailedCount(),
    ]);
    this.metrics.queueDepth.labels('waiting').set(waiting);
    this.metrics.queueDepth.labels('active').set(active);
    this.metrics.queueDepth.labels('delayed').set(delayed);
    this.metrics.queueDepth.labels('failed').set(failed);
  }
}
