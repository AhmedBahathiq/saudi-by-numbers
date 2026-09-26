import assert from 'node:assert/strict';
import { mkdir,writeFile } from 'node:fs/promises';
const base=process.env.TEST_BASE_URL||'http://localhost:8787';
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname)&&process.env.ALLOW_STAGING_TEST!=='yes')throw new Error('Remote tests require explicit staging authorization.');
const key=crypto.randomUUID();
async function call(path,body,token=key){const res=await fetch(`${base}/api/${path}`,{method:body===undefined?'GET':'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});return{status:res.status,data:await res.json()};}
const health=await call('health');assert.equal(health.data.environment,'staging');
let response=await call('round',{});assert.equal(response.status,200);const initial=response.data;
assert.equal(initial.questions.length,3);assert.ok(initial.questions.every(q=>!('correct'in q)&&!('explanation'in q)));
const retry=await call('round',{});assert.deepEqual(retry.data.questions,initial.questions);
assert.equal((await call('answer',{questionId:initial.questions[1].id,selected:0})).status,409);
assert.equal((await call('vote',{city:'جدة'})).status,409);
assert.equal((await call('answer',{questionId:initial.questions[0].id,selected:4})).status,400);
for(const q of initial.questions){const duplicates=await Promise.all(Array.from({length:10},()=>call('answer',{questionId:q.id,selected:0})));assert.ok(duplicates.every(r=>r.status===200));response=duplicates[0];}
assert.equal(response.data.answers.length,3);assert.equal(response.data.completed,true);
assert.equal(response.data.score,response.data.answers.filter(a=>a.isCorrect).length);
assert.equal((await call('answer',{questionId:initial.questions[0].id,selected:1})).status,409);
assert.equal((await call('round',undefined,crypto.randomUUID())).status,404);
assert.equal((await call('vote',{city:'جدة'})).status,200);assert.equal((await call('vote',{city:'جدة'})).status,200);assert.equal((await call('vote',{city:'العلا'})).status,409);
const csrf=await fetch(`${base}/api/round`,{method:'POST',headers:{Origin:'https://another.example',Authorization:`Bearer ${crypto.randomUUID()}`}});assert.equal(csrf.status,403);
const report={passed:true,at:new Date().toISOString(),checks:['round idempotency','server score','answer key hidden before confirmation','sequential questions','30 concurrent retry requests','immutable answers','vote idempotency','cross-origin rejection','staging isolation']};
await mkdir('test-results',{recursive:true});await writeFile('test-results/integration.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
