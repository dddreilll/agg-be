import type { CanonicalOrder, TranslationMeta } from './canonical.types';
import type { FbChatbotOrder } from './fb-chatbot.schema';

/**
 * Translates an FB Chatbot order payload (produced by agg-parser) into a
 * CanonicalOrder. Products are already resolved to internal UUIDs by the
 * parse step, so no EntityResolver lookup is required here.
 */
export function translateFbChatbotOrder(
  order: FbChatbotOrder,
  meta: TranslationMeta,
): CanonicalOrder {
  return {
    event: 'order.incoming',
    meta: {
      platform: 'FB_CHATBOT',
      order_id: order.orderId,
      short_order_id: order.shortOrderId,
      idempotency_key: meta.idempotencyKey,
      received_at: meta.receivedAt,
    },
    order_details: {
      internal_store_id: order.storeId,
      status: 'PENDING_ACCEPTANCE',
      payment_method: order.paymentMethod,
      financials: {
        subtotal_cents: order.subtotalCents,
        grand_total_cents: order.grandTotalCents,
      },
      items: order.items.map((item) => ({
        internal_product_id: item.productId,
        product_name: item.productName,
        quantity: item.quantity,
        unit_price_cents: item.unitPriceCents,
        ...(item.notes ? { notes: item.notes } : {}),
      })),
    },
  };
}
