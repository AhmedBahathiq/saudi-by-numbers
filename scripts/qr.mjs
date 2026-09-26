import QRCode from 'qrcode';
import { mkdir,writeFile } from 'node:fs/promises';
const target=process.argv[2];if(!target)throw new Error('Pass the verified public URL: npm run qr -- https://your-site.workers.dev');
const url=new URL(target);if(url.protocol!=='https:'||['localhost','127.0.0.1'].includes(url.hostname))throw new Error('A public HTTPS URL is required.');
const res=await fetch(new URL('/api/health',url));const health=await res.json();if(!res.ok||health.environment!=='production')throw new Error('Production health verification failed; QR was not generated.');
await mkdir('exports',{recursive:true});await QRCode.toFile('exports/booth-qr.png',url.origin,{width:1600,margin:4,errorCorrectionLevel:'H',color:{dark:'#075b40',light:'#ffffff'}});
await writeFile('exports/booth-qr.svg',await QRCode.toString(url.origin,{type:'svg',margin:4,errorCorrectionLevel:'H',color:{dark:'#075b40',light:'#ffffff'}}));
await writeFile('exports/booth-link.txt',url.origin+'\n');console.log('Verified production URL. Print-ready QR saved in exports/.');
