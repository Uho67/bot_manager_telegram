import { Logger } from '@nestjs/common';
import { Update, Ctx, Start, Help, On, Action } from 'nestjs-telegraf';
import { Markup } from 'telegraf';
import { BotService, BotContext } from './bot.service';
import { TemplateType } from '@/types';

@Update()
export class BotUpdate {
  private readonly logger = new Logger(BotUpdate.name);

  constructor(private readonly botService: BotService) { }

  @Start()
  async onStart(@Ctx() ctx: BotContext): Promise<void> {
    const name = this.botService.getUserName(ctx);

    // Get the start template
    const template = await this.botService.getTemplate(TemplateType.START);

    if (!template) {
      await ctx.reply(
        `👋 Welcome, ${name}!\n\n` + `📭 No template available at the moment.`,
      );
      return;
    }

    // Build buttons from template layout (without sorting - exact order preserved)
    const buttons = this.botService.buildTemplateButtons(template);

    await ctx.reply(`👋 Welcome, ${name}!\n\n` + `Browse our catalog:`, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard(buttons),
    });
  }

  @Action(/^category\/(\d+)$/)
  async onCategoryClick(@Ctx() ctx: BotContext): Promise<void> {
    const categoryId = this.botService.getIdFromMatch(ctx);
    this.logger.log(`Category ${categoryId} clicked`);

    // Answer callback query immediately to prevent timeout
    await ctx.answerCbQuery().catch((err) => {
      // Ignore errors if query already expired
      this.logger.warn('Failed to answer callback query:', err.message);
    });

    const category = await this.botService.getCategoryById(categoryId);

    if (!category) {
      await ctx.reply('❌ Category not found');
      return;
    }

    // Check for content using layout (new format) or legacy fields
    const hasContent =
      (category.layout && category.layout.length > 0) ||
      (category.child_categories &&
        category.child_categories.length > 0) ||
      (category.products && category.products.length > 0);

    if (!hasContent) {
      await ctx.reply('📭 This category is empty.');
      return;
    }

    await this.botService.sendCategory(ctx, category);
  }

  @Action(/^product\/(\d+)$/)
  async onProductClick(@Ctx() ctx: BotContext): Promise<void> {
    const productId = this.botService.getIdFromMatch(ctx);
    this.logger.log(`Product ${productId} clicked`);

    // Answer callback query immediately to prevent timeout
    await ctx.answerCbQuery().catch((err) => {
      // Ignore errors if query already expired
      this.logger.warn('Failed to answer callback query:', err.message);
    });

    const product = await this.botService.getProductById(productId);

    if (!product) {
      await ctx.reply('❌ Product not found');
      return;
    }

    await this.botService.sendProduct(ctx, product);
  }

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

  @Help()
  async onHelp(@Ctx() ctx: BotContext): Promise<void> {
    await ctx.reply(
      `🤖 *Bot Commands*\n\n` +
      `🔄 /start \\- Browse catalog\n` +
      `❓ /help \\- Show this message`,
      { parse_mode: 'MarkdownV2' },
    );
  }

  @On('text')
  async onText(@Ctx() ctx: BotContext): Promise<void> {
    await ctx.reply(
      `🤔 I didn't understand that.\n\n` + `Use /start to browse products`,
    );
  }
}
