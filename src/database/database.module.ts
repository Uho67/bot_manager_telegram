import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';

@Module({
	imports: [
		TypeOrmModule.forRoot({
			type: 'sqlite',
			database: 'db.sqlite',
			entities: [User],
			synchronize: true, // DEV ONLY
		}),
		TypeOrmModule.forFeature([User]),
	],
	exports: [TypeOrmModule],
})
export class DatabaseModule { }