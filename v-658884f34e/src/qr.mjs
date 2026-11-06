// Rasmdagi QR kodlarni o'qish. Bir rasmda bir nechta retsept bo'lishi mumkin, shuning uchun rasm bo'laklarga bo'linadi:
// butun rasm, keyin 2×2 va 3×3 ustma-ust bo'laklar (jami 14). Har bo'lak Web Worker'da (qr-ishchi.js) o'qiladi —
// shovqinli rasmda ham ilova qotmaydi. Worker ishlamasa (eski telefon) — asosiy oqimda, xuddi shu tartibda.
// rejim (audit §7 "birinchi topilmada to'xtash" — bir nechta retseptli rasm uchun moslangan):
//   'birinchi' (sukut) — birinchi topilgan QR'da to'xtaydi (ko'rib chiqilgan rasm: faqat ko'rsatish);
//   'bosqich' — yangi rasm: butun rasm + 2×2. Butun rasmda QR topilib, 2×2 yangisini topmasa — to'xtaydi (rasmda bitta
//              retsept, 5 bo'lak). 2×2 yangi QR topsa (bir nechta retsept) yoki hech narsa topilmasa (QR mayda) — 3×3 ham;
//   'hammasi' — 14 bo'lakning hammasi ("Yana QR qidirish" tugmasi).
// Natija: { qrlar, qoldi } — qoldi: erta to'xtadi, ko'rilmagan bo'lak bor.
// signal (AbortSignal) — oyna yopilsa o'qish to'xtaydi va ishchi yopiladi. bosqich(i, jami) — har bo'lakdan keyin (holat matni).

// Bo'laklar: [sx, sy, sw, sh] — DOM'siz, testlanadi.
export function bolaklar(W, H) {
  const out = [[0, 0, W, H]];
  for (const n of [2, 3]) {
    const tw = W * 2 / (n + 1), th = H * 2 / (n + 1);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) out.push([i * (W - tw) / (n - 1), j * (H - th) / (n - 1), tw, th]);
  }
  return out;
}

// i-bo'lak (0 — butun rasm, 1–4 — 2×2, 5–13 — 3×3) o'qilgandan keyin to'xtash kerakmi. butunda — butun rasmda topilgan
// QR soni, jami — hozirgacha topilgan har xil QR soni. DOM'siz — testlanadi.
export function toxtash(rejim, i, butunda, jami) {
  if (rejim === 'birinchi') return jami > 0;
  if (rejim === 'bosqich') return i === 4 && butunda > 0 && jami === butunda;
  return false;
}

const KESILDI = 'QR o\'qish to\'xtatildi';

function ishchiOquvchi() {
  const w = new Worker(new URL('./qr-ishchi.js', import.meta.url));
  let n = 0, buzildi = null;
  const kut = new Map();
  const hammasigaXato = (e) => { kut.forEach((p) => p.no(e)); kut.clear(); };
  w.onmessage = (e) => { const p = kut.get(e.data && e.data.id); if (p) { kut.delete(e.data.id); p.ok(e.data.natija); } };
  w.onerror = (e) => { if (e && e.preventDefault) e.preventDefault(); buzildi = new Error('QR ishchisi ishlamadi'); hammasigaXato(buzildi); };
  return {
    bolak: (d) => new Promise((ok, no) => {
      if (buzildi) { no(buzildi); return; }
      const id = ++n;
      kut.set(id, { ok, no });
      w.postMessage({ id, data: d.data.buffer, width: d.width, height: d.height }, [d.data.buffer]);
    }),
    yop: () => { w.terminate(); hammasigaXato(new Error(KESILDI)); }
  };
}

let jsqr = null;
function jsqrYukla() {
  if (window.jsQR) return Promise.resolve(window.jsQR);
  return jsqr || (jsqr = new Promise((ok, no) => {
    const s = document.createElement('script');
    s.src = new URL('../vendor/jsQR.js', import.meta.url).href;
    s.onload = () => ok(window.jsQR);
    s.onerror = () => { jsqr = null; no(new Error('QR o\'quvchi yuklanmadi')); };
    document.head.append(s);
  }));
}
async function asosiyOquvchi() {
  const jsQR = await jsqrYukla();
  return {
    bolak: async (d) => { const r = jsQR(d.data, d.width, d.height, { inversionAttempts: 'attemptBoth' }); return r && r.data ? r.data : null; },
    yop: () => {}
  };
}

export async function qrOqi(blob, { rejim = 'birinchi', signal = null, bosqich = null } = {}) {
  const img = await createImageBitmap(blob);
  let oq;
  try { oq = typeof Worker === 'function' ? ishchiOquvchi() : await asosiyOquvchi(); } catch (e) { oq = await asosiyOquvchi(); }
  const toxta = () => oq.yop();
  if (signal) signal.addEventListener('abort', toxta, { once: true });
  const topildi = new Set();
  const cv = document.createElement('canvas'), c2 = cv.getContext('2d', { willReadFrequently: true });
  const olish = () => c2.getImageData(0, 0, cv.width, cv.height);
  const bolak = bolaklar(img.width, img.height);
  let butunda = 0, qoldi = false;
  try {
    for (const [i, [sx, sy, sw, sh]] of bolak.entries()) {
      if (signal && signal.aborted) break;
      const k = Math.min(1, 1200 / Math.max(sw, sh));
      cv.width = Math.max(1, Math.round(sw * k)); cv.height = Math.max(1, Math.round(sh * k));
      c2.drawImage(img, sx, sy, sw, sh, 0, 0, cv.width, cv.height);
      let r;
      try { r = await oq.bolak(olish()); } catch (e) {
        if (signal && signal.aborted) break;
        oq = await asosiyOquvchi();   // ishchi ishlamadi — shu bo'lakdan boshlab asosiy oqimda
        r = await oq.bolak(olish());
      }
      const t = r ? String(r).trim() : '';
      if (t) topildi.add(t);
      if (i === 0) butunda = topildi.size;
      if (bosqich) { try { bosqich(i + 1, bolak.length); } catch (e) { /* holat matni xatosi o'qishga xalal bermasin */ } }
      if (toxtash(rejim, i, butunda, topildi.size)) { qoldi = i < bolak.length - 1; break; }
    }
  } finally {
    if (signal) signal.removeEventListener('abort', toxta);
    oq.yop();
    if (img.close) img.close();
    cv.width = 0; cv.height = 0;
  }
  return { qrlar: [...topildi], qoldi };
}
