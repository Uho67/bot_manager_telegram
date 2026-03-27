import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SentMessage } from './sent-message.entity';
import { SentMessageService } from './sent-message.service';
import { SentMessageController } from './sent-message.controller';

@Module({
  imports: [TypeOrmModule.forFeature([SentMessage])],
  controllers: [SentMessageController],
  providers: [SentMessageService],
  exports: [SentMessageService],
})
export class SentMessageModule {}
