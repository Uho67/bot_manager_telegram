import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { UsersModule } from '@/api/users/users.module';
import { BotModule } from '@/bot/bot.module';
import { SentMessageModule } from '@/sent-message/sent-message.module';
import { UserSyncCronService } from './services/user-sync.cron.service';
import { PostMailoutCronService } from './services/post-mailout.cron.service';
import { DeleteMessageCronService } from './services/delete-message.cron.service';

@Module({
	imports: [ScheduleModule.forRoot(), UsersModule, BotModule, SentMessageModule],
	providers: [UserSyncCronService, PostMailoutCronService, DeleteMessageCronService],
})
export class CronModule { }
