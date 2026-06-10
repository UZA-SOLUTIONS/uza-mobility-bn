import { InvoiceStatus, Prisma, VehicleBookingStatus } from '@prisma/client';
import { ACTIVE_BOOKING_STATUSES } from '../bookings/booking.constants';
import { ACTIVE_INVOICE_STATUSES } from '../invoices/invoice.constants';
import { SUPERSEDED_BY_OTHER_BUYER_MESSAGE } from './supersede.constants';

export type SupersededInvoice = {
  id: string;
  userId: string;
  invoiceNumber: string;
};

export type SupersededBooking = {
  id: string;
  userId: string;
  bookingNumber: string;
  listing: { listingTitle: string };
};

export async function supersedeActiveInvoicesForListing(
  tx: Prisma.TransactionClient,
  listingId: string,
  exceptInvoiceId?: string,
): Promise<SupersededInvoice[]> {
  const competitors = await tx.invoice.findMany({
    where: {
      listingId,
      ...(exceptInvoiceId ? { id: { not: exceptInvoiceId } } : {}),
      status: { in: [...ACTIVE_INVOICE_STATUSES] },
    },
    select: { id: true, userId: true, invoiceNumber: true, notes: true },
  });

  for (const invoice of competitors) {
    await tx.invoice.update({
      where: { id: invoice.id },
      data: {
        status: InvoiceStatus.CANCELLED,
        notes: invoice.notes
          ? `${invoice.notes}\n\n${SUPERSEDED_BY_OTHER_BUYER_MESSAGE}`
          : SUPERSEDED_BY_OTHER_BUYER_MESSAGE,
      },
    });
  }

  return competitors.map(({ id, userId, invoiceNumber }) => ({
    id,
    userId,
    invoiceNumber,
  }));
}

export async function supersedeActiveBookingsForListing(
  tx: Prisma.TransactionClient,
  listingId: string,
  exceptBookingId?: string,
): Promise<SupersededBooking[]> {
  const competitors = await tx.vehicleBooking.findMany({
    where: {
      listingId,
      ...(exceptBookingId ? { id: { not: exceptBookingId } } : {}),
      status: { in: [...ACTIVE_BOOKING_STATUSES] },
    },
    select: {
      id: true,
      userId: true,
      bookingNumber: true,
      listing: { select: { listingTitle: true } },
    },
  });

  for (const booking of competitors) {
    await tx.vehicleBooking.update({
      where: { id: booking.id },
      data: {
        status: VehicleBookingStatus.CANCELLED,
        rejectionReason: SUPERSEDED_BY_OTHER_BUYER_MESSAGE,
      },
    });
  }

  return competitors;
}
