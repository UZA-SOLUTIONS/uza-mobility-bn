import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { resolveUniqueSlug } from '../../common/utils/slug.util';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CreateSubcategoryDto } from './dto/create-subcategory.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

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

  async create(dto: CreateCategoryDto) {
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

  async update(id: string, dto: UpdateCategoryDto) {
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
    });
  }

  async addSubcategory(categoryId: string, dto: CreateSubcategoryDto) {
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

  private async ensureExists(id: string) {
    const category = await this.prisma.category.findUnique({ where: { id } });

    if (!category) {
      throw new NotFoundException('Category not found');
    }
  }
}
