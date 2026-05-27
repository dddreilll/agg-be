import type {
  CanonicalCustomization,
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
 * Product/modifier internal ids + names are resolved via the injected resolver
 * (the payload carries neither name). Subtotal and grand total come from GrabFood's
 * authoritative `price` object; `modifier_total` is summed from the line modifiers
 * (the price object doesn't break it out).
 */
export async function translateGrabFoodOrder(
  order: GrabFoodOrder,
  meta: TranslationMeta,
  resolver: EntityResolver,
): Promise<CanonicalOrder> {
  const internalStoreId = await resolver.resolveStoreId(PLATFORM, order.merchantID);

  let modifierTotalCents = 0;
  const items: CanonicalItem[] = [];

  for (const item of order.items) {
    const product = await resolver.resolveProduct(PLATFORM, item.id);

    const customizations: CanonicalCustomization[] = [];
    for (const modifier of item.modifiers) {
      const resolved = await resolver.resolveModifier(PLATFORM, modifier.id);
      customizations.push({
        internal_modifier_id: resolved.id,
        modifier_name: resolved.name,
        added_price_cents: modifier.price,
      });
      modifierTotalCents += modifier.price * modifier.quantity;
    }

    items.push({
      internal_product_id: product.id,
      product_name: product.name,
      quantity: item.quantity,
      unit_price_cents: item.price,
      ...(item.specifications ? { notes: item.specifications } : {}),
      customizations,
    });
  }

  return {
    event: 'order.incoming',
    meta: {
      platform: PLATFORM,
      order_id: order.orderID,
      idempotency_key: meta.idempotencyKey,
      received_at: meta.receivedAt,
    },
    order_details: {
      internal_store_id: internalStoreId,
      status: 'PENDING_ACCEPTANCE',
      payment_method: PAYMENT_METHOD_MAP[(order.paymentType ?? '').toUpperCase()] ?? 'ONLINE_PAYMENT',
      financials: {
        subtotal_cents: order.price.subtotal,
        modifier_total_cents: modifierTotalCents,
        grand_total_cents: order.price.total,
      },
      items,
    },
  };
}
