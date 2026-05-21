import type { PrismaService } from '../../prisma/prisma.service';

type SerialField = 'invoiceNumber' | 'paymentReference' | 'orderNumber';

const FIELD_BY_PREFIX: Record<string, SerialField> = {
  'UZM-INV': 'invoiceNumber',
  'UZM-PAY': 'paymentReference',
  'UZM-ORD': 'orderNumber',
};

export async function generateReferenceNumber(
  prisma: PrismaService,
  prefix: 'UZM-INV' | 'UZM-PAY' | 'UZM-ORD',
): Promise<string> {
  const year = new Date().getFullYear();
  const base = `${prefix}-${year}-`;
  const field = FIELD_BY_PREFIX[prefix];

  const latest =
    prefix === 'UZM-INV'
      ? await prisma.invoice.findFirst({
          where: { invoiceNumber: { startsWith: base } },
          orderBy: { invoiceNumber: 'desc' },
          select: { invoiceNumber: true },
        })
      : prefix === 'UZM-PAY'
        ? await prisma.invoice.findFirst({
            where: { paymentReference: { startsWith: base } },
            orderBy: { paymentReference: 'desc' },
            select: { paymentReference: true },
          })
        : await prisma.order.findFirst({
            where: { orderNumber: { startsWith: base } },
            orderBy: { orderNumber: 'desc' },
            select: { orderNumber: true },
          });

  const lastValue = latest
    ? ((latest as Record<string, string>)[field] as string)
    : null;
  const lastSeq = lastValue
    ? Number.parseInt(lastValue.slice(base.length), 10)
    : 0;
  const next = Number.isFinite(lastSeq) ? lastSeq + 1 : 1;

  return `${base}${String(next).padStart(6, '0')}`;
}
