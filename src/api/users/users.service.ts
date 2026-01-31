import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserStatus } from '@/database/entities/user.entity';
import { CreateUserData } from '@/types';

@Injectable()
export class UsersService {
    constructor(
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
    ) { }

    /**
     * Create a new user
     */
    create(data: CreateUserData): Promise<User> {
        const user = this.userRepo.create(data);
        return this.userRepo.save(user);
    }

    /**
     * Find user by chat_id
     */
    findByChatId(chatId: number): Promise<User | null> {
        return this.userRepo.findOne({ where: { chat_id: chatId } });
    }

    /**
     * Find user by id
     */
    findById(id: number): Promise<User | null> {
        return this.userRepo.findOne({ where: { id } });
    }

    /**
     * Get all users
     */
    findAll(): Promise<User[]> {
        return this.userRepo.find();
    }

    /**
     * Upsert user by chat_id
     * If user exists, update name and username
     * If not, create new user
     */
    async upsertByChatId(data: CreateUserData): Promise<User> {
        const existingUser = await this.findByChatId(data.chat_id);

        if (existingUser) {
            // Update existing user
            existingUser.name = data.name ?? existingUser.name;
            existingUser.username = data.username || existingUser.username;
            return this.userRepo.save(existingUser);
        }

        // Create new user
        return this.create({
            ...data,
            status: data.status ?? UserStatus.ACTIVE,
        });
    }

    /**
     * Update user status
     */
    async updateStatus(chatId: number, status: UserStatus): Promise<User | null> {
        const user = await this.findByChatId(chatId);
        if (!user) {
            return null;
        }
        user.status = status;
        return this.userRepo.save(user);
    }

}
