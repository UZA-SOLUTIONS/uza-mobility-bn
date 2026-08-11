import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class SubmitBookingPaymentDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amountPaid!: number;

  /** Which company receiving account the buyer paid into. */
  @IsIn(['USD', 'RWF'])
  currency!: 'USD' | 'RWF';

  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  @IsString()
  transferReference?: string;

  @IsOptional()
  @IsDateString()
  paymentDate?: string;

  @IsOptional()
  @IsString()
  senderName?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
