import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { compareSync, genSaltSync, hashSync } from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import type { RequestAuditContext } from '../../common/audit/request-context.util';
import { UsersService } from '../../users/users.service';
import { SafeUser } from '../../users/users.types';
import { AuthResponseDto } from './dto/auth-response.dto';
import type { MeResponseDto } from './dto/me-response.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RbacService } from './rbac.service';
import type { SignOptions } from 'jsonwebtoken';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly rbacService: RbacService,
    private readonly auditService: AuditService,
  ) {}

  async register(
    dto: RegisterDto,
    auditContext: RequestAuditContext = {},
  ): Promise<AuthResponseDto> {
    await this.usersService.ensureEmailIsAvailable(dto.email);

    const passwordHash = this.hashPassword(dto.password);
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

    const tokens = await this.issueTokens(createdUser);

    await this.auditService.record({
      userId: createdUser.id,
      action: 'auth:register',
      entity: 'User',
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
      metadata: {
        email: createdUser.email,
      },
    });

    return tokens;
  }

  async login(
    dto: LoginDto,
    auditContext: RequestAuditContext = {},
  ): Promise<AuthResponseDto> {
    return this.authenticateAndIssueTokens(dto, auditContext);
  }

  async loginAdmin(
    dto: LoginDto,
    auditContext: RequestAuditContext = {},
  ): Promise<AuthResponseDto> {
    return this.authenticateAndIssueTokens(dto, auditContext, {
      adminOnly: true,
      auditAction: 'auth:admin-login',
    });
  }

  async refresh(refreshToken: string): Promise<AuthResponseDto> {
    let payload: Record<string, unknown>;

    try {
      payload = this.jwtService.verify(refreshToken) as Record<string, unknown>;
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

    this.assertUserIsActive(tokenRecord.user);

    return this.issueTokens(this.usersService.toSafeUser(tokenRecord.user));
  }

  async logout(
    refreshToken: string,
    auditContext: RequestAuditContext = {},
  ): Promise<void> {
    const tokenRecord = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: {
        user: { select: { email: true } },
      },
    });

    await this.prisma.refreshToken.deleteMany({
      where: { token: refreshToken },
    });

    if (tokenRecord) {
      await this.auditService.record({
        userId: tokenRecord.userId,
        action: 'auth:logout',
        entity: 'User',
        ipAddress: auditContext.ipAddress,
        userAgent: auditContext.userAgent,
        metadata: {
          email: tokenRecord.user.email,
        },
      });
    }
  }

  async me(userId: string): Promise<MeResponseDto> {
    const profile = await this.usersService.getMeProfile(userId);
    const permissions = await this.rbacService.resolvePermissionsForRoleNames(
      profile.roles,
    );

    return {
      ...profile,
      permissions,
    };
  }

  private async issueTokens(user: SafeUser): Promise<AuthResponseDto> {
    const permissions = await this.rbacService.resolvePermissionsForRoleNames(
      user.roles,
    );
    const refreshExpiresIn =
      this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d';

    const accessToken = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      roles: user.roles,
      permissions,
      tokenType: 'access',
    });

    const refreshToken = this.jwtService.sign(
      {
        sub: user.id,
        email: user.email,
        roles: user.roles,
        permissions,
        tokenType: 'refresh',
      },
      {
        expiresIn: refreshExpiresIn as SignOptions['expiresIn'],
      },
    );

    const refreshPayload = this.jwtService.decode(refreshToken) as Record<
      string,
      unknown
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

  private async authenticateAndIssueTokens(
    dto: LoginDto,
    auditContext: RequestAuditContext = {},
    options: {
      adminOnly?: boolean;
      auditAction?: string;
    } = {},
  ): Promise<AuthResponseDto> {
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

    this.assertUserIsActive(user);

    if (
      options.adminOnly &&
      !this.hasAdminRole(user.roles.map((role) => role.role.name))
    ) {
      throw new ForbiddenException('Admin access required');
    }

    const safeUser = this.usersService.toSafeUser(user);
    const tokens = await this.issueTokens(safeUser);

    await this.auditService.record({
      userId: safeUser.id,
      action: options.auditAction ?? 'auth:login',
      entity: 'User',
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
      metadata: {
        email: safeUser.email,
      },
    });

    return tokens;
  }

  private hasAdminRole(roleNames: string[]): boolean {
    return roleNames.some(
      (roleName) => roleName === 'SUPER_ADMIN' || roleName.endsWith('_ADMIN'),
    );
  }

  private assertUserIsActive(user: {
    isActive: boolean;
    deletedAt: Date | null;
  }): void {
    if (!user.isActive || user.deletedAt) {
      throw new UnauthorizedException('Invalid email or password');
    }
  }

  private hashPassword(password: string): string {
    const salt = genSaltSync(10);
    return hashSync(password, salt);
  }

  private verifyPassword(password: string, storedHash: string): boolean {
    return compareSync(password, storedHash);
  }
}
