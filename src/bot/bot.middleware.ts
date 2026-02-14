import { Injectable, Logger } from '@nestjs/common';
import { Context } from 'telegraf';
import { UsersService } from '@/api/users/users.service';
import { UserStatus } from '@/database/entities/user.entity';

/**
 * Middleware for handling user data in Telegram bot
 * Automatically saves/updates user information on each interaction
 */
@Injectable()
export class UserMiddleware {
  private readonly logger = new Logger(UserMiddleware.name);

  constructor(private readonly usersService: UsersService) {}

  /**
   * Create middleware function for Telegraf
   * @returns Middleware function that saves user data
   */
  middleware() {
    return async (ctx: Context, next: () => Promise<void>) => {
      const from = ctx.from;
      const chatId = ctx.chat?.id;

      if (chatId && from) {
        try {
          await this.usersService.upsertByChatId({
            chat_id: chatId,
            name:
              [from.first_name, from.last_name].filter(Boolean).join(' ') ||
              '',
            username: from.username || '',
            status: UserStatus.ACTIVE,
          });
          this.logger.debug(`User saved: ${from.username || chatId}`);
        } catch (error) {
          this.logger.error('Failed to save user in middleware', error);
        }
      }

      await next();
    };
  }
}
