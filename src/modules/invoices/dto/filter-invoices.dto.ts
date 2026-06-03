import { ApiPropertyOptional } from '@nestjs/swagger';
import { InvoiceStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

function queryBoolean({ value }: { value: unknown }) {
  return value === 'true' || value === true;
}

export class FilterInvoicesDto {
  @ApiPropertyOptional({ enum: InvoiceStatus })
  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;

  @ApiPropertyOptional({
    description:
      'Active purchase in progress (sent, awaiting payment, under verification, etc.)',
  })
  @IsOptional()
  @Transform(queryBoolean)
  @IsBoolean()
  pendingPurchase?: boolean;

  @ApiPropertyOptional({
    description: 'Invoices the buyer can still pay against',
  })
  @IsOptional()
  @Transform(queryBoolean)
  @IsBoolean()
  payableOnly?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  listingId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 25, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
