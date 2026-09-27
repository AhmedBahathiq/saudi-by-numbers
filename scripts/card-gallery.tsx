import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFile,writeFile,mkdir } from 'node:fs/promises';
import QRCode from 'qrcode';
import { CardArtwork } from '../src/CardArtwork';
import { titles } from '../shared/types';
import { cardThemes } from '../src/card-design';

// A self-contained design review artifact; excluded from the public website build.
const font=(await readFile('public/fonts/Amiri-Regular.ttf')).toString('base64');
const uiFont=(await readFile('public/fonts/Tajawal-Regular.ttf')).toString('base64');
const logo=`data:image/jpeg;base64,${(await readFile('public/brand/data-science-club.jpg')).toString('base64')}`;
const qr=await QRCode.toDataURL('http://127.0.0.1:8787',{margin:2,width:360});
const cards=cardThemes.map((theme,score)=>{
  const svg=renderToStaticMarkup(<CardArtwork score={score} name="اسمك هنا" qr={qr}/>).replaceAll('/brand/data-science-club.jpg',logo);
  return `<article><div class="paper">${svg}</div><h2>${titles[score]}</h2><p>${theme.name} · ${score} / 3</p></article>`;
}).join('');
const html=`<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>معاينة بطاقات المستويات</title><style>
@font-face{font-family:Amiri;src:url(data:font/ttf;base64,${font})} @font-face{font-family:Tajawal;src:url(data:font/ttf;base64,${uiFont})}
*{box-sizing:border-box}body{margin:0;padding:42px 35px;background:#f4f7f4;color:#163f32;font-family:Tajawal,Arial,sans-serif}header{max-width:1260px;margin:0 auto 30px;display:flex;align-items:center;justify-content:space-between;gap:20px}h1{font-size:32px;margin:10px 0}header p{font-size:16px;color:#708275;margin:0;line-height:1.7}header>span{padding:9px 15px;background:#e6eee7;border:1px solid #d5e0d6;border-radius:30px;font-size:13px;white-space:nowrap}main{max-width:1260px;margin:auto;display:grid;grid-template-columns:repeat(4,1fr);gap:23px}.paper{border-radius:12px;overflow:hidden;box-shadow:0 12px 30px #153e2918}.card-artwork{width:100%;height:auto;display:block}article h2{text-align:center;font-size:19px;margin:19px 0 7px}article p{text-align:center;color:#758678;font-size:13px;margin:0}footer{max-width:1260px;margin:30px auto 0;border-top:1px solid #dbe6dd;padding-top:20px;font-size:13px;color:#758678}footer a{color:#176b4c}@media(max-width:850px){main{grid-template-columns:repeat(2,1fr)}body{padding:25px 20px}header{display:block}header>span{display:inline-block;margin-top:15px}}@media(max-width:440px){main{grid-template-columns:1fr;max-width:310px}}
</style><header><div><p>السعودية بالأرقام · نادي علوم البيانات</p><h1>لكل إنجاز… بطاقته.</h1><p>أربع هويات، واسمك يكمّل الحكاية.</p></div><span>معاينة محلية · غير منشورة</span></header><main>${cards}</main><footer>الاسم الظاهر مثال للمعاينة. الرموز تخص الموقع المحلي. <a href="http://127.0.0.1:8787/">العودة إلى التحدّي</a></footer></html>`;
await mkdir('test-results',{recursive:true});await writeFile('test-results/card-gallery.html',html);
console.log('Saved local-only card gallery to test-results/card-gallery.html');
