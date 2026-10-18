/** One-hour local Codex worker for the hosted builder. No inbound local server. */
import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { advance } from '../src/lib/hosted/runner.js';
import { pendingWork, beat } from '../src/lib/hosted/store.js';

for(const path of ['.env.backend.local','.env'])if(existsSync(path))loadEnvFile(path);
process.env.BOUNTYBOX_GENERATOR='codex';
process.env.NEON_DATABASE_URL??=process.env.NEON_POSTGRES_CONNECTION_STRING;
process.env.WAITLIST_DATABASE_URL??=process.env.NEON_POSTGRES_CONNECTION_STRING;
if(!process.env.WAITLIST_DATABASE_URL||!process.env.CREATEOS_PROJECT_API_KEY)throw new Error('Hosted worker requires database storage and CreateOS credentials. Values withheld.');
let stopping=false;
process.on('SIGINT',()=>{stopping=true;});process.on('SIGTERM',()=>{stopping=true;});
const deadline=Date.now()+60*60*1000;
const pause=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
await beat();
const heartbeat=setInterval(()=>{void beat().catch(()=>console.error('Worker heartbeat unavailable.'));},10_000);
console.log('Connected local Codex worker started for one hour. Hosted goals execute in real CreateOS sandboxes.');
try{
 while(!stopping&&Date.now()<deadline){
  try{
   const work=await pendingWork();
   for(const item of work){
    if(stopping||Date.now()>=deadline)break;
    console.log(`Advancing hosted run ${item.id}.`);
    await advance(item.id,item.ownerHash);
   }
  }catch{console.error('Hosted worker could not advance a run; provider details withheld.');}
  if(!stopping&&Date.now()<deadline)await pause(2000);
 }
}finally{clearInterval(heartbeat);console.log('Local worker stopped. Retained judging applications remain available until their configured expiry.');}
