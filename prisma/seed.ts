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

async function ensurePermission(action: string, description?: string) {
  return prisma.permission.upsert({
    where: { action },
    update: { description: description ?? undefined },
    create: { action, description: description ?? null },
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

async function seedPermissionsAndRoleMappings() {
  const permissions = [
    'listings:create',
    'listings:read',
    'listings:approve',
    'listings:reject',
    'listings:feature',
    'listings:delete',
    'invoices:create',
    'invoices:read',
    'invoices:send',
    'invoices:cancel',
    'payments:submit',
    'payments:verify',
    'payments:reject',
    'payments:refund',
    'orders:read',
    'orders:update-status',
    'sellers:verify',
    'sellers:suspend',
    'fleet:read',
    'fleet:update-status',
    'financing:read',
    'financing:send-to-bank',
    'promotions:create',
    'promotions:manage',
    'sustainability:read',
    'sustainability:manage',
    'users:read',
    'users:manage-roles',
  ];

  const permissionRecords = await Promise.all(
    permissions.map((action) => ensurePermission(action)),
  );

  const roleMappings: Record<string, string[]> = {
    SUPER_ADMIN: ['*'],
    MARKETPLACE_ADMIN: [
      'listings:create',
      'listings:read',
      'listings:approve',
      'listings:reject',
      'listings:feature',
      'listings:delete',
      'sellers:verify',
      'sellers:suspend',
    ],
    FINANCE_ADMIN: [
      'invoices:read',
      'invoices:send',
      'invoices:cancel',
      'payments:verify',
      'payments:reject',
      'payments:refund',
      'financing:read',
      'financing:send-to-bank',
    ],
    LOGISTICS_ADMIN: ['orders:read', 'orders:update-status'],
    FLEET_ADMIN: ['fleet:read', 'fleet:update-status', 'listings:read'],
    SUSTAINABILITY_ADMIN: ['sustainability:read', 'sustainability:manage', 'orders:read'],
    ADVERTISING_ADMIN: ['promotions:create', 'promotions:manage', 'listings:feature'],
    SALES_AGENT: ['listings:read', 'orders:read'],
    SELLER: ['listings:create', 'listings:read'],
    BUYER: ['listings:read', 'invoices:create', 'payments:submit', 'orders:read'],
  };

  const allActionToRecord = new Map(
    permissionRecords.map((record) => [record.action, record]),
  );

  for (const [roleName, allowedActions] of Object.entries(roleMappings)) {
    const role = await ensureRole(roleName);

    const actionsToAttach =
      allowedActions.includes('*') ? permissions : allowedActions;

    await Promise.all(
      actionsToAttach.map((action) => {
        const permission = allActionToRecord.get(action);
        if (!permission) {
          throw new Error(`Permission not seeded: ${action}`);
        }

        return prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: role.id,
              permissionId: permission.id,
            },
          },
          update: {},
          create: {
            roleId: role.id,
            permissionId: permission.id,
          },
        });
      }),
    );
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('Missing DATABASE_URL. Add it to your .env before running prisma:seed.');
  }

  // Roles for login testing
  await seedPermissionsAndRoleMappings();

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

