import { IsOptional, IsString, MinLength } from 'class-validator';

export class RejectBookingDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  reason?: string;
}
