import { Column, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

/**
 * Polymorphic translation table: maps an external platform id (held in
 * platform_metadata->>'external_id') to an internal entity UUID, scoped by store +
 * platform. entity_type covers PRODUCT / CATEGORY / MODIFIER_GROUP / MODIFIER, plus
 * STORE (used to resolve a platform's merchant id to our internal store).
 */
@Entity('platform_mappings')
@Unique('unique_platform_entity_mapping', [
  'storeId',
  'entityType',
  'internalEntityId',
  'platformName',
])
@Index('idx_platform_mappings_lookup', ['platformName', 'entityType', 'internalEntityId'])
export class PlatformMapping {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'store_id', type: 'uuid', nullable: true })
  storeId!: string | null;

  @Column({ name: 'entity_type' })
  entityType!: string;

  @Column({ name: 'internal_entity_id', type: 'uuid' })
  internalEntityId!: string;

  @Column({ name: 'platform_name' })
  platformName!: string;

  @Column({ name: 'platform_metadata', type: 'jsonb', default: {} })
  platformMetadata!: Record<string, unknown>;

  @Column({ name: 'is_synced', default: true })
  isSynced!: boolean;

  @Column({ name: 'last_synced_at', type: 'timestamptz', nullable: true })
  lastSyncedAt!: Date | null;
}
