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

interface PostMailoutPostsResponse {
  post_ids: number[];
}

// GET /telegram/post/{id} returns the post fields directly (not wrapped)

interface PostMailout {
  id: number;
  chat_id: string;
  post_id: number;
  status: string;
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
   * Process a single post: fetch it, get mailouts in batches of 300,
   * send to users, delete only sent records, repeat until done
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

    const batchSize = 300;
    let totalSent = 0;

    while (true) {
      const mailouts = await this.getMailoutsByPost(postId, batchSize);
      if (mailouts.length === 0) {
        break;
      }

      this.logger.log(
        `Processing batch of ${mailouts.length} mailout(s) for post ${postId}`,
      );

      const sentMailoutIds: string[] = [];
      for (const mailout of mailouts) {
        try {
          await this.sendPostToChatId(mailout.chat_id, post);
          sentMailoutIds.push(mailout.id.toString());
          this.logger.log(
            `Sent post ${post.id} to chat_id ${mailout.chat_id} (mailout ${mailout.id})`,
          );
        } catch (error) {
          this.logger.error(
            `Failed to send post to chat_id ${mailout.chat_id} (mailout ${mailout.id})`,
            error,
          );
        }
      }

      if (sentMailoutIds.length > 0) {
        await this.deletePostMailouts(sentMailoutIds);
        totalSent += sentMailoutIds.length;
        this.logger.log(
          `Deleted ${sentMailoutIds.length} sent mailout(s) for post ${postId} (total: ${totalSent})`,
        );
      }

      // If we got fewer than the batch size, there are no more mailouts
      if (mailouts.length < batchSize) {
        break;
      }
    }

    if (totalSent > 0) {
      this.logger.log(
        `Finished post ${postId}: sent ${totalSent} mailout(s) total`,
      );
    } else {
      this.logger.log(`No mailouts found for post ${postId}`);
    }
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
   * Send post directly to a chat_id
   */
  private async sendPostToChatId(chatId: string, post: Post): Promise<void> {
    const chatIdNum = parseInt(chatId, 10);
    if (isNaN(chatIdNum)) {
      throw new Error(`Invalid chat_id: ${chatId}`);
    }

    const buttons: ButtonRow = post.template
      ? this.buttonBuilder.buildTemplateButtons(post.template)
      : [];

    const caption = this.messageFormatter.formatPostMessage(post);

    if (!post.image && !post.image_file_id) {
      await this.bot.telegram.sendMessage(chatIdNum, caption, {
        parse_mode: 'HTML',
        ...(buttons.length > 0 ? Markup.inlineKeyboard(buttons) : {}),
      });
      return;
    }

    if (post.image_file_id) {
      try {
        await this.bot.telegram.sendPhoto(chatIdNum, post.image_file_id, {
          caption,
          parse_mode: 'HTML',
          ...(buttons.length > 0 ? Markup.inlineKeyboard(buttons) : {}),
        });
        return;
      } catch {
        this.logger.warn(
          `Stored file_id invalid for post ${post.id}, re-uploading`,
        );
      }
    }

    if (post.image) {
      await this.sendPostWithImageUrl(chatIdNum, post, caption, buttons);
    }
  }

  /**
   * Send post with image URL (download and upload)
   */
  private async sendPostWithImageUrl(
    chatId: number,
    post: Post,
    caption: string,
    buttons: ButtonRow,
  ): Promise<void> {
    try {
      const imageBuffer = await this.imageHandler.downloadImage(post.image!);
      if (!imageBuffer) {
        await this.bot.telegram.sendMessage(chatId, caption, {
          parse_mode: 'HTML',
          ...(buttons.length > 0 ? Markup.inlineKeyboard(buttons) : {}),
        });
        return;
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
    } catch (error) {
      this.logger.error('Failed to send post image', error);
      await this.bot.telegram.sendMessage(chatId, caption, {
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
}
