// Shtrix-kod o'qish ishchisi (Web Worker; 06.11 kech — iPhone'da brauzerning BarcodeDetector'i yo'q, foydalanuvchi: "Kamerani
// ochadigan joy qani"). ZXing (miniapp/vendor/zxing.min.js, Apache-2.0) — EAN-13/8, UPC-E, Code 128 (dori qutilari).
// UPC_A ataylab yo'q (audit): EAN-13 o'quvchisi UPC-A ni ham o'qiydi, lekin 13 raqam bilan (oldidagi 0 tushib qolmaydi) —
// Oson'dagi shtrix-kod bilan aynan mos keladi.
// 07.11: DataMatrix ham (dori qutisidagi «Asl belgisi», GS1) — ikkala o'quvchida (ZXing tartibi: TEZ'da 1D o'qilmasa,
// QATTIQ'da 1D dan oldin). Javobdagi format ('ean_13', 'data_matrix', … — BarcodeDetector nomlari) bilan asosiy oqim GS1
// matnidan GTIN → EAN-13 ajratadi (src/gs1.mjs).
// Asosiy oqim kadr yoki surat baytlarini (ImageData RGBA) yuboradi; bu yerda kulrangga o'tkaziladi va o'qiladi — ekran qotmaydi.
// Kelish: { id, data: ArrayBuffer, width, height, qattiq }  →  javob: { id, natija: string | null, format: string | null }
// qattiq — surat (bir marta, sinchiklab: TRY_HARDER); jonli kadr — tez (sekundiga bir necha kadr, telefon qizimasin).
importScripts('../vendor/zxing.min.js');

const Z = self.ZXing;
const TURLAR = [Z.BarcodeFormat.EAN_13, Z.BarcodeFormat.EAN_8, Z.BarcodeFormat.UPC_E, Z.BarcodeFormat.CODE_128, Z.BarcodeFormat.DATA_MATRIX];
function oquvchiYarat(qattiq) {
  const o = new Z.MultiFormatReader();
  const m = new Map();
  m.set(Z.DecodeHintType.POSSIBLE_FORMATS, TURLAR);
  if (qattiq) m.set(Z.DecodeHintType.TRY_HARDER, true);
  o.setHints(m);
  return o;
}
const TEZ = oquvchiYarat(false), QATTIQ = oquvchiYarat(true);

// RGBA → yorqinlik (0..255).
function kulrang(rgba, n) {
  const y = new Uint8ClampedArray(n);
  for (let i = 0, j = 0; i < n; i++, j += 4) y[i] = (rgba[j] * 306 + rgba[j + 1] * 601 + rgba[j + 2] * 117) >> 10;
  return y;
}

// DataMatrix chetda bo'lsa: ZXing'ning DataMatrix detektori faqat rasm markazidan qidiradi (markaz belgida bo'lmasa — topmaydi).
// Shuning uchun kesimlar [cx, cy, en, bo'y] (ulush) markazidan ham urinadi: surat — 5×5 to'r (40%), hammasi; jonli kadr
// (ramka bo'lagi, yotiq) — 5×3 (30%×80%), har kadrda navbatdagi 4 tasi (kadr arzon qolsin; 4 kadrda hammasi).
const TOR = [], LENTA = [];
for (const cy of [0.1, 0.3, 0.5, 0.7, 0.9]) for (const cx of [0.1, 0.3, 0.5, 0.7, 0.9]) if (cx !== 0.5 || cy !== 0.5) TOR.push([cx, cy, 0.4, 0.4]);
for (const cy of [0.3, 0.5, 0.7]) for (const cx of [0.2, 0.35, 0.5, 0.65, 0.8]) if (cx !== 0.5 || cy !== 0.5) LENTA.push([cx, cy, 0.3, 0.8]);
const DM = new Z.DataMatrixReader();
let navbat = 0;
function dmKesib(bm, w, h, qattiq) {
  const r = qattiq ? TOR : [0, 1, 2, 3].map(() => LENTA[navbat++ % LENTA.length]);
  for (const [cx, cy, kw, kh] of r) {
    const cw = Math.round(w * kw), ch = Math.round(h * kh);
    const x = Math.max(0, Math.min(w - cw, Math.round(w * cx - cw / 2))), y = Math.max(0, Math.min(h - ch, Math.round(h * cy - ch / 2)));
    try {
      const t = String(DM.decode(bm.crop(x, y, cw, ch)).getText()).trim();
      if (t) return { natija: t, format: 'data_matrix' };
    } catch (e) { /* bu kesimda yo'q */ }
  }
  return null;
}

// Bitta binarizator: chiziqli (1D) o'quvchilar qator bo'yicha o'qiydi (getBlackRow) — HybridBinarizer'da u
// GlobalHistogramBinarizer bilan bir xil, ikkinchi urinish ortiqcha ish edi (audit). DataMatrix — butun matritsa (getBlackMatrix).
// Natija — { natija, format } | null; GS (\u001d, GS1 ajratuvchisi) trim'da qoladi.
function oqi(y, w, h, qattiq) {
  const o = qattiq ? QATTIQ : TEZ;
  const bm = new Z.BinaryBitmap(new Z.HybridBinarizer(new Z.RGBLuminanceSource(y, w, h)));
  try {
    const r = o.decodeWithState(bm);
    const t = r && r.getText ? String(r.getText()).trim() : '';
    const f = r && r.getBarcodeFormat ? Z.BarcodeFormat[r.getBarcodeFormat()] : null;
    if (t) return { natija: t, format: f ? String(f).toLowerCase() : null };
  } catch (e) { /* markazda topilmadi */ } finally { o.reset(); }
  return dmKesib(bm, w, h, qattiq);
}

self.onmessage = (e) => {
  const { id, data, width, height, qattiq } = e.data || {};
  let r = null;
  try { if (data && width > 0 && height > 0) r = oqi(kulrang(new Uint8ClampedArray(data), width * height), width, height, !!qattiq); } catch (err) { /* buzilgan kadr */ }
  self.postMessage({ id, natija: r ? r.natija : null, format: r ? r.format : null });
};
