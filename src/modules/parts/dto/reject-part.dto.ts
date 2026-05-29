import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class RejectPartDto {
  @ApiProperty()
  @IsString()
  @Length(1, 2000)
  reason!: string;
}
