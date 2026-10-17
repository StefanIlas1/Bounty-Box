/** Mock-only smoke: node --import tsx src/lib/createos/software.smoke.ts. No live client instantiated. */
import assert from 'node:assert/strict';
import { createCatalog, type VerifiedSoftwareQuote } from '../catalog/software';
import { createSandboxRunner, CREATEOS_EU_ENDPOINT, softwareArtifactDigest, type SoftwareSandbox } from './software';
import { artifactDigest } from '../server/artifacts';
import type { Brief, GeneratedApp } from '../contracts';

const brief: Brief = { description: 'Fixture waitlist', monthlyBudgetUsd: 20, targetUsers: 1000, load: { concurrency: 2, durationSeconds: 1, maxP95Ms: 100, maxErrorRate: 0.01 } };
const env = { CREATEOS_PROJECT_API_KEY: 'fixture-management-secret', OPENAI_API_KEY: 'fixture-model-secret', BOUNTYBOX_NEON_TRIAL_READY: 'true', NEON_DATABASE_URL: 'postgresql://fixture:secret@fixture.neon.tech/trial' };
const now = Date.now();
const quotes: VerifiedSoftwareQuote[] = ['createos/project', 'neon/postgres'].map(serviceId => ({ serviceId: serviceId as VerifiedSoftwareQuote['serviceId'], monthlyCostUsd: 3, sourceUrl: 'https://projects.dev/llms.txt', verifiedAt: new Date(now - 1000).toISOString(), expiresAt: new Date(now + 60000).toISOString(), accountEligible: true, assumptions: ['Mock account quote for smoke only'], maxTargetUsers: 1000 }));
const catalog = createCatalog({ quotes: () => quotes, environment: () => env });
const stack = (await catalog.listCandidates(brief))[0];
assert.equal(stack.estimatedMonthlyCostUsd, 6);
await assert.rejects(createCatalog().listCandidates(brief), /Missing verified/);
await assert.rejects(createCatalog({ quotes: () => quotes, environment: () => ({}) }).listCandidates(brief), /TRIAL_READY/);
await assert.rejects(createCatalog({ quotes: () => quotes.map(q => ({ ...q, expiresAt: '2020-01-01' })), environment: () => env }).listCandidates(brief), /Missing valid/);
await assert.rejects(catalog.listCandidates({ ...brief, monthlyBudgetUsd: 1 }), /exceeds monthly budget/);
const app: GeneratedApp = { files: [{ path: 'server.mjs', content: '// fixture server' }, { path: 'diagnostic.mjs', content: '// fixture diagnostics' }, { path: 'package.json', content: '{"name":"fixture","version":"1.0.0"}' }, { path: 'package-lock.json', content: '{"lockfileVersion":3,"packages":{"":{"name":"fixture","version":"1.0.0"}}}' }], start: { command: 'node', args: ['server.mjs'], port: 3000 }, loadTest: { command: 'node', args: ['diagnostic.mjs'] }, requiredEnvNames: ['NEON_DATABASE_URL'], revision: 1 };
assert.equal(softwareArtifactDigest(app), artifactDigest(app));

let creates = 0;
let destroys = 0;
let measured = false;
const events: string[] = [];
const clientFactory = (config: { apiKey: string; baseUrl: string }) => {
  assert.equal(config.baseUrl, CREATEOS_EU_ENDPOINT);
  assert.equal(config.apiKey, env.CREATEOS_PROJECT_API_KEY);
  return { async createSandbox(request: { envs?: Record<string, string>; egress?: string[] }) {
    creates++;
    assert.deepEqual(request.egress, ['registry.npmjs.org:443']);
    assert.ok(Object.values(request.envs!).every(value => value === ''));
    assert.equal('CREATEOS_PROJECT_API_KEY' in request.envs!, false);
    return {
      id: 'fixture-sandbox', files: { async upload(path: string) { assert.ok(path.startsWith('/tmp/bounty-app/')); } },
      async *streamCommand(command: string, args: string[], options: { env?: Record<string, string> }) {
        if (args.join(' ').includes('npm ci')) assert.equal(options.env, undefined);
        if (args.join(' ').includes('node server.mjs')) {
          assert.ok(events.includes('restricted'));
          assert.equal(options.env!.NEON_DATABASE_URL, env.NEON_DATABASE_URL);
          assert.equal(options.env!.OPENAI_API_KEY, undefined);
          assert.equal(options.env!.BOUNTYBOX_ARTIFACT_DIGEST, artifactDigest(app));
        }
        yield { type: 'stdout', data: env.NEON_DATABASE_URL + env.CREATEOS_PROJECT_API_KEY };
        yield { type: 'exit', exitCode: 0 };
      },
      async setEgress(rules: string[]) { assert.deepEqual(rules, ['fixture.neon.tech:443']); events.push('restricted'); },
      async waitForPortReady() { events.push('ready'); }, previewUrl() { return 'https://fixture.example.invalid'; },
      async destroy() { destroys++; events.push('destroyed'); },
    } as unknown as SoftwareSandbox;
  } };
};
const benchmark = async (input: { token: string; artifactDigest: string }) => {
  assert.ok(events.includes('ready')); assert.equal(destroys, 0);
  assert.equal(input.artifactDigest, artifactDigest(app)); assert.equal(input.token.length, 64); measured = true;
  return { passed: true, requests: 20, throughputRps: 20, p95Ms: 10, errorRate: 0, durationSeconds: 1, mode: 'live' as const, logs: [env.NEON_DATABASE_URL], previewUrl: 'https://must-not-persist.invalid' };
};
const healthFetch: typeof fetch = async (_url, options) => {
  assert.match(new Headers(options?.headers).get('Authorization') ?? '', /^Bearer [a-f0-9]{64}$/);
  assert.equal(options?.redirect, 'error');
  return Response.json({ ok: true, artifactDigest: artifactDigest(app) });
};
const runner = createSandboxRunner({ benchmark, clientFactory, environment: () => env, fetchImpl: healthFetch });
const result = await runner.run({ app, stack, brief });
assert.equal(result.passed, true); assert.equal(measured, true); assert.equal(destroys, 1);
assert.equal(result.previewUrl, undefined);
assert.ok(!JSON.stringify(result).includes('secret'));
await assert.rejects(runner.run({ app: { ...app, files: [...app.files, { path: '../escape', content: '' }] }, stack, brief }), /paths/);
await assert.rejects(runner.run({ app: { ...app, requiredEnvNames: ['OPENAI_API_KEY'] }, stack, brief }), /scoped/);
assert.equal(creates, 1);
const failedRunner = createSandboxRunner({ benchmark: async () => { throw new Error(env.CREATEOS_PROJECT_API_KEY); }, clientFactory, environment: () => env, fetchImpl: healthFetch });
await assert.rejects(failedRunner.run({ app, stack, brief }), error => error instanceof Error && !error.message.includes('fixture-management-secret'));
assert.equal(destroys, 2);
const abort = new AbortController();
const cancelled = createSandboxRunner({ benchmark: async () => { abort.abort(); throw new Error('cancelled'); }, clientFactory, environment: () => env, fetchImpl: healthFetch });
await assert.rejects(cancelled.run({ app, stack, brief, signal: abort.signal }), /cancelled/);
assert.equal(destroys, 3);
const before = creates; const preAborted = new AbortController(); preAborted.abort();
await assert.rejects(runner.run({ app, stack, brief, signal: preAborted.signal })); assert.equal(creates, before);
let unverifiedBenchmarkCalls = 0;
const wrongDigest = createSandboxRunner({ clientFactory, environment: () => env, fetchImpl: async () => Response.json({ ok: true, artifactDigest: 'wrong' }), benchmark: async () => { unverifiedBenchmarkCalls++; throw new Error('must not run'); } });
assert.equal((await wrongDigest.run({ app, stack, brief })).passed, false);
assert.equal(unverifiedBenchmarkCalls, 0); assert.equal(destroys, 4);
let signupCalls = 0;
const storedEmails = new Set<string>();
const harnessFetch: typeof fetch = async (url, init) => {
  assert.match(new Headers(init?.headers).get('Authorization') ?? '', /^Bearer [a-f0-9]{64}$/);
  if (new URL(String(url)).pathname === '/health') return Response.json({ ok: true, artifactDigest: artifactDigest(app) });
  if (new URL(String(url)).pathname === '/stats') return Response.json({ count: storedEmails.size });
  assert.equal(init?.method, 'POST');
  const email = JSON.parse(String(init?.body)).email.trim().toLowerCase();
  if (email.startsWith('bench-')) signupCalls++;
  const existing = storedEmails.has(email);
  storedEmails.add(email);
  await new Promise(resolve => setTimeout(resolve, 5));
  return Response.json({ ok: true }, { status: existing ? 200 : 201 });
};
const defaultRunner = createSandboxRunner({ clientFactory, environment: () => env, fetchImpl: harnessFetch });
const integrated = await defaultRunner.run({ app, stack, brief });
assert.ok(signupCalls > 0); assert.equal(integrated.requests, signupCalls); assert.equal(integrated.passed, true); assert.equal(destroys, 5);
let badStoredCount = 0;
const brokenAppFetch: typeof fetch = async (url) => {
  const path = new URL(String(url)).pathname;
  if (path === '/health') return Response.json({ ok: true, artifactDigest: artifactDigest(app) });
  if (path === '/stats') return Response.json({ count: badStoredCount });
  badStoredCount++;
  return Response.json({ ok: true }, { status: 201 });
};
const brokenAppRunner = createSandboxRunner({ clientFactory, environment: () => env, fetchImpl: brokenAppFetch });
const brokenAppResult = await brokenAppRunner.run({ app, stack, brief });
assert.equal(brokenAppResult.passed, false); assert.match(brokenAppResult.failureReason!, /Normalized duplicate/);
assert.equal(brokenAppResult.requests, 0); assert.equal(destroys, 6);
console.log('PASS: software quote/trial/budget preflight, EU SDK config, scoped secrets, digest identity gate, agent-2 default benchmark (mock HTTP), output suppression, cancellation and cleanup. No live calls.');
