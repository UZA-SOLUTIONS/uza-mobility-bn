import { InvoiceStatus } from '@prisma/client';

/** Invoice still holding a listing reservation. */
export const ACTIVE_INVOICE_STATUSES: InvoiceStatus[] = [
  InvoiceStatus.SENT,
  InvoiceStatus.AWAITING_PAYMENT,
  InvoiceStatus.PAYMENT_SUBMITTED,
  InvoiceStatus.UNDER_VERIFICATION,
  InvoiceStatus.PARTIALLY_PAID,
];

/** Buyer can still submit or complete payment against these invoices. */
export const PAYABLE_INVOICE_STATUSES: InvoiceStatus[] = [
  InvoiceStatus.SENT,
  InvoiceStatus.AWAITING_PAYMENT,
  InvoiceStatus.PARTIALLY_PAID,
];

/** Buyer may cancel before any payment proof is submitted. */
export const BUYER_CANCELLABLE_INVOICE_STATUSES: InvoiceStatus[] = [
  InvoiceStatus.SENT,
  InvoiceStatus.AWAITING_PAYMENT,
];

export const INVOICE_VALIDITY_DAYS = 7;

/** Hidden from buyer invoice lists unless a specific status filter is used. */
export const INACTIVE_INVOICE_STATUSES: InvoiceStatus[] = [
  InvoiceStatus.CANCELLED,
  InvoiceStatus.EXPIRED,
];
