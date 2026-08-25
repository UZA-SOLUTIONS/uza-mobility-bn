import { Type } from 'class-transformer';
import { IsNumber, IsOptional, Min } from 'class-validator';

export class UpdateBookingFeeDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  bookingFeeRwf?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  bookingFeeUsd?: number;
}
