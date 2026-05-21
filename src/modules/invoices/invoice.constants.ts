import { InvoiceStatus } from '@prisma/client';

/** Invoice still holding a listing reservation. */
export const ACTIVE_INVOICE_STATUSES: InvoiceStatus[] = [
  InvoiceStatus.SENT,
  InvoiceStatus.AWAITING_PAYMENT,
  InvoiceStatus.PAYMENT_SUBMITTED,
  InvoiceStatus.UNDER_VERIFICATION,
  InvoiceStatus.PARTIALLY_PAID,
];

export const INVOICE_VALIDITY_DAYS = 7;
