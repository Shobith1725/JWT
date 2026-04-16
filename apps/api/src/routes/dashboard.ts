import { Router } from 'express';
import jwt from 'jsonwebtoken';
import type { JWTShield } from '@jwt-shield/core';
import type { StatsService } from '../services/stats_service';
import type { AttackLogger } from '../services/attack_logger';
import type { IpReputationService } from '../services/ip_reputation';
import type { TenantService } from '../services/tenant_service';
import { tenantAuthMiddleware } from '../middleware/tenant_auth';
import { fingerprintContextFromRequest } from '../middleware/fingerprint';

export function createDashboardRouter(
  stats: StatsService,
  attacks: AttackLogger,
  ipSvc: IpReputationService,
  shield: JWTShield,
  tenantSvc: TenantService
): Router {
  const router = Router();
  const tenantAuth = tenantAuthMiddleware(tenantSvc);

  router.get('/summary', tenantAuth, async (req, res) => {
    // Always return global stats — direct attacks go to global pipeline
    // If tenant-specific data exists, merge it in
    const globalSummary = await stats.getSummary();
    if (req.tenantId) {
      const tenantSummary = await stats.getSummary(req.tenantId);
      // Merge: add tenant-specific counts to global counts
      globalSummary.total_requests += tenantSummary.total_requests;
      globalSummary.total_blocked += tenantSummary.total_blocked;
      globalSummary.total_valid += tenantSummary.total_valid;
      for (const [k, v] of Object.entries(tenantSummary.attacks_by_type)) {
        globalSummary.attacks_by_type[k] = (globalSummary.attacks_by_type[k] ?? 0) + v;
      }
      globalSummary.block_rate_percent = globalSummary.total_requests > 0
        ? Math.round((globalSummary.total_blocked / globalSummary.total_requests) * 10000) / 100
        : 0;
    }
    res.json(globalSummary);
  });

  router.get('/events', tenantAuth, async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    // Merge global + tenant events, sorted by timestamp
    const globalEvents = await attacks.recent(limit);
    if (req.tenantId) {
      const tenantEvents = await attacks.recent(limit, req.tenantId);
      const merged = [...globalEvents, ...tenantEvents]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, limit);
      res.json(merged);
    } else {
      res.json(globalEvents);
    }
  });

  router.get('/blocked-ips', tenantAuth, async (_req, res) => {
    // Always show global blocked IPs (direct attacks block globally)
    const globalList = await ipSvc.listBlocked();
    if (_req.tenantId) {
      const tenantList = await ipSvc.listBlocked(_req.tenantId);
      const seen = new Set(globalList.map(r => r.ip));
      for (const r of tenantList) {
        if (!seen.has(r.ip)) globalList.push(r);
      }
    }
    res.json(globalList);
  });

  router.post('/unblock-ip', tenantAuth, async (req, res) => {
    const ip = req.body?.ip;
    if (typeof ip !== 'string') {
      res.status(400).json({ error: 'ip required' });
      return;
    }
    await ipSvc.unblock(ip);
    if (req.tenantId) {
      await ipSvc.unblock(ip, req.tenantId);
    }
    res.json({ success: true });
  });

  router.post('/inspect', async (req, res) => {
    const token = req.body?.token;
    if (typeof token !== 'string' || !token.trim()) {
      res.status(400).json({ error: 'token required' });
      return;
    }
    const raw = token.trim();
    const parts = raw.split('.');
    let headerJson: Record<string, unknown> | null = null;
    let payloadJson: Record<string, unknown> | null = null;
    try {
      if (parts[0]) {
        headerJson = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')) as Record<
          string,
          unknown
        >;
      }
      if (parts[1]) {
        payloadJson = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as Record<
          string,
          unknown
        >;
      }
    } catch {
      // leave nulls
    }

    const ctx = fingerprintContextFromRequest(req);
    const result = await shield.validateWithoutReplay(raw, ctx);

    const steps: { step: string; ok: boolean; detail?: string }[] = [];
    if (!headerJson) {
      steps.push({ step: 'header_decode', ok: false, detail: 'Could not decode header' });
    } else {
      steps.push({ step: 'header_decode', ok: true });
    }

    if (result.valid) {
      steps.push({ step: 'full_pipeline', ok: true });
    } else {
      steps.push({ step: 'full_pipeline', ok: false, detail: result.message });
    }

    res.json({
      valid: result.valid,
      attackVector: result.valid ? null : result.attackVector,
      message: result.valid ? undefined : result.message,
      header: headerJson,
      payload: payloadJson ?? (result.valid ? result.payload : jwt.decode(raw)),
      steps,
    });
  });

  return router;
}
