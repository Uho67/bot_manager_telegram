import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { CacheService } from '@/cache/cache.service';
import { Template, TemplateType } from '@/types';
import { CACHE_PREFIXES, API_ENDPOINTS } from '@/common/constants';

/**
 * Service for managing template data
 * Handles fetching, caching, and retrieving template configurations from external API
 * Templates define button layouts for different bot screens
 */
@Injectable()
export class TemplateService {
  private readonly logger = new Logger(TemplateService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly cacheService: CacheService,
  ) { }

  /**
   * Get template by type
   * @param type Template type (start, post, product, category)
   * @returns Template or null if not found
   */
  async getTemplateByType(
    type: TemplateType | string,
  ): Promise<Template | null> {
    const cacheKey = `${CACHE_PREFIXES.TEMPLATE}${type}`;

    // Check cache first
    const cached = this.cacheService.get<Template>(cacheKey);
    if (cached) {
      this.logger.log(`Template '${type}' found in cache`);
      return cached;
    }

    // Fetch from API if not in cache
    try {
      this.logger.log(`Fetching template '${type}' from API`);
      const { data } = await firstValueFrom(
        this.httpService.get<Template[]>(
          API_ENDPOINTS.TEMPLATE_BY_TYPE(type),
        ),
      );

      // API returns an array, we take the first item
      const template = data && data.length > 0 ? data[0] : null;

      if (template) {
        this.logger.log(`Template '${type}' fetched successfully, caching...`);
        this.cacheService.set(cacheKey, template);
        return template;
      }

      this.logger.warn(`No template found for type '${type}'`);
      return null;
    } catch (error) {
      this.logger.error(`Failed to fetch template '${type}'`, error);
      return null;
    }
  }

  /**
   * Clear template cache for a specific type
   */
  clearTemplateCache(type: TemplateType | string): void {
    const cacheKey = `${CACHE_PREFIXES.TEMPLATE}${type}`;
    this.cacheService.delete(cacheKey);
    this.logger.log(`Template cache cleared for type '${type}'`);
  }

  /**
   * Clear all template caches
   */
  clearAllTemplateCache(): void {
    const keys = this.cacheService.keys(CACHE_PREFIXES.TEMPLATE);
    keys.forEach((key) => this.cacheService.delete(key));
    this.logger.log(`Cleared ${keys.length} template cache entries`);
  }
}

