import { PartialType } from '@nestjs/swagger';
import { CreateChargingProductDto } from './create-charging-product.dto';

export class UpdateChargingProductDto extends PartialType(
  CreateChargingProductDto,
) {}
