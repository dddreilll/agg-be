import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { INGEST_ORDER_JOB, INGESTION_QUEUE, type IngestionJobData } from './jobs';

@Injectable()
export class IngestionProducer {
  private readonly logger = new Logger(IngestionProducer.name);

  constructor(@InjectQueue(INGESTION_QUEUE) private readonly queue: Queue<IngestionJobData>) {}

  /** Offload an accepted webhook for async processing. Returns the BullMQ job id. */
  async enqueue(data: IngestionJobData): Promise<string> {
    // BullMQ forbids ':' in custom job ids (it namespaces its own Redis keys with it),
    // so the dedupe key's canonical "platform:order" form is sanitized here only.
    const jobId = data.dedupeKey.replace(/:/g, '_');
    const job = await this.queue.add(INGEST_ORDER_JOB, data, {
      // Second line of defense against duplicates: BullMQ refuses a job whose id already exists.
      jobId,
      attempts: 5,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: { age: 3600, count: 1000 },
      removeOnFail: { age: 24 * 3600 },
    });
    this.logger.log(`enqueued job ${job.id} (${data.dedupeKey})`);
    return job.id ?? jobId;
  }
}
