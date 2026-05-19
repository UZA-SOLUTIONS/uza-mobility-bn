import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { genSaltSync, hashSync } from 'bcryptjs';

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL ?? '',
  }),
  errorFormat: 'pretty',
});

async function ensureRole(name: string, description?: string) {
  return prisma.role.upsert({
    where: { name },
    update: { description: description ?? undefined },
    create: { name, description: description ?? null },
  });
}

async function ensureUserWithRoles(params: {
  email: string;
  plainPassword: string;
  firstName: string;
  lastName: string;
  roleNames: string[];
  phone?: string;
  preferredLanguage?: string;
}) {
  const passwordHash = hashSync(params.plainPassword, genSaltSync(10));

  const user = await prisma.user.upsert({
    where: { email: params.email },
    update: {
      passwordHash,
      firstName: params.firstName,
      lastName: params.lastName,
      phone: params.phone ?? undefined,
      preferredLanguage: params.preferredLanguage ?? 'en',
      isActive: true,
      isEmailVerified: true,
      isPhoneVerified: true,
    },
    create: {
      email: params.email,
      phone: params.phone ?? null,
      passwordHash,
      firstName: params.firstName,
      lastName: params.lastName,
      preferredLanguage: params.preferredLanguage ?? 'en',
      isActive: true,
      isEmailVerified: true,
      isPhoneVerified: true,
    },
  });

  // Ensure the user-role links exist (many roles per user supported)
  const roleRecords = await Promise.all(
    params.roleNames.map((r) => ensureRole(r, `Seed role: ${r}`)),
  );

  await Promise.all(
    roleRecords.map((role) =>
      prisma.userRole.upsert({
        where: {
          userId_roleId: {
            userId: user.id,
            roleId: role.id,
          },
        },
        update: {},
        create: {
          userId: user.id,
          roleId: role.id,
        },
      }),
    ),
  );
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('Missing DATABASE_URL. Add it to your .env before running prisma:seed.');
  }

  // Roles for login testing
  await Promise.all(
    ['SUPER_ADMIN', 'MARKETPLACE_ADMIN', 'FINANCE_ADMIN', 'BUYER', 'SELLER'].map(
      (r) => ensureRole(r),
    ),
  );

  // Use single-role users (easier to reason about during login tests)
  // If you still want admin to have multiple roles, add them to roleNames array.
  await ensureUserWithRoles({
    email: 'admin@uza.local',
    plainPassword: 'Password123!',
    firstName: 'UZA',
    lastName: 'Admin',
    roleNames: ['SUPER_ADMIN'],
    preferredLanguage: 'en',
  });

  await ensureUserWithRoles({
    email: 'buyer@uza.local',
    plainPassword: 'Password123!',
    firstName: 'Rwanda',
    lastName: 'Buyer',
    roleNames: ['BUYER'],
    preferredLanguage: 'en',
  });

  await ensureUserWithRoles({
    email: 'seller@uza.local',
    plainPassword: 'Password123!',
    firstName: 'Kigali',
    lastName: 'Seller',
    roleNames: ['SELLER'],
    preferredLanguage: 'en',
  });

  console.log('✅ Prisma seed completed');
}

main()
  .catch((e) => {
    console.error('❌ Prisma seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

