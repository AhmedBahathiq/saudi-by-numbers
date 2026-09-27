import QRCode from 'qrcode';
import type { RoundView } from '../shared/types';
import { cardScene, CARD_WIDTH, CARD_HEIGHT } from './card-design';

async function loadImage(url:string):Promise<HTMLImageElement>{const img=new Image();img.src=url;await img.decode();return img;}
export async function createCardImage(round:RoundView,name:string,origin:string):Promise<Blob>{
  if(!round.completed)throw new Error('أكمل التحدي أولًا.');
  await document.fonts.load('24px Amiri');
  if(!document.fonts.check('24px Amiri'))throw new Error('تعذّر تحميل خط البطاقة.');
  const qrUrl=await QRCode.toDataURL(origin,{errorCorrectionLevel:'M',margin:2,width:360});
  const [logo,qr]=await Promise.all([loadImage('/brand/data-science-club.jpg'),loadImage(qrUrl)]);
  const canvas=document.createElement('canvas');canvas.width=CARD_WIDTH*12;canvas.height=CARD_HEIGHT*12;
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('تعذّر تجهيز الصورة.');
  ctx.scale(12,12);ctx.lineJoin='round';ctx.lineCap='round';
  for(const s of cardScene(round.score,name)){
    if(s.kind==='image'){ctx.drawImage(s.source==='logo'?logo:qr,s.x,s.y,s.w,s.h);continue;}
    if(s.kind==='text'){
      ctx.fillStyle=s.color;ctx.font=`${s.size}px ${s.latin?'Arial':'Amiri'}`;ctx.textBaseline='alphabetic';
      ctx.textAlign=s.align==='end'?'right':s.align==='start'?'left':'center';ctx.direction=s.latin?'ltr':'rtl';
      ctx.fillText(s.value,s.x,s.y);continue;
    }
    ctx.beginPath();
    if(s.kind==='rect')ctx.roundRect(s.x,s.y,s.w,s.h,s.radius||0);
    else if(s.kind==='circle')ctx.arc(s.x,s.y,s.r,0,Math.PI*2);
    else if(s.kind==='line'){ctx.moveTo(s.x,s.y);ctx.lineTo(s.x2,s.y2);}
    else {s.points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));if(s.closed)ctx.closePath();}
    if('fill' in s&&s.fill!=='none'){ctx.fillStyle=s.fill;ctx.fill();}
    if(s.stroke){ctx.strokeStyle=s.stroke;ctx.lineWidth=s.weight||.3;ctx.stroke();}
  }
  return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('تعذّر حفظ الصورة.')),'image/png'));
}
export async function downloadCardImage(round:RoundView,name:string){
  const blob=await createCardImage(round,name,window.location.origin);
  const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='السعودية-بالأرقام.png';
  document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60_000);
}
