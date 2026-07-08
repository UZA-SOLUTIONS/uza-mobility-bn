import { Injectable } from '@nestjs/common';
import { InvoiceStatus, PaymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { FilterDiscountSalesDto } from './dto/filter-discount-sales.dto';

export type DiscountSaleRow = {
  invoiceId: string;
  invoiceNumber: string;
  soldAt: string | null;
  buyerName: string;
  buyerEmail: string | null;
  vehicleBrand: string | null;
  vehicleModel: string | null;
  vehicleYear: number | null;
  sellerType: string | null;
  listPriceUsd: number;
  ruleDiscountUsd: number;
  listingDiscountUsd: number;
  totalDiscountUsd: number;
  amountPaidUsd: number;
};

export type DiscountSalesSummary = {
  saleCount: number;
  totalRuleDiscountUsd: number;
  totalListingDiscountUsd: number;
  totalDiscountUsd: number;
  totalRevenueUsd: number;
};

const discountSalesInvoiceSelect = {
  id: true,
  invoiceNumber: true,
  issuedAt: true,
  buyerName: true,
  buyerEmail: true,
  vehicleBrand: true,
  vehicleModel: true,
  vehicleYear: true,
  sellerType: true,
  totalAmountUsd: true,
  ruleDiscountUsd: true,
  discountUsd: true,
  basePriceUsd: true,
  fobPriceUsd: true,
  marginUsd: true,
  landingCostUsd: true,
  payments: {
    where: { status: PaymentStatus.CONFIRMED },
    orderBy: { verifiedAt: 'desc' as const },
    take: 1,
    select: { verifiedAt: true },
  },
} satisfies Prisma.InvoiceSelect;

type DiscountSalesInvoiceRecord = Prisma.InvoiceGetPayload<{
  select: typeof discountSalesInvoiceSelect;
}>;

@Injectable()
export class DiscountSalesService {
  constructor(private readonly prisma: PrismaService) {}

  private verifiedAtRange(
    filters: FilterDiscountSalesDto,
  ): Prisma.DateTimeFilter | undefined {
    const verifiedAt: Prisma.DateTimeFilter = {};
    if (filters.from) {
      verifiedAt.gte = new Date(`${filters.from}T00:00:00.000Z`);
    }
    if (filters.to) {
      verifiedAt.lte = new Date(`${filters.to}T23:59:59.999Z`);
    }
    return Object.keys(verifiedAt).length > 0 ? verifiedAt : undefined;
  }

  private buildWhere(
    filters: FilterDiscountSalesDto,
  ): Prisma.InvoiceWhereInput {
    const verifiedAt = this.verifiedAtRange(filters);

    return {
      status: InvoiceStatus.PAYMENT_CONFIRMED,
      OR: [{ ruleDiscountUsd: { gt: 0 } }, { discountUsd: { gt: 0 } }],
      payments: {
        some: {
          status: PaymentStatus.CONFIRMED,
          ...(verifiedAt ? { verifiedAt } : {}),
        },
      },
    };
  }

  private toRow(invoice: DiscountSalesInvoiceRecord): DiscountSaleRow {
    const ruleDiscountUsd = invoice.ruleDiscountUsd ?? 0;
    const listingDiscountUsd = invoice.discountUsd ?? 0;
    const listBeforeDiscount =
      invoice.totalAmountUsd + ruleDiscountUsd + listingDiscountUsd;
    const soldAt =
      invoice.payments[0]?.verifiedAt?.toISOString() ??
      invoice.issuedAt?.toISOString() ??
      null;

    return {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      soldAt,
      buyerName: invoice.buyerName,
      buyerEmail: invoice.buyerEmail,
      vehicleBrand: invoice.vehicleBrand,
      vehicleModel: invoice.vehicleModel,
      vehicleYear: invoice.vehicleYear,
      sellerType: invoice.sellerType,
      listPriceUsd: listBeforeDiscount,
      ruleDiscountUsd,
      listingDiscountUsd,
      totalDiscountUsd: ruleDiscountUsd + listingDiscountUsd,
      amountPaidUsd: invoice.totalAmountUsd,
    };
  }

  async findAll(filters: FilterDiscountSalesDto) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 25;
    const skip = (page - 1) * limit;
    const where = this.buildWhere(filters);

    const [rows, total, aggregates] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        skip,
        take: limit,
        orderBy: { issuedAt: 'desc' },
        select: discountSalesInvoiceSelect,
      }),
      this.prisma.invoice.count({ where }),
      this.prisma.invoice.aggregate({
        where,
        _count: { _all: true },
        _sum: {
          totalAmountUsd: true,
          ruleDiscountUsd: true,
          discountUsd: true,
        },
      }),
    ]);

    const summary: DiscountSalesSummary = {
      saleCount: aggregates._count._all,
      totalRuleDiscountUsd: aggregates._sum.ruleDiscountUsd ?? 0,
      totalListingDiscountUsd: aggregates._sum.discountUsd ?? 0,
      totalDiscountUsd:
        (aggregates._sum.ruleDiscountUsd ?? 0) +
        (aggregates._sum.discountUsd ?? 0),
      totalRevenueUsd: aggregates._sum.totalAmountUsd ?? 0,
    };

    return {
      items: rows.map((row) => this.toRow(row)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
        summary,
      },
    };
  }

  async findAllForExport(filters: FilterDiscountSalesDto) {
    const where = this.buildWhere(filters);
    const rows = await this.prisma.invoice.findMany({
      where,
      orderBy: { issuedAt: 'desc' },
      select: discountSalesInvoiceSelect,
    });

    const items = rows.map((row) => this.toRow(row));
    const summary: DiscountSalesSummary = {
      saleCount: items.length,
      totalRuleDiscountUsd: items.reduce(
        (sum, row) => sum + row.ruleDiscountUsd,
        0,
      ),
      totalListingDiscountUsd: items.reduce(
        (sum, row) => sum + row.listingDiscountUsd,
        0,
      ),
      totalDiscountUsd: items.reduce(
        (sum, row) => sum + row.totalDiscountUsd,
        0,
      ),
      totalRevenueUsd: items.reduce((sum, row) => sum + row.amountPaidUsd, 0),
    };

    return { items, summary };
  }
}
