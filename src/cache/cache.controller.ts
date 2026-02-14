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
