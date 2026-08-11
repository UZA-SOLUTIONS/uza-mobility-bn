import { BadRequestException } from '@nestjs/common';
import { ListingInventoryStage, SellerType } from '@prisma/client';

export const INVENTORY_STAGE_LABELS: Record<ListingInventoryStage, string> = {
  CHINA_UNPAID: 'China',
  IN_TRANSIT: 'In transit',
  AT_PORT: 'At port',
  KIGALI_STOCK: 'Kigali stock',
};

export function inventoryStagePublicLabel(
  stage: ListingInventoryStage,
): string {
  return INVENTORY_STAGE_LABELS[stage];
}

export function resolveDefaultInventoryStage(
  sellerType: SellerType,
): ListingInventoryStage {
  if (sellerType === SellerType.UZA_RWANDA_STOCK) {
    return ListingInventoryStage.KIGALI_STOCK;
  }
  if (sellerType === SellerType.UZA_CHINA_SOURCING) {
    return ListingInventoryStage.CHINA_UNPAID;
  }
  if (sellerType === SellerType.LOCAL_SELLER) {
    return ListingInventoryStage.KIGALI_STOCK;
  }
  return ListingInventoryStage.CHINA_UNPAID;
}

const STAGE_ORDER: ListingInventoryStage[] = [
  ListingInventoryStage.CHINA_UNPAID,
  ListingInventoryStage.IN_TRANSIT,
  ListingInventoryStage.AT_PORT,
  ListingInventoryStage.KIGALI_STOCK,
];

export function assertInventoryStageTransition(
  from: ListingInventoryStage,
  to: ListingInventoryStage,
) {
  if (from === to) {
    throw new BadRequestException('Listing is already at this inventory stage');
  }
  const fromIndex = STAGE_ORDER.indexOf(from);
  const toIndex = STAGE_ORDER.indexOf(to);
  if (fromIndex < 0 || toIndex < 0 || Math.abs(toIndex - fromIndex) !== 1) {
    throw new BadRequestException(
      `Cannot move inventory from ${from} to ${to}. Move one stage at a time.`,
    );
  }
}

export function previousInventoryStage(
  stage: ListingInventoryStage,
): ListingInventoryStage | null {
  const index = STAGE_ORDER.indexOf(stage);
  if (index <= 0) return null;
  return STAGE_ORDER[index - 1] ?? null;
}

export function nextInventoryStage(
  stage: ListingInventoryStage,
): ListingInventoryStage | null {
  const index = STAGE_ORDER.indexOf(stage);
  if (index < 0 || index >= STAGE_ORDER.length - 1) return null;
  return STAGE_ORDER[index + 1] ?? null;
}
