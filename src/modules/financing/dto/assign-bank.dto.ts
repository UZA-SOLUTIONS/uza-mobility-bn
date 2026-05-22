import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class AssignBankDto {
  @ApiProperty()
  @IsString()
  bankId!: string;

  @ApiPropertyOptional({
    description: 'Internal admin notes (not shown to buyer)',
  })
  @IsOptional()
  @IsString()
  reviewNotes?: string;
}
