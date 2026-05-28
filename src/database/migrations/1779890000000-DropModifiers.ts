import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Removes all modifier-related tables and the modifier_total_cents column from orders.
 * Modifiers are no longer part of the base product model.
 */
export class DropModifiers1779890000000 implements MigrationInterface {
  name = 'DropModifiers1779890000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS order_item_modifiers CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS product_modifier_groups CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS modifiers CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS modifier_groups CASCADE;`);
    await queryRunner.query(
      `ALTER TABLE orders DROP COLUMN IF EXISTS modifier_total_cents;`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE orders ADD COLUMN modifier_total_cents INT NOT NULL DEFAULT 0;`,
    );
    await queryRunner.query(`
      CREATE TABLE modifier_groups (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        min_selection INT DEFAULT 0,
        max_selection INT DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await queryRunner.query(`
      CREATE TABLE modifiers (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        modifier_group_id UUID REFERENCES modifier_groups(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        price_cents INT DEFAULT 0,
        is_available BOOLEAN DEFAULT true
      );
    `);
    await queryRunner.query(`
      CREATE TABLE product_modifier_groups (
        product_id UUID REFERENCES products(id) ON DELETE CASCADE,
        modifier_group_id UUID REFERENCES modifier_groups(id) ON DELETE CASCADE,
        PRIMARY KEY (product_id, modifier_group_id)
      );
    `);
    await queryRunner.query(`
      CREATE TABLE order_item_modifiers (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
        modifier_id UUID REFERENCES modifiers(id) ON DELETE SET NULL,
        modifier_name VARCHAR(255) NOT NULL,
        added_price_cents INT NOT NULL
      );
    `);
    await queryRunner.query(
      `CREATE INDEX idx_order_item_modifiers_item ON order_item_modifiers (order_item_id);`,
    );
  }
}
