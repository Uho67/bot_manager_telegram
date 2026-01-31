import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '@/database/entities/user.entity';
import { UsersService } from './users.service';
import { UserMiddleware } from '@/bot/bot.middleware';

@Module({
    imports: [TypeOrmModule.forFeature([User])],
    providers: [UsersService, UserMiddleware],
    exports: [UsersService, UserMiddleware],
})
export class UsersModule { }
