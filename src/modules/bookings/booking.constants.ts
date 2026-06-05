export const BOOKING_VALIDITY_DAYS = 5;

/** Admin may adjust fee on bookings still awaiting payment proof. */
export const ADMIN_EDITABLE_BOOKING_FEE_STATUSES = [
  'AWAITING_PAYMENT',
] as const;

/** Booking is holding the vehicle once confirmed. */
export const ACTIVE_BOOKING_STATUSES = [
  'AWAITING_PAYMENT',
  'PAYMENT_SUBMITTED',
  'UNDER_VERIFICATION',
  'CONFIRMED',
] as const;

export const BOOKING_PAYABLE_STATUSES = ['AWAITING_PAYMENT'] as const;

/** Buyer may cancel before booking fee payment proof is submitted. */
export const BUYER_CANCELLABLE_BOOKING_STATUSES = ['AWAITING_PAYMENT'] as const;

/** Hidden from buyer lists unless a specific status filter is used. */
export const INACTIVE_BOOKING_STATUSES = [
  'CANCELLED',
  'REJECTED',
  'EXPIRED',
] as const;

export const BOOKING_VERIFY_STATUSES = [
  'PAYMENT_SUBMITTED',
  'UNDER_VERIFICATION',
] as const;
