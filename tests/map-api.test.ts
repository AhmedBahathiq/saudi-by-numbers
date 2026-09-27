import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync,type SQLInputValue} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {handleMap,readMapStats} from '../worker/map-api';
import {mapQuestions,selectMapQuestions} from '../worker/map-questions';
import {mapCities,mapTier,normalizePlayerName,type MapRoundView,type MapQuestion} from '../shared/map-types';
import {cardScene} from '../src/card-design';

// Executes the exact Worker SQL and triggers against SQLite, with a server clock.
const meta={duration:0,size_after:0,rows_read:0,rows_written:0,last_row_id:0,changed_db:false,changes:0};
class Statement implements D1PreparedStatement {
  constructor(readonly db:DatabaseSync,readonly sql:string,readonly values:SQLInputValue[]=[]){ }
  bind(...values:unknown[]):Statement{return new Statement(this.db,this.sql,values.map(v=>{if(v===null||typeof v==='string'||typeof v==='number'||typeof v==='bigint'||v instanceof Uint8Array)return v;throw Error('Unexpected SQL value');}));}
  execute<T>():D1Result<T>{return {success:true,meta,results:this.db.prepare(this.sql).all(...this.values) as T[]};}
  async first<T=Record<string,unknown>>(column?:string):Promise<T|null>{const row=this.db.prepare(this.sql).get(...this.values);return row?(column?row[column]:row) as T:null;}
  async all<T=Record<string,unknown>>(){return this.execute<T>();}
  async run<T=Record<string,unknown>>(){return this.execute<T>();}
  raw<T=unknown[]>(options:{columnNames:true}):Promise<[string[],...T[]]>;
  raw<T=unknown[]>(options?:{columnNames?:false}):Promise<T[]>;
  async raw<T=unknown[]>():Promise<T[]>{throw Error('raw not used by map API');}
}
class Binding implements D1Database {
  constructor(readonly db:DatabaseSync){}
  prepare(sql:string){return new Statement(this.db,sql);}
  async batch<T>(statements:D1PreparedStatement[]):Promise<D1Result<T>[]>{this.db.exec('BEGIN');try{const rows=statements.map(s=>{assert.ok(s instanceof Statement);return s.execute<T>();});this.db.exec('COMMIT');return rows;}catch(e){this.db.exec('ROLLBACK');throw e;}}
  async exec(sql:string){this.db.exec(sql);return {count:1,duration:0};}
  withSession(){return {prepare:this.prepare.bind(this),batch:this.batch.bind(this),getBookmark:()=>null};}
  async dump():Promise<ArrayBuffer>{throw Error('unused');}
}
function harness(){
  const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');for(const file of ['0001_initial.sql','0002_map_challenge.sql'])db.exec(readFileSync(new URL(`../migrations/${file}`,import.meta.url),'utf8'));
  const env={DB:new Binding(db),EVENT_ID:'test-2026',ENVIRONMENT:'staging',ACCEPTING:'true'} as const;let now=1_800_000_000_000;
  async function request(path:string,key:string,data?:unknown):Promise<MapRoundView>{const req=new Request(`http://localhost/api/map/${path}`,{method:data===undefined?'GET':'POST',headers:{authorization:`Bearer ${key}`,'content-type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)});const res=await handleMap(req,env,{waitUntil(){}},()=>now);return await res.json() as MapRoundView;}
  async function start(name='أحمد محمد'){const key=crypto.randomUUID();const round=await request('round',key,{name});return {key,round};}
  function bank():MapQuestion[]{return JSON.parse(String(db.prepare('SELECT snapshot FROM map_rounds ORDER BY started_at DESC,rowid DESC LIMIT 1').get()!.snapshot));}
  async function answer(key:string,city:string,correct=true){const round=await request('city',key,{cityId:city});const q=round.activeQuestion!;const source=mapQuestions.find(x=>x.id===q.id)!;const solution=q.options.indexOf(source.options[source.correct]);return request('answer',key,{questionId:q.id,selected:correct?solution:(solution+1)%3});}
  return {db,env,request,start,answer,bank,get now(){return now;},set now(value:number){now=value;},advance(ms:number){now+=ms;},stats:()=>readMapStats(env,now)};
}

test('map bank: 30 documented questions, 3 per city, unique ids, valid charts and varied choice order',()=>{
  assert.equal(mapQuestions.length,30);assert.equal(new Set(mapQuestions.map(q=>q.id)).size,30);
  for(const city of mapCities)assert.equal(mapQuestions.filter(q=>q.cityId===city.id).length,3);
  const allowed=['saudipedia.com','www.spa.gov.sa','spa.gov.sa','whc.unesco.org','www.uqn.gov.sa','mawani.gov.sa'];
  for(const q of mapQuestions){assert.equal(q.options.length,3);assert.equal(new Set(q.options).size,3);assert.ok(q.indicator&&q.year&&q.explanation);assert.ok(allowed.includes(new URL(q.source.url).hostname));if(q.chart)assert.ok(q.chart.values.every(v=>v.value>=0));}
  const positions=new Set<number>();for(let i=0;i<100;i++){const bank=selectMapQuestions();assert.equal(new Set(bank.map(q=>q.cityId)).size,10);for(const q of bank){const original=mapQuestions.find(x=>x.id===q.id)!;assert.equal(q.options[q.correct],original.options[original.correct]);positions.add(q.correct);}}
  assert.deepEqual([...positions].sort(),[0,1,2]);
});
test('name grouping removes decoration, preserves different letters; card tiers and 48-letter wrapping',()=>{
  assert.equal(normalizePlayerName('  أَحْمَـد   محمد '),normalizePlayerName('أحمد محمد'));
  assert.notEqual(normalizePlayerName('احمد محمد'),normalizePlayerName('أحمد محمد'));
  assert.equal(normalizePlayerName('AHMED Ali'),'ahmed ali');
  assert.deepEqual([0,10,20,30,40,60,70,100].map(mapTier),[0,0,1,1,2,2,3,3]);
  const long='عبدالرحمن محمد عبدالله عبدالعزيز أحمد عبدالرحمن';
  const scene=cardScene(80,long,100);assert.ok(scene.some(s=>s.kind==='text'&&s.value==='80 / 100'));
  assert.ok(scene.some(s=>s.kind==='text'&&s.value==='خبير البيانات'));
  assert.equal(scene.filter(s=>s.kind==='text'&&(s.y===79||s.y===87)).length,2);
  assert.ok(cardScene(2,'',3).some(s=>s.kind==='text'&&s.value==='2 / 3'));
});
test('start is idempotent, names immutable in round, server owns clock and keys stay private',async()=>{
  const h=harness();const{key,round}=await h.start();h.advance(1000);const retry=await h.request('round',key,{name:'اسم مختلف',score:100,expiresAt:h.now+999999});
  assert.equal(retry.name,round.name);assert.equal(retry.startedAt,round.startedAt);assert.equal(retry.expiresAt-round.startedAt,60000);assert.equal(retry.score,0);assert.equal(retry.activeQuestion,null);assert.deepEqual(retry.review,[]);
  const opened=await h.request('city',key,{cityId:'riyadh'});assert.ok(opened.activeQuestion);assert.equal('correct' in opened.activeQuestion!,false);assert.equal('source' in opened.activeQuestion!,false);
  await assert.rejects(()=>h.request('city',key,{cityId:'makkah'}),/أكمل سؤال/);
  await assert.rejects(()=>h.request('round','invalid'),/ابدأ جولة/);h.db.close();
});
test('blank, symbol-only, number-only and overlong names fail, two/three part names are suggestions',async()=>{
  const h=harness();for(const name of ['', '  ', '<>', '123', 'أ'.repeat(49)])await assert.rejects(()=>h.start(name),/اسمًا صالحًا/);
  const {round}=await h.start('أحمد');assert.equal(round.name,'أحمد');h.db.close();
});
test('one answer per city; duplicate, concurrent retry, wrong answers, and immutable choices',async()=>{
  const h=harness();const{key}=await h.start();h.advance(500);
  const q=(await h.request('city',key,{cityId:'jeddah'})).activeQuestion!;const source=mapQuestions.find(x=>x.id===q.id)!;const selected=q.options.indexOf(source.options[source.correct]);
  await Promise.all(Array.from({length:8},()=>h.request('answer',key,{questionId:q.id,selected,score:100})));
  let saved=await h.request('round',key);assert.equal(saved.score,10);assert.equal(saved.answers.length,1);assert.equal(saved.activeQuestion,null);
  await assert.rejects(()=>h.request('answer',key,{questionId:q.id,selected:(selected+1)%3}),/الأولى محفوظة/);
  await assert.rejects(()=>h.request('city',key,{cityId:'jeddah'}),/لا يمكن زيارة/);
  saved=await h.answer(key,'riyadh',false);assert.equal(saved.score,10);assert.equal(saved.answers.length,2);
  assert.equal(h.db.prepare('SELECT SUM(total) total FROM map_city_totals').get()!.total,2);h.db.close();
});
test('59.999s accepted; 60s rejected; early finish cannot close; refresh never restarts timer',async()=>{
  const h=harness();const{key,round}=await h.start();h.advance(1000);assert.equal((await h.request('finish',key,{})).completed,false);
  h.now=round.expiresAt-1;const before=await h.answer(key,'jeddah');assert.equal(before.score,10);assert.equal(before.completed,false);
  const q=(await h.request('city',key,{cityId:'riyadh'})).activeQuestion!;h.advance(1);
  const ended=await h.request('answer',key,{questionId:q.id,selected:0,clientTime:0});assert.equal(ended.completed,true);assert.equal(ended.score,10);assert.equal(ended.answers.length,1);assert.equal(ended.expiresAt,round.expiresAt);
  const replay=await h.request('answer',key,{questionId:before.answers[0].questionId,selected:before.answers[0].selected});assert.equal(replay.score,10);
  await h.request('finish',key,{});assert.equal((await h.stats()).completed,1);h.db.close();
});
test('all ten cities end the round early at 100, solution review only after completion, vote exactly once',async()=>{
  const h=harness();const{key}=await h.start();let result:MapRoundView|undefined;
  for(const city of mapCities){h.advance(1000);result=await h.answer(key,city.id);}
  assert.equal(result!.completed,true);assert.equal(result!.score,100);assert.equal(result!.tier,3);assert.equal(result!.review.length,10);assert.equal(result!.best!.elapsedMs,10000);
  await h.request('vote',key,{city:'جدة'});await h.request('vote',key,{city:'جدة'});await assert.rejects(()=>h.request('vote',key,{city:'الرياض'}),/الأول/);
  assert.equal((await h.stats()).votes.reduce((s,v)=>s+v.count,0),1);h.db.close();
});
test('abandoned rounds finalize on stats and best is grouped across browser tokens with tie speed',async()=>{
  const h=harness();async function play(name:string,elapsed:number,correctCount=1){const{key}=await h.start(name);for(let i=0;i<correctCount;i++){h.advance(elapsed/correctCount);await h.answer(key,mapCities[i].id);}h.advance(60001);await h.stats();return key;}
  const first=await play('أَحْمَـد محمد',15000);await play('أحمد  محمد',25000);assert.equal((await h.stats()).names,1);
  assert.equal((await h.request('round',first)).best!.elapsedMs,15000);
  await play('أحمد محمد',10000);await play('علي خالد',10000);await play('سارة محمد',5000);await play('فهد أحمد',30000,2);
  const stats=await h.stats();assert.equal(stats.completed,6);assert.equal(stats.names,4);assert.deepEqual(stats.leaderboard.map(v=>[v.score,v.rank]),[[20,1],[10,2],[10,3],[10,3]]);
  assert.equal(stats.leaderboard[2].name,'أحمد محمد');assert.equal(stats.leaderboard[3].name,'علي خالد');
  assert.equal(h.db.prepare('SELECT COUNT(*) count FROM rounds').get()!.count,0);h.db.close();
});
test('own rank is available outside top ten; zero scores tie without a timing bonus',async()=>{
  const h=harness();const keys:string[]=[];for(let i=0;i<12;i++){const {key}=await h.start(`مشارك ${i}`);keys.push(key);h.advance(100+i);await h.answer(key,'riyadh');h.advance(60000);}
  const zero=await h.start('بداية أولى');h.advance(70000);await h.start('بداية ثانية');h.advance(80000);
  const stats=await h.stats();assert.equal(stats.leaderboard.length,10);assert.equal(stats.names,14);
  assert.equal((await h.request('round',keys[11])).best!.rank,12);const zeroBest=(await h.request('round',zero.key)).best!;assert.equal(zeroBest.elapsedMs,null);assert.equal(zeroBest.rank,13);h.db.close();
});
test('map rounds remain isolated by event and legacy score constraints still apply',async()=>{
  const h=harness();const{key}=await h.start();h.advance(500);await h.answer(key,'makkah');h.advance(60001);await h.stats();
  const other={...h.env,EVENT_ID:'national-day-2026' as const};assert.equal((await readMapStats(other,h.now)).completed,0);
  assert.throws(()=>h.db.prepare("INSERT INTO rounds(id,event_id,bank_version,snapshot,score) VALUES('old','test','v','[]',100)").run());h.db.close();
});
test('10,000 map rounds retain exact summaries with repeated names and no legacy writes',()=>{
  const h=harness();const insert=h.db.prepare('INSERT INTO map_rounds(id,event_id,player_key,display_name,bank_version,snapshot,started_at,expires_at) VALUES(?,?,?,?,?,?,?,?)');
  const finish=h.db.prepare('UPDATE map_rounds SET score=?,answer_count=?,last_correct_at=?,completed_at=? WHERE id=?');
  let sum=0;h.db.exec('BEGIN');for(let i=0;i<10000;i++){const score=i%11*10;sum+=score;const start=h.now+i*60000;const id=`volume-${i}`;insert.run(id,'test-2026:map-v1',`player-${i%500}`,`مشارك ${i%500}`,'fixture','[]',start,start+60000);finish.run(score,score/10,score?start+10000:null,start+60000,id);}h.db.exec('COMMIT');
  assert.equal(h.db.prepare('SELECT completed FROM map_totals').get()!.completed,10000);assert.equal(h.db.prepare('SELECT score_sum FROM map_totals').get()!.score_sum,sum);
  assert.equal(h.db.prepare('SELECT COUNT(*) count FROM map_best').get()!.count,500);assert.equal(h.db.prepare('SELECT SUM(count) total FROM map_score_totals').get()!.total,10000);
  assert.equal(h.db.prepare('SELECT COUNT(*) count FROM event_totals').get()!.count,0);h.db.close();
});
