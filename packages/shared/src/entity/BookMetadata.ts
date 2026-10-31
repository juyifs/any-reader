import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'book_metadata' })
@Index(['uid', 'ruleId', 'url'], { unique: true })
export class BookMetadata {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'uid', type: 'integer', default: 0 })
  uid!: number;

  @Column({ name: 'rule_id', type: 'text', default: '' })
  ruleId!: string;

  @Column({ name: 'url', type: 'text', default: '' })
  url!: string;

  @Column({ name: 'name', type: 'text', default: '' })
  name!: string;

  @Column({ name: 'author', type: 'text', default: '' })
  author!: string;

  @Column({ name: 'cover', type: 'text', default: '' })
  cover!: string;

  @Column({ name: 'description', type: 'text', default: '' })
  description!: string;

  @Column({ name: 'update_time', type: 'integer', default: 0 })
  updateTime!: number;
}
