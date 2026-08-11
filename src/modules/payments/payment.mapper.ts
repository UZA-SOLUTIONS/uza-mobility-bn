import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export const adminPaymentInvoiceSelect = {
  invoiceNumber: true,
  paymentReference: true,
  totalAmountUsd: true,
  status: true,
  buyerName: true,
  buyerEmail: true,
} satisfies Prisma.InvoiceSelect;

export type PaymentAdminRecord = Prisma.PaymentGetPayload<{
  include: {
    invoice: { select: typeof adminPaymentInvoiceSelect };
    proofs: true;
  };
}>;

export type AdminPaymentResponse = {
  id: string;
  invoiceId: string;
  amountPaid: number;
  currency: string;
  exchangeRateUsed: number | null;
  bankName: string | null;
  transferReference: string | null;
  paymentDate: Date | null;
  senderName: string | null;
  notes: string | null;
  status: PaymentAdminRecord['status'];
  verifiedBy: string | null;
  verifiedByName: string | null;
  verifiedAt: Date | null;
  rejectionReason: string | null;
  bankStatementRef: string | null;
  createdAt: Date;
  updatedAt: Date;
  invoice: {
    invoiceNumber: string;
    paymentReference: string;
    totalAmountUsd: number;
    status: PaymentAdminRecord['invoice']['status'];
    buyerName: string;
    buyerEmail: string | null;
  };
  proofs: PaymentAdminRecord['proofs'];
};

function formatUserName(user: {
  firstName: string;
  lastName: string;
  email: string;
}): string {
  const name = `${user.firstName} ${user.lastName}`.trim();
  return name || user.email;
}

export async function mapAdminPayments(
  prisma: PrismaService,
  payments: PaymentAdminRecord[],
): Promise<AdminPaymentResponse[]> {
  const verifierIds = [
    ...new Set(
      payments
        .map((payment) => payment.verifiedBy)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const verifiers =
    verifierIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: verifierIds } },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        })
      : [];

  const verifierNames = new Map(
    verifiers.map((user) => [user.id, formatUserName(user)]),
  );

  return payments.map((payment) => ({
    id: payment.id,
    invoiceId: payment.invoiceId,
    amountPaid: payment.amountPaid,
    currency: payment.currency,
    exchangeRateUsed: payment.exchangeRateUsed,
    bankName: payment.bankName,
    transferReference: payment.transferReference,
    paymentDate: payment.paymentDate,
    senderName: payment.senderName,
    notes: payment.notes,
    status: payment.status,
    verifiedBy: payment.verifiedBy,
    verifiedByName: payment.verifiedBy
      ? (verifierNames.get(payment.verifiedBy) ?? null)
      : null,
    verifiedAt: payment.verifiedAt,
    rejectionReason: payment.rejectionReason,
    bankStatementRef: payment.bankStatementRef,
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt,
    invoice: {
      invoiceNumber: payment.invoice.invoiceNumber,
      paymentReference: payment.invoice.paymentReference,
      totalAmountUsd: payment.invoice.totalAmountUsd,
      status: payment.invoice.status,
      buyerName: payment.invoice.buyerName,
      buyerEmail: payment.invoice.buyerEmail,
    },
    proofs: payment.proofs,
  }));
}
