import { ApiProperty } from '@nestjs/swagger';
import { ListingInventoryStage } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class AdvanceInventoryStageDto {
  @ApiProperty({ enum: ListingInventoryStage })
  @IsEnum(ListingInventoryStage)
  stage!: ListingInventoryStage;
}
