import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { CacheService } from '@/cache/cache.service';
import { Template, TemplateType } from '@/types';

const TEMPLATE_CACHE_PREFIX = 'template:';

@Injectable()
export class TemplateService {
  private readonly logger = new Logger(TemplateService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Get template by type
   * @param type Template type (start, post, product, category)
   * @returns Template or null if not found
   */
  async getTemplateByType(
    type: TemplateType | string,
  ): Promise<Template | null> {
    const cacheKey = `${TEMPLATE_CACHE_PREFIX}${type}`;

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
          `../../telegram/template/by-type/${type}`,
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
    const cacheKey = `${TEMPLATE_CACHE_PREFIX}${type}`;
    this.cacheService.delete(cacheKey);
    this.logger.log(`Template cache cleared for type '${type}'`);
  }

  /**
   * Clear all template caches
   */
  clearAllTemplateCache(): void {
    const keys = this.cacheService.keys(TEMPLATE_CACHE_PREFIX);
    keys.forEach((key) => this.cacheService.delete(key));
    this.logger.log(`Cleared ${keys.length} template cache entries`);
  }
}

