import { config as dotenvConfig } from 'dotenv';
import { z } from 'zod';
import path from 'path';
import fs from 'fs';

/** Resolve the apps/api root reliably regardless of how tsx resolves __dirname. */
function findApiRoot(): string {
  // Candidate 1: __dirname-based (works in normal CJS mode)
  const candidate1 = path.join(__dirname, '..', '..');
  // Candidate 2: process.cwd() (works when run from monorepo root via pnpm filter)
  const candidate2 = path.resolve(process.cwd(), 'apps', 'api');
  // Candidate 3: process.cwd() IS the api dir
  const candidate3 = process.cwd();

  for (const c of [candidate1, candidate2, candidate3]) {
    if (fs.existsSync(path.join(c, '.env')) || fs.existsSync(path.join(c, 'package.json'))) {
      return c;
    }
  }
  // Fallback
  return candidate1;
}

const root = findApiRoot();
dotenvConfig({ path: path.join(root, '.env') });

const envSchema = z.object({
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  /** When true, use in-memory Redis (ioredis-mock) + memory JWT blacklist — no redis-server required. */
  REDIS_MEMORY: z
    .string()
    .default('false')
    .transform((v) => v === 'true' || v === '1'),
  JWT_ALGORITHM: z.string().default('RS256'),
  JWT_ALLOWED_ALGORITHMS: z.string().default('RS256,ES256'),
  JWT_PUBLIC_KEY_PATH: z.string().default('./keys/public.pem'),
  JWT_PRIVATE_KEY_PATH: z.string().default('./keys/private.pem'),
  JWT_ALLOWED_ISSUERS: z.string().default('jwt-shield-demo'),
  JWT_ALLOWED_AUDIENCES: z.string().default('jwt-shield-api'),
  JWT_MAX_TOKEN_AGE_SECONDS: z.coerce.number().default(86400),
  JWT_KEY_IDS: z.string().default('v1,v2'),
  JWT_ACTIVE_KEY_ID: z.string().default('v2'),
  IP_WARN_THRESHOLD: z.coerce.number().default(5),
  IP_BLOCK_THRESHOLD: z.coerce.number().default(10),
  IP_ATTACK_PERMANENT_THRESHOLD: z.coerce.number().default(3),
  IP_BLOCK_DURATION_SECONDS: z.coerce.number().default(3600),
  ENABLE_FINGERPRINT_BINDING: z
    .string()
    .default('true')
    .transform((v) => v === 'true' || v === '1'),
  DASHBOARD_ORIGIN: z.string().default('http://localhost:5173'),
  DEMO_USERNAME: z.string().default('demo'),
  DEMO_PASSWORD: z.string().default('demo'),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error(parsed.error.flatten());
  throw new Error('Invalid environment');
}

export const env = parsed.data;

export function resolvePath(p: string): string {
  if (path.isAbsolute(p)) return p;
  return path.join(root, p);
}

export function loadKeyMaterial(): {
  allowedAlgorithms: string[];
  keys: { kid: string; publicKey: string; privateKey: string; active: boolean }[];
  activeKid: string;
  maxTokenAgeSecs: number;
  issuers: string[];
  audiences: string[];
} {
  const kids = env.JWT_KEY_IDS.split(',').map((k) => k.trim()).filter(Boolean);
  const activeKid = env.JWT_ACTIVE_KEY_ID.trim();
  const pubPath = resolvePath(env.JWT_PUBLIC_KEY_PATH);
  const privPath = resolvePath(env.JWT_PRIVATE_KEY_PATH);
  const publicKey = fs.readFileSync(pubPath, 'utf8');
  const privateKey = fs.readFileSync(privPath, 'utf8');

  const keys = kids.map((kid) => ({
    kid,
    publicKey,
    privateKey,
    active: kid === activeKid,
  }));

  return {
    allowedAlgorithms: env.JWT_ALLOWED_ALGORITHMS.split(',').map((a) => a.trim()).filter(Boolean),
    keys,
    activeKid,
    maxTokenAgeSecs: env.JWT_MAX_TOKEN_AGE_SECONDS,
    issuers: env.JWT_ALLOWED_ISSUERS.split(',').map((s) => s.trim()),
    audiences: env.JWT_ALLOWED_AUDIENCES.split(',').map((s) => s.trim()),
  };
}
