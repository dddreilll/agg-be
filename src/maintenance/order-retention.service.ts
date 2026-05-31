import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { Env } from '../config/env.validation';

/**
 * Nightly retention job:
 *   1. Archive completed/cancelled orders older than ORDER_RETENTION_DAYS (default 90).
 *   2. Hard-delete archived orders older than ORDER_ARCHIVE_DAYS  (default 365).
 */
@Injectable()
export class OrderRetentionService {
  private readonly logger = new Logger(OrderRetentionService.name);

  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async runRetention(): Promise<void> {
    const retentionDays = this.config.get('ORDER_RETENTION_DAYS', { infer: true });
    const archiveDays = this.config.get('ORDER_ARCHIVE_DAYS', { infer: true });

    await this.archiveOldOrders(retentionDays);
    await this.purgeArchivedOrders(archiveDays);
  }

  private async archiveOldOrders(days: number): Promise<void> {
    const result = await this.db.query<{ count: string }[]>(
      `UPDATE orders
         SET archived_at = NOW()
       WHERE archived_at IS NULL
         AND status IN ('completed', 'cancelled')
         AND received_at < NOW() - INTERVAL '${days} days'
       RETURNING id`,
    );
    const count = result.length;
    if (count > 0) this.logger.log(`archived ${count} order(s) older than ${days} days`);
  }

  private async purgeArchivedOrders(days: number): Promise<void> {
    const result = await this.db.query<{ count: string }[]>(
      `DELETE FROM orders
       WHERE archived_at IS NOT NULL
         AND archived_at < NOW() - INTERVAL '${days} days'
       RETURNING id`,
    );
    const count = result.length;
    if (count > 0) this.logger.log(`purged ${count} archived order(s) older than ${days} days`);
  }
}
