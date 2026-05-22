import type { Promotion } from '@prisma/client';

export interface PromotionPriceDisplay {
  promotionId: string;
  promotionName: string;
  promotionType: Promotion['type'];
  displayPriceUsd: number;
  savingUsd: number;
}

export function hasDiscountValue(promotion: Promotion): boolean {
  return (
    promotion.discountPercent != null || promotion.discountAmountUsd != null
  );
}

export function applyPromotion(
  basePriceUsd: number,
  promotion: Promotion,
): { effectivePrice: number; saving: number } {
  if (promotion.discountPercent != null) {
    const saving = basePriceUsd * (promotion.discountPercent / 100);
    return {
      effectivePrice: Math.max(0, basePriceUsd - saving),
      saving,
    };
  }

  if (promotion.discountAmountUsd != null) {
    const saving = Math.min(promotion.discountAmountUsd, basePriceUsd);
    return {
      effectivePrice: Math.max(0, basePriceUsd - saving),
      saving,
    };
  }

  return { effectivePrice: basePriceUsd, saving: 0 };
}

/** When multiple discount promotions apply, use the one with the highest saving. */
export function pickBestDiscountPromotion(
  basePriceUsd: number,
  promotions: Promotion[],
): Promotion | null {
  let best: Promotion | null = null;
  let bestSaving = 0;

  for (const promotion of promotions) {
    if (!hasDiscountValue(promotion)) continue;
    const { saving } = applyPromotion(basePriceUsd, promotion);
    if (saving > bestSaving) {
      bestSaving = saving;
      best = promotion;
    }
  }

  return best;
}

export function toPromotionPriceDisplay(
  basePriceUsd: number,
  promotion: Promotion,
): PromotionPriceDisplay {
  const { effectivePrice, saving } = applyPromotion(basePriceUsd, promotion);

  return {
    promotionId: promotion.id,
    promotionName: promotion.name,
    promotionType: promotion.type,
    displayPriceUsd: effectivePrice,
    savingUsd: saving,
  };
}
