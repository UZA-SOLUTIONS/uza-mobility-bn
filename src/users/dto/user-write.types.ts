import type { UpdateUserDto } from './update-user.dto';
import type { CreateSellerProfileDto } from './create-seller-profile.dto';

export type UpdateUserPayload = UpdateUserDto & {
  profilePhoto?: string | null;
};

export type UpdateSellerProfilePayload = Partial<CreateSellerProfileDto>;
