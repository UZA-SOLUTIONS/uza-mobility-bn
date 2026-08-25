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

  @ApiPropertyOptional({ description: 'Shipping cost in Rwf' })
  @IsOptional()
  @IsNumber()
  shippingCostRwf?: number;

  @ApiPropertyOptional({ description: 'Local charges in Rwf' })
  @IsOptional()
  @IsNumber()
  localChargesRwf?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  taxRatePercent?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  insuranceRatePercent?: number;

  @ApiPropertyOptional({ description: 'Storage per day in Rwf' })
  @IsOptional()
  @IsNumber()
  storagePerDayRwf?: number;

  @ApiPropertyOptional({ description: 'Clearing fee in Rwf' })
  @IsOptional()
  @IsNumber()
  clearingFeeRwf?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  platformMarginPercent?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  commissionRate?: number;

  @ApiPropertyOptional({
    description:
      'Percentage discount applied from the pricing rule before listing discount',
  })
  @IsOptional()
  @IsNumber()
  discountRatePercent?: number;

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
