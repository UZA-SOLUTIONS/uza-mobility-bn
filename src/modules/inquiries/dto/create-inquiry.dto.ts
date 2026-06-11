import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BuyerType } from '@prisma/client';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';

const INQUIRY_BUYER_TYPES = [BuyerType.INDIVIDUAL, BuyerType.BUSINESS] as const;

export class CreateInquiryDto {
  @ApiProperty()
  @IsString()
  listingId!: string;

  @ApiProperty()
  @IsString()
  @Length(1, 120)
  name!: string;

  @ApiProperty()
  @IsString()
  @Length(6, 30)
  phone!: string;

  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'RW' })
  @IsString()
  @Length(2, 2)
  country!: string;

  @ApiProperty({ enum: INQUIRY_BUYER_TYPES })
  @IsIn(INQUIRY_BUYER_TYPES)
  buyerType!: (typeof INQUIRY_BUYER_TYPES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;
}
