import type { Request } from 'express';
import type { User } from '@prisma/client';

export type SafeUser = Omit<User, 'passwordHash'> & {
  roles: string[];
};

export interface JwtUserPayload {
  sub: string;
  email: string;
  roles: string[];
  tokenType: 'access' | 'refresh';
  iat: number;
  exp: number;
}

export interface AuthenticatedRequest extends Request {
  user?: JwtUserPayload;
}
