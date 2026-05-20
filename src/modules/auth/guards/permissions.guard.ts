import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      user?: { permissions?: string[] };
    }>();
    const userPermissions = request.user?.permissions ?? [];

    const allowed = requiredPermissions.every(
      (permission) =>
        userPermissions.includes(permission) || userPermissions.includes('*'),
    );

    if (!allowed) {
      throw new ForbiddenException('Insufficient permission');
    }

    return true;
  }
}
