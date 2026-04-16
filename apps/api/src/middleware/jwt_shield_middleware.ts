import type { Request, Response, NextFunction } from 'express';
import type { JWTShield } from '@jwt-shield/core';
import type { StatsService } from '../services/stats_service';
import type { AttackLogger } from '../services/attack_logger';
import type { IpReputationService } from '../services/ip_reputation';
import { fingerprintContextFromRequest } from './fingerprint';
import { createHash } from 'crypto';

function tokenFingerprint(token: string): string {
  return createHash('sha256').update(token.slice(0, 20), 'utf8').digest('hex');
}

export function jwtShieldMiddleware(
  shield: JWTShield,
  stats: StatsService,
  attacks: AttackLogger,
  ipSvc: IpReputationService
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    await stats.incrementRequests();
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const raw = auth.slice('Bearer '.length).trim();
    const ctx = fingerprintContextFromRequest(req);
    const result = await shield.validate(raw, ctx);

    if (!result.valid) {
      await stats.incrementBlocked(result.attackVector);
      const ip = ctx.ip ?? 'unknown';
      await ipSvc.recordRejected(ip);
      const ipAttack = await ipSvc.recordAttack(ip, result.attackVector);
      await attacks.log({
        timestamp: new Date().toISOString(),
        event_type: 'JWT_ATTACK_BLOCKED',
        attack_vector: result.attackVector,
        source_ip: ip,
        attempted_algorithm: null,
        token_fingerprint: tokenFingerprint(raw),
        user_agent: ctx.userAgent ?? '',
        blocked: true,
        detail: result.message,
      });
      if (ipAttack.blocked || ipAttack.permanent) {
        attacks.emitIpBlocked(ip, ipAttack.permanent);
      }
      res.status(403).json({ error: 'Forbidden', code: result.attackVector });
      return;
    }

    // ✅ Token is valid — log the successful request
    await stats.incrementValid();
    const ip = ctx.ip ?? 'unknown';
    const subject = typeof result.payload.sub === 'string' ? result.payload.sub : 'unknown';
    await attacks.log({
      timestamp: new Date().toISOString(),
      event_type: 'JWT_REQUEST_VALID',
      attack_vector: 'none',
      source_ip: ip,
      attempted_algorithm: null,
      token_fingerprint: tokenFingerprint(raw),
      user_agent: ctx.userAgent ?? '',
      blocked: false,
      detail: `Authenticated as ${subject}`,
      subject,
    });

    (req as Request & { shieldPayload?: Record<string, unknown> }).shieldPayload = result.payload;
    next();
  };
}
