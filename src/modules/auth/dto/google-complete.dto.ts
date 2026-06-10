import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class GoogleCompleteDto {
  @ApiProperty({ description: 'One-time code from the Google OAuth callback redirect' })
  @IsString()
  @MinLength(20)
  code!: string;
}
