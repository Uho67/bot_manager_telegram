import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { CacheService } from '@/cache/cache.service';
import { Category, CategoryListItem } from '@/types';

const CATEGORY_CACHE_PREFIX = 'category:';
const CATEGORY_LIST_CACHE_KEY = 'category:list';

@Injectable()
export class CategoryService {
	private readonly logger = new Logger(CategoryService.name);

	constructor(
		private readonly httpService: HttpService,
		private readonly cacheService: CacheService,
	) { }

	/**
	 * Get list of all categories (for development)
	 */
	async getCategoryList(): Promise<CategoryListItem[]> {
		const cached = this.cacheService.get<CategoryListItem[]>(CATEGORY_LIST_CACHE_KEY);
		if (cached) {
			return cached;
		}
		try {
			const { data } = await firstValueFrom(
				this.httpService.get<CategoryListItem[]>('/categories')
			);

			if (data) {
				this.cacheService.set(CATEGORY_LIST_CACHE_KEY, data);
			}

			return data || [];
		} catch (error) {
			this.logger.error('Failed to fetch category list', error);
			return [];
		}
	}

	/**
	 * Get category by ID with products and child categories
	 */
	async getCategoryById(categoryId: number): Promise<Category | null> {
		try {
			return await this.fetchCategoryData(categoryId);
		} catch (error) {
			this.logger.error(`Failed to fetch category ${categoryId}`, error);
			return null;
		}
	}

	async fetchCategoryData(categoryId: number): Promise<Category | null> {
		const cacheKey = `${CATEGORY_CACHE_PREFIX}${categoryId}`;

		const cached = this.cacheService.get<Category>(cacheKey);
		if (cached) {
			return cached;
		}
		const { data } = await firstValueFrom(
			this.httpService.get<Category>(`/categories/${categoryId}`)
		);

		if (data) {
			this.cacheService.set(cacheKey, data);
		}

		return data;
	}
}
