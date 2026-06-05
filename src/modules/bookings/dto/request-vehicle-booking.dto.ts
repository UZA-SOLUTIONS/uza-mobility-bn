import { IsOptional, IsString, MinLength } from 'class-validator';

export class RequestVehicleBookingDto {
  @IsString()
  listingId!: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  notes?: string;
}
