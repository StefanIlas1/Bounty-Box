import assert from 'node:assert/strict';
import { diffSnapshot } from '../web/src/app/live/snapshotAdapter.ts';
import { runReducer, initialRunState } from '../web/src/app/state/reducer.ts';
import type { RunSnapshot } from '../web/src/shared/backend.ts';
const snap:RunSnapshot={id:'test',mode:'live',status:'generating',brief:{description:'Chess',monthlyBudgetUsd:10,targetUsers:1,load:{concurrency:1,durationSeconds:1,maxP95Ms:10000,maxErrorRate:0}},candidates:[{id:'createos-neon',name:'CreateOS + Neon',description:'Live catalog selection',services:[{id:'createos/project',name:'CreateOS',role:'host',monthlyCostUsd:0}],estimatedMonthlyCostUsd:0,costAssumptions:['Credits additional'],pricingSources:[],partner:true,mode:'live',requiredEnvNames:[]}],attempts:[],events:[{id:1,at:new Date().toISOString(),stage:'generating',message:'Generating the requested app'}],createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
let state=runReducer(initialRunState,{type:'run_started',runId:snap.id,brief:{prompt:'Chess',budgetMonthly:10,targetUsers:1},at:0});
for(const event of diffSnapshot(null,snap))state=runReducer(state,event);
assert.equal(state.stackOrder.length,1);
assert.equal(state.decisions.length,1);
assert.match(state.decisions[0].evidence,/Credits additional/);
assert.equal(state.transcript.at(-1)?.text,'Generating the requested app');
assert.equal(state.stacks['createos-neon'].loadResults.length,0,'No invented benchmark');
assert.equal(diffSnapshot(snap,snap).length,0,'Polling must not duplicate entries');
console.log('Pending live run shows stack, estimate, decision and real status without fabricated results.');

for(const phase of ['awaiting_approval','buying','live','error'] as const){
 const waiting={...state,phase};
 const hydrated=runReducer(waiting,{type:'file_written',stackId:'createos-neon',path:'server.mjs',content:'// real source',at:1,preservePhase:true});
 assert.equal(hydrated.phase,phase,'Late source loading must preserve authoritative backend phase');
 assert.equal(hydrated.stacks['createos-neon'].files.length,1);
}
console.log('Late artifact hydration preserves approval and settled phases.');
