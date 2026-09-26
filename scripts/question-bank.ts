import {writeFileSync,mkdirSync} from 'node:fs';
import {questions,BANK_VERSION} from '../worker/questions';
import {levelNames} from '../shared/types';
mkdirSync('docs',{recursive:true});
let md=`# بنك أسئلة السعودية بالأرقام\n\nالإصدار: ${BANK_VERSION} · تاريخ المراجعة: ٢٦ سبتمبر ٢٠٢٦\n\n١٨ سؤالًا، ستة مجالات وثلاثة مستويات. يُختار سؤال من كل مستوى ومن ثلاثة مجالات مختلفة. الأرقام تخص السنوات المكتوبة ولا يُدّعى أنها كلها أحدث إصدار متاح. الروابط تعود للجهات الرسمية، وشرح الإجابات صيغ لهذا النشاط.\n\n`;
for(const q of questions){md+=`## ${q.id} — ${q.topic} — ${levelNames[q.level]}\n\n**الرقم:** ${q.headline} · **الفترة:** ${q.year}\n\n${q.prompt}\n\n${q.options.map((o,i)=>`- ${['أ','ب','ج'][i]}) ${o}${i===q.correct?' ✅':''}`).join('\n')}\n\n**التفسير:** ${q.explanation}\n\n**مهارة البيانات:** ${q.lesson}\n\n**المصدر:** [${q.source.name}](${q.source.url})\n\n`;if(q.chart)md+=`**الرسم:** ${q.chart.title} — ${q.chart.unit}\n\n${q.chart.values.map(v=>`- ${v.label}: ${v.value}`).join('\n')}\n\n${q.chart.note||''}\n\n`;}
writeFileSync('docs/QUESTION_BANK.md',md);
