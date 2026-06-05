import type { PrismaService } from '../../prisma/prisma.service';

type ReferencePrefix =
  | 'UZM-INV'
  | 'UZM-PAY'
  | 'UZM-ORD'
  | 'UZM-BKG'
  | 'UZM-BKG-PAY';

export async function generateReferenceNumber(
  prisma: PrismaService,
  prefix: ReferencePrefix,
): Promise<string> {
  const year = new Date().getFullYear();
  const base = `${prefix}-${year}-`;

  let lastValue: string | null = null;

  switch (prefix) {
    case 'UZM-INV': {
      const latest = await prisma.invoice.findFirst({
        where: { invoiceNumber: { startsWith: base } },
        orderBy: { invoiceNumber: 'desc' },
        select: { invoiceNumber: true },
      });
      lastValue = latest?.invoiceNumber ?? null;
      break;
    }
    case 'UZM-PAY': {
      const latest = await prisma.invoice.findFirst({
        where: { paymentReference: { startsWith: base } },
        orderBy: { paymentReference: 'desc' },
        select: { paymentReference: true },
      });
      lastValue = latest?.paymentReference ?? null;
      break;
    }
    case 'UZM-ORD': {
      const latest = await prisma.order.findFirst({
        where: { orderNumber: { startsWith: base } },
        orderBy: { orderNumber: 'desc' },
        select: { orderNumber: true },
      });
      lastValue = latest?.orderNumber ?? null;
      break;
    }
    case 'UZM-BKG': {
      const latest = await prisma.vehicleBooking.findFirst({
        where: { bookingNumber: { startsWith: base } },
        orderBy: { bookingNumber: 'desc' },
        select: { bookingNumber: true },
      });
      lastValue = latest?.bookingNumber ?? null;
      break;
    }
    case 'UZM-BKG-PAY': {
      const latest = await prisma.vehicleBooking.findFirst({
        where: { paymentReference: { startsWith: base } },
        orderBy: { paymentReference: 'desc' },
        select: { paymentReference: true },
      });
      lastValue = latest?.paymentReference ?? null;
      break;
    }
  }

  const lastSeq = lastValue
    ? Number.parseInt(lastValue.slice(base.length), 10)
    : 0;
  const next = Number.isFinite(lastSeq) ? lastSeq + 1 : 1;

  return `${base}${String(next).padStart(6, '0')}`;
}
