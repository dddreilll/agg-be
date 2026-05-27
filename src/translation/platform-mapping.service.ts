import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Modifier } from '../database/entities/modifier.entity';
import { PlatformMapping } from '../database/entities/platform-mapping.entity';
import { Product } from '../database/entities/product.entity';
import type { EntityResolver, ResolvedEntity } from './entity-resolver';

/** DB-backed EntityResolver over platform_mappings + products/modifiers. */
@Injectable()
export class PlatformMappingService implements EntityResolver {
  constructor(
    @InjectRepository(PlatformMapping)
    private readonly mappings: Repository<PlatformMapping>,
    @InjectRepository(Product) private readonly products: Repository<Product>,
    @InjectRepository(Modifier) private readonly modifiers: Repository<Modifier>,
  ) {}

  private async resolveInternalId(
    platform: string,
    entityType: string,
    externalId: string,
  ): Promise<string> {
    const mapping = await this.mappings
      .createQueryBuilder('pm')
      .where('pm.platform_name = :platform', { platform })
      .andWhere('pm.entity_type = :entityType', { entityType })
      .andWhere("pm.platform_metadata ->> 'external_id' = :externalId", { externalId })
      .getOne();

    if (!mapping) {
      throw new NotFoundException(
        `No ${platform} mapping for ${entityType} external_id='${externalId}'`,
      );
    }
    return mapping.internalEntityId;
  }

  async resolveStoreId(platform: string, externalMerchantId: string): Promise<string> {
    return this.resolveInternalId(platform, 'STORE', externalMerchantId);
  }

  async resolveProduct(platform: string, externalProductId: string): Promise<ResolvedEntity> {
    const id = await this.resolveInternalId(platform, 'PRODUCT', externalProductId);
    const product = await this.products.findOne({ where: { id } });
    if (!product) {
      throw new NotFoundException(`Product ${id} (external '${externalProductId}') not found`);
    }
    return { id: product.id, name: product.name };
  }

  async resolveModifier(platform: string, externalModifierId: string): Promise<ResolvedEntity> {
    const id = await this.resolveInternalId(platform, 'MODIFIER', externalModifierId);
    const modifier = await this.modifiers.findOne({ where: { id } });
    if (!modifier) {
      throw new NotFoundException(`Modifier ${id} (external '${externalModifierId}') not found`);
    }
    return { id: modifier.id, name: modifier.name };
  }
}
