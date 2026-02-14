/**
 * Bot message templates
 */
export const BOT_MESSAGES = {
  WELCOME: (name: string) => `👋 Welcome, ${name}!\n\nBrowse our catalog:`,
  HELP: `🤖 *Bot Commands*\n\n🔄 /start \\- Browse catalog\n❓ /help \\- Show this message`,
  CATEGORY_NOT_FOUND: '❌ Category not found',
  PRODUCT_NOT_FOUND: '❌ Product not found',
  CATEGORY_EMPTY: '📭 This category is empty.',
  TEMPLATE_UNAVAILABLE: '📭 No template available at the moment.',
  UNKNOWN_COMMAND: `🤔 I didn't understand that.\n\nUse /start to browse products`,
  CATEGORY_LABEL: (name: string) => `📂 *${name}*\n\nSelect an item:`,
} as const;

/**
 * Button emojis
 */
export const BUTTON_EMOJIS = {
  CATEGORY: '📂',
  PRODUCT: '📦',
  BACK: '⬅️',
} as const;

/**
 * Back button text
 */
export const BACK_BUTTON_TEXT = 'назад';
