import type { SellerType } from '@prisma/client';

export interface PricingInput {
  basePriceRwf?: number;
  fobPriceRwf?: number;
  sellerDesiredPayoutRwf?: number;
  discountRwf?: number;
}

export interface PriceBreakdown {
  basePriceRwf?: number;
  fobPriceRwf?: number;
  sellerDesiredPayoutRwf?: number;
  shippingCostRwf?: number;
  localChargesRwf?: number;
  taxesEstimateRwf?: number;
  insuranceRwf?: number;
  storageRwf?: number;
  clearingFeeRwf?: number;
  landingCostRwf?: number;
  marginRwf?: number;
  platformMarginRatePercent?: number;
  commissionRwf?: number;
  ruleDiscountRwf?: number;
  ruleDiscountRatePercent?: number;
  discountRwf?: number;
  finalPriceRwf: number;
  displayPriceRwf: number;
  finalPriceUsd: number;
  deliveryDaysMin: number;
  deliveryDaysMax: number;
  currency: 'RWF';
  sellerType: SellerType;
}
