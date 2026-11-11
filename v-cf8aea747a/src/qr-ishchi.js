// QR o'qish ishchisi (Web Worker) — og'ir ish asosiy oqimdan tashqarida, ekran qotmaydi.
// Asosiy oqim rasm bo'lagini (ImageData baytlari) yuboradi, bu yerda jsQR (miniapp/vendor, Apache-2.0) o'qiydi.
// Kelish: { id, data: ArrayBuffer, width, height }  →  javob: { id, natija: string | null }
importScripts('../vendor/jsQR.js');

self.onmessage = (e) => {
  const { id, data, width, height } = e.data || {};
  let natija = null;
  try {
    const r = self.jsQR(new Uint8ClampedArray(data), width, height, { inversionAttempts: 'attemptBoth' });
    if (r && r.data) natija = r.data;
  } catch (err) { /* buzilgan bo'lak — topilmadi deb hisoblaymiz */ }
  self.postMessage({ id, natija });
};
