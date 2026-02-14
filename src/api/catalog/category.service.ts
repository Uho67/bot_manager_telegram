import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { CacheService } from '@/cache/cache.service';
import { Category, CategoryListItem } from '@/types';
import { CACHE_PREFIXES, API_ENDPOINTS } from '@/common/constants';

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
		const cached = this.cacheService.get<CategoryListItem[]>(
			CACHE_PREFIXES.CATEGORY_LIST,
		);
		if (cached) {
			return cached;
		}
		try {
			const { data } = await firstValueFrom(
				this.httpService.get<CategoryListItem[]>(API_ENDPOINTS.CATEGORIES),
			);

			if (data) {
				this.cacheService.set(CACHE_PREFIXES.CATEGORY_LIST, data);
			}

			return data || [];
		} catch (error) {
			this.logger.error('Failed to fetch category list', error);
			return [];
		}
	}

	/**
	 * Get category by ID with products and child categories
	 * @param categoryId - The ID of the category to retrieve
	 * @returns Category object or null if not found or on error
	 */
	async getCategoryById(categoryId: number): Promise<Category | null> {
		try {
			return await this.fetchCategoryData(categoryId);
		} catch (error) {
			this.logger.error(`Failed to fetch category ${categoryId}`, error);
			return null;
		}
	}

	/**
	 * Fetch category data from API with caching
	 * @param categoryId - The ID of the category to fetch
	 * @returns Category object or null if not found
	 * @private
	 */
	private async fetchCategoryData(categoryId: number): Promise<Category | null> {
		const cacheKey = `${CACHE_PREFIXES.CATEGORY}${categoryId}`;

		const cached = this.cacheService.get<Category>(cacheKey);
		if (cached) {
			this.logger.log(`Category ${categoryId} found in cache`);
			return cached;
		}
		const { data } = await firstValueFrom(
			this.httpService.get<Category>(API_ENDPOINTS.CATEGORY_BY_ID(categoryId)),
		);

		if (data) {
			this.cacheService.set(cacheKey, data);
		}

		return data;
	}
}
