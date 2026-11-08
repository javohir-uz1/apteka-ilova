// Mijoz kutish ro'yxati (06.11; foydalanuvchi tavsiyani tanladi: "mijoz so'ragan dori kelganda unga o'zi xabar borsin").
// Defekturadagi dori uchun QR / havola: mijoz telefonida skanerlab botda «Start» bossa — dori «Keldi» bo'lishi bilan
// (Oson'dan avtomatik yoki qo'lda) shu botdan unga xabar boradi. Mijozning faqat Telegram chat raqami saqlanadi va xabar
// ketgach o'chiriladi; ismi va telefoni so'ralmaydi. Faqat serverda.
import { h, nusxaOl, sheet, tasdiqlash } from './ui.mjs';

// QR — SVG (qrcode-generator, MIT: vendor/qrcode.mjs); kerak bo'lganda yuklanadi.
let qrMod = null;
const qrYukla = () => qrMod || (qrMod = import('../vendor/qrcode.mjs').then((m) => m.default, (e) => { qrMod = null; throw e; }));
export async function qrSvg(matn, o = {}) {
  const qrcode = await qrYukla();
  const q = qrcode(0, 'M');
  q.addData(matn);
  q.make();
  const n = q.getModuleCount(), chet = 4, NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 ' + (n + chet * 2) + ' ' + (n + chet * 2));
  svg.setAttribute('shape-rendering', 'crispEdges');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', o.yorliq || 'QR kod');
  if (o.sinf) svg.setAttribute('class', o.sinf);
  const fon = document.createElementNS(NS, 'rect');
  fon.setAttribute('width', '100%'); fon.setAttribute('height', '100%'); fon.setAttribute('fill', '#fff');
  svg.append(fon);
  let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += 'M' + (c + chet) + ' ' + (r + chet) + 'h1v1h-1z';
  const p = document.createElementNS(NS, 'path');
  p.setAttribute('d', d); p.setAttribute('fill', '#000');
  svg.append(p);
  return svg;
}

// Guruh (H.defekturaGuruh) uchun: «👤 N mijoz kutmoqda» belgisi va «Mijozga xabar» tugmasi. Xodimda — o'z filialidagi ochiq
// yozuv bo'lsa (boshqa filialga kelgan dori mijozni adashtirmasin). Direktorda (filialId yo'q) — har ochiq filialga alohida
// tugma (audit 06.11: avval birinchi filial olinardi — mijozga boshqa filial aytilishi mumkin edi).
export function mijozQism(ctx, g, filialId) {
  if (!ctx || !ctx.server) return null;
  const ochiq = (z) => z.holat === 'yangi' || z.holat === 'buyurtma';
  const yozuvlar = g.yozuvlar.filter((z) => ochiq(z) && (!filialId || z.filialId === filialId))
    .filter((z, i, a) => a.findIndex((y) => y.filialId === z.filialId) === i);
  const kutadi = g.yozuvlar.reduce((s, z) => s + (Number(z.mijoz) || 0), 0);
  if (!yozuvlar.length && !kutadi) return null;
  const kop = !filialId && yozuvlar.length > 1;
  // 06.11 kech (foydalanuvchi: "xodim o'z panelidan mijozga xabarni bosib yuborsin"): o'z filialiga dori keldi — kutayotgan
  // mijozlarga xabar (Oson'dan avtomatik «Keldi» bo'lmagan bo'lsa ham).
  const yuborTugma = (z) => (Number(z.mijoz) > 0 ? h('button', { type: 'button', class: 'p sm mijoz-yubor', onclick: () => mijozgaYubor(ctx, g, z) },
    '✅ Keldi — ' + z.mijoz + ' mijozga xabar') : null);
  return h('div', { class: 'mijoz-q' },
    kutadi ? h('span', { class: 'belgi mijoz-belgi' }, '👤 ' + kutadi + ' mijoz kutmoqda') : null,
    ...yozuvlar.map((z) => h('button', { type: 'button', class: 's sm mijoz-tugma', onclick: () => mijozOyna(ctx, z) },
      '👤 Mijozga xabar' + (kop && ctx.filNomi ? ' · ' + ctx.filNomi(z.filialId) : ''))),
    ...(filialId ? yozuvlar.map(yuborTugma) : []));
}

// Direktor (06.11 kech; foydalanuvchi: "direktor panelidagi defekturada mijozga xabar tugmasi kerak emas"): faqat belgi.
export function mijozBelgi(g) {
  const kutadi = (g.yozuvlar || []).reduce((s, z) => s + (Number(z.mijoz) || 0), 0);
  return kutadi ? h('div', { class: 'mijoz-q' }, h('span', { class: 'belgi mijoz-belgi' }, '👤 ' + kutadi + ' mijoz kutmoqda')) : null;
}

function mijozgaYubor(ctx, g, z) {
  return tasdiqlash('«' + g.nom + '» filialingizga keldimi? ' + z.mijoz + ' ta kutayotgan mijozga «Siz so\'ragan dori keldi» xabari boradi.')
    .then((ha) => ha && ctx.amal('defekturaMijozgaYubor', z.id))
    .then((n) => { if (typeof n === 'number' && n > 0) ctx.toast(n + ' ta mijozga xabar yuborildi ✓'); });
}

export function mijozOyna(ctx, yozuv, urinish = 0) {
  return ctx.amal('defekturaMijoz', yozuv.id).then((r) => {
    // Takror javobi (oldingi urinish saqlangan, natija yo'q) — kod har safar o'sha, yana bir bor so'raymiz.
    if (r && r.takror && !urinish) return mijozOyna(ctx, yozuv, 1);
    if (!r || typeof r !== 'object' || !r.kod) return;
    sheet('Mijozga xabar', (box) => {
      box.append(h('b', { 'data-asl': '' }, r.nom));
      if (!r.havola) { box.append(h('div', { class: 'msg warn' }, 'Bot sozlanmagan — havola yaratib bo\'lmadi. Direktorga ayting.')); return; }
      box.append(h('div', { class: 'muted' }, 'Mijoz telefon kamerasi bilan QR kodni skanerlasin va Telegram\'da «Start» ni bossin. Dori kelishi bilan unga o\'zi xabar boradi. Ismi va telefoni so\'ralmaydi.'
        + (r.ulangan ? ' Bu dorini hozir ' + r.ulangan + ' mijoz kutmoqda; har yangi mijozga — yangi QR.' : '')));
      const joy = h('div', { class: 'mijoz-qr' }, h('div', { class: 'muted', role: 'status' }, 'QR tayyorlanmoqda…'));
      box.append(joy);
      qrSvg(r.havola, { yorliq: 'Mijoz uchun QR kod', sinf: 'mijoz-qr-svg' })
        .then((svg) => { joy.textContent = ''; joy.append(svg); }, () => { joy.textContent = 'QR chizilmadi — havolani yuboring.'; });
      const tg = ctx.tg;
      box.append(h('div', { class: 'row' },
        tg && tg.openTelegramLink ? h('button', { class: 'p', onclick: () => tg.openTelegramLink('https://t.me/share/url?url=' + encodeURIComponent(r.havola)
          + '&text=' + encodeURIComponent('Dori kelganda xabar olish uchun bosing: ' + r.nom)) }, 'Telegram\'da yuborish') : null,
        h('button', { class: 's', onclick: () => nusxaOl(r.havola, ctx.toast, 'Havola nusxalandi ✓') }, 'Havolani nusxalash')));
    }, { fokus: false });
  });
}
