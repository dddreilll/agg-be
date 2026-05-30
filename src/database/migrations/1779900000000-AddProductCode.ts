import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProductCode1779900000000 implements MigrationInterface {
  name = 'AddProductCode1779900000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE products ADD COLUMN IF NOT EXISTS product_code VARCHAR(16) UNIQUE;`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE products DROP COLUMN IF EXISTS product_code;`);
  }
}
