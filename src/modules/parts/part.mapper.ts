import { PartStatus, type Part, type PartPhoto } from '@prisma/client';

type PartWithPhotos = Part & { photos: PartPhoto[] };

export function toPublicPart(part: PartWithPhotos) {
  const { adminNotes: _adminNotes, ...rest } = part;
  return {
    ...rest,
    stockLabel: part.stockQuantity > 0 ? 'In Stock' : 'Out of Stock',
    photos: part.photos,
  };
}

export function toSellerPart(part: PartWithPhotos) {
  const base = toPublicPart(part);
  return {
    ...base,
    ...(part.status === PartStatus.REJECTED && part.adminNotes
      ? { rejectionReason: part.adminNotes }
      : {}),
  };
}
