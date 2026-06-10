import type { Inquiry, Listing, Prisma } from '@prisma/client';

type InquiryWithListing = Inquiry & {
  listing?: Pick<
    Listing,
    'id' | 'slug' | 'listingTitle' | 'brand' | 'model' | 'manufacturingYear'
  > | null;
};

export function toBuyerInquiry(row: InquiryWithListing) {
  const { internalNotes: _internalNotes, ...rest } = row;
  return {
    ...rest,
    listing: row.listing
      ? {
          id: row.listing.id,
          slug: row.listing.slug,
          listingTitle: row.listing.listingTitle,
          brand: row.listing.brand,
          model: row.listing.model,
          manufacturingYear: row.listing.manufacturingYear,
        }
      : null,
  };
}

export function toAdminInquiry(row: InquiryWithListing) {
  return row;
}

export type InquiryListingContext = Prisma.ListingGetPayload<{
  include: {
    listingPricing: true;
    evSpecs: true;
    seller: { select: { businessName: true; city: true; country: true } };
  };
}>;
