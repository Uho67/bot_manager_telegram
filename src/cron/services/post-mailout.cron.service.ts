import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectBot } from 'nestjs-telegraf';
import { Telegraf, Markup } from 'telegraf';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { CacheService } from '@/cache/cache.service';
import { Post, ButtonRow } from '@/types';
import { API_ENDPOINTS, CACHE_PREFIXES } from '@/common/constants';
import { ButtonBuilderService } from '@/bot/services/button-builder.service';
import { ImageHandlerService } from '@/bot/services/image-handler.service';
import { MessageFormatterService } from '@/bot/services/message-formatter.service';
import { SentMessageService } from '@/sent-message/sent-message.service';

const SEND_BATCH_SIZE = 30;
const SEND_WINDOW_MS = 2000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface PostMailoutPostsResponse {
  post_ids: number[];
}

// GET /telegram/post/{id} returns the post fields directly (not wrapped)

interface PostMailout {
  id: number;
  chat_id: string;
  post_id: number;
  status: string;
  remove_mode: string;
  created_at: string;
  sent_at: string | null;
}

interface PostMailoutsResponse {
  mailouts: PostMailout[];
}

/**
 * Cron service for sending post mailouts to users
 * Runs every 2 minutes
 */
@Injectable()
export class PostMailoutCronService {
  private readonly logger = new Logger(PostMailoutCronService.name);
  private isRunning = false;

  constructor(
    @InjectBot() private readonly bot: Telegraf,
    private readonly httpService: HttpService,
    private readonly cacheService: CacheService,
    private readonly buttonBuilder: ButtonBuilderService,
    private readonly imageHandler: ImageHandlerService,
    private readonly messageFormatter: MessageFormatterService,
    private readonly sentMessageService: SentMessageService,
  ) {}

  /**
   * Send post mailouts to users every 2 minutes
   */
  @Cron('*/2 * * * *')
  async handlePostMailout() {
    if (this.isRunning) {
      this.logger.warn('Previous mailout process still running, skipping...');
      return;
    }

    this.isRunning = true;
    this.logger.log('Starting post mailout process...');

    try {
      const posts = await this.getPostsToSend();
      if (posts.length === 0) {
        this.logger.log('No posts to send');
        return;
      }

      this.logger.log(`Found ${posts.length} post(s) to send`);

      for (const postId of posts) {
        await this.processPost(postId);
      }

      this.logger.log('Post mailout process completed');
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Post mailout process failed:', errorMessage);

      if (
        error &&
        typeof error === 'object' &&
        'response' in error &&
        error.response &&
        typeof error.response === 'object' &&
        'status' in error.response &&
        'data' in error.response
      ) {
        const response = error.response as { status: string | number; data: unknown };
        this.logger.error(
          `API error: ${String(response.status)} - ${JSON.stringify(response.data)}`,
        );
      }
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Get post IDs that have pending mailouts
   */
  private async getPostsToSend(): Promise<number[]> {
    try {
      const { data } = await firstValueFrom(
        this.httpService.get<PostMailoutPostsResponse>(
          API_ENDPOINTS.MAILOUT_POST_POSTS,
        ),
      );
      return data.post_ids || [];
    } catch (error) {
      this.logger.error('Failed to get posts to send', error);
      return [];
    }
  }

  /**
   * Process a single post: fetch up to 1000 mailouts, send with rate limiting, then delete sent records
   */
  private async processPost(postId: number): Promise<void> {
    this.logger.log(`Processing post ${postId}`);

    const post = await this.getPostById(postId);
    if (!post) {
      this.logger.warn(`No post found for id ${postId}`);
      return;
    }

    const cacheKey = `${CACHE_PREFIXES.POST}${post.id}`;
    this.cacheService.set(cacheKey, post);

    const mailouts = await this.getMailoutsByPost(postId, 1000);
    if (mailouts.length === 0) {
      this.logger.log(`No mailouts found for post ${postId}`);
      return;
    }

    this.logger.log(`Processing ${mailouts.length} mailout(s) for post ${postId}`);

    const sentMailoutIds: string[] = [];
    const sentRecords: { post_id: number; chat_id: number; message_id: number; sent_at: Date }[] = [];
    const blockedItems: { mailoutId: string; chatId: string }[] = [];

    for (let i = 0; i < mailouts.length; i += SEND_BATCH_SIZE) {
      const chunk = mailouts.slice(i, i + SEND_BATCH_SIZE);
      const chunkStart = Date.now();

      for (const mailout of chunk) {
        try {
          const result = await this.sendPostToChatId(mailout.chat_id, post);
          sentMailoutIds.push(mailout.id.toString());
          if (mailout.remove_mode === 'remove') {
            sentRecords.push({
              post_id: post.id,
              chat_id: parseInt(mailout.chat_id, 10),
              message_id: result.message_id,
              sent_at: new Date(),
            });
          }
          this.logger.log(
            `Sent post ${post.id} to chat_id ${mailout.chat_id} (mailout ${mailout.id})`,
          );
        } catch (error) {
          if (this.isUserUnreachableError(error)) {
            this.logger.warn(
              `User ${mailout.chat_id} is unreachable (blocked or deleted) — deactivating (mailout ${mailout.id})`,
            );
            blockedItems.push({ mailoutId: mailout.id.toString(), chatId: mailout.chat_id });
          } else {
            this.logger.error(
              `Failed to send post to chat_id ${mailout.chat_id} (mailout ${mailout.id})`,
              error,
            );
          }
        }
      }

      const isLastChunk = i + SEND_BATCH_SIZE >= mailouts.length;
      if (!isLastChunk) {
        const elapsed = Date.now() - chunkStart;
        const remaining = SEND_WINDOW_MS - elapsed;
        if (remaining > 0) {
          await sleep(remaining);
        }
      }
    }

    if (blockedItems.length > 0) {
      await this.reportBlockedUsers(blockedItems);
    }

    if (sentMailoutIds.length > 0) {
      if (sentRecords.length > 0) {
        await this.sentMessageService.bulkInsert(sentRecords);
      }
      await this.deletePostMailouts(sentMailoutIds);
    }

    this.logger.log(`Finished post ${postId}: sent ${sentMailoutIds.length} mailout(s)`);
  }

  /**
   * Get post by ID (with caching)
   */
  private async getPostById(postId: number): Promise<Post | null> {
    const cacheKey = `${CACHE_PREFIXES.POST}${postId}`;

    const cached = this.cacheService.get<Post>(cacheKey);
    if (cached) {
      this.logger.log(`Post ${postId} found in cache`);
      return cached;
    }

    try {
      const { data } = await firstValueFrom(
        this.httpService.get<Post>(API_ENDPOINTS.POST_BY_ID(postId)),
      );

      if (data && data.id) {
        this.cacheService.set(cacheKey, data);
        return data;
      }

      return null;
    } catch (error) {
      this.logger.error(`Failed to fetch post ${postId}`, error);
      return null;
    }
  }

  /**
   * Get post mailouts by post ID
   */
  private async getMailoutsByPost(
    postId: number,
    limit: number = 300,
  ): Promise<PostMailout[]> {
    try {
      const { data } = await firstValueFrom(
        this.httpService.get<PostMailoutsResponse>(
          API_ENDPOINTS.MAILOUT_POST_BY_POSTS,
          {
            params: {
              post_ids: postId,
              limit,
            },
          },
        ),
      );
      return data.mailouts || [];
    } catch (error) {
      this.logger.error(`Failed to get mailouts for post ${postId}`, error);
      return [];
    }
  }

  /**
   * Send post directly to a chat_id, returns the sent Telegram message
   */
  private async sendPostToChatId(chatId: string, post: Post): Promise<{ message_id: number }> {
    const chatIdNum = parseInt(chatId, 10);
    if (isNaN(chatIdNum)) {
      throw new Error(`Invalid chat_id: ${chatId}`);
    }

    const buttons: ButtonRow = post.template
      ? this.buttonBuilder.buildTemplateButtons(post.template)
      : [];

    const caption = this.messageFormatter.formatPostMessage(post);

    if (!post.image && !post.image_file_id) {
      return this.bot.telegram.sendMessage(chatIdNum, caption, {
        parse_mode: 'HTML',
        ...(buttons.length > 0 ? Markup.inlineKeyboard(buttons) : {}),
      });
    }

    if (post.image_file_id) {
      try {
        return await this.bot.telegram.sendPhoto(chatIdNum, post.image_file_id, {
          caption,
          parse_mode: 'HTML',
          ...(buttons.length > 0 ? Markup.inlineKeyboard(buttons) : {}),
        });
      } catch (error) {
        if (this.isUserUnreachableError(error)) {
          throw error;
        }
        this.logger.warn(
          `Stored file_id invalid for post ${post.id}, re-uploading`,
        );
      }
    }

    if (post.image) {
      return this.sendPostWithImageUrl(chatIdNum, post, caption, buttons);
    }

    // Fallback: send as text if image path is unexpectedly empty
    return this.bot.telegram.sendMessage(chatIdNum, caption, {
      parse_mode: 'HTML',
      ...(buttons.length > 0 ? Markup.inlineKeyboard(buttons) : {}),
    });
  }

  /**
   * Send post with image URL (download and upload), returns sent message
   */
  private async sendPostWithImageUrl(
    chatId: number,
    post: Post,
    caption: string,
    buttons: ButtonRow,
  ): Promise<{ message_id: number }> {
    try {
      const imageBuffer = await this.imageHandler.downloadImage(post.image!);
      if (!imageBuffer) {
        return this.bot.telegram.sendMessage(chatId, caption, {
          parse_mode: 'HTML',
          ...(buttons.length > 0 ? Markup.inlineKeyboard(buttons) : {}),
        });
      }

      const sentMessage = await this.bot.telegram.sendPhoto(
        chatId,
        { source: imageBuffer },
        {
          caption,
          parse_mode: 'HTML',
          ...(buttons.length > 0 ? Markup.inlineKeyboard(buttons) : {}),
        },
      );

      const fileId = this.imageHandler.extractLargestPhotoFileId(
        sentMessage.photo,
      );
      if (fileId) {
        this.imageHandler.savePostImageFileId(post.id, fileId);
      }

      return sentMessage;
    } catch (error) {
      this.logger.error('Failed to send post image', error);
      return this.bot.telegram.sendMessage(chatId, caption, {
        parse_mode: 'HTML',
        ...(buttons.length > 0 ? Markup.inlineKeyboard(buttons) : {}),
      });
    }
  }

  /**
   * Delete post mailouts after sending
   */
  private async deletePostMailouts(ids: string[]): Promise<void> {
    try {
      await firstValueFrom(
        this.httpService.post(API_ENDPOINTS.MAILOUT_POST_DELETE, { ids }),
      );
      this.logger.log(`Deleted ${ids.length} post mailout(s)`);
    } catch (error) {
      this.logger.error('Failed to delete post mailouts', error);
      throw error;
    }
  }

  /**
   * Report blocked users to Symfony: delete their mailouts and set status to inactive.
   */
  private async reportBlockedUsers(
    items: { mailoutId: string; chatId: string }[],
  ): Promise<void> {
    const mailoutIds = items.map((i) => i.mailoutId);
    const chatIds = [...new Set(items.map((i) => i.chatId))];

    try {
      await firstValueFrom(
        this.httpService.post(API_ENDPOINTS.MAILOUT_POST_REPORT_BLOCKED, {
          mailout_ids: mailoutIds,
          chat_ids: chatIds,
        }),
      );
      this.logger.log(
        `Reported ${items.length} blocked user(s) to Symfony (deactivated + mailouts removed)`,
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to report blocked users to Symfony', msg);
    }
  }

  /**
   * Returns true when the user is permanently unreachable:
   * - 403: user blocked the bot
   * - 400 "chat not found": user deleted their Telegram account
   */
  private isUserUnreachableError(error: unknown): boolean {
    if (typeof error !== 'object' || error === null) return false;
    const response = (error as Record<string, unknown>)['response'];
    if (typeof response !== 'object' || response === null) return false;
    const r = response as Record<string, unknown>;
    if (r['error_code'] === 403) return true;
    if (r['error_code'] === 400) {
      return typeof r['description'] === 'string' && r['description'].includes('chat not found');
    }
    return false;
  }
}
