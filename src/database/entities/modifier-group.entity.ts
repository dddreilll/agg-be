import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('modifier_groups')
export class ModifierGroup {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'store_id', type: 'uuid', nullable: true })
  storeId!: string | null;

  @Column()
  name!: string;

  @Column({ name: 'min_selection', type: 'int', default: 0 })
  minSelection!: number;

  @Column({ name: 'max_selection', type: 'int', default: 1 })
  maxSelection!: number;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;
}
