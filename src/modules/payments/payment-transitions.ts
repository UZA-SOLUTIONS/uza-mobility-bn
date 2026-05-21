import { PaymentStatus } from '@prisma/client';

export const PAYMENT_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  SUBMITTED: ['UNDER_VERIFICATION'],
  UNDER_VERIFICATION: ['CONFIRMED', 'REJECTED'],
  CONFIRMED: ['REFUNDED'],
  REJECTED: [],
  REFUNDED: [],
};

export function canPaymentTransition(
  from: PaymentStatus,
  to: PaymentStatus,
): boolean {
  return PAYMENT_TRANSITIONS[from]?.includes(to) ?? false;
}
