import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { CacheModule } from './cache/cache.module';
import { ApiModule } from './api/api.module';
import { BotModule } from './bot/bot.module';

@Module({
    imports: [
        // Load environment variables
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: '.env',
        }),
        // Database (SQLite + TypeORM)
        DatabaseModule,
        // In-memory cache service
        CacheModule,
        // HTTP client with auth (global)
        ApiModule,
        // Telegram bot
        BotModule,
    ],
    controllers: [AppController],
    providers: [AppService],
})
export class AppModule { }
