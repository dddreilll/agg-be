import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlatformMapping } from '../database/entities/platform-mapping.entity';
import { FoodpandaOutboundAdapter } from './foodpanda-outbound.adapter';
import { GrabFoodOutboundAdapter } from './grabfood-outbound.adapter';
import type { IOutboundPlatformAdapter } from './outbound-platform.interface';
import type { CanonicalOrderStatus } from '../translation/canonical.types';

@Injectable()
export class OutboundDispatchService {
  private readonly logger = new Logger(OutboundDispatchService.name);
  private readonly adapters: Map<string, IOutboundPlatformAdapter>;

  constructor(
    private readonly grabfood: GrabFoodOutboundAdapter,
    private readonly foodpanda: FoodpandaOutboundAdapter,
    @InjectRepository(PlatformMapping) private readonly mappings: Repository<PlatformMapping>,
  ) {
    this.adapters = new Map<string, IOutboundPlatformAdapter>([
      [grabfood.platform, grabfood],
      [foodpanda.platform, foodpanda],
    ]);
  }

  /**
   * Push an order status change to the originating platform.
   * Looks up the store's external merchant ID from platform_mappings, then delegates to the
   * matching adapter. Silently skips unknown platforms.
   */
  async pushStatusUpdate(
    platform: string,
    orderId: string,
    externalOrderId: string,
    storeId: string,
    status: CanonicalOrderStatus,
  ): Promise<void> {
    const adapter = this.adapters.get(platform);
    if (!adapter) {
      this.logger.warn(`no outbound adapter registered for platform "${platform}" — skipping`);
      return;
    }

    const storeMapping = await this.mappings.findOne({
      where: { storeId, entityType: 'STORE', platformName: platform },
    });

    if (!storeMapping) {
      this.logger.warn(`no STORE platform_mapping for store ${storeId} on ${platform} — cannot push status`);
      return;
    }

    const externalStoreId = (storeMapping.platformMetadata as Record<string, string>)['external_id'] ?? '';

    await adapter.pushStatusUpdate({ orderId, externalOrderId, externalStoreId, status });
  }
}
