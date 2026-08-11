import {
  ApiPropertyOptional,
  IntersectionType,
  PartialType,
} from '@nestjs/swagger';
import { ListingStatus } from '@prisma/client';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';
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

  @ApiPropertyOptional({
    type: [String],
    description:
      'Ordered IDs of remaining existing photos (displayOrder). New uploads are appended after these.',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  photoOrder?: string[];

  @ApiPropertyOptional({
    description: 'Existing photo ID to set as the cover (primary) image',
  })
  @IsOptional()
  @IsString()
  primaryPhotoId?: string;

  @ApiPropertyOptional({ description: 'Remove the listing hero video' })
  @IsOptional()
  @IsBoolean()
  removeVideo?: boolean;

  @ApiPropertyOptional({ description: 'Remove the vehicle brochure PDF' })
  @IsOptional()
  @IsBoolean()
  removeBrochure?: boolean;

  @ApiPropertyOptional({
    enum: ListingStatus,
    description:
      'Manual status change when editing (e.g. DRAFT → PENDING_REVIEW). Approval still uses approve/publish endpoints.',
  })
  @IsOptional()
  @IsEnum(ListingStatus)
  status?: ListingStatus;
}

/** Admin may update platform listings they created (multipart payload). */
export class AdminUpdateListingDto extends IntersectionType(
  PartialType(CreateListingDto),
  AdminUpdateListingExtrasDto,
) {}
