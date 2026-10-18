import test from 'node:test';
import assert from 'node:assert/strict';
import product from '../../../api/product';

test('product wrapper isolates the real app, validates addresses and handles unavailable records',async()=>{
 const originalFetch=globalThis.fetch, originalDb=process.env.WAITLIST_DATABASE_URL;
 process.env.WAITLIST_DATABASE_URL='postgresql://test:test@ep-test.us-east-1.aws.neon.tech/test';
 const expires=new Date(Date.now()+3600000).toISOString();
 let rows:unknown[][]=[['https://example-3000.app.sb.createos.sh','<script>private-test-token</script>',expires]];
 let fail=false;
 globalThis.fetch=async(_url,init)=>{
  if(fail)throw new Error('private provider failure');
  const query=JSON.parse(String(init?.body)).query as string;
  assert.ok(!query.includes('SELECT private_state FROM'));
  return new Response(JSON.stringify({rows:query.startsWith('SELECT private_state->')?rows:[]}));
 };
 const request=()=>new Request('https://bounty-box.com/product-v1/task-tracker',{headers:{cookie:'bb_session=private-session'}});
 try{
  const good=await product.fetch(request());const html=await good.text();
  assert.equal(good.status,200);assert.match(html,/sandbox="allow-scripts allow-forms allow-same-origin"/);
  assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('private-session'));assert.ok(!html.includes('postgresql://'));
  assert.ok(good.headers.get('content-security-policy')?.includes('frame-src https://example-3000.app.sb.createos.sh'));
  for(const url of ['https://evil.example','http://example.app.sb.createos.sh','https://example.app.sb.createos.sh.evil.example','https://secret@example.app.sb.createos.sh','https://example.app.sb.createos.sh:8443','https://example.app.sb.createos.sh/?token=secret']){
   rows=[[url,'App',expires]];assert.notEqual((await product.fetch(request())).status,200,url);
  }
  rows=[['https://example.app.sb.createos.sh','App','2000-01-01T00:00:00Z']];assert.equal((await product.fetch(request())).status,404);
  rows=[];assert.equal((await product.fetch(request())).status,404);
  fail=true;const failed=await product.fetch(request());assert.equal(failed.status,503);assert.ok(!(await failed.text()).includes('private provider'));
  assert.equal((await product.fetch(new Request('https://bounty-box.com/product-v1/test',{method:'POST'}))).status,405);
 }finally{globalThis.fetch=originalFetch;if(originalDb===undefined)delete process.env.WAITLIST_DATABASE_URL;else process.env.WAITLIST_DATABASE_URL=originalDb;}
});
