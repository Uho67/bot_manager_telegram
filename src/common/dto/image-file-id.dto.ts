import { IsString, IsNotEmpty } from 'class-validator';

/**
 * DTO for updating image file ID
 */
export class UpdateImageFileIdDto {
  @IsString()
  @IsNotEmpty()
  image_file_id!: string;
}
