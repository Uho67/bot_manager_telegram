/**
 * API endpoint paths
 */
export const API_ENDPOINTS = {
  CATEGORIES: '/telegram/catalog/categories',
  CATEGORY_BY_ID: (id: number) => `/telegram/catalog/categories/${id}`,
  CATEGORY_IMAGE_FILE_ID: (id: number) =>
    `/telegram/catalog/categories/${id}/image-file-id`,
  PRODUCTS: '/telegram/catalog/products',
  PRODUCT_BY_ID: (id: number) => `/telegram/catalog/products/${id}`,
  PRODUCT_IMAGE_FILE_ID: (id: number) =>
    `/telegram/catalog/products/${id}/image-file-id`,
  POST_BY_TYPE: (type: string) => `/telegram/post/${type}`,
  POST_BY_PRODUCT: (productId: number) => `/telegram/post/product/${productId}`,
  POST_IMAGE_FILE_ID: (id: number) => `/telegram/post/${id}/image-file-id`,
  USERS_MASS_UPDATE: '/telegram/users/mass-update',
  MAILOUT_PRODUCTS: '/telegram/mailout/products',
  MAILOUT_BY_PRODUCTS: '/telegram/mailout/by-products',
  MAILOUT_DELETE: '/telegram/mailout/delete',
} as const;

/**
 * HTTP configuration constants
 */
export const HTTP_CONFIG = {
  DEFAULT_TIMEOUT: 15000,
  XDEBUG_SESSION: 'PHPSTORM',
} as const;
