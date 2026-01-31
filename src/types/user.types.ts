import { UserStatus } from '@/database/entities/user.entity';

/**
 * Data needed to create/update a user
 */
export interface CreateUserData {
    chat_id: number;
    name?: string;
    username: string;
    status?: UserStatus;
}
