import type { AdminCreateListingDto } from './admin-create-listing.dto';
import type { AdminUpdateListingDto } from './admin-update-listing.dto';
import type { UpdateListingDto } from './update-listing.dto';

/** Set by multipart upload handlers after brochure file is stored. */
export type ListingBrochureFields = {
  brochureUrl?: string | null;
};

export type AdminCreateListingPayload = AdminCreateListingDto & {
  photoUrls?: string[];
} & ListingBrochureFields;

export type AdminUpdateListingPayload = AdminUpdateListingDto & {
  photoUrls?: string[];
} & ListingBrochureFields;

export type ListingUpdateFields = UpdateListingDto & ListingBrochureFields;
