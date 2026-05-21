import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

function isPaginatedResult(
  data: unknown,
): data is { items: unknown; meta: Record<string, unknown> } {
  return (
    data !== null &&
    typeof data === 'object' &&
    'items' in data &&
    'meta' in data &&
    Array.isArray((data as { items: unknown }).items) &&
    typeof (data as { meta: unknown }).meta === 'object' &&
    (data as { meta: unknown }).meta !== null
  );
}

@Injectable()
export class TransformResponseInterceptor implements NestInterceptor {
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiSuccessResponse> {
    return next.handle().pipe(
      map((data) => {
        if (
          data !== null &&
          typeof data === 'object' &&
          'success' in data &&
          typeof (data as ApiSuccessResponse).success === 'boolean'
        ) {
          return data as ApiSuccessResponse;
        }

        if (isPaginatedResult(data)) {
          return {
            success: true as const,
            data: data.items,
            meta: data.meta,
          };
        }

        return {
          success: true as const,
          data,
        };
      }),
    );
  }
}
