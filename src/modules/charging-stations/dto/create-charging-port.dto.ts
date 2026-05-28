import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ChargerType,
  CurrentType,
  PortStatus,
  SpeedCategory,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateChargingPortDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  portNumber?: string;

  @ApiProperty({ enum: ChargerType })
  @IsEnum(ChargerType)
  chargerType!: ChargerType;

  @ApiProperty({ enum: SpeedCategory })
  @IsEnum(SpeedCategory)
  speedCategory!: SpeedCategory;

  @ApiProperty({ example: 22 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  powerKw!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  voltage?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  amperage?: number;

  @ApiProperty({ enum: CurrentType })
  @IsEnum(CurrentType)
  currentType!: CurrentType;

  @ApiPropertyOptional({ enum: PortStatus, default: PortStatus.AVAILABLE })
  @IsOptional()
  @IsEnum(PortStatus)
  status?: PortStatus;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;
}
