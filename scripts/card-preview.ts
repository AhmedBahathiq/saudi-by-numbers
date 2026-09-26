import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createCard } from '../src/pdf';
import { titles, type RoundView } from '../shared/types';

// Uses the same PDF renderer as the website. Local font loading replaces HTTP only.
globalThis.fetch = async () => new Response(await readFile('public/fonts/Amiri-Regular.ttf'));
await mkdir('test-results', { recursive: true });
for (let score = 0; score <= 3; score++) {
  const round = { completed: true, score, title: titles[score] } as RoundView;
  const pdf = await createCard(round, 'http://localhost:8787');
  await writeFile(`test-results/card-${score}.pdf`, new Uint8Array(pdf.output('arraybuffer')));
}
console.log('Four A6 card samples saved in test-results. Their QR is local, not for distribution.');
