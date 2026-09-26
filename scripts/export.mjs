import { spawnSync } from 'node:child_process';
import { mkdir,writeFile } from 'node:fs/promises';
import path from 'node:path';
const staging=process.argv.includes('--staging');const local=process.argv.includes('--local');
if(local&&!staging)throw new Error('Use --staging with --local to export test data.');
const event=staging?'test-2026':'national-day-2026';
const query=`SELECT r.id AS participation_id,r.created_at,r.completed_at,r.score,v.city,
MAX(CASE WHEN a.position=0 THEN a.question_id END) AS question_1,
MAX(CASE WHEN a.position=0 THEN a.selected+1 END) AS choice_1,
MAX(CASE WHEN a.position=0 THEN a.is_correct END) AS correct_1,
MAX(CASE WHEN a.position=1 THEN a.question_id END) AS question_2,
MAX(CASE WHEN a.position=1 THEN a.selected+1 END) AS choice_2,
MAX(CASE WHEN a.position=1 THEN a.is_correct END) AS correct_2,
MAX(CASE WHEN a.position=2 THEN a.question_id END) AS question_3,
MAX(CASE WHEN a.position=2 THEN a.selected+1 END) AS choice_3,
MAX(CASE WHEN a.position=2 THEN a.is_correct END) AS correct_3
FROM rounds r JOIN answers a ON a.round_id=r.id LEFT JOIN votes v ON v.round_id=r.id
WHERE r.event_id='${event}' AND r.completed_at IS NOT NULL GROUP BY r.id ORDER BY r.created_at`;
const args=['node_modules/wrangler/bin/wrangler.js','d1','execute','DB',local?'--local':'--remote',...(staging?['--env','staging']:[]),'--command',query,'--json'];
const result=spawnSync(process.execPath,args,{encoding:'utf8',maxBuffer:50*1024*1024});
if(result.status!==0){process.stderr.write(result.stderr);process.exit(result.status||1);}
const data=JSON.parse(result.stdout);const rows=data.flatMap(item=>item.results||[]);
const headers=['participation_id','created_at','completed_at','score','city','question_1','choice_1','correct_1','question_2','choice_2','correct_2','question_3','choice_3','correct_3'];
const quote=value=>`"${String(value??'').replaceAll('"','""')}"`;
const csv='\uFEFF'+[headers,...rows.map(row=>headers.map(h=>row[h]))].map(row=>row.map(quote).join(',')).join('\r\n');
await mkdir('exports',{recursive:true});const file=path.resolve('exports',`${event}-${new Date().toISOString().replaceAll(':','-')}.csv`);await writeFile(file,csv);console.log(`Exported ${rows.length} completed participations to ${file}`);
