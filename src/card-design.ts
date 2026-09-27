import { titles } from '../shared/types';

export const CARD_WIDTH = 105;
export const CARD_HEIGHT = 148;
export const NAME_LIMIT = 32;
export const cardThemes = [
  { name: 'البداية الخضراء', dark: '#245745', accent: '#c5e6a0', pale: '#f4f8f0', ink: '#245745', message: 'أول خطوة في حكاية كبيرة' },
  { name: 'بوصلة الاكتشاف', dark: '#105864', accent: '#98e0d7', pale: '#eff8f7', ink: '#105864', message: 'فضولك يقودك لاكتشافات أكثر' },
  { name: 'عالم البيانات', dark: '#203e76', accent: '#b3d9ff', pale: '#f2f6fc', ink: '#203e76', message: 'تقرأ البيانات… وتكتشف الحكاية' },
  { name: 'تميّز البيانات', dark: '#145e9b', accent: '#b9e8d0', pale: '#f2f8fc', ink: '#184e7d', message: 'كل الأرقام كانت في مكانها!' },
];

// Names stay in component memory and never enter an API request.
export function normalizeCardName(value: string) {
  return Array.from(value.normalize('NFC').replace(/[^\p{L}\p{M}\p{N} .’'\-]/gu, '').replace(/\s+/g, ' ').trim()).slice(0, NAME_LIMIT).join('');
}
export type CardShape =
  | { kind: 'rect'; x: number; y: number; w: number; h: number; radius?: number; fill: string; stroke?: string; weight?: number }
  | { kind: 'circle'; x: number; y: number; r: number; fill: string; stroke?: string; weight?: number }
  | { kind: 'line'; x: number; y: number; x2: number; y2: number; stroke: string; weight: number }
  | { kind: 'poly'; points: number[][]; fill: string; stroke?: string; weight?: number; closed?: boolean }
  | { kind: 'text'; x: number; y: number; value: string; size: number; color: string; align?: 'start' | 'middle' | 'end'; latin?: boolean }
  | { kind: 'image'; x: number; y: number; w: number; h: number; source: 'logo' | 'qr' };

export function cardScene(score: number, participantName = ''): CardShape[] {
  const level = Math.max(0, Math.min(3, Math.trunc(score)));
  const t = cardThemes[level];
  const name = normalizeCardName(participantName);
  const s: CardShape[] = [];
  const rect = (x:number,y:number,w:number,h:number,fill:string,radius=0,stroke?:string,weight=.3) => s.push({kind:'rect',x,y,w,h,fill,radius,stroke,weight});
  const circle = (x:number,y:number,r:number,fill:string,stroke?:string,weight=.3) => s.push({kind:'circle',x,y,r,fill,stroke,weight});
  const line = (x:number,y:number,x2:number,y2:number,stroke:string,weight=.35) => s.push({kind:'line',x,y,x2,y2,stroke,weight});
  const poly = (points:number[][],fill:string,stroke?:string,weight=.6,closed=true) => s.push({kind:'poly',points,fill,stroke,weight,closed});
  const text = (value:string,x:number,y:number,size:number,color:string,align:'start'|'middle'|'end'='middle',latin=false) => s.push({kind:'text',value,x,y,size,color,align,latin});
  const sparkle = (x:number,y:number,r:number) => {line(x-r,y,x+r,y,t.accent,.35);line(x,y-r,x,y+r,t.accent,.35);};

  rect(0,0,105,148,t.pale);rect(3,3,99,142,'none',4,t.dark,.25);rect(6,6,93,57,t.dark,3);
  if(level===0){
    for(let i=0;i<5;i++){circle(15+i*3,48-i*5,.7,t.accent);circle(90-i*3,48-i*5,.7,t.accent);}
    line(17,55,31,55,t.accent,.3);line(74,55,88,55,t.accent,.3);
  }else if(level===1){
    circle(52.5,47,19,'none',t.accent,.15);circle(52.5,47,16,'none',t.accent,.2);
    [[23,41],[82,41],[23,54],[82,54]].forEach(([x,y])=>sparkle(x,y,1.5));
  }else if(level===2){
    for(let i=0;i<4;i++){line(15,34+i*6,31,34+i*6,t.accent,.12);line(74,34+i*6,90,34+i*6,t.accent,.12);}
    [[18,40],[27,52],[78,46],[88,34]].forEach(([x,y])=>circle(x,y,1.1,t.accent));
  }else{
    for(let i=0;i<5;i++){circle(33-i*1.1,38+i*4,1.2,t.accent);circle(72+i*1.1,38+i*4,1.2,t.accent);}
    sparkle(19,33,2);sparkle(87,34,2.2);sparkle(18,56,1.2);sparkle(88,55,1.2);
  }
  text('السعودية بالأرقام',52.5,18,7.4,'#ffffff');text('اليوم الوطني السعودي · ٢٠٢٦',52.5,26,3.1,t.accent);
  circle(52.5,46.5,12.5,t.accent);circle(52.5,46.5,10.9,'none',t.dark,.2);
  if(level===0){
    line(52.5,54,52.5,44,t.dark,.9);
    poly([[52.5,46],[47,44],[45,39],[50,40],[52.5,44]],t.dark);
    poly([[52.5,49],[58,47],[60,42],[55,43],[52.5,47]],t.dark);line(48,54,57,54,t.dark,.7);
  }else if(level===1){
    poly([[57.5,38.5],[55,49],[47.5,54.5],[50,44]],'none',t.dark,.75);
    poly([[57.5,38.5],[52.5,46.5],[50,44]],t.dark);circle(52.5,46.5,1.1,t.dark);
  }else if(level===2){
    const pts=[[46,42],[58,41],[53,48],[46,53],[60,53]];
    [[0,1],[0,2],[1,2],[2,3],[2,4],[1,4]].forEach(([a,b])=>line(pts[a][0],pts[a][1],pts[b][0],pts[b][1],t.dark,.6));
    pts.forEach(([x,y])=>circle(x,y,1.7,t.dark));
  }else{
    poly([[47,39],[58,39],[57,46],[55,49],[50,49],[48,46]],'none',t.dark,.85);
    poly([[47,41],[44,41],[44,45],[48,47]],'none',t.dark,.8,false);
    poly([[58,41],[61,41],[61,45],[57,47]],'none',t.dark,.8,false);
    line(52.5,49,52.5,53,t.dark,.85);line(48,54,57,54,t.dark,1);
  }
  text(name?'بكل فخر، هذه بطاقتك':'رحلة قصيرة، معرفة تبقى',52.5,72,3.3,'#68766d');
  const nameSize = Math.min(7, 82 / Math.max(Array.from(name).length,1));
  text(name||'مشاركتك تصنع الحكاية',52.5,83,name?nameSize:5,t.dark);
  text(titles[level],52.5,96,7.5,t.ink);rect(34,101,37,12,t.dark,6);
  text(`${level} / 3`,52.5,109.5,6.3,t.accent,'middle',true);text(t.message,52.5,120,3.6,t.dark);
  line(12,125,93,125,t.dark,.15);
  s.push({kind:'image',x:80,y:129,w:14,h:14,source:'logo'});
  text('نادي علوم البيانات',76,134,4.2,'#173a59','end');text('جامعة جدة',76,140,3.3,'#68766d','end');
  s.push({kind:'image',x:11,y:127,w:14,h:14,source:'qr'});text('شارك التحدّي',18,143.8,2.3,'#68766d');
  return s;
}
