import type { Invoice, ListingPricing } from '@prisma/client';
import type { CompanyPaymentDetails } from '../platform-settings/platform-settings.constants';

/** Buyer-facing invoice — no internal commission fields on nested pricing. */
export function toBuyerInvoice<T extends Invoice>(invoice: T) {
  return invoice;
}

/**
 * Older invoices only snapshotted the USD account. Fill any missing receiving
 * accounts from live platform settings so buyers always see both options.
 */
export function withPaymentAccountsFallback<T extends Invoice>(
  invoice: T,
  company: CompanyPaymentDetails,
): T {
  return {
    ...invoice,
    beneficiaryName: invoice.beneficiaryName ?? company.legalName,
    bankName: invoice.bankName ?? company.usd.bankName,
    accountNumber: invoice.accountNumber ?? company.usd.accountNumber,
    rwfBankName: invoice.rwfBankName ?? company.rwf.bankName,
    rwfAccountNumber: invoice.rwfAccountNumber ?? company.rwf.accountNumber,
  };
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
