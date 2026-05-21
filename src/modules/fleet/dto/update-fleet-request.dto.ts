import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FleetRequestStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateFleetRequestStatusDto {
  @ApiProperty({ enum: FleetRequestStatus })
  @IsEnum(FleetRequestStatus)
  status!: FleetRequestStatus;

  @ApiPropertyOptional({ description: 'Admin-only notes' })
  @IsOptional()
  @IsString()
  adminNotes?: string;
}
