import type { Request } from 'express';
import type {
  BuyerProfile,
  OperatorProfile,
  Seller,
  User,
} from '@prisma/client';

export type SafeUser = Omit<User, 'passwordHash'> & {
  roles: string[];
};

/** Profile payload from GET /auth/me (permissions added in AuthService). */
export type MeOperatorSummary = Pick<
  OperatorProfile,
  'id' | 'status' | 'businessName' | 'isVerified'
>;

export type MeUserProfile = SafeUser & {
  buyerProfile: BuyerProfile | null;
  /** All seller profiles (one per inventory channel). */
  sellers: Seller[];
  /** Primary profile for account UI (marketplace seller if any, else first). */
  seller: Seller | null;
  /** Charging operator application / approved profile, if any. */
  operator: MeOperatorSummary | null;
};

export type MeSession = MeUserProfile & {
  permissions: string[];
};

export interface JwtUserPayload {
  sub: string;
  email: string;
  roles: string[];
  permissions: string[];
  tokenType: 'access' | 'refresh';
  iat: number;
  exp: number;
}

export interface AuthenticatedRequest extends Request {
  user?: JwtUserPayload;
}
