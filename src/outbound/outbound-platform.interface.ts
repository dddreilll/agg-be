import type { CanonicalOrderStatus } from '../translation/canonical.types';

export interface OutboundStatusPayload {
  /** Internal order UUID */
  orderId: string;
  /** Platform's own order ID (e.g. GrabFood orderID) */
  externalOrderId: string;
  /** The store's external merchant ID on this platform */
  externalStoreId: string;
  status: CanonicalOrderStatus;
}

/** One implementation per delivery platform. */
export interface IOutboundPlatformAdapter {
  readonly platform: string;
  pushStatusUpdate(payload: OutboundStatusPayload): Promise<void>;
}
