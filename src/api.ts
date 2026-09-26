import type { RoundView, Stats } from '../shared/types';
export function readSession(key:string) {try{return sessionStorage.getItem(key);}catch{return null;}}
export function writeSession(key:string,value:string) {try{sessionStorage.setItem(key,value);}catch{/* The current in-memory round remains usable. */}}
export async function api<T>(path:string, options:{method?:string;body?:unknown;key?:string}={}):Promise<T> {
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),15000);
  try {
    const response=await fetch(`/api/${path}`,{method:options.method||'GET',headers:{...(options.key?{Authorization:`Bearer ${options.key}`} : {}),...(options.body?{'Content-Type':'application/json'}:{})},body:options.body?JSON.stringify(options.body):undefined,signal:controller.signal});
    const payload=await response.json() as T & {error?:string};
    if(!response.ok)throw new Error(payload.error||'تعذّر حفظ المشاركة. حاول مجددًا.');return payload;
  } catch(error) {if(error instanceof TypeError||error instanceof DOMException)throw new Error('الاتصال غير متاح الآن. اختيارك محفوظ هنا؛ أعد المحاولة عند عودة الاتصال.');throw error;}
  finally {clearTimeout(timeout);}
}
export const getStats=()=>api<Stats>('stats');
export const getRound=(key:string)=>api<RoundView>('round',{key});
