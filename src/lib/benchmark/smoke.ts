import assert from 'node:assert/strict';
import { benchmark } from './index';
import type { Brief } from '../contracts';
import type { SoftwareBenchmark } from '../createos/software';

const providerCallback: SoftwareBenchmark = benchmark;
assert.equal(providerCallback, benchmark);

const digest = 'a'.repeat(64);
const secret = 'private-smoke-token';
const brief: Brief = { description: 'fixture HTTP target', monthlyBudgetUsd: 30, targetUsers: 100, load: { concurrency: 3, durationSeconds: 0.06, maxP95Ms: 100, maxErrorRate: 0.01 } };
const target = (options: { digest?: string; duplicateStatus?: number; persist?: boolean; loadStatus?: number } = {}) => {
  const seen = new Set<string>();
  let active = 0;
  let peak = 0;
  let healthChecks = 0;
  let probeChecks = 0;
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    assert.equal(new Headers(init?.headers).get('Authorization'), `Bearer ${secret}`);
    assert.equal(init?.redirect, 'error');
    if (url.endsWith('/health')) {
      healthChecks++;
      return Response.json({ ok: true, artifactDigest: options.digest ?? digest });
    }
    if (url.endsWith('/stats')) return Response.json({ count: seen.size });
    assert.ok(url.endsWith('/signups'));
    assert.equal(init?.method, 'POST');
    const { email } = JSON.parse(String(init?.body)) as { email: string };
    if (email.toLowerCase().includes('probe-')) probeChecks++;
    const normalized = email.trim().toLowerCase();
    const duplicate = seen.has(normalized);
    if (!duplicate && options.persist !== false) seen.add(normalized);
    peak = Math.max(peak, ++active);
    await new Promise(resolve => setTimeout(resolve, 3));
    active--;
    return new Response('', { status: duplicate ? (options.duplicateStatus ?? 200) : (email.toLowerCase().includes('probe-') ? 201 : (options.loadStatus ?? 201)) });
  };
  return { fetchImpl, seen, peak: () => peak, healthChecks: () => healthChecks, probeChecks: () => probeChecks };
};
const run = (fetchImpl: typeof fetch) => benchmark({ baseUrl: 'http://127.0.0.1:3001', token: secret, artifactDigest: digest, brief, fetchImpl });
const good = target();
const result = await run(good.fetchImpl);
assert.equal(good.healthChecks(), 1);
assert.equal(good.probeChecks(), 2);
assert.equal(result.mode, 'live');
assert.equal(result.passed, true);
assert.equal(result.requests, good.seen.size - 1);
assert.ok(good.peak() > 1 && good.peak() <= 3);
assert.ok(result.durationSeconds >= brief.load.durationSeconds);
assert.ok(result.p95Ms > 0 && result.p95Ms <= brief.load.maxP95Ms);
assert.ok(result.throughputRps > 0);
assert.ok(!JSON.stringify(result).includes(secret));
await assert.rejects(run(target({ digest: 'b'.repeat(64) }).fetchImpl), /digest mismatch/);
await assert.rejects(run(target({ duplicateStatus: 201 }).fetchImpl), /duplicate signup/);
await assert.rejects(run(target({ persist: false }).fetchImpl), /did not persist/);
const badLoad = await run(target({ loadStatus: 500 }).fetchImpl);
assert.equal(badLoad.passed, false);
assert.equal(badLoad.errorRate, 1);
await assert.rejects(run(async (input, init) => String(input).endsWith('/health') ? target().fetchImpl(input, init) : new Response('x'.repeat(16_385), { status: 200 })), /16 KiB/);
const stalledBody: typeof fetch = async () => new Response(new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('{')); } }), { status: 200 });
const abort = new AbortController();
const pending = benchmark({ baseUrl: 'http://127.0.0.1:3001', token: secret, artifactDigest: digest, brief, fetchImpl: stalledBody, signal: abort.signal });
setTimeout(() => abort.abort(), 10);
await assert.rejects(pending);
await assert.rejects(run(stalledBody), /timed out/);
console.log('PASS: digest, normalized duplicate, persistence count, measured load/errors, bounded body, timeout and cancellation; fixture HTTP only.');
