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
import { BOT_MESSAGES } from '@/common/constants';
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
