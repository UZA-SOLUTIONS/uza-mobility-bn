import { FleetRequestStatus } from '@prisma/client';

export const FLEET_TRANSITIONS: Record<
  FleetRequestStatus,
  FleetRequestStatus[]
> = {
  SUBMITTED: ['UNDER_REVIEW', 'CANCELLED'],
  UNDER_REVIEW: ['QUOTED', 'CANCELLED'],
  QUOTED: ['APPROVED', 'CANCELLED'],
  APPROVED: ['IN_PROGRESS'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

export function canFleetTransition(
  from: FleetRequestStatus,
  to: FleetRequestStatus,
): boolean {
  return FLEET_TRANSITIONS[from]?.includes(to) ?? false;
}
