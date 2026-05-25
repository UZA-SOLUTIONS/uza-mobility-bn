import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { CreatePartDto } from './create-part.dto';

export class AdminCreatePartDto extends CreatePartDto {
  @ApiPropertyOptional({
    description:
      'Seller that owns this part. Omit for platform-owned catalog items.',
  })
  @IsOptional()
  @IsString()
  sellerId?: string;
}
