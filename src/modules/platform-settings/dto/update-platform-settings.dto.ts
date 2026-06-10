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
  @MinLength(8)
  companyWhatsappNumber?: string;
}
