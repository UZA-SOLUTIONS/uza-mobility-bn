import { Type } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class UpdatePlatformSettingsDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  bookingFeeUsd?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  bookingFeeRwf?: number;

  /** Frozen leftover-USD display rate. Not a live market feed. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  usdToRwfEffective?: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  companyLegalName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  companyBankName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  companyAccountNumber?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  companyBankNameRwf?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  companyAccountNumberRwf?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  companyWhatsappNumber?: string;
}
