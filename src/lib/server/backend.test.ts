import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from './store';
import { processNext } from './worker';
import { createApi } from './api';

const brief = { description: 'Email waitlist', monthlyBudgetUsd: 30, targetUsers: 1000,
  load: { concurrency: 2, durationSeconds: 1, maxP95Ms: 500, maxErrorRate: 0.01 } };

test('durable queue, repair, immutable proposal, fixture approval isolation and worker exclusion', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'bounty-backend-test-'));
  let store = new Store(join(dir, 'runs.sqlite3'));
  try {
    const run = store.create(brief, 'fixture', 'request-one');
    assert.equal(store.create(brief, 'fixture', 'request-one').id, run.id);
    assert.throws(() => store.create({ ...brief, description: 'Different' }, 'fixture', 'request-one'), /different request/);
    store.close(); store = new Store(join(dir, 'runs.sqlite3'));
    assert.equal(store.get(run.id).status, 'queued');
    store.acquire('worker-one');
    const second = new Store(join(dir, 'runs.sqlite3'));
    try { assert.throws(() => second.acquire('worker-two'), /Another worker/); }
    finally { second.close(); }
    await processNext(store, 'worker-one');
    const ready = store.get(run.id);
    assert.equal(ready.status, 'awaiting_approval');
    assert.equal(ready.attempts.length, 2);
    assert.equal(ready.attempts[0].result?.passed, false);
    assert.equal(ready.attempts[1].result?.passed, true);
    assert.match(ready.proposal!.artifactDigest!, /^[a-f0-9]{64}$/);
    assert.equal(store.artifacts(run.id).length, 2);
    assert.equal(store.artifact(run.id, 1).app.revision, 1);
    assert.equal(store.artifact(run.id, 2).digest, ready.proposal!.artifactDigest);
    assert.throws(() => store.approve(run.id, ready.proposal!.id), /Fixture evidence/);
    assert.throws(() => store.approve(run.id, 'stale'), /no longer current/);
    const cancelled = store.create(brief, 'fixture');
    store.cancel(cancelled.id);
    assert.equal(await processNext(store, 'worker-one'), false);
    assert.equal(store.get(cancelled.id).status, 'cancelled');
    store.db.prepare('UPDATE lease SET expires=0').run();
    assert.throws(() => store.acquire('worker-two'), /reconcile/);
    store.release('worker-one');
  } finally { store.close(); rmSync(dir, { recursive: true, force: true }); }
});

test('HTTP auth, input bounds, live preflight, idempotency, queue limit and cancellation', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'bounty-api-test-'));
  const store = new Store(join(dir, 'runs.sqlite3'));
  const token = 'test-token-that-is-at-least-32-characters';
  const api = createApi(store, token);
  await new Promise<void>(resolve => api.listen(0, '127.0.0.1', resolve));
  const address = api.address() as { port: number };
  const url = `http://127.0.0.1:${address.port}`;
  const post = (path: string, value: unknown, key?: string) => fetch(url + path, { method: 'POST', headers: {
    authorization: `Bearer ${token}`, 'content-type': 'application/json', ...(key ? { 'idempotency-key': key } : {}) }, body: JSON.stringify(value) });
  try {
    assert.equal((await fetch(url + '/api/health')).status, 401);
    assert.equal((await post('/api/runs', { brief, mode: 'live' })).status, 503);
    assert.equal((await post('/api/runs', { brief: { ...brief, load: { ...brief.load, concurrency: 51 } }, mode: 'fixture' })).status, 400);
    const r = await post('/api/runs', { brief, mode: 'fixture' }, 'same');
    assert.equal(r.status, 202);
    const run = await r.json() as { id: string };
    const duplicate = await post('/api/runs', { brief, mode: 'fixture' }, 'same');
    assert.equal(((await duplicate.json()) as { id: string }).id, run.id);
    for (let i = 0; i < 4; i++) assert.equal((await post('/api/runs', { brief, mode: 'fixture' })).status, 202);
    assert.equal((await post('/api/runs', { brief, mode: 'fixture' })).status, 429);
    assert.equal((await post(`/api/runs/${run.id}/cancel`, {})).status, 200);
    assert.equal((await post('/api/runs', { brief, mode: 'fixture' })).status, 202);
  } finally {
    await new Promise<void>((resolve, reject) => api.close(error => error ? reject(error) : resolve()));
    store.close(); rmSync(dir, { recursive: true, force: true });
  }
});

test('sandbox creation intent survives restart until cleanup is confirmed', () => {
  const dir = mkdtempSync(join(tmpdir(), 'bounty-resources-test-'));
  let store = new Store(join(dir, 'runs.sqlite3'));
  try {
    const run = store.create(brief, 'live');
    store.recordSandbox(run.id, { name: 'bounty-trial', phase: 'creating' });
    store.close(); store = new Store(join(dir, 'runs.sqlite3'));
    assert.equal(store.unsettledSandboxes().length, 1);
    store.recordSandbox(run.id, { name: 'bounty-trial', phase: 'created', sandboxId: 'sb-test' });
    store.recordSandbox(run.id, { name: 'bounty-trial', phase: 'reconcile' });
    assert.equal(store.unsettledSandboxes()[0].sandbox_id, 'sb-test');
    store.recordSandbox(run.id, { name: 'bounty-trial', phase: 'destroyed' });
    assert.equal(store.unsettledSandboxes().length, 0);
  } finally { store.close(); rmSync(dir, { recursive: true, force: true }); }
});
