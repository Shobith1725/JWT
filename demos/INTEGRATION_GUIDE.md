# JWT Shield — External App Integration Guide

How to connect **any webapp** (in any directory, any framework) to JWT Shield
so its attacks show up on the dashboard under your own private tenant.

---

## How it works

```
Your webapp (anywhere)              JWT Shield (localhost:3001)
──────────────────────              ───────────────────────────
request comes in
  → you validate the JWT
  → attack detected?
  → POST /enterprise/ingest  ──────→ logs under your tenant namespace
    X-Shield-Key: <your key>
                                    JWT Shield Dashboard (localhost:5173)
                                      → enter your API key
                                      → see only your app's attacks ✅
```

Your app never needs to be in this directory.
It just needs HTTP access to the JWT Shield API.

---

## Step 1 — Start JWT Shield

```bash
# inside this directory
pnpm dev:api
```

API is now running at `http://localhost:3001`.

---

## Step 2 — Register your webapp as a tenant

Run this once. Keep the API key it returns — it won't be shown again.

```bash
curl -X POST http://localhost:3001/enterprise/register \
  -H "Content-Type: application/json" \
  -d "{\"name\": \"Your App Name\"}"
```

Response:
```json
{
  "apiKey": "jwtshield_live_xxxxxxxxxxxxxxxx",
  "tenant": {
    "tenantId": "tenant_abc123",
    "name": "Your App Name",
    "createdAt": "2026-04-15T10:00:00.000Z"
  }
}
```

---

## Step 3 — Add the reporter to your webapp

Drop this block into your app. No packages to install — just `fetch`.

```js
// ── JWT Shield reporter ───────────────────────────────────────────
const SHIELD_URL = 'http://localhost:3001';  // change if deployed
const SHIELD_KEY = 'jwtshield_live_xxxxxx';  // your key from Step 2

const _shieldQueue = [];

setInterval(async () => {
  if (!_shieldQueue.length) return;
  const batch = _shieldQueue.splice(0, 100);
  try {
    await fetch(`${SHIELD_URL}/enterprise/ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shield-Key': SHIELD_KEY,
      },
      body: JSON.stringify({ events: batch }),
    });
  } catch (_) { /* fire and forget */ }
}, 1000);

function reportToShield(event) {
  _shieldQueue.push(event);
}
// ─────────────────────────────────────────────────────────────────
```

---

## Step 4 — Report events from your routes

**When a request is blocked (attack detected):**
```js
reportToShield({
  timestamp:           new Date().toISOString(),
  source_ip:           req.ip ?? req.socket.remoteAddress,
  user_agent:          req.headers['user-agent'] ?? '',
  token_fingerprint:   req.headers.authorization?.slice(7, 27) ?? '',
  blocked:             true,
  attack_vector:       'ALGORITHM_DOWNGRADE', // what you detected
  attempted_algorithm: 'HS256',               // optional
  detail:              'HS256 is not allowed', // optional
});
```

**When a request is allowed (valid JWT):**
```js
reportToShield({
  timestamp:        new Date().toISOString(),
  source_ip:        req.ip ?? req.socket.remoteAddress,
  user_agent:       req.headers['user-agent'] ?? '',
  token_fingerprint: req.headers.authorization?.slice(7, 27) ?? '',
  blocked:          false,
  attack_vector:    'none',
});
```

---

## Attack vectors to use

| What you detected              | `attack_vector` value     |
|-------------------------------|---------------------------|
| `alg: none` in header         | `NONE_ALGORITHM`          |
| Wrong algorithm (e.g. HS256)  | `ALGORITHM_DOWNGRADE`     |
| Suspicious `kid` value        | `KID_INJECTION`           |
| `jku` / `jwk` / `x5u` in header | `KEY_CONFUSION`        |
| Reused token (replay)         | `REPLAY_ATTACK`           |
| Broken token structure        | `MALFORMED_TOKEN`         |
| Signature verification failed | `INVALID_SIGNATURE`       |
| Token is expired              | `TOKEN_EXPIRED`           |

---

## Step 5 — View your dashboard

1. Start the dashboard: `pnpm dev:dashboard`
2. Open `http://localhost:5173`
3. Paste your API key into the input in the top-right corner
4. Click **Connect**

You will see only your app's traffic — stats, blocked IPs, attack breakdown, live event feed.

---

## Verify the connection

```bash
# Check your tenant record is valid
curl http://localhost:3001/enterprise/me \
  -H "X-Shield-Key: jwtshield_live_xxxxxx"

# Send a test attack event manually
curl -X POST http://localhost:3001/enterprise/ingest \
  -H "Content-Type: application/json" \
  -H "X-Shield-Key: jwtshield_live_xxxxxx" \
  -d '{
    "events": [{
      "timestamp": "2026-04-15T10:00:00.000Z",
      "source_ip": "1.2.3.4",
      "user_agent": "test",
      "token_fingerprint": "abc123",
      "blocked": true,
      "attack_vector": "NONE_ALGORITHM",
      "detail": "test event"
    }]
  }'
```

If the dashboard shows the event, everything is wired up correctly.

---

## Ingest API reference

**`POST /enterprise/ingest`**

Headers:
- `X-Shield-Key: <your api key>` — required
- `Content-Type: application/json`

Body:
```json
{
  "events": [
    {
      "timestamp":           "ISO 8601 string — required",
      "source_ip":           "string — required",
      "blocked":             "boolean — required",
      "user_agent":          "string — optional",
      "token_fingerprint":   "string — optional",
      "attack_vector":       "string — optional, defaults to 'unknown'",
      "attempted_algorithm": "string | null — optional",
      "detail":              "string — optional"
    }
  ]
}
```

- Max 100 events per request
- Batching is recommended (flush every 1s as shown above)

Response:
```json
{ "accepted": 1, "total": 1 }
```
