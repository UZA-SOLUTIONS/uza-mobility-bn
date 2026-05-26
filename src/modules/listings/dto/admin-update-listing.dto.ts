import {
  ApiPropertyOptional,
  IntersectionType,
  PartialType,
} from '@nestjs/swagger';
import { IsArray, IsOptional, IsString } from 'class-validator';
import { CreateListingDto } from './create-listing.dto';

class AdminUpdateListingExtrasDto {
  @ApiPropertyOptional({
    type: [String],
    description: 'IDs of existing listing photos to remove',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  removePhotoIds?: string[];
}

/** Admin may update platform listings they created (multipart payload). */
export class AdminUpdateListingDto extends IntersectionType(
  PartialType(CreateListingDto),
  AdminUpdateListingExtrasDto,
) {}
