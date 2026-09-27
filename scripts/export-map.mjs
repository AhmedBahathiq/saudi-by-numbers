import {spawnSync} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
const staging=process.argv.includes('--staging'),local=process.argv.includes('--local');
if(local&&!staging)throw Error('Use --staging with --local.');
const event=(staging?'test-2026':'national-day-2026')+':map-v1';
const query=`SELECT r.id participation_id,r.display_name,r.started_at,r.expires_at,r.completed_at,r.score,r.answer_count,
CASE WHEN r.score>0 THEN r.last_correct_at-r.started_at ELSE NULL END elapsed_ms,
v.city vote,a.city_id,a.question_id,a.selected,a.is_correct,a.received_at
FROM map_rounds r LEFT JOIN map_answers a ON a.round_id=r.id LEFT JOIN map_votes v ON v.round_id=r.id
WHERE r.event_id='${event}' AND r.completed_at IS NOT NULL ORDER BY r.started_at,a.received_at`;
const result=spawnSync(process.execPath,['node_modules/wrangler/bin/wrangler.js','d1','execute','DB',local?'--local':'--remote',...(staging?['--env','staging']:[]),...(local?['--persist-to','.wrangler/map-preview']:[]),'--command',query,'--json'],{encoding:'utf8',maxBuffer:50*1024*1024});
if(result.status!==0){process.stderr.write(result.stderr);process.exit(result.status||1);}
const rows=JSON.parse(result.stdout).flatMap(r=>r.results||[]);
const headers=['participation_id','display_name','started_at','expires_at','completed_at','score','answer_count','elapsed_ms','vote','city_id','question_id','selected','is_correct','received_at'];
// Neutralize spreadsheet formula prefixes in participant-provided display names.
const quote=value=>{let s=String(value??'');if(/^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
const csv='\uFEFF'+[headers,...rows.map(row=>headers.map(h=>row[h]))].map(r=>r.map(quote).join(',')).join('\r\n');
await mkdir('exports',{recursive:true});const file=path.resolve('exports',`map-${staging?'test':'event'}-${new Date().toISOString().replaceAll(':','-')}.csv`);await writeFile(file,csv);console.log(`Exported ${rows.length} rows to ${file}`);
