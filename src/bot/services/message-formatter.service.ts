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
    enabled?: boolean;
  }): string {
    const escapedName = this.escapeHtml(product.name);
    const badge = product.enabled === false ? ' 🔴 немає в наявності' : '';
    return `<b>${escapedName}</b>${badge}\n\n${product.description}`;
  }

  /**
   * Format post message with description only (name excluded)
   * @param post - Post with name and description
   * @returns Formatted HTML message
   */
  formatPostMessage(post: {
    name: string;
    description: string;
  }): string {
    return post.description;
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
