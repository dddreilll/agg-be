import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Initial relational schema — the DDL from the technical blueprint, run verbatim
 * (TypeORM synchronize stays off so this migration is the single source of truth).
 *
 * One deviation: the blueprint's `USING gin ((platform_metadata->>'external_id'))`
 * cannot be created — GIN has no default operator class for a scalar text expression.
 * Our lookup is an equality match, so a btree expression index is both valid and the
 * right tool.
 */
export class InitSchema1779860000000 implements MigrationInterface {
  name = 'InitSchema1779860000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);

    await queryRunner.query(`
      CREATE TABLE stores (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        location VARCHAR(255),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await queryRunner.query(`
      CREATE TABLE categories (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        sort_order INT DEFAULT 0,
        is_visible BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await queryRunner.query(`
      CREATE TABLE products (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
        sku VARCHAR(100) UNIQUE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        base_price_cents INT NOT NULL,
        is_available BOOLEAN DEFAULT true,
        image_url TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await queryRunner.query(`
      CREATE TABLE platform_mappings (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
        entity_type VARCHAR(50) NOT NULL,
        internal_entity_id UUID NOT NULL,
        platform_name VARCHAR(50) NOT NULL,
        platform_metadata JSONB NOT NULL DEFAULT '{}',
        is_synced BOOLEAN DEFAULT true,
        last_synced_at TIMESTAMP WITH TIME ZONE,
        CONSTRAINT unique_platform_entity_mapping UNIQUE (store_id, entity_type, internal_entity_id, platform_name)
      );
    `);

    await queryRunner.query(`
      CREATE INDEX idx_platform_mappings_lookup
        ON platform_mappings (platform_name, entity_type, internal_entity_id);
    `);
    // btree expression index supporting the equality lookup platform_metadata->>'external_id' = $1
    await queryRunner.query(`
      CREATE INDEX idx_platform_mappings_ext_id
        ON platform_mappings ((platform_metadata->>'external_id'));
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS platform_mappings CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS products CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS categories CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS stores CASCADE;`);
  }
}
