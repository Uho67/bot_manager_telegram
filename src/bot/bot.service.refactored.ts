import { Injectable, Logger } from '@nestjs/common';
import { Context, Markup } from 'telegraf';
import { CategoryService } from '@/api/catalog/category.service';
import { ProductService } from '@/api/catalog/product.service';
import { TemplateService } from '@/api/catalog/template.service';
import {
  Product,
  Category,
  CategoryListItem,
  Template,
  TemplateType,
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
    private readonly templateService: TemplateService,
    private readonly imageHandler: ImageHandlerService,
    private readonly messageFormatter: MessageFormatterService,
    private readonly buttonBuilder: ButtonBuilderService,
  ) {}

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

  /**
   * Send category with optional image
   * - If image_file_id exists, use it directly (instant)
   * - If not but image URL exists, download, upload to Telegram, save file_id to API
   * - If no image at all, send text only with buttons
   */
  async sendCategory(ctx: BotContext, category: Category): Promise<void> {
    const buttons = this.buildCategoryContentButtons(category);
    const caption = BOT_MESSAGES.CATEGORY_LABEL(category.name);

    // No image - render as text with buttons
    if (!category.image && !category.image_file_id) {
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
        // Continue to download and re-upload
      }
    }

    // Has image URL but no file_id - download, upload, save file_id
    if (category.image) {
      await this.sendCategoryWithImageUrl(ctx, category, caption, buttons);
    }
  }

  /**
   * Send category with image URL (download and upload)
   */
  private async sendCategoryWithImageUrl(
    ctx: BotContext,
    category: Category,
    caption: string,
    buttons: any[][],
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

  // ==================== Template Methods ====================

  /**
   * Get template by type
   */
  async getTemplate(type: TemplateType | string): Promise<Template | null> {
    return this.templateService.getTemplateByType(type);
  }

  /**
   * Build template buttons (preserves API order)
   */
  buildTemplateButtons(template: Template) {
    return this.buttonBuilder.buildTemplateButtons(template);
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
   */
  async sendProduct(ctx: BotContext, product: Product): Promise<void> {
    // Get the product template
    const template = await this.getTemplate(TemplateType.PRODUCT);

    // Build buttons from template layout if available
    const buttons = template ? this.buildTemplateButtons(template) : [];

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
    buttons: any[][],
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
  getIdFromMatch(ctx: BotContext): number {
    const match = (ctx as any).match;
    return parseInt(match[1], 10);
  }
}
