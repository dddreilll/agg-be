import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('stores')
export class Store {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  location!: string | null;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;
}
