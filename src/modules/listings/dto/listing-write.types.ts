import type { AdminCreateListingDto } from './admin-create-listing.dto';

export type AdminCreateListingPayload = AdminCreateListingDto & {
  photoUrls?: string[];
};
