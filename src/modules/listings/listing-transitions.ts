import { ListingStatus } from '@prisma/client';

export const ALLOWED_TRANSITIONS: Record<ListingStatus, ListingStatus[]> = {
  DRAFT: ['PENDING_REVIEW'],
  PENDING_REVIEW: ['APPROVED', 'REJECTED'],
  APPROVED: ['PUBLISHED', 'REJECTED'],
  PUBLISHED: ['RESERVED', 'SOLD', 'SUSPENDED', 'EXPIRED', 'ARCHIVED'],
  RESERVED: ['PUBLISHED', 'SOLD'],
  REJECTED: ['DRAFT'],
  SUSPENDED: ['PUBLISHED'],
  SOLD: ['ARCHIVED'],
  EXPIRED: ['DRAFT'],
  ARCHIVED: [],
};

export function canTransition(from: ListingStatus, to: ListingStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertTransition(from: ListingStatus, to: ListingStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`Cannot transition listing from ${from} to ${to}`);
  }
}
