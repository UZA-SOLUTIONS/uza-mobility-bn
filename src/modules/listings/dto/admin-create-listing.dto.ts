import { ApiPropertyOptional } from '@nestjs/swagger';
import { ListingStatus } from '@prisma/client';
import { IsEnum, IsIn, IsOptional } from 'class-validator';
import { CreateListingDto } from './create-listing.dto';

const ADMIN_CREATE_STATUSES = [
  ListingStatus.DRAFT,
  ListingStatus.PENDING_REVIEW,
] as const;

export class AdminCreateListingDto extends CreateListingDto {
  @ApiPropertyOptional({
    enum: ADMIN_CREATE_STATUSES,
    default: ListingStatus.PENDING_REVIEW,
    description:
      'Admin listings enter review like seller listings; an administrator approves and publishes',
  })
  @IsOptional()
  @IsEnum(ListingStatus)
  @IsIn(ADMIN_CREATE_STATUSES)
  initialStatus?: (typeof ADMIN_CREATE_STATUSES)[number];
}
