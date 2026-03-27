import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { SentMessage } from '../sent-message/sent-message.entity';

@Module({
	imports: [
		TypeOrmModule.forRoot({
			type: 'sqlite',
			database: 'db.sqlite',
			entities: [User, SentMessage],
			synchronize: true, // DEV ONLY
		}),
		TypeOrmModule.forFeature([User]),
	],
	exports: [TypeOrmModule],
})
export class DatabaseModule { }