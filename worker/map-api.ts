import { cities, titles } from '../shared/types';
import { cleanDisplayName, normalizePlayerName, mapCities, mapTier, MAP_NAME_LIMIT, type CityId, type LeaderEntry, type MapQuestion, type MapRoundView, type MapStats } from '../shared/map-types';
import { MAP_BANK_VERSION, selectMapQuestions } from './map-questions';
import { HttpError, json, body, roundId } from './http';

type MapEnv=Pick<Env,'DB'|'EVENT_ID'|'ENVIRONMENT'|'ACCEPTING'>;
type MapRow = {id:string;event_id:string;player_key:string;display_name:string;snapshot:string;started_at:number;expires_at:number;completed_at:number|null;score:number;active_city:CityId|null};
type AnswerRow = {city_id:CityId;question_id:string;selected:number;is_correct:number;received_at:number};
type BestRow = {display_name:string;score:number;elapsed_ms:number;rank:number};
const eventId=(env:MapEnv)=>`${env.EVENT_ID}:map-v1`;
const leader=(r:BestRow):LeaderEntry=>({name:r.display_name,score:r.score,elapsedMs:r.score?r.elapsed_ms:null,rank:r.rank});

export async function expireMapRounds(env:MapEnv,now:number,id?:string){
  await env.DB.prepare(`UPDATE map_rounds SET completed_at=expires_at,active_city=NULL
    WHERE event_id=? AND completed_at IS NULL AND expires_at<=?${id?' AND id=?':''}`)
    .bind(eventId(env),now,...(id?[id]:[])).run();
}
async function getRow(env:MapEnv,id:string){
  const row=await env.DB.prepare('SELECT * FROM map_rounds WHERE id=? AND event_id=?').bind(id,eventId(env)).first<MapRow>();
  if(!row)throw new HttpError(404,'لم نجد جولتك. ارجع للبداية لبدء تحدٍ جديد.');return row;
}
async function bestFor(env:MapEnv,key:string):Promise<LeaderEntry|null>{
  const r=await env.DB.prepare(`SELECT b.display_name,b.score,b.elapsed_ms,
    1+(SELECT COUNT(*) FROM map_best x WHERE x.event_id=b.event_id
      AND (x.score>b.score OR (x.score=b.score AND x.elapsed_ms<b.elapsed_ms))) AS rank
    FROM map_best b WHERE b.event_id=? AND b.player_key=?`).bind(eventId(env),key).first<BestRow>();
  return r?leader(r):null;
}
async function view(env:MapEnv,id:string,clock:()=>number):Promise<MapRoundView>{
  const now=clock();await expireMapRounds(env,now,id);
  // A batch gives a consistent round/answers/vote snapshot even during retries.
  const rows=await env.DB.batch([
    env.DB.prepare('SELECT * FROM map_rounds WHERE id=? AND event_id=?').bind(id,eventId(env)),
    env.DB.prepare('SELECT * FROM map_answers WHERE round_id=? ORDER BY received_at,city_id').bind(id),
    env.DB.prepare('SELECT city FROM map_votes WHERE round_id=?').bind(id),
  ]);
  const r=rows[0].results[0] as MapRow|undefined;if(!r)throw new HttpError(404,'لم نجد جولتك. ارجع للبداية.');
  const bank=JSON.parse(r.snapshot) as MapQuestion[];
  const answers=rows[1].results as AnswerRow[];
  const q=bank.find(q=>q.cityId===r.active_city);
  const tier=mapTier(r.score);
  return {name:r.display_name,startedAt:r.started_at,expiresAt:r.expires_at,serverNow:clock(),
    completed:r.completed_at!==null,score:r.score,tier,title:titles[tier],environment:env.ENVIRONMENT,
    answers:answers.map(a=>({cityId:a.city_id,questionId:a.question_id,selected:a.selected,isCorrect:!!a.is_correct,receivedAt:a.received_at})),
    activeQuestion:q&&r.completed_at===null?{id:q.id,cityId:q.cityId,prompt:q.prompt,options:q.options,chart:q.chart,year:q.year}:null,
    review:r.completed_at!==null?answers.map(a=>({...bank.find(q=>q.id===a.question_id)!,selected:a.selected,isCorrect:!!a.is_correct})):[],
    vote:(rows[2].results[0] as {city:string}|undefined)?.city||null,
    best:r.completed_at!==null?await bestFor(env,r.player_key):null};
}

export async function readMapStats(env:MapEnv,now:number):Promise<MapStats>{
  await expireMapRounds(env,now);
  const results=await env.DB.batch([
    env.DB.prepare('SELECT * FROM map_totals WHERE event_id=?').bind(eventId(env)),
    env.DB.prepare('SELECT * FROM map_score_totals WHERE event_id=?').bind(eventId(env)),
    env.DB.prepare('SELECT * FROM map_city_totals WHERE event_id=?').bind(eventId(env)),
    env.DB.prepare('SELECT city,count FROM map_poll_totals WHERE event_id=?').bind(eventId(env)),
    env.DB.prepare(`SELECT display_name,score,elapsed_ms,RANK() OVER (ORDER BY score DESC,elapsed_ms ASC) AS rank
      FROM map_best WHERE event_id=? ORDER BY score DESC,elapsed_ms ASC,achieved_at ASC,player_key ASC LIMIT 10`).bind(eventId(env)),
    env.DB.prepare('SELECT COUNT(*) count FROM map_best WHERE event_id=?').bind(eventId(env)),
  ]);
  const totals=results[0].results[0] as {completed:number;score_sum:number}|undefined;
  const distribution=Array<number>(11).fill(0);
  for(const r of results[1].results as {score:number;count:number}[])distribution[r.score/10]=r.count;
  const cityRows=results[2].results as {city_id:string;total:number;correct:number}[];
  const votes=results[3].results as {city:string;count:number}[];
  return {completed:totals?.completed||0,scoreSum:totals?.score_sum||0,names:(results[5].results[0] as {count:number}).count,distribution,
    cities:mapCities.map(c=>{const r=cityRows.find(r=>r.city_id===c.id);return {id:c.id,name:c.name,total:r?.total||0,correct:r?.correct||0};}),
    votes:cities.map(label=>({label,count:votes.find(v=>v.city===label)?.count||0})),
    leaderboard:(results[4].results as BestRow[]).map(leader),updatedAt:new Date(now).toISOString(),environment:env.ENVIRONMENT};
}
async function cachedStats(request:Request,env:MapEnv,ctx:Pick<ExecutionContext,'waitUntil'>,clock:()=>number){
  const key=new Request(`${new URL(request.url).origin}/api/map/stats?event=${encodeURIComponent(eventId(env))}`);
  const cache=await caches.open('sbn-map-v1');const hit=await cache.match(key);if(hit)return hit;
  const response=json(await readMapStats(env,clock()),200,{'Cache-Control':'public, max-age=5, s-maxage=5'});
  ctx.waitUntil(cache.put(key,response.clone()));return response;
}

export async function handleMap(request:Request,env:MapEnv,ctx:Pick<ExecutionContext,'waitUntil'>,clock:()=>number=Date.now):Promise<Response>{
  const path=new URL(request.url).pathname;
  if(request.method==='GET'&&(path==='/api/map/stats'||path==='/api/map/leaderboard'))return cachedStats(request,env,ctx,clock);
  const id=await roundId(request);
  if(request.method==='POST'&&path==='/api/map/round'){
    const existing=await env.DB.prepare('SELECT id FROM map_rounds WHERE id=? AND event_id=?').bind(id,eventId(env)).first();
    if(existing)return json(await view(env,id,clock));
    if(env.ACCEPTING!=='true')throw new HttpError(503,'استقبال المشاركات متوقف مؤقتًا.');
    const data=await body(request);const name=typeof data.name==='string'?cleanDisplayName(data.name):'';
    if(!name||!/[\p{L}]/u.test(name)||Array.from(name).length>MAP_NAME_LIMIT)throw new HttpError(400,'اكتب اسمًا صالحًا، بحد أقصى ٤٨ حرفًا.');
    const started=clock();
    await env.DB.prepare(`INSERT INTO map_rounds(id,event_id,player_key,display_name,bank_version,snapshot,started_at,expires_at)
      VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING`)
      .bind(id,eventId(env),normalizePlayerName(name),name,MAP_BANK_VERSION,JSON.stringify(selectMapQuestions()),started,started+60000).run();
    return json(await view(env,id,clock));
  }
  const r=await getRow(env,id);
  if(request.method==='GET'&&path==='/api/map/round')return json(await view(env,id,clock));
  if(request.method==='POST'&&path==='/api/map/city'){
    const data=await body(request);
    if(!mapCities.some(c=>c.id===data.cityId))throw new HttpError(400,'اختر مدينة من الخريطة.');
    const city=String(data.cityId);
    await env.DB.prepare(`UPDATE map_rounds SET active_city=? WHERE id=? AND completed_at IS NULL AND expires_at>?
      AND (active_city IS NULL OR active_city=?) AND NOT EXISTS(SELECT 1 FROM map_answers WHERE round_id=? AND city_id=?)`)
      .bind(city,id,clock(),city,id,city).run();
    const result=await view(env,id,clock);
    if(!result.completed&&result.activeQuestion?.cityId!==city)throw new HttpError(409,'أكمل سؤال المدينة المفتوحة أولًا، ولا يمكن زيارة مدينة مجاب عنها.');
    return json(result);
  }
  if(request.method==='POST'&&path==='/api/map/answer'){
    const data=await body(request);const bank=JSON.parse(r.snapshot) as MapQuestion[];
    const q=bank.find(q=>q.id===data.questionId);
    if(!q||!Number.isInteger(data.selected)||Number(data.selected)<0||Number(data.selected)>2)throw new HttpError(400,'اختر إجابة من السؤال المعروض.');
    const selected=Number(data.selected);const received=clock();
    await env.DB.prepare(`INSERT INTO map_answers(round_id,city_id,question_id,selected,is_correct,received_at)
      SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM map_rounds WHERE id=? AND completed_at IS NULL AND expires_at>? AND active_city=?)
      ON CONFLICT(round_id,city_id) DO NOTHING`)
      .bind(id,q.cityId,q.id,selected,Number(q.correct===selected),received,id,received,q.cityId).run();
    const saved=await env.DB.prepare('SELECT selected FROM map_answers WHERE round_id=? AND city_id=?').bind(id,q.cityId).first<{selected:number}>();
    if(saved&&saved.selected!==selected)throw new HttpError(409,'إجابتك الأولى محفوظة ولا يمكن تغييرها.');
    const result=await view(env,id,clock);
    if(!saved&&!result.completed)throw new HttpError(409,'افتح المدينة من الخريطة قبل الإجابة.');
    // A late request returns the final state with no new answer or points.
    return json(result);
  }
  if(request.method==='POST'&&path==='/api/map/finish')return json(await view(env,id,clock));
  if(request.method==='POST'&&path==='/api/map/vote'){
    await expireMapRounds(env,clock(),id);const current=await getRow(env,id);
    if(current.completed_at===null)throw new HttpError(409,'أكمل التحدي قبل التصويت.');
    const data=await body(request);
    if(typeof data.city!=='string'||!cities.includes(data.city))throw new HttpError(400,'اختر وجهة من القائمة.');
    await env.DB.prepare('INSERT INTO map_votes VALUES(?,?) ON CONFLICT(round_id) DO NOTHING').bind(id,data.city).run();
    const result=await view(env,id,clock);if(result.vote!==data.city)throw new HttpError(409,'تم حفظ تصويتك الأول لهذه الجولة.');return json(result);
  }
  throw new HttpError(404,'المسار غير موجود.');
}
