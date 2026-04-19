import { Injectable, Logger } from '@nestjs/common';
import { Context, Markup } from 'telegraf';
import { CategoryService } from '@/api/catalog/category.service';
import { ProductService } from '@/api/catalog/product.service';
import { PostService } from '@/api/catalog/post.service';
import {
  Product,
  Category,
  CategoryListItem,
  Post,
  Template,
  ButtonRow,
  MatchContext,
} from '@/types';
import { BOT_MESSAGES, BUTTON_EMOJIS, BACK_BUTTON_TEXT } from '@/common/constants';
import {
  ImageHandlerService,
  MessageFormatterService,
  ButtonBuilderService,
} from './services';

export type BotContext = Context;

/**
 * Main bot service responsible for coordinating bot operations
 * Delegates specific tasks to specialized services
 */
@Injectable()
export class BotService {
  private readonly logger = new Logger(BotService.name);

  constructor(
    private readonly categoryService: CategoryService,
    private readonly productService: ProductService,
    private readonly postService: PostService,
    private readonly imageHandler: ImageHandlerService,
    private readonly messageFormatter: MessageFormatterService,
    private readonly buttonBuilder: ButtonBuilderService,
  ) { }

  // ==================== Category Methods ====================

  /**
   * Get all categories list
   */
  async getCategoryList(): Promise<CategoryListItem[]> {
    return this.categoryService.getCategoryList();
  }

  /**
   * Get category by ID
   */
  async getCategoryById(categoryId: number): Promise<Category | null> {
    return this.categoryService.getCategoryById(categoryId);
  }

  /**
   * Build category list buttons (sorted)
   */
  buildCategoryListButtons(categories: CategoryListItem[]) {
    return this.buttonBuilder.buildCategoryListButtons(categories);
  }

  /**
   * Build category content buttons (preserves API order)
   */
  buildCategoryContentButtons(category: Category) {
    return this.buttonBuilder.buildCategoryContentButtons(category);
  }

  async sendCategory(
    ctx: BotContext,
    category: Category,
    parentCategoryId?: number,
  ): Promise<void> {
    // If category has additional images, send them first as a media group
    if (category.additional_images && category.additional_images.length > 0) {
      await this.sendCategoryAdditionalImages(ctx, category);
    }

    // Then send the main category message (unchanged logic)
    let buttons = this.buildCategoryContentButtons(category);
    // Add back button (to parent category if provided, otherwise to start)
    buttons = this.buttonBuilder.addBackButton(buttons, parentCategoryId);
    const caption = BOT_MESSAGES.CATEGORY_LABEL(category.name);

    // Check if image URL is valid (not empty, not just base URL)
    const hasValidImageUrl =
      category.image &&
      category.image.trim() !== '' &&
      category.image.trim() !== '/' &&
      !category.image.endsWith('/') &&
      (category.image.startsWith('http://') ||
        category.image.startsWith('https://'));

    // No image - render as text with buttons
    if (!hasValidImageUrl && !category.image_file_id) {
      await ctx.reply(caption, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(buttons),
      });
      return;
    }

    // Has image_file_id - use it directly
    if (category.image_file_id) {
      try {
        await ctx.replyWithPhoto(category.image_file_id, {
          caption,
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard(buttons),
        });
        return;
      } catch (error) {
        this.logger.warn(
          `Stored file_id invalid for category ${category.id}, re-uploading`,
        );
        // Continue to download and re-upload if we have a valid image URL
        if (!hasValidImageUrl) {
          // No valid image URL, fall back to text
          await ctx.reply(caption, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard(buttons),
          });
          return;
        }
      }
    }

    // Has valid image URL but no file_id - download, upload, save file_id
    if (hasValidImageUrl) {
      await this.sendCategoryWithImageUrl(ctx, category, caption, buttons);
    } else {
      // Fallback: render as text if image_file_id failed and no valid URL
      await ctx.reply(caption, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(buttons),
      });
    }
  }

  /**
   * Send category additional images as a media group (before the main message)
   */
  private async sendCategoryAdditionalImages(
    ctx: BotContext,
    category: Category,
  ): Promise<void> {
    const mediaItems: Array<{
      type: 'photo';
      media: string | { source: Buffer };
    }> = [];

    const imageMapping: Array<{
      id: number;
      hadFileId: boolean;
    }> = [];

    for (let i = 0; i < Math.min(category.additional_images.length, 10); i++) {
      const img = category.additional_images[i];
      let media: string | { source: Buffer } | null = null;

      if (img.image_file_id) {
        media = img.image_file_id;
      } else if (img.image) {
        const hasValidUrl =
          img.image.startsWith('http://') || img.image.startsWith('https://');
        if (hasValidUrl) {
          const buffer = await this.imageHandler.downloadImage(img.image);
          if (buffer) {
            media = { source: buffer };
          }
        }
      }

      if (!media) continue;

      mediaItems.push({ type: 'photo', media });
      imageMapping.push({ id: img.id, hadFileId: !!img.image_file_id });
    }

    if (mediaItems.length === 0) return;

    try {
      if (mediaItems.length === 1) {
        // Single image — use replyWithPhoto (no caption, no buttons)
        const sentMessage = await ctx.replyWithPhoto(mediaItems[0].media as any, {});

        // Cache file_id if needed
        if (sentMessage.photo && imageMapping[0] && !imageMapping[0].hadFileId) {
          const fileId = this.imageHandler.extractLargestPhotoFileId(sentMessage.photo);
          if (fileId) {
            this.imageHandler.saveCategoryAdditionalImageFileId(imageMapping[0].id, fileId);
          }
        }
      } else {
        // Multiple images — send as media group
        const sentMessages = await ctx.replyWithMediaGroup(mediaItems as any);

        // Cache file_ids from sent messages (fire-and-forget)
        for (let i = 0; i < sentMessages.length; i++) {
          const msg = sentMessages[i] as any;
          const mapping = imageMapping[i];
          if (msg.photo && mapping && !mapping.hadFileId) {
            const fileId = this.imageHandler.extractLargestPhotoFileId(msg.photo);
            if (fileId) {
              this.imageHandler.saveCategoryAdditionalImageFileId(mapping.id, fileId);
            }
          }
        }
      }
    } catch (error) {
      this.logger.error('Failed to send category additional images', error);
    }
  }

  /**
   * Send category with image URL (download and upload)
   */
  private async sendCategoryWithImageUrl(
    ctx: BotContext,
    category: Category,
    caption: string,
    buttons: ButtonRow,
  ): Promise<void> {
    try {
      const imageBuffer = await this.imageHandler.downloadImage(
        category.image!,
      );
      if (!imageBuffer) {
        await ctx.reply(caption, {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard(buttons),
        });
        return;
      }

      const sentMessage = await ctx.replyWithPhoto(
        { source: imageBuffer },
        {
          caption,
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard(buttons),
        },
      );

      // Save file_id to API in background (don't wait)
      const fileId = this.imageHandler.extractLargestPhotoFileId(
        sentMessage.photo,
      );
      if (fileId) {
        this.imageHandler.saveCategoryImageFileId(category.id, fileId);
      }
    } catch (error) {
      this.logger.error('Failed to send category image', error);
      await ctx.reply(caption, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(buttons),
      });
    }
  }

  // ==================== Post Methods ====================

  /**
   * Get post by type (e.g., 'start')
   */
  async getPostByType(type: string): Promise<Post | null> {
    return this.postService.getPostByType(type);
  }

  /**
   * Build template buttons (preserves API order)
   */
  buildTemplateButtons(template: Template) {
    return this.buttonBuilder.buildTemplateButtons(template);
  }

  /**
   * Send post with optional image and template buttons
   * - Gets post from API/cache
   * - Builds buttons from post template layout
   * - Renders post name, description, image, and buttons
   * @param post - Post to send
   */
  async sendPost(ctx: BotContext, post: Post): Promise<void> {
    // Build buttons from post template layout
    const buttons = post.template
      ? this.buildTemplateButtons(post.template)
      : [];

    const caption = this.messageFormatter.formatPostMessage(post);

    // No image - render as text with buttons
    if (!post.image && !post.image_file_id) {
      await ctx.reply(caption, {
        parse_mode: 'HTML',
        ...(buttons.length > 0 ? Markup.inlineKeyboard(buttons) : {}),
      });
      return;
    }

    // Has image_file_id - use it directly
    if (post.image_file_id) {
      try {
        await ctx.replyWithPhoto(post.image_file_id, {
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
      await this.sendPostWithImageUrl(ctx, post, caption, buttons);
    }
  }

  /**
   * Send post with image URL (download and upload)
   */
  private async sendPostWithImageUrl(
    ctx: BotContext,
    post: Post,
    caption: string,
    buttons: ButtonRow,
  ): Promise<void> {
    try {
      const imageBuffer = await this.imageHandler.downloadImage(post.image!);
      if (!imageBuffer) {
        await ctx.reply(caption, {
          parse_mode: 'HTML',
          ...(buttons.length > 0 ? Markup.inlineKeyboard(buttons) : {}),
        });
        return;
      }

      const sentMessage = await ctx.replyWithPhoto(
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
      await ctx.reply(caption, {
        parse_mode: 'HTML',
        ...(buttons.length > 0 ? Markup.inlineKeyboard(buttons) : {}),
      });
    }
  }

  /**
   * Add back button to button rows
   * @param buttons - Existing button rows
   * @param categoryId - Optional category ID for back navigation
   * @returns Button rows with back button appended
   */
  addBackButton(buttons: ButtonRow, categoryId?: number): ButtonRow {
    return this.buttonBuilder.addBackButton(buttons, categoryId);
  }

  // ==================== Product Methods ====================

  /**
   * Get product by ID
   */
  async getProductById(productId: number): Promise<Product | null> {
    return this.productService.getProductById(productId);
  }

  /**
   * Send product with optional image and template buttons
   * - Gets product template from API/cache
   * - Builds buttons from template layout
   * - Renders product image, name, description, and buttons
   * - Always includes back button at the bottom
   * @param categoryId - Optional category ID to navigate back to
   */
  async sendProduct(
    ctx: BotContext,
    product: Product,
    categoryId?: number,
  ): Promise<void> {
    // Build buttons from product template layout
    let buttons: ButtonRow = product.template
      ? this.buildTemplateButtons(product.template)
      : [];

    // Add "Більше фото" button if product has additional images
    if (product.additional_images && product.additional_images.length > 0) {
      const photosCallback = categoryId
        ? `product_photos/${product.id}?from=${categoryId}`
        : `product_photos/${product.id}`;
      buttons = [
        ...buttons,
        [Markup.button.callback('📸 Більше фото', photosCallback)],
      ];
    }

    // Add back button (to category if provided, otherwise to start)
    buttons = this.buttonBuilder.addBackButton(buttons, categoryId);

    const caption = this.messageFormatter.formatProductMessage(product);

    // No image - render as text with buttons
    if (!product.image && !product.image_file_id) {
      await ctx.reply(caption, {
        parse_mode: 'HTML',
        ...(buttons.length > 0 ? Markup.inlineKeyboard(buttons) : {}),
      });
      return;
    }

    // Has image_file_id - use it directly
    if (product.image_file_id) {
      try {
        await ctx.replyWithPhoto(product.image_file_id, {
          caption,
          parse_mode: 'HTML',
          ...(buttons.length > 0 ? Markup.inlineKeyboard(buttons) : {}),
        });
        return;
      } catch (error) {
        this.logger.warn(
          `Stored file_id invalid for product ${product.id}, re-uploading`,
        );
        // Continue to download and re-upload
      }
    }

    // Has image URL but no file_id - download, upload, save file_id
    if (product.image) {
      await this.sendProductWithImageUrl(ctx, product, caption, buttons);
    }
  }

  /**
   * Send product with image URL (download and upload)
   */
  private async sendProductWithImageUrl(
    ctx: BotContext,
    product: Product,
    caption: string,
    buttons: ButtonRow,
  ): Promise<void> {
    try {
      const imageBuffer = await this.imageHandler.downloadImage(product.image!);
      if (!imageBuffer) {
        await ctx.reply(caption, {
          parse_mode: 'HTML',
          ...(buttons.length > 0 ? Markup.inlineKeyboard(buttons) : {}),
        });
        return;
      }

      const sentMessage = await ctx.replyWithPhoto(
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
        this.imageHandler.saveProductImageFileId(product.id, fileId);
      }
    } catch (error) {
      this.logger.error('Failed to send product image', error);
      await ctx.reply(caption, {
        parse_mode: 'HTML',
        ...(buttons.length > 0 ? Markup.inlineKeyboard(buttons) : {}),
      });
    }
  }

  /**
   * Send all product photos (main + additional) as a media group
   * Triggered by the "Більше фото" button
   * @param categoryId - Optional category ID for back navigation
   */
  async sendProductPhotos(
    ctx: BotContext,
    product: Product,
    categoryId?: number,
  ): Promise<void> {
    const allImages: Array<{
      type: 'main' | 'additional';
      id: number;
      image: string | null;
      image_file_id: string | null;
    }> = [];

    // Add main image first
    if (product.image || product.image_file_id) {
      allImages.push({
        type: 'main',
        id: product.id,
        image: product.image,
        image_file_id: product.image_file_id,
      });
    }

    // Add additional images
    if (product.additional_images) {
      for (const img of product.additional_images) {
        allImages.push({
          type: 'additional',
          id: img.id,
          image: img.image,
          image_file_id: img.image_file_id,
        });
      }
    }

    if (allImages.length === 0) {
      await ctx.reply(BOT_MESSAGES.PRODUCT_NOT_FOUND);
      return;
    }

    // Build media group (max 10 items)
    const mediaItems: Array<{
      type: 'photo';
      media: string | { source: Buffer };
      caption?: string;
      parse_mode?: string;
    }> = [];

    const imageMapping: Array<{
      type: 'main' | 'additional';
      id: number;
      hadFileId: boolean;
    }> = [];

    const caption = this.messageFormatter.formatProductMessage(product);

    for (let i = 0; i < Math.min(allImages.length, 10); i++) {
      const img = allImages[i];
      let media: string | { source: Buffer } | null = null;

      if (img.image_file_id) {
        media = img.image_file_id;
      } else if (img.image) {
        const hasValidUrl =
          img.image.startsWith('http://') || img.image.startsWith('https://');
        if (hasValidUrl) {
          const buffer = await this.imageHandler.downloadImage(img.image);
          if (buffer) {
            media = { source: buffer };
          }
        }
      }

      if (!media) continue;

      mediaItems.push({
        type: 'photo',
        media,
        ...(mediaItems.length === 0
          ? { caption, parse_mode: 'HTML' }
          : {}),
      });

      imageMapping.push({
        type: img.type,
        id: img.id,
        hadFileId: !!img.image_file_id,
      });
    }

    if (mediaItems.length === 0) {
      await ctx.reply(caption, { parse_mode: 'HTML' });
      return;
    }

    // Build "back to product" button
    const backToProductCallback = categoryId
      ? `product/${product.id}?from=${categoryId}`
      : `product/${product.id}`;
    const backToProductButton: ButtonRow = [
      [
        Markup.button.callback(
          `${BUTTON_EMOJIS.BACK} ${BACK_BUTTON_TEXT}`,
          backToProductCallback,
        ),
      ],
    ];

    // Single image — use replyWithPhoto
    if (mediaItems.length === 1) {
      await ctx.replyWithPhoto(mediaItems[0].media as any, {
        caption,
        parse_mode: 'HTML',
      });

      // Cache file_id if needed
      const msg = ctx as any;
      if (
        msg.message?.photo &&
        imageMapping[0] &&
        !imageMapping[0].hadFileId
      ) {
        const fileId = this.imageHandler.extractLargestPhotoFileId(
          msg.message.photo,
        );
        if (fileId) {
          if (imageMapping[0].type === 'main') {
            this.imageHandler.saveProductImageFileId(
              imageMapping[0].id,
              fileId,
            );
          } else {
            this.imageHandler.saveAdditionalImageFileId(
              imageMapping[0].id,
              fileId,
            );
          }
        }
      }
    } else {
      // Multiple images — send media group
      try {
        const sentMessages = await ctx.replyWithMediaGroup(mediaItems as any);

        // Cache file_ids from sent messages (fire-and-forget)
        for (let i = 0; i < sentMessages.length; i++) {
          const msg = sentMessages[i] as any;
          const mapping = imageMapping[i];
          if (msg.photo && mapping && !mapping.hadFileId) {
            const fileId = this.imageHandler.extractLargestPhotoFileId(
              msg.photo,
            );
            if (fileId) {
              if (mapping.type === 'main') {
                this.imageHandler.saveProductImageFileId(mapping.id, fileId);
              } else {
                this.imageHandler.saveAdditionalImageFileId(
                  mapping.id,
                  fileId,
                );
              }
            }
          }
        }
      } catch (error) {
        this.logger.error('Failed to send product media group', error);
        await ctx.reply(caption, { parse_mode: 'HTML' });
      }
    }

    // Send images template message with buttons, or fallback to bare back button
    if (product.images_template && product.images_template.text) {
      const templateButtons = this.buildTemplateButtons(product.images_template);
      const allButtons = [...templateButtons, ...backToProductButton];
      await ctx.reply(product.images_template.text, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard(allButtons),
      });
    } else {
      await ctx.reply('⬅️', Markup.inlineKeyboard(backToProductButton));
    }
  }

  // ==================== Utility Methods ====================

  /**
   * Get user's first name from context
   */
  getUserName(ctx: BotContext): string {
    return ctx.from?.first_name || 'there';
  }

  /**
   * Extract ID from callback query match
   */
  getIdFromMatch(ctx: MatchContext): number {
    return parseInt(ctx.match[1], 10);
  }
}
