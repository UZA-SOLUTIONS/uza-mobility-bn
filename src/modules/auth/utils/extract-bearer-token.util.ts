import { UnauthorizedException } from '@nestjs/common';

export function extractBearerToken(
  authHeader: string | undefined,
  label = 'token',
): string {
  if (!authHeader?.trim()) {
    throw new UnauthorizedException(
      `No ${label} provided in Authorization header`,
    );
  }

  return authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : authHeader.trim();
}
