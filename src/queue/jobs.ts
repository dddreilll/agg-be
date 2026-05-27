export const INGESTION_QUEUE = 'ingestion';
export const INGEST_ORDER_JOB = 'ingest-order';

/**
 * Payload enqueued for every accepted webhook. The raw platform body is carried
 * through untouched; canonical translation happens in a later task on the worker side.
 */
export interface IngestionJobData {
  platform: string;
  orderId: string;
  dedupeKey: string;
  receivedAt: string;
  requestId: string;
  raw: unknown;
}
