// Fixture smoke only: node --import tsx src/lib/orchestrator/smoke.cjs
const assert = require('node:assert/strict');
const orchestration = import('./index.ts');
async function orchestrateRun(input) { return (await orchestration).orchestrateRun(input); }
const stack = (id, price, partner = false) => ({ id, name: id, description: 'Smoke fixture', services: [], estimatedMonthlyCostUsd: price, costAssumptions: ['Fixture only'], pricingSources: [], partner, mode: 'fixture', requiredEnvNames: [] });
const evidence = (passed = true) => ({ passed, requests: 100, throughputRps: 10, p95Ms: passed ? 20 : 200, errorRate: 0, durationSeconds: 10, logs: ['Fixture only'], mode: 'fixture' });
const initial = () => ({ id: 'smoke', mode: 'fixture', status: 'queued', brief: { description: 'Fixture app', monthlyBudgetUsd: 30, targetUsers: 100, load: { concurrency: 5, durationSeconds: 10, maxP95Ms: 100, maxErrorRate: 0.01 } }, candidates: [], attempts: [], events: [], createdAt: '', updatedAt: '' });
async function execute(candidates, result, extra = {}) {
  let calls = 0;
  const snapshots = [];
  const outcome = await orchestrateRun({ run: initial(), catalog: { listCandidates: async () => candidates }, generator: { generate: async ({previous}) => ({files: [], start: {command:'node',args:[],port:3000},loadTest:{command:'node',args:[]},requiredEnvNames:[],revision:(previous?.revision ?? 0)+1}) }, sandbox: { run: async (args) => result(++calls, args) }, onUpdate: async (r) => snapshots.push(r), ...extra });
  return { ...outcome, calls, snapshots };
}
(async () => {
  const repaired = await execute([stack('a', 10)], n => evidence(n === 2));
  assert.equal(repaired.run.status, 'awaiting_approval');
  assert.deepEqual(repaired.run.attempts.map(a => a.revision), [1, 2]);
  assert.equal(repaired.app.revision, 2);
  assert.equal(repaired.snapshots[0].attempts.length, 0);
  const swapped = await execute([stack('a',10), stack('b',20)], (_, {stack}) => evidence(stack.id === 'b'));
  assert.equal(swapped.run.proposal.stack.id, 'b');
  assert.equal(swapped.calls, 3);
  const failed = await execute([stack('a',10), stack('b',20)], () => evidence(false));
  assert.equal(failed.run.status, 'failed'); assert.equal(failed.run.proposal, undefined); assert.equal(failed.calls,3);
  const partner = await execute([stack('base',20), stack('partner',10,true)], () => evidence());
  assert.equal(partner.run.proposal.stack.id, 'partner');
  const unsupportedPartner = await execute([stack('partner',10,true)], () => evidence());
  assert.equal(unsupportedPartner.run.status, 'failed'); assert.equal(unsupportedPartner.calls,0);
  const overBudget = await execute([stack('expensive',31)], () => evidence());
  assert.equal(overBudget.calls,0); assert.equal(overBudget.run.status,'failed');
  const live = initial(); live.mode = 'live';
  const mismatch = await execute([{...stack('live',10),mode:'live'}], () => evidence(), {run:live});
  assert.equal(mismatch.run.status,'failed'); assert.equal(mismatch.run.proposal,undefined);
  const abort = new AbortController();
  const cancelled = await execute([stack('a',10)], () => { abort.abort(); return evidence(); }, {signal:abort.signal});
  assert.equal(cancelled.run.status,'cancelled'); assert.equal(cancelled.run.proposal,undefined);
  await assert.rejects(execute([stack('a',10)], () => evidence(), {onUpdate: () => {throw new Error('Persistence unavailable');}}), /Persistence unavailable/);
  const threshold = await execute([stack('a',10)], () => ({...evidence(),p95Ms:150}));
  assert.equal(threshold.run.status,'failed');
  console.log('PASS: fixture repair, swap, cap, partner comparison, budget, mode mismatch, cancellation, persistence failure, measured thresholds. No live calls.');
})().catch(error => {console.error(error); process.exitCode = 1;});
