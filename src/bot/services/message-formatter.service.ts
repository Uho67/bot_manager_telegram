import { Injectable } from '@nestjs/common';

/**
 * Service responsible for formatting messages for Telegram
 */
@Injectable()
export class MessageFormatterService {
  /**
   * Format product message with name and description
   * @param product - Product with name and description
   * @returns Formatted HTML message
   */
  formatProductMessage(product: {
    name: string;
    description: string;
  }): string {
    const escapedName = this.escapeHtml(product.name);
    return `<b>${escapedName}</b>\n\n${product.description}`;
  }

  /**
   * Escape HTML special characters
   * @param text - Text to escape
   * @returns Escaped text
   */
  escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}
