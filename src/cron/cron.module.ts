import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { UsersModule } from '@/api/users/users.module';
import { BotModule } from '@/bot/bot.module';
import { UserSyncCronService } from './services/user-sync.cron.service';
import { PostMailoutCronService } from './services/post-mailout.cron.service';

@Module({
	imports: [ScheduleModule.forRoot(), UsersModule, BotModule],
	providers: [UserSyncCronService, PostMailoutCronService],
})
export class CronModule { }
