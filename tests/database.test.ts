import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { questions,selectQuestions } from '../worker/questions';
function database(){const db=new DatabaseSync(':memory:');db.exec(readFileSync(new URL('../migrations/0001_initial.sql',import.meta.url),'utf8'));return db;}
function round(db:DatabaseSync,id:string){db.prepare('INSERT INTO rounds(id,event_id,bank_version,snapshot) VALUES(?,?,?,?)').run(id,'test','test','[]');}
function answer(db:DatabaseSync,id:string,position:number,correct:number){db.prepare('INSERT INTO answers(round_id,position,question_id,selected,is_correct) VALUES(?,?,?,?,?) ON CONFLICT DO NOTHING').run(id,position,`q${position}`,0,correct);}
test('18 sourced questions, six topics, exactly one of each level per topic',()=>{
  assert.equal(questions.length,18);assert.equal(new Set(questions.map(q=>q.id)).size,18);
  for(const topic of new Set(questions.map(q=>q.topic)))assert.deepEqual(questions.filter(q=>q.topic===topic).map(q=>q.level).sort(),['chart','easy','medium']);
  for(const q of questions){assert.equal(q.options.length,3);assert.ok(q.correct>=0&&q.correct<3);assert.ok(q.explanation&&q.lesson&&q.year);assert.ok(new URL(q.source.url).hostname.endsWith('.gov.sa'));if(q.level==='chart'){assert.ok(q.chart);assert.ok(q.chart.values.length>=2);assert.ok(q.chart.values.every(v=>v.value>=0));}}
});
test('rounds always progress and never repeat a topic',()=>{for(let i=0;i<1000;i++){const chosen=selectQuestions();assert.deepEqual(chosen.map(q=>q.level),['easy','medium','chart']);assert.equal(new Set(chosen.map(q=>q.topic)).size,3);}});
test('idempotent answers cannot inflate score, completed count, question totals or votes',()=>{
  const db=database();round(db,'a');answer(db,'a',0,1);answer(db,'a',0,1);answer(db,'a',1,0);assert.equal(db.prepare('SELECT COUNT(*) n FROM event_totals').get()?.n,0);answer(db,'a',2,1);answer(db,'a',2,1);
  assert.equal(db.prepare('SELECT score FROM rounds').get()?.score,2);assert.equal(db.prepare('SELECT completed FROM event_totals').get()?.completed,1);assert.equal(db.prepare('SELECT SUM(total) n FROM question_totals').get()?.n,3);
  db.prepare("INSERT INTO votes(round_id,city) VALUES('a','جدة') ON CONFLICT DO NOTHING").run();db.prepare("INSERT INTO votes(round_id,city) VALUES('a','العلا') ON CONFLICT DO NOTHING").run();assert.equal(db.prepare('SELECT SUM(count) n FROM poll_totals').get()?.n,1);db.close();
});
test('10,000 completed rounds preserve aggregate invariants and event separation',()=>{
  const db=database();db.exec('BEGIN');for(let i=0;i<10000;i++){round(db,`r${i}`);const score=i%4;for(let p=0;p<3;p++)answer(db,`r${i}`,p,Number(p<score));}db.exec('COMMIT');
  assert.equal(db.prepare('SELECT completed FROM event_totals').get()?.completed,10000);assert.equal(db.prepare('SELECT score_sum FROM event_totals').get()?.score_sum,15000);assert.equal(db.prepare('SELECT SUM(total) n FROM question_totals').get()?.n,30000);assert.equal(db.prepare('SELECT COUNT(*) n FROM score_totals WHERE count=2500').get()?.n,4);
  db.prepare("INSERT INTO rounds(id,event_id,bank_version,snapshot) VALUES('other','production','test','[]')").run();for(let p=0;p<3;p++)answer(db,'other',p,1);assert.equal(db.prepare("SELECT completed FROM event_totals WHERE event_id='test'").get()?.completed,10000);db.close();
});
test('invalid cities, out of range scores and orphan answers are rejected',()=>{const db=database();round(db,'a');assert.throws(()=>db.prepare("INSERT INTO votes VALUES('a','unknown','now')").run());assert.throws(()=>answer(db,'missing',0,1));assert.throws(()=>answer(db,'a',4,1));db.close();});
