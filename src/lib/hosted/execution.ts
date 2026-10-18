import { randomBytes } from 'node:crypto';
import { CreateosSandboxClient } from '@nodeops-createos/sandbox';
import type { GeneratedApp, Brief, TestResult } from '../contracts.js';
import { artifactDigest } from '../server/artifacts.js';
const endpoint='https://api-eu.sb.createos.sh';
export type ExecutionLog=(command:string,output:string,exitCode?:number)=>Promise<void>;
export interface Deployment {url:string;sandboxId:string;name:string;token:string;digest:string;role:string;expiresAt:string;}
async function sql(query:string,params:unknown[]=[]){
 const connection=process.env.WAITLIST_DATABASE_URL!;
 const host=new URL(connection).hostname.replace(/^[^.]+\./,'api.');
 const r=await fetch(`https://${host}/sql`,{method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),headers:{'Content-Type':'application/json','Neon-Connection-String':connection,'Neon-Array-Mode':'true','Neon-Raw-Text-Output':'true'},body:JSON.stringify({query,params})});
 const data=await r.json();if(!r.ok||!Array.isArray(data.rows))throw Error('Scoped database operation failed');return data.rows as string[][];
}
export async function execute(app:GeneratedApp,brief:Brief,log:ExecutionLog,checkpoint:(data:Record<string,unknown>)=>Promise<void>,retain=false, keepTest=false){
 const key=process.env.CREATEOS_PROJECT_API_KEY;if(!key)throw Error('CreateOS sandbox credential is not configured');
 const client=new CreateosSandboxClient({apiKey:key,baseUrl:endpoint,retry:false});
 const name=`bb-${randomBytes(7).toString('hex')}`,role=name.replaceAll('-','_'),token=randomBytes(32).toString('hex'),digest=artifactDigest(app);
 const timeout=AbortSignal.timeout(210000);
 const pkg=JSON.parse(app.files.find(f=>f.path==='package.json')!.content);
 if(Object.keys(pkg.dependencies??{}).length)throw Error('This hosted runtime supports dependency-free Node applications only');
 const privateValues=[key,process.env.WAITLIST_DATABASE_URL].filter((v):v is string=>!!v);
 if(app.files.some(f=>privateValues.some(s=>f.content.includes(s))))throw Error('Generated source contains a private credential');
 const url=new URL(process.env.WAITLIST_DATABASE_URL!);const password=randomBytes(32).toString('hex');
 let sandbox:Awaited<ReturnType<typeof client.createSandbox>>|undefined;let kept=false,roleCreated=false;
 let stage='database setup';
 let createAttempted=false;
 try{
  await sql(`CREATE ROLE ${role} LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD '${password}'`);roleCreated=true;
  await sql(`GRANT CONNECT ON DATABASE "${decodeURIComponent(url.pathname.slice(1)).replaceAll('"','""')}" TO ${role}`);
  await sql(`GRANT USAGE, CREATE ON SCHEMA public TO ${role}`);
  const access=await sql(`SELECT count(*) FROM pg_tables WHERE schemaname='public' AND (has_table_privilege($1,quote_ident(schemaname)||'.'||quote_ident(tablename),'SELECT') OR has_table_privilege($1,quote_ident(schemaname)||'.'||quote_ident(tablename),'INSERT,UPDATE,DELETE'))`,[role]);
  if(Number(access[0][0])!==0)throw Error('Database scope check failed');
  url.username=role;url.password=password;
  const egress=[`${url.hostname}:443`,`${url.hostname.replace(/^[^.]+\./,'api.')}:443`];
  const runtime={NEON_DATABASE_URL:url.toString(),PORT:'3000',BOUNTYBOX_INGRESS_TOKEN:token,BOUNTYBOX_ARTIFACT_DIGEST:digest,BOUNTYBOX_TRIAL_NAMESPACE:role,BOUNTYBOX_PUBLIC_ORIGIN:''};
  await log('prepare database','Created isolated database login with no access to existing tables',0);
  stage='sandbox creation';await checkpoint({phase:'creating',name,role});
  createAttempted=true;
  sandbox=await client.createSandbox({name,shape:'s-1vcpu-1gb',rootfs:'devbox:1',ingress_enabled:true,auto_pause_after_seconds:(retain||keepTest)?86400:300,egress,envs:Object.fromEntries(Object.keys(runtime).map(k=>[k,'']))},{signal:timeout,timeoutMs:60000,retry:false});
  await checkpoint({phase:'created',name,role,sandboxId:sandbox.id});
  runtime.BOUNTYBOX_PUBLIC_ORIGIN=sandbox.previewUrl(3000);
  await log('createos sandbox create',`Sandbox ${sandbox.id} created; outbound network restricted to Neon`,0);
  stage='source upload';
  for(const file of app.files){const folder=file.path.includes('/')?file.path.slice(0,file.path.lastIndexOf('/')):'';const result=await sandbox.runCommand('mkdir',['-p',`/tmp/app/${folder}`],{signal:timeout,timeoutMs:10000,retry:false});if(result.result.exit_code!==0)throw Error('Workspace unavailable');await sandbox.files.upload(`/tmp/app/${file.path}`,file.content,{signal:timeout,timeoutMs:15000,retry:false});await log('upload',file.path,0);}
  stage='application startup';
  const process=await sandbox.processes.create({cmd:'timeout',args:['--signal=TERM','--kill-after=10s',(retain||keepTest)?'86400':'240','node','server.mjs'],cwd:'/tmp/app',env:runtime},{signal:timeout,timeoutMs:15000,retry:false});
  if(process.leader_exited)throw Error('Application exited');
  await log('node server.mjs','Managed application process started',0);
  await sandbox.waitForPortReady(3000,{signal:timeout,timeoutMs:45000});
  const base=runtime.BOUNTYBOX_PUBLIC_ORIGIN;
  stage='identity verification';
  const health=await fetch(new URL('/health',base),{headers:{Authorization:`Bearer ${token}`},redirect:'error',signal:AbortSignal.any([timeout,AbortSignal.timeout(10000)])});
  const identity=await health.json();if(!health.ok||identity.ok!==true||identity.artifactDigest!==digest)throw Error('Artifact health mismatch');
  await log('GET /health','Verified the running artifact digest',0);
  const page=await fetch(base,{redirect:'error',signal:AbortSignal.any([timeout,AbortSignal.timeout(10000)])});
  if(!page.ok||!page.headers.get('content-type')?.includes('text/html'))throw Error('Public HTML unavailable');
  await page.body?.cancel();
  if(retain){const deployment:Deployment={url:base,sandboxId:sandbox.id,name,token,digest,role,expiresAt:new Date(Date.now()+86400000).toISOString()};await checkpoint({phase:'retained',...deployment});await log('deployment verification','Public page and protected artifact identity verified; retained for 24 hours',0);kept=true;return {deployment};}
  stage='generated diagnostic';
  const diagnostic=await sandbox.runCommand('sh',['-c','cd /tmp/app && exec node diagnostic.mjs'],{env:runtime,signal:timeout,timeoutMs:25000,retry:false});
  const diagnosticPassed=diagnostic.result.exit_code===0;
  await log('node diagnostic.mjs',`Generated diagnostic exited ${diagnostic.result.exit_code}; process output withheld to protect database credentials`,diagnostic.result.exit_code);
  stage='independent HTTP benchmark';
  const samples:number[]=[];let errors=0;const start=performance.now(),until=start+brief.load.durationSeconds*1000;
  await log('HTTP benchmark',`Starting ${brief.load.concurrency} concurrent public-page requests for ${brief.load.durationSeconds}s`);
  await Promise.all(Array.from({length:brief.load.concurrency},async()=>{while(performance.now()<until){const t=performance.now();try{const r=await fetch(base,{redirect:'error',signal:AbortSignal.any([timeout,AbortSignal.timeout(10000)])});if(!r.ok)errors++;await r.body?.cancel();}catch{errors++;}samples.push(performance.now()-t);}}));
  samples.sort((a,b)=>a-b);const duration=(performance.now()-start)/1000,p95=samples[Math.max(0,Math.ceil(samples.length*.95)-1)]??0,errorRate=samples.length?errors/samples.length:1;
  const passed=diagnosticPassed&&samples.length>0&&p95<=brief.load.maxP95Ms&&errorRate<=brief.load.maxErrorRate;
  const result:TestResult={passed,requests:samples.length,throughputRps:samples.length/duration,p95Ms:p95,errorRate,durationSeconds:duration,mode:'live',logs:[`CreateOS execution and artifact verified. Generated diagnostic exit ${diagnostic.result.exit_code}.`,`Independent public-page benchmark: ${samples.length} requests, ${brief.load.concurrency} concurrent, ${duration.toFixed(2)}s. This measures HTTP delivery, not every business workflow.`],...(passed?{}:{failureReason:diagnosticPassed?'Measured HTTP performance did not meet requested criteria':'Generated diagnostic failed with nonzero exit; inspect and repair source'})};
  await log('HTTP benchmark',`${result.requests} requests; p95 ${p95.toFixed(1)}ms; ${(errorRate*100).toFixed(1)}% errors`,passed?0:1);
  if(keepTest&&passed){
   const deployment:Deployment={url:base,sandboxId:sandbox.id,name,token,digest,role,expiresAt:new Date(Date.now()+86400000).toISOString()};
   await checkpoint({phase:'retained',...deployment});kept=true;return {result,deployment};
  }
  return {result};
 }catch{
  await log(stage,`Execution failed during ${stage}; provider details withheld`,1);
  throw Error(`CreateOS execution failed during ${stage}. No successful result or deployment has been claimed.`);
 }finally{
  let cleanupFailed=false;
  if(!kept&&sandbox){
   try{await sandbox.destroy({timeoutMs:15000,retry:false});}
   catch{cleanupFailed=true;}
   await checkpoint({phase:cleanupFailed?'reconcile':'destroyed',name,role,sandboxId:sandbox.id}).catch(()=>{cleanupFailed=true;});
   await log('createos sandbox destroy',cleanupFailed?'Cleanup needs operator reconciliation':'Temporary sandbox cleaned up',cleanupFailed?1:0).catch(()=>undefined);
  }else if(!kept&&createAttempted){
   cleanupFailed=true;
   await checkpoint({phase:'reconcile',name,role,reason:'Sandbox creation outcome unknown; do not retry automatically'}).catch(()=>undefined);
  }
  if(!kept&&roleCreated){try{await sql(`GRANT ${role} TO CURRENT_USER`);await sql(`DROP OWNED BY ${role}`);await sql(`DROP ROLE ${role}`);}catch{cleanupFailed=true;await log('database cleanup',`Isolated role ${role} requires operator cleanup`,1).catch(()=>undefined);}}
  if(cleanupFailed)throw Error('Temporary resource cleanup requires operator reconciliation. Automatic retry stopped.');
 }
}
