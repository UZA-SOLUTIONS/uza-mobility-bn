import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { resolveUniqueSlug } from '../../common/utils/slug.util';
import { AdminFilterCategoriesDto } from './dto/admin-filter-categories.dto';
import type {
  CreateCategoryPayload,
  CreateSubcategoryPayload,
  UpdateCategoryPayload,
  UpdateSubcategoryPayload,
} from './dto/category-write.types';

const categoryAdminInclude = {
  subcategories: {
    orderBy: [{ displayOrder: 'asc' as const }, { name: 'asc' as const }],
  },
  _count: { select: { listings: true } },
};

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  findAllActive() {
    return this.prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      include: {
        subcategories: {
          where: { isActive: true },
          orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
        },
      },
    });
  }

  async findBySlug(slug: string) {
    const category = await this.prisma.category.findFirst({
      where: { slug, isActive: true },
      include: {
        subcategories: {
          where: { isActive: true },
          orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
        },
      },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return category;
  }

  async create(dto: CreateCategoryPayload) {
    const slug = await resolveUniqueSlug(dto.name, (candidate) =>
      this.prisma.category
        .findUnique({ where: { slug: candidate } })
        .then((row) => row !== null),
    );

    try {
      return await this.prisma.category.create({
        data: {
          name: dto.name,
          slug,
          type: dto.type,
          description: dto.description,
          iconUrl: dto.iconUrl,
          displayOrder: dto.displayOrder ?? 0,
        },
      });
    } catch {
      throw new ConflictException('Category name already exists');
    }
  }

  async update(id: string, dto: UpdateCategoryPayload) {
    await this.ensureExists(id);

    return this.prisma.category.update({
      where: { id },
      data: dto,
    });
  }

  async deactivate(id: string) {
    await this.ensureExists(id);

    return this.prisma.category.update({
      where: { id },
      data: { isActive: false },
      include: categoryAdminInclude,
    });
  }

  adminFindAll(filters: AdminFilterCategoriesDto = {}) {
    const where =
      filters.isActive === undefined ? {} : { isActive: filters.isActive };

    return this.prisma.category.findMany({
      where,
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      include: categoryAdminInclude,
    });
  }

  async reactivate(id: string) {
    await this.ensureExists(id);

    return this.prisma.category.update({
      where: { id },
      data: { isActive: true },
      include: categoryAdminInclude,
    });
  }

  async hardDeleteCategory(id: string) {
    await this.ensureExists(id);

    const listingCount = await this.prisma.listing.count({
      where: { categoryId: id },
    });

    if (listingCount > 0) {
      throw new BadRequestException(
        `Cannot delete category: ${listingCount} listing(s) still reference it. Deactivate instead.`,
      );
    }

    await this.prisma.category.delete({ where: { id } });

    return { message: 'Category permanently deleted' };
  }

  async deleteSubcategory(categoryId: string, subcategoryId: string) {
    const subcategory = await this.getSubcategoryInCategoryOrThrow(
      categoryId,
      subcategoryId,
    );

    const listingCount = await this.prisma.listing.count({
      where: { subcategoryId: subcategory.id },
    });

    if (listingCount > 0) {
      throw new BadRequestException(
        `Cannot delete subcategory: ${listingCount} listing(s) still reference it.`,
      );
    }

    await this.prisma.subcategory.delete({ where: { id: subcategoryId } });

    return { message: 'Subcategory deleted' };
  }

  async updateSubcategory(
    categoryId: string,
    subcategoryId: string,
    dto: UpdateSubcategoryPayload,
  ) {
    const existing = await this.getSubcategoryInCategoryOrThrow(
      categoryId,
      subcategoryId,
    );

    const data: Prisma.SubcategoryUpdateInput = {};

    if (dto.name !== undefined) {
      data.name = dto.name;
      if (dto.name !== existing.name) {
        data.slug = await resolveUniqueSlug(dto.name, async (candidate) => {
          const row = await this.prisma.subcategory.findUnique({
            where: { slug: candidate },
          });
          return row !== null && row.id !== subcategoryId;
        });
      }
    }

    if (dto.description !== undefined) {
      data.description = dto.description.trim() ? dto.description : null;
    }

    if (dto.iconUrl !== undefined) {
      data.iconUrl = dto.iconUrl || null;
    }

    if (dto.displayOrder !== undefined) {
      data.displayOrder = dto.displayOrder;
    }

    try {
      return await this.prisma.subcategory.update({
        where: { id: subcategoryId },
        data,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Subcategory name already exists for this category',
        );
      }
      throw error;
    }
  }

  async addSubcategory(categoryId: string, dto: CreateSubcategoryPayload) {
    await this.ensureExists(categoryId);

    const slug = await resolveUniqueSlug(dto.name, (candidate) =>
      this.prisma.subcategory
        .findUnique({ where: { slug: candidate } })
        .then((row) => row !== null),
    );

    try {
      return await this.prisma.subcategory.create({
        data: {
          categoryId,
          name: dto.name,
          slug,
          description: dto.description,
          iconUrl: dto.iconUrl,
          displayOrder: dto.displayOrder ?? 0,
        },
      });
    } catch {
      throw new ConflictException(
        'Subcategory name already exists for this category',
      );
    }
  }

  private async getSubcategoryInCategoryOrThrow(
    categoryId: string,
    subcategoryId: string,
  ) {
    const subcategory = await this.prisma.subcategory.findFirst({
      where: { id: subcategoryId, categoryId },
    });

    if (!subcategory) {
      throw new NotFoundException('Subcategory not found for this category');
    }

    return subcategory;
  }

  private async ensureExists(id: string) {
    const category = await this.prisma.category.findUnique({ where: { id } });

    if (!category) {
      throw new NotFoundException('Category not found');
    }
  }
}
