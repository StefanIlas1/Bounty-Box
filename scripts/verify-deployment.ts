import { readFile, stat } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

// A private receipt avoids exposing the verification token in command arguments.
// This makes one synthetic record and checks its normalized duplicate; no load test.
async function main() {
  const path = process.argv[2];
  if (!path) throw new Error('Supply a private JSON receipt path with url, token, digest and optional title');
  const metadata = await stat(path);
  if (!metadata.isFile() || metadata.size > 16_384 || (metadata.mode & 0o077)) throw new Error('Receipt must be a private file (chmod 600), at most 16 KiB');
  const receipt = JSON.parse(await readFile(path, 'utf8')) as { url?: string; token?: string; digest?: string; title?: string };
  if (typeof receipt.url !== 'string' || typeof receipt.token !== 'string' || receipt.token.length < 16 || typeof receipt.digest !== 'string' || !/^[a-f0-9]{64}$/.test(receipt.digest)) throw new Error('Receipt is missing valid verification fields');
  const base = new URL(receipt.url);
  if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash || base.pathname !== '/') throw new Error('Deployment URL must be an HTTPS origin');
  const signal = AbortSignal.timeout(60_000);
  async function request(pathname: string, authenticated = false, body?: unknown, origin = base.origin) {
    const response = await fetch(new URL(pathname, base), {
      method: body === undefined ? 'GET' : 'POST', redirect: 'error',
      signal: AbortSignal.any([signal, AbortSignal.timeout(12_000)]),
      headers: { ...(authenticated ? { Authorization: `Bearer ${receipt.token}` } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json', Origin: origin }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const reader = response.body?.getReader();
    let text = ''; let bytes = 0;
    if (reader) {
      try {
        const decoder = new TextDecoder();
        while (true) {
          const value = await reader.read();
          if (value.done) { text += decoder.decode(); break; }
          bytes += value.value.byteLength;
          if (bytes > 256 * 1024) throw new Error('Deployment response exceeds verification size limit');
          text += decoder.decode(value.value, { stream: true });
        }
      } finally { await reader.cancel().catch(() => undefined); }
    }
    return { response, text };
  }
  const page = await request('/');
  if (page.response.status !== 200 || !page.response.headers.get('content-type')?.includes('text/html') || !/<form\b/i.test(page.text)) throw new Error('Public page did not serve an HTML signup form');
  if (page.text.includes(receipt.token)) throw new Error('Public page exposed the private verification token');
  if (receipt.title && !page.text.includes(receipt.title)) throw new Error('Public page does not contain the client title');
  for (const endpoint of ['/health', '/stats']) {
    const denied = await request(endpoint);
    if (![401, 403].includes(denied.response.status)) throw new Error('Private diagnostic endpoint was accessible without authentication');
  }
  const health = await request('/health', true);
  const identity = JSON.parse(health.text);
  if (health.response.status !== 200 || identity.ok !== true || identity.artifactDigest !== receipt.digest) throw new Error('Deployed artifact identity did not match');
  async function count() {
    const result = await request('/stats', true);
    const value = JSON.parse(result.text).count;
    if (result.response.status !== 200 || !Number.isSafeInteger(value) || value < 0) throw new Error('Persistence count unavailable');
    return value as number;
  }
  const before = await count();
  const crossOrigin = await request('/join', false, { email: `rejected-${randomUUID()}@example.invalid` }, 'https://untrusted.example.invalid');
  if (crossOrigin.response.status !== 403 || await count() !== before) throw new Error('Cross-origin signup was not rejected without a write');
  const invalid = await request('/join', false, { email: 'not-an-email' });
  if (![400, 422].includes(invalid.response.status) || await count() !== before) throw new Error('Invalid public signup was not safely rejected');
  const email = `judge-probe-${randomUUID()}@example.invalid`;
  const first = await request('/join', false, { email: `  ${email.toUpperCase()}  ` });
  if (first.response.status !== 201 || await count() !== before + 1) throw new Error('Public signup did not persist exactly one record');
  const duplicate = await request('/join', false, { email });
  if (duplicate.response.status !== 200 || await count() !== before + 1) throw new Error('Normalized duplicate signup did not remain unique');
  console.log(JSON.stringify({ url: base.origin, verifiedAt: new Date().toISOString(), artifactDigest: receipt.digest,
    checks: ['public HTML form', 'no verification token in page', ...(receipt.title ? ['client title'] : []), 'protected diagnostics', 'artifact identity', 'cross-origin signup rejected', 'invalid email rejected', 'same-origin public signup persisted', 'normalized duplicate unique'],
    syntheticEmail: email, syntheticRecordsAdded: 1, loadTestPerformed: false }, null, 2));
}

main().catch(error => {
  // Do not print arbitrary fetch/provider/JSON error messages or private receipt values.
  const allowed = error instanceof Error && !['TypeError', 'SyntaxError'].includes(error.name) && !error.message.includes('://');
  console.error(allowed ? error.message : 'Deployment verification failed; inspect configuration and endpoint contract');
  process.exitCode = 1;
});
