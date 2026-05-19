import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { SafeUser } from '../users/users.types';
import { AuthResponseDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { hashPassword, verifyPassword } from './jwt.utils';
import type { SignOptions } from 'jsonwebtoken';

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

    const passwordHash = hashPassword(dto.password);

    const createdUser = await this.usersService.createUser({
      email: dto.email,
      phone: dto.phone,
      passwordHash,
      firstName: dto.firstName,
      lastName: dto.lastName,
      preferredLanguage: dto.preferredLanguage ?? 'en',
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

    if (!user || !verifyPassword(dto.password, user.passwordHash)) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.issueTokens(this.usersService.toSafeUser(user));
  }

  async refresh(dto: RefreshTokenDto): Promise<AuthResponseDto> {
    let payload: Record<string, any>;

    try {
      payload = this.jwtService.verify(dto.refreshToken);
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (payload.tokenType !== 'refresh') {
      throw new UnauthorizedException('Invalid token type');
    }

    const tokenRecord = await this.prisma.refreshToken.findUnique({
      where: { token: dto.refreshToken },
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

  async me(userId: string) {
    return this.usersService.ensureUserExists(userId);
  }

  private async issueTokens(user: SafeUser): Promise<AuthResponseDto> {
    const accessExpiresIn =
      this.configService.get<string>('JWT_ACCESS_EXPIRES_IN') ?? '15m';
    const refreshExpiresIn =
      this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d';

    // Module-level signOptions already sets access token expiry; sign without options for access token
    const accessToken = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      roles: user.roles,
      tokenType: 'access',
    });

    // For refresh token, override expiresIn using properly-typed SignOptions['expiresIn']
    const refreshToken = this.jwtService.sign(
      {
        sub: user.id,
        email: user.email,
        roles: user.roles,
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
}
