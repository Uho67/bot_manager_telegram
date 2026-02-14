import { Logger } from '@nestjs/common';
import { Update, Ctx, Start, Help, On, Action } from 'nestjs-telegraf';
import { Markup } from 'telegraf';
import { BotService, BotContext } from './bot.service';
import { TemplateType } from '@/types';
import { BOT_MESSAGES } from '@/common/constants';

/**
 * Telegram bot update handler
 * Handles all incoming updates from Telegram (commands, callbacks, messages)
 */
@Update()
export class BotUpdate {
  private readonly logger = new Logger(BotUpdate.name);

  constructor(private readonly botService: BotService) { }

  /**
   * Handle /start command
   * Displays welcome message with catalog navigation buttons
   */
  @Start()
  async onStart(@Ctx() ctx: BotContext): Promise<void> {
    const name = this.botService.getUserName(ctx);

    // Get the start template
    const template = await this.botService.getTemplate(TemplateType.START);

    if (!template) {
      await ctx.reply(
        `${BOT_MESSAGES.WELCOME(name)}\n\n${BOT_MESSAGES.TEMPLATE_UNAVAILABLE}`,
      );
      return;
    }

    // Build buttons from template layout (without sorting - exact order preserved)
    const buttons = this.botService.buildTemplateButtons(template);

    await ctx.reply(BOT_MESSAGES.WELCOME(name), {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard(buttons),
    });
  }

  /**
   * Handle category button clicks
   * Displays category content with subcategories and products
   */
  @Action(/^category\/(\d+)$/)
  async onCategoryClick(@Ctx() ctx: BotContext): Promise<void> {
    const categoryId = this.botService.getIdFromMatch(ctx as any);
    this.logger.log(`Category ${categoryId} clicked`);

    // Answer callback query immediately to prevent timeout
    await ctx.answerCbQuery().catch((err) => {
      // Ignore errors if query already expired
      this.logger.warn('Failed to answer callback query:', err.message);
    });

    const category = await this.botService.getCategoryById(categoryId);

    if (!category) {
      await ctx.reply(BOT_MESSAGES.CATEGORY_NOT_FOUND);
      return;
    }

    // Check for content using layout (new format) or legacy fields
    const hasContent =
      (category.layout && category.layout.length > 0) ||
      (category.child_categories && category.child_categories.length > 0) ||
      (category.products && category.products.length > 0);

    if (!hasContent) {
      await ctx.reply(BOT_MESSAGES.CATEGORY_EMPTY);
      return;
    }

    // For now, back button goes to start (can be enhanced to track parent category)
    await this.botService.sendCategory(ctx, category);
  }

  /**
   * Handle product button clicks
   * Displays product details with image and action buttons
   * Supports category ID in callback data: product/{id}?from={categoryId}
   */
  @Action(/^product\/(\d+)(?:\?from=(\d+))?$/)
  async onProductClick(@Ctx() ctx: BotContext): Promise<void> {
    const match = (ctx as any).match;
    const productId = parseInt(match[1], 10);
    const categoryId = match[2] ? parseInt(match[2], 10) : undefined;
    this.logger.log(`Product ${productId} clicked${categoryId ? ` from category ${categoryId}` : ''}`);

    // Answer callback query immediately to prevent timeout
    await ctx.answerCbQuery().catch((err) => {
      // Ignore errors if query already expired
      this.logger.warn('Failed to answer callback query:', err.message);
    });

    const product = await this.botService.getProductById(productId);

    if (!product) {
      await ctx.reply(BOT_MESSAGES.PRODUCT_NOT_FOUND);
      return;
    }

    await this.botService.sendProduct(ctx, product, categoryId);
  }

  /**
   * Handle "start" callback button clicks
   * Returns user to main menu
   */
  @Action('start')
  async onStartButtonClick(@Ctx() ctx: BotContext): Promise<void> {
    // Answer callback query immediately to prevent timeout
    await ctx.answerCbQuery().catch((err) => {
      // Ignore errors if query already expired
      this.logger.warn('Failed to answer callback query:', err.message);
    });

    // Reuse the same logic as the /start command
    await this.onStart(ctx);
  }

  /**
   * Handle "back" button clicks
   * Navigates back to start or to a specific category
   * If already on start, refreshes the start screen
   */
  @Action(/^back(?:\/category\/(\d+))?$/)
  async onBackClick(@Ctx() ctx: BotContext): Promise<void> {
    const match = (ctx as any).match;
    const categoryId = match[1] ? parseInt(match[1], 10) : undefined;

    // Answer callback query immediately to prevent timeout
    await ctx.answerCbQuery().catch((err) => {
      // Ignore errors if query already expired
      this.logger.warn('Failed to answer callback query:', err.message);
    });

    if (categoryId) {
      // Navigate back to specific category
      this.logger.log(`Back to category ${categoryId}`);
      const category = await this.botService.getCategoryById(categoryId);

      if (!category) {
        await ctx.reply(BOT_MESSAGES.CATEGORY_NOT_FOUND);
        return;
      }

      // Check for content
      const hasContent =
        (category.layout && category.layout.length > 0) ||
        (category.child_categories && category.child_categories.length > 0) ||
        (category.products && category.products.length > 0);

      if (!hasContent) {
        await ctx.reply(BOT_MESSAGES.CATEGORY_EMPTY);
        return;
      }

      await this.botService.sendCategory(ctx, category);
    } else {
      // Navigate back to start (or refresh if already on start)
      this.logger.log('Back to start');
      await this.onStart(ctx);
    }
  }

  /**
   * Handle /help command
   * Displays available bot commands
   */
  @Help()
  async onHelp(@Ctx() ctx: BotContext): Promise<void> {
    await ctx.reply(BOT_MESSAGES.HELP, { parse_mode: 'MarkdownV2' });
  }

  /**
   * Handle unknown text messages
   * Provides guidance to user
   */
  @On('text')
  async onText(@Ctx() ctx: BotContext): Promise<void> {
    await ctx.reply(BOT_MESSAGES.UNKNOWN_COMMAND);
  }
}
