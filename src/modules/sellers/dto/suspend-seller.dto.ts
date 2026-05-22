import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class SuspendSellerDto {
  @ApiPropertyOptional({ description: 'Internal note for audit trail' })
  @IsOptional()
  @IsString()
  reason?: string;
}
