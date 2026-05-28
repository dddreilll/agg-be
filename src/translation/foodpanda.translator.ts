import type {
  CanonicalCustomization,
  CanonicalItem,
  CanonicalOrder,
  CanonicalPaymentMethod,
  TranslationMeta,
} from './canonical.types';
import type { EntityResolver } from './entity-resolver';
import type { FoodpandaOrder } from './foodpanda.schema';

const PLATFORM = 'FOODPANDA';

// Foodpanda's payment.status → our canonical enum. Per the official docs, `status`
// (not `type`) is the field that says whether the order is already paid online
// ("paid") or must be paid at delivery/pickup ("pending"); `type` is free-text.
const PAYMENT_METHOD_MAP: Record<string, CanonicalPaymentMethod> = {
  PAID: 'ONLINE_PAYMENT',
  PENDING: 'CASH_ON_DELIVERY',
};

/** Foodpanda sends money as decimal strings ("25.50"); convert to integer cents. */
function toCents(value: string | number): number {
  const n = typeof value === 'number' ? value : parseFloat(value);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

/** Quantity may arrive as a numeric string; fall back to 1 when absent/placeholder. */
function toQuantity(value: string | number | undefined): number {
  const n = typeof value === 'number' ? value : parseInt(String(value ?? ''), 10);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : 1;
}

/**
 * Our menu mapping key. `remoteCode` is the merchant/POS-side id (our preferred
 * key) but the docs allow it to be null when the integration isn't configured with
 * remote codes; fall back to the platform-side `id` in that case.
 */
function mappingKey(remoteCode: string | null | undefined, platformId: string | undefined): string {
  return remoteCode ?? platformId ?? '';
}

/**
 * Translate a validated Foodpanda order payload into the canonical shape.
 * Product/modifier internal ids + names are resolved via the injected resolver,
 * keyed on the merchant/POS `remoteCode` (so the canonical name is our catalog's,
 * consistent across platforms). Foodpanda has no items subtotal, so we sum it from
 * the line items; the grand total comes from its authoritative `price.grandTotal`.
 */
export async function translateFoodpandaOrder(
  order: FoodpandaOrder,
  meta: TranslationMeta,
  resolver: EntityResolver,
): Promise<CanonicalOrder> {
  const internalStoreId = await resolver.resolveStoreId(PLATFORM, order.platformRestaurant.id);

  let subtotalCents = 0;
  let modifierTotalCents = 0;
  const items: CanonicalItem[] = [];

  for (const product of order.products) {
    const resolved = await resolver.resolveProduct(PLATFORM, mappingKey(product.remoteCode, product.id));
    const quantity = toQuantity(product.quantity);
    const unitPriceCents = toCents(product.unitPrice);
    subtotalCents += unitPriceCents * quantity;

    const customizations: CanonicalCustomization[] = [];
    for (const topping of product.selectedToppings) {
      const modifier = await resolver.resolveModifier(
        PLATFORM,
        mappingKey(topping.remoteCode, topping.id),
      );
      const addedPriceCents = toCents(topping.price);
      customizations.push({
        internal_modifier_id: modifier.id,
        modifier_name: modifier.name,
        added_price_cents: addedPriceCents,
      });
      modifierTotalCents += addedPriceCents * toQuantity(topping.quantity);
    }

    items.push({
      internal_product_id: resolved.id,
      product_name: resolved.name,
      quantity,
      unit_price_cents: unitPriceCents,
      ...(product.comment ? { notes: product.comment } : {}),
      customizations,
    });
  }

  return {
    event: 'order.incoming',
    meta: {
      platform: PLATFORM,
      order_id: order.token,
      short_order_id: order.code ?? order.token.slice(0, 8),
      idempotency_key: meta.idempotencyKey,
      received_at: meta.receivedAt,
    },
    order_details: {
      internal_store_id: internalStoreId,
      status: 'PENDING_ACCEPTANCE',
      payment_method:
        PAYMENT_METHOD_MAP[(order.payment?.status ?? '').toUpperCase()] ?? 'ONLINE_PAYMENT',
      financials: {
        subtotal_cents: subtotalCents,
        modifier_total_cents: modifierTotalCents,
        grand_total_cents: toCents(order.price.grandTotal),
      },
      items,
    },
  };
}
