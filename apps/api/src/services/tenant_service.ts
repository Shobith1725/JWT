import { randomBytes } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import type Redis from 'ioredis';

export interface TenantRecord {
  tenantId: string;
  name: string;
  apiKey: string;
  createdAt: string;
}

function generateApiKey(): string {
  return `jwtshield_live_${randomBytes(24).toString('hex')}`;
}

export class TenantService {
  constructor(private readonly redis: Redis) {}

  async registerTenant(name: string): Promise<TenantRecord> {
    const tenantId = `tenant_${uuidv4().replace(/-/g, '').slice(0, 16)}`;
    const apiKey = generateApiKey();
    const record: TenantRecord = {
      tenantId,
      name,
      apiKey,
      createdAt: new Date().toISOString(),
    };
    await this.redis.set(`shield:apikey:${apiKey}`, JSON.stringify(record));
    return record;
  }

  async lookupTenant(apiKey: string): Promise<TenantRecord | null> {
    const raw = await this.redis.get(`shield:apikey:${apiKey}`);
    if (!raw) return null;
    return JSON.parse(raw) as TenantRecord;
  }
}
