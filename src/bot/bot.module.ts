import { Module } from '@nestjs/common';
import { TelegrafModule } from 'nestjs-telegraf';
import { BotUpdate } from './bot.update';
import { BotService } from './bot.service';
import { UserMiddleware } from './bot.middleware';
import { UsersModule } from '@/api/users/users.module';
import { CatalogModule } from '@/api/catalog/catalog.module';
import {
  ImageHandlerService,
  MessageFormatterService,
  ButtonBuilderService,
} from './services';

@Module({
  imports: [
    TelegrafModule.forRootAsync({
      imports: [UsersModule],
      useFactory: (userMiddleware: UserMiddleware) => ({
        token: process.env.TELEGRAM_BOT_TOKEN || '',
        middlewares: [userMiddleware.middleware()],
      }),
      inject: [UserMiddleware],
    }),
    UsersModule,
    CatalogModule,
  ],
  providers: [
    BotService,
    BotUpdate,
    ImageHandlerService,
    MessageFormatterService,
    ButtonBuilderService,
  ],
})
export class BotModule {}
