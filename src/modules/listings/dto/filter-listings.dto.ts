import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ConditionLevel,
  SellerType,
  UseCase,
  VerificationLevel,
} from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export enum SortOption {
  NEWEST = 'newest',
  PRICE_LOW = 'price_low',
  PRICE_HIGH = 'price_high',
  BEST_SCORE = 'best_score',
  LOWEST_KM = 'lowest_km',
  BATTERY_HIGH = 'battery_high',
  RANGE_HIGH = 'range_high',
  FAST_DELIVER = 'fast_deliver',
  MOST_VIEWED = 'most_viewed',
  FEATURED = 'featured',
}

export class FilterListingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ description: 'Category slug' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Subcategory slug' })
  @IsOptional()
  @IsString()
  subcategory?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  brand?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  model?: string;

  @ApiPropertyOptional({ enum: SellerType })
  @IsOptional()
  @IsEnum(SellerType)
  sellerType?: SellerType;

  @ApiPropertyOptional({ enum: ConditionLevel })
  @IsOptional()
  @IsEnum(ConditionLevel)
  condition?: ConditionLevel;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isNew?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  yearMin?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  yearMax?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  priceMin?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  priceMax?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  mileageMax?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  batteryHealthMin?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  rangeMin?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  chargingType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  fastCharging?: boolean;

  @ApiPropertyOptional({ enum: VerificationLevel })
  @IsOptional()
  @IsEnum(VerificationLevel)
  verificationLevel?: VerificationLevel;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  deliveryDaysMax?: number;

  @ApiPropertyOptional({ enum: UseCase })
  @IsOptional()
  @IsEnum(UseCase)
  useCase?: UseCase;

  @ApiPropertyOptional({ enum: SortOption })
  @IsOptional()
  @IsEnum(SortOption)
  sort?: SortOption;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 24, maximum: 48 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(48)
  limit?: number;
}
