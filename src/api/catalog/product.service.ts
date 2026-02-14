import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { CacheService } from '@/cache/cache.service';
import { Product } from '@/types';
import { CACHE_PREFIXES, API_ENDPOINTS } from '@/common/constants';

/**
 * Service for managing product data
 * Handles fetching, caching, and retrieving product information from external API
 */
@Injectable()
export class ProductService {
  private readonly logger = new Logger(ProductService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Get a single product by ID
   * @param id - The ID of the product to retrieve
   * @returns Product object or null if not found or on error
   */
  async getProductById(id: number): Promise<Product | null> {
    try {
      return await this.fetchProductData(id);
    } catch (error) {
      this.logger.error(`Failed to fetch product ${id}`, error);
      return null;
    }
  }

  /**
   * Fetch product data from API with caching
   * Only caches products that have an image_file_id
   * @param id - The ID of the product to fetch
   * @returns Product object or null if not found
   * @private
   */
  private async fetchProductData(id: number): Promise<Product | null> {
    const cacheKey = `${CACHE_PREFIXES.PRODUCT}${id}`;

    const cached = this.cacheService.get<Product>(cacheKey);
    if (cached) {
      return cached;
    }

    const { data } = await firstValueFrom(
      this.httpService.get<Product>(API_ENDPOINTS.PRODUCT_BY_ID(id)),
    );
    if (data && data.image_file_id) {
      this.cacheService.set(cacheKey, data);
    }

    return data;
  }
}
