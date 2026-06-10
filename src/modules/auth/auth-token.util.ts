import { createHash, randomBytes } from 'node:crypto';

export function generateRawToken(): string {
  return randomBytes(32).toString('hex');
}

export function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

const DURATION_MULTIPLIERS: Record<string, number> = {
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

export function parseDurationToMs(
  duration: string | undefined,
  fallbackMs: number,
): number {
  if (!duration?.trim()) {
    return fallbackMs;
  }

  const match = /^(\d+)([smhd])$/.exec(duration.trim());
  if (!match) {
    return fallbackMs;
  }

  const value = Number(match[1]);
  const unit = match[2];
  const multiplier = DURATION_MULTIPLIERS[unit];

  if (!multiplier || !Number.isFinite(value)) {
    return fallbackMs;
  }

  return value * multiplier;
}
