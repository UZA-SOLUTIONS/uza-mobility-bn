import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ChargerType,
  LocationType,
  SpeedCategory,
  StationOperationalStatus,
  StationPricingModel,
  StationStatus,
  VehicleCategory,
} from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class FilterStationsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  longitude?: number;

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  radiusKm?: number;

  @ApiPropertyOptional({ enum: ChargerType })
  @IsOptional()
  @IsEnum(ChargerType)
  chargerType?: ChargerType;

  @ApiPropertyOptional({ enum: SpeedCategory })
  @IsOptional()
  @IsEnum(SpeedCategory)
  speedCategory?: SpeedCategory;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  powerKwMin?: number;

  @ApiPropertyOptional({ enum: LocationType })
  @IsOptional()
  @IsEnum(LocationType)
  locationType?: LocationType;

  @ApiPropertyOptional({ enum: VehicleCategory })
  @IsOptional()
  @IsEnum(VehicleCategory)
  vehicleCategory?: VehicleCategory;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  brand?: string;

  @ApiPropertyOptional({ enum: StationPricingModel })
  @IsOptional()
  @IsEnum(StationPricingModel)
  pricingModel?: StationPricingModel;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isOpen24h?: boolean;

  @ApiPropertyOptional({ enum: StationOperationalStatus })
  @IsOptional()
  @IsEnum(StationOperationalStatus)
  operationalStatus?: StationOperationalStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  hasParking?: boolean;

  @ApiPropertyOptional({ enum: StationStatus })
  @IsOptional()
  @IsEnum(StationStatus)
  status?: StationStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  operatorId?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 24, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
