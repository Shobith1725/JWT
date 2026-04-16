import Redis from 'ioredis';
import RedisMock from 'ioredis-mock';
import { env } from './env';

let client: Redis | null = null;

export function getRedis(): Redis {
  if (!client) {
    if (env.REDIS_MEMORY) {
      client = new RedisMock() as unknown as Redis;
      console.warn('[api] REDIS_MEMORY=true — using in-memory Redis (dev only). Data resets when the process exits.');
    } else {
      client = new Redis(env.REDIS_URL, {
        maxRetriesPerRequest: 3,
        lazyConnect: false,
        retryStrategy(times: number) {
          if (times > 5) {
            console.error(`[api] Redis connection failed after ${times} attempts. Giving up.`);
            return null;
          }
          return Math.min(times * 200, 2000);
        },
      });

      client.on('error', (err) => {
        console.error('[api] Redis error:', err.message);
      });

      client.on('connect', () => {
        console.log('[api] Connected to Redis');
      });
    }
  }
  return client;
}
