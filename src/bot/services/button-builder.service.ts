import { Injectable, Logger } from '@nestjs/common';
import { Markup } from 'telegraf';
import {
  Category,
  CategoryListItem,
  Template,
  TemplateButton,
  CategoryButton,
  ButtonRow,
} from '@/types';
import { BUTTON_EMOJIS, BACK_BUTTON_TEXT } from '@/common/constants';

/**
 * Service responsible for building Telegram inline keyboard buttons
 */
@Injectable()
export class ButtonBuilderService {
  private readonly logger = new Logger(ButtonBuilderService.name);

  /**
   * Build buttons from category list (sorted by sort_order)
   * @param categories - List of categories
   * @returns Array of button rows
   */
  buildCategoryListButtons(categories: CategoryListItem[]): ButtonRow {
    const sorted = [...categories].sort((a, b) => a.sort_order - b.sort_order);
    return sorted.map((category) => [
      Markup.button.callback(
        `${BUTTON_EMOJIS.CATEGORY} ${category.name}`,
        `category/${category.id}`,
      ),
    ]);
  }

  /**
   * Build inline keyboard buttons from category layout
   * Returns buttons in the exact order as defined in the category layout from API
   * No sorting is applied - preserves API order
   * @param category - Category with layout or legacy fields
   * @returns Array of button rows
   */
  buildCategoryContentButtons(category: Category): ButtonRow {
    // Use layout if available (new API format)
    if (category.layout && category.layout.length > 0) {
      const buttons = category.layout.map((line, lineIndex) => {
        const lineButtons = line.map((button) => {
          // If button is a product callback, add category ID for back navigation
          if (
            button.button_type === 'callback' &&
            button.value.startsWith('product/')
          ) {
            const productId = button.value.replace('product/', '');
            return Markup.button.callback(
              button.label,
              `product/${productId}?from=${category.id}`,
            );
          }
          return this.createButton(button);
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
        Markup.button.callback(
          `${BUTTON_EMOJIS.CATEGORY} ${child.name}`,
          `category/${child.id}`,
        ),
      ]),
      ...sortedProducts.map((product) => [
        Markup.button.callback(
          `${BUTTON_EMOJIS.PRODUCT} ${product.name}`,
          `product/${product.id}?from=${category.id}`,
        ),
      ]),
    ];
  }

  /**
   * Build inline keyboard buttons from template layout
   * Returns buttons in the exact order as defined in the template layout
   * No sorting is applied
   * @param template - Template with layout
   * @returns Array of button rows
   */
  buildTemplateButtons(template: Template): ButtonRow {
    return template.layout.map((line) =>
      line.map((button) => this.createButton(button)),
    );
  }

  /**
   * Create back button that navigates to start
   * @returns Back button row
   */
  buildBackButton(): ButtonRow {
    return [
      [
        Markup.button.callback(
          `${BUTTON_EMOJIS.BACK} ${BACK_BUTTON_TEXT}`,
          'back',
        ),
      ],
    ];
  }

  /**
   * Create back button that navigates to a specific category
   * @param categoryId - Category ID to navigate back to
   * @returns Back button row
   */
  buildBackToCategoryButton(categoryId: number): ButtonRow {
    return [
      [
        Markup.button.callback(
          `${BUTTON_EMOJIS.BACK} ${BACK_BUTTON_TEXT}`,
          `back/category/${categoryId}`,
        ),
      ],
    ];
  }

  /**
   * Add back button to existing button rows
   * @param buttons - Existing button rows
   * @param categoryId - Optional category ID for back navigation (if not provided, goes to start)
   * @returns Button rows with back button appended
   */
  addBackButton(buttons: ButtonRow, categoryId?: number): ButtonRow {
    const backButton = categoryId
      ? this.buildBackToCategoryButton(categoryId)
      : this.buildBackButton();
    return [...buttons, ...backButton];
  }

  /**
   * Create button based on button_type
   * @param button - Button configuration
   * @returns Telegram button
   */
  private createButton(
    button: TemplateButton | CategoryButton,
  ):
    | ReturnType<typeof Markup.button.callback>
    | ReturnType<typeof Markup.button.url>
    | ReturnType<typeof Markup.button.webApp> {
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
  }
}
