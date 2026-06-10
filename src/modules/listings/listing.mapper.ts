import { Listing, ListingPricing, ListingStatus, Prisma } from '@prisma/client';
import { toAbsoluteUploadUrl } from '../../common/uploads/storage.paths';
import type { PromotionPriceDisplay } from '../promotions/promotion-display.util';

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

export function getPublicDisplayBadge(
  status: ListingStatus,
  isBooked?: boolean,
): string | null {
  if (isBooked) {
    return 'Booked';
  }
  if (status === ListingStatus.SOLD) {
    return 'Sold';
  }
  return null;
}

export function toPublicPricing(pricing: ListingPricing | null) {
  if (!pricing) return null;

  const {
    commissionUsd: _commissionUsd,
    sellerDesiredPayoutUsd: _sellerDesiredPayoutUsd,
    ...publicPricing
  } = pricing;

  return publicPricing;
}

export function toPublicListing<T extends ListingWithRelations>(
  listing: T,
  promotionDisplay?: PromotionPriceDisplay | null,
) {
  const {
    adminNotes: _adminNotes,
    listingPricing,
    verificationReport: _verificationReport,
    ...rest
  } = listing as T & {
    adminNotes?: string | null;
    verificationReport?: { riskNotes?: string | null } | null;
  };

  return {
    ...rest,
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
    listingPricing: toPublicPricing(listingPricing),
    displayBadge: getPublicDisplayBadge(rest.status, rest.isBooked),
    ...(promotionDisplay ? { promotionDisplay } : {}),
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
