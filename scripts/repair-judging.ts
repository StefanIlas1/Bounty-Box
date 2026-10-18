import { config } from '../src/lib/server/config';
import { Store } from '../src/lib/server/store';
import { createCodexGenerator } from '../src/lib/generation/codex';
import { createSandboxRunner } from '../src/lib/createos/software';
import { randomUUID } from 'node:crypto';
const store = new Store(config().db);
const id = process.argv[2];
try {
 if(store.unsettledSandboxes().length) throw new Error('Reconcile resources before repair');
 const run = store.get(id);
 const previous = store.artifact(id,1).app;
 const feedback = {passed:false,requests:0,throughputRps:0,p95Ms:0,errorRate:1,durationSeconds:0,logs:['Real public verification: POST /join with Origin equal to deployed HTTPS URL returned HTTP 403.'],failureReason:'Public same-origin signup rejected with HTTP 403 behind CreateOS reverse proxy. Compare Origin against trusted runtime BOUNTYBOX_PUBLIC_ORIGIN, never Host or forwarded headers. This variable is supplied by sandbox/deployment runner. Preserve the client requested public page.',mode:'live' as const};
 const event=(stage:typeof run.status,message:string)=>{run.status=stage;run.updatedAt=new Date().toISOString();run.events.push({id:(run.events.at(-1)?.id??0)+1,at:run.updatedAt,stage,message});store.update(run);console.log(message);};
 delete run.proposal;
 event('repairing',feedback.failureReason);
 const app=await createCodexGenerator().generate({brief:run.brief,stack:run.candidates[0],previous,feedback,signal:AbortSignal.timeout(240000)});
 store.recordArtifact(id,2,app);
 event('testing','Testing model-repaired public signup and Neon persistence in CreateOS');
 const result=await createSandboxRunner({onLifecycle:async e=>{store.recordSandbox(id,e);}}).run({app,stack:run.candidates[0],brief:run.brief,signal:AbortSignal.timeout(240000)});
 run.attempts.push({number:2,revision:app.revision,stack:run.candidates[0],result,decision:result.passed?'Passed real public-origin check and independent database benchmark':'Repair did not pass'});
 if(result.passed){run.proposal={id:randomUUID(),stack:run.candidates[0],result,estimatedMonthlyCostUsd:0};run.status='awaiting_approval';store.finish(run,app);}else{run.status='failed';store.finish(run);process.exitCode=1;}
 console.log(JSON.stringify({runId:id,status:run.status,result}));
} catch {console.error('Judging repair failed; inspect saved run and sandbox lifecycle.');process.exitCode=1;}
finally{store.close();}
