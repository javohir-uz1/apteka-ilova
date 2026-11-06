// Shtrix-kod o'qish ishchisi (Web Worker; 06.11 kech — iPhone'da brauzerning BarcodeDetector'i yo'q, foydalanuvchi: "Kamerani
// ochadigan joy qani"). ZXing (miniapp/vendor/zxing.min.js, Apache-2.0) — EAN-13/8, UPC-E, Code 128 (dori qutilari).
// UPC_A ataylab yo'q (audit): EAN-13 o'quvchisi UPC-A ni ham o'qiydi, lekin 13 raqam bilan (oldidagi 0 tushib qolmaydi) —
// Oson'dagi shtrix-kod bilan aynan mos keladi.
// Asosiy oqim kadr yoki surat baytlarini (ImageData RGBA) yuboradi; bu yerda kulrangga o'tkaziladi va o'qiladi — ekran qotmaydi.
// Kelish: { id, data: ArrayBuffer, width, height, qattiq }  →  javob: { id, natija: string | null }
// qattiq — surat (bir marta, sinchiklab: TRY_HARDER); jonli kadr — tez (sekundiga bir necha kadr, telefon qizimasin).
importScripts('../vendor/zxing.min.js');

const Z = self.ZXing;
const TURLAR = [Z.BarcodeFormat.EAN_13, Z.BarcodeFormat.EAN_8, Z.BarcodeFormat.UPC_E, Z.BarcodeFormat.CODE_128];
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

// Bitta binarizator: chiziqli (1D) o'quvchilar qator bo'yicha o'qiydi (getBlackRow) — HybridBinarizer'da u
// GlobalHistogramBinarizer bilan bir xil, ikkinchi urinish ortiqcha ish edi (audit).
function oqi(y, w, h, qattiq) {
  const o = qattiq ? QATTIQ : TEZ;
  try {
    const r = o.decodeWithState(new Z.BinaryBitmap(new Z.HybridBinarizer(new Z.RGBLuminanceSource(y, w, h))));
    const t = r && r.getText ? String(r.getText()).trim() : '';
    return t || null;
  } catch (e) { return null; } finally { o.reset(); }
}

self.onmessage = (e) => {
  const { id, data, width, height, qattiq } = e.data || {};
  let natija = null;
  try { if (data && width > 0 && height > 0) natija = oqi(kulrang(new Uint8ClampedArray(data), width * height), width, height, !!qattiq); } catch (err) { /* buzilgan kadr */ }
  self.postMessage({ id, natija });
};
