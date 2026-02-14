/**
 * Cache key prefixes and constants
 */
export const CACHE_PREFIXES = {
  TEMPLATE: 'template:',
  PRODUCT: 'product:',
  CATEGORY: 'category:',
  CATEGORY_LIST: 'category:list',
} as const;

/**
 * Default cache TTL values in milliseconds
 */
export const CACHE_TTL = {
  DEFAULT: 5 * 60 * 1000, // 5 minutes
  LONG: 30 * 60 * 1000, // 30 minutes
  SHORT: 60 * 1000, // 1 minute
} as const;
