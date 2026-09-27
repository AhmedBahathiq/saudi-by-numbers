import React from 'react';
import { cardScene, cardThemes } from './card-design';
import {mapTier} from '../shared/map-types';

export function CardArtwork({score,name,qr,maxScore=3}:{score:number;name:string;qr:string;maxScore?:number}) {
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 105 148" className="card-artwork" role="img" aria-label={`بطاقة ${cardThemes[maxScore===100?mapTier(score):score].name}${name?` باسم ${name}`:''}`}>
    {cardScene(score,name,maxScore).map((s,i)=>{
      if(s.kind==='rect')return <rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} rx={s.radius} fill={s.fill} stroke={s.stroke} strokeWidth={s.weight}/>;
      if(s.kind==='circle')return <circle key={i} cx={s.x} cy={s.y} r={s.r} fill={s.fill} stroke={s.stroke} strokeWidth={s.weight}/>;
      if(s.kind==='line')return <line key={i} x1={s.x} y1={s.y} x2={s.x2} y2={s.y2} stroke={s.stroke} strokeWidth={s.weight} strokeLinecap="round"/>;
      if(s.kind==='poly'){const points=s.points.map(p=>p.join(',')).join(' ');return s.closed?<polygon key={i} points={points} fill={s.fill} stroke={s.stroke} strokeWidth={s.weight} strokeLinejoin="round"/>:<polyline key={i} points={points} fill={s.fill} stroke={s.stroke} strokeWidth={s.weight} strokeLinejoin="round"/>;}
      if(s.kind==='text')return <text key={i} x={s.x} y={s.y} fill={s.color} fontSize={s.size} textAnchor={s.align||'middle'} fontFamily={s.latin?'Arial, sans-serif':'Amiri, serif'} direction="ltr" style={{unicodeBidi:'plaintext'}}>{s.value}</text>;
      const href=s.source==='logo'?'/brand/data-science-club.jpg':qr;
      return href?<image key={i} x={s.x} y={s.y} width={s.w} height={s.h} href={href}/>:null;
    })}
  </svg>;
}
