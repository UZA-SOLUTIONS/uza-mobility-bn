import { Listing, ListingPricing, ListingStatus, Prisma } from '@prisma/client';

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

export function getPublicDisplayBadge(status: ListingStatus): string | null {
  switch (status) {
    case ListingStatus.SOLD:
      return 'Sold';
    case ListingStatus.RESERVED:
      return 'Reserved - Pending Payment';
    default:
      return null;
  }
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

export function toPublicListing<T extends ListingWithRelations>(listing: T) {
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
    listingPricing: toPublicPricing(listingPricing),
    displayBadge: getPublicDisplayBadge(rest.status),
  };
}

/** Seller's own listings — includes rejection notes when rejected. */
export function toSellerListing<T extends ListingWithRelations>(listing: T) {
  const base = toPublicListing(listing);
  const adminNotes = (listing as Listing & { adminNotes?: string | null })
    .adminNotes;

  if (listing.status === ListingStatus.REJECTED && adminNotes) {
    return {
      ...base,
      rejectionReason: adminNotes,
    };
  }

  return base;
}

export function toAdminListing<T extends Listing & Record<string, unknown>>(
  listing: T,
) {
  return listing;
}
