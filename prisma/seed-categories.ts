import { PrismaClient } from '@prisma/client';
import { categorySeedData } from './categories.seed-data';
import { slugifyText } from '../src/common/utils/slug.util';

/** Stable slug per category + subcategory name (safe to re-run seed). */
function subcategorySeedSlug(categorySlug: string, subName: string): string {
  return `${categorySlug}-${slugifyText(subName)}`;
}

export async function seedCategories(prisma: PrismaClient) {
  for (const [index, category] of categorySeedData.entries()) {
    const savedCategory = await prisma.category.upsert({
      where: { slug: category.slug },
      update: {
        name: category.name,
        type: category.type,
        isActive: true,
        displayOrder: index,
      },
      create: {
        name: category.name,
        slug: category.slug,
        type: category.type,
        isActive: true,
        displayOrder: index,
      },
    });

    for (const [subIndex, subName] of category.subcategories.entries()) {
      const slug = subcategorySeedSlug(savedCategory.slug, subName);

      await prisma.subcategory.upsert({
        where: {
          categoryId_name: {
            categoryId: savedCategory.id,
            name: subName,
          },
        },
        update: {
          slug,
          isActive: true,
          displayOrder: subIndex,
        },
        create: {
          name: subName,
          slug,
          categoryId: savedCategory.id,
          isActive: true,
          displayOrder: subIndex,
        },
      });
    }
  }
}
