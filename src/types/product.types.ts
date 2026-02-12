/**
 * Button in a category layout
 */
export interface CategoryButton {
  label: string;
  button_type: 'callback' | 'url' | 'web_app';
  value: string;
}

/**
 * Product data structure from external API
 */
export interface Product {
    id: number;
    name: string;
    description: string;
    image: string | null;
    image_file_id: string | null;
    sort_order: number;
}

/**
 * Category list item (from /categories endpoint)
 */
export interface CategoryListItem {
    id: number;
    name: string;
    sort_order: number;
}

/**
 * Full category with products and child categories (from /categories/:id endpoint)
 */
export interface Category {
    id: number;
    name: string;
    is_root: boolean;
    image: string | null;
    image_file_id: string | null;
    layout: CategoryButton[][];
    // Legacy fields (kept for backward compatibility, but layout takes precedence)
    child_categories?: CategoryListItem[];
    products?: CategoryProductItem[];
}

/**
 * Product item in category listing (minimal data)
 */
export interface CategoryProductItem {
    id: number;
    name: string;
    sort_order: number;
}
