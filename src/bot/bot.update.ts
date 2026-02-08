import { Logger } from '@nestjs/common';
import { Update, Ctx, Start, Help, On, Action } from 'nestjs-telegraf';
import { Markup } from 'telegraf';
import { BotService, BotContext } from './bot.service';
import { TemplateType } from '@/types';

@Update()
export class BotUpdate {
  private readonly logger = new Logger(BotUpdate.name);

  constructor(private readonly botService: BotService) {}

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

    const category = await this.botService.getCategoryById(categoryId);

    if (!category) {
      await ctx.answerCbQuery('Category not found');
      return;
    }

    const hasContent =
      category.child_categories.length > 0 || category.products.length > 0;

    if (!hasContent) {
      await ctx.answerCbQuery('Empty category');
      await ctx.reply('📭 This category is empty.');
      return;
    }

    await ctx.answerCbQuery();
    await this.botService.sendCategory(ctx, category);
  }

  @Action(/^product\/(\d+)$/)
  async onProductClick(@Ctx() ctx: BotContext): Promise<void> {
    const productId = this.botService.getIdFromMatch(ctx);
    this.logger.log(`Product ${productId} clicked`);

    const product = await this.botService.getProductById(productId);

    if (!product) {
      await ctx.answerCbQuery('Product not found');
      return;
    }

    await ctx.answerCbQuery();
    await this.botService.sendProduct(ctx, product);
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
