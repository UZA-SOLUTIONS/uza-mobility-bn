import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateOperatorProfileDto {
  @ApiProperty()
  @IsString()
  @MaxLength(255)
  businessName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  businessRegNumber?: string;

  @ApiProperty()
  @IsString()
  @MaxLength(255)
  contactPerson!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(64)
  phone!: string;

  @ApiProperty()
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(2)
  country!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(255)
  city!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}
