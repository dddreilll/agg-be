export type CanonicalPlatform = 'GRABFOOD' | 'FOODPANDA' | 'FB_CHATBOT';
export const PLATFORMS: CanonicalPlatform[] = ['GRABFOOD', 'FOODPANDA', 'FB_CHATBOT'];

export type CanonicalPaymentMethod = 'ONLINE_PAYMENT' | 'CASH_ON_DELIVERY';

export type CanonicalOrderStatus =
  | 'PENDING_ACCEPTANCE'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'PREPARING'
  | 'READY_FOR_PICKUP'
  | 'COMPLETED'
  | 'CANCELLED';

export const ORDER_STATUSES: CanonicalOrderStatus[] = [
  'PENDING_ACCEPTANCE',
  'ACCEPTED',
  'REJECTED',
  'PREPARING',
  'READY_FOR_PICKUP',
  'COMPLETED',
  'CANCELLED',
];

export interface CanonicalItem {
  internal_product_id: string;
  product_name: string;
  quantity: number;
  unit_price_cents: number;
  notes?: string;
}

export interface CanonicalFinancials {
  subtotal_cents: number;
  grand_total_cents: number;
}

/** The single internal order shape every platform's payload is translated into. */
export interface CanonicalOrder {
  event: 'order.incoming';
  meta: {
    platform: string;
    order_id: string;
    short_order_id: string;
    idempotency_key: string;
    received_at: string;
  };
  order_details: {
    internal_store_id: string;
    status: CanonicalOrderStatus;
    payment_method: CanonicalPaymentMethod;
    financials: CanonicalFinancials;
    items: CanonicalItem[];
  };
}

/** Ingestion-supplied context that isn't derivable from the raw platform payload. */
export interface TranslationMeta {
  idempotencyKey: string;
  receivedAt: string;
}
