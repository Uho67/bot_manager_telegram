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

interface MailoutProductsResponse {
	product_ids: number[];
}

interface PostResponse {
	post: Post;
}

interface Mailout {
	id: number;
	chat_id: string;
	product_id: number;
	status: string;
	created_at: string;
	sent_at: string | null;
}

interface MailoutsResponse {
	mailouts: Mailout[];
}

/**
 * Cron service for sending mailout posts to users
 * Runs every 2 minutes
 */
@Injectable()
export class MailoutCronService {
	private readonly logger = new Logger(MailoutCronService.name);

	constructor(
		@InjectBot() private readonly bot: Telegraf,
		private readonly httpService: HttpService,
		private readonly cacheService: CacheService,
		private readonly buttonBuilder: ButtonBuilderService,
		private readonly imageHandler: ImageHandlerService,
		private readonly messageFormatter: MessageFormatterService,
	) { }

	/**
	 * Send mailout posts to users every 2 minutes
	 */
	@Cron('*/2 * * * *')
	async handleMailout() {
		this.logger.log('Starting mailout process...');

		try {
			// Step 1: Get products that should be sent
			const products = await this.getProductsToSend();
			if (products.length === 0) {
				this.logger.log('No products to send');
				return;
			}

			this.logger.log(`Found ${products.length} product(s) to send`);

			// Step 2: Process each product
			for (const productId of products) {
				await this.processProduct(productId);
			}

			this.logger.log('Mailout process completed');
		} catch (error: unknown) {
			const errorMessage =
				error instanceof Error ? error.message : 'Unknown error';
			this.logger.error('Mailout process failed:', errorMessage);

			if (
				error &&
				typeof error === 'object' &&
				'response' in error &&
				error.response &&
				typeof error.response === 'object' &&
				'status' in error.response &&
				'data' in error.response
			) {
				this.logger.error(
					`API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`,
				);
			}
		}
	}

	/**
	 * Get products that should be sent
	 */
	private async getProductsToSend(): Promise<number[]> {
		try {
			const { data } = await firstValueFrom(
				this.httpService.get<MailoutProductsResponse>(
					API_ENDPOINTS.MAILOUT_PRODUCTS,
				),
			);
			return data.product_ids || [];
		} catch (error) {
			this.logger.error('Failed to get products to send', error);
			return [];
		}
	}

	/**
	 * Process a single product: get post, cache it, get mailouts, send to users
	 */
	private async processProduct(productId: number): Promise<void> {
		this.logger.log(`Processing product ${productId}`);

		// Get post for this product (with caching)
		const post = await this.getPostByProductId(productId);
		if (!post) {
			this.logger.warn(`No post found for product ${productId}`);
			return;
		}

		// Cache post by ID
		const cacheKey = `${CACHE_PREFIXES.POST}${post.id}`;
		this.cacheService.set(cacheKey, post);
		this.logger.log(`Cached post ${post.id} for product ${productId}`);

		// Get mailouts for this product
		const mailouts = await this.getMailoutsByProduct(productId);
		if (mailouts.length === 0) {
			this.logger.log(`No mailouts found for product ${productId}`);
			return;
		}

		this.logger.log(
			`Found ${mailouts.length} mailout(s) for product ${productId}`,
		);

		// Send post to each mailout
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
				// Continue with other mailouts even if one fails
			}
		}

		// Delete sent mailouts
		if (sentMailoutIds.length > 0) {
			await this.deleteMailouts(sentMailoutIds);
			this.logger.log(
				`Deleted ${sentMailoutIds.length} mailout(s) for product ${productId}`,
			);
		}
	}

	/**
	 * Get post by product ID (with caching)
	 */
	private async getPostByProductId(productId: number): Promise<Post | null> {
		const cacheKey = `${CACHE_PREFIXES.POST}product_${productId}`;

		// Check cache first
		const cached = this.cacheService.get<Post>(cacheKey);
		if (cached) {
			this.logger.log(`Post for product ${productId} found in cache`);
			return cached;
		}

		// Fetch from API
		try {
			const { data } = await firstValueFrom(
				this.httpService.get<PostResponse>(
					API_ENDPOINTS.POST_BY_PRODUCT(productId),
				),
			);

			if (data.post) {
				this.cacheService.set(cacheKey, data.post);
				this.logger.log(
					`Fetched and cached post ${data.post.id} for product ${productId}`,
				);
				return data.post;
			}

			return null;
		} catch (error) {
			this.logger.error(
				`Failed to fetch post for product ${productId}`,
				error,
			);
			return null;
		}
	}

	/**
	 * Get mailouts by product ID
	 */
	private async getMailoutsByProduct(
		productId: number,
		limit: number = 200,
	): Promise<Mailout[]> {
		try {
			const { data } = await firstValueFrom(
				this.httpService.get<MailoutsResponse>(
					API_ENDPOINTS.MAILOUT_BY_PRODUCTS,
					{
						params: {
							product_ids: productId,
							limit,
						},
					},
				),
			);
			return data.mailouts || [];
		} catch (error) {
			this.logger.error(
				`Failed to get mailouts for product ${productId}`,
				error,
			);
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

		// Build buttons from post template layout
		const buttons: ButtonRow = post.template
			? this.buttonBuilder.buildTemplateButtons(post.template)
			: [];

		const caption = this.messageFormatter.formatPostMessage(post);

		// No image - send as text with buttons
		if (!post.image && !post.image_file_id) {
			await this.bot.telegram.sendMessage(chatIdNum, caption, {
				parse_mode: 'HTML',
				...(buttons.length > 0 ? Markup.inlineKeyboard(buttons) : {}),
			});
			return;
		}

		// Has image_file_id - use it directly
		if (post.image_file_id) {
			try {
				await this.bot.telegram.sendPhoto(chatIdNum, post.image_file_id, {
					caption,
					parse_mode: 'HTML',
					...(buttons.length > 0 ? Markup.inlineKeyboard(buttons) : {}),
				});
				return;
			} catch (error) {
				this.logger.warn(
					`Stored file_id invalid for post ${post.id}, re-uploading`,
				);
				// Continue to download and re-upload
			}
		}

		// Has image URL but no file_id - download, upload, save file_id
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

			// Save file_id to API in background (don't wait)
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
	 * Delete mailouts after sending
	 */
	private async deleteMailouts(ids: string[]): Promise<void> {
		try {
			await firstValueFrom(
				this.httpService.post(API_ENDPOINTS.MAILOUT_DELETE, {
					ids,
				}),
			);
			this.logger.log(`Deleted ${ids.length} mailout(s)`);
		} catch (error) {
			this.logger.error('Failed to delete mailouts', error);
			throw error;
		}
	}
}
