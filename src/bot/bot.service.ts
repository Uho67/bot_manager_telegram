import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
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

export type BotContext = Context;

@Injectable()
export class BotService {
  private readonly logger = new Logger(BotService.name);

  constructor(
    private readonly categoryService: CategoryService,
    private readonly productService: ProductService,
    private readonly templateService: TemplateService,
    private readonly httpService: HttpService,
  ) { }

  // ==================== Category Methods ====================

  async getCategoryList(): Promise<CategoryListItem[]> {
    return this.categoryService.getCategoryList();
  }

  async getCategoryById(categoryId: number): Promise<Category | null> {
    return this.categoryService.getCategoryById(categoryId);
  }

  buildCategoryListButtons(categories: CategoryListItem[]) {
    const sorted = [...categories].sort((a, b) => a.sort_order - b.sort_order);
    return sorted.map((category) => [
      Markup.button.callback(`📂 ${category.name}`, `category/${category.id}`),
    ]);
  }

  /**
   * Build inline keyboard buttons from category layout
   * Returns buttons in the exact order as defined in the category layout from API
   * No sorting is applied - preserves API order
   */
  buildCategoryContentButtons(category: Category) {
    // Use layout if available (new API format)
    if (category.layout && category.layout.length > 0) {
      const buttons = category.layout.map((line, lineIndex) => {
        const lineButtons = line.map((button) => {
          // Create button based on button_type
          switch (button.button_type) {
            case 'callback':
              return Markup.button.callback(button.label, button.value);
            case 'url':
              return Markup.button.url(button.label, button.value);
            case 'web_app':
              return Markup.button.webApp(button.label, button.value);
            default:
              // Default to callback if unknown type
              return Markup.button.callback(button.label, button.value);
          }
        });
        this.logger.debug(
          `Category ${category.id}, line ${lineIndex + 1}: ${lineButtons.length} button(s)`,
        );
        return lineButtons;
      });
      this.logger.debug(
        `Built ${buttons.length} lines with total buttons for category ${category.id}`,
      );
      return buttons;
    }

    // Fallback to legacy format (for backward compatibility)
    const sortedCategories = [...(category.child_categories || [])].sort(
      (a, b) => a.sort_order - b.sort_order,
    );
    const sortedProducts = [...(category.products || [])].sort(
      (a, b) => a.sort_order - b.sort_order,
    );

    return [
      ...sortedCategories.map((child) => [
        Markup.button.callback(`📂 ${child.name}`, `category/${child.id}`),
      ]),
      ...sortedProducts.map((product) => [
        Markup.button.callback(`📦 ${product.name}`, `product/${product.id}`),
      ]),
    ];
  }

  // ==================== Template Methods ====================

  /**
   * Get template by type
   */
  async getTemplate(type: TemplateType | string): Promise<Template | null> {
    return this.templateService.getTemplateByType(type);
  }

  /**
   * Build inline keyboard buttons from template layout
   * Returns buttons in the exact order as defined in the template layout
   * No sorting is applied
   */
  buildTemplateButtons(template: Template) {
    return template.layout.map((line) =>
      line.map((button) => {
        // Create button based on button_type
        switch (button.button_type) {
          case 'callback':
            return Markup.button.callback(button.label, button.value);
          case 'url':
            return Markup.button.url(button.label, button.value);
          case 'web_app':
            return Markup.button.webApp(button.label, button.value);
          default:
            // Default to callback if unknown type
            return Markup.button.callback(button.label, button.value);
        }
      }),
    );
  }

  /**
   * Send category with optional image
   * - If image_file_id exists, use it directly (instant)
   * - If not but image URL exists, download, upload to Telegram, save file_id to API
   * - If no image at all, send text only with buttons
   */
  async sendCategory(ctx: BotContext, category: Category): Promise<void> {
    const buttons = this.buildCategoryContentButtons(category);
    const caption = `📂 *${category.name}*\n\nSelect an item:`;

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
      try {
        const imageBuffer = await this.downloadImage(category.image);
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
        const photo = sentMessage.photo;
        if (photo && photo.length > 0) {
          const fileId = photo[photo.length - 1].file_id; // Largest size
          this.saveCategoryImageFileId(category.id, fileId); // Fire and forget
        }
      } catch (error) {
        this.logger.error('Failed to send category image', error);
        await ctx.reply(caption, {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard(buttons),
        });
      }
    }
  }

  // ==================== Product Methods ====================

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

    const caption = this.formatProductMessage(product);

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
      try {
        const imageBuffer = await this.downloadImage(product.image);
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
        const photo = sentMessage.photo;
        if (photo && photo.length > 0) {
          const fileId = photo[photo.length - 1].file_id; // Largest size
          this.saveImageFileId(product.id, fileId); // Fire and forget
        }
      } catch (error) {
        this.logger.error('Failed to send product image', error);
        await ctx.reply(caption, {
          parse_mode: 'HTML',
          ...(buttons.length > 0 ? Markup.inlineKeyboard(buttons) : {}),
        });
      }
    }
  }

  // ==================== Image Methods ====================

  async downloadImage(url: string): Promise<Buffer | null> {
    try {
      const { data } = await firstValueFrom(
        this.httpService.get(url, { responseType: 'arraybuffer' }),
      );
      return Buffer.from(data);
    } catch (error) {
      this.logger.error(`Failed to download image: ${url}`, error);
      return null;
    }
  }

  saveImageFileId(productId: number, fileId: string): void {
    firstValueFrom(
      this.httpService.patch(`/products/${productId}/image-file-id`, {
        image_file_id: fileId,
      }),
    )
      .then(() => {
        this.logger.debug(`Saved file_id for product ${productId}`);
      })
      .catch((error) => {
        this.logger.error(
          `Failed to save file_id for product ${productId}`,
          error,
        );
      });
  }

  saveCategoryImageFileId(categoryId: number, fileId: string): void {
    firstValueFrom(
      this.httpService.patch(`/categories/${categoryId}/image-file-id`, {
        image_file_id: fileId,
      }),
    )
      .then(() => {
        this.logger.debug(`Saved file_id for category ${categoryId}`);
      })
      .catch((error) => {
        this.logger.error(
          `Failed to save file_id for category ${categoryId}`,
          error,
        );
      });
  }

  // ==================== Message Formatting ====================

  formatProductMessage(product: { name: string; description: string }): string {
    const escapedName = this.escapeHtml(product.name);
    return `<b>${escapedName}</b>\n\n${product.description}`;
  }

  escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // ==================== Utility Methods ====================

  getUserName(ctx: BotContext): string {
    return ctx.from?.first_name || 'there';
  }

  getIdFromMatch(ctx: BotContext): number {
    const match = (ctx as any).match;
    return parseInt(match[1], 10);
  }
}
