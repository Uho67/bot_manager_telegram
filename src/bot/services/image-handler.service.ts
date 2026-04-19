import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import axios from 'axios';
import * as https from 'https';
import { API_ENDPOINTS } from '@/common/constants';
import { TelegramPhotoSize } from '@/types';

/**
 * Service responsible for handling images in Telegram bot
 * - Downloads images from URLs
 * - Caches Telegram file IDs
 * - Manages image uploads
 */
@Injectable()
export class ImageHandlerService {
  private readonly logger = new Logger(ImageHandlerService.name);

  constructor(private readonly httpService: HttpService) { }

  /**
   * Download image from URL and return as Buffer
   * @param url - Image URL to download
   * @returns Image buffer or null if download fails
   */
  async downloadImage(url: string): Promise<Buffer | null> {
    try {
      // Use a separate axios instance without baseURL for external image URLs
      // This prevents the configured baseURL from being prepended to absolute URLs
      // Configure HTTPS agent to accept self-signed/expired certificates (same as ApiModule)
      const httpsAgent = new https.Agent({
        rejectUnauthorized: false,
      });

      const externalAxios = axios.create({
        responseType: 'arraybuffer',
        timeout: 15000,
        httpsAgent,
      });

      const { data } = await externalAxios.get(url);
      return Buffer.from(data);
    } catch (error) {
      this.logger.error(`Failed to download image: ${url}`, error);
      return null;
    }
  }

  /**
   * Save product image file ID to API (fire and forget)
   * @param productId - Product ID
   * @param fileId - Telegram file ID
   */
  saveProductImageFileId(productId: number, fileId: string): void {
    firstValueFrom(
      this.httpService.patch(API_ENDPOINTS.PRODUCT_IMAGE_FILE_ID(productId), {
        image_file_id: fileId,
      }),
    )
      .then(() => {
        this.logger.debug(`Saved file_id for product ${productId}`);
      })
      .catch((error) => {
        this.logger.error(
          `Failed to save file_id for product ${productId}`,
          error,
        );
      });
  }

  /**
   * Save category image file ID to API (fire and forget)
   * @param categoryId - Category ID
   * @param fileId - Telegram file ID
   */
  saveCategoryImageFileId(categoryId: number, fileId: string): void {
    firstValueFrom(
      this.httpService.patch(
        API_ENDPOINTS.CATEGORY_IMAGE_FILE_ID(categoryId),
        {
          image_file_id: fileId,
        },
      ),
    )
      .then(() => {
        this.logger.debug(`Saved file_id for category ${categoryId}`);
      })
      .catch((error) => {
        this.logger.error(
          `Failed to save file_id for category ${categoryId}`,
          error,
        );
      });
  }

  /**
   * Save post image file ID to API (fire and forget)
   * @param postId - Post ID
   * @param fileId - Telegram file ID
   */
  savePostImageFileId(postId: number, fileId: string): void {
    firstValueFrom(
      this.httpService.patch(API_ENDPOINTS.POST_IMAGE_FILE_ID(postId), {
        image_file_id: fileId,
      }),
    )
      .then(() => {
        this.logger.debug(`Saved file_id for post ${postId}`);
      })
      .catch((error) => {
        this.logger.error(`Failed to save file_id for post ${postId}`, error);
      });
  }

  /**
   * Save additional category image file ID to API (fire and forget)
   * @param imageId - CategoryImage ID
   * @param fileId - Telegram file ID
   */
  saveCategoryAdditionalImageFileId(imageId: number, fileId: string): void {
    firstValueFrom(
      this.httpService.patch(
        API_ENDPOINTS.CATEGORY_ADDITIONAL_IMAGE_FILE_ID(imageId),
        {
          image_file_id: fileId,
        },
      ),
    )
      .then(() => {
        this.logger.debug(`Saved file_id for category additional image ${imageId}`);
      })
      .catch((error) => {
        this.logger.error(
          `Failed to save file_id for category additional image ${imageId}`,
          error,
        );
      });
  }

  /**
   * Save additional product image file ID to API (fire and forget)
   * @param imageId - ProductImage ID
   * @param fileId - Telegram file ID
   */
  saveAdditionalImageFileId(imageId: number, fileId: string): void {
    firstValueFrom(
      this.httpService.patch(
        API_ENDPOINTS.PRODUCT_ADDITIONAL_IMAGE_FILE_ID(imageId),
        {
          image_file_id: fileId,
        },
      ),
    )
      .then(() => {
        this.logger.debug(`Saved file_id for additional image ${imageId}`);
      })
      .catch((error) => {
        this.logger.error(
          `Failed to save file_id for additional image ${imageId}`,
          error,
        );
      });
  }

  /**
   * Extract largest photo file ID from Telegram message
   * @param photo - Array of photo sizes from Telegram
   * @returns File ID of the largest photo
   */
  extractLargestPhotoFileId(photo: TelegramPhotoSize[]): string | null {
    if (!photo || photo.length === 0) {
      return null;
    }
    return photo[photo.length - 1].file_id;
  }
}
