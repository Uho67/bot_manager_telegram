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
    bot_identifier: string;
    child_categories: CategoryListItem[];
    products: Product[];
}
