import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import type { RoundView } from '../shared/types';
export async function createCard(round:RoundView, origin:string):Promise<jsPDF> {
  if(!round.completed)throw new Error('أكمل التحدي أولًا.');
  const response=await fetch('/fonts/Amiri-Regular.ttf');if(!response.ok)throw new Error('تعذّر تحميل خط البطاقة. أعد المحاولة.');
  const bytes=new Uint8Array(await response.arrayBuffer());let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);
  const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a6',putOnlyUsedFonts:true});
  doc.addFileToVFS('Amiri-Regular.ttf',btoa(binary));doc.addFont('Amiri-Regular.ttf','Amiri','normal');
  doc.setProperties({title:'السعودية بالأرقام — بطاقة تذكارية',author:'نادي علوم البيانات — جامعة جدة',subject:'بطاقة مشاركة تذكارية'});
  doc.setFillColor('#ffffff');doc.rect(0,0,105,148,'F');
  doc.setDrawColor('#075b40');doc.setLineWidth(.6);doc.roundedRect(5,5,95,138,3,3,'S');
  doc.setFillColor('#075b40');doc.roundedRect(10,10,85,39,3,3,'F');
  const ar=(text:string,y:number,size:number,color='#143b2d')=>{doc.setFont('Amiri','normal');doc.setFontSize(size);doc.setTextColor(color);doc.setR2L(false);doc.text(text,52.5,y,{align:'center'});};
  ar('السعودية بالأرقام',27,26,'#ffffff');ar('نادي علوم البيانات — جامعة جدة',39,12,'#ffffff');
  ar(round.title,65,25);ar('درجتك في التحدي',76,13);
  doc.setR2L(false);doc.setFont('helvetica','bold');doc.setFontSize(32);doc.setTextColor('#075b40');doc.text(`${round.score} / 3`,52.5,90,{align:'center'});
  ar('كل معلومة بداية لاكتشاف جديد',100,13);
  const qr=await QRCode.toDataURL(origin,{errorCorrectionLevel:'M',margin:2,width:300,color:{dark:'#143b2d',light:'#ffffff'}});
  doc.addImage(qr,'PNG',41.5,105,22,22);ar('امسح الرمز وشارك التحدي',133,11);ar('تذكار اليوم الوطني • بطاقة مشاركة',140,10);
  return doc;
}
export async function downloadCard(round:RoundView) {const doc=await createCard(round,window.location.origin);doc.save('السعودية-بالأرقام.pdf');}


