import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import type { CardResult } from './card-design';
import { cardScene } from './card-design';

export async function createCard(round:CardResult,origin:string,name=''):Promise<jsPDF>{
  if(!round.completed)throw new Error('أكمل التحدي أولًا.');
  const [fontResponse,logoResponse]=await Promise.all([fetch('/fonts/Amiri-Regular.ttf'),fetch('/brand/data-science-club.jpg')]);
  if(!fontResponse.ok||!logoResponse.ok)throw new Error('تعذّر تحميل عناصر البطاقة. أعد المحاولة.');
  const logo=new Uint8Array(await logoResponse.arrayBuffer());
  const bytes=new Uint8Array(await fontResponse.arrayBuffer());let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);
  const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a6',putOnlyUsedFonts:true});
  doc.addFileToVFS('Amiri-Regular.ttf',btoa(binary));doc.addFont('Amiri-Regular.ttf','Amiri','normal');
  doc.setProperties({title:'السعودية بالأرقام - بطاقة تذكارية',author:'نادي علوم البيانات - جامعة جدة',subject:'بطاقة مشاركة تذكارية'});
  const qr=await QRCode.toDataURL(origin,{errorCorrectionLevel:'M',margin:2,width:360});
  doc.setLineCap('round');doc.setLineJoin('round');
  for(const s of cardScene(round.score,name,round.tier!==undefined?100:3)){
    if(s.kind==='image'){doc.addImage(s.source==='logo'?logo:qr,s.source==='logo'?'JPEG':'PNG',s.x,s.y,s.w,s.h);continue;}
    if(s.kind==='text'){
      doc.setFont(s.latin?'helvetica':'Amiri','normal');doc.setFontSize(s.size*72/25.4);doc.setTextColor(s.color);doc.setR2L(false);
      doc.text(s.value,s.x,s.y,{align:s.align==='end'?'right':s.align==='start'?'left':'center'});continue;
    }
    const fill='fill' in s&&s.fill!=='none';
    if('fill' in s&&fill)doc.setFillColor(s.fill);if(s.stroke)doc.setDrawColor(s.stroke);doc.setLineWidth(s.weight||.3);
    const style=fill?(s.stroke?'FD':'F'):'S';
    if(s.kind==='rect')doc.roundedRect(s.x,s.y,s.w,s.h,s.radius||0,s.radius||0,style);
    else if(s.kind==='circle')doc.circle(s.x,s.y,s.r,style);
    else if(s.kind==='line')doc.line(s.x,s.y,s.x2,s.y2);
    else {const [first,...rest]=s.points;const segments=rest.map((p,i)=>[p[0]-s.points[i][0],p[1]-s.points[i][1]]);doc.lines(segments,first[0],first[1],[1,1],style,!!s.closed);}
  }
  return doc;
}
export async function downloadCard(round:CardResult,name=''){const doc=await createCard(round,window.location.origin,name);doc.save('السعودية-بالأرقام.pdf');}
