import { Injectable, Logger } from '@nestjs/common';
import type { IOutboundPlatformAdapter, OutboundStatusPayload } from './outbound-platform.interface';
import type { CanonicalOrderStatus } from '../translation/canonical.types';

/** Maps canonical statuses to GrabFood outbound action names. */
const STATUS_ACTION_MAP: Partial<Record<CanonicalOrderStatus, string>> = {
  ACCEPTED: 'accept',
  REJECTED: 'reject',
  PREPARING: 'prepare',
  READY_FOR_PICKUP: 'ready',
};

@Injectable()
export class GrabFoodOutboundAdapter implements IOutboundPlatformAdapter {
  readonly platform = 'grabfood';
  private readonly logger = new Logger(GrabFoodOutboundAdapter.name);

  async pushStatusUpdate(payload: OutboundStatusPayload): Promise<void> {
    const action = STATUS_ACTION_MAP[payload.status];
    if (!action) {
      this.logger.debug(`status ${payload.status} has no outbound action for grabfood — skipping`);
      return;
    }

    // TODO: replace with real GrabFood Order Management API call.
    // Endpoint: POST https://partner-api.grab.com/grabfood/sandbox/order/v1/orders/{orderID}/{action}
    // Auth: Bearer token obtained via GrabFood partner OAuth2 flow.
    this.logger.log(
      `[STUB] GrabFood outbound: ${action} order ${payload.externalOrderId} (store ${payload.externalStoreId})`,
    );
  }
}
