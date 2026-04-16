import type Redis from 'ioredis';
import { getTenantPrefix } from './tenant_prefix';

export class StatsService {
  constructor(private readonly redis: Redis) {}

  async ensureStarted(tenantId?: string): Promise<void> {
    const p = getTenantPrefix(tenantId);
    const key = `shield:${p}stats:started_at`;
    const exists = await this.redis.exists(key);
    if (!exists) {
      await this.redis.set(key, String(Date.now()));
    }
  }

  async incrementRequests(tenantId?: string): Promise<void> {
    const p = getTenantPrefix(tenantId);
    await this.redis.incr(`shield:${p}stats:total_requests`);
  }

  async incrementValid(tenantId?: string): Promise<void> {
    const p = getTenantPrefix(tenantId);
    await this.redis.incr(`shield:${p}stats:total_valid`);
  }

  async incrementBlocked(vector: string, tenantId?: string): Promise<void> {
    const p = getTenantPrefix(tenantId);
    await this.redis.incr(`shield:${p}stats:total_blocked`);
    await this.redis.incr(`shield:${p}stats:attack:${vector}`);
  }

  async getSummary(tenantId?: string): Promise<{
    total_requests: number;
    total_blocked: number;
    total_valid: number;
    block_rate_percent: number;
    attacks_by_type: Record<string, number>;
    blocked_ips: number;
    uptime_seconds: number;
  }> {
    const p = getTenantPrefix(tenantId);
    const started = await this.redis.get(`shield:${p}stats:started_at`);
    const uptime = started ? Math.floor((Date.now() - Number(started)) / 1000) : 0;
    const total = Number((await this.redis.get(`shield:${p}stats:total_requests`)) ?? 0);
    const blocked = Number((await this.redis.get(`shield:${p}stats:total_blocked`)) ?? 0);
    const valid = Number((await this.redis.get(`shield:${p}stats:total_valid`)) ?? 0);
    const keys = await this.redis.keys(`shield:${p}stats:attack:*`);
    const attacks_by_type: Record<string, number> = {};
    for (const k of keys) {
      const parts = k.split(':');
      const vector = parts[parts.length - 1];
      attacks_by_type[vector] = Number((await this.redis.get(k)) ?? 0);
    }
    const blockedKeys = await this.redis.keys(`shield:${p}ip:block:*`);
    const block_rate = total > 0 ? Math.round((blocked / total) * 10000) / 100 : 0;
    return {
      total_requests: total,
      total_blocked: blocked,
      total_valid: valid,
      block_rate_percent: block_rate,
      attacks_by_type,
      blocked_ips: blockedKeys.length,
      uptime_seconds: uptime,
    };
  }
}
