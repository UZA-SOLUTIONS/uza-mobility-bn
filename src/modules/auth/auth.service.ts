import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import { compareSync, genSaltSync, hashSync } from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from '../../users/users.service';
import { SafeUser } from '../../users/users.types';
import { AuthResponseDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import type { SignOptions } from 'jsonwebtoken';

const ROLE_PERMISSIONS: Record<string, string[]> = {
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
  SUSTAINABILITY_ADMIN: [
    'sustainability:read',
    'sustainability:manage',
    'orders:read',
  ],
  ADVERTISING_ADMIN: [
    'promotions:create',
    'promotions:manage',
    'listings:feature',
  ],
  SALES_AGENT: ['listings:read', 'orders:read'],
  SELLER: ['listings:create', 'listings:read'],
  BUYER: ['listings:read', 'invoices:create', 'payments:submit', 'orders:read'],
};

function resolvePermissionsForRoles(roles: string[]): string[] {
  const permissions = new Set<string>();

  for (const role of roles) {
    const rolePermissions = ROLE_PERMISSIONS[role] ?? [];

    if (rolePermissions.includes('*')) {
      return ['*'];
    }

    for (const permission of rolePermissions) {
      permissions.add(permission);
    }
  }

  return Array.from(permissions);
}

type UserWithRelations = Prisma.UserGetPayload<{
  include: { roles: { include: { role: true } } };
}>;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    await this.usersService.ensureEmailIsAvailable(dto.email);

    const passwordHash = this.hashPassword(dto.password);
    // Assign a default role to newly registered users (BUYER)
    const createdUser = await this.usersService.createUser({
      email: dto.email,
      phone: dto.phone,
      passwordHash,
      firstName: dto.firstName,
      lastName: dto.lastName,
      preferredLanguage: dto.preferredLanguage ?? 'en',
      roles: {
        create: [
          {
            role: {
              connect: { name: 'BUYER' },
            },
          },
        ],
      },
    });

    return this.issueTokens(createdUser);
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user || !this.verifyPassword(dto.password, user.passwordHash)) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.issueTokens(this.usersService.toSafeUser(user));
  }

  // Accept the raw refresh token (from Authorization header) instead of a DTO body
  async refresh(refreshToken: string): Promise<AuthResponseDto> {
    let payload: Record<string, any>;

    try {
      payload = this.jwtService.verify(refreshToken);
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (payload.tokenType !== 'refresh') {
      throw new UnauthorizedException('Invalid token type');
    }

    const tokenRecord = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: {
        user: {
          include: {
            roles: {
              include: {
                role: true,
              },
            },
          },
        },
      },
    });

    if (
      !tokenRecord ||
      tokenRecord.userId !== payload.sub ||
      tokenRecord.expiresAt < new Date()
    ) {
      throw new UnauthorizedException('Refresh token is no longer valid');
    }

    return this.issueTokens(this.usersService.toSafeUser(tokenRecord.user));
  }

  async logout(refreshToken: string): Promise<void> {
    await this.prisma.refreshToken.deleteMany({
      where: { token: refreshToken },
    });
  }

  async me(userId: string) {
    return this.usersService.ensureUserExists(userId);
  }

  private async issueTokens(user: SafeUser): Promise<AuthResponseDto> {
    const refreshExpiresIn =
      this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d';

    // Module-level signOptions already sets access token expiry; sign without options for access token
    const accessToken = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      roles: user.roles,
      permissions: resolvePermissionsForRoles(user.roles),
      tokenType: 'access',
    });

    // For refresh token, override expiresIn using properly-typed SignOptions['expiresIn']
    const refreshToken = this.jwtService.sign(
      {
        sub: user.id,
        email: user.email,
        roles: user.roles,
        permissions: resolvePermissionsForRoles(user.roles),
        tokenType: 'refresh',
      },
      {
        expiresIn: refreshExpiresIn as SignOptions['expiresIn'],
      },
    );

    const refreshPayload = this.jwtService.decode(refreshToken) as Record<
      string,
      any
    >;
    const refreshExpiresAt = new Date(
      ((refreshPayload?.exp ?? Math.floor(Date.now() / 1000)) as number) * 1000,
    );

    await this.prisma.refreshToken.deleteMany({ where: { userId: user.id } });
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt: refreshExpiresAt,
      },
    });

    return {
      accessToken,
      refreshToken,
    };
  }

  private hashPassword(password: string): string {
    const salt = genSaltSync(10);
    return hashSync(password, salt);
  }

  private verifyPassword(password: string, storedHash: string): boolean {
    return compareSync(password, storedHash);
  }
}
