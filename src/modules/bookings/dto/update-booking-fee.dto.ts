import { Type } from 'class-transformer';
import { IsNumber, Min } from 'class-validator';

export class UpdateBookingFeeDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  bookingFeeUsd!: number;
}
