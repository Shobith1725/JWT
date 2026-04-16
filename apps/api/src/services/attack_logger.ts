import type Redis from 'ioredis';
import type { Server as IOServer } from 'socket.io';
import winston from 'winston';
import type { AttackVector } from '@jwt-shield/core';
import { getTenantPrefix } from './tenant_prefix';

export type ShieldEventType = 'JWT_ATTACK_BLOCKED' | 'JWT_REQUEST_VALID';

export interface AttackLogPayload {
  timestamp: string;
  event_type: ShieldEventType;
  attack_vector: AttackVector | string;
  source_ip: string;
  attempted_algorithm: string | null;
  token_fingerprint: string;
  user_agent: string;
  blocked: boolean;
  detail?: string;
  /** Subject from the JWT payload — only populated for valid requests */
  subject?: string;
}

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console({ format: winston.format.json() })],
});

export class AttackLogger {
  constructor(
    private readonly redis: Redis,
    private readonly io: IOServer | null
  ) {}

  async log(event: AttackLogPayload, tenantId?: string): Promise<void> {
    const p = getTenantPrefix(tenantId);
    const key = `shield:${p}events`;
    const line = JSON.stringify(event);
    logger.info(line);
    await this.redis.lpush(key, line);
    await this.redis.ltrim(key, 0, 999);
    // Emit the right socket event based on type
    if (event.event_type === 'JWT_ATTACK_BLOCKED') {
      this.io?.emit('attack_event', event);
    } else {
      this.io?.emit('valid_event', event);
    }
  }

  emitIpBlocked(ip: string, permanent: boolean): void {
    this.io?.emit('ip_blocked', { ip, permanent });
  }

  async recent(limit: number, tenantId?: string): Promise<AttackLogPayload[]> {
    const p = getTenantPrefix(tenantId);
    const key = `shield:${p}events`;
    const rows = await this.redis.lrange(key, 0, limit - 1);
    return rows.map((r) => JSON.parse(r) as AttackLogPayload);
  }
}
