import { setTimeout as delay } from 'node:timers/promises';
import { config } from '../src/lib/server/config';
import type { RunSnapshot } from '../src/lib/contracts';
const c = config();
const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${c.token}` };
const base = `http://127.0.0.1:${c.port}`;
const brief = { description: 'A small email waitlist for Bounty-Box. Persist normalized unique emails in Neon Postgres.',
  monthlyBudgetUsd: 0, targetUsers: 100, load: { concurrency: 2, durationSeconds: 5, maxP95Ms: 2000, maxErrorRate: 0.01 } };
async function main() {
  const response = await fetch(`${base}/api/runs`, { method: 'POST', headers, body: JSON.stringify({ mode: 'live', brief }) });
  if (!response.ok) throw new Error(`Run rejected: HTTP ${response.status}`);
  let run = await response.json() as RunSnapshot;
  console.log(JSON.stringify({ runId: run.id, status: run.status }));
  let eventId = 0;
  const deadline = Date.now() + 16 * 60_000;
  while (Date.now() < deadline) {
    for (const event of run.events.filter(event => event.id > eventId)) { console.log(JSON.stringify(event)); eventId = event.id; }
    if (['failed', 'cancelled', 'awaiting_approval', 'deployed'].includes(run.status)) {
      console.log(JSON.stringify({ runId: run.id, status: run.status, attempts: run.attempts.map(a => ({ number: a.number, decision: a.decision, result: a.result })), proposal: run.proposal, error: run.error }, null, 2));
      if (run.status !== 'awaiting_approval') process.exitCode = 1;
      return;
    }
    await delay(2000);
    const poll = await fetch(`${base}/api/runs/${run.id}`, { headers });
    if (!poll.ok) throw new Error(`Polling failed: HTTP ${poll.status}`);
    run = await poll.json() as RunSnapshot;
  }
  throw new Error('Demo polling timed out; inspect the run before retrying');
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'Demo failed'); process.exitCode = 1; });
