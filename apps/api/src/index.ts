import express from 'express';
import http from 'http';
import cors from 'cors';
import { Server } from 'socket.io';
import rateLimit from 'express-rate-limit';
import { RedisStore, type RedisReply } from 'rate-limit-redis';
import { JWTShield } from '@jwt-shield/core';
import { env, loadKeyMaterial } from './config/env';
import { getRedis } from './config/redis';
import { StatsService } from './services/stats_service';
import { AttackLogger } from './services/attack_logger';
import { IpReputationService } from './services/ip_reputation';
import { ipBlockerMiddleware } from './middleware/ip_blocker';
import { jwtShieldMiddleware } from './middleware/jwt_shield_middleware';
import { createAuthRouter } from './routes/auth';
import { createProtectedRouter } from './routes/protected';
import { createDashboardRouter } from './routes/dashboard';
import { createEnterpriseRouter } from './routes/enterprise';
import { TenantService } from './services/tenant_service';

async function main() {
  const redis = getRedis();
  const stats = new StatsService(redis);
  const ipSvc = new IpReputationService(redis);
  const tenantSvc = new TenantService(redis);
  await stats.ensureStarted();

  const app = express();
  const server = http.createServer(app);
  const allowedOrigins = env.DASHBOARD_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean);
  const io = new Server(server, {
    cors: { origin: allowedOrigins, methods: ['GET', 'POST'] },
  });

  const attacks = new AttackLogger(redis, io);

  const keyMaterial = loadKeyMaterial();
  const shield = new JWTShield({
    allowedAlgorithms: keyMaterial.allowedAlgorithms,
    keys: keyMaterial.keys.map((k) => ({ kid: k.kid, publicKey: k.publicKey })),
    allowedIssuers: keyMaterial.issuers,
    allowedAudiences: keyMaterial.audiences,
    maxTokenAgeSecs: keyMaterial.maxTokenAgeSecs,
    blacklist: env.REDIS_MEMORY
      ? { type: 'memory' }
      : { type: 'redis', redisUrl: env.REDIS_URL },
    enableFingerprintBinding: env.ENABLE_FINGERPRINT_BINDING,
    clockSkewSeconds: 30,
  });

  app.use(
    cors({
      origin: allowedOrigins,
      credentials: true,
    })
  );
  app.use(express.json());
  app.use(ipBlockerMiddleware(ipSvc));

  const loginLimiter = rateLimit({
    windowMs: 60_000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    ...(!env.REDIS_MEMORY && {
      store: new RedisStore({
        sendCommand: (command: string, ...args: string[]) =>
          redis.call(command, ...args) as Promise<RedisReply>,
      }),
    }),
  });

  app.use('/auth', createAuthRouter(keyMaterial.keys, keyMaterial.activeKid, shield, loginLimiter));

  app.use('/enterprise', createEnterpriseRouter(tenantSvc, stats, attacks, ipSvc));

  app.use('/api/stats', createDashboardRouter(stats, attacks, ipSvc, shield, tenantSvc));

  const protectedApi = express.Router();
  protectedApi.use(jwtShieldMiddleware(shield, stats, attacks, ipSvc));
  protectedApi.use(createProtectedRouter());
  app.use('/api', protectedApi);

  io.on('connection', (socket) => {
    socket.on('subscribe_stats', () => {
      void socket.join('stats');
      void (async () => {
        const summary = await stats.getSummary();
        socket.emit('stats_update', summary);
      })();
    });
  });

  setInterval(() => {
    void (async () => {
      const summary = await stats.getSummary();
      io.to('stats').emit('stats_update', summary);
    })();
  }, 5000);

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  server.listen(env.PORT, () => {
    console.log(`JWT Shield API listening on port ${env.PORT}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
