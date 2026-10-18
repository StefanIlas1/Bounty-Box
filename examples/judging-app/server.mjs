import http from 'node:http';
import {randomBytes, createHash, timingSafeEqual} from 'node:crypto';

const token = process.env.BOUNTYBOX_INGRESS_TOKEN;
const namespace = process.env.BOUNTYBOX_TRIAL_NAMESPACE;
let endpoint, publicOrigin;
try {
  if (!token || !/^[a-zA-Z0-9_]{1,48}$/.test(namespace || '')) throw new Error();
  const db = new URL(process.env.NEON_DATABASE_URL);
  if (!['postgres:', 'postgresql:'].includes(db.protocol) || !db.hostname.endsWith('.neon.tech')) throw new Error();
  const labels = db.hostname.split('.');
  labels[0] = 'api';
  endpoint = `https://${labels.join('.')}/sql`;
  const origin = new URL(process.env.BOUNTYBOX_PUBLIC_ORIGIN);
  if (origin.protocol !== 'https:' || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) throw new Error();
  publicOrigin = origin.origin;
} catch {
  console.error('Required configuration is missing or invalid.');
  process.exit(1);
}
const table = `"waitlist_${namespace}"`;
async function sql(query, params = []) {
  const response = await fetch(endpoint, {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(8000),
    headers: {'Neon-Connection-String': process.env.NEON_DATABASE_URL, 'Content-Type': 'application/json', 'Neon-Array-Mode': 'true', 'Neon-Raw-Text-Output': 'true'},
    body: JSON.stringify({query, params})
  });
  if (!response.ok) { await response.body?.cancel(); throw new Error('Database unavailable'); }
  const result = await response.json();
  if (!Array.isArray(result.rows)) throw new Error('Database unavailable');
  return result;
}
try {
  await sql(`CREATE TABLE IF NOT EXISTS ${table} (email TEXT PRIMARY KEY, created_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
} catch {
  console.error('Database initialization failed.');
  process.exit(1);
}
const hash = value => createHash('sha256').update(value).digest();
const expected = hash(`Bearer ${token}`);
const authorized = req => timingSafeEqual(hash(req.headers.authorization || ''), expected);
function json(res, status, body) {
  res.writeHead(status, {'Content-Type': 'application/json; charset=utf-8'});
  res.end(JSON.stringify(body));
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0, chunks = [], exceeded = false;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > 16384) {
        if (!exceeded) { exceeded = true; chunks = []; reject(Object.assign(new Error(), {status: 413})); }
      } else if (!exceeded) chunks.push(chunk);
    });
    req.on('end', () => {
      if (exceeded) return;
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { reject(Object.assign(new Error(), {status: 400})); }
    });
    req.on('error', () => reject(Object.assign(new Error(), {status: 400})));
    req.on('aborted', () => reject(Object.assign(new Error(), {status: 400})));
  });
}
function normalize(body) {
  if (!body || typeof body.email !== 'string') return null;
  const email = body.email.trim().toLowerCase();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}
async function signup(req, res, isPublic) {
  if ((req.headers['content-type'] || '').split(';')[0].trim().toLowerCase() !== 'application/json') return json(res, 415, {error: 'Send JSON with an email address.'});
  const email = normalize(await readBody(req));
  if (!email) return json(res, 400, {error: 'Enter a valid email address.'});
  const result = await sql(`INSERT INTO ${table} (email) VALUES ($1) ON CONFLICT (email) DO NOTHING RETURNING email`, [email]);
  const row = result.rows[0];
  json(res, row ? 201 : 200, isPublic ? {ok: true, message: 'You’re on the list! We’ll be in touch with early access.'} : {ok: true, created: Boolean(row)});
}
const rates = new Map();
function allow(ip) {
  const now = Date.now();
  let entry = rates.get(ip);
  if (entry && entry.until <= now) { rates.delete(ip); entry = undefined; }
  if (!entry) {
    if (rates.size >= 10000) {
      for (const [key, value] of rates) if (value.until <= now) rates.delete(key);
      if (rates.size >= 10000) return false;
    }
    entry = {until: now + 60000, count: 0};
    rates.set(ip, entry);
  }
  return ++entry.count <= 10;
}
function sameOrigin(req) {
  const supplied = req.headers.origin;
  if (supplied === undefined) return true;
  if (typeof supplied !== 'string') return false;
  try {
    const origin = new URL(supplied);
    return supplied === origin.origin && origin.origin === publicOrigin;
  } catch { return false; }
}
function page(nonce) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#0b1223"><title>Bounty-Box — Early Access</title><style nonce="${nonce}">
*{box-sizing:border-box}body{margin:0;background:#0b1223;color:#f5f3ec;font-family:system-ui,-apple-system,sans-serif;min-height:100svh;display:flex;flex-direction:column}header,footer{padding:28px clamp(24px,7vw,110px)}header{font-weight:800;letter-spacing:.04em;display:flex;align-items:center;gap:12px}.mark{background:#e9bd67;color:#0b1223;padding:8px 12px;border-radius:10px}main{flex:1;width:min(100%,1000px);margin:auto;padding:60px 24px 80px;text-align:center}.badge{display:inline-block;border:1px solid #675838;border-radius:30px;padding:9px 16px;color:#e9bd67;font-size:13px;letter-spacing:.08em;text-transform:uppercase}h1{font-size:clamp(42px,7vw,78px);line-height:1.06;letter-spacing:-.055em;margin:28px 0}h1 span{color:#e9bd67}.intro{color:#b6c0d3;font-size:clamp(17px,2.2vw,21px);line-height:1.7;max-width:620px;margin:0 auto 32px}.card{max-width:580px;margin:auto;padding:26px;background:#111d33;border:1px solid #2a3750;border-radius:20px;box-shadow:0 24px 70px #0003}label{display:block;text-align:left;font-size:14px;margin-bottom:10px;color:#dce2ed}.fields{display:flex;gap:10px}input{min-width:0;flex:1;background:#0b1223;border:1px solid #45516a;color:white;border-radius:9px;padding:15px;font:inherit}button{border:0;border-radius:9px;background:#e9bd67;color:#161b27;font:700 15px system-ui;padding:15px 20px;cursor:pointer}button:hover{background:#f5ce83}button:disabled{opacity:.6;cursor:wait}input:focus-visible,button:focus-visible{outline:3px solid #e9bd67;outline-offset:3px}.note{font-size:12px;color:#a6b2c6;margin:15px 0 0}#status{min-height:44px;line-height:1.5;margin:16px 0 0;color:#e9bd67}.benefits{display:flex;justify-content:center;gap:26px;flex-wrap:wrap;color:#b6c0d3;font-size:14px;margin-top:32px}footer{font-size:12px;color:#8d9ab0;border-top:1px solid #202c42;display:flex;justify-content:space-between;gap:16px}@media(max-width:520px){main{padding-top:30px}.fields{flex-direction:column}.card{padding:20px}footer{flex-direction:column}.benefits{gap:14px}}
</style></head><body><header><span class="mark" aria-hidden="true">B</span>BOUNTY-BOX</header><main><div class="badge">Built for ambitious founders</div><h1>Build big.<br><span>Stay under budget.</span></h1><p class="intro">Turn your next big idea into working software. Let AI build within your budget, so you can focus on what comes next.</p><section class="card" aria-label="Join early access"><form id="waitlist"><label for="email">Your email address</label><div class="fields"><input id="email" name="email" type="email" autocomplete="email" placeholder="you@company.com" maxlength="254" required><button id="submit" type="submit">Join early access</button></div><p class="note">Early access updates. No noise. Just your next big step.</p><p id="status" role="status" aria-live="polite"></p></form></section><div class="benefits"><span>✦ Your idea, brought to life</span><span>✦ Your budget, respected</span></div></main><footer><span>© Bounty-Box</span><span>Big ideas deserve a starting line.</span></footer><script nonce="${nonce}">
const form=document.getElementById('waitlist'),button=document.getElementById('submit'),status=document.getElementById('status');
form.addEventListener('submit',async event=>{event.preventDefault();button.disabled=true;button.textContent='Joining…';status.textContent='';try{const response=await fetch('/join',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:document.getElementById('email').value}),signal:AbortSignal.timeout(12000)});if(!response.ok){status.textContent=response.status===429?'Too many attempts. Please try again in a minute.':'We couldn’t save your email. Check your address and try again.';return;}status.textContent='You’re on the list! We’ll be in touch with early access.';form.reset();}catch{status.textContent='We couldn’t connect. Please try again.';}finally{button.disabled=false;button.textContent='Join early access';}});
</script></body></html>`;
}
const server = http.createServer(async (req, res) => {
  const nonce = randomBytes(18).toString('base64');
  res.setHeader('Content-Security-Policy', `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  try {
    const path = new URL(req.url, 'http://localhost').pathname;
    if (['/health', '/signups', '/stats'].includes(path) && !authorized(req)) return json(res, 401, {error: 'Unauthorized'});
    if (path === '/' && req.method === 'GET') { res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'}); return res.end(page(nonce)); }
    if (path === '/health' && req.method === 'GET') return json(res, 200, {ok: true, artifactDigest: process.env.BOUNTYBOX_ARTIFACT_DIGEST});
    if (path === '/stats' && req.method === 'GET') {
      const result = await sql(`SELECT COUNT(*) FROM ${table}`);
      return json(res, 200, {count: Number(result.rows[0][0])});
    }
    if (path === '/join' && req.method === 'POST') {
      if (!sameOrigin(req)) return json(res, 403, {error: 'Origin not allowed'});
      if (!allow(req.socket.remoteAddress || 'unknown')) { res.setHeader('Retry-After', '60'); return json(res, 429, {error: 'Please try again in a minute.'}); }
      return await signup(req, res, true);
    }
    if (path === '/signups' && req.method === 'POST') return await signup(req, res, false);
    json(res, 404, {error: 'Not found'});
  } catch (error) {
    const status = error.status === 413 ? 413 : error.status === 400 ? 400 : 503;
    if (!res.headersSent && !res.destroyed) json(res, status, {error: status === 413 ? 'Request body too large.' : status === 400 ? 'Invalid JSON.' : 'Service temporarily unavailable.'});
  }
});
server.requestTimeout = 15000;
server.headersTimeout = 10000;
server.keepAliveTimeout = 5000;
server.on('error', () => { console.error('Server failed.'); process.exit(1); });
server.listen(Number(process.env.PORT || 3000), '0.0.0.0');
