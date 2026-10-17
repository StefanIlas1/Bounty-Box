import { createServer, type IncomingMessage } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { Store, HttpError } from './store';
import { config } from './config';
import type { Brief } from '../contracts';
import { livePreflight } from './live';

export function parseBrief(value: unknown): Brief {
  const b = value as Brief;
  if (!b || typeof b.description !== 'string' || !b.description.trim() || b.description.length > 8000 ||
    !Number.isFinite(b.monthlyBudgetUsd) || b.monthlyBudgetUsd < 0 || !Number.isSafeInteger(b.targetUsers) || b.targetUsers < 1 ||
    !b.load || !Number.isInteger(b.load.concurrency) || b.load.concurrency < 1 || b.load.concurrency > 50 ||
    !Number.isFinite(b.load.durationSeconds) || b.load.durationSeconds < 1 || b.load.durationSeconds > 120 ||
    !Number.isFinite(b.load.maxP95Ms) || b.load.maxP95Ms <= 0 || !Number.isFinite(b.load.maxErrorRate) || b.load.maxErrorRate < 0 || b.load.maxErrorRate > 1) throw new HttpError(400, 'Invalid brief or load limits');
  return { description: b.description.trim(), monthlyBudgetUsd: b.monthlyBudgetUsd, targetUsers: b.targetUsers, load: {
    concurrency: b.load.concurrency, durationSeconds: b.load.durationSeconds, maxP95Ms: b.load.maxP95Ms, maxErrorRate: b.load.maxErrorRate } };
}
async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  let size = 0; const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 32 * 1024) throw new HttpError(413, 'Request body too large');
    chunks.push(chunk);
  }
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString());
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    return value;
  } catch { throw new HttpError(400, 'Expected a JSON object'); }
}
export function createApi(store: Store, token: string) {
  if (token.length < 32) throw new Error('BOUNTYBOX_API_TOKEN must contain at least 32 characters');
  const expected = Buffer.from(`Bearer ${token}`);
  const server = createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    const send = (status: number, value: unknown) => { res.writeHead(status); res.end(JSON.stringify(value)); };
    try {
      const supplied = Buffer.from(req.headers.authorization ?? '');
      if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) throw new HttpError(401, 'Unauthorized');
      const path = new URL(req.url ?? '/', 'http://localhost').pathname;
      if (req.method === 'GET' && path === '/api/health') {
        let liveReady = false;
        try { await livePreflight({ description: 'Readiness', monthlyBudgetUsd: 0, targetUsers: 1,
          load: { concurrency: 1, durationSeconds: 1, maxP95Ms: 2000, maxErrorRate: 0.01 } }, store); liveReady = true; }
        catch { /* Configuration failure is reported without credential details. */ }
        return send(200, { ok: true, liveEnabled: process.env.BOUNTYBOX_LIVE_ENABLED === 'true', liveReady, shippingReady: false });
      }
      if (req.method === 'POST' && path === '/api/runs') {
        const data = await body(req);
        const brief = parseBrief(data.brief);
        if (!['live','fixture'].includes(data.mode as string)) throw new HttpError(400, 'Choose live or fixture mode explicitly');
        if (data.mode === 'live') {
          try { await livePreflight(brief, store); }
          catch { throw new HttpError(503, 'Live preflight failed: check provider credentials, generator, pricing, demo limits and sandbox reconciliation'); }
        }
        const key = req.headers['idempotency-key'];
        if (key !== undefined && (typeof key !== 'string' || !/^[\x21-\x7e]{1,128}$/.test(key))) throw new HttpError(400, 'Invalid Idempotency-Key');
        return send(202, store.create(brief, data.mode as 'live' | 'fixture', key));
      }
      const artifact = /^\/api\/runs\/([a-f0-9-]{36})\/artifacts(?:\/([1-9][0-9]*))?$/.exec(path);
      if (req.method === 'GET' && artifact) return send(200, artifact[2] ? store.artifact(artifact[1], Number(artifact[2])) : store.artifacts(artifact[1]));
      const match = /^\/api\/runs\/([a-f0-9-]{36})(?:\/(approve|cancel))?$/.exec(path);
      if (!match) throw new HttpError(404, 'Route not found');
      const [, id, action] = match;
      if (req.method === 'GET' && !action) return send(200, store.get(id));
      if (req.method === 'POST' && action === 'cancel') return send(200, store.cancel(id));
      if (req.method === 'POST' && action === 'approve') {
        const data = await body(req);
        if (typeof data.proposalId !== 'string') throw new HttpError(400, 'proposalId required');
        return send(200, store.approve(id, data.proposalId));
      }
      throw new HttpError(405, 'Method not allowed');
    } catch (error) { send(error instanceof HttpError ? error.status : 500, { error: error instanceof HttpError ? error.message : 'Internal error' }); }
  });
  server.requestTimeout = 15_000;
  server.headersTimeout = 10_000;
  return server;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const c = config();
  if (!c.token) throw new Error('Set BOUNTYBOX_API_TOKEN in .env.backend.local');
  const store = new Store(c.db);
  const server = createApi(store, c.token);
  server.listen(c.port, '127.0.0.1', () => console.log(`Bounty-Box API listening on http://127.0.0.1:${c.port}`));
  for (const signal of ['SIGINT','SIGTERM'] as const) process.once(signal, () => server.close(() => { store.close(); process.exit(0); }));
}
