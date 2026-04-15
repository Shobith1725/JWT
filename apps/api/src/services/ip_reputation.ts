import type Redis from 'ioredis';
import { env } from '../config/env';
import { getTenantPrefix } from './tenant_prefix';

const WINDOW_SEC = 60;

export interface IpCheckResult {
  allowed: boolean;
  reason?: 'blocked' | 'permanent';
}

export class IpReputationService {
  constructor(private readonly redis: Redis) {}

  async check(ip: string, tenantId?: string): Promise<IpCheckResult> {
    const p = getTenantPrefix(tenantId);
    const perm = await this.redis.get(`shield:${p}ip:perm:${ip}`);
    if (perm) return { allowed: false, reason: 'permanent' };
    const block = await this.redis.get(`shield:${p}ip:block:${ip}`);
    if (block) return { allowed: false, reason: 'blocked' };
    return { allowed: true };
  }

  async recordRejected(ip: string, tenantId?: string): Promise<{ warn: boolean; blocked: boolean }> {
    const p = getTenantPrefix(tenantId);
    const key = `shield:${p}ip:rej:${ip}`;
    const n = await this.redis.incr(key);
    if (n === 1) await this.redis.expire(key, WINDOW_SEC);

    let blocked = false;
    let warn = false;
    if (n >= env.IP_BLOCK_THRESHOLD) {
      await this.redis.setex(`shield:${p}ip:block:${ip}`, env.IP_BLOCK_DURATION_SECONDS, 'rejected_flood');
      blocked = true;
    } else if (n >= env.IP_WARN_THRESHOLD) {
      warn = true;
    }
    return { warn, blocked };
  }

  async recordAttack(ip: string, vector: string, tenantId?: string): Promise<{ permanent: boolean; blocked: boolean }> {
    const p = getTenantPrefix(tenantId);
    const key = `shield:${p}ip:atk:${ip}`;
    const n = await this.redis.incr(key);
    if (n === 1) await this.redis.expire(key, WINDOW_SEC);

    let permanent = false;
    let blocked = false;
    if (n >= env.IP_ATTACK_PERMANENT_THRESHOLD) {
      await this.redis.set(`shield:${p}ip:perm:${ip}`, vector);
      await this.redis.set(`shield:${p}ip:block:${ip}`, `attack:${vector}`);
      permanent = true;
      blocked = true;
    }
    if (n >= env.IP_BLOCK_THRESHOLD) {
      await this.redis.setex(`shield:${p}ip:block:${ip}`, env.IP_BLOCK_DURATION_SECONDS, `attack:${vector}`);
      blocked = true;
    }
    return { permanent, blocked };
  }

  async unblock(ip: string, tenantId?: string): Promise<void> {
    const p = getTenantPrefix(tenantId);
    await this.redis.del(
      `shield:${p}ip:block:${ip}`,
      `shield:${p}ip:perm:${ip}`,
      `shield:${p}ip:rej:${ip}`,
      `shield:${p}ip:atk:${ip}`
    );
  }

  async listBlocked(tenantId?: string): Promise<
    { ip: string; reason: string; expiresAt: number | null; permanent: boolean }[]
  > {
    const p = getTenantPrefix(tenantId);
    const blockKeys = await this.redis.keys(`shield:${p}ip:block:*`);
    const permKeys = await this.redis.keys(`shield:${p}ip:perm:*`);
    const seen = new Set<string>();
    const out: { ip: string; reason: string; expiresAt: number | null; permanent: boolean }[] = [];

    for (const k of blockKeys) {
      const ip = k.slice(`shield:${p}ip:block:`.length);
      seen.add(ip);
      const reason = (await this.redis.get(k)) ?? 'unknown';
      const ttl = await this.redis.ttl(k);
      const perm = await this.redis.get(`shield:${p}ip:perm:${ip}`);
      out.push({
        ip,
        reason,
        expiresAt: ttl > 0 ? Date.now() + ttl * 1000 : null,
        permanent: Boolean(perm),
      });
    }

    for (const k of permKeys) {
      const ip = k.slice(`shield:${p}ip:perm:`.length);
      if (seen.has(ip)) continue;
      const reason = (await this.redis.get(k)) ?? 'unknown';
      out.push({ ip, reason, expiresAt: null, permanent: true });
    }

    return out;
  }
}
