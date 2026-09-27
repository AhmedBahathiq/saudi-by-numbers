// Local HTTP smoke test. Refuses public hosts so it cannot add production data.
import assert from 'node:assert/strict';
import {mapCities,type MapRoundView,type MapStats} from '../shared/map-types';
import {mapQuestions} from '../worker/map-questions';
const origin=process.argv[2]||'http://127.0.0.1:8790';
assert.ok(['127.0.0.1','localhost'].includes(new URL(origin).hostname),'Local test URL required');
const key=crypto.randomUUID();
async function call(path:string,body?:unknown,token=key){
  const response=await fetch(`${origin}/api/map/${path}`,{method:body===undefined?'GET':'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
  const result=await response.json();assert.ok(response.ok,JSON.stringify(result));return result as MapRoundView;
}
const before=await(await fetch(`${origin}/api/stats`)).json();
const start=await call('round',{name:'اختبار الحفظ الآلي'});assert.equal(start.score,0);
const retry=await call('round',{name:'اسم آخر'});assert.equal(retry.startedAt,start.startedAt);assert.equal(retry.name,start.name);
for(const city of mapCities){
  const opened=await call('city',{cityId:city.id});const q=opened.activeQuestion!;
  assert.ok(q);assert.equal('correct' in q,false);const source=mapQuestions.find(v=>v.id===q.id)!;
  const selected=q.options.indexOf(source.options[source.correct]);
  const results=await Promise.all(Array.from({length:5},()=>call('answer',{questionId:q.id,selected})));
  const latest=results.at(-1)!;assert.equal(latest.answers.filter(a=>a.cityId===city.id).length,1);
}
const final=await call('round');assert.equal(final.score,100);assert.equal(final.completed,true);assert.equal(final.title,'خبير البيانات');assert.equal(final.answers.length,10);assert.equal(final.review.length,10);
await Promise.all(Array.from({length:4},()=>call('vote',{city:'العلا'})));
assert.equal((await call('round')).vote,'العلا');
const stats=await(await fetch(`${origin}/api/map/stats?refresh=${crypto.randomUUID()}`)).json() as MapStats;
assert.ok(stats.leaderboard.length);const after=await(await fetch(`${origin}/api/stats`)).json();assert.equal(after.completed,before.completed);assert.equal(after.scoreSum,before.scoreSum);
const crossOrigin=await fetch(`${origin}/api/map/round`,{method:'POST',headers:{Origin:'https://example.org',Authorization:`Bearer ${crypto.randomUUID()}`,'Content-Type':'application/json'},body:JSON.stringify({name:'مرفوض'})});assert.equal(crossOrigin.status,403);
console.log(JSON.stringify({ok:true,score:final.score,answers:final.answers.length,elapsedMs:final.best?.elapsedMs,legacyUnchanged:true,duplicateRequests:50,originCheck:true},null,2));
