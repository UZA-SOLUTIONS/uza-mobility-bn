import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class RbacService {
  constructor(private readonly prisma: PrismaService) {}

  async resolvePermissionsForRoleNames(roleNames: string[]): Promise<string[]> {
    if (roleNames.includes('SUPER_ADMIN')) {
      return ['*'];
    }

    if (roleNames.length === 0) {
      return [];
    }

    const roles = await this.prisma.role.findMany({
      where: { name: { in: roleNames } },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    const permissions = new Set<string>();

    for (const role of roles) {
      for (const rolePermission of role.permissions) {
        permissions.add(rolePermission.permission.action);
      }
    }

    return Array.from(permissions);
  }
}
