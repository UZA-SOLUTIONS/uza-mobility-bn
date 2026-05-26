import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class AdminFilterBuyersDto {
  @ApiPropertyOptional({
    description: 'Search name, email, phone, or organization',
  })
  @IsOptional()
  @IsString()
  q?: string;
}
