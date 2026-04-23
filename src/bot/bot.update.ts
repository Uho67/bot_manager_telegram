import { Logger } from '@nestjs/common';
import { Update, Ctx, Start, Help, On, Action, Hears } from 'nestjs-telegraf';
import { Markup } from 'telegraf';
import { BotService, BotContext } from './bot.service';
import { BOT_MESSAGES } from '@/common/constants';
import { UsersService } from '@/api/users/users.service';
import { UserStatus } from '@/database/entities/user.entity';

/**
 * Telegram bot update handler
 * Handles all incoming updates from Telegram (commands, callbacks, messages)
 */
@Update()
export class BotUpdate {
  private readonly logger = new Logger(BotUpdate.name);

  constructor(
    private readonly botService: BotService,
    private readonly usersService: UsersService,
  ) { }

  /**
   * Handle /start command
   * Displays welcome post with catalog navigation buttons
   */
  @Start()
  async onStart(@Ctx() ctx: BotContext): Promise<void> {
    // Get the start post
    const post = await this.botService.getPostByType('start');

    if (!post) {
      const name = this.botService.getUserName(ctx);
      await ctx.reply(
        `${BOT_MESSAGES.WELCOME(name)}\n\n${BOT_MESSAGES.TEMPLATE_UNAVAILABLE}`,
        Markup.inlineKeyboard([
          [Markup.button.callback('🔄 Переглянути каталог', 'start')],
        ]),
      );
      return;
    }

    // Send post with image and buttons
    await this.botService.sendPost(ctx, post);
  }

  /**
   * Handle category button clicks
   * Displays category content with subcategories and products
   */
  @Action(/^category\/(\d+)(?:\?from=(\d+))?$/)
  async onCategoryClick(@Ctx() ctx: BotContext): Promise<void> {
    const match = (ctx as any).match;
    const categoryId = parseInt(match[1], 10);
    const parentCategoryId = match[2] ? parseInt(match[2], 10) : undefined;
    this.logger.log(`Category ${categoryId} clicked${parentCategoryId ? ` from category ${parentCategoryId}` : ''}`);

    // Answer callback query immediately to prevent timeout
    await ctx.answerCbQuery().catch((err) => {
      // Ignore errors if query already expired
      this.logger.warn('Failed to answer callback query:', err.message);
    });

    const category = await this.botService.getCategoryById(categoryId);

    if (!category) {
      await ctx.reply(
        BOT_MESSAGES.CATEGORY_NOT_FOUND,
        Markup.inlineKeyboard([
          [Markup.button.callback('🔄 Переглянути каталог', 'start')],
        ]),
      );
      return;
    }

    // Check for content using layout (new format) or legacy fields
    const hasContent =
      (category.layout && category.layout.length > 0) ||
      (category.child_categories && category.child_categories.length > 0) ||
      (category.products && category.products.length > 0);

    if (!hasContent) {
      await ctx.reply(
        BOT_MESSAGES.CATEGORY_EMPTY,
        Markup.inlineKeyboard([
          [Markup.button.callback('🔄 Переглянути каталог', 'start')],
        ]),
      );
      return;
    }

    await this.botService.sendCategory(ctx, category, parentCategoryId);
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
      await ctx.reply(
        BOT_MESSAGES.PRODUCT_NOT_FOUND,
        Markup.inlineKeyboard([
          [Markup.button.callback('🔄 Переглянути каталог', 'start')],
        ]),
      );
      return;
    }

    await this.botService.sendProduct(ctx, product, categoryId);
  }

  /**
   * Handle "Більше фото" button clicks
   * Sends all product images (main + additional) as a media group
   */
  @Action(/^product_photos\/(\d+)(?:\?from=(\d+))?$/)
  async onProductPhotos(@Ctx() ctx: BotContext): Promise<void> {
    const match = (ctx as any).match;
    const productId = parseInt(match[1], 10);
    const categoryId = match[2] ? parseInt(match[2], 10) : undefined;
    this.logger.log(`Product photos ${productId} requested${categoryId ? ` from category ${categoryId}` : ''}`);

    await ctx.answerCbQuery().catch((err) => {
      this.logger.warn('Failed to answer callback query:', err.message);
    });

    const product = await this.botService.getProductById(productId);

    if (!product) {
      await ctx.reply(
        BOT_MESSAGES.PRODUCT_NOT_FOUND,
        Markup.inlineKeyboard([
          [Markup.button.callback('🔄 Переглянути каталог', 'start')],
        ]),
      );
      return;
    }

    await this.botService.sendProductPhotos(ctx, product, categoryId);
  }

  /**
   * Handle "start" callback button clicks
   * Returns user to main menu
   * Handles both 'start' and '/start' button values
   */
  @Action(/^(start|\/start)$/)
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
        await ctx.reply(
          BOT_MESSAGES.CATEGORY_NOT_FOUND,
          Markup.inlineKeyboard([
            [Markup.button.callback('🔄 Переглянути каталог', 'start')],
          ]),
        );
        return;
      }

      // Check for content
      const hasContent =
        (category.layout && category.layout.length > 0) ||
        (category.child_categories && category.child_categories.length > 0) ||
        (category.products && category.products.length > 0);

      if (!hasContent) {
        await ctx.reply(
          BOT_MESSAGES.CATEGORY_EMPTY,
          Markup.inlineKeyboard([
            [Markup.button.callback('🔄 Переглянути каталог', 'start')],
          ]),
        );
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
   * Handle /stop command
   * Sets user status to inactive
   */
  @Hears(/^\/stop$/)
  async onStop(@Ctx() ctx: BotContext): Promise<void> {
    const chatId = ctx.chat?.id;

    if (!chatId) {
      this.logger.warn('Stop command received but chat ID is missing');
      return;
    }

    try {
      await this.usersService.updateStatus(chatId, UserStatus.INACTIVE);
      this.logger.log(`User ${chatId} set to inactive status`);
      await ctx.reply(BOT_MESSAGES.STOP);
    } catch (error) {
      this.logger.error(`Failed to update user status for ${chatId}:`, error);
      await ctx.reply('❌ Failed to stop the bot. Please try again.');
    }
  }

  /**
   * Handle my_chat_member update
   * Detects when user blocks, removes, or reactivates the bot
   * Sets user status to INACTIVE when bot is blocked/removed
   */
  @On('my_chat_member')
  async onMyChatMember(@Ctx() ctx: BotContext): Promise<void> {
    const update = ctx.update as any;
    const myChatMember = update.my_chat_member;

    if (!myChatMember) {
      return;
    }

    const chatId = myChatMember.chat?.id;
    const newStatus = myChatMember.new_chat_member?.status;
    const oldStatus = myChatMember.old_chat_member?.status;
    const from = myChatMember.from;

    if (!chatId) {
      this.logger.warn('my_chat_member update received but chat ID is missing');
      return;
    }

    const inactiveStatuses = ['kicked', 'left', 'restricted'];

    try {
      if (!from) {
        this.logger.warn('my_chat_member update received but user info is missing');
        return;
      }

      if (inactiveStatuses.includes(newStatus)) {
        await this.usersService.upsertByChatId({
          chat_id: chatId,
          name:
            [from.first_name, from.last_name].filter(Boolean).join(' ') || '',
          username: from.username || '',
          status: UserStatus.INACTIVE,
        });
        this.logger.log(
          `User ${chatId} blocked/removed bot (status: ${oldStatus} -> ${newStatus}), saved with INACTIVE status`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to update user status for ${chatId} on my_chat_member update:`,
        error,
      );
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
   * Provides guidance to user with a button to go to start
   */
  @On('text')
  async onText(@Ctx() ctx: BotContext): Promise<void> {
    await ctx.reply(
      BOT_MESSAGES.UNKNOWN_COMMAND,
      Markup.inlineKeyboard([
        [Markup.button.callback('🔄 Переглянути каталог', 'start')],
      ]),
    );
  }
}
