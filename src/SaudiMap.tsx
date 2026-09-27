import {useId,useState} from 'react';
import {Check,Minus,Plus,RotateCcw,X} from 'lucide-react';
import {mapCities,type CityId,type MapAnswer} from '../shared/map-types';
import {saudiOutline,projectCity} from './saudi-outline';

export function SaudiMap({answers=[],onSelect,disabled=false,decorative=false}:{answers?:MapAnswer[];onSelect?:(id:CityId)=>void;disabled?:boolean;decorative?:boolean}){
  const id=useId().replaceAll(':','');const[zoom,setZoom]=useState(1);
  const visited=answers.map(a=>mapCities.find(c=>c.id===a.cityId)!);
  const route=visited.map(c=>projectCity(c.lon,c.lat).join(',')).join(' ');
  return <div className={`saudi-map-shell ${decorative?'decorative-map':''}`}>
    {!decorative&&<div className="map-controls" aria-label="حجم الخريطة"><button aria-label="تكبير الخريطة" disabled={zoom>=2} onClick={()=>setZoom(v=>Math.min(2,v+.5))}><Plus size={18}/></button><button aria-label="تصغير الخريطة" disabled={zoom<=1} onClick={()=>setZoom(v=>Math.max(1,v-.5))}><Minus size={18}/></button><button aria-label="إعادة حجم الخريطة" onClick={()=>setZoom(1)}><RotateCcw size={16}/></button></div>}
    <div className="map-scroll" tabIndex={!decorative?0:undefined} aria-label={!decorative?'الخريطة؛ يمكن تمريرها بعد التكبير واختيار المدن من القائمة أيضًا':undefined}>
      <svg className="saudi-map" viewBox="0 0 760 630" style={{width:`${zoom*100}%`}} role={decorative?'img':'group'} aria-label="خريطة المملكة العربية السعودية والمدن العشر">
        <defs><linearGradient id={`${id}-land`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#1e9c60"/><stop offset=".55" stopColor="#087e45"/><stop offset="1" stopColor="#055f39"/></linearGradient><pattern id={`${id}-grid`} width="26" height="26" patternUnits="userSpaceOnUse"><path d="M26 0H0V26" fill="none" stroke="#b9ead3" strokeWidth=".4" opacity=".15"/></pattern><clipPath id={`${id}-clip`}><path d={saudiOutline}/></clipPath><filter id={`${id}-shadow`} x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="15" stdDeviation="15" floodColor="#064f36" floodOpacity=".2"/></filter></defs>
        <g className="map-compass" transform="translate(665 85)"><path d="M0-21L8 4L0 0L-8 4Z" fill="#aecdc3"/><text y="-30" textAnchor="middle">ش</text><circle r="27" fill="none" stroke="#94bdb1" strokeWidth=".5"/></g>
        <text className="sea-label" x="105" y="455" transform="rotate(-55 105 455)">البحر الأحمر</text><text className="sea-label" x="613" y="260" transform="rotate(40 613 260)">الخليج العربي</text>
        <path className="saudi-land" d={saudiOutline} fill={`url(#${id}-land)`} stroke="#94ddb0" strokeWidth="1.8" filter={`url(#${id}-shadow)`}/>
        <path d={saudiOutline} fill={`url(#${id}-grid)`}/>
        <g clipPath={`url(#${id}-clip)`} opacity=".22"><path d="M-30 150Q330-40 770 440M-10 310Q350 20 800 570M-20 430Q390 90 850 670" fill="none" stroke="#cae4bf" strokeWidth="1"/><circle cx="480" cy="430" r="100" fill="none" stroke="#b9e1d1" strokeDasharray="2 8"/></g>
        <text className="map-land-caption" x="460" y="405" textAnchor="middle">المملكة العربية السعودية</text><text className="map-land-caption english" x="460" y="424" textAnchor="middle">A JOURNEY THROUGH NUMBERS</text>
        {route&&<polyline className="map-journey-line" points={route} fill="none" stroke="#d5f7a5" strokeWidth="2" strokeDasharray="5 6"/>}
        {mapCities.map((city,i)=>{const[x,y]=projectCity(city.lon,city.lat);const answer=answers.find(a=>a.cityId===city.id);const done=!!answer;const available=!disabled&&!done&&!decorative;
          return <g key={city.id} className={`map-city ${done?(answer.isCorrect?'visited-correct':'visited-wrong'):''}`} transform={`translate(${x} ${y})`} role={!decorative?'button':undefined} tabIndex={available?0:undefined} aria-disabled={!decorative?!available:undefined} aria-label={!decorative?`${city.name}${answer?(answer.isCorrect?'، إجابة صحيحة، ١٠ نقاط':'، تمت الإجابة، صفر نقطة'):''}`:undefined} onClick={()=>available&&onSelect?.(city.id)} onKeyDown={e=>{if(available&&(e.key==='Enter'||e.key===' ')){e.preventDefault();onSelect?.(city.id);}}}>
            {!done&&<circle className="pin-halo" r="17" style={{animationDelay:`${i*.2}s`}}/>}<circle className="pin-hit" r="22" fill="transparent"/><circle className="pin-ring" r="10"/><circle className="pin-core" r="4"/>
            {done&&(answer.isCorrect?<path d="M-4 0L-1 3L5-4" className="pin-mark"/>:<path d="M-3-3L3 3M3-3L-3 3" className="pin-mark"/>)}
            <line x1="0" y1="0" x2={city.labelX} y2={city.labelY} stroke="#d7ecdf" opacity=".35"/>
            <text x={city.labelX} y={city.labelY+5} textAnchor="middle" className="city-label">{city.name}</text>
          </g>;
        })}
      </svg>
    </div>
    {!decorative&&<div className="map-legend"><span><i className="available"/>مدينة تنتظرك</span><span><Check size={13}/>إجابة صحيحة</span><span><X size={13}/>تمت الزيارة</span></div>}
  </div>;
}
