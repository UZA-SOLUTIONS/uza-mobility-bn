import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InvoiceType } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class RequestInvoiceDto {
  @ApiProperty()
  @IsString()
  listingId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  buyerAddress?: string;

  @ApiPropertyOptional({ enum: InvoiceType, default: InvoiceType.PROFORMA })
  @IsOptional()
  @IsEnum(InvoiceType)
  invoiceType?: InvoiceType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
