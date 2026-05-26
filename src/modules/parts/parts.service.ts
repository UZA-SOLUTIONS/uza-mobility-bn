import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { resolveUniqueSlug } from '../../common/utils/slug.util';
import { PrismaService } from '../../prisma/prisma.service';
import { SellersService } from '../sellers/sellers.service';
import { marketplaceSellerFilter } from '../sellers/seller-profile.util';
import { FilterPartsDto } from './dto/filter-parts.dto';
import type {
  AdminCreatePartPayload,
  AdminUpdatePartPayload,
  CreatePartPayload,
  UpdatePartPayload,
} from './dto/part-write.types';
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

  async findMine(userId: string) {
    const seller = await this.prisma.seller.findFirst({
      where: marketplaceSellerFilter(userId),
    });

    if (!seller) {
      throw new NotFoundException('Seller profile not found');
    }

    const rows = await this.prisma.part.findMany({
      where: { sellerId: seller.id },
      orderBy: { updatedAt: 'desc' },
      include: { photos: true },
    });

    return rows.map(toPublicPart);
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

  async createForSeller(userId: string, dto: CreatePartPayload) {
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

  async updateOwn(userId: string, partId: string, dto: UpdatePartPayload) {
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

    if (dto.photoUrls?.length) {
      await this.appendPartPhotos(
        part.id,
        dto.photoUrls,
        updated.photos.length,
      );
      return this.findById(part.id);
    }

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

  async adminFindById(partId: string) {
    const part = await this.prisma.part.findUnique({
      where: { id: partId },
      include: {
        photos: true,
        seller: { select: { id: true, businessName: true } },
      },
    });

    if (!part) {
      throw new NotFoundException('Part not found');
    }

    return toPublicPart(part);
  }

  async adminCreate(dto: AdminCreatePartPayload) {
    if (dto.sellerId) {
      const seller = await this.prisma.seller.findUnique({
        where: { id: dto.sellerId },
      });
      if (!seller) {
        throw new NotFoundException('Seller not found');
      }
    }

    const slug = await resolveUniqueSlug(dto.name, (candidate) =>
      this.prisma.part
        .findUnique({ where: { slug: candidate } })
        .then((row) => row !== null),
    );

    const part = await this.prisma.part.create({
      data: {
        sellerId: dto.sellerId ?? null,
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

  async adminUpdate(partId: string, dto: AdminUpdatePartPayload) {
    await this.getPartOrThrow(partId);

    if (dto.sellerId) {
      const seller = await this.prisma.seller.findUnique({
        where: { id: dto.sellerId },
      });
      if (!seller) {
        throw new NotFoundException('Seller not found');
      }
    }

    const updated = await this.prisma.part.update({
      where: { id: partId },
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
        sellerId: dto.sellerId,
      },
      include: { photos: true },
    });

    if (dto.photoUrls?.length) {
      await this.appendPartPhotos(partId, dto.photoUrls, updated.photos.length);
      return this.adminFindById(partId);
    }

    return toPublicPart(updated);
  }

  async adminDelete(partId: string) {
    await this.getPartOrThrow(partId);
    await this.prisma.part.delete({ where: { id: partId } });
    return { message: 'Part deleted' };
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
    const seller = await this.prisma.seller.findFirst({
      where: marketplaceSellerFilter(userId),
    });
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

  private async appendPartPhotos(
    partId: string,
    photoUrls: string[],
    existingCount: number,
  ) {
    await this.prisma.partPhoto.createMany({
      data: photoUrls.map((url, index) => ({
        partId,
        url,
        isPrimary: existingCount === 0 && index === 0,
      })),
    });
  }

  private async getPartOrThrow(partId: string) {
    const part = await this.prisma.part.findUnique({ where: { id: partId } });
    if (!part) {
      throw new NotFoundException('Part not found');
    }
    return part;
  }
}
