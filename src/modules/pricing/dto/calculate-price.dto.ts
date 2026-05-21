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
}
