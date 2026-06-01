import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class BrowseFiltersQueryDto {
  @ApiPropertyOptional({ description: 'Category slug to scope filter options' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({
    description: 'When set, model options are limited to this brand',
  })
  @IsOptional()
  @IsString()
  brand?: string;
}
