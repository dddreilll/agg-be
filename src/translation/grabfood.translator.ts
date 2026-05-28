import type {
  CanonicalItem,
  CanonicalOrder,
  CanonicalPaymentMethod,
  TranslationMeta,
} from './canonical.types';
import type { EntityResolver } from './entity-resolver';
import type { GrabFoodOrder } from './grabfood.schema';

const PLATFORM = 'GRABFOOD';

// GrabFood's top-level paymentType → our canonical enum.
const PAYMENT_METHOD_MAP: Record<string, CanonicalPaymentMethod> = {
  CASH: 'CASH_ON_DELIVERY',
  CASHLESS: 'ONLINE_PAYMENT',
};

/**
 * Translate a validated GrabFood Submit Order payload into the canonical shape.
 * Product internal ids + names are resolved via the injected resolver.
 * Subtotal and grand total come from GrabFood's authoritative `price` object.
 */
export async function translateGrabFoodOrder(
  order: GrabFoodOrder,
  meta: TranslationMeta,
  resolver: EntityResolver,
): Promise<CanonicalOrder> {
  const internalStoreId = await resolver.resolveStoreId(PLATFORM, order.merchantID);

  const items: CanonicalItem[] = [];

  for (const item of order.items) {
    const product = await resolver.resolveProduct(PLATFORM, item.id);
    items.push({
      internal_product_id: product.id,
      product_name: product.name,
      quantity: item.quantity,
      unit_price_cents: item.price,
      ...(item.specifications ? { notes: item.specifications } : {}),
    });
  }

  return {
    event: 'order.incoming',
    meta: {
      platform: PLATFORM,
      order_id: order.orderID,
      short_order_id: order.shortOrderNumber ?? `GF-${order.orderID.slice(-4)}`,
      idempotency_key: meta.idempotencyKey,
      received_at: meta.receivedAt,
    },
    order_details: {
      internal_store_id: internalStoreId,
      status: 'PENDING_ACCEPTANCE',
      payment_method: PAYMENT_METHOD_MAP[(order.paymentType ?? '').toUpperCase()] ?? 'ONLINE_PAYMENT',
      financials: {
        subtotal_cents: order.price.subtotal,
        grand_total_cents: order.price.total,
      },
      items,
    },
  };
}
