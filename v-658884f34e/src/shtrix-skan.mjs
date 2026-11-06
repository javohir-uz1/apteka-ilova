// Qutidagi shtrix-kodni kamera bilan o'qish (06.11; dori nomi qidiruvi: "xodimlar dori nomini harfma-harf to'g'ri yoza olmaydi").
// Brauzerning o'z BarcodeDetector'i (Android'dagi Telegram/Chrome) — kutubxonasiz. Bo'lmasa (iPhone, eski telefon) — tugma
// chiqmaydi. O'qilgan raqam qidiruv maydoniga yoziladi: server shu shtrix-kodli dorini topadi (Oson'dan, kengaytma 0.9.14).
import { h, sheet } from './ui.mjs';

const TURLAR = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'];
let qollaydi = null;
async function qollaydimi() {
  if (qollaydi !== null) return qollaydi;
  try {
    const BD = globalThis.BarcodeDetector;
    const md = globalThis.navigator && navigator.mediaDevices;
    if (!BD || !md || !md.getUserMedia) return (qollaydi = false);
    const bor = BD.getSupportedFormats ? await BD.getSupportedFormats() : TURLAR;
    qollaydi = TURLAR.some((t) => bor.includes(t));
  } catch (e) { qollaydi = false; }
  return qollaydi;
}

// Tugma (📷) — qo'llab-quvvatlansa ko'rinadi; topilgan raqam — topildi(kod).
export function skanerTugma(topildi) {
  const b = h('button', { type: 'button', class: 's skan-tugma', hidden: true, 'aria-label': 'Qutidagi shtrix-kodni kamera bilan o\'qish', onclick: () => skanerOyna(topildi) }, '📷 Qutidan');
  qollaydimi().then((ha) => { if (ha) b.hidden = false; });
  return b;
}

function skanerOyna(topildi) {
  let oqim = null, toxta = false;
  sheet('Shtrix-kod', (box, close) => {
    const video = h('video', { class: 'skan-video', playsinline: '', muted: '', autoplay: '' });
    const holat = h('div', { class: 'muted', role: 'status' }, 'Kamera ochilmoqda…');
    box.append(h('div', { class: 'muted' }, 'Dori qutisidagi shtrix-kodni ramkaga to\'g\'rilang — o\'zi o\'qiladi.'), video, holat);
    const yop = () => { toxta = true; if (oqim) oqim.getTracks().forEach((t) => t.stop()); };
    (async () => {
      try {
        const BD = globalThis.BarcodeDetector;
        const bor = BD.getSupportedFormats ? await BD.getSupportedFormats() : TURLAR;
        const det = new BD({ formats: TURLAR.filter((t) => bor.includes(t)) });
        oqim = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        if (toxta) { yop(); return; }
        video.srcObject = oqim;
        await video.play().catch(() => {});
        holat.textContent = 'Shtrix-kodni ko\'rsating…';
        while (!toxta && video.isConnected) {
          const r = await det.detect(video).catch(() => []);
          const kod = (r || []).map((x) => String(x.rawValue || '').trim()).find((x) => /^\d{8,14}$/.test(x));
          if (kod) { yop(); close(); topildi(kod); return; }
          await new Promise((ok) => setTimeout(ok, 250));
        }
      } catch (e) {
        yop();   // audit 06.11: xatoda ochilgan kamera o'chadi
        holat.textContent = e && e.name === 'NotAllowedError' ? 'Kameraga ruxsat berilmadi. Telegram sozlamalarida kameraga ruxsat bering.' : 'Kamera ochilmadi — nomini yozib qidiring.';
      } finally { if (!video.isConnected) yop(); }
    })();
    // Oyna yopilsa kamera darhol o'chadi (sheet tozalash funksiyasi); zaxira — video sahifadan olinganini kuzatish.
    const kuz = setInterval(() => { if (!video.isConnected) { clearInterval(kuz); yop(); } }, 500);
    return () => { clearInterval(kuz); yop(); };
  }, { fokus: false });
}
