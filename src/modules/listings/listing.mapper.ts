import { Listing, ListingPricing, ListingStatus, Prisma } from '@prisma/client';
import { toAbsoluteUploadUrl } from '../../common/uploads/storage.paths';
import { toDisplayRwf, usdtToRwfAmount } from '../../common/money/money-format.util';
import type { PromotionPriceDisplay } from '../promotions/promotion-display.util';
import {
  inventoryStagePublicLabel,
  resolveDefaultInventoryStage,
} from './listing-inventory.util';

type ListingWithRelations = Prisma.ListingGetPayload<{
  include: {
    category: { select: { id: true; name: true; slug: true; type: true } };
    subcategory: { select: { id: true; name: true; slug: true } };
    evSpecs: true;
    listingPricing: true;
    photos: true;
    useCaseTags: true;
    seller: {
      select: {
        businessName: true;
        country: true;
        city: true;
        isVerified: true;
      };
    };
  };
}>;

/** Public merchandising badge only — never Booked/Sold for guests. */
export function getPublicDisplayBadge(
  listing: Pick<Listing, 'inventoryStage' | 'sellerType'>,
): string | null {
  const stage =
    listing.inventoryStage ?? resolveDefaultInventoryStage(listing.sellerType);
  return inventoryStagePublicLabel(stage);
}

export function toPublicPricing(
  pricing: ListingPricing | null,
  frozenRate?: number | null,
) {
  if (!pricing) return null;

  const {
    commissionUsd: _commissionUsd,
    sellerDesiredPayoutUsd: _sellerDesiredPayoutUsd,
    commissionRwf: _commissionRwf,
    sellerDesiredPayoutRwf: _sellerDesiredPayoutRwf,
    ...publicPricing
  } = pricing;

  const finalPriceRwf =
    pricing.finalPriceRwf ??
    pricing.displayPriceRwf ??
    toDisplayRwf({
      currency: pricing.currency,
      amountRwf: pricing.finalPriceRwf,
      amountUsd: pricing.finalPriceUsd,
      frozenRate,
    });

  return {
    ...publicPricing,
    currency: pricing.currency === 'RWF' ? 'RWF' : pricing.currency,
    finalPriceRwf,
    displayPriceRwf: pricing.displayPriceRwf ?? finalPriceRwf,
  };
}

export function toPublicListing<T extends ListingWithRelations>(
  listing: T,
  promotionDisplay?: PromotionPriceDisplay | null,
  frozenRate?: number | null,
) {
  const {
    adminNotes: _adminNotes,
    listingPricing,
    verificationReport: _verificationReport,
    isBooked: _isBooked,
    ...rest
  } = listing as T & {
    adminNotes?: string | null;
    verificationReport?: { riskNotes?: string | null } | null;
    isBooked?: boolean;
  };

  const convertedPromotion =
    promotionDisplay && frozenRate
      ? {
          ...promotionDisplay,
          displayPriceRwf: usdtToRwfAmount(
            promotionDisplay.displayPriceUsd,
            frozenRate,
          ),
          savingRwf: usdtToRwfAmount(promotionDisplay.savingUsd, frozenRate),
        }
      : promotionDisplay;

  return {
    ...rest,
    isBooked: false,
    videoUrl: rest.videoUrl
      ? toAbsoluteUploadUrl(rest.videoUrl as string)
      : rest.videoUrl,
    brochureUrl: rest.brochureUrl
      ? toAbsoluteUploadUrl(rest.brochureUrl as string)
      : rest.brochureUrl,
    photos: listing.photos.map((photo) => ({
      ...photo,
      url: toAbsoluteUploadUrl(photo.url),
    })),
    listingPricing: toPublicPricing(listingPricing, frozenRate),
    displayBadge: getPublicDisplayBadge(listing),
    inventoryStageLabel: getPublicDisplayBadge(listing),
    ...(convertedPromotion ? { promotionDisplay: convertedPromotion } : {}),
  };
}

/** Seller's own listings — full pricing breakdown and EV specs. */
export function toSellerListing<T extends ListingWithRelations>(listing: T) {
  const base = toPublicListing(listing);
  const adminNotes = (listing as Listing & { adminNotes?: string | null })
    .adminNotes;

  return {
    ...base,
    listingPricing: listing.listingPricing,
    evSpecs: listing.evSpecs ?? null,
    ...(listing.status === ListingStatus.REJECTED && adminNotes
      ? { rejectionReason: adminNotes }
      : {}),
  };
}

export function toAdminListing<T extends Listing & Record<string, unknown>>(
  listing: T,
) {
  return listing;
}
