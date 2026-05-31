import { Column, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { OrderItem } from './order-item.entity';

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Canonical dedupe key, e.g. `grabfood:123-CYNKLPCVRN5`. The DB-level idempotency guard. */
  @Column({ name: 'idempotency_key', unique: true })
  idempotencyKey!: string;

  @Column()
  platform!: string;

  @Column({ name: 'external_order_id' })
  externalOrderId!: string;

  /** Short human-readable order ID displayed on kitchen screens, e.g. `CYNK`. */
  @Column({ name: 'short_order_id', type: 'varchar' })
  shortOrderId!: string;

  @Column({ name: 'store_id', type: 'uuid' })
  storeId!: string;

  @Column()
  status!: string;

  @Column({ name: 'payment_method' })
  paymentMethod!: string;

  @Column({ name: 'subtotal_cents', type: 'int' })
  subtotalCents!: number;

  @Column({ name: 'grand_total_cents', type: 'int' })
  grandTotalCents!: number;

  @Column({ name: 'received_at', type: 'timestamptz' })
  receivedAt!: Date;

  /** Original, untouched platform payload — kept for audit/replay. */
  @Column({ name: 'raw_payload', type: 'jsonb', nullable: true })
  rawPayload!: unknown;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt!: Date;

  /** Set when the order is soft-archived by the retention job. Null means active. */
  @Column({ name: 'archived_at', type: 'timestamptz', nullable: true, default: null })
  archivedAt!: Date | null;

  @OneToMany(() => OrderItem, (item) => item.order, { cascade: true })
  items!: OrderItem[];
}
