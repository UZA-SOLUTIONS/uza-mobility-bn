import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { VehicleBookingStatus } from '@prisma/client';

function queryBoolean({ value }: { value: unknown }) {
  return value === 'true' || value === true;
}

export class FilterBookingsDto {
  @IsOptional()
  @IsEnum(VehicleBookingStatus)
  status?: VehicleBookingStatus;

  @IsOptional()
  @IsString()
  listingId?: string;

  @IsOptional()
  @Transform(queryBoolean)
  @IsBoolean()
  activeOnly?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;
}
