import type { Request, Response, NextFunction } from 'express';
import type { TenantService } from '../services/tenant_service';

// Extend Express Request to carry tenantId downstream
declare global {
  namespace Express {
    interface Request {
      tenantId?: string;
    }
  }
}

export function tenantAuthMiddleware(tenantSvc: TenantService) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const apiKey = req.headers['x-shield-key'];

    // No key → single-tenant / global mode, pass through unchanged
    if (!apiKey) {
      next();
      return;
    }

    if (typeof apiKey !== 'string') {
      res.status(401).json({ error: 'Invalid X-Shield-Key header' });
      return;
    }

    const tenant = await tenantSvc.lookupTenant(apiKey);
    if (!tenant) {
      res.status(401).json({ error: 'Unknown API key' });
      return;
    }

    req.tenantId = tenant.tenantId;
    next();
  };
}
