// Shtrix-kod kodlash (28.10 shtrix.mjs dan ajratildi, 07.11 tun): EAN-13 (13 raqamli to'g'ri kod) yoki Code 128 (qolgani).
// Sof funksiyalar — DOM'siz: Mini App ekrani (shtrix.mjs) va server narx yorlig'i (Edge api.mjs narxYorliqHtml) bir xil chizadi.
// supabase/functions/api/shtrix-kod.mjs — shu faylning AYNAN nusxasi (tests/shtrix.test.mjs tekshiradi); o'zgarsa — nusxalang.
// Natija — '0101…' bitlar qatori (1 — qora chiziq moduli, 0 — oq).

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
export const shtrixTuri = (kod) => (eanTogrimi(kod) ? 'EAN-13' : 'Code 128');

// Ikki chetdagi bo'sh joy (modul): skaner kod chegarasini topsin (EAN-13 talabi — chapda 11, o'ngda 7; ikkalasiga 11).
export const SHTRIX_CHET = 11;

// SVG yo'li: har ketma-ket qora modullar — bitta to'rtburchak (balandligi 1, viewBox bo'yi bilan cho'ziladi).
export function shtrixYol(bit, chet = SHTRIX_CHET) {
  let yol = '';
  for (let i = 0; i < bit.length;) {
    if (bit[i] !== '1') { i++; continue; }
    let j = i;
    while (bit[j] === '1') j++;
    yol += 'M' + (i + chet) + ' 0h' + (j - i) + 'v1h-' + (j - i) + 'z';
    i = j;
  }
  return yol;
}

// To'liq SVG matni (oq fon, aniq chiziqlar). uslub — <svg style="…"> (o'lcham: px yoki mm). Kod faqat raqam/ASCII bo'lishi
// shart emas — chizishga faqat bitlar ishlatiladi, matn SVG ichiga yozilmaydi (HTML-xavfsiz).
export function shtrixSvg(kod, uslub = '') {
  const bit = shtrixBit(String(kod));
  const w = bit.length + SHTRIX_CHET * 2;
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + ' 1" preserveAspectRatio="none" shape-rendering="crispEdges"'
    + (uslub ? ' style="' + String(uslub).replace(/"/g, '') + '"' : '') + '>'
    + '<rect width="' + w + '" height="1" fill="#FFFFFF"/><path d="' + shtrixYol(bit) + '" fill="#000000"/></svg>';
}
export const shtrixKenglik = (kod) => shtrixBit(String(kod)).length + SHTRIX_CHET * 2;

// Yorliq uchun: Oson'dagi shtrix-kod(lar) (vergul bilan, 8–14 raqam) — birinchisi: avval to'g'ri EAN-13, bo'lmasa birinchi raqamli kod.
export function yorliqShtrix(sh) {
  const r = String(sh || '').split(',').map((s) => s.trim()).filter((s) => /^\d{8,14}$/.test(s));
  return r.find(eanTogrimi) || r[0] || null;
}
