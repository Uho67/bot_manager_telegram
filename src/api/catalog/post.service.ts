import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { CacheService } from '@/cache/cache.service';
import { Post } from '@/types';
import { CACHE_PREFIXES, API_ENDPOINTS } from '@/common/constants';

/**
 * Service for managing post data
 * Handles fetching, caching, and retrieving posts from external API
 */
@Injectable()
export class PostService {
  private readonly logger = new Logger(PostService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Get post by type (e.g., 'start')
   * @param type Post type
   * @returns Post or null if not found
   */
  async getPostByType(type: string): Promise<Post | null> {
    const cacheKey = `${CACHE_PREFIXES.POST}${type}`;

    // Check cache first
    const cached = this.cacheService.get<Post>(cacheKey);
    if (cached) {
      this.logger.log(`Post '${type}' found in cache`);
      return cached;
    }

    // Fetch from API if not in cache
    try {
      this.logger.log(`Fetching post '${type}' from API`);
      const { data } = await firstValueFrom(
        this.httpService.get<Post | { post: Post }>(
          API_ENDPOINTS.POST_BY_TYPE(type),
        ),
      );

      // Handle both response structures: direct Post or { post: Post }
      const post = 'post' in data ? data.post : data;

      if (post) {
        this.logger.log(`Post '${type}' fetched successfully, caching...`);
        this.cacheService.set(cacheKey, post);
        return post;
      }

      this.logger.warn(`No post found for type '${type}'`);
      return null;
    } catch (error) {
      this.logger.error(`Failed to fetch post '${type}'`, error);
      return null;
    }
  }

  /**
   * Clear post cache for a specific type
   */
  clearPostCache(type: string): void {
    const cacheKey = `${CACHE_PREFIXES.POST}${type}`;
    this.cacheService.delete(cacheKey);
    this.logger.log(`Post cache cleared for type '${type}'`);
  }

  /**
   * Clear all post caches
   */
  clearAllPostCache(): void {
    const keys = this.cacheService.keys(CACHE_PREFIXES.POST);
    keys.forEach((key) => this.cacheService.delete(key));
    this.logger.log(`Cleared ${keys.length} post cache entries`);
  }
}
