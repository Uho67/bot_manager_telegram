import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Base exception for API-related errors
 */
export class ApiException extends HttpException {
  constructor(message: string, status: HttpStatus = HttpStatus.BAD_REQUEST) {
    super(message, status);
  }
}

/**
 * Exception thrown when a resource is not found
 */
export class ResourceNotFoundException extends ApiException {
  constructor(resource: string, id: number | string) {
    super(`${resource} with ID ${id} not found`, HttpStatus.NOT_FOUND);
  }
}

/**
 * Exception thrown when external API call fails
 */
export class ExternalApiException extends ApiException {
  constructor(message: string, originalError?: unknown) {
    super(`External API error: ${message}`, HttpStatus.BAD_GATEWAY);
    if (originalError) {
      this.cause = originalError;
    }
  }
}

/**
 * Exception thrown when image download fails
 */
export class ImageDownloadException extends ApiException {
  constructor(url: string, originalError?: unknown) {
    super(`Failed to download image from ${url}`, HttpStatus.BAD_REQUEST);
    if (originalError) {
      this.cause = originalError;
    }
  }
}
