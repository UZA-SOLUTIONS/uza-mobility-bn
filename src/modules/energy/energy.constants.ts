export const ENERGY_REQUEST_STATUSES = [
  'SUBMITTED',
  'UNDER_REVIEW',
  'QUOTED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
] as const;

export type EnergyRequestStatus = (typeof ENERGY_REQUEST_STATUSES)[number];
