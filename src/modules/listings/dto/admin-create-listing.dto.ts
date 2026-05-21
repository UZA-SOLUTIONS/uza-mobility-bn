import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ListingStatus } from '@prisma/client';
import { IsEnum, IsIn, IsOptional, IsString } from 'class-validator';
import { CreateListingDto } from './create-listing.dto';

const ADMIN_CREATE_STATUSES = [
  ListingStatus.DRAFT,
  ListingStatus.APPROVED,
  ListingStatus.PUBLISHED,
] as const;

export class AdminCreateListingDto extends CreateListingDto {
  @ApiProperty({ description: 'Seller record id (UZA org seller in DB)' })
  @IsString()
  sellerId!: string;

  @ApiPropertyOptional({
    enum: ADMIN_CREATE_STATUSES,
    default: ListingStatus.PUBLISHED,
    description:
      'UZA stock/sourcing listings are usually published immediately by admin',
  })
  @IsOptional()
  @IsEnum(ListingStatus)
  @IsIn(ADMIN_CREATE_STATUSES)
  initialStatus?: (typeof ADMIN_CREATE_STATUSES)[number];
}
