import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  BodyType,
  ConditionLevel,
  DrivetrainType,
  PowertrainType,
  SellerType,
  SteeringPosition,
  UseCase,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Min,
  ValidateNested,
} from 'class-validator';
import { CreateEvSpecDto } from './create-ev-spec.dto';
import { CreateListingPricingDto } from './create-listing-pricing.dto';

export class CreateListingDto {
  @ApiProperty()
  @IsString()
  @Length(1, 200)
  listingTitle!: string;

  @ApiProperty()
  @IsString()
  categoryId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  subcategoryId?: string;

  @ApiProperty({ enum: SellerType })
  @IsEnum(SellerType)
  sellerType!: SellerType;

  @ApiProperty()
  @IsString()
  @Length(1, 100)
  brand!: string;

  @ApiProperty()
  @IsString()
  @Length(1, 100)
  model!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  trim?: string;

  @ApiProperty({ example: 2024 })
  @IsInt()
  @Min(1990)
  manufacturingYear!: number;

  @ApiProperty()
  @IsBoolean()
  isNew!: boolean;

  @ApiProperty({ enum: ConditionLevel })
  @IsEnum(ConditionLevel)
  condition!: ConditionLevel;

  @ApiPropertyOptional({ enum: BodyType })
  @IsOptional()
  @IsEnum(BodyType)
  bodyType?: BodyType;

  @ApiPropertyOptional({ enum: PowertrainType })
  @IsOptional()
  @IsEnum(PowertrainType)
  powertrainType?: PowertrainType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  seats?: number;

  @ApiPropertyOptional({ enum: SteeringPosition })
  @IsOptional()
  @IsEnum(SteeringPosition)
  steeringPosition?: SteeringPosition;

  @ApiPropertyOptional({ enum: DrivetrainType })
  @IsOptional()
  @IsEnum(DrivetrainType)
  drivetrain?: DrivetrainType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  mileageKm?: number;

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
  @IsBoolean()
  hasAccidentHistory?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  ownershipCount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  registrationStatus?: string;

  @ApiProperty()
  @IsString()
  @Length(1, 255)
  vehicleLocation!: string;

  @ApiProperty()
  @IsString()
  @Length(1, 100)
  city!: string;

  @ApiProperty({ default: 'RW' })
  @IsString()
  @Length(2, 2)
  country!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  deliveryEstimateDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  videoUrl?: string;

  @ApiPropertyOptional({
    description: 'Whether the vehicle is full option / fully loaded trim',
  })
  @IsOptional()
  @IsBoolean()
  isFullOption?: boolean;

  @ApiPropertyOptional({ type: CreateEvSpecDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateEvSpecDto)
  evSpecs?: CreateEvSpecDto;

  @ApiProperty({ type: CreateListingPricingDto })
  @ValidateNested()
  @Type(() => CreateListingPricingDto)
  pricing!: CreateListingPricingDto;

  @ApiPropertyOptional({ enum: UseCase, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(UseCase, { each: true })
  useCases?: UseCase[];
}
