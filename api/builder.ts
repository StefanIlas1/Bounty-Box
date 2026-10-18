import { randomBytes, randomUUID, createHash } from 'node:crypto';
import * as db from '../src/lib/hosted/store';
import { advance } from '../src/lib/hosted/runner';
import type { Brief, RunSnapshot } from '../src/lib/contracts';
export function parseBrief(value: unknown): Brief {
 const b=value as Brief;
 if(!b||typeof b!=='object'||Array.isArray(b)||typeof b.description!=='string'||!b.description.trim()||b.description.length>8000||
  !Number.isFinite(b.monthlyBudgetUsd)||b.monthlyBudgetUsd<0||b.monthlyBudgetUsd>100000||!Number.isSafeInteger(b.targetUsers)||b.targetUsers<1||b.targetUsers>10000000||
  !b.load||!Number.isInteger(b.load.concurrency)||b.load.concurrency<1||b.load.concurrency>2||!Number.isFinite(b.load.durationSeconds)||b.load.durationSeconds<1||b.load.durationSeconds>5||
  !Number.isFinite(b.load.maxP95Ms)||b.load.maxP95Ms<=0||b.load.maxP95Ms>60000||!Number.isFinite(b.load.maxErrorRate)||b.load.maxErrorRate<0||b.load.maxErrorRate>1)throw new db.StoreError(400,'Describe your goal and provide valid budget, users and bounded test settings.');
 return {description:b.description.trim(),monthlyBudgetUsd:b.monthlyBudgetUsd,targetUsers:b.targetUsers,load:{concurrency:b.load.concurrency,durationSeconds:b.load.durationSeconds,maxP95Ms:b.load.maxP95Ms,maxErrorRate:b.load.maxErrorRate}};
}
const hash=(v:string)=>createHash('sha256').update(v).digest('hex');
export default { async fetch(request:Request){
 const headers:Record<string,string>={'Cache-Control':'no-store'};
 const reply=(status:number,value:unknown)=>Response.json(value,{status,headers});
 try{
  const url=new URL(request.url),path=url.searchParams.get('path')??url.pathname.replace(/^\/api\/(runs|builder)\/?/,'');
  const cookie=request.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith('bb_session='))?.slice(11);
  const session=cookie&&/^[a-f0-9]{64}$/.test(cookie)?cookie:randomBytes(32).toString('hex');
  if(session!==cookie)headers['Set-Cookie']=`bb_session=${session}; HttpOnly; Secure; SameSite=Strict; Path=/api; Max-Age=86400`;
  const owner=hash(session);
  if(request.method==='POST'){
   const origin=request.headers.get('origin');
   if(origin&&!['https://bounty-box.com','https://www.bounty-box.com',url.origin].includes(origin))return reply(403,{error:'Invalid origin.'});
  }
  if(path==='health'&&request.method==='GET')return reply(200,{ok:true,liveReady:!!process.env.CREATEOS_LLM_API_KEY&&!!process.env.CREATEOS_LLM_MODEL&&!!process.env.CREATEOS_PROJECT_API_KEY&&!!process.env.WAITLIST_DATABASE_URL,shippingReady:!!process.env.CREATEOS_PROJECT_API_KEY&&!!process.env.WAITLIST_DATABASE_URL});
  const read=async()=>{if(!request.headers.get('content-type')?.startsWith('application/json'))throw new db.StoreError(415,'Expected JSON');const reader=request.body?.getReader();if(!reader)throw new db.StoreError(400,'Expected JSON');const chunks:Uint8Array[]=[];let size=0;try{while(true){const chunk=await reader.read();if(chunk.done)break;size+=chunk.value.length;if(size>16000)throw new db.StoreError(413,'Request too large');chunks.push(chunk.value);}}finally{await reader.cancel().catch(()=>undefined);}try{const value=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(!value||typeof value!=='object'||Array.isArray(value))throw new Error();return value;}catch{throw new db.StoreError(400,'Expected JSON object');}};
  if(!path&&request.method==='POST'){
   if(!process.env.CREATEOS_LLM_API_KEY||!process.env.CREATEOS_LLM_MODEL||!process.env.CREATEOS_PROJECT_API_KEY||!process.env.WAITLIST_DATABASE_URL)throw new db.StoreError(503,'CreateOS AI, model, sandbox or storage credentials are not configured. No build was started.');
   const data=await read();if(data?.mode!=='live')throw new db.StoreError(400,'Hosted builds require live mode.');
   const brief=parseBrief(data.brief);
   if(brief.load.concurrency>2||brief.load.durationSeconds>5)throw new db.StoreError(400,'Hosted trial is bounded to 2 concurrent requests for 5 seconds.');
   const now=new Date().toISOString();
   const run:RunSnapshot={id:randomUUID(),mode:'live',status:'queued',brief,candidates:[],attempts:[],events:[{id:1,at:now,stage:'queued',message:'Your goal was queued for a real CreateOS AI build.'}],createdAt:now,updatedAt:now};
   await db.create(run,owner);return reply(202,run);
  }
  const match=/^([a-f0-9-]{36})(?:\/(advance|approve|cancel|artifacts)(?:\/([1-9][0-9]*))?)?$/.exec(path);
  if(!match)throw new db.StoreError(404,'Run not found');
  const [,id,action,attempt]=match;const record=await db.get(id,owner);const run=record.snapshot;
  if(request.method==='GET'&&!action)return reply(200,run);
  if(request.method==='GET'&&action==='artifacts'&&attempt){const a=record.artifacts[attempt];if(!a)throw new db.StoreError(404,'Artifact not ready');return reply(200,a);}
  if(request.method==='POST'&&action==='advance'){await advance(id,owner);return reply(200,(await db.get(id,owner)).snapshot);}
  if(request.method==='POST'&&action==='approve'){
   const data=await read();
   if(run.status!=='awaiting_approval'||!run.proposal||run.proposal.id!==data?.proposalId||Date.parse(run.proposal.approvalExpiresAt??'')<=Date.now())throw new db.StoreError(409,'Proposal changed or expired.');
   if(run.proposal.estimatedMonthlyCostUsd!==0)throw new db.StoreError(409,'Paid provisioning needs a separate explicit cost approval.');
   run.status='provisioning';run.updatedAt=new Date().toISOString();await db.save(id,run);return reply(202,run);
  }
  if(request.method==='POST'&&action==='cancel'){
   if(['deployed','failed','cancelled'].includes(run.status))return reply(200,run);
   run.status='cancelled';run.updatedAt=new Date().toISOString();await db.save(id,run);return reply(200,run);
  }
  return reply(405,{error:'Method not supported'});
 }catch(error){return reply(error instanceof db.StoreError?error.status:500,{error:error instanceof db.StoreError?error.message:'Build service failed. No simulated result was substituted.'});}
}};
