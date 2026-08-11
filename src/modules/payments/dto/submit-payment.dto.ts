import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class SubmitPaymentDto {
  @ApiProperty()
  @IsString()
  invoiceId!: string;

  @ApiProperty({
    example: 28500,
    description: 'Amount transferred in the selected currency (USD or RWF)',
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amountPaid!: number;

  @ApiProperty({ enum: ['USD', 'RWF'], default: 'USD' })
  @IsIn(['USD', 'RWF'])
  currency!: 'USD' | 'RWF';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bankName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  transferReference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  paymentDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  senderName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
