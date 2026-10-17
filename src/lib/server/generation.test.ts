import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { CandidateStack } from '../contracts';
import { createGenerator, validateGeneratedApp } from '../generation';
import { artifactDigest, saveArtifact, readArtifact } from './artifacts';

const stack: CandidateStack = { id: 'test-live', name: 'Test', description: '', mode: 'live', services: [], requiredEnvNames: [], estimatedMonthlyCostUsd: 0, partner: false, costAssumptions: [], pricingSources: [] };
const manifest = () => ({ files: [
  { path: 'server.mjs', content: '// Transport fixture, never deployed' },
  { path: 'diagnostic.mjs', content: '// Diagnostic' },
  { path: 'package.json', content: JSON.stringify({ name: 'fixture', type: 'module', dependencies: {} }) },
  { path: 'package-lock.json', content: JSON.stringify({ lockfileVersion: 3, packages: { '': { dependencies: {} } } }) },
  { path: 'Dockerfile', content: 'FROM node:22\nCMD ["node","server.mjs"]' },
], requiredEnvNames: [] });
const brief = { description: 'Waitlist', monthlyBudgetUsd: 30, targetUsers: 1000, load: { concurrency: 2, durationSeconds: 1, maxP95Ms: 500, maxErrorRate: 0.01 } };

test('generated source boundaries reject traversal, case collisions, unscoped secrets and unsafe installs', () => {
  const unsafePath = manifest(); unsafePath.files[0].path = '../server.mjs';
  assert.throws(() => validateGeneratedApp(unsafePath, stack, 1), /unsafe/);
  const duplicate = manifest(); duplicate.files.push({ path: 'Server.mjs', content: '' });
  assert.throws(() => validateGeneratedApp(duplicate, stack, 1), /duplicate/);
  assert.throws(() => validateGeneratedApp({ ...manifest(), requiredEnvNames: ['OPENAI_API_KEY'] }, stack, 1), /scoped/);
  const scripts = manifest(); scripts.files[2].content = JSON.stringify({ type: 'module', scripts: { postinstall: 'danger' } });
  assert.throws(() => validateGeneratedApp(scripts, stack, 1), /install configuration/);
});

test('generation handles structured output, repair revision, refusal, incomplete and redacted HTTP failure', async () => {
  let calls = 0;
  const transport: typeof fetch = async (url, init) => {
    calls++;
    assert.equal(url, 'https://api.openai.com/v1/responses');
    const request = JSON.parse(init!.body as string);
    assert.equal(request.store, false);
    assert.equal(request.text.format.strict, true);
    assert.equal(request.input.includes('sensitive provider log'), false);
    return new Response(JSON.stringify({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(manifest()) }] }] }));
  };
  const options = { env: { OPENAI_API_KEY: 'test-key', OPENAI_MODEL: 'test-model' }, fetchImpl: transport };
  const generator = createGenerator(options);
  const first = await generator.generate({ brief, stack });
  const second = await generator.generate({ brief, stack, previous: first, feedback: { passed: false, mode: 'live', requests: 1, throughputRps: 1, durationSeconds: 1, p95Ms: 900, errorRate: 1, logs: ['sensitive provider log'] } });
  assert.equal(second.revision, 2); assert.equal(calls, 2);
  for (const [payload, message] of [
    [{ status: 'incomplete' }, /incomplete/],
    [{ status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal' }] }] }, /refused/],
  ] as const) {
    const g = createGenerator({ ...options, fetchImpl: async () => new Response(JSON.stringify(payload)) });
    await assert.rejects(g.generate({ brief, stack }), message);
  }
  const failing = createGenerator({ ...options, fetchImpl: async () => new Response('SECRET', { status: 401 }) });
  await assert.rejects(failing.generate({ brief, stack }), error => error instanceof Error && error.message.includes('401') && !error.message.includes('SECRET'));
  await assert.rejects(createGenerator({ env: {} }).generate({ brief, stack }), /not configured/);
});

test('canonical artifacts survive reorder and detect corruption', () => {
  const dir = mkdtempSync(join(tmpdir(), 'bounty-artifact-'));
  try {
    const app = validateGeneratedApp(manifest(), stack, 1);
    const digest = saveArtifact(dir, app);
    assert.equal(artifactDigest({ ...app, files: [...app.files].reverse() }), digest);
    assert.equal(readArtifact(dir, digest).revision, 1);
    writeFileSync(join(dir, digest + '.json'), JSON.stringify({ ...app, revision: 2 }));
    assert.throws(() => readArtifact(dir, digest), /integrity/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
