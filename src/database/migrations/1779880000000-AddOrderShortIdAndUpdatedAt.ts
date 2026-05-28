import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOrderShortIdAndUpdatedAt1779880000000 implements MigrationInterface {
  name = 'AddOrderShortIdAndUpdatedAt1779880000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE orders
        ADD COLUMN IF NOT EXISTS short_order_id VARCHAR(50) NOT NULL DEFAULT '',
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE orders DROP COLUMN IF EXISTS short_order_id;`);
    await queryRunner.query(`ALTER TABLE orders DROP COLUMN IF EXISTS updated_at;`);
  }
}
