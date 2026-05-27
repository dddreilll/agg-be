import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { OrderItem } from './order-item.entity';

@Entity('order_item_modifiers')
export class OrderItemModifier {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => OrderItem, (item) => item.modifiers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_item_id' })
  orderItem!: OrderItem;

  /** Internal modifier id (snapshot). */
  @Column({ name: 'modifier_id', type: 'uuid', nullable: true })
  modifierId!: string | null;

  @Column({ name: 'modifier_name' })
  modifierName!: string;

  @Column({ name: 'added_price_cents', type: 'int' })
  addedPriceCents!: number;
}
