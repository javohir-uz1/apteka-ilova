// Shtrix-kodlar (28.10): shprits, sistema, analgin kabi mayda dorilar — xodim ro'yxatdan tanlaydi, ekranda shtrix-kod chiqadi,
// kassadagi skaner telefon ekranidan o'qiydi (Oson Apteka'ga qo'lda yozilmaydi). Direktor faqat raqamni yozadi — chizig'ini
// ilova o'zi chizadi: 13 raqamli to'g'ri EAN-13 bo'lsa — EAN-13, boshqasi — Code 128.
import { h, input, kartaSarlavha, sheet, tasdiqlash, xatoJoyla } from './ui.mjs';

// ---- Kodlash: natija — chiziq va oraliq kengliklari (modul), birinchisi — chiziq ----

const EAN_L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
const EAN_R = EAN_L.map((s) => [...s].map((c) => (c === '0' ? '1' : '0')).join(''));
const EAN_G = EAN_R.map((s) => [...s].reverse().join(''));
const EAN_TARTIB = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];

export function eanTogrimi(kod) {
  if (!/^\d{13}$/.test(kod)) return false;
  const d = [...kod].map(Number);
  const s = d.slice(0, 12).reduce((a, x, i) => a + x * (i % 2 ? 3 : 1), 0);
  return (10 - (s % 10)) % 10 === d[12];
}

// EAN-13 → '0101…' bitlar qatori (95 modul).
export function ean13(kod) {
  const d = [...kod].map(Number);
  const t = EAN_TARTIB[d[0]];
  let b = '101';
  for (let i = 1; i <= 6; i++) b += (t[i - 1] === 'L' ? EAN_L : EAN_G)[d[i]];
  b += '01010';
  for (let i = 7; i <= 12; i++) b += EAN_R[d[i]];
  return b + '101';
}

// Code 128 naqshlari (qiymat 0–106): chiziq/oraliq kengliklari.
const C128 = ['212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112'];
export const C128_NAQSH = C128;

// Code 128 qiymatlari: faqat raqam — C to'plami (ikki raqam bitta belgi, chiziq qisqaroq — ekrandan oson o'qiladi),
// toq bo'lsa oxirgi raqam B to'plamida; aks holda — B to'plami. Oxirida nazorat belgisi va stop.
export function code128Qiymat(kod) {
  const v = [];
  if (/^\d+$/.test(kod) && kod.length >= 2) {
    v.push(105);
    for (let i = 0; i + 1 < kod.length; i += 2) v.push(Number(kod.slice(i, i + 2)));
    if (kod.length % 2) v.push(100, kod.charCodeAt(kod.length - 1) - 32);
  } else {
    v.push(104);
    for (const c of kod) v.push(c.charCodeAt(0) - 32);
  }
  v.push(v.reduce((a, x, i) => a + x * (i || 1), 0) % 103, 106);
  return v;
}
export function code128(kod) {
  let b = '';
  code128Qiymat(kod).forEach((q) => [...C128[q]].forEach((w, i) => { b += (i % 2 ? '0' : '1').repeat(Number(w)); }));
  return b;
}

export const shtrixBit = (kod) => (eanTogrimi(kod) ? ean13(kod) : code128(kod));

// Ekranga: oq fon, ikki chetda bo'sh joy (skaner chegarani topsin), chiziqlar aniq (crispEdges).
// Bitta modul — butun piksel (28.10: kasr kenglikda ba'zi chiziqlar 2, ba'zilari 3 piksel bo'lib, skaner bir kodni o'qib,
// boshqasini o'qimadi): ekranga sig'adigan eng katta butun son, kamida 2 px.
export function shtrixRasm(kod) {
  const bit = shtrixBit(kod);
  const chet = 11, w = bit.length + chet * 2;
  const ekran = Math.min(typeof window !== 'undefined' && window.innerWidth ? window.innerWidth : 375, 560) - 40;
  const px = Math.max(2, Math.floor(ekran / w));
  let yol = '';
  for (let i = 0; i < bit.length;) {
    if (bit[i] !== '1') { i++; continue; }
    let j = i;
    while (bit[j] === '1') j++;
    yol += 'M' + (i + chet) + ' 0h' + (j - i) + 'v1h-' + (j - i) + 'z';
    i = j;
  }
  const d = h('div', { class: 'shtrix-rasm', role: 'img', 'aria-label': 'Shtrix-kod ' + kod, 'data-asl': '' });
  d.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + ' 1" preserveAspectRatio="none" shape-rendering="crispEdges" style="width:' + (w * px) + 'px">'
    + '<rect width="' + w + '" height="1" fill="#FFFFFF"/><path d="' + yol + '" fill="#000000"/></svg>';
  return d;
}

// ---- Ro'yxat ----

const tartibla = (a, b) => String(a).localeCompare(String(b), 'en', { numeric: true, sensitivity: 'base' });
// [{ guruh, turlar: [{id, nom, kod}] }] — guruh nomi va turlari tabiiy tartibda (2 ml, 5 ml, 10 ml).
export function shtrixGuruhlar(list) {
  const m = new Map();
  (list || []).forEach((s) => {
    const k = s.guruh.toLowerCase();
    if (!m.has(k)) m.set(k, { guruh: s.guruh, turlar: [] });
    m.get(k).turlar.push(s);
  });
  return [...m.values()].sort((a, b) => tartibla(a.guruh, b.guruh))
    .map((g) => ({ ...g, turlar: g.turlar.sort((a, b) => tartibla(a.nom, b.nom)) }));
}

// Guruh oynasi: turlari ro'yxati → bosilsa shtrix-kod, tagida «Orqaga» (ro'yxat yana chiqadi).
// Bitta turi bo'lsa (masalan, Analgin) — darhol shtrix-kod.
export function shtrixOyna(g, boshTur = null) {
  sheet(g.guruh, (box) => {
    const ich = h('div', { style: 'display:flex;flex-direction:column;gap:10px' });
    const yagona = g.turlar.length === 1;
    const royxat = () => {
      ich.textContent = '';
      ich.append(h('div', { class: 'muted' }, 'Turini tanlang — shtrix-kod chiqadi'),
        h('div', { class: 'shtrix-turlar' }, ...g.turlar.map((s) => h('button', { type: 'button', class: 'shtrix-tugma', onclick: () => kod(s) }, s.nom || g.guruh))));
    };
    const kod = (s) => {
      ich.textContent = '';
      ich.append(h('div', { class: 'shtrix-nomi' }, g.guruh + (s.nom ? ' · ' + s.nom : '')),
        shtrixRasm(s.kod),
        h('div', { class: 'shtrix-raqam', 'data-asl': '' }, s.kod),
        h('div', { class: 'muted', style: 'text-align:center' }, 'Ekranni skanerga tuting. O\'qimasa — telefon yorug\'ligini oshiring.'),
        yagona ? null : h('button', { type: 'button', class: 'p', onclick: royxat }, '‹ Orqaga — ro\'yxat'));
    };
    box.append(ich);
    if (boshTur) kod(boshTur); else if (yagona) kod(g.turlar[0]); else royxat();
  }, { fokus: false });
}

// Xodimning asosiy ekrani: guruh tugmalari (Shprits, Sistema, …). Ro'yxat bo'sh bo'lsa — hech narsa.
export function shtrixKarta(S) {
  const gs = shtrixGuruhlar(S.shtrixlar);
  if (!gs.length) return null;
  return h('div', { class: 'card' }, kartaSarlavha('Shtrix-kodlar'),
    h('div', { class: 'shtrix-turlar' }, ...gs.map((g) => h('button', { type: 'button', class: 'shtrix-tugma', onclick: () => shtrixOyna(g) }, g.guruh))));
}

// Direktor: qo'shish (nomi, turi, raqami) va ro'yxat (ko'rish, o'chirish).
let tanlanganGuruh = '';
export function shtrixDirektor(m, ctx) {
  const { S } = ctx;
  const gs = shtrixGuruhlar(S.shtrixlar);
  const guruh = input('Nomi', { inputmode: 'text', placeholder: 'Masalan: Shprits', k: 'shtrix-guruh', autocapitalize: 'sentences' });
  if (tanlanganGuruh && !guruh.i.value) guruh.qiymat(tanlanganGuruh);
  const tur = input('Turi (bo\'lmasa — bo\'sh qoldiring)', { inputmode: 'text', placeholder: 'Masalan: 5 ml', k: 'shtrix-tur' });
  const kod = input('Shtrix-kod raqami', { inputmode: 'numeric', placeholder: 'Qutidagi shtrix ostidagi raqamlar', pul: false, k: 'shtrix-kod' });
  const qosh = () => {
    const g = guruh.i.value.trim(), t = tur.i.value.trim(), k = kod.i.value.replace(/\s/g, '');
    if (!g) { guruh.xato('Nomini yozing (masalan: Shprits)'); guruh.i.focus(); return; }
    if (!/^[!-~]{1,40}$/.test(k)) { kod.xato('Shtrix-kod raqamlarini yozing'); kod.i.focus(); return; }
    const bor = (S.shtrixlar || []).find((s) => s.guruh.toLowerCase() === g.toLowerCase() && s.nom.toLowerCase() === t.toLowerCase());
    // Keyingi turi uchun nomi qoladi: forma qiymatlari saqlangach unutiladi va ekran qayta chiziladi — nom shu yerdan olinadi.
    const ish = () => { tanlanganGuruh = g; return ctx.amalX(xatoJoyla([[guruh, /nom/i], [tur, /tur/i], [kod, /kod|raqam/i]]), 'shtrixQosh', g, t, k).then((ok) => {
      if (!ok) return;
      ctx.toast(bor ? 'Shtrix-kod yangilandi ✓' : 'Qo\'shildi ✓');
    }); };
    if (bor && bor.kod !== k) tasdiqlash(g + (t ? ' · ' + t : '') + ' bor (' + bor.kod + '). Kodi ' + k + ' ga almashtirilsinmi?').then((ha) => ha && ish());
    else ish();
  };
  m.append(h('div', { class: 'card' }, kartaSarlavha('Yangi shtrix-kod'),
    h('div', { class: 'muted' }, 'Xodimlar asosiy ekranda nomini bosadi → turini tanlaydi → shtrix-kod chiqadi va skanerga tutadi. Hamma filialda bir xil. Faqat raqamni yozing — chizig\'ini ilova o\'zi chizadi.'),
    gs.length ? h('div', { class: 'pills', role: 'group', 'aria-label': 'Bor nomlar' }, ...gs.map((g) => h('button', { type: 'button', class: 'pill',
      onclick: () => { guruh.qiymat(g.guruh); guruh.xato(''); tur.i.focus(); } }, g.guruh))) : null,
    guruh.el, tur.el, kod.el,
    h('button', { class: 'p', 'data-klav': 'qoldir', onclick: qosh }, 'Qo\'shish')));
  if (!gs.length) { m.append(h('div', { class: 'card muted' }, 'Hali shtrix-kod yo\'q. Masalan: nomi «Shprits», turi «5 ml», raqami — qutidagi shtrix ostidagi raqamlar.')); return; }
  gs.forEach((g) => {
    m.append(h('div', { class: 'card list' }, kartaSarlavha(g.guruh + ' · ' + g.turlar.length + ' ta'),
      ...g.turlar.map((s) => h('div', { class: 'item' },
        h('div', { class: 'line', style: 'border:0;padding:0' }, h('span', {}, s.nom || '(turisiz)'), h('b', { 'data-asl': '' }, s.kod)),
        h('div', { class: 'row' },
          h('button', { class: 's', onclick: () => shtrixOyna(g, s) }, 'Ko\'rish'),
          h('button', { class: 's ogoh', onclick: () => tasdiqlash(g.guruh + (s.nom ? ' · ' + s.nom : '') + ' o\'chirilsinmi?')
            .then((ha) => ha && ctx.amal('shtrixOchir', s.id).then((ok) => ok && ctx.toast('O\'chirildi'))) }, 'O\'chirish'))))));
  });
}
