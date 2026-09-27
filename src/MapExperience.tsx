import {useCallback,useEffect,useRef,useState,type CSSProperties} from 'react';
import {ArrowLeft,ArrowUpLeft,BarChart3,Check,ChevronDown,Clock3,Crown,ExternalLink,Flag,MapPin,Maximize2,RefreshCw,Route,Sparkles,Trophy,Users,WifiOff,X} from 'lucide-react';
import QRCode from 'qrcode';
import {mapCities,MAP_NAME_LIMIT,cleanDisplayName,type CityId,type LeaderEntry,type MapRoundView,type MapStats} from '../shared/map-types';
import {cities,type Chart} from '../shared/types';
import {api,readSession,writeSession} from './api';
import {SaudiMap} from './SaudiMap';
import {PersonalCard} from './PersonalCard';
import './map.css';

const format=new Intl.NumberFormat('ar-SA',{maximumFractionDigits:1});const n=(value:number)=>format.format(value);
const seconds=(value:number)=>new Intl.NumberFormat('ar-SA',{minimumFractionDigits:3,maximumFractionDigits:3}).format(value/1000);
function rememberedName(){try{return localStorage.getItem('map-player-name')||'';}catch{return '';}}
type PendingAnswer={questionId:string;selected:number};
function readPending(key:string):PendingAnswer|null{try{return JSON.parse(readSession(`map-pending-${key}`)||'null');}catch{return null;}}
function ErrorNotice({message}:{message:string}){return message?<div className="error" role="alert"><WifiOff size={18}/><span>{message}</span></div>:null;}
function MapChart({chart}:{chart:Chart}){const max=Math.max(...chart.values.map(v=>v.value),1);return <figure className="map-chart"><figcaption>{chart.title}<small>{chart.unit} · المقياس يبدأ من الصفر</small></figcaption>{chart.values.map(v=><div className="map-chart-row" key={v.label}><span>{v.label}</span><div><i style={{width:`${v.value/max*100}%`}}/></div><b>{n(v.value)}</b></div>)}{chart.note&&<small>{chart.note}</small>}</figure>;}

function useMapStats(interval:number){const[data,setData]=useState<MapStats|null>(null);const[error,setError]=useState('');useEffect(()=>{let alive=true,busy=false;async function refresh(){if(document.hidden||busy)return;busy=true;try{const data=await api<MapStats>('map/stats');if(alive){setData(data);setError('');}}catch(e){if(alive)setError((e as Error).message);}finally{busy=false;}}void refresh();const timer=setInterval(()=>void refresh(),interval);document.addEventListener('visibilitychange',refresh);return()=>{alive=false;clearInterval(timer);document.removeEventListener('visibilitychange',refresh);};},[interval]);return{data,error};}

export function MapExperience({path,navigate}:{path:string;navigate:(path:string)=>void}){
  const[key,setKey]=useState(()=>readSession('map-round-key')||'');
  const[round,setRound]=useState<MapRoundView|null>(null);const[rawName,setName]=useState(rememberedName);
  const[busy,setBusy]=useState(false);const[loading,setLoading]=useState(!!key);const[error,setError]=useState('');
  const[pending,setPending]=useState<PendingAnswer|null>(()=>readPending(key));
  const[feedback,setFeedback]=useState<{correct:boolean}|null>(null);
  const[remaining,setRemaining]=useState(60_000);const clock=useRef({left:60000,at:performance.now()});
  const inFlight=useRef(false);const finishAttempt=useRef(false);const feedbackTimer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  const headerFocus=useRef<HTMLHeadingElement>(null);
  const questionFocus=useRef<HTMLHeadingElement>(null);
  const cityList=useRef<HTMLDivElement>(null);
  const accept=useCallback((value:MapRoundView)=>{setRound(value);clock.current={left:Math.max(0,value.expiresAt-value.serverNow),at:performance.now()};setRemaining(clock.current.left);},[]);
  useEffect(()=>()=>clearTimeout(feedbackTimer.current),[]);
  useEffect(()=>{headerFocus.current?.focus();setError('');},[path]);
  useEffect(()=>{if(round?.activeQuestion)questionFocus.current?.focus();else if(path==='/map'&&!feedback)cityList.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({preventScroll:true});},[round?.activeQuestion?.id,feedback,path]);
  async function sync(token=key){
    if(!token||inFlight.current)return;inFlight.current=true;setBusy(true);setError('');
    try{const value=await api<MapRoundView>('map/round',{key:token});accept(value);const saved=readPending(token);if(value.completed||value.answers.some(a=>a.questionId===saved?.questionId)){writeSession(`map-pending-${token}`,'');setPending(null);}else if(saved){setPending(saved);setError('اختيارك لم يصل إلى الخادم بعد. أعد إرساله قبل انتهاء الوقت.');}if(path.startsWith('/map')&&value.completed)navigate('/map-result');}
    catch(e){setError((e as Error).message);}finally{inFlight.current=false;setBusy(false);setLoading(false);}
  }
  useEffect(()=>{if(key)void sync(key);else setLoading(false);},[]);
  useEffect(()=>{
    if(!round||round.completed)return;
    const tick=()=>setRemaining(Math.max(0,clock.current.left-(performance.now()-clock.current.at)));
    tick();const timer=setInterval(tick,100);const resume=()=>{tick();if(!document.hidden&&!inFlight.current)void sync();};
    const reconnect=()=>{if(!inFlight.current)void sync();};
    document.addEventListener('visibilitychange',resume);window.addEventListener('online',reconnect);
    return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',resume);window.removeEventListener('online',reconnect);};
  },[round?.startedAt,round?.completed,key]);
  useEffect(()=>{
    if(remaining>0||!round||round.completed||inFlight.current||finishAttempt.current)return;
    finishAttempt.current=true;void finish();
  },[remaining,round?.completed,busy]);
  async function finish(){
    if(inFlight.current)return;inFlight.current=true;
    setBusy(true);setError('');try{const value=await api<MapRoundView>('map/finish',{method:'POST',key});accept(value);if(value.completed){setPending(null);writeSession(`map-pending-${key}`,'');navigate('/map-result');}else finishAttempt.current=false;}
    catch(e){setError((e as Error).message);}finally{inFlight.current=false;setBusy(false);}
  }
  async function start(){
    if(inFlight.current||loading)return;
    if(round&&!round.completed){navigate('/map');return;}
    const name=cleanDisplayName(rawName);if(!name||!/[\p{L}]/u.test(name)||Array.from(name).length>MAP_NAME_LIMIT){setError('اكتب اسمك أولًا، بحد أقصى ٤٨ حرفًا.');return;}
    setError('');setBusy(true);inFlight.current=true;
    let token=key;if(!token||round?.completed){token=crypto.randomUUID();setKey(token);writeSession('map-round-key',token);}
    try{await document.fonts.ready;const value=await api<MapRoundView>('map/round',{method:'POST',key:token,body:{name}});accept(value);setName(value.name);try{localStorage.setItem('map-player-name',value.name);}catch{/* Optional convenience only. */}finishAttempt.current=false;navigate(value.completed?'/map-result':'/map');}
    catch(e){setError((e as Error).message);}finally{setBusy(false);inFlight.current=false;}
  }
  async function chooseCity(cityId:CityId){
    if(inFlight.current||remaining<=0||feedback)return;inFlight.current=true;setBusy(true);setError('');
    try{const value=await api<MapRoundView>('map/city',{method:'POST',key,body:{cityId}});accept(value);if(value.completed)navigate('/map-result');}
    catch(e){setError((e as Error).message);}finally{setBusy(false);inFlight.current=false;}
  }
  async function answer(choice:PendingAnswer){
    if(inFlight.current)return;inFlight.current=true;setBusy(true);setError('');setPending(choice);writeSession(`map-pending-${key}`,JSON.stringify(choice));
    try{
      const value=await api<MapRoundView>('map/answer',{method:'POST',key,body:choice});accept(value);
      const saved=value.answers.find(a=>a.questionId===choice.questionId);setPending(null);writeSession(`map-pending-${key}`,'');
      if(saved){setFeedback({correct:saved.isCorrect});clearTimeout(feedbackTimer.current);feedbackTimer.current=setTimeout(()=>{setFeedback(null);if(value.completed)navigate('/map-result');},1000);}
      else if(value.completed)navigate('/map-result');
    }catch(e){setError((e as Error).message);}finally{setBusy(false);inFlight.current=false;}
  }
  function again(){clearTimeout(feedbackTimer.current);setFeedback(null);setRound(null);setKey('');writeSession('map-round-key','');setPending(null);setError('');finishAttempt.current=false;navigate('/');}
  async function vote(city:string){if(inFlight.current)return;inFlight.current=true;setBusy(true);setError('');writeSession(`map-vote-${key}`,city);try{accept(await api<MapRoundView>('map/vote',{method:'POST',key,body:{city}}));}catch(e){setError((e as Error).message);}finally{inFlight.current=false;setBusy(false);}}

  if(path.startsWith('/results'))return <MapResults key={path} navigate={navigate} roundKey={key}/>;
  if(path==='/map-result'&&round?.completed)return <MapResult round={round} busy={busy} error={error} vote={vote} again={again} navigate={navigate} voteChoice={readSession(`map-vote-${key}`)||''}/>;
  if(path.startsWith('/map')&&(!round||loading))return <main className="wrap map-loading"><Route size={40}/><h1>نسترجع رحلتك…</h1><ErrorNotice message={error}/>{error&&<button className="button green" onClick={()=>void sync()}>إعادة المحاولة</button>}{!key&&<button className="button green" onClick={()=>navigate('/')}>ابدأ من هنا</button>}</main>;
  if(path==='/map'&&round){
    const question=round.activeQuestion;const activeCity=mapCities.find(c=>c.id===question?.cityId);const time=Math.ceil(remaining/1000);
    return <main className="wrap map-game"><div className="game-heading"><div><p className="eyebrow"><Route size={17}/> رحلتك في المملكة</p><h1 ref={headerFocus} tabIndex={-1}>{round.name}، وين وجهتك؟</h1></div><span className="round-counter">{n(round.answers.length)} / ١٠ مدن</span></div>
      <div className="game-hud"><div className={`time-block ${time<=10?'urgent':''}`}><div className="timer-dial" style={{'--timer-progress':`${remaining/60000*100}%`} as CSSProperties}><Clock3 size={23}/></div><div><small>الوقت المتبقي</small><strong role="timer" aria-label={`${time} ثانية متبقية`}>{n(time).padStart(2,'٠')}<span> ثانية</span></strong></div></div><span className="hud-divider"/><div className="points-block"><Trophy size={26}/><div><small>رصيدك الآن</small><strong>{n(round.score)}<span> نقطة</span></strong></div></div><div className="hud-tip"><Sparkles size={17}/>كل مدينة… فرصة جديدة</div></div>
      <ErrorNotice message={error}/>{error&&<div className="retry-actions">{pending&&<button className="button green" disabled={busy} onClick={()=>void answer(pending)}>إعادة إرسال اختياري</button>}<button className="text-button" disabled={busy} onClick={()=>void sync()}>استرجاع المحفوظ</button></div>}
      <div className="game-board"><SaudiMap answers={round.answers} disabled={busy||!!question||!!feedback||remaining<=0||round.completed} onSelect={city=>void chooseCity(city)}/><aside className="city-sidebar"><div><span className="eyebrow">اختر وجهتك</span><h2>كل مدينة لها حكاية.</h2><p>سؤال واحد لكل مدينة.<br/>صح = ١٠ نقاط. جرّب تجمعها كلها!</p></div><div className="city-picker" ref={cityList} aria-label="قائمة المدن">{mapCities.map(city=>{const answered=round.answers.find(a=>a.cityId===city.id);return <button key={city.id} disabled={busy||!!question||!!feedback||!!answered||remaining<=0||round.completed} onClick={()=>void chooseCity(city.id)} className={answered?(answered.isCorrect?'city-correct':'city-wrong'):''}><MapPin size={16}/><span>{city.name}</span>{answered?(answered.isCorrect?<b>+١٠ <Check size={14}/></b>:<X size={16}/>):<ArrowUpLeft size={15}/>}</button>;})}</div><small className="map-help">تقدر تختار من الخريطة أو القائمة.</small></aside>
        {(question||feedback||remaining<=0||round.completed)&&<div className="question-overlay"><section className={`map-question ${feedback?'show-feedback':''}`} role="dialog" aria-modal="true" onKeyDown={e=>{if(e.key!=='Tab')return;const buttons=[...e.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];const first=buttons[0],last=buttons.at(-1);if(!first){e.preventDefault();return;}if(e.shiftKey&&(document.activeElement===first||document.activeElement===questionFocus.current)){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}} aria-label={feedback?'نتيجة الإجابة':remaining<=0?'انتهى الوقت':`سؤال ${activeCity?.name}`}>
          {feedback?<div className={`quick-feedback ${feedback.correct?'correct':'wrong'}`} role="status">{feedback.correct?<Check size={46}/>:<Sparkles size={43}/>}<h2>{feedback.correct?'في مكانها!':'المعلومة الجاية لك'}</h2><strong>{feedback.correct?'+١٠':'٠'} <span>نقطة</span></strong><p>نرجع للخريطة…</p></div>:remaining<=0||round.completed?<div className="time-ended"><Flag size={43}/><h2>انتهت رحلتك!</h2><p>نجمع إنجازك ونجهّز بطاقتك.</p>{error?<><ErrorNotice message={error}/><button className="button green" disabled={busy} onClick={()=>void finish()}>استرجاع نتيجتي</button></>:<RefreshCw className="spin" size={22}/>}</div>:question?<><div className="map-question-heading"><span><MapPin size={17}/>{activeCity?.name}</span><span>+١٠ نقاط</span></div><div className="question-time"><Clock3 size={14}/>{n(time)} ثانية متبقية</div><h2 key={question.id} tabIndex={-1} ref={questionFocus}>{question.prompt}</h2>{question.chart&&<MapChart chart={question.chart}/>}<div className="map-answer-options">{question.options.map((option,i)=><button key={i} disabled={busy||!!pending} className={pending?.selected===i?'pending-option':''} onClick={()=>void answer({questionId:question.id,selected:i})}><span>{['أ','ب','ج'][i]}</span>{option}{busy&&pending?.selected===i&&<RefreshCw size={17} className="spin"/>}</button>)}</div><small className="answer-note">اختيارك يثبت مباشرة · الوقت مستمر</small>{error&&<><ErrorNotice message={error}/><button className="button green" disabled={busy} onClick={()=>pending?void answer(pending):void sync()}>إعادة المحاولة</button><button className="text-button" onClick={()=>void sync()}>استرجاع الإجابة المحفوظة</button></>}</>:null}
        </section></div>}
      </div><p className="game-bottom-note">التفسير والمصدر ينتظرانك بعد الجولة. ركّز الآن، واكتشف أكثر.</p>
    </main>;
  }
  const resume=!!round&&!round.completed;
  return <main className="wrap map-home"><section className="map-hero"><div className="map-hero-copy"><div className="national-label"><Sparkles size={15}/><span>اليوم الوطني · نادي علوم البيانات</span></div><p className="hero-kicker">رحلة في وطن… وسباق مع الدقيقة</p><h1>السعودية<br/><em>بالأرقام<span>.</span></em></h1><p className="map-hero-description">عشر مدن. دقيقة واحدة.<br/>اختر وجهتك، اكتشف حكايتها، واجمع نقاطك.</p><div className="map-facts"><span><Clock3 size={17}/><b>٦٠</b> ثانية</span><span><MapPin size={17}/><b>١٠</b> مدن</span><span><Trophy size={17}/><b>١٠٠</b> نقطة</span></div>
        <form className="map-start-form" onSubmit={e=>{e.preventDefault();void start();}}><label htmlFor="map-player-name">بأي اسم نكتب إنجازك؟</label><div className="map-name-input"><Users size={19}/><input id="map-player-name" value={resume?round.name:rawName} disabled={resume||busy||loading} onChange={e=>setName(e.target.value)} maxLength={MAP_NAME_LIMIT} autoComplete="off" placeholder="اسمك الثنائي أو الثلاثي" aria-describedby="map-name-privacy"/><span>{n(Array.from(resume?round.name:rawName).length)}/٤٨</span></div><p id="map-name-privacy">اسمك ونقاطك يظهران للجميع في الليدربورد وعلى بطاقتك. اختر اسمًا ثنائيًا أو ثلاثيًا لتمييز نتيجتك؛ الأسماء المتطابقة تشترك في أفضل نتيجة.</p><button className="button map-start" disabled={busy||loading}>{busy||loading?<RefreshCw size={20} className="spin"/>:<Flag size={20}/>}<span>{loading?'نسترجع الجولة…':busy?'نجهّز رحلتك…':resume?'كمّل رحلتك':'ابدأ التحدّي'}</span><ArrowLeft size={22}/></button><ErrorNotice message={error}/>{error&&key&&<button type="button" className="text-button" disabled={busy} onClick={()=>void sync()}>استرجاع الجولة</button>}</form>
        <button className="text-button map-leaders-link" onClick={()=>navigate('/results?tab=leaderboard')}>مين يتصدّر الليدربورد؟ <ArrowUpLeft size={17}/></button></div>
      <div className="map-hero-art"><div className="map-art-caption"><span className="live-dot"/>وطن نعرفه… ووطن نكتشفه</div><SaudiMap decorative/><div className="map-art-card"><span className="map-art-icon"><Route size={25}/></span><div><small>مسارك تصنعه بنفسك</small><b>وين تبدأ رحلتك؟</b></div><span className="map-art-dots">•••</span></div></div></section>
      <section className="map-how"><article><span>٠١</span><div><h2>اختر مدينة</h2><p>لفّ المملكة بطريقتك.</p></div></article><article><span>٠٢</span><div><h2>جاوب واجمع</h2><p>كل إجابة صحيحة تضيف ١٠ نقاط.</p></div></article><article><span>٠٣</span><div><h2>خلّ إنجازك يبقى</h2><p>بطاقة باسمك ومكان في الليدربورد.</p></div></article></section><p className="map-bank-note">٣٠ سؤالًا موثّقًا · سؤال عشوائي لكل مدينة · يتوقف التحدّي بانتهاء الدقيقة أو المدن العشر</p>
    </main>;
}

function MapResult({round,busy,error,vote,again,navigate,voteChoice}:{round:MapRoundView;busy:boolean;error:string;vote:(city:string)=>Promise<void>;again:()=>void;navigate:(path:string)=>void;voteChoice:string}){
  const[choice,setChoice]=useState(round.vote||voteChoice);const[showReview,setShowReview]=useState(false);
  return <main className="wrap personalized-result map-result"><section className="map-result-heading"><span className="eyebrow"><Sparkles size={17}/>انتهت الدقيقة، وبقي الاكتشاف</span><h1>{round.name}، <em>هذه حكايتك.</em></h1><p>{round.title} · كل مدينة زرتها أضافت لك معرفة.</p></section><div className="map-result-metrics"><div><Trophy/><b>{n(round.score)}<small> / ١٠٠</small></b><span>نقاط هذه الجولة</span></div><div><MapPin/><b>{n(round.answers.length)}</b><span>مدن أجبت عنها</span></div><div><Check/><b>{n(round.score/10)}</b><span>إجابات صحيحة</span></div><div><Crown/><b>{round.best?`#${n(round.best.rank)}`:'—'}</b><span>ترتيب أفضل نتيجة لاسمك</span></div></div>{round.best&&<p className="personal-best">أفضل نتيجة باسمك: <b>{n(round.best.score)} نقطة</b>{round.best.elapsedMs!==null&&<> · وصلت لها خلال {seconds(round.best.elapsedMs)} ثانية</>}</p>}
    <PersonalCard round={round}/><div className="result-actions"><button className="button green" onClick={again}>أرفع رصيدي بجولة جديدة <RefreshCw size={18}/></button><button className="text-button" onClick={()=>navigate('/results?tab=leaderboard')}>شوف الليدربورد <ArrowUpLeft size={18}/></button></div>
    <section className="map-review"><button aria-expanded={showReview} onClick={()=>setShowReview(v=>!v)}><div><span className="eyebrow">المعرفة هي المكسب</span><h2>وش اكتشفنا في الرحلة؟</h2></div><ChevronDown className={showReview?'expanded':''}/></button>{showReview&&<div className="review-list">{round.review.length===0?<p>ما تأكدت إجابة في هذه الجولة. جرّب من جديد، والمدن تنتظرك.</p>:round.review.map(q=><article key={q.id}><div className="review-city"><MapPin size={15}/>{mapCities.find(c=>c.id===q.cityId)?.name}<span className={q.isCorrect?'good':'miss'}>{q.isCorrect?'صحيحة · +١٠':'معلومة جديدة · ٠'}</span></div><h3>{q.prompt}</h3><p>إجابتك: {q.options[q.selected]}{!q.isCorrect&&<> · الصحيحة: <b>{q.options[q.correct]}</b></>}</p><p>{q.explanation}</p>{q.chart&&<MapChart chart={q.chart}/>}<small>{q.indicator}<br/>المرجع الزمني: {q.year}</small><a href={q.source.url} target="_blank" rel="noreferrer">{q.source.name}<ExternalLink size={14}/></a></article>)}</div>}</section>
    <section className="poll-panel"><div><span className="eyebrow">بيانات المشاركين</span><h2>أي وجهة سعودية تتمنى تزورها؟</h2><p>اختيارك يصير جزءًا من الرسم. التصويت اختياري.</p></div><div className="poll-body">{round.vote?<div className="vote-success" role="status"><Check/><span>سجلنا اختيارك: <b>{round.vote}</b></span><button className="text-button" onClick={()=>navigate('/results')}>شوف الرسم</button></div>:<><div className="city-options">{cities.map(city=><button key={city} className={choice===city?'chosen':''} disabled={busy} onClick={()=>setChoice(city)}><MapPin size={15}/>{city}</button>)}</div><button className="button green" disabled={!choice||busy} onClick={()=>void vote(choice)}>{busy?'نحفظ صوتك…':'أضف صوتك'}<ArrowLeft size={18}/></button></>}<ErrorNotice message={error}/></div></section>
  </main>;
}

function Leaderboard({entries,best}:{entries:LeaderEntry[];best:LeaderEntry|null}){
  const podium=entries.slice(0,3);
  return <section className="leaderboard"><div className="leader-intro"><span className="eyebrow"><Trophy size={18}/>ليدربورد</span><h2>أسماء صنعت <em>الصدارة.</em></h2><p>أعلى النقاط أولًا، ثم الأسرع للوصول إليها. أفضل جولة لكل اسم.</p></div>{entries.length?<><div className="leader-podium">{podium.map((entry,i)=><article className={`podium-place podium-${i}`} key={entry.name}><span className="podium-crown">{i===0?<Crown size={28}/>:<Trophy size={24}/>}</span><span className="podium-rank">#{n(entry.rank)}</span><h3 dir="auto">{entry.name}</h3><strong>{n(entry.score)} <small>نقطة</small></strong><span className="podium-time">{entry.elapsedMs===null?'بداية جديدة تنتظرك':`${seconds(entry.elapsedMs)} ثانية`}</span></article>)}</div><div className="leader-table" role="table" aria-label="أعلى عشر نتائج"><div role="row" className="leader-table-head"><span role="columnheader">الترتيب</span><span role="columnheader">الاسم</span><span role="columnheader">النقاط</span><span role="columnheader">زمن الوصول</span></div>{entries.map(entry=><div role="row" key={entry.name}><span role="cell" className="rank-number">{n(entry.rank)}</span><b role="cell" dir="auto">{entry.name}</b><strong role="cell">{n(entry.score)}</strong><span role="cell">{entry.elapsedMs===null?'—':`${seconds(entry.elapsedMs)} ث`}</span></div>)}</div></>:<div className="leader-empty"><Flag size={38}/><h3>الصدارة تنتظر أول اسم.</h3><p>ابدأ التحدّي، واجعل نقاطك أول الحكاية.</p></div>}{best&&<div className="your-ranking"><span><MapPin size={19}/>أفضل نتيجة باسمك</span><b dir="auto">{best.name}</b><strong>#{n(best.rank)} · {n(best.score)} نقطة</strong></div>}<p className="leader-explainer">الأسماء المتطابقة تشترك في سجل واحد. الترتيب بحسب الاسم المدخل، وليس هوية موثّقة. عند تطابق النقاط والزمن يتشارك الاسمان الترتيب.</p></section>;
}

function MapResults({navigate,roundKey}:{navigate:(path:string)=>void;roundKey:string}){
  const params=new URLSearchParams(location.search);const display=params.get('display')==='1';const tab=params.get('tab')==='leaderboard'?'leaderboard':'stats';
  const{data,error}=useMapStats(display?5000:30000);const[best,setBest]=useState<LeaderEntry|null>(null);const[qr,setQr]=useState('');
  useEffect(()=>{if(roundKey&&data)void api<MapRoundView>('map/round',{key:roundKey}).then(v=>setBest(v.best)).catch(()=>{});},[data?.updatedAt,roundKey]);
  useEffect(()=>{if(display)void QRCode.toDataURL(location.origin,{width:180,margin:1}).then(setQr).catch(()=>{});},[display]);
  function url(nextTab=tab,nextDisplay=display){return `/results?tab=${nextTab}${nextDisplay?'&display=1':''}`;}
  if(!data)return <main className="wrap map-loading"><BarChart3 size={36}/><h1>نقرأ الصورة من البيانات…</h1><ErrorNotice message={error}/><button className="text-button" onClick={()=>navigate('/')}>رجوع للتحدّي</button></main>;
  const votes=data.votes.reduce((s,v)=>s+v.count,0);const answered=data.cities.reduce((s,c)=>s+c.total,0);const correct=data.cities.reduce((s,c)=>s+c.correct,0);
  return <main className={`wrap dashboard map-dashboard ${display?'display-mode':''}`}><div className="dashboard-heading"><div><span className="eyebrow">النتائج العامة</span><h1>كل رحلة <em>تترك رقمًا.</em></h1><p>نكتشف المملكة، ونقرأ حكاية المشاركين.</p></div><div className="live-tools"><span className={`live-pill ${error?'stale':''}`}><span/>{error?'تعذّر التحديث':'تحديث تلقائي'}</span><small>آخر تحديث {new Date(data.updatedAt).toLocaleTimeString('ar-SA')}</small><button className="text-button" onClick={()=>{navigate(url(tab,!display));if(!display)void document.documentElement.requestFullscreen?.().catch(()=>{});else if(document.fullscreenElement)void document.exitFullscreen();}}><Maximize2 size={16}/>{display?'إنهاء وضع الشاشة':'شاشة البوث'}</button></div></div><ErrorNotice message={error}/>{data.environment!=='production'&&<div className="test-banner">بيانات تجربة محلية — منفصلة عن الفعالية</div>}
    <div className="results-tabs" role="tablist" aria-label="عرض النتائج"><button role="tab" aria-selected={tab==='stats'} onClick={()=>navigate(url('stats'))}><BarChart3 size={19}/>إحصائيات الرحلة</button><button role="tab" aria-selected={tab==='leaderboard'} onClick={()=>navigate(url('leaderboard'))}><Trophy size={19}/>ليدربورد</button></div>
    {tab==='leaderboard'?<Leaderboard entries={data.leaderboard} best={best}/>:<><div className="metrics"><article><span>مشاركة مكتملة</span><b>{n(data.completed)}</b><small>عدد الجولات، وقد يتكرر الشخص</small></article><article><span>اسم في الليدربورد</span><b>{n(data.names)}</b><small>الأسماء المتطابقة تشترك في سجل</small></article><article><span>متوسط النقاط</span><b>{data.completed?n(data.scoreSum/data.completed):'—'}<small> / ١٠٠</small></b><small>لكل الجولات المكتملة</small></article><article><span>إجابات صحيحة</span><b>{answered?`${n(correct/answered*100)}٪`:'—'}</b><small>من الإجابات المحفوظة</small></article></div><div className="dashboard-grid"><section className="data-panel"><h2>وجهتنا القادمة</h2><p>أي وجهة سعودية تتمنى تزورها؟ · {n(votes)} صوت</p><MapChart chart={{title:'تصويت المشاركين',unit:'صوت',values:data.votes.map(v=>({label:v.label,value:v.count}))}}/><p className="map-stat-note">اختيارات المشاركين لا تمثّل جميع طلاب الجامعة أو سكان المملكة.</p></section><section className="data-panel"><h2>توزيع نقاط الرحلات</h2><MapChart chart={{title:'المشاركات المكتملة حسب النقاط',unit:'مشاركة',values:data.distribution.map((count,i)=>({label:`${n(i*10)} نقطة`,value:count}))}}/></section></div><section className="data-panel city-performance"><div><span className="eyebrow">أين كانت التحديات؟</span><h2>المدن تحت عدسة البيانات</h2></div><div className="city-performance-grid">{data.cities.map(city=><article key={city.id}><span><MapPin size={16}/>{city.name}</span><b>{city.total?`${n(city.correct/city.total*100)}٪`:'—'}</b><div className="accuracy-track"><i style={{width:`${city.total?city.correct/city.total*100:0}%`}}/></div><small>{n(city.correct)} صحيحة من {n(city.total)} إجابة</small></article>)}</div></section></>}
    {display&&<section className="join-strip">{qr&&<img src={qr} width="110" height="110" alt="رمز بدء تحدّي الخريطة"/>}<div><h2>دقيقة لك… واسمك في الصدارة.</h2><p>امسح الرمز · اختر المدن · اجمع النقاط</p></div><span dir="ltr">{location.host}</span></section>}
  </main>;
}
