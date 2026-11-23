import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { TenantContextStorage } from './tenant-context.storage';

@Injectable()
export class TenantLoggerInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const startTime = Date.now();
    const { method, url } = req;

    const tenantCtx = TenantContextStorage.tryGet();
    const tenantTag = tenantCtx
      ? `[tenant=${tenantCtx.slug}:${tenantCtx.schemaName}] [user=${tenantCtx.userId || 'anon'}]`
      : '[platform]';

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          this.logger.log(`${tenantTag} ${method} ${url} completed in ${duration}ms`);
        },
        error: (err) => {
          const duration = Date.now() - startTime;
          this.logger.error(
            `${tenantTag} ${method} ${url} failed with [${err.status || 500}: ${err.message}] after ${duration}ms`
          );
        },
      })
    );
  }
}
