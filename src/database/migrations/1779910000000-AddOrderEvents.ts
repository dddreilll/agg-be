import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOrderEvents1779910000000 implements MigrationInterface {
  name = 'AddOrderEvents1779910000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS order_events (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id      UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        event_type    VARCHAR(64) NOT NULL,
        previous_status VARCHAR(64),
        new_status    VARCHAR(64),
        actor         VARCHAR(64) NOT NULL DEFAULT 'system',
        metadata      JSONB NOT NULL DEFAULT '{}',
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_order_events_order_id_created_at
        ON order_events (order_id, created_at);
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS order_events;`);
  }
}
