import { existsSync, readdirSync } from 'fs';
import { join } from 'path';
import {
  ListingStatus,
  PrismaClient,
  SellerType,
} from '@prisma/client';
import {
  connectGridFsForSeed,
  mimeTypeForFilename,
  seedGridFsFileFromPath,
} from '../src/common/uploads/gridfs-seed.util';
import { publicUploadUrlForPath } from '../src/common/uploads/storage.paths';
import { UploadFolder } from '../src/common/uploads/upload.constants';
import { listingSeedVehicles } from './listings.seed-data';

const DOCS_IMAGES_DIR = join(process.cwd(), 'docs', 'images');

async function uploadSeedImagesToGridFs(): Promise<Map<string, string>> {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    throw new Error('MONGODB_URI is required to seed listing photos into GridFS');
  }

  const urlByFile = new Map<string, string>();

  if (!existsSync(DOCS_IMAGES_DIR)) {
    console.warn(
      `⚠️  Skipping listing photos: missing folder ${DOCS_IMAGES_DIR}`,
    );
    return urlByFile;
  }

  const { client, bucket } = await connectGridFsForSeed(uri, {
    dbName: process.env.MONGODB_DB_NAME,
    bucketName: process.env.GRIDFS_BUCKET_NAME,
  });

  try {
    const files = readdirSync(DOCS_IMAGES_DIR).filter((name) =>
      /\.(jpe?g|png|webp)$/i.test(name),
    );

    for (const file of files) {
      const source = join(DOCS_IMAGES_DIR, file);
      const publicId = `${UploadFolder.LISTINGS}/${file}`;
      await seedGridFsFileFromPath(
        bucket,
        source,
        publicId,
        mimeTypeForFilename(file),
      );
      urlByFile.set(file, publicUploadUrlForPath(publicId));
    }
  } finally {
    await client.close();
  }

  return urlByFile;
}

async function resolveSubcategoryId(
  prisma: PrismaClient,
  categorySlug: string,
  subcategoryName: string,
): Promise<string> {
  const category = await prisma.category.findUnique({
    where: { slug: categorySlug },
    select: { id: true },
  });

  if (!category) {
    throw new Error(
      `Category "${categorySlug}" not found — run category seed first`,
    );
  }

  const subcategory = await prisma.subcategory.findFirst({
    where: { categoryId: category.id, name: subcategoryName },
    select: { id: true },
  });

  if (!subcategory) {
    throw new Error(
      `Subcategory "${subcategoryName}" under "${categorySlug}" not found`,
    );
  }

  return subcategory.id;
}

function rwandaStockPricing(basePriceUsd: number, discountUsd = 0) {
  const finalPriceUsd = basePriceUsd - discountUsd;
  return {
    basePriceUsd,
    discountUsd,
    finalPriceUsd,
    currency: 'USD',
  };
}

export async function seedListings(prisma: PrismaClient) {
  const adminEmail = process.env.SEED_ADMIN_EMAIL?.trim();
  if (!adminEmail) {
    console.log('⏭️  Skipping sample listings (SEED_ADMIN_EMAIL not set)');
    return;
  }

  const adminUser = await prisma.user.findUnique({
    where: { email: adminEmail },
    select: { id: true },
  });

  if (!adminUser) {
    console.log(
      `⏭️  Skipping sample listings (admin user ${adminEmail} not found)`,
    );
    return;
  }

  const seller = await prisma.seller.findUnique({
    where: {
      userId_sellerType: {
        userId: adminUser.id,
        sellerType: SellerType.UZA_RWANDA_STOCK,
      },
    },
    select: { id: true },
  });

  if (!seller) {
    console.log(
      '⏭️  Skipping sample listings (UZA Rwanda Stock seller profile not found)',
    );
    return;
  }

  const photoUrlsByFile = await uploadSeedImagesToGridFs();
  const publishedAt = new Date();

  for (const vehicle of listingSeedVehicles) {
    const subcategoryId = await resolveSubcategoryId(
      prisma,
      vehicle.categorySlug,
      vehicle.subcategoryName,
    );

    const category = await prisma.category.findUniqueOrThrow({
      where: { slug: vehicle.categorySlug },
      select: { id: true },
    });

    const photoUrls = vehicle.imageFiles.map((file) => {
      const url = photoUrlsByFile.get(file);
      if (!url) {
        throw new Error(
          `Missing seed image "${file}" in docs/images (or copy failed)`,
        );
      }
      return url;
    });

    const pricing = rwandaStockPricing(
      vehicle.basePriceUsd,
      vehicle.discountUsd ?? 0,
    );

    const existing = await prisma.listing.findUnique({
      where: { slug: vehicle.slug },
      select: { id: true },
    });

    const listingData = {
      sellerId: seller.id,
      createdByUserId: adminUser.id,
      categoryId: category.id,
      subcategoryId,
      listingTitle: vehicle.listingTitle,
      status: ListingStatus.PUBLISHED,
      sellerType: SellerType.UZA_RWANDA_STOCK,
      brand: vehicle.brand,
      model: vehicle.model,
      trim: vehicle.trim ?? null,
      manufacturingYear: vehicle.manufacturingYear,
      isNew: vehicle.isNew,
      condition: vehicle.condition,
      bodyType: vehicle.bodyType,
      powertrainType: vehicle.powertrainType,
      color: vehicle.color,
      seats: vehicle.seats,
      steeringPosition: vehicle.steeringPosition,
      drivetrain: vehicle.drivetrain,
      mileageKm: vehicle.mileageKm ?? null,
      hasWarranty: vehicle.hasWarranty,
      warrantyDetails: vehicle.warrantyDetails,
      hasAccidentHistory: vehicle.hasAccidentHistory,
      ownershipCount: vehicle.ownershipCount,
      registrationStatus: vehicle.registrationStatus,
      vehicleLocation: vehicle.vehicleLocation,
      city: vehicle.city,
      country: vehicle.country,
      availabilityStatus: 'AVAILABLE',
      deliveryEstimateDays: vehicle.deliveryEstimateDays,
      description: vehicle.description,
      verificationLevel: vehicle.verificationLevel,
      isFeatured: vehicle.isFeatured,
      isHotDeal: vehicle.isHotDeal,
      publishedAt,
    };

    if (existing) {
      await prisma.listingPhoto.deleteMany({
        where: { listingId: existing.id },
      });
      await prisma.listingUseCase.deleteMany({
        where: { listingId: existing.id },
      });

      await prisma.listing.update({
        where: { id: existing.id },
        data: {
          ...listingData,
          photos: {
            create: photoUrls.map((url, index) => ({
              url,
              isPrimary: index === 0,
              displayOrder: index,
              altText: `${vehicle.brand} ${vehicle.model} photo ${index + 1}`,
            })),
          },
          evSpecs: {
            upsert: {
              create: vehicle.evSpecs,
              update: vehicle.evSpecs,
            },
          },
          listingPricing: {
            upsert: {
              create: pricing,
              update: pricing,
            },
          },
          useCaseTags: {
            create: vehicle.useCases.map((useCase) => ({ useCase })),
          },
        },
      });
    } else {
      await prisma.listing.create({
        data: {
          slug: vehicle.slug,
          ...listingData,
          photos: {
            create: photoUrls.map((url, index) => ({
              url,
              isPrimary: index === 0,
              displayOrder: index,
              altText: `${vehicle.brand} ${vehicle.model} photo ${index + 1}`,
            })),
          },
          evSpecs: { create: vehicle.evSpecs },
          listingPricing: { create: pricing },
          useCaseTags: {
            create: vehicle.useCases.map((useCase) => ({ useCase })),
          },
        },
      });
    }

    console.log(`  • ${vehicle.listingTitle} (${vehicle.slug})`);
  }

  console.log(
    `✅ Seeded ${listingSeedVehicles.length} published listings for UZA Rwanda Stock`,
  );
}
