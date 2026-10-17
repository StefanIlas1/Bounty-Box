import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCodexGenerator } from './codex';
import type { CandidateStack } from '../contracts';

const stack: CandidateStack = { id: 'test-live', name: 'Test', description: '', mode: 'live', services: [], requiredEnvNames: [], estimatedMonthlyCostUsd: 0, partner: false, costAssumptions: [], pricingSources: [] };
const brief = { description: 'Waitlist', monthlyBudgetUsd: 30, targetUsers: 1000, load: { concurrency: 2, durationSeconds: 1, maxP95Ms: 500, maxErrorRate: 0.01 } };
const manifest = { files: [
  { path: 'server.mjs', content: '// Transport fixture, never deployed' },
  { path: 'diagnostic.mjs', content: '// Diagnostic' },
  { path: 'package.json', content: JSON.stringify({ name: 'fixture', type: 'module', dependencies: {} }) },
  { path: 'package-lock.json', content: JSON.stringify({ lockfileVersion: 3, packages: { '': { dependencies: {} } } }) },
  { path: 'Dockerfile', content: 'FROM node:22\nCMD ["node","server.mjs"]' },
], requiredEnvNames: [] };

test('Codex transport isolates secrets, validates output, handles failure/deadline and cleans temporary files', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'bounty-codex-test-'));
  const executable = join(dir, 'fake-codex.cjs');
  const before = new Set((await readdir(tmpdir())).filter(p => p.startsWith('bounty-codex-generation-')));
  const env = { HOME: process.env.HOME, PATH: process.env.PATH, NEON_DATABASE_URL: 'secret-db', OPENAI_API_KEY: 'secret-api', CREATEOS_PROJECT_API_KEY: 'secret-provider' };
  try {
    await writeFile(executable, `#!/usr/bin/env node
const fs = require('node:fs');
const args=process.argv.slice(2);
if (process.env.NEON_DATABASE_URL || process.env.OPENAI_API_KEY || process.env.CREATEOS_PROJECT_API_KEY) process.exit(51);
if (!args.includes('--ignore-user-config') || !args.includes('read-only') || !args.includes('shell_tool')) process.exit(52);
let input=''; process.stdin.on('data', b=>input+=b); process.stdin.on('end',()=>{
if (!input.includes('BOUNTYBOX_TRIAL_NAMESPACE')) process.exit(53);
fs.writeFileSync(args[args.indexOf('--output-last-message')+1], ${JSON.stringify(JSON.stringify(manifest))});
});`, { mode: 0o700 });
    const generator = createCodexGenerator({ executable, env });
    const app = await generator.generate({ brief, stack });
    assert.equal(app.revision, 1);
    assert.equal((await generator.generate({ brief, stack, previous: app })).revision, 2);
    await writeFile(executable, '#!/usr/bin/env node\nconsole.error("secret-db");process.exit(12);', { mode: 0o700 });
    await assert.rejects(generator.generate({ brief, stack }), e => e instanceof Error && e.message.includes('exit 12') && !e.message.includes('secret-db'));
    await writeFile(executable, '#!/usr/bin/env node\nsetInterval(()=>{},1000);', { mode: 0o700 });
    await assert.rejects(createCodexGenerator({ executable, env, timeoutMs: 80 }).generate({ brief, stack }), /deadline/);
    const after = (await readdir(tmpdir())).filter(p => p.startsWith('bounty-codex-generation-') && !before.has(p));
    assert.deepEqual(after, []);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
