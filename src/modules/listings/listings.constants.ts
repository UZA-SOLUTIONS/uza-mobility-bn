import { ListingStatus, Prisma, SellerType } from '@prisma/client';

/** Detail page by slug — includes sold vehicles (direct links show sold state). */
export const PUBLIC_MARKETPLACE_STATUSES: ListingStatus[] = [
  ListingStatus.PUBLISHED,
  ListingStatus.RESERVED,
  ListingStatus.SOLD,
];

/** Marketplace browse/search — available inventory only (sold hidden). */
export const PUBLIC_BROWSE_STATUSES: ListingStatus[] = [
  ListingStatus.PUBLISHED,
  ListingStatus.RESERVED,
];

/** Homepage curated sections — active inventory only (not sold). */
export const PUBLIC_CURATED_STATUSES: ListingStatus[] = [
  ListingStatus.PUBLISHED,
  ListingStatus.RESERVED,
];

export const ADMIN_ONLY_SELLER_TYPES: SellerType[] = [
  SellerType.UZA_RWANDA_STOCK,
  SellerType.UZA_CHINA_SOURCING,
];

export const publicListingInclude = {
  category: { select: { id: true, name: true, slug: true, type: true } },
  subcategory: { select: { id: true, name: true, slug: true } },
  evSpecs: true,
  listingPricing: true,
  photos: { orderBy: { displayOrder: 'asc' as const } },
  useCaseTags: true,
  seller: {
    select: {
      businessName: true,
      country: true,
      city: true,
      isVerified: true,
    },
  },
} satisfies Prisma.ListingInclude;

export const adminListingInclude = {
  ...publicListingInclude,
  seller: {
    select: {
      id: true,
      businessName: true,
      country: true,
      city: true,
      isVerified: true,
      userId: true,
    },
  },
  verificationReport: true,
  createdBy: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
    },
  },
} satisfies Prisma.ListingInclude;
