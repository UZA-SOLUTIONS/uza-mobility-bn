import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SellerType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, Length } from 'class-validator';

export class CreateSellerProfileDto {
  @ApiProperty({ enum: SellerType })
  @IsEnum(SellerType)
  sellerType!: SellerType;

  @ApiProperty({ example: 'Green Wheels Ltd' })
  @IsString()
  @Length(1, 150)
  businessName!: string;

  @ApiPropertyOptional({ example: 'BRN-123456' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  businessRegNumber?: string;

  @ApiPropertyOptional({ example: 'TIN-987654' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  taxId?: string;

  @ApiPropertyOptional({ example: 'John Doe' })
  @IsOptional()
  @IsString()
  @Length(1, 150)
  contactPerson?: string;

  @ApiPropertyOptional({ example: '+250788123456' })
  @IsOptional()
  @IsString()
  @Length(3, 32)
  phone?: string;

  @ApiPropertyOptional({ example: 'seller@example.com' })
  @IsOptional()
  @IsString()
  @Length(3, 150)
  email?: string;

  @ApiPropertyOptional({ example: 'Kigali, Rwanda' })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  address?: string;

  @ApiPropertyOptional({ example: 'Kigali' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  city?: string;

  @ApiProperty({ example: 'RW' })
  @IsString()
  @Length(2, 2)
  country!: string;

  @ApiPropertyOptional({ example: 'Authorized dealer of EVs and accessories' })
  @IsOptional()
  @IsString()
  @Length(1, 1000)
  description?: string;
}
