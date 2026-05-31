import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOrderArchivedAt1779920000000 implements MigrationInterface {
  name = 'AddOrderArchivedAt1779920000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ DEFAULT NULL;
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_orders_archived_at ON orders (archived_at)
        WHERE archived_at IS NOT NULL;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_orders_archived_at;`);
    await queryRunner.query(`ALTER TABLE orders DROP COLUMN IF EXISTS archived_at;`);
  }
}
