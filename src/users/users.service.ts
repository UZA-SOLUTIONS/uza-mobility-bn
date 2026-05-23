import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../common/audit/audit.service';
import type { RequestAuditContext } from '../common/audit/request-context.util';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBuyerProfileDto } from './dto/create-buyer-profile.dto';
import { CreateSellerProfileDto } from './dto/create-seller-profile.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { MeUserProfile, SafeUser } from './users.types';

type UserWithRelations = Prisma.UserGetPayload<{
  include: { roles: { include: { role: true } } };
}>;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findByEmail(email: string): Promise<UserWithRelations | null> {
    return this.prisma.user.findUnique({
      where: { email },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });
  }

  async findById(id: string): Promise<UserWithRelations | null> {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });
  }

  async findAll(): Promise<SafeUser[]> {
    const users = await this.prisma.user.findMany({
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return users.map((user) => this.toSafeUser(user));
  }

  async createUser(data: Prisma.UserCreateInput): Promise<SafeUser> {
    const created = await this.prisma.user.create({
      data,
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    return this.toSafeUser(created);
  }

  async updateMe(
    userId: string,
    dto: UpdateUserDto,
    auditContext: RequestAuditContext = {},
  ): Promise<SafeUser> {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: dto,
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    const safeUser = this.toSafeUser(updated);

    await this.auditService.record({
      userId,
      action: 'users:profile-updated',
      entity: 'User',
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
      metadata: {
        email: auditContext.actorEmail ?? safeUser.email,
        fields: Object.keys(dto),
      },
    });

    return safeUser;
  }

  async createBuyerProfile(
    userId: string,
    dto: CreateBuyerProfileDto,
    auditContext: RequestAuditContext = {},
  ) {
    const existing = await this.prisma.buyerProfile.findUnique({
      where: { userId },
    });

    if (existing) {
      throw new ConflictException('Buyer profile already exists');
    }

    const profile = await this.prisma.buyerProfile.create({
      data: {
        userId,
        buyerType: dto.buyerType as never,
        organizationName: dto.organizationName,
        taxId: dto.taxId,
        address: dto.address,
        city: dto.city,
        country: dto.country ?? 'RW',
        nationalId: dto.nationalId,
        passportNumber: dto.passportNumber,
      },
    });

    await this.auditService.record({
      userId,
      action: 'users:buyer-profile-created',
      entity: 'BuyerProfile',
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
      metadata: {
        email: auditContext.actorEmail,
        buyerType: profile.buyerType,
      },
    });

    return profile;
  }

  async getMeProfile(userId: string): Promise<MeUserProfile> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
        buyerProfile: true,
        seller: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const { buyerProfile, seller, ...userRecord } = user;

    return {
      ...this.toSafeUser(userRecord),
      buyerProfile,
      seller,
    };
  }

  async createSellerProfile(
    userId: string,
    dto: CreateSellerProfileDto,
    auditContext: RequestAuditContext = {},
  ) {
    const existing = await this.prisma.seller.findUnique({
      where: { userId },
    });

    if (existing) {
      throw new ConflictException('Seller profile already exists');
    }

    await this.ensureRoleAdded(userId, 'SELLER');

    const seller = await this.prisma.seller.create({
      data: {
        userId,
        sellerType: dto.sellerType,
        businessName: dto.businessName,
        businessRegNumber: dto.businessRegNumber,
        taxId: dto.taxId,
        contactPerson: dto.contactPerson,
        phone: dto.phone,
        email: dto.email,
        address: dto.address,
        city: dto.city,
        country: dto.country,
        logoUrl: dto.logoUrl,
        description: dto.description,
      },
    });

    await this.auditService.record({
      userId,
      action: 'users:seller-profile-created',
      entity: 'Seller',
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
      metadata: {
        email: auditContext.actorEmail,
        sellerType: seller.sellerType,
        businessName: seller.businessName,
      },
    });

    return seller;
  }

  async getBuyerProfile(userId: string) {
    const profile = await this.prisma.buyerProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException('Buyer profile not found');
    }

    return profile;
  }

  async getSellerProfile(userId: string) {
    const profile = await this.prisma.seller.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException('Seller profile not found');
    }

    return profile;
  }

  async updateBuyerProfile(
    userId: string,
    dto: Partial<CreateBuyerProfileDto>,
    auditContext: RequestAuditContext = {},
  ) {
    const existing = await this.prisma.buyerProfile.findUnique({
      where: { userId },
    });

    if (!existing) {
      throw new NotFoundException('Buyer profile not found');
    }

    const profile = await this.prisma.buyerProfile.update({
      where: { userId },
      data: {
        buyerType: dto.buyerType as never,
        organizationName: dto.organizationName,
        taxId: dto.taxId,
        address: dto.address,
        city: dto.city,
        country: dto.country,
        nationalId: dto.nationalId,
        passportNumber: dto.passportNumber,
      },
    });

    await this.auditService.record({
      userId,
      action: 'users:buyer-profile-updated',
      entity: 'BuyerProfile',
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
      metadata: {
        email: auditContext.actorEmail,
        fields: Object.keys(dto),
      },
    });

    return profile;
  }

  async updateSellerProfile(
    userId: string,
    dto: Partial<CreateSellerProfileDto>,
    auditContext: RequestAuditContext = {},
  ) {
    const existing = await this.prisma.seller.findUnique({
      where: { userId },
    });

    if (!existing) {
      throw new NotFoundException('Seller profile not found');
    }

    const seller = await this.prisma.seller.update({
      where: { userId },
      data: {
        sellerType: dto.sellerType,
        businessName: dto.businessName,
        businessRegNumber: dto.businessRegNumber,
        taxId: dto.taxId,
        contactPerson: dto.contactPerson,
        phone: dto.phone,
        email: dto.email,
        address: dto.address,
        city: dto.city,
        country: dto.country,
        logoUrl: dto.logoUrl,
        description: dto.description,
      },
    });

    await this.auditService.record({
      userId,
      action: 'users:seller-profile-updated',
      entity: 'Seller',
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
      metadata: {
        email: auditContext.actorEmail,
        fields: Object.keys(dto),
      },
    });

    return seller;
  }

  async updateUserRoles(
    userId: string,
    roleNames: string[],
    performedBy?: string,
    auditContext: RequestAuditContext = {},
  ): Promise<SafeUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const existingRoleNames = user.roles.map((userRole) => userRole.role.name);
    const finalRoleNames = [...roleNames];

    if (
      existingRoleNames.includes('BUYER') &&
      !finalRoleNames.includes('BUYER')
    ) {
      finalRoleNames.push('BUYER');
    }

    const roles = await this.prisma.role.findMany({
      where: { name: { in: finalRoleNames } },
    });

    if (roles.length !== finalRoleNames.length) {
      throw new BadRequestException('One or more roles do not exist');
    }

    let performerEmail = auditContext.actorEmail;

    if (!performerEmail && performedBy) {
      const performer = await this.prisma.user.findUnique({
        where: { id: performedBy },
        select: { email: true },
      });
      performerEmail = performer?.email;
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.userRole.deleteMany({ where: { userId } });
      await tx.userRole.createMany({
        data: roles.map((role) => ({
          userId,
          roleId: role.id,
        })),
      });

      await tx.refreshToken.deleteMany({ where: { userId } });

      await this.auditService.record(
        {
          userId: performedBy ?? null,
          action: 'users:roles-updated',
          entity: 'User',
          ipAddress: auditContext.ipAddress,
          userAgent: auditContext.userAgent,
          metadata: {
            performerEmail,
            targetEmail: user.email,
            previousRoles: existingRoleNames,
            newRoles: finalRoleNames,
          },
        },
        tx,
      );

      const refreshed = await tx.user.findUnique({
        where: { id: userId },
        include: {
          roles: {
            include: {
              role: true,
            },
          },
        },
      });

      if (!refreshed) {
        throw new NotFoundException('User not found');
      }

      return this.toSafeUser(refreshed);
    });

    return updated;
  }

  async ensureRoleAdded(userId: string, roleName: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { roles: { include: { role: true } } },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const already = user.roles.some((ur) => ur.role.name === roleName);

    if (already) {
      return;
    }

    const role = await this.prisma.role.findUnique({
      where: { name: roleName },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    await this.prisma.userRole.create({ data: { userId, roleId: role.id } });
  }

  async deactivateUser(
    userId: string,
    performedBy?: string,
    auditContext: RequestAuditContext = {},
  ): Promise<SafeUser> {
    let performerEmail = auditContext.actorEmail;

    if (!performerEmail && performedBy) {
      const performer = await this.prisma.user.findUnique({
        where: { id: performedBy },
        select: { email: true },
      });
      performerEmail = performer?.email;
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: userId },
        data: {
          isActive: false,
          deletedAt: new Date(),
        },
        include: {
          roles: {
            include: {
              role: true,
            },
          },
        },
      });

      await tx.refreshToken.deleteMany({ where: { userId } });

      await this.auditService.record(
        {
          userId: performedBy ?? null,
          action: 'users:deactivated',
          entity: 'User',
          ipAddress: auditContext.ipAddress,
          userAgent: auditContext.userAgent,
          metadata: {
            performerEmail,
            targetEmail: user.email,
          },
        },
        tx,
      );

      return user;
    });

    return this.toSafeUser(updated);
  }

  async invalidateUserSessions(userId: string): Promise<void> {
    await this.prisma.refreshToken.deleteMany({ where: { userId } });
  }

  async ensureUserExists(userId: string): Promise<SafeUser> {
    const user = await this.findById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.toSafeUser(user);
  }

  async ensureEmailIsAvailable(email: string): Promise<void> {
    const existing = await this.prisma.user.findUnique({ where: { email } });

    if (existing) {
      throw new ConflictException('Email already in use');
    }
  }

  toSafeUser(user: UserWithRelations): SafeUser {
    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      firstName: user.firstName,
      lastName: user.lastName,
      isActive: user.isActive,
      isEmailVerified: user.isEmailVerified,
      isPhoneVerified: user.isPhoneVerified,
      preferredLanguage: user.preferredLanguage,
      profilePhoto: user.profilePhoto,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      deletedAt: user.deletedAt,
      roles: user.roles.map((userRole) => userRole.role.name),
    };
  }
}
