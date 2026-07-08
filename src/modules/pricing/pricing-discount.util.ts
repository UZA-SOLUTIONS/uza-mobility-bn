import type { PricingRule } from '@prisma/client';

export function applyRuleAndListingDiscounts(
  preDiscountTotal: number,
  rule: Pick<PricingRule, 'discountRatePercent'>,
  listingDiscountUsd?: number,
): {
  ruleDiscountUsd: number;
  ruleDiscountRatePercent?: number;
  discountUsd: number;
  finalPriceUsd: number;
} {
  const rate = rule.discountRatePercent ?? 0;
  const ruleDiscountUsd = rate > 0 ? (preDiscountTotal * rate) / 100 : 0;
  const afterRule = preDiscountTotal - ruleDiscountUsd;
  const discountUsd = listingDiscountUsd ?? 0;
  const finalPriceUsd = afterRule - discountUsd;

  return {
    ruleDiscountUsd,
    ...(rate > 0 ? { ruleDiscountRatePercent: rate } : {}),
    discountUsd,
    finalPriceUsd,
  };
}
