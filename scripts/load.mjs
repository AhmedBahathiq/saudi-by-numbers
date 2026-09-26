import { mkdir,writeFile } from 'node:fs/promises';
const base=process.env.TEST_BASE_URL||'http://localhost:8787';
const url=new URL(base);if(!['localhost','127.0.0.1'].includes(url.hostname))throw new Error('This load test is local-only. Never point at production.');
const health=await(await fetch(`${base}/api/health`)).json();if(health.environment!=='staging')throw new Error('Staging required');
const count=Number(process.env.LOAD_ROUNDS||10000);const concurrency=Number(process.env.LOAD_CONCURRENCY||200);
let next=0,completed=0,failures=0,requests=0;const durations=[];const errors=[];const start=performance.now();
async function call(path,key,body){const t=performance.now();const res=await fetch(`${base}/api/${path}`,{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify(body)});durations.push(performance.now()-t);requests++;const data=await res.json();if(!res.ok)throw new Error(`${res.status} ${data.error}`);return data;}
async function user(){while(next<count){next++;const key=crypto.randomUUID();try{const round=await call('round',key,{});for(const q of round.questions)await call('answer',key,{questionId:q.id,selected:Math.floor(Math.random()*3)});await call('vote',key,{city:'العلا'});completed++;}catch(e){failures++;if(errors.length<5)errors.push(String(e));}if((completed+failures)%1000===0)console.log(`${completed} completed, ${failures} failed`);}}
await Promise.all(Array.from({length:concurrency},user));durations.sort((a,b)=>a-b);
const report={environment:'local Cloudflare emulation / staging database',targetRounds:count,concurrency,completed,failures,requests,elapsedSeconds:(performance.now()-start)/1000,p50ms:durations[Math.floor(durations.length*.5)],p95ms:durations[Math.floor(durations.length*.95)],p99ms:durations[Math.floor(durations.length*.99)],errors,limitation:'Measures this development machine; does not establish production capacity or Cloudflare quotas.'};
await mkdir('test-results',{recursive:true});await writeFile('test-results/load.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(failures)process.exitCode=1;
