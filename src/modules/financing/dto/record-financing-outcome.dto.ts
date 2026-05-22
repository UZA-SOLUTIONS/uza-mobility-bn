import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FinancingStatus } from '@prisma/client';
import { IsEnum, IsIn, IsOptional, IsString } from 'class-validator';

const OUTCOME_STATUSES = [
  FinancingStatus.BANK_APPROVED,
  FinancingStatus.BANK_REJECTED,
] as const;

export class RecordFinancingOutcomeDto {
  @ApiProperty({ enum: OUTCOME_STATUSES })
  @IsEnum(FinancingStatus)
  @IsIn(OUTCOME_STATUSES)
  status!: (typeof OUTCOME_STATUSES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reviewNotes?: string;
}
