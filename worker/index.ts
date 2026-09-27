import { HttpError, json, body, roundId } from './http';
import { handleMap } from './map-api';
import { BANK_VERSION, questions, selectQuestions } from './questions';
import { cities, titles, type Question, type RoundView } from '../shared/types';

type Round = { id: string; event_id: string; bank_version: string; snapshot: string; completed_at: string | null; score: number };
type SavedAnswer = { position: number; question_id: string; selected: number; is_correct: number };
async function getRound(env:Env,id:string) {
  const row=await env.DB.prepare('SELECT * FROM rounds WHERE id=? AND event_id=?').bind(id,env.EVENT_ID).first<Round>();
  if(!row)throw new HttpError(404,'لم نجد هذه الجولة. ابدأ جولة جديدة.'); return row;
}
async function view(env:Env,round:Round):Promise<RoundView> {
  const bank=JSON.parse(round.snapshot) as Question[];
  const results=await env.DB.batch([
    env.DB.prepare('SELECT position,question_id,selected,is_correct FROM answers WHERE round_id=? ORDER BY position').bind(round.id),
    env.DB.prepare('SELECT city FROM votes WHERE round_id=?').bind(round.id)
  ]);
  const answers=(results[0].results as SavedAnswer[]).map(a=>({questionId:a.question_id,selected:a.selected,correct:bank[a.position].correct,isCorrect:!!a.is_correct,explanation:bank[a.position].explanation,lesson:bank[a.position].lesson}));
  return {questions:bank.map(({correct:_,explanation:__,lesson:___,...q})=>q),answers,completed:!!round.completed_at,score:round.score,title:titles[round.score],vote:(results[1].results[0] as {city:string}|undefined)?.city||null,environment:env.ENVIRONMENT};
}
async function stats(request:Request,env:Env,ctx:ExecutionContext) {
  const cacheKey=new Request(`${new URL(request.url).origin}/api/stats?event=${encodeURIComponent(env.EVENT_ID)}`);
  const cache=await caches.open('sbn-statistics'); const hit=await cache.match(cacheKey); if(hit)return hit;
  const rows=await env.DB.batch([
    env.DB.prepare('SELECT * FROM event_totals WHERE event_id=?').bind(env.EVENT_ID),
    env.DB.prepare('SELECT score,count FROM score_totals WHERE event_id=?').bind(env.EVENT_ID),
    env.DB.prepare('SELECT * FROM question_totals WHERE event_id=?').bind(env.EVENT_ID),
    env.DB.prepare('SELECT city,count FROM poll_totals WHERE event_id=?').bind(env.EVENT_ID)
  ]);
  const totals=rows[0].results[0] as {completed:number;score_sum:number}|undefined;
  const distribution=[0,0,0,0]; for(const row of rows[1].results as {score:number;count:number}[])distribution[row.score]=row.count;
  const questionRows=rows[2].results as {question_id:string;total:number;correct:number;choice0:number;choice1:number;choice2:number}[];
  const votes=rows[3].results as {city:string;count:number}[];
  const response=json({completed:totals?.completed||0,scoreSum:totals?.score_sum||0,distribution,
    questions:questions.map(q=>{const row=questionRows.find(r=>r.question_id===q.id);return{id:q.id,topic:q.topic,prompt:q.prompt,total:row?.total||0,correct:row?.correct||0,choices:q.options.map((label,i)=>({label,count:row?([row.choice0,row.choice1,row.choice2][i]):0}))};}),
    votes:cities.map(label=>({label,count:votes.find(v=>v.city===label)?.count||0})),updatedAt:new Date().toISOString(),environment:env.ENVIRONMENT
  },200,{'Cache-Control':'public, max-age=5, s-maxage=5'});
  ctx.waitUntil(cache.put(cacheKey,response.clone()));return response;
}

export default {
  async fetch(request:Request,env:Env,ctx:ExecutionContext):Promise<Response> {
    const url=new URL(request.url);
    if(!url.pathname.startsWith('/api/'))return env.ASSETS.fetch(request);
    try {
      if(request.method==='GET'&&url.pathname==='/api/stats')return await stats(request,env,ctx);
      if(request.method==='GET'&&url.pathname==='/api/health')return json({ok:true,environment:env.ENVIRONMENT,accepting:env.ACCEPTING==='true'});
      if(request.method!=='GET'&&request.headers.get('origin')&&request.headers.get('origin')!==url.origin)throw new HttpError(403,'مصدر الطلب غير مسموح.');
      if(url.pathname.startsWith('/api/map/'))return await handleMap(request,env,ctx);
      const id=await roundId(request);
      if(request.method==='POST'&&url.pathname==='/api/round') {
        if(env.ACCEPTING!=='true')throw new HttpError(503,'استقبال المشاركات متوقف مؤقتًا. تقدر تتصفح النتائج.');
        await env.DB.prepare('INSERT INTO rounds(id,event_id,bank_version,snapshot) VALUES(?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(id,env.EVENT_ID,BANK_VERSION,JSON.stringify(selectQuestions())).run();
        return json(await view(env,await getRound(env,id)));
      }
      const round=await getRound(env,id);
      if(request.method==='GET'&&url.pathname==='/api/round')return json(await view(env,round));
      if(request.method==='POST'&&url.pathname==='/api/answer') {
        const data=await body(request); const bank=JSON.parse(round.snapshot) as Question[];
        const position=bank.findIndex(q=>q.id===data.questionId);
        if(position<0||!Number.isInteger(data.selected)||Number(data.selected)<0||Number(data.selected)>2)throw new HttpError(400,'اختر إجابة من الخيارات المعروضة.');
        const selected=Number(data.selected);
        await env.DB.prepare(`INSERT INTO answers(round_id,position,question_id,selected,is_correct)
          SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM rounds WHERE id=? AND completed_at IS NULL)
          AND (SELECT COUNT(*) FROM answers WHERE round_id=?)=? ON CONFLICT(round_id,position) DO NOTHING`)
          .bind(id,position,bank[position].id,selected,Number(bank[position].correct===selected),id,id,position).run();
        const saved=await env.DB.prepare('SELECT selected FROM answers WHERE round_id=? AND position=?').bind(id,position).first<{selected:number}>();
        if(!saved)throw new HttpError(409,'أكمل السؤال السابق أولًا.');
        if(saved.selected!==selected)throw new HttpError(409,'إجابتك الأولى محفوظة ولا يمكن تغييرها. حدّث الجولة للمتابعة.');
        return json(await view(env,await getRound(env,id)));
      }
      if(request.method==='POST'&&url.pathname==='/api/vote') {
        const data=await body(request);
        if(!round.completed_at)throw new HttpError(409,'أكمل التحدي قبل التصويت.');
        if(typeof data.city!=='string'||!cities.includes(data.city))throw new HttpError(400,'اختر وجهة من القائمة.');
        await env.DB.prepare('INSERT INTO votes(round_id,city) VALUES(?,?) ON CONFLICT(round_id) DO NOTHING').bind(id,data.city).run();
        const result=await view(env,round);
        if(result.vote!==data.city)throw new HttpError(409,'تم حفظ تصويتك الأول لهذه الجولة.');
        return json(result);
      }
      throw new HttpError(404,'المسار غير موجود.');
    } catch(error) {
      if(error instanceof HttpError)return json({error:error.message},error.status);
      console.error(JSON.stringify({event:'api_error',path:url.pathname,message:error instanceof Error?error.message:'unknown'}));
      return json({error:'تعذّر الاتصال بالبيانات الآن. احتفظ باختيارك وحاول مرة ثانية.'},503);
    }
  }
} satisfies ExportedHandler<Env>;
