/**
 * Button in a template layout
 */
export interface TemplateButton {
  label: string;
  button_type: 'callback' | 'url' | 'web_app';
  value: string;
}

/**
 * Template type enum
 */
export enum TemplateType {
  START = 'start',
  POST = 'post',
  PRODUCT = 'product',
  CATEGORY = 'category',
}

/**
 * Template data structure from external API
 */
export interface Template {
  id: number;
  name: string;
  type: TemplateType | string;
  layout: TemplateButton[][];
}
