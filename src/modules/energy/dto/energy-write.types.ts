import type { CreateChargingProductDto } from './create-charging-product.dto';
import type { UpdateChargingProductDto } from './update-charging-product.dto';

export type CreateChargingProductPayload = CreateChargingProductDto & {
  photoUrls?: string[];
};

export type UpdateChargingProductPayload = UpdateChargingProductDto & {
  photoUrls?: string[];
};
