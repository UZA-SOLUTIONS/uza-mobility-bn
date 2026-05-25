import type { CreatePromotionDto } from './create-promotion.dto';
import type { UpdatePromotionDto } from './update-promotion.dto';

export type CreatePromotionPayload = CreatePromotionDto & {
  bannerImageUrl?: string;
};

export type UpdatePromotionPayload = UpdatePromotionDto & {
  bannerImageUrl?: string;
};
