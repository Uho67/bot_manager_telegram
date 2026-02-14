/**
 * API endpoint paths
 */
export const API_ENDPOINTS = {
  CATEGORIES: '/categories',
  CATEGORY_BY_ID: (id: number) => `/categories/${id}`,
  CATEGORY_IMAGE_FILE_ID: (id: number) => `/categories/${id}/image-file-id`,
  PRODUCTS: '/products',
  PRODUCT_BY_ID: (id: number) => `/products/${id}`,
  PRODUCT_IMAGE_FILE_ID: (id: number) => `/products/${id}/image-file-id`,
  TEMPLATE_BY_TYPE: (type: string) => `../../telegram/template/by-type/${type}`,
} as const;

/**
 * HTTP configuration constants
 */
export const HTTP_CONFIG = {
  DEFAULT_TIMEOUT: 15000,
  XDEBUG_SESSION: 'PHPSTORM',
} as const;
