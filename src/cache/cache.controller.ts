import {
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	UseGuards,
	Logger,
} from '@nestjs/common';
import { CacheService } from './cache.service';
import { BearerAuthGuard } from '@/common/guards';
import { CACHE_PREFIXES } from '@/common/constants/cache.constants';

/**
 * Controller for cache management endpoints
 * Protected by Bearer token authentication
 */
@Controller('cache')
@UseGuards(BearerAuthGuard)
export class CacheController {
	private readonly logger = new Logger(CacheController.name);

	constructor(private readonly cacheService: CacheService) { }

	/**
	 * Clear all cache entries
	 * DELETE /cache
	 * Requires Bearer token authentication
	 * @returns Object with success message and number of cleared entries
	 */
	@Delete()
	@HttpCode(HttpStatus.OK)
	clearCache(): { message: string; cleared: number } {
		const keysBefore = this.cacheService.keys().length;
		this.cacheService.clear();
		const cleared = keysBefore;

		this.logger.log(`Cache cleared: ${cleared} entries removed`);

		return {
			message: 'Cache cleared successfully',
			cleared,
		};
	}

	/**
	 * Clear only product cache entries (product:*)
	 * DELETE /cache/products
	 */
	@Delete('products')
	@HttpCode(HttpStatus.OK)
	clearProductsCache(): { message: string; cleared: number } {
		const cleared = this.cacheService.clearByPrefix(CACHE_PREFIXES.PRODUCT);
		this.logger.log(`Products cache cleared: ${cleared} entries removed`);
		return { message: 'Products cache cleared successfully', cleared };
	}

	/**
	 * Clear only category cache entries (category:*)
	 * DELETE /cache/categories
	 */
	@Delete('categories')
	@HttpCode(HttpStatus.OK)
	clearCategoriesCache(): { message: string; cleared: number } {
		const cleared = this.cacheService.clearByPrefix(CACHE_PREFIXES.CATEGORY);
		this.logger.log(`Categories cache cleared: ${cleared} entries removed`);
		return { message: 'Categories cache cleared successfully', cleared };
	}

	/**
	 * Clear only post cache entries (post:*)
	 * DELETE /cache/posts
	 */
	@Delete('posts')
	@HttpCode(HttpStatus.OK)
	clearPostsCache(): { message: string; cleared: number } {
		const cleared = this.cacheService.clearByPrefix(CACHE_PREFIXES.POST);
		this.logger.log(`Posts cache cleared: ${cleared} entries removed`);
		return { message: 'Posts cache cleared successfully', cleared };
	}

	/**
	 * Get cache statistics
	 * GET /cache/stats
	 * Requires Bearer token authentication
	 * @returns Object with cache statistics
	 */
	@Get('stats')
	@HttpCode(HttpStatus.OK)
	getCacheStats(): {
		totalEntries: number;
		keys: string[];
	} {
		const keys = this.cacheService.keys();
		return {
			totalEntries: keys.length,
			keys,
		};
	}
}
