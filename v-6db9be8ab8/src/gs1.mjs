// GS1 element satri (07.11): dori qutisidagi DataMatrix («Asl belgisi» — milliy markirovka) ichida GTIN, yaroqlilik muddati,
// seriya va raqam bor. Ilova dorini shtrix-kod bo'yicha topadi — GTIN-14 → EAN-13 (oldidagi 0 olib tashlanadi), qidiruv,
// inventarizatsiya va qoldiq avvalgidek ishlaydi. Sof funksiyalar (DOM'siz) — Node testida ham.
// Matn: ixtiyoriy belgi «]d2» / «]C1» / «]Q3» / «]e0»; ajratuvchi FNC1 — GS (\u001d; ZXing GS1 DataMatrix boshiga ham qo'yadi);
// «<GS>» / «\x1d» matn ko'rinishi — faqat haqiqiy GS bo'lmasa (kripto dumda «<» uchrashi mumkin). GS1 deb faqat DataMatrix
// formati, shu belgi yoki GS bo'lsa o'qiladi — oddiy EAN-13 («0101234…») AI 01 deb o'qilmasin.

export const GS = '\u001d';

// AI necha raqam — birinchi ikki raqamiga qarab (GS1 General Specifications). Ro'yxatda yo'q — GS1 emas / shu yerda to'xtaladi.
const AI2 = /^(0[0-3]|1[0-35-7]|2[0-2]|30|37|9\d)$/;
const AI3 = new Set(['23', '24', '25', '40', '41', '42', '71']);
const AI4 = new Set(['31', '32', '33', '34', '35', '36', '39', '43', '70', '72', '80', '81', '82']);
// Oldindan belgilangan uzunlik (GS kerak emas, faqat raqam): 11–17 — sana, 31xx–36xx — o'lchov, 41x — GLN.
const QAT = { '00': 18, '01': 14, '02': 14, '03': 14, '11': 6, '12': 6, '13': 6, '15': 6, '16': 6, '17': 6, '20': 2,
  '31': 6, '32': 6, '33': 6, '34': 6, '35': 6, '36': 6, '41': 13 };
// Qolganlari o'zgaruvchan — GS gacha yoki oxirigacha, ko'pi bilan shuncha belgi (91–99 kripto dumlar va boshqalar — 90).
const MAX = { '10': 20, '21': 20, '22': 20, '30': 8, '37': 8, '90': 30 };

// Mod-10 nazorat raqami (GTIN-8/12/13/14, EAN-13).
export function gtinTogrimi(k) {
  if (!/^\d{8,14}$/.test(k)) return false;
  let s = 0;
  for (let i = k.length - 2, w = 3; i >= 0; i--, w = 4 - w) s += Number(k[i]) * w;
  return (10 - (s % 10)) % 10 === Number(k[k.length - 1]);
}

// YYMMDD → 'YYYY-MM-DD'; DD = 00 — oyning oxirgi kuni; yil 2000+YY (dori muddati uchun yetadi); noto'g'ri sana — null.
function sana(v) {
  if (!/^\d{6}$/.test(v || '')) return null;
  const y = 2000 + Number(v.slice(0, 2)), m = Number(v.slice(2, 4));
  if (m < 1 || m > 12) return null;
  const oxiri = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const d = Number(v.slice(4, 6)) || oxiri;
  return d > oxiri ? null : `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// GS1 matni → { gtin, ean13, muddat, seriya, raqam, xom, ai } | null (GS1 emas yoki GTIN nazorat raqami noto'g'ri).
// gtin — AI 01 (14 raqam) yoki null; ean13 — GTIN «0» + to'g'ri EAN-13 bo'lsa 13 raqam, aks holda null; ai — hamma AI qiymati.
// Noma'lum AI yoki buzilgan qiymat chiqsa — o'qish shu yerda to'xtaydi (oldingilari qoladi; birinchisi bo'lsa — null).
export function gs1Ajrat(matn, format) {
  let s = String(matn == null ? '' : matn).trim();
  if (!s.includes(GS)) s = s.replace(/<GS>|\\x1d|\\u001d/gi, GS);
  const bel = /^\](d2|C1|Q3|e0)/.test(s);
  if (!bel && format !== 'data_matrix' && !s.includes(GS)) return null;
  if (bel) s = s.slice(3);
  const ai = {};
  let i = 0, soni = 0;
  while (i < s.length) {
    if (s[i] === GS) { i++; continue; }
    const b = s.slice(i, i + 2);
    const n = AI2.test(b) ? 2 : AI3.has(b) ? 3 : AI4.has(b) ? 4 : 0;
    const kod = s.slice(i, i + n);
    if (!n || !/^\d+$/.test(kod) || kod.length < n) break;
    let v;
    if (QAT[b]) {
      v = s.slice(i + n, i + n + QAT[b]);
      if (v.length < QAT[b] || !/^\d+$/.test(v)) break;
      i += n + QAT[b];
    } else {
      const max = MAX[b] || 90;
      let j = i + n;
      while (j < s.length && s[j] !== GS && j - i - n < max) j++;
      v = s.slice(i + n, j);
      i = j;
    }
    if (v && !(kod in ai)) { ai[kod] = v; soni++; }
  }
  if (!soni) return null;
  const gtin = ai['01'] || null;
  if (gtin && !gtinTogrimi(gtin)) return null;
  const ean13 = gtin && gtin[0] === '0' && gtinTogrimi(gtin.slice(1)) ? gtin.slice(1) : null;
  return { gtin, ean13, muddat: sana(ai['17']), seriya: ai['10'] || null, raqam: ai['21'] || null, xom: String(matn), ai };
}

// Dori qidiruvi uchun shtrix-kod: GTIN'li GS1 — EAN-13 (EAN-13 ko'rinishi bo'lmasa — GTIN-14), boshqasi — o'zgarishsiz.
export function shtrixKod(matn, format) {
  const g = gs1Ajrat(matn, format);
  return g && g.gtin ? g.ean13 || g.gtin : matn;
}
