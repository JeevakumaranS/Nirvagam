import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { TenantContextStorage } from './tenant-context.storage';
import { TenantContext } from './tenancy.types';

@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const tenantCtx = (req as any).tenant as TenantContext | undefined;
    if (tenantCtx) {
      TenantContextStorage.run(tenantCtx, () => next());
    } else {
      next();
    }
  }
}
