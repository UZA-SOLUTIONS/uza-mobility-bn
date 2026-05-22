import { BadRequestException } from '@nestjs/common';
import { Prisma, SellerType } from '@prisma/client';
import type { PriceBreakdown, PricingInput } from '../pricing/pricing.types';
import type { CreateListingPricingDto } from './dto/create-listing-pricing.dto';

export type ListingPricingInputDto = Pick<
  CreateListingPricingDto,
  'basePriceUsd' | 'fobPriceUsd' | 'sellerDesiredPayoutUsd' | 'discountUsd'
>;

export function toPricingInput(dto: ListingPricingInputDto): PricingInput {
  return {
    basePriceUsd: dto.basePriceUsd,
    fobPriceUsd: dto.fobPriceUsd,
    sellerDesiredPayoutUsd: dto.sellerDesiredPayoutUsd,
    discountUsd: dto.discountUsd,
  };
}

export function assertListingPricingInput(
  sellerType: SellerType,
  pricing: ListingPricingInputDto,
): void {
  switch (sellerType) {
    case SellerType.UZA_RWANDA_STOCK:
      if (pricing.basePriceUsd == null) {
        throw new BadRequestException(
          'basePriceUsd is required for UZA Rwanda stock listings',
        );
      }
      break;
    case SellerType.UZA_CHINA_SOURCING:
    case SellerType.INTERNATIONAL_SELLER:
      if (pricing.fobPriceUsd == null) {
        throw new BadRequestException(
          `fobPriceUsd is required for ${sellerType} listings`,
        );
      }
      break;
    case SellerType.LOCAL_SELLER:
      if (pricing.sellerDesiredPayoutUsd == null) {
        throw new BadRequestException(
          'sellerDesiredPayoutUsd is required for local seller listings',
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
  existing?: {
    basePriceUsd: number | null;
    fobPriceUsd: number | null;
    sellerDesiredPayoutUsd: number | null;
    discountUsd: number | null;
  } | null,
): ListingPricingInputDto {
  const merged: ListingPricingInputDto = {
    basePriceUsd: partial.basePriceUsd ?? existing?.basePriceUsd ?? undefined,
    fobPriceUsd: partial.fobPriceUsd ?? existing?.fobPriceUsd ?? undefined,
    sellerDesiredPayoutUsd:
      partial.sellerDesiredPayoutUsd ??
      existing?.sellerDesiredPayoutUsd ??
      undefined,
    discountUsd: partial.discountUsd ?? existing?.discountUsd ?? undefined,
  };

  assertListingPricingInput(sellerType, merged);
  return merged;
}

export function breakdownToListingPricingCreate(
  breakdown: PriceBreakdown,
): Prisma.ListingPricingCreateWithoutListingInput {
  return {
    basePriceUsd: breakdown.basePriceUsd,
    fobPriceUsd: breakdown.fobPriceUsd,
    sellerDesiredPayoutUsd: breakdown.sellerDesiredPayoutUsd,
    shippingCostUsd: breakdown.shippingCostUsd,
    localChargesUsd: breakdown.localChargesUsd,
    taxesEstimateUsd: breakdown.taxesEstimateUsd,
    insuranceUsd: breakdown.insuranceUsd,
    storageUsd: breakdown.storageUsd,
    clearingFeeUsd: breakdown.clearingFeeUsd,
    landingCostUsd: breakdown.landingCostUsd,
    marginUsd: breakdown.marginUsd,
    commissionUsd: breakdown.commissionUsd,
    discountUsd: breakdown.discountUsd,
    finalPriceUsd: breakdown.finalPriceUsd,
    finalPriceRwf: breakdown.finalPriceRwf,
    currency: breakdown.currency,
  };
}

export function deliveryDaysFromBreakdown(breakdown: PriceBreakdown): number {
  return breakdown.deliveryDaysMax;
}
