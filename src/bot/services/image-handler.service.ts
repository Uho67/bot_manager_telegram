import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
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

  constructor(private readonly httpService: HttpService) {}

  /**
   * Download image from URL and return as Buffer
   * @param url - Image URL to download
   * @returns Image buffer or null if download fails
   */
  async downloadImage(url: string): Promise<Buffer | null> {
    try {
      const { data } = await firstValueFrom(
        this.httpService.get(url, { responseType: 'arraybuffer' }),
      );
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
