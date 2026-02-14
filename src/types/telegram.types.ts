import { Context } from 'telegraf';
import { InlineKeyboardButton } from 'telegraf/typings/core/types/typegram';

/**
 * Telegram photo size
 */
export interface TelegramPhotoSize {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  file_size?: number;
}

/**
 * Telegram message with photo
 */
export interface PhotoMessage {
  photo: TelegramPhotoSize[];
  [key: string]: unknown;
}

/**
 * Context with regex match for callback queries
 */
export interface MatchContext extends Context {
  match: RegExpMatchArray;
}

/**
 * Button row type for inline keyboards
 */
export type ButtonRow = InlineKeyboardButton[][];
