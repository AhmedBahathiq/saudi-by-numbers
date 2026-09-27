import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createCard } from '../src/pdf';
import { titles, type RoundView } from '../shared/types';

// Uses the website renderer with local copies of its font and club logo.
globalThis.fetch = async (input) => {
  const resource = String(input);
  if (!['/fonts/Amiri-Regular.ttf', '/brand/data-science-club.jpg'].includes(resource)) {
    throw new Error(`Unexpected preview resource: ${resource}`);
  }
  return new Response(await readFile(`public${resource}`));
};
await mkdir('test-results', { recursive: true });
for (let score = 0; score <= 3; score++) {
  const round = { completed: true, score, title: titles[score] } as RoundView;
  const pdf = await createCard(round, 'http://localhost:8787', 'أحمد باحاذق');
  await writeFile(`test-results/card-${score}.pdf`, new Uint8Array(pdf.output('arraybuffer')));
}
console.log('Four A6 card samples saved in test-results. Their QR is local, not for distribution.');
