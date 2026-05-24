import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { resolveUniqueSlug } from '../../common/utils/slug.util';
import { PrismaService } from '../../prisma/prisma.service';
import { SellersService } from '../sellers/sellers.service';
import { CreatePartDto } from './dto/create-part.dto';
import { FilterPartsDto } from './dto/filter-parts.dto';
import { UpdatePartDto } from './dto/update-part.dto';
import { toPublicPart } from './part.mapper';

@Injectable()
export class PartsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sellersService: SellersService,
  ) {}

  async browse(filters: FilterPartsDto) {
    const where = this.buildWhere(filters, true);
    return this.findPaginated(where, filters);
  }

  async findById(id: string) {
    const part = await this.prisma.part.findFirst({
      where: { id, isActive: true },
      include: {
        photos: true,
        seller: { select: { businessName: true, city: true } },
      },
    });

    if (!part) {
      throw new NotFoundException('Part not found');
    }

    return toPublicPart(part);
  }

  async createForSeller(userId: string, dto: CreatePartDto) {
    const seller = await this.sellersService.assertSellerCanTrade(userId);
    const slug = await resolveUniqueSlug(dto.name, (candidate) =>
      this.prisma.part
        .findUnique({ where: { slug: candidate } })
        .then((row) => row !== null),
    );

    const part = await this.prisma.part.create({
      data: {
        sellerId: seller.id,
        name: dto.name,
        slug,
        categorySlug: dto.categorySlug,
        compatibleBrands: dto.compatibleBrands ?? [],
        compatibleModels: dto.compatibleModels ?? [],
        condition: dto.condition,
        priceUsd: dto.priceUsd,
        stockQuantity: dto.stockQuantity,
        deliveryEstimate: dto.deliveryEstimate,
        hasWarranty: dto.hasWarranty ?? false,
        warrantyDetails: dto.warrantyDetails,
        description: dto.description,
        isActive: true,
        photos: dto.photoUrls?.length
          ? {
              create: dto.photoUrls.map((url, index) => ({
                url,
                isPrimary: index === 0,
              })),
            }
          : undefined,
      },
      include: { photos: true },
    });

    return toPublicPart(part);
  }

  async updateOwn(userId: string, partId: string, dto: UpdatePartDto) {
    await this.sellersService.assertSellerCanTrade(userId);
    const part = await this.getOwnedPart(userId, partId);

    const updated = await this.prisma.part.update({
      where: { id: part.id },
      data: {
        name: dto.name,
        categorySlug: dto.categorySlug,
        compatibleBrands: dto.compatibleBrands,
        compatibleModels: dto.compatibleModels,
        condition: dto.condition,
        priceUsd: dto.priceUsd,
        stockQuantity: dto.stockQuantity,
        deliveryEstimate: dto.deliveryEstimate,
        hasWarranty: dto.hasWarranty,
        warrantyDetails: dto.warrantyDetails,
        description: dto.description,
      },
      include: { photos: true },
    });

    return toPublicPart(updated);
  }

  async deleteOwn(userId: string, partId: string) {
    await this.sellersService.assertSellerCanTrade(userId);
    const part = await this.getOwnedPart(userId, partId);

    await this.prisma.part.update({
      where: { id: part.id },
      data: { isActive: false },
    });
  }

  async adminFindAll(filters: FilterPartsDto) {
    const where = this.buildWhere(filters, false);
    return this.findPaginated(where, filters);
  }

  async adminSetActive(partId: string, isActive: boolean) {
    await this.getPartOrThrow(partId);
    const part = await this.prisma.part.update({
      where: { id: partId },
      data: { isActive },
      include: { photos: true },
    });
    return toPublicPart(part);
  }

  private buildWhere(
    filters: FilterPartsDto,
    publicOnly: boolean,
  ): Prisma.PartWhereInput {
    const where: Prisma.PartWhereInput = publicOnly ? { isActive: true } : {};

    if (filters.q) {
      where.OR = [
        { name: { contains: filters.q, mode: 'insensitive' } },
        { description: { contains: filters.q, mode: 'insensitive' } },
      ];
    }

    if (filters.category) {
      where.categorySlug = filters.category;
    }

    if (filters.brand) {
      where.compatibleBrands = { has: filters.brand };
    }

    if (filters.model) {
      where.compatibleModels = { has: filters.model };
    }

    if (filters.condition) {
      where.condition = filters.condition;
    }

    if (filters.priceMin !== undefined || filters.priceMax !== undefined) {
      where.priceUsd = { gte: filters.priceMin, lte: filters.priceMax };
    }

    if (filters.inStock) {
      where.stockQuantity = { gt: 0 };
    }

    return where;
  }

  private async findPaginated(
    where: Prisma.PartWhereInput,
    filters: FilterPartsDto,
  ) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 24;
    const skip = (page - 1) * limit;

    const [rows, total] = await Promise.all([
      this.prisma.part.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { photos: true },
      }),
      this.prisma.part.count({ where }),
    ]);

    return {
      items: rows.map(toPublicPart),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  private async getOwnedPart(userId: string, partId: string) {
    const seller = await this.prisma.seller.findUnique({ where: { userId } });
    if (!seller) {
      throw new ForbiddenException('Seller profile is required');
    }
    const part = await this.prisma.part.findFirst({
      where: { id: partId, sellerId: seller.id },
      include: { photos: true },
    });

    if (!part) {
      throw new NotFoundException('Part not found');
    }

    return part;
  }

  private async getPartOrThrow(partId: string) {
    const part = await this.prisma.part.findUnique({ where: { id: partId } });
    if (!part) {
      throw new NotFoundException('Part not found');
    }
    return part;
  }
}
