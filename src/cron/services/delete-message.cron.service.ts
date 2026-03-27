import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectBot } from 'nestjs-telegraf';
import { Telegraf } from 'telegraf';
import { SentMessageService } from '@/sent-message/sent-message.service';

const BATCH_SIZE = 25;
const BATCH_DELAY_MS = 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

@Injectable()
export class DeleteMessageCronService {
  private readonly logger = new Logger(DeleteMessageCronService.name);
  private isRunning = false;

  constructor(
    @InjectBot() private readonly bot: Telegraf,
    private readonly sentMessageService: SentMessageService,
  ) {}

  @Cron('*/2 * * * *')
  async deleteMarkedMessages(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Previous delete process still running, skipping...');
      return;
    }

    this.isRunning = true;
    this.logger.log('Starting marked-message delete process...');

    try {
      const rows = await this.sentMessageService.findToDelete(500);
      if (rows.length === 0) {
        this.logger.log('No messages marked for deletion');
        return;
      }

      this.logger.log(`Found ${rows.length} message(s) to delete`);

      const processedIds: number[] = [];

      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);

        for (const row of batch) {
          try {
            await this.bot.telegram.deleteMessage(row.chat_id, row.message_id);
            processedIds.push(row.id);
          } catch (error: unknown) {
            // Telegram errors for already-deleted or too-old messages are expected
            const msg = error instanceof Error ? error.message : String(error);
            this.logger.warn(
              `Could not delete message ${row.message_id} in chat ${row.chat_id}: ${msg}`,
            );
            // Still mark as processed so we remove it from our DB
            processedIds.push(row.id);
          }
        }

        if (i + BATCH_SIZE < rows.length) {
          await sleep(BATCH_DELAY_MS);
        }
      }

      await this.sentMessageService.deleteByIds(processedIds);
      this.logger.log(`Deleted ${processedIds.length} sent_message record(s)`);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error('Delete-message process failed:', msg);
    } finally {
      this.isRunning = false;
    }
  }
}
