import { BadRequestException } from '@nestjs/common';
import { Prisma, SellerType } from '@prisma/client';
import { rwfToUsdAmount, usdtToRwfAmount } from '../../common/money/money-format.util';
import type { PriceBreakdown, PricingInput } from '../pricing/pricing.types';
import type { CreateListingPricingDto } from './dto/create-listing-pricing.dto';

export type ListingPricingInputDto = Pick<
  CreateListingPricingDto,
  | 'basePriceRwf'
  | 'fobPriceRwf'
  | 'sellerDesiredPayoutRwf'
  | 'discountRwf'
  | 'pricingRuleId'
>;

export type ExistingListingPricing = {
  currency?: string | null;
  basePriceUsd?: number | null;
  fobPriceUsd?: number | null;
  sellerDesiredPayoutUsd?: number | null;
  discountUsd?: number | null;
  basePriceRwf?: number | null;
  fobPriceRwf?: number | null;
  sellerDesiredPayoutRwf?: number | null;
  discountRwf?: number | null;
};

export function toPricingInput(dto: ListingPricingInputDto): PricingInput {
  return {
    basePriceRwf: dto.basePriceRwf,
    fobPriceRwf: dto.fobPriceRwf,
    sellerDesiredPayoutRwf: dto.sellerDesiredPayoutRwf,
    discountRwf: dto.discountRwf,
  };
}

function usdToRwf(
  amount: number | null | undefined,
  frozenRate: number,
): number | undefined {
  if (amount == null) return undefined;
  return usdtToRwfAmount(amount, frozenRate);
}

export function assertListingPricingInput(
  sellerType: SellerType,
  pricing: ListingPricingInputDto,
): void {
  switch (sellerType) {
    case SellerType.UZA_RWANDA_STOCK:
      if (pricing.basePriceRwf == null) {
        throw new BadRequestException(
          'basePriceRwf is required for UZA Rwanda stock listings',
        );
      }
      break;
    case SellerType.UZA_CHINA_SOURCING:
    case SellerType.INTERNATIONAL_SELLER:
      if (pricing.fobPriceRwf == null) {
        throw new BadRequestException(
          `fobPriceRwf is required for ${sellerType} listings`,
        );
      }
      break;
    case SellerType.LOCAL_SELLER:
      if (pricing.sellerDesiredPayoutRwf == null) {
        throw new BadRequestException(
          'sellerDesiredPayoutRwf is required for local seller listings',
        );
      }
      break;
    default:
      throw new BadRequestException(`Unsupported seller type: ${sellerType}`);
  }
}

export function mergeListingPricingInput(
  sellerType: SellerType,
  partial: ListingPricingInputDto,
  existing: ExistingListingPricing | null | undefined,
  frozenRate: number,
): ListingPricingInputDto {
  const fromUsd = existing?.currency !== 'RWF';
  const merged: ListingPricingInputDto = {
    basePriceRwf:
      partial.basePriceRwf ??
      existing?.basePriceRwf ??
      (fromUsd ? usdToRwf(existing?.basePriceUsd, frozenRate) : undefined),
    fobPriceRwf:
      partial.fobPriceRwf ??
      existing?.fobPriceRwf ??
      (fromUsd ? usdToRwf(existing?.fobPriceUsd, frozenRate) : undefined),
    sellerDesiredPayoutRwf:
      partial.sellerDesiredPayoutRwf ??
      existing?.sellerDesiredPayoutRwf ??
      (fromUsd
        ? usdToRwf(existing?.sellerDesiredPayoutUsd, frozenRate)
        : undefined),
    discountRwf:
      partial.discountRwf ??
      existing?.discountRwf ??
      (fromUsd ? usdToRwf(existing?.discountUsd, frozenRate) : undefined),
    pricingRuleId: partial.pricingRuleId,
  };

  assertListingPricingInput(sellerType, merged);
  return merged;
}

export function breakdownToListingPricingCreate(
  breakdown: PriceBreakdown,
  pricingRuleId?: string,
  existingUsd?: ExistingListingPricing | null,
): Prisma.ListingPricingCreateWithoutListingInput {
  return {
    basePriceUsd: existingUsd?.basePriceUsd ?? undefined,
    fobPriceUsd: existingUsd?.fobPriceUsd ?? undefined,
    sellerDesiredPayoutUsd: existingUsd?.sellerDesiredPayoutUsd ?? undefined,
    discountUsd: existingUsd?.discountUsd ?? undefined,
    finalPriceUsd: breakdown.finalPriceUsd,
    basePriceRwf: breakdown.basePriceRwf,
    fobPriceRwf: breakdown.fobPriceRwf,
    sellerDesiredPayoutRwf: breakdown.sellerDesiredPayoutRwf,
    shippingCostRwf: breakdown.shippingCostRwf,
    localChargesRwf: breakdown.localChargesRwf,
    taxesEstimateRwf: breakdown.taxesEstimateRwf,
    insuranceRwf: breakdown.insuranceRwf,
    storageRwf: breakdown.storageRwf,
    clearingFeeRwf: breakdown.clearingFeeRwf,
    landingCostRwf: breakdown.landingCostRwf,
    marginRwf: breakdown.marginRwf,
    commissionRwf: breakdown.commissionRwf,
    ruleDiscountRwf: breakdown.ruleDiscountRwf,
    discountRwf: breakdown.discountRwf,
    finalPriceRwf: breakdown.finalPriceRwf,
    displayPriceRwf: breakdown.displayPriceRwf,
    currency: 'RWF',
    priceNotes: pricingRuleId
      ? JSON.stringify({
          pricingRuleId,
          ...(breakdown.platformMarginRatePercent != null
            ? {
                platformMarginPercentApplied:
                  breakdown.platformMarginRatePercent,
              }
            : {}),
          ...(breakdown.ruleDiscountRatePercent != null
            ? {
                discountRatePercentApplied: breakdown.ruleDiscountRatePercent,
              }
            : {}),
        })
      : undefined,
  };
}

export function deliveryDaysFromBreakdown(breakdown: PriceBreakdown): number {
  return breakdown.deliveryDaysMax;
}

export function parsePricingRuleIdFromPriceNotes(
  priceNotes: string | null | undefined,
): string | undefined {
  if (!priceNotes) return undefined;
  try {
    const parsed = JSON.parse(priceNotes) as { pricingRuleId?: string };
    return parsed.pricingRuleId;
  } catch {
    return undefined;
  }
}

export function parseDiscountRatePercentFromPriceNotes(
  priceNotes: string | null | undefined,
): number | undefined {
  if (!priceNotes) return undefined;
  try {
    const parsed = JSON.parse(priceNotes) as {
      discountRatePercentApplied?: number;
    };
    const rate = parsed.discountRatePercentApplied;
    return typeof rate === 'number' && rate > 0 ? rate : undefined;
  } catch {
    return undefined;
  }
}

export function derivedUsdFromRwf(
  amountRwf: number,
  frozenRate: number,
): number {
  return rwfToUsdAmount(amountRwf, frozenRate);
}
