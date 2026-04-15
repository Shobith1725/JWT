import { Router, type Request, type Response } from 'express';
import { createHash } from 'crypto';
import type { TenantService } from '../services/tenant_service';
import type { StatsService } from '../services/stats_service';
import type { AttackLogger, AttackLogPayload } from '../services/attack_logger';
import type { IpReputationService } from '../services/ip_reputation';
import { tenantAuthMiddleware } from '../middleware/tenant_auth';

export function createEnterpriseRouter(
  tenantSvc: TenantService,
  stats: StatsService,
  attacks: AttackLogger,
  ipSvc: IpReputationService,
): Router {
  const router = Router();
  const tenantAuth = tenantAuthMiddleware(tenantSvc);

  // POST /enterprise/register — public, no auth required
  router.post('/register', async (req: Request, res: Response) => {
    const name = req.body?.name;
    if (typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'Company name is required' });
      return;
    }
    const tenant = await tenantSvc.registerTenant(name.trim());
    res.status(201).json({
      message: 'Tenant registered. Store your API key securely — it will not be shown again.',
      apiKey: tenant.apiKey,
      tenant: {
        tenantId: tenant.tenantId,
        name: tenant.name,
        createdAt: tenant.createdAt,
      },
    });
  });

  // GET /enterprise/me — requires valid X-Shield-Key
  router.get('/me', tenantAuth, async (req: Request, res: Response) => {
    const apiKey = req.headers['x-shield-key'] as string;
    const tenant = await tenantSvc.lookupTenant(apiKey);
    if (!tenant) {
      res.status(401).json({ error: 'Unknown API key' });
      return;
    }
    res.json({
      tenantId: tenant.tenantId,
      name: tenant.name,
      createdAt: tenant.createdAt,
    });
  });

  // POST /enterprise/ingest — called by external apps to report JWT events
  // Accepts an array of events; each event is either a valid request or an attack.
  // Body: { events: IngestEvent[] }
  router.post('/ingest', tenantAuth, async (req: Request, res: Response) => {
    const raw = req.body?.events;
    if (!Array.isArray(raw) || raw.length === 0) {
      res.status(400).json({ error: '`events` array is required and must not be empty' });
      return;
    }
    if (raw.length > 100) {
      res.status(400).json({ error: 'Maximum 100 events per request' });
      return;
    }

    const tenantId = req.tenantId!;
    let accepted = 0;

    for (const ev of raw) {
      // Validate minimum required fields
      if (
        typeof ev !== 'object' ||
        typeof ev.source_ip !== 'string' ||
        typeof ev.blocked !== 'boolean'
      ) {
        continue; // skip malformed entries, don't fail the whole batch
      }

      const ip: string = ev.source_ip;
      const blocked: boolean = ev.blocked;
      const vector: string = typeof ev.attack_vector === 'string' ? ev.attack_vector : 'unknown';
      const token: string = typeof ev.token_fingerprint === 'string'
        ? ev.token_fingerprint
        : createHash('sha256').update(String(Date.now())).digest('hex').slice(0, 16);

      // Always count the request
      await stats.incrementRequests(tenantId);

      if (blocked) {
        // Count the block + attack type
        await stats.incrementBlocked(vector, tenantId);

        // Update IP reputation
        await ipSvc.recordRejected(ip, tenantId);
        const ipResult = await ipSvc.recordAttack(ip, vector, tenantId);

        // Log the attack event
        const payload: AttackLogPayload = {
          timestamp: typeof ev.timestamp === 'string' ? ev.timestamp : new Date().toISOString(),
          event_type: 'JWT_ATTACK_BLOCKED',
          attack_vector: vector,
          source_ip: ip,
          attempted_algorithm: typeof ev.attempted_algorithm === 'string' ? ev.attempted_algorithm : null,
          token_fingerprint: token,
          user_agent: typeof ev.user_agent === 'string' ? ev.user_agent : '',
          blocked: true,
          detail: typeof ev.detail === 'string' ? ev.detail : undefined,
        };
        await attacks.log(payload, tenantId);

        if (ipResult.blocked || ipResult.permanent) {
          attacks.emitIpBlocked(ip, ipResult.permanent);
        }
      }

      accepted++;
    }

    res.json({ accepted, total: raw.length });
  });

  return router;
}
