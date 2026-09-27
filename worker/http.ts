export class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }
export function json(data: unknown, status=200, headers: Record<string,string>={}) {
  return Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
}
export async function body(request: Request): Promise<Record<string,unknown>> {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new HttpError(415,'صيغة الطلب غير مدعومة.');
  if (Number(request.headers.get('content-length') || 0)>4096) throw new HttpError(413,'الطلب أكبر من المسموح.');
  const reader=request.body?.getReader(); if(!reader) throw new HttpError(400,'الطلب فارغ.');
  let size=0; const chunks:Uint8Array[]=[];
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>4096){await reader.cancel();throw new HttpError(413,'الطلب أكبر من المسموح.');}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  try { const value:unknown=JSON.parse(new TextDecoder().decode(bytes)); if(!value||Array.isArray(value)||typeof value!=='object')throw new Error();return value as Record<string,unknown>; }
  catch {throw new HttpError(400,'تعذّرت قراءة الطلب.');}
}
export async function roundId(request:Request) {
  const key=request.headers.get('authorization')?.replace(/^Bearer /,'') || '';
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key))throw new HttpError(401,'ابدأ جولة جديدة للمتابعة.');
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(key));
  return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
}
