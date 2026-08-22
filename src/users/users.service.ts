import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import { AuditService } from '../common/audit/audit.service';
import type { RequestAuditContext } from '../common/audit/request-context.util';
import { PrismaService } from '../prisma/prisma.service';
import { AdminFilterBuyersDto } from './dto/admin-filter-buyers.dto';
import { CreateBuyerProfileDto } from './dto/create-buyer-profile.dto';
import { CreateSellerProfileDto } from './dto/create-seller-profile.dto';
import type { UpdateSellerProfilePayload } from './dto/user-write.types';
import type { UpdateUserPayload } from './dto/user-write.types';
import {
  pickPrimaryMeSeller,
  sellerChannelKey,
} from '../modules/sellers/seller-profile.util';
import { NotificationsService } from '../modules/notifications/notifications.service';
import { InvoicesService } from '../modules/invoices/invoices.service';
import { MeUserProfile, SafeUser } from './users.types';
import type { SellerType } from '@prisma/client';
import { NotificationType } from '@prisma/client';

type UserWithRelations = Prisma.UserGetPayload<{
  include: { roles: { include: { role: true } } };
}>;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly moduleRef: ModuleRef,
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

  async listBuyersForAdmin(filters: AdminFilterBuyersDto = {}) {
    const q = filters.q?.trim();
    const buyerAccountFilter: Prisma.UserWhereInput = {
      isActive: true,
      OR: [
        { buyerProfile: { isNot: null } },
        { roles: { some: { role: { name: 'BUYER' } } } },
      ],
    };

    const where: Prisma.UserWhereInput = q
      ? {
          AND: [
            buyerAccountFilter,
            {
              OR: [
                { email: { contains: q, mode: 'insensitive' } },
                { firstName: { contains: q, mode: 'insensitive' } },
                { lastName: { contains: q, mode: 'insensitive' } },
                { phone: { contains: q, mode: 'insensitive' } },
                {
                  buyerProfile: {
                    organizationName: { contains: q, mode: 'insensitive' },
                  },
                },
              ],
            },
          ],
        }
      : buyerAccountFilter;

    const users = await this.prisma.user.findMany({
      where,
      include: { buyerProfile: true },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      take: 200,
    });

    return users.map((user) => {
      const name =
        [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ||
        user.email;
      const organizationName = user.buyerProfile?.organizationName?.trim();
      const displayName = organizationName
        ? `${organizationName} (${name})`
        : name;

      return {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        displayName,
        buyerProfile: user.buyerProfile
          ? {
              buyerType: user.buyerProfile.buyerType,
              organizationName: user.buyerProfile.organizationName,
              address: user.buyerProfile.address,
              city: user.buyerProfile.city,
              country: user.buyerProfile.country,
            }
          : null,
      };
    });
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
    dto: UpdateUserPayload,
    auditContext: RequestAuditContext = {},
  ): Promise<SafeUser> {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        preferredLanguage: dto.preferredLanguage,
        ...(dto.profilePhoto !== undefined
          ? { profilePhoto: dto.profilePhoto }
          : {}),
      },
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

    const invoicesService = this.moduleRef.get(InvoicesService, {
      strict: false,
    });
    await invoicesService?.fulfillPendingBuyInquiries(userId);

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
        sellers: true,
        operatorProfile: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const { buyerProfile, sellers, operatorProfile, ...userRecord } = user;

    return {
      ...this.toSafeUser(userRecord),
      buyerProfile,
      sellers,
      seller: pickPrimaryMeSeller(sellers),
      operator: operatorProfile
        ? {
            id: operatorProfile.id,
            status: operatorProfile.status,
            businessName: operatorProfile.businessName,
            isVerified: operatorProfile.isVerified,
          }
        : null,
    };
  }

  async createSellerProfile(
    userId: string,
    dto: CreateSellerProfileDto,
    auditContext: RequestAuditContext = {},
  ) {
    const existing = await this.prisma.seller.findUnique({
      where: sellerChannelKey(userId, dto.sellerType),
    });

    if (existing) {
      throw new ConflictException(
        `Seller profile already exists for ${dto.sellerType.replace(/_/g, ' ')}`,
      );
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

  async getSellerProfile(userId: string, sellerType?: SellerType) {
    if (sellerType) {
      const profile = await this.prisma.seller.findUnique({
        where: sellerChannelKey(userId, sellerType),
      });
      if (!profile) {
        throw new NotFoundException('Seller profile not found');
      }
      return profile;
    }

    const sellers = await this.prisma.seller.findMany({ where: { userId } });
    const profile = pickPrimaryMeSeller(sellers);

    if (!profile) {
      throw new NotFoundException('Seller profile not found');
    }

    return profile;
  }

  async listSellerProfiles(userId: string) {
    return this.prisma.seller.findMany({
      where: { userId },
      orderBy: { sellerType: 'asc' },
    });
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
    dto: UpdateSellerProfilePayload,
    auditContext: RequestAuditContext = {},
  ) {
    const channelType = dto.sellerType;
    let existing;

    if (channelType) {
      existing = await this.prisma.seller.findUnique({
        where: sellerChannelKey(userId, channelType),
      });
    } else {
      const sellers = await this.prisma.seller.findMany({ where: { userId } });
      existing = pickPrimaryMeSeller(sellers);
    }

    if (!existing) {
      throw new NotFoundException('Seller profile not found');
    }

    const { sellerType: _channel, ...profileFields } = dto;

    const seller = await this.prisma.seller.update({
      where: { id: existing.id },
      data: {
        businessName: profileFields.businessName,
        businessRegNumber: profileFields.businessRegNumber,
        taxId: profileFields.taxId,
        contactPerson: profileFields.contactPerson,
        phone: profileFields.phone,
        email: profileFields.email,
        address: profileFields.address,
        city: profileFields.city,
        country: profileFields.country,
        description: profileFields.description,
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

    const roleLabel = finalRoleNames
      .map((r) => r.replaceAll('_', ' '))
      .join(', ');
    await this.notificationsService.send({
      userId,
      type: NotificationType.SYSTEM_ALERT,
      title: 'Your roles were updated',
      body: `Your account roles are now: ${roleLabel}. Sign in again if you were logged in elsewhere.`,
      metadata: {
        previousRoles: existingRoleNames,
        newRoles: finalRoleNames,
      },
      emailSubject: '[UZA Mobility] Your account roles were updated',
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
    if (performedBy && performedBy === userId) {
      throw new BadRequestException('You cannot deactivate your own account');
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

    await this.notificationsService.send({
      userId,
      type: NotificationType.SYSTEM_ALERT,
      title: 'Your account was deactivated',
      body: 'Your UZA Mobility account has been deactivated. Contact support if you believe this is a mistake.',
      metadata: { performerEmail },
      emailSubject: '[UZA Mobility] Your account was deactivated',
      emailDespiteInactive: true,
    });

    return this.toSafeUser(updated);
  }

  async activateUser(
    userId: string,
    performedBy?: string,
    auditContext: RequestAuditContext = {},
  ): Promise<SafeUser> {
    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: { include: { role: true } },
      },
    });

    if (!existing) {
      throw new NotFoundException('User not found');
    }

    if (existing.isActive && !existing.deletedAt) {
      throw new BadRequestException('User is already active');
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
      const user = await tx.user.update({
        where: { id: userId },
        data: {
          isActive: true,
          deletedAt: null,
        },
        include: {
          roles: { include: { role: true } },
        },
      });

      await this.auditService.record(
        {
          userId: performedBy ?? null,
          action: 'users:activated',
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

    await this.notificationsService.send({
      userId,
      type: NotificationType.SYSTEM_ALERT,
      title: 'Your account was reactivated',
      body: 'Your UZA Mobility account is active again. You can sign in and use the platform.',
      metadata: { performerEmail },
      emailSubject: '[UZA Mobility] Your account was reactivated',
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
      // The permanent public identifier. Safe to expose — that is what it is for, and it
      // is what other UZA systems key on.
      uzaId: user.uzaId,
      email: user.email,
      googleId: user.googleId,
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
