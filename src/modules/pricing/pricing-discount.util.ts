import type { PricingRule } from '@prisma/client';

export function applyRuleAndListingDiscounts(
  preDiscountTotal: number,
  rule: Pick<PricingRule, 'discountRatePercent'>,
  listingDiscount?: number,
): {
  ruleDiscount: number;
  ruleDiscountRatePercent?: number;
  discount: number;
  finalPrice: number;
} {
  const rate = rule.discountRatePercent ?? 0;
  const ruleDiscount = rate > 0 ? (preDiscountTotal * rate) / 100 : 0;
  const afterRule = preDiscountTotal - ruleDiscount;
  const discount = listingDiscount ?? 0;
  const finalPrice = afterRule - discount;

  return {
    ruleDiscount,
    ...(rate > 0 ? { ruleDiscountRatePercent: rate } : {}),
    discount,
    finalPrice,
  };
}
