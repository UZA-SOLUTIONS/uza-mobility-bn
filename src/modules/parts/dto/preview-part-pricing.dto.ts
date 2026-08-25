import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Min } from 'class-validator';

/** Treats price as desired seller payout; returns buyer price + platform fee estimate. */
export class PreviewPartPricingDto {
  @ApiProperty({ example: 120 })
  @IsNumber()
  @Min(0)
  desiredPayoutRwf!: number;
}
