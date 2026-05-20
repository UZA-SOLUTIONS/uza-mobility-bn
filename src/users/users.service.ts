import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBuyerProfileDto } from './dto/create-buyer-profile.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { SafeUser } from './users.types';

type UserWithRelations = Prisma.UserGetPayload<{
  include: { roles: { include: { role: true } } };
}>;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

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

  async updateMe(userId: string, dto: UpdateUserDto): Promise<SafeUser> {
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

    return this.toSafeUser(updated);
  }

  async createBuyerProfile(userId: string, dto: CreateBuyerProfileDto) {
    const existing = await this.prisma.buyerProfile.findUnique({
      where: { userId },
    });

    if (existing) {
      throw new ConflictException('Buyer profile already exists');
    }

    return this.prisma.buyerProfile.create({
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

  async updateBuyerProfile(
    userId: string,
    dto: Partial<CreateBuyerProfileDto>,
  ) {
    const profile = await this.prisma.buyerProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException('Buyer profile not found');
    }

    return this.prisma.buyerProfile.update({
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
  }

  async updateUserRoles(
    userId: string,
    roleNames: string[],
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

    const roles = await this.prisma.role.findMany({
      where: { name: { in: roleNames } },
    });

    if (roles.length !== roleNames.length) {
      throw new BadRequestException('One or more roles do not exist');
    }

    await this.prisma.userRole.deleteMany({ where: { userId } });
    await this.prisma.userRole.createMany({
      data: roles.map((role) => ({
        userId,
        roleId: role.id,
      })),
    });

    const updated = await this.findById(userId);

    if (!updated) {
      throw new NotFoundException('User not found');
    }

    return this.toSafeUser(updated);
  }

  async deactivateUser(userId: string): Promise<SafeUser> {
    const updated = await this.prisma.user.update({
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

    await this.prisma.refreshToken.deleteMany({ where: { userId } });

    return this.toSafeUser(updated);
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
