import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PartCondition } from '@prisma/client';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreatePartDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty({ example: 'batteries' })
  @IsString()
  categorySlug!: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  compatibleBrands?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  compatibleModels?: string[];

  @ApiProperty({ enum: PartCondition })
  @IsEnum(PartCondition)
  condition!: PartCondition;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  priceUsd!: number;

  @ApiProperty()
  @IsInt()
  @Min(0)
  stockQuantity!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deliveryEstimate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  hasWarranty?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  warrantyDetails?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}
