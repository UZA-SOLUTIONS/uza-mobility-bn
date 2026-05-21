import type { Part, PartPhoto } from '@prisma/client';

type PartWithPhotos = Part & { photos: PartPhoto[] };

export function toPublicPart(part: PartWithPhotos) {
  return {
    ...part,
    stockLabel: part.stockQuantity > 0 ? 'In Stock' : 'Out of Stock',
    photos: part.photos,
  };
}
