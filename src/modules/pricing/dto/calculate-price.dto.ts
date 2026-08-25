import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SellerType } from '@prisma/client';
import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CalculatePriceDto {
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
  pricingRuleId?: string;

  @ApiPropertyOptional({ description: 'Base selling price in Rwf' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  basePriceRwf?: number;

  @ApiPropertyOptional({ description: 'FOB price in Rwf' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  fobPriceRwf?: number;

  @ApiPropertyOptional({ description: 'Desired seller payout in Rwf' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  sellerDesiredPayoutRwf?: number;

  @ApiPropertyOptional({ description: 'Optional discount in Rwf' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountRwf?: number;
}
