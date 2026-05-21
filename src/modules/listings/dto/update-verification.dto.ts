import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VerificationLevel } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUrl } from 'class-validator';

export class UpdateVerificationDto {
  @ApiProperty({ enum: VerificationLevel })
  @IsEnum(VerificationLevel)
  verificationLevel!: VerificationLevel;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  inspectionStatus?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  batteryReportStatus?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  documentStatus?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  reportUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  batteryReportUrl?: string;
}
