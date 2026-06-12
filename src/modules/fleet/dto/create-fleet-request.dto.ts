import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BuyerType, UseCase } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateFleetRequestDto {
  @ApiProperty()
  @IsString()
  organizationName!: string;

  @ApiProperty()
  @IsString()
  contactPerson!: string;

  @ApiProperty()
  @IsString()
  phone!: string;

  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ enum: BuyerType, default: BuyerType.BUSINESS })
  @IsOptional()
  @IsEnum(BuyerType)
  buyerType?: BuyerType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  vehicleCategoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  vehicleSubcategoryId?: string;

  @ApiProperty({ default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;

  @ApiPropertyOptional({ enum: UseCase })
  @IsOptional()
  @IsEnum(UseCase)
  useCase?: UseCase;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  preferredDeliveryTimeline?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  budgetRangeMin?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  budgetRangeMax?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  financingRequested?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  chargingSupportRequested?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  associationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
