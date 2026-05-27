import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('modifiers')
export class Modifier {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'modifier_group_id', type: 'uuid', nullable: true })
  modifierGroupId!: string | null;

  @Column()
  name!: string;

  @Column({ name: 'price_cents', type: 'int', default: 0 })
  priceCents!: number;

  @Column({ name: 'is_available', default: true })
  isAvailable!: boolean;
}
