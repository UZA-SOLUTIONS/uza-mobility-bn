import type { AdminCreateListingDto } from './admin-create-listing.dto';
import type { AdminUpdateListingDto } from './admin-update-listing.dto';

export type AdminCreateListingPayload = AdminCreateListingDto & {
  photoUrls?: string[];
};

export type AdminUpdateListingPayload = AdminUpdateListingDto & {
  photoUrls?: string[];
};
