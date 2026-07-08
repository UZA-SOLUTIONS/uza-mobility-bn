import type { SellerType } from '@prisma/client';

export interface PricingInput {
  basePriceUsd?: number;
  fobPriceUsd?: number;
  sellerDesiredPayoutUsd?: number;
  discountUsd?: number;
}

export interface PriceBreakdown {
  basePriceUsd?: number;
  fobPriceUsd?: number;
  sellerDesiredPayoutUsd?: number;
  shippingCostUsd?: number;
  localChargesUsd?: number;
  taxesEstimateUsd?: number;
  insuranceUsd?: number;
  storageUsd?: number;
  clearingFeeUsd?: number;
  landingCostUsd?: number;
  marginUsd?: number;
  platformMarginRatePercent?: number;
  commissionUsd?: number;
  ruleDiscountUsd?: number;
  ruleDiscountRatePercent?: number;
  discountUsd?: number;
  finalPriceUsd: number;
  deliveryDaysMin: number;
  deliveryDaysMax: number;
  currency: string;
  sellerType: SellerType;
}
