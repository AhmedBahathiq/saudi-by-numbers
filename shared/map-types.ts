import type { Chart } from './types';

export const MAP_SECONDS = 60;
export const MAP_POINTS = 10;
export const MAP_NAME_LIMIT = 48;
export const mapCities = [
  { id:'jeddah', name:'جدة', lat:21.5433, lon:39.1728, labelX:-45, labelY:0 },
  { id:'riyadh', name:'الرياض', lat:24.7136, lon:46.6753, labelX:0, labelY:30 },
  { id:'makkah', name:'مكة المكرمة', lat:21.3891, lon:39.8579, labelX:63, labelY:15 },
  { id:'madinah', name:'المدينة المنورة', lat:24.5247, lon:39.5692, labelX:75, labelY:0 },
  { id:'alula', name:'العلا', lat:26.6084, lon:37.9232, labelX:-38, labelY:8 },
  { id:'abha', name:'أبها', lat:18.2164, lon:42.5053, labelX:39, labelY:0 },
  { id:'tabuk', name:'تبوك', lat:28.3838, lon:36.555, labelX:-40, labelY:0 },
  { id:'hail', name:'حائل', lat:27.5114, lon:41.7208, labelX:0, labelY:-25 },
  { id:'dammam', name:'الدمام', lat:26.4207, lon:50.0888, labelX:46, labelY:0 },
  { id:'jazan', name:'جازان', lat:16.8892, lon:42.5706, labelX:44, labelY:16 },
] as const;
export type CityId = typeof mapCities[number]['id'];
export interface MapQuestion {
  id:string; cityId:CityId; prompt:string; options:string[]; correct:number;
  explanation:string; indicator:string; year:string;
  source:{name:string;url:string}; chart?:Chart;
}
export type PublicMapQuestion = Pick<MapQuestion,'id'|'cityId'|'prompt'|'options'|'chart'|'year'>;
export interface MapAnswer {cityId:CityId;questionId:string;selected:number;isCorrect:boolean;receivedAt:number}
export interface LeaderEntry {name:string;score:number;elapsedMs:number|null;rank:number}
export interface MapRoundView {
  name:string; startedAt:number; expiresAt:number; serverNow:number;
  completed:boolean; score:number; tier:number; title:string;
  answers:MapAnswer[]; activeQuestion:PublicMapQuestion|null;
  review:(MapQuestion & {selected:number;isCorrect:boolean})[];
  vote:string|null; best:LeaderEntry|null; environment:string;
}
export interface MapStats {
  completed:number; names:number; scoreSum:number; distribution:number[];
  cities:{id:CityId;name:string;total:number;correct:number}[];
  votes:{label:string;count:number}[]; leaderboard:LeaderEntry[];
  updatedAt:string;environment:string;
}
export function mapTier(score:number){return score>=70?3:score>=40?2:score>=20?1:0;}
export function cleanDisplayName(value:string){
  return value.normalize('NFC').replace(/[^\p{L}\p{M}\p{N} .’'\-]/gu,'').replace(/\s+/g,' ').trim();
}
export function normalizePlayerName(value:string){
  return cleanDisplayName(value).replace(/[\u0640\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed]/g,'').toLocaleLowerCase('en');
}
