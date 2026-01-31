import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { CacheService } from '@/cache/cache.service';
import { Product } from '@/types';

const PRODUCT_CACHE_PREFIX = 'product:';

@Injectable()
export class ProductService {
	private readonly logger = new Logger(ProductService.name);

	constructor(
		private readonly httpService: HttpService,
		private readonly cacheService: CacheService,
	) { }

	/**
	 * Get a single product by ID
	 */
	async getProductById(id: number): Promise<Product | null> {
		try {
			return await this.fetchProductData(id);
		} catch (error) {
			this.logger.error(`Failed to fetch product ${id}`, error);
			return null;
		}
	}

	async fetchProductData(id: number): Promise<Product | null> {
		const cacheKey = `${PRODUCT_CACHE_PREFIX}${id}`;

		const cached = this.cacheService.get<Product>(cacheKey);
		if (cached) {
			return cached;
		}

		const { data } = await firstValueFrom(
			this.httpService.get<Product>(`/products/${id}`)
		);
		if (data && data.image_file_id) {
			this.cacheService.set(cacheKey, data);
		}

		return data;
	}
}
