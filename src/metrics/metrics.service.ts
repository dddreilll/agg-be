import { Injectable } from '@nestjs/common';
import { collectDefaultMetrics, Counter, Gauge, Histogram, Registry } from 'prom-client';

@Injectable()
export class MetricsService {
  readonly registry = new Registry();

  /** Ingestion queue depth by state (waiting/active/delayed/failed). Updated periodically by QueueDepthCollector. */
  readonly queueDepth = new Gauge({
    name: 'ingestion_queue_depth',
    help: 'Number of BullMQ jobs in each state',
    labelNames: ['state'],
    registers: [this.registry],
  });

  /** End-to-end job processing time from dequeue to completion. */
  readonly jobDuration = new Histogram({
    name: 'ingestion_job_duration_seconds',
    help: 'Ingestion job processing duration in seconds',
    buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [this.registry],
  });

  /** Time from webhook request received to 202/200 response sent (the <200ms guarantee). */
  readonly ackDuration = new Histogram({
    name: 'webhook_ack_duration_seconds',
    help: 'Webhook ingestion ack latency in seconds',
    labelNames: ['platform', 'result'],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.2, 0.5],
    registers: [this.registry],
  });

  /** Total WebSocket order.incoming broadcasts emitted. */
  readonly broadcastOrderTotal = new Counter({
    name: 'kitchen_broadcast_order_total',
    help: 'Total order.incoming WebSocket broadcasts sent',
    registers: [this.registry],
  });

  /** Total WebSocket order.status_updated broadcasts emitted. */
  readonly broadcastStatusTotal = new Counter({
    name: 'kitchen_broadcast_status_total',
    help: 'Total order.status_updated WebSocket broadcasts sent',
    registers: [this.registry],
  });

  constructor() {
    collectDefaultMetrics({ register: this.registry });
  }
}
