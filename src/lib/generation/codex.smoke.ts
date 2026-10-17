/** Opt-in live generation only: never executes model source or calls database providers. */
import { writeFile } from 'node:fs/promises';
import { createCodexGenerator } from './codex';
import type { CandidateStack } from '../contracts';

const stack: CandidateStack = { id: 'createos-neon', name: 'CreateOS + Neon', description: 'Isolated demo', mode: 'live',
  services: [{ id: 'neon/postgres', name: 'Neon', role: 'database', monthlyCostUsd: 0 }, { id: 'createos/project', name: 'CreateOS', role: 'host', monthlyCostUsd: 0 }],
  requiredEnvNames: ['NEON_DATABASE_URL'], estimatedMonthlyCostUsd: 0, partner: false, costAssumptions: ['Smoke metadata only, not a published price quote'], pricingSources: [] };
const app = await createCodexGenerator().generate({ stack,
  brief: { description: 'Minimal email waitlist for the Bounty-Box software demo. Use Neon durable persistence and zero npm dependencies.', monthlyBudgetUsd: 10, targetUsers: 100,
    load: { concurrency: 1, durationSeconds: 1, maxP95Ms: 3000, maxErrorRate: 0.01 } } });
const destination = '/tmp/bounty-codex-live-manifest.json';
await writeFile(destination, JSON.stringify(app), { mode: 0o600 });
console.log(JSON.stringify({ ok: true, destination, revision: app.revision, files: app.files.map(f => ({ path: f.path, bytes: Buffer.byteLength(f.content) })), requiredEnvNames: app.requiredEnvNames }));
