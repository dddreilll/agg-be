import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'category_id', type: 'uuid', nullable: true })
  categoryId!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true, unique: true })
  sku!: string | null;

  @Column()
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'base_price_cents', type: 'int' })
  basePriceCents!: number;

  @Column({ name: 'is_available', default: true })
  isAvailable!: boolean;
}
