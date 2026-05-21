import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateListingPricingDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  basePriceUsd?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  fobPriceUsd?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  sellerDesiredPayoutUsd?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountUsd?: number;

  @ApiProperty({ example: 28500 })
  @IsNumber()
  @Min(0)
  finalPriceUsd!: number;

  @ApiPropertyOptional({ example: 37050000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  finalPriceRwf?: number;

  @ApiPropertyOptional({ default: 'USD' })
  @IsOptional()
  @IsString()
  currency?: string;
}
