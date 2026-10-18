import test from 'node:test';
import assert from 'node:assert/strict';
import builder, { parseBrief } from '../../../api/builder';

const brief = { description:'  A task tracker  ', monthlyBudgetUsd:10, targetUsers:1,
 load:{concurrency:1,durationSeconds:1,maxP95Ms:1000,maxErrorRate:0} };
test('brief validation preserves client goal and enforces small execution bounds',()=>{
 assert.equal(parseBrief(brief).description,'A task tracker');
 for(const invalid of [null,[],{...brief,description:''},{...brief,monthlyBudgetUsd:-1},{...brief,targetUsers:0},
  {...brief,load:{...brief.load,concurrency:3}},{...brief,load:{...brief.load,durationSeconds:6}},
  {...brief,load:{...brief.load,maxP95Ms:NaN}}]) assert.throws(()=>parseBrief(invalid));
});
test('session cookie is protected and stable; health never includes provider secrets',async()=>{
 const before=process.env.CREATEOS_LLM_API_KEY;
 process.env.CREATEOS_LLM_API_KEY='private-test-key-not-for-response';
 try{
  const response=await builder.fetch(new Request('https://bounty-box.com/api/builder?path=health'));
  assert.equal(response.status,200);
  assert.match(response.headers.get('set-cookie')??'',/^bb_session=[a-f0-9]{64}; HttpOnly; Secure; SameSite=Strict; Path=\/api;/);
  assert.ok(!(await response.text()).includes('private-test-key-not-for-response'));
  const existing=await builder.fetch(new Request('https://bounty-box.com/api/builder?path=health',{headers:{cookie:`bb_session=${'a'.repeat(64)}`}}));
  assert.equal(existing.headers.get('set-cookie'),null);
 }finally{if(before===undefined)delete process.env.CREATEOS_LLM_API_KEY;else process.env.CREATEOS_LLM_API_KEY=before;}
});
test('cross-origin mutation is rejected before any provider/storage request',async()=>{
 const old=globalThis.fetch;globalThis.fetch=async()=>{throw new Error('Unexpected network call');};
 try{const response=await builder.fetch(new Request('https://bounty-box.com/api/builder',{method:'POST',headers:{origin:'https://evil.example','content-type':'application/json'},body:'{}'}));assert.equal(response.status,403);}
 finally{globalThis.fetch=old;}
});
