import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, from } from 'rxjs';
import { map, mergeMap } from 'rxjs/operators';
import type { Request } from 'express';
import { AuditService } from './audit.service';
import { AUDIT_ACTION_KEY } from './decorators/audited.decorator';
import { SKIP_AUDIT_KEY } from './decorators/skip-audit.decorator';
import { getRequestAuditContext } from './request-context.util';
import type { JwtUserPayload } from '../../users/users.types';

const MUTATION_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly auditService: AuditService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const method = request.method.toUpperCase();

    if (!MUTATION_METHODS.has(method)) {
      return next.handle();
    }

    const skipAudit = this.reflector.getAllAndOverride<boolean>(
      SKIP_AUDIT_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (skipAudit) {
      return next.handle();
    }

    const customAction = this.reflector.getAllAndOverride<string>(
      AUDIT_ACTION_KEY,
      [context.getHandler(), context.getClass()],
    );

    const auditContext = getRequestAuditContext(request);
    const user = request.user as JwtUserPayload | undefined;

    return next.handle().pipe(
      mergeMap((data) =>
        from(
          this.auditService.record({
            userId: user?.sub,
            action: customAction ?? this.inferAction(method, request),
            entity: this.inferEntity(request),
            ipAddress: auditContext.ipAddress,
            userAgent: auditContext.userAgent,
            metadata: {
              email: auditContext.actorEmail,
              method,
              path: request.originalUrl ?? request.url,
            },
          }),
        ).pipe(map(() => data)),
      ),
    );
  }

  private inferAction(method: string, request: Request): string {
    const path = (request.route?.path as string | undefined) ?? request.url;
    return `http:${method}:${path}`;
  }

  private inferEntity(request: Request): string | undefined {
    const path = request.originalUrl ?? request.url;

    if (path.startsWith('/auth')) return 'Auth';
    if (path.startsWith('/users')) return 'User';
    if (path.startsWith('/admin')) return 'Admin';

    return undefined;
  }
}
