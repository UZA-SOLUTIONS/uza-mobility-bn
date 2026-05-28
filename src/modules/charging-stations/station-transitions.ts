import { StationStatus } from '@prisma/client';

export const ALLOWED_STATION_TRANSITIONS: Record<
  StationStatus,
  StationStatus[]
> = {
  DRAFT: ['PENDING_REVIEW'],
  PENDING_REVIEW: ['APPROVED', 'REJECTED'],
  APPROVED: ['ACTIVE', 'REJECTED'],
  ACTIVE: ['SUSPENDED', 'CLOSED'],
  SUSPENDED: ['ACTIVE'],
  REJECTED: ['DRAFT', 'PENDING_REVIEW'],
  CLOSED: [],
};

export function canStationTransition(
  from: StationStatus,
  to: StationStatus,
): boolean {
  return ALLOWED_STATION_TRANSITIONS[from]?.includes(to) ?? false;
}
