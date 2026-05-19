import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
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
