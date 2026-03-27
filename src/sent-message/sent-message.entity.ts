import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('sent_message')
export class SentMessage {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column({ type: 'integer' })
  post_id!: number;

  @Column({ type: 'integer' })
  chat_id!: number;

  @Column({ type: 'integer' })
  message_id!: number;

  @Column({ type: 'boolean', default: false })
  to_delete: boolean = false;

  @Column({ type: 'datetime' })
  sent_at!: Date;
}
