import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ChargingProductType } from '@prisma/client';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Min,
} from 'class-validator';

export class CreateChargingProductDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty({ enum: ChargingProductType })
  @IsEnum(ChargingProductType)
  productType!: ChargingProductType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  brand?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  powerKw?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  voltage?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  connectorTypes?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  solarIncluded?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  priceUsd?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUrl({}, { each: true })
  photoUrls?: string[];
}
