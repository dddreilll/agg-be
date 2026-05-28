import { Injectable, Logger } from '@nestjs/common';
import type { IOutboundPlatformAdapter, OutboundStatusPayload } from './outbound-platform.interface';
import type { CanonicalOrderStatus } from '../translation/canonical.types';

/** Maps canonical statuses to Foodpanda outbound action names. */
const STATUS_ACTION_MAP: Partial<Record<CanonicalOrderStatus, string>> = {
  ACCEPTED: 'accept',
  REJECTED: 'reject',
  READY_FOR_PICKUP: 'picked_up',
};

@Injectable()
export class FoodpandaOutboundAdapter implements IOutboundPlatformAdapter {
  readonly platform = 'foodpanda';
  private readonly logger = new Logger(FoodpandaOutboundAdapter.name);

  async pushStatusUpdate(payload: OutboundStatusPayload): Promise<void> {
    const action = STATUS_ACTION_MAP[payload.status];
    if (!action) {
      this.logger.debug(`status ${payload.status} has no outbound action for foodpanda — skipping`);
      return;
    }

    // TODO: replace with real Foodpanda Order API call.
    // Endpoint: PATCH https://api.foodpanda.com/v2/vendors/{vendorId}/orders/{orderCode}/{action}
    // Auth: API key in X-FP-API-KEY header, provisioned per vendor.
    this.logger.log(
      `[STUB] Foodpanda outbound: ${action} order ${payload.externalOrderId} (store ${payload.externalStoreId})`,
    );
  }
}
