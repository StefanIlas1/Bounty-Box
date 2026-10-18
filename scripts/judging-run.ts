import { config } from '../src/lib/server/config';
import { Store } from '../src/lib/server/store';
import { livePreflight } from '../src/lib/server/live';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
const c = config();
const store = new Store(c.db);
const brief = { description: process.argv[2] || 'Build Bounty-Box Early Access: a polished dark navy and gold waitlist for founders who want AI to build software within their budget. Heading: Build big. Stay under budget. Capture email with a Join early access button and clear success confirmation. Persist normalized unique emails in Neon Postgres.', monthlyBudgetUsd: 0, targetUsers: 100, load: {concurrency: 2, durationSeconds: 5, maxP95Ms: 2000, maxErrorRate: 0.01} };
await livePreflight(brief, store);
const run = store.create(brief, 'live', `judging-${randomUUID()}`);
writeFileSync('.bounty-box/judging-run-id',run.id,{mode:0o600});
console.log(JSON.stringify({runId:run.id,status:run.status}));
// The running worker processes the durable queue; this client only observes.
let last = 0;
let completed = false;
const until = Date.now() + 10*60_000;
while(Date.now()<until){
 const r=store.get(run.id);
 for(const e of r.events.filter(e=>e.id>last)){console.log(JSON.stringify(e));last=e.id;}
 if(['failed','cancelled','awaiting_approval'].includes(r.status)){
  console.log(JSON.stringify({runId:r.id,status:r.status,attempts:r.attempts,proposal:r.proposal,error:r.error}));
  completed = true;
  if(r.status!=='awaiting_approval')process.exitCode=1;
  break;
 }
 await new Promise(r=>setTimeout(r,2000));
}
if (!completed) { store.cancel(run.id); console.error('Judging run exceeded client deadline and was cancelled.'); process.exitCode = 1; }
store.close();
