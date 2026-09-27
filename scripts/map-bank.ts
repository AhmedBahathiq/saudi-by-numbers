import {writeFile} from 'node:fs/promises';
import {mapQuestions,MAP_BANK_VERSION} from '../worker/map-questions';
import {mapCities} from '../shared/map-types';
const sections=mapQuestions.map(q=>`## ${q.id} — ${mapCities.find(c=>c.id===q.cityId)!.name}\n\n**السؤال:** ${q.prompt}\n\n${q.options.map((o,i)=>`- ${o}${i===q.correct?' ✅':''}`).join('\n')}\n\n**التفسير:** ${q.explanation}\n\n**المؤشر:** ${q.indicator}\n\n**المرجع الزمني:** ${q.year}\n\n**المصدر:** [${q.source.name}](${q.source.url})${q.chart?`\n\n**الرسم:** ${q.chart.title} — ${q.chart.unit}\n\n${q.chart.values.map(v=>`- ${v.label}: ${v.value}`).join('\n')}${q.chart.note?`\n\n${q.chart.note}`:''}`:''}`);
await writeFile('docs/MAP_QUESTION_BANK.md',`# بنك أسئلة تحدّي الخريطة\n\nالإصدار: ${MAP_BANK_VERSION} · مراجعة المصادر: ٢٧ سبتمبر ٢٠٢٦\n\n٣٠ سؤالًا، ثلاثة لكل مدينة. يختار الخادم سؤالًا واحدًا لكل مدينة ويبدّل ترتيب الخيارات. هذه نسخة إجابات للمشغّل؛ لا تُعرض الحلول أثناء الجولة. السنوات والوصف التاريخي لا يُقدّمان باعتبارهما أرقامًا حية.\n\n${sections.join('\n\n---\n\n')}\n`);
console.log('Wrote 30 sourced questions to docs/MAP_QUESTION_BANK.md');
