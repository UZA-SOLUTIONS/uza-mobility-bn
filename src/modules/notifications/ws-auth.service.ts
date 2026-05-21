import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Socket } from 'socket.io';
import { PrismaService } from '../../prisma/prisma.service';
import { RbacService } from '../auth/rbac.service';
import type { JwtUserPayload } from '../../users/users.types';

@Injectable()
export class WsAuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly rbacService: RbacService,
  ) {}

  extractToken(client: Socket): string | null {
    const authToken = client.handshake.auth?.token;
    if (typeof authToken === 'string' && authToken.length > 0) {
      return authToken;
    }

    const queryToken = client.handshake.query?.token;
    if (typeof queryToken === 'string' && queryToken.length > 0) {
      return queryToken;
    }

    const header = client.handshake.headers.authorization;
    if (typeof header === 'string' && header.startsWith('Bearer ')) {
      return header.slice(7);
    }

    return null;
  }

  async authenticate(client: Socket): Promise<JwtUserPayload | null> {
    const token = this.extractToken(client);
    if (!token) {
      return null;
    }

    try {
      const payload = await this.jwtService.verifyAsync<{
        sub: string;
        email?: string;
        tokenType?: string;
        iat?: number;
        exp?: number;
      }>(token, {
        secret: this.configService.getOrThrow<string>('JWT_SECRET'),
      });

      if (payload.tokenType !== 'access') {
        return null;
      }

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        include: { roles: { include: { role: true } } },
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
    } catch {
      return null;
    }
  }
}
