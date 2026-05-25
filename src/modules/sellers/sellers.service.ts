import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, SellerStatus } from '@prisma/client';
import { AuditService } from '../../common/audit/audit.service';
import type { RequestAuditContext } from '../../common/audit/request-context.util';
import { PrismaService } from '../../prisma/prisma.service';
import { FilterSellersDto } from './dto/filter-sellers.dto';
import { SuspendSellerDto } from './dto/suspend-seller.dto';
import {
  assertMarketplaceSellerModeration,
  marketplaceSellerFilter,
  MARKETPLACE_SELLER_TYPES,
} from './seller-profile.util';

const sellerListInclude = {
  user: {
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      isActive: true,
    },
  },
  _count: { select: { listings: true, parts: true } },
} satisfies Prisma.SellerInclude;

@Injectable()
export class SellersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async adminFindAll(filters: FilterSellersDto) {
    const where: Prisma.SellerWhereInput = {};

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.sellerType) {
      where.sellerType = filters.sellerType;
    } else {
      where.sellerType = { in: MARKETPLACE_SELLER_TYPES };
    }

    if (filters.isVerified !== undefined) {
      where.isVerified = filters.isVerified;
    }

    if (filters.q) {
      where.OR = [
        { businessName: { contains: filters.q, mode: 'insensitive' } },
        { email: { contains: filters.q, mode: 'insensitive' } },
        { city: { contains: filters.q, mode: 'insensitive' } },
        { user: { email: { contains: filters.q, mode: 'insensitive' } } },
      ];
    }

    const page = filters.page ?? 1;
    const limit = filters.limit ?? 25;
    const skip = (page - 1) * limit;

    const [rows, total] = await Promise.all([
      this.prisma.seller.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: sellerListInclude,
      }),
      this.prisma.seller.count({ where }),
    ]);

    return {
      items: rows,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async adminFindById(sellerId: string) {
    const seller = await this.prisma.seller.findUnique({
      where: { id: sellerId },
      include: {
        ...sellerListInclude,
        subscription: true,
        listings: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            listingTitle: true,
            slug: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });

    if (!seller) {
      throw new NotFoundException('Seller not found');
    }

    return seller;
  }

  async verifySeller(
    sellerId: string,
    adminUserId: string,
    auditContext: RequestAuditContext = {},
  ) {
    const seller = await this.getSellerOrThrow(sellerId);
    assertMarketplaceSellerModeration(seller.sellerType);

    if (seller.status === SellerStatus.SUSPENDED) {
      throw new BadRequestException(
        'Cannot verify a suspended seller — reactivate first',
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.seller.update({
        where: { id: sellerId },
        data: {
          status: SellerStatus.ACTIVE,
          isVerified: true,
          verifiedAt: new Date(),
        },
        include: sellerListInclude,
      });

      const hasSellerRole = await tx.userRole.findFirst({
        where: {
          userId: seller.userId,
          role: { name: 'SELLER' },
        },
      });

      if (!hasSellerRole) {
        const sellerRole = await tx.role.findUnique({
          where: { name: 'SELLER' },
        });

        if (sellerRole) {
          await tx.userRole.create({
            data: { userId: seller.userId, roleId: sellerRole.id },
          });
        }
      }

      return row;
    });

    await this.auditService.record({
      userId: adminUserId,
      action: 'sellers:verified',
      entity: 'Seller',
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
      metadata: {
        email: auditContext.actorEmail,
        sellerId,
        businessName: seller.businessName,
      },
    });

    return updated;
  }

  async suspendSeller(
    sellerId: string,
    adminUserId: string,
    dto: SuspendSellerDto = {},
    auditContext: RequestAuditContext = {},
  ) {
    const seller = await this.getSellerOrThrow(sellerId);
    assertMarketplaceSellerModeration(seller.sellerType);

    if (seller.status === SellerStatus.SUSPENDED) {
      throw new BadRequestException('Seller is already suspended');
    }

    const updated = await this.prisma.seller.update({
      where: { id: sellerId },
      data: {
        status: SellerStatus.SUSPENDED,
        isVerified: false,
      },
      include: sellerListInclude,
    });

    await this.auditService.record({
      userId: adminUserId,
      action: 'sellers:suspended',
      entity: 'Seller',
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
      metadata: {
        email: auditContext.actorEmail,
        sellerId,
        businessName: seller.businessName,
        reason: dto.reason,
      },
    });

    return updated;
  }

  async reactivateSeller(
    sellerId: string,
    adminUserId: string,
    auditContext: RequestAuditContext = {},
  ) {
    const seller = await this.getSellerOrThrow(sellerId);
    assertMarketplaceSellerModeration(seller.sellerType);

    if (seller.status !== SellerStatus.SUSPENDED) {
      throw new BadRequestException(
        'Only suspended sellers can be reactivated',
      );
    }

    const updated = await this.prisma.seller.update({
      where: { id: sellerId },
      data: {
        status: SellerStatus.ACTIVE,
        isVerified: seller.isVerified,
      },
      include: sellerListInclude,
    });

    await this.auditService.record({
      userId: adminUserId,
      action: 'sellers:reactivated',
      entity: 'Seller',
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
      metadata: {
        email: auditContext.actorEmail,
        sellerId,
        businessName: seller.businessName,
      },
    });

    return updated;
  }

  /** Used by listings/parts before seller mutations. */
  async assertSellerCanTrade(userId: string) {
    const seller = await this.prisma.seller.findFirst({
      where: marketplaceSellerFilter(userId),
    });

    if (!seller) {
      throw new NotFoundException('Seller profile not found');
    }

    if (seller.status === SellerStatus.SUSPENDED) {
      throw new BadRequestException(
        'Your seller account is suspended. Contact UZA support.',
      );
    }

    if (seller.status !== SellerStatus.ACTIVE || !seller.isVerified) {
      throw new BadRequestException(
        'Your seller account must be verified before you can manage listings',
      );
    }

    return seller;
  }

  private async getSellerOrThrow(sellerId: string) {
    const seller = await this.prisma.seller.findUnique({
      where: { id: sellerId },
    });

    if (!seller) {
      throw new NotFoundException('Seller not found');
    }

    return seller;
  }
}
