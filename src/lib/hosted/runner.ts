import { randomUUID } from 'node:crypto';
import * as db from './store.js';
import { execute } from './execution.js';
import { artifactDigest } from '../server/artifacts.js';
import { createCreateosGenerator } from '../generation/createos.js';
import { liveCandidate } from './catalog.js';
import type { RunStatus, TestResult } from '../contracts.js';

export async function advance(id:string,owner:string){
 if(!await db.acquire(id))return;
 let record=await db.get(id,owner);
 let run=record.snapshot;
 const persist=async()=>db.save(id,run,record.artifacts,record.privateState);
 const emit=async(stage:RunStatus,message:string,extra:Record<string,unknown>={})=>{
  if((await db.get(id,owner)).snapshot.status==='cancelled')throw Error('Build cancelled');
  run.status=stage;run.updatedAt=new Date().toISOString();
  run.events.push({id:(run.events.at(-1)?.id??0)+1,at:run.updatedAt,stage,message,...extra});await persist();
 };
 const command=async(command:string,output:string,exitCode?:number)=>emit(run.status,output,{kind:'command',command,output,exitCode,stackId:'createos-neon'});
 const checkpoint=async(data:Record<string,unknown>)=>{
  const current=await db.get(id,owner);record.privateState={...record.privateState,execution:data};
  if(current.snapshot.status==='cancelled')run=current.snapshot;
  await persist();
  if(run.status==='cancelled'&&data.phase==='retained')throw Error('Build cancelled');
 };
 try{
  if(['cancelled','failed','deployed','awaiting_approval'].includes(run.status))return;
  if(run.status==='queued'){
   await emit('planning','Reading the requested application goal and checking the available CreateOS and Neon stack.');
   const candidate=await liveCandidate(run.brief);
   run.candidates=[candidate];
   await emit('planning',`Your goal: ${run.brief.description}\nRough base subscription estimate: $0/month on existing free plans, excluding metered AI and compute credits. Budget: $${run.brief.monthlyBudgetUsd}/month. No paid purchases will be made.`);
   return;
  }
  if(run.status==='planning'||run.status==='repairing'){
   const previous=run.attempts.at(-1);const previousApp=previous?record.artifacts[String(previous.number)]?.app:undefined;
   await emit('generating',previous?'Sending actual test failure and source to CreateOS AI for repair.':'Sending your exact goal to CreateOS AI to generate the application.');
   const app=await createCreateosGenerator().generate({brief:run.brief,stack:run.candidates[0],previous:previousApp,feedback:previous?.result,signal:AbortSignal.timeout(150000)});
   const number=run.attempts.length+1;
   record.artifacts[String(number)]={digest:artifactDigest(app),app};
   run.attempts.push({number,revision:app.revision,stack:run.candidates[0]});
   await emit('testing',`CreateOS AI generated ${app.files.length} files for your application. Source is now available in Code. Starting real sandbox execution.`);
   return;
  }
  if(run.status==='testing'){
   const attempt=run.attempts.at(-1)!;const app=record.artifacts[String(attempt.number)].app;
   let outcome:{result?:TestResult};
   try{outcome=await execute(app,run.brief,command,checkpoint);}
   catch(error){
    const message=error instanceof Error?error.message:'';
    if(!/failed during (application startup|identity verification|generated diagnostic)/.test(message))throw error;
    outcome={result:{passed:false,requests:0,throughputRps:0,p95Ms:0,errorRate:1,durationSeconds:0,mode:'live',logs:[message],failureReason:message}};
   }
   if(!outcome.result)throw Error('Execution produced no measurement');
   attempt.result=outcome.result;
   if(outcome.result.passed){
    attempt.decision='Generated diagnostic and independent public-page benchmark passed. Business workflow coverage is limited to the generated diagnostic.';
    run.proposal={id:randomUUID(),artifactDigest:artifactDigest(app),approvalExpiresAt:new Date(Date.now()+15*60000).toISOString(),stack:attempt.stack,result:outcome.result,estimatedMonthlyCostUsd:attempt.stack.estimatedMonthlyCostUsd};
    await emit('awaiting_approval','Tests passed. Approve deployment of this exact artifact using existing credits. No paid subscription is purchased. The judging deployment runs for up to 24 hours.');
   }else if(attempt.number<2){attempt.decision='Measured test failed; repair once with CreateOS AI.';await emit('repairing',outcome.result.failureReason??'Test failed; repairing generated source.');}
   else{attempt.decision='Test did not pass after repair';run.error=outcome.result.failureReason;await emit('failed',run.error??'Tests failed. No deployment created.');}
   return;
  }
  if(run.status==='provisioning'){
   const attempt=run.attempts.at(-1)!;const artifact=record.artifacts[String(attempt.number)];
   if(!run.proposal||artifact.digest!==run.proposal.artifactDigest||!attempt.result?.passed)throw Error('Approved artifact is not the tested artifact');
   await command('deploy approved artifact','Starting the real CreateOS deployment using existing credits. No paid purchase is being made.');
   const outcome=await execute(artifact.app,run.brief,command,checkpoint,true);
   if(!outcome.deployment)throw Error('Deployment returned no verified URL');
   const source=artifact.app.files.map(f=>f.content).join('\n');
   const title=source.match(/<title[^>]*>([^<]{1,100})<\/title>/i)?.[1]??run.brief.description;
   const slug=(title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,60)||'app')+'-'+id.slice(0,8);
   record.privateState.deployment=outcome.deployment;record.privateState.slug=slug;
   run.deployedUrl=`https://bounty-box.com/product-v1/${slug}`;
   await emit('deployed',`Your generated application is deployed and verified at ${run.deployedUrl}. Application runtime ends ${outcome.deployment.expiresAt}.`);
   return;
  }
  throw Error('A prior generation invocation was interrupted. Start a new run; no silent retry or simulated result was used.');
 }catch(error){
  const latest=await db.get(id,owner);
  if(latest.snapshot.status==='cancelled')return;
  run.error=error instanceof Error?error.message.slice(0,400):'Build failed';
  // All adapters return safe messages; strip connection strings and key patterns defensively.
  run.error=run.error.replace(/(?:postgres(?:ql)?|https?):\/\/[^\s]+/gi,'[service URL]').replace(/(?:skp_|sk-|Bearer )[A-Za-z0-9_.-]+/g,'[redacted]');
  await emit('failed',run.error);
 }finally{await db.release(id);}
}
