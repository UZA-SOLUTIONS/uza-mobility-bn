import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SellerType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreatePricingRuleDto {
  @ApiProperty({ enum: SellerType })
  @IsEnum(SellerType)
  sellerType!: SellerType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  originCountry?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  destinationCountry?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  shippingCostUsd?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  localChargesUsd?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  taxRatePercent?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  insuranceRatePercent?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  storagePerDayUsd?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  clearingFeeUsd?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  platformMarginPercent?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  commissionRate?: number;

  @ApiPropertyOptional({ example: 1300 })
  @IsOptional()
  @IsNumber()
  exchangeRateRwf?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  deliveryDaysMin?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  deliveryDaysMax?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
