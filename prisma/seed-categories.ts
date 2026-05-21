import { PrismaClient } from '@prisma/client';
import { categorySeedData } from './categories.seed-data';
import { generateSubcategorySlug } from '../src/common/utils/slug.util';

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
      const slug = generateSubcategorySlug(subName);

      await prisma.subcategory.upsert({
        where: { slug },
        update: {
          name: subName,
          categoryId: savedCategory.id,
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
