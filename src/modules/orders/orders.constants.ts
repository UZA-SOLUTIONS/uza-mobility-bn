import { Prisma } from '@prisma/client';

export const orderDetailInclude = {
  trackingEvents: { orderBy: { occurredAt: 'asc' as const } },
  shipment: true,
  listing: {
    select: {
      id: true,
      slug: true,
      listingTitle: true,
      brand: true,
      model: true,
      manufacturingYear: true,
      inventoryStage: true,
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
  user: {
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
    },
  },
} satisfies Prisma.OrderInclude;
