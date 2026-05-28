import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { Order } from '../database/entities/order.entity';
import type { CanonicalOrder } from '../translation/canonical.types';

const PG_UNIQUE_VIOLATION = '23505';

export interface PersistResult {
  created: boolean;
  order?: Order;
}

@Injectable()
export class OrderPersistenceService {
  private readonly logger = new Logger(OrderPersistenceService.name);

  constructor(@InjectRepository(Order) private readonly orders: Repository<Order>) {}

  /**
   * Persist a canonical order with its items in one cascaded insert.
   * Idempotent: a duplicate `idempotency_key` hits the UNIQUE constraint and is
   * treated as already-persisted (created: false) rather than an error.
   */
  async persist(canonical: CanonicalOrder, rawPayload: unknown): Promise<PersistResult> {
    const details = canonical.order_details;

    const order = this.orders.create({
      idempotencyKey: canonical.meta.idempotency_key,
      platform: canonical.meta.platform,
      externalOrderId: canonical.meta.order_id,
      shortOrderId: canonical.meta.short_order_id,
      storeId: details.internal_store_id,
      status: details.status,
      paymentMethod: details.payment_method,
      subtotalCents: details.financials.subtotal_cents,
      grandTotalCents: details.financials.grand_total_cents,
      receivedAt: new Date(canonical.meta.received_at),
      rawPayload,
      items: details.items.map((item, position) => ({
        productId: item.internal_product_id,
        productName: item.product_name,
        quantity: item.quantity,
        unitPriceCents: item.unit_price_cents,
        notes: item.notes ?? null,
        position,
      })),
    });

    try {
      const saved = await this.orders.save(order);
      this.logger.log(`persisted order ${saved.id} (${order.idempotencyKey})`);
      return { created: true, order: saved };
    } catch (err) {
      if (
        err instanceof QueryFailedError &&
        (err.driverError as { code?: string }).code === PG_UNIQUE_VIOLATION
      ) {
        this.logger.log(`order ${order.idempotencyKey} already persisted — skipping (idempotent)`);
        return { created: false };
      }
      throw err;
    }
  }
}
