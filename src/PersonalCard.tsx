import React, {useEffect,useState} from 'react';
import QRCode from 'qrcode';
import {Download,ImageDown,Sparkles,LockKeyhole,RefreshCw} from 'lucide-react';
import type {CardResult} from './card-design';
import {CardArtwork} from './CardArtwork';
import {cardThemes,NAME_LIMIT,normalizeCardName} from './card-design';
import './cards.css';

export function PersonalCard({round}:{round:CardResult}){
  const [rawName,setRawName]=useState('');
  const [qr,setQr]=useState('');
  const [busy,setBusy]=useState<'image'|'pdf'|null>(null);
  const [error,setError]=useState('');
  const locked=round.tier!==undefined;
  const name=normalizeCardName(locked?round.name||'':rawName);
  const theme=cardThemes[round.tier??round.score];
  useEffect(()=>{let active=true;void QRCode.toDataURL(location.origin,{width:360,margin:2,errorCorrectionLevel:'M'}).then(value=>{if(active)setQr(value);}).catch(()=>{});return()=>{active=false;};},[]);
  async function download(format:'image'|'pdf'){
    setBusy(format);setError('');
    try{
      if(format==='image')await(await import('./card-image')).downloadCardImage(round,name);
      else await(await import('./pdf')).downloadCard(round,name);
    }catch{setError('تعذّر تجهيز البطاقة. اسمك ما زال هنا؛ تأكد من الاتصال وأعد المحاولة.');}
    finally{setBusy(null);}
  }
  return <section className="personal-card-section" style={{'--card-accent':theme.dark,'--card-pale':theme.pale} as React.CSSProperties} aria-label="تخصيص بطاقتك">
    <div className="personal-card-preview"><div className="personal-card-paper"><CardArtwork score={round.score} name={name} qr={qr} maxScore={locked?100:3}/></div><p className="card-theme-note"><span/>{theme.name} <span className="card-level-label">{round.title}</span></p></div>
    <div className="card-customizer"><span className="eyebrow"><Sparkles size={17}/> إنجازك، بطريقتك</span><h2>{locked?'رحلتك… باسمك.':'خلّها باسمك.'}</h2><p>{locked?'دقيقة صنعت فيها حكايتك. خذ بطاقتك، وشارك إنجازك مع اللي تحب.':<>أضف اسمك وشوفه على البطاقة مباشرة،<br/>ثم خذ تذكارك وشاركه مع اللي تحب.</>}</p>
      {locked?<p className="locked-card-name" dir="auto">{name}</p>:<><label htmlFor="participant-name">الاسم على البطاقة <span>اختياري</span></label>
      <div className="card-name-field"><input id="participant-name" value={rawName} maxLength={NAME_LIMIT} onChange={e=>setRawName(e.target.value)} placeholder="اكتب الاسم اللي تحب يظهر" autoComplete="off" dir="auto" aria-describedby="card-name-help"/><span>{Array.from(rawName).length}/{NAME_LIMIT}</span></div>
      <small id="card-name-help">بالعربية أو الإنجليزية. تقدر تحمّلها بدون اسم أيضًا.</small></>}
      <div className="card-download-actions"><button className="button green" onClick={()=>void download('image')} disabled={!!busy}>{busy==='image'?<RefreshCw size={19} className="spin"/>:<ImageDown size={20}/>} {busy==='image'?'نجهّز صورتك…':'صورة للمشاركة'}</button><button className="button card-pdf-button" onClick={()=>void download('pdf')} disabled={!!busy}>{busy==='pdf'?<RefreshCw size={19} className="spin"/>:<Download size={19}/>} {busy==='pdf'?'نجهّز بطاقتك…':'PDF للطباعة'}</button></div>
      <p className="card-privacy"><LockKeyhole size={15}/> {locked?'الاسم نفسه يظهر على البطاقة وفي الليدربورد. تقدر تعدّله قبل الجولة القادمة.':'اسم هذه البطاقة يبقى داخل متصفحك ولا يُرسل للخادم.'}</p>
      {error&&<p className="error" role="alert">{error}</p>}
    </div>
  </section>;
}
