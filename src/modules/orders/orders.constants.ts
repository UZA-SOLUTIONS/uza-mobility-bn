import { Prisma } from '@prisma/client';

export const orderDetailInclude = {
  trackingEvents: { orderBy: { occurredAt: 'asc' as const } },
  listing: {
    select: {
      id: true,
      slug: true,
      listingTitle: true,
      brand: true,
      model: true,
      manufacturingYear: true,
    },
  },
  invoice: {
    select: {
      id: true,
      invoiceNumber: true,
      paymentReference: true,
      totalAmountUsd: true,
    },
  },
} satisfies Prisma.OrderInclude;
