import type Redis from 'ioredis';
import { env } from '../config/env';

const ATK_WINDOW_SEC = 3600;   // 1 hour — attack counts persist long enough to catch slow attackers
const REJ_WINDOW_SEC = 300;    // 5 minutes — rejection counts window
const PREF_REJ = 'shield:ip:rej:';
const PREF_ATK = 'shield:ip:atk:';
const PREF_BLOCK = 'shield:ip:block:';
const PREF_PERM = 'shield:ip:perm:';

export interface IpCheckResult {
  allowed: boolean;
  reason?: 'blocked' | 'permanent';
}

export class IpReputationService {
  constructor(private readonly redis: Redis) {}

  async check(ip: string): Promise<IpCheckResult> {
    const perm = await this.redis.get(PREF_PERM + ip);
    if (perm) return { allowed: false, reason: 'permanent' };
    const block = await this.redis.get(PREF_BLOCK + ip);
    if (block) return { allowed: false, reason: 'blocked' };
    return { allowed: true };
  }

  async recordRejected(ip: string): Promise<{ warn: boolean; blocked: boolean }> {
    const key = PREF_REJ + ip;
    const n = await this.redis.incr(key);
    // Sliding window: reset the timer on every new rejection
    await this.redis.expire(key, REJ_WINDOW_SEC);

    let blocked = false;
    let warn = false;
    if (n >= env.IP_BLOCK_THRESHOLD) {
      await this.redis.setex(PREF_BLOCK + ip, env.IP_BLOCK_DURATION_SECONDS, 'rejected_flood');
      blocked = true;
    } else if (n >= env.IP_WARN_THRESHOLD) {
      warn = true;
    }
    return { warn, blocked };
  }

  async recordAttack(ip: string, vector: string): Promise<{ permanent: boolean; blocked: boolean }> {
    const key = PREF_ATK + ip;
    const n = await this.redis.incr(key);
    // Sliding window: reset the timer on every new attack so slow attackers still get caught
    await this.redis.expire(key, ATK_WINDOW_SEC);

    let permanent = false;
    let blocked = false;
    if (n >= env.IP_ATTACK_PERMANENT_THRESHOLD) {
      await this.redis.set(PREF_PERM + ip, vector);
      // Also set the block key so it appears in the dashboard
      await this.redis.set(PREF_BLOCK + ip, `attack:${vector}`);
      permanent = true;
      blocked = true;
    }
    if (n >= env.IP_BLOCK_THRESHOLD) {
      await this.redis.setex(PREF_BLOCK + ip, env.IP_BLOCK_DURATION_SECONDS, `attack:${vector}`);
      blocked = true;
    }
    return { permanent, blocked };
  }

  async unblock(ip: string): Promise<void> {
    await this.redis.del(PREF_BLOCK + ip, PREF_PERM + ip, PREF_REJ + ip, PREF_ATK + ip);
  }

  async listBlocked(): Promise<
    { ip: string; reason: string; expiresAt: number | null; permanent: boolean }[]
  > {
    // Gather both block and permanent keys
    const blockKeys = await this.redis.keys(PREF_BLOCK + '*');
    const permKeys = await this.redis.keys(PREF_PERM + '*');
    const seen = new Set<string>();
    const out: { ip: string; reason: string; expiresAt: number | null; permanent: boolean }[] = [];

    for (const k of blockKeys) {
      const ip = k.slice(PREF_BLOCK.length);
      seen.add(ip);
      const reason = (await this.redis.get(k)) ?? 'unknown';
      const ttl = await this.redis.ttl(k);
      const perm = await this.redis.get(PREF_PERM + ip);
      out.push({
        ip,
        reason,
        expiresAt: ttl > 0 ? Date.now() + ttl * 1000 : null,
        permanent: Boolean(perm),
      });
    }

    // Include permanently blocked IPs not already in the block list
    for (const k of permKeys) {
      const ip = k.slice(PREF_PERM.length);
      if (seen.has(ip)) continue;
      const reason = (await this.redis.get(k)) ?? 'unknown';
      out.push({
        ip,
        reason,
        expiresAt: null,
        permanent: true,
      });
    }

    return out;
  }
}
