/**
 * Bot message templates
 */
export const BOT_MESSAGES = {
  WELCOME: (name: string) => `👋 Вітаємо, ${name}!\n\nПерегляньте наш каталог:`,
  HELP: `🤖 *Команди бота*\n\n🔄 /start \\- Переглянути каталог\n❓ /help \\- Показати це повідомлення\n🛑 /stop \\- Зупинити бота`,
  CATEGORY_NOT_FOUND: '❌ Категорію не знайдено',
  PRODUCT_NOT_FOUND: '❌ Товар не знайдено',
  CATEGORY_EMPTY: '📭 Ця категорія порожня.',
  TEMPLATE_UNAVAILABLE: '📭 Шаблон недоступний на даний момент.',
  UNKNOWN_COMMAND: `🤔 Я не зрозумів.\n\nВикористайте /start для перегляду товарів`,
  CATEGORY_LABEL: (name: string) => `📂 *${name}*\n\nВиберіть елемент:`,
  STOP: '🛑 Бот зупинено. Вам встановлено неактивний статус.\n\nВикористайте /start для повторної активації.',
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
