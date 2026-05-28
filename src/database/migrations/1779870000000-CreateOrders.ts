import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Persisted-order schema (Task 3). Mirrors the canonical order: a header row plus
 * normalized line items and their modifiers. `idempotency_key` is UNIQUE — the
 * final DB-level guard against duplicate orders. `raw_payload` keeps the original
 * platform payload for audit/replay.
 */
export class CreateOrders1779870000000 implements MigrationInterface {
  name = 'CreateOrders1779870000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE orders (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        idempotency_key VARCHAR(255) NOT NULL UNIQUE,
        platform VARCHAR(50) NOT NULL,
        external_order_id VARCHAR(255) NOT NULL,
        store_id UUID NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
        status VARCHAR(50) NOT NULL,
        payment_method VARCHAR(50) NOT NULL,
        subtotal_cents INT NOT NULL,
        grand_total_cents INT NOT NULL,
        received_at TIMESTAMP WITH TIME ZONE NOT NULL,
        raw_payload JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await queryRunner.query(`CREATE INDEX idx_orders_store ON orders (store_id, created_at);`);
    await queryRunner.query(`CREATE INDEX idx_orders_status ON orders (status);`);

    await queryRunner.query(`
      CREATE TABLE order_items (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        product_id UUID REFERENCES products(id) ON DELETE SET NULL,
        product_name VARCHAR(255) NOT NULL,
        quantity INT NOT NULL,
        unit_price_cents INT NOT NULL,
        notes TEXT,
        position INT NOT NULL DEFAULT 0
      );
    `);
    await queryRunner.query(`CREATE INDEX idx_order_items_order ON order_items (order_id);`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS order_items CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS orders CASCADE;`);
  }
}
