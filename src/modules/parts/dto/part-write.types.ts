import type { AdminCreatePartDto } from './admin-create-part.dto';
import type { AdminUpdatePartDto } from './admin-update-part.dto';
import type { CreatePartDto } from './create-part.dto';
import type { UpdatePartDto } from './update-part.dto';

export type CreatePartPayload = CreatePartDto & { photoUrls?: string[] };
export type UpdatePartPayload = UpdatePartDto & { photoUrls?: string[] };
export type AdminCreatePartPayload = AdminCreatePartDto & {
  photoUrls?: string[];
};
export type AdminUpdatePartPayload = AdminUpdatePartDto & {
  photoUrls?: string[];
};
