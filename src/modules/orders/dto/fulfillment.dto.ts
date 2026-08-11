import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ListingInventoryStage } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class AdvanceInventoryStageDto {
  @ApiProperty({ enum: ListingInventoryStage })
  @IsEnum(ListingInventoryStage)
  stage!: ListingInventoryStage;
}

export class UpsertShipmentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  documentNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  vesselName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  voyageNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  etaAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  portOfLoading?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  portOfDischarge?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  terminalOfPickup?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  finalPlaceOfDelivery?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  containerNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sealNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  carrierTrackUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  /** Order IDs to attach to this shipment (matched by VIN separately). */
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsString({ each: true })
  orderIds?: string[];
}

export class AssignOrderFulfillmentDto {
  @ApiProperty({ description: 'Chassis / VIN for this buyer order' })
  @IsString()
  @MinLength(5)
  vin!: string;

  @ApiPropertyOptional({ description: 'Existing shipment id to attach' })
  @IsOptional()
  @IsString()
  shipmentId?: string;

  @ApiPropertyOptional({ type: UpsertShipmentDto })
  @IsOptional()
  @Type(() => UpsertShipmentDto)
  shipment?: UpsertShipmentDto;
}
