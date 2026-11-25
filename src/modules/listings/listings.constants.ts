import { ListingStatus, Prisma, SellerType } from '@prisma/client';

/** Detail page by slug — includes sold vehicles (direct links show sold state). */
export const PUBLIC_MARKETPLACE_STATUSES: ListingStatus[] = [
  ListingStatus.PUBLISHED,
  ListingStatus.RESERVED,
  ListingStatus.SOLD,
];

/** Marketplace browse/search — published inventory, including sold (sold mark on cards). */
export const PUBLIC_BROWSE_STATUSES: ListingStatus[] = [
  ListingStatus.PUBLISHED,
  ListingStatus.RESERVED,
  ListingStatus.SOLD,
];

/** Homepage curated sections — same inventory as browse, including sold. */
export const PUBLIC_CURATED_STATUSES: ListingStatus[] = [
  ListingStatus.PUBLISHED,
  ListingStatus.RESERVED,
  ListingStatus.SOLD,
];

/** Safety ceiling when `all=true` on public browse (marketplace catalogs stay well under this). */
export const PUBLIC_BROWSE_ALL_MAX = 2000;

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
