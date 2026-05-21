import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../../prisma/prisma.service';
import { RbacService } from '../rbac.service';
import type { JwtUserPayload } from '../../../users/users.types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly rbacService: RbacService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: {
    sub: string;
    email?: string;
    tokenType?: string;
    iat?: number;
    exp?: number;
  }): Promise<JwtUserPayload | null> {
    if (payload.tokenType !== 'access') {
      return null;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user || !user.isActive || user.deletedAt) {
      return null;
    }

    const roles = user.roles.map((userRole) => userRole.role.name);
    const permissions =
      await this.rbacService.resolvePermissionsForRoleNames(roles);

    return {
      sub: user.id,
      email: user.email,
      roles,
      permissions,
      tokenType: 'access',
      iat: payload.iat ?? 0,
      exp: payload.exp ?? 0,
    };
  }
}
