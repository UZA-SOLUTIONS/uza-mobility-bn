import type { Invoice, ListingPricing } from '@prisma/client';

/** Buyer-facing invoice — no internal commission fields on nested pricing. */
export function toBuyerInvoice<T extends Invoice>(invoice: T) {
  return invoice;
}

export function snapshotPricingFields(pricing: ListingPricing | null) {
  if (!pricing) {
    throw new Error('Listing pricing is required for invoice snapshot');
  }

  const totalAmountUsd = pricing.finalPriceUsd;

  return {
    basePriceUsd: pricing.basePriceUsd,
    fobPriceUsd: pricing.fobPriceUsd,
    shippingCostUsd: pricing.shippingCostUsd,
    localChargesUsd: pricing.localChargesUsd,
    taxesUsd: pricing.taxesEstimateUsd,
    insuranceUsd: pricing.insuranceUsd,
    clearingFeeUsd: pricing.clearingFeeUsd,
    landingCostUsd: pricing.landingCostUsd,
    marginUsd: pricing.marginUsd,
    ruleDiscountUsd: pricing.ruleDiscountUsd,
    discountUsd: pricing.discountUsd,
    totalAmountUsd,
    currency: pricing.currency ?? 'USD',
  };
}
