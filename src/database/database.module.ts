import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { SentMessage } from '../sent-message/sent-message.entity';
import * as path from 'path';

@Module({
	imports: [
		TypeOrmModule.forRoot({
			type: 'better-sqlite3',
			database: path.join(process.cwd(), 'db.sqlite'),
			entities: [User, SentMessage],
			synchronize: true, // DEV ONLY
		}),
		TypeOrmModule.forFeature([User]),
	],
	exports: [TypeOrmModule],
})
export class DatabaseModule { }