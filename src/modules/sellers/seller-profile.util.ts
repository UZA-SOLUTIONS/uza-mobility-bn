import { BadRequestException } from '@nestjs/common';
import { Prisma, Seller, SellerType } from '@prisma/client';

/** Dealers / external sellers — not UZA platform inventory channels. */
export const MARKETPLACE_SELLER_TYPES: SellerType[] = [
  SellerType.LOCAL_SELLER,
  SellerType.INTERNATIONAL_SELLER,
];

export function isMarketplaceSellerType(sellerType: SellerType): boolean {
  return MARKETPLACE_SELLER_TYPES.includes(sellerType);
}

export function assertMarketplaceSellerModeration(
  sellerType: SellerType,
): void {
  if (!isMarketplaceSellerType(sellerType)) {
    throw new BadRequestException(
      'Platform inventory profiles cannot be verified or suspended from Sellers admin',
    );
  }
}

export function marketplaceSellerFilter(
  userId: string,
): Prisma.SellerWhereInput {
  return {
    userId,
    sellerType: { in: MARKETPLACE_SELLER_TYPES },
  };
}

export function sellerChannelKey(userId: string, sellerType: SellerType) {
  return { userId_sellerType: { userId, sellerType } };
}

/** Primary profile for /auth/me and dealer account settings. */
export function pickPrimaryMeSeller(sellers: Seller[]): Seller | null {
  const marketplace = sellers.find((s) =>
    isMarketplaceSellerType(s.sellerType),
  );
  return marketplace ?? sellers[0] ?? null;
}
