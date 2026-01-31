import {
	Entity,
	PrimaryGeneratedColumn,
	Column,
	Index,
} from 'typeorm';

export enum UserStatus {
	ACTIVE = 'active',
	BLOCKED = 'blocked',
	INACTIVE = 'inactive',
}

@Entity('users')
export class User {
	@PrimaryGeneratedColumn()
	id!: number;

	@Column({ length: 100 })
	name: string = '';

	@Column({ length: 100 })
	username!: string;

	@Index({ unique: true })
	@Column({ type: 'integer' })
	chat_id!: number;

	@Column({
		type: 'text',
		default: UserStatus.ACTIVE,
	})
	status!: UserStatus;
}