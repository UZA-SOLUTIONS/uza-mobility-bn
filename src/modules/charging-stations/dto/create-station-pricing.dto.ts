import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StationPricingModel } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateStationPricingDto {
  @ApiProperty({ enum: StationPricingModel })
  @IsEnum(StationPricingModel)
  pricingModel!: StationPricingModel;

  @ApiPropertyOptional({ example: 0.35 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  rateAmount?: number;

  @ApiPropertyOptional({ default: 'USD' })
  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  validUntil?: string;
}
