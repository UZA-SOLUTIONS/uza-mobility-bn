import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BuyerType, ChargingProductType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateEnergyRequestDto {
  @ApiProperty()
  @IsString()
  contactName!: string;

  @ApiProperty()
  @IsString()
  phone!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ enum: BuyerType })
  @IsOptional()
  @IsEnum(BuyerType)
  clientType?: BuyerType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  numberOfEvs?: number;

  @ApiPropertyOptional({ enum: ChargingProductType })
  @IsOptional()
  @IsEnum(ChargingProductType)
  chargerTypeNeeded?: ChargingProductType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  solarSupportNeeded?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  fleetUse?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  siteVisitRequested?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  chargingProductId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
