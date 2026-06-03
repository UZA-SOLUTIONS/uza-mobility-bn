import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, Length } from 'class-validator';

function emptyStringToUndefined({ value }: { value: unknown }) {
  if (typeof value === 'string' && value.trim() === '') {
    return undefined;
  }
  return value;
}

export class CreateBuyerProfileDto {
  @ApiProperty({
    example: 'INDIVIDUAL',
    enum: [
      'INDIVIDUAL',
      'BUSINESS',
      'FLEET_OPERATOR',
      'TAXI_ASSOCIATION',
      'NGO',
      'GOVERNMENT',
      'SCHOOL',
      'HOTEL',
      'LOGISTICS_COMPANY',
    ],
  })
  @IsString()
  @IsIn([
    'INDIVIDUAL',
    'BUSINESS',
    'FLEET_OPERATOR',
    'TAXI_ASSOCIATION',
    'NGO',
    'GOVERNMENT',
    'SCHOOL',
    'HOTEL',
    'LOGISTICS_COMPANY',
  ])
  buyerType!: string;

  @ApiPropertyOptional({ example: 'Acme Ltd' })
  @IsOptional()
  @Transform(emptyStringToUndefined)
  @IsString()
  @Length(1, 255)
  organizationName?: string;

  @ApiPropertyOptional({ example: 'TIN-123456' })
  @IsOptional()
  @Transform(emptyStringToUndefined)
  @IsString()
  @Length(1, 255)
  taxId?: string;

  @ApiPropertyOptional({ example: 'KG 123 St' })
  @IsOptional()
  @Transform(emptyStringToUndefined)
  @IsString()
  @Length(1, 255)
  address?: string;

  @ApiPropertyOptional({ example: 'Kigali' })
  @IsOptional()
  @Transform(emptyStringToUndefined)
  @IsString()
  @Length(1, 255)
  city?: string;

  @ApiPropertyOptional({ example: 'RW' })
  @IsOptional()
  @Transform(emptyStringToUndefined)
  @IsString()
  @Length(2, 2)
  country?: string;

  @ApiPropertyOptional({ example: '1199887766554433' })
  @IsOptional()
  @Transform(emptyStringToUndefined)
  @IsString()
  @Length(1, 255)
  nationalId?: string;

  @ApiPropertyOptional({ example: 'A1234567' })
  @IsOptional()
  @Transform(emptyStringToUndefined)
  @IsString()
  @Length(1, 255)
  passportNumber?: string;
}
