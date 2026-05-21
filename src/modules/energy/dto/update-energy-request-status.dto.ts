import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString } from 'class-validator';
import { ENERGY_REQUEST_STATUSES } from '../energy.constants';

export class UpdateEnergyRequestStatusDto {
  @ApiProperty({ enum: ENERGY_REQUEST_STATUSES })
  @IsString()
  @IsIn(ENERGY_REQUEST_STATUSES)
  status!: string;
}
