import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Length,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ example: '+250788123456' })
  @IsOptional()
  @IsString()
  @Length(3, 32)
  phone?: string;

  @ApiProperty({ example: 'StrongPassword123!' })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ example: 'Alice' })
  @IsString()
  @Length(1, 100)
  firstName!: string;

  @ApiProperty({ example: 'Johnson' })
  @IsString()
  @Length(1, 100)
  lastName!: string;

  @ApiPropertyOptional({ example: 'en', enum: ['en', 'fr', 'rw'] })
  @IsOptional()
  @IsString()
  @IsIn(['en', 'fr', 'rw'])
  preferredLanguage?: string;
}
