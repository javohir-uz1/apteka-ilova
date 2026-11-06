// Qutidagi shtrix-kodni kamera bilan o'qish (06.11; dori nomi qidiruvi: "xodimlar dori nomini harfma-harf to'g'ri yoza olmaydi").
// O'quvchi: brauzerning o'z BarcodeDetector'i (Android'dagi Telegram/Chrome) — tez; bo'lmasa (iPhone, eski telefon) — ZXing
// Web Worker'da (shtrix-ishchi.js, miniapp/vendor/zxing.min.js). 06.11 kech (foydalanuvchi iPhone'da: "Kamerani ochadigan joy
// qani") — oldin BarcodeDetector bo'lmasa tugma yashirin edi; endi har doim ko'rinadi. Jonli kamera (getUserMedia) ochilmasa —
// «📸 Rasmga olish»: telefon kamerasida surat olinadi va o'qiladi. O'qilgan raqam qidiruvga beriladi (server shu shtrix-kodli
// dorini topadi — Oson'dan, kengaytma 0.9.14).
// Audit 06.11 kech: oyna yopilgach o'qish natijasi e'tiborsiz (ishchi qayta yaratilmaydi); ilova yashirilsa, surat olinayotganda
// va 1,5 daqiqadan keyin jonli kamera o'chadi («📷 Jonli kamerani ochish» bilan qaytadi); jonli kadrdan — o'rtadagi ramka qismi
// to'liq aniqlikda (tezroq va aniqroq), har 4-kadr — butun kadr.
import { h, sheet } from './ui.mjs';

const TURLAR = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'];
const KOD = /^\d{8,14}$/;
const JONLI_MAX = 90e3;
const kutish = (ms) => new Promise((ok) => setTimeout(ok, ms));

// UPC-A (12 raqam) → EAN-13 (oldiga 0): Oson'da va ZXing'da shtrix-kod 13 raqamli (audit: 0 tushib qolsa topilmasdi).
export const kodTozala = (v, format) => { const k = String(v || '').trim(); return format === 'upc_a' && /^\d{12}$/.test(k) ? '0' + k : k; };

// Brauzerning o'z o'quvchisi (bo'lsa) — { oqi(manba) → kod | null }.
let tabiiy = null;
function tabiiyOquvchi() {
  return tabiiy || (tabiiy = (async () => {
    try {
      const BD = globalThis.BarcodeDetector;
      if (!BD) return null;
      const bor = BD.getSupportedFormats ? await BD.getSupportedFormats() : TURLAR;
      const t = TURLAR.filter((x) => bor.includes(x));
      if (!t.length) return null;
      const det = new BD({ formats: t });
      return {
        oqi: async (manba) => {
          const r = await det.detect(manba).catch(() => []);
          return (r || []).map((x) => kodTozala(x.rawValue, x.format)).find((x) => KOD.test(x)) || null;
        }
      };
    } catch (e) { return null; }
  })());
}

const ISHCHI_XATO = 'Shtrix-kod o\'quvchisi yuklanmadi — internetni tekshiring';
// ZXing ishchisi — { oqi(ImageData, qattiq) → kod | null, yop() }.
function ishchiOquvchi() {
  const w = new Worker(new URL('./shtrix-ishchi.js', import.meta.url));
  let n = 0, buzildi = null;
  const kut = new Map();
  const hammasigaXato = (e) => { kut.forEach((p) => p.no(e)); kut.clear(); };
  w.onmessage = (e) => { const p = kut.get(e.data && e.data.id); if (p) { kut.delete(e.data.id); p.ok(e.data.natija || null); } };
  w.onerror = (e) => { if (e && e.preventDefault) e.preventDefault(); buzildi = new Error(ISHCHI_XATO); hammasigaXato(buzildi); };
  return {
    oqi: (img, qattiq = false) => new Promise((ok, no) => {
      if (buzildi) { no(buzildi); return; }
      const id = ++n;
      kut.set(id, { ok, no });
      w.postMessage({ id, data: img.data.buffer, width: img.width, height: img.height, qattiq }, [img.data.buffer]);
    }).then((k) => (k && KOD.test(k) ? k : null)),
    yop: () => { w.terminate(); hammasigaXato(new Error('to\'xtatildi')); }
  };
}

// Manba (video kadri yoki surat) bo'lagi [sx, sy, sw, sh] → ImageData, kattasi ko'pi bilan `en` px; burch — 90° burish
// (tik olingan surat). Canvas o'lchami faqat o'zgarganda beriladi (har kadrda xotira qayta ajratilmasin).
function kadr(c, manba, [sx, sy, sw, sh], en, burch = false) {
  const k = Math.min(1, en / Math.max(sw, sh));
  const w = Math.max(1, Math.round(sw * k)), hh = Math.max(1, Math.round(sh * k));
  const cw = burch ? hh : w, ch = burch ? w : hh;
  if (c.width !== cw) c.width = cw;
  if (c.height !== ch) c.height = ch;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.setTransform(1, 0, 0, 1, 0, 0);
  if (burch) x.setTransform(0, 1, -1, 0, hh, 0);
  x.drawImage(manba, sx, sy, sw, sh, 0, 0, w, hh);
  x.setTransform(1, 0, 0, 1, 0, 0);
  return x.getImageData(0, 0, cw, ch);
}
// Jonli kadrdagi o'qiladigan qism — ekrandagi ramkadan biroz kattaroq (ramka: eni 88%, bo'yi 40%, o'rtada).
const markaz = (vw, vh) => [vw * 0.02, vh * 0.25, vw * 0.96, vh * 0.5];

// Surat fayli → rasm elementi (EXIF burilishi brauzerda hisobga olinadi).
function suratYukla(fayl) {
  return new Promise((ok, no) => {
    const url = URL.createObjectURL(fayl);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); ok(img); };
    img.onerror = () => { URL.revokeObjectURL(url); no(new Error('Rasm ochilmadi')); };
    img.src = url;
  });
}

// Tugma: kichik «📷 Qutidan» (qidiruv yonida) yoki katta «📷 Kamera bilan o'qish» (inventarizatsiya). Topilgan raqam — topildi(kod).
export function skanerTugma(topildi, { katta = false } = {}) {
  return h('button', { type: 'button', class: (katta ? 'p katta' : 's') + ' skan-tugma', 'aria-label': 'Qutidagi shtrix-kodni kamera bilan o\'qish',
    onclick: () => skanerOyna(topildi) }, katta ? '📷 Kamera bilan o\'qish' : '📷 Qutidan');
}

function skanerOyna(topildi) {
  let oqim = null, toxta = false, ishchi = null, tugadi = false, avlod = 0;
  const tgw = globalThis.window && window.Telegram && window.Telegram.WebApp;
  sheet('Shtrix-kod', (box, close) => {
    const video = h('video', { class: 'skan-video', playsinline: '', 'webkit-playsinline': '', muted: '', autoplay: '' });
    video.muted = true;
    const vb = h('div', { class: 'skan-oyna' }, video, h('div', { class: 'skan-ramka', 'aria-hidden': 'true' }));
    const holat = h('div', { class: 'muted', role: 'status' }, 'Kamera ochilmoqda…');
    const qayta = h('button', { type: 'button', class: 's', hidden: true, onclick: () => jonli() }, '📷 Jonli kamerani ochish');
    const c = document.createElement('canvas');

    // Jonli kamerani o'chirish (oyna ochiq qoladi); avlod — eski o'qish sikli to'xtaydi.
    const kameraOchir = () => { avlod++; if (oqim) oqim.getTracks().forEach((t) => t.stop()); oqim = null; };
    const yop = () => {
      toxta = true; kameraOchir();
      if (ishchi) { ishchi.yop(); ishchi = null; }
      document.removeEventListener('visibilitychange', yashirildi);
      try { if (tgw && tgw.offEvent) tgw.offEvent('deactivated', yigildi); } catch (e) { /* eski Telegram */ }
    };
    const topdi = (kod) => { if (tugadi || toxta) return; tugadi = true; yop(); close(); topildi(kod); };
    const ishchiOl = () => { if (toxta) throw new Error('to\'xtatildi'); return ishchi || (ishchi = ishchiOquvchi()); };
    const toxtatildi = (sabab) => {
      kameraOchir(); vb.hidden = true; qayta.hidden = false;
      holat.textContent = sabab + ' Davom etish — «📷 Jonli kamerani ochish».';
    };
    // Ilova yashirildi (sahifa ko'rinmaydi) yoki Telegram yig'ildi (deactivated) — kamera yonib qolmasin.
    const yashirildi = () => { if (oqim && document.hidden) toxtatildi('Ilova yashirilgani uchun kamera o\'chirildi.'); };
    const yigildi = () => { if (oqim) toxtatildi('Ilova yig\'ilgani uchun kamera o\'chirildi.'); };

    async function jonli() {
      const a = ++avlod;
      qayta.hidden = true; vb.hidden = false;
      holat.textContent = 'Kamera ochilmoqda…';
      try {
        const md = globalThis.navigator && navigator.mediaDevices;
        if (!md || !md.getUserMedia) {
          vb.hidden = true;
          holat.textContent = 'Bu telefonda jonli kamera ochilmaydi — «📸 Rasmga olish»ni bosing.';
          return;
        }
        const s = await md.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
        if (toxta || a !== avlod) { s.getTracks().forEach((t) => t.stop()); return; }
        oqim = s;
        s.getVideoTracks().forEach((t) => t.addEventListener('ended', () => { if (a === avlod && !toxta) toxtatildi('Kamera uzildi.'); }));
        video.srcObject = s;
        await video.play().catch(() => {});
        const tb = await tabiiyOquvchi();
        if (toxta || a !== avlod) return;
        if (!tb) { holat.textContent = 'O\'quvchi yuklanmoqda…'; ishchiOl(); }
        const t0 = Date.now();
        let n = 0, korindi = false;
        while (!toxta && a === avlod && video.isConnected) {
          if (video.videoWidth) {
            if (!korindi) { korindi = true; holat.textContent = 'Shtrix-kodni ramkaga yotiq to\'g\'rilang…'; }
            const vw = video.videoWidth, vh = video.videoHeight;
            const kod = tb ? await tb.oqi(video)
              : await ishchiOl().oqi(n++ % 4 === 3 ? kadr(c, video, [0, 0, vw, vh], 960) : kadr(c, video, markaz(vw, vh), 1280));
            if (kod) { topdi(kod); return; }
          } else if (!korindi && Date.now() - t0 > 6000) {
            holat.textContent = 'Kamera tasviri kelmayapti — «📸 Rasmga olish»ni bosing.';
          }
          if (Date.now() - t0 > JONLI_MAX && a === avlod) { toxtatildi('Batareya tejash uchun kamera o\'chirildi.'); return; }
          await kutish(tb ? 250 : 80);
        }
      } catch (e) {
        if (tugadi || toxta || a !== avlod) return;
        kameraOchir();   // audit 06.11: xatoda ochilgan kamera o'chadi
        vb.hidden = true;
        const ruxsat = e && e.name === 'NotAllowedError';
        holat.textContent = e && e.message === ISHCHI_XATO ? e.message
          : ruxsat ? 'Kameraga ruxsat berilmadi — Telegram sozlamalarida kameraga ruxsat bering yoki «📸 Rasmga olish»ni bosing.'
            : 'Jonli kamera ochilmadi — «📸 Rasmga olish»ni bosing yoki nomini yozib qidiring.';
        if (!ruxsat && !(e && e.message === ISHCHI_XATO)) qayta.hidden = false;
      }
    }

    // Zaxira: surat olib o'qitish. <label> ichidagi fayl maydoni — bosilganda telefon o'zi ochadi (iPhone yashirin maydonga
    // .click() ni e'tiborsiz qoldirishi mumkin). Telefon kamerasi ochilishidan oldin jonli kamera o'chadi (ikkalasi bir kamerani
    // talashmasin).
    const fayl = h('input', { type: 'file', accept: 'image/*', capture: 'environment', class: 'skan-fayl', onclick: () => { fayl.value = ''; } });
    const suratTugma = h('label', { class: 'btn skan-surat' }, '📸 Rasmga olish', fayl);
    suratTugma.addEventListener('click', () => { if (oqim) { kameraOchir(); vb.hidden = true; qayta.hidden = false; holat.textContent = 'Surat olingach o\'qiladi.'; } });
    fayl.addEventListener('change', async () => {
      const f = fayl.files && fayl.files[0];
      if (!f || tugadi || toxta) return;
      holat.textContent = 'Rasm o\'qilmoqda…';
      try {
        const img = await suratYukla(f);
        if (toxta) return;
        const w = img.naturalWidth || img.width, hh = img.naturalHeight || img.height;
        const tb = await tabiiyOquvchi();
        let kod = tb ? await tb.oqi(img) : null;
        // Bir necha o'lchamda va 90° burib (shtrix-kod tik olingan bo'lsa); sinchiklab (qattiq).
        for (const [en, burch] of [[1280, false], [1280, true], [800, false], [1920, false]]) {
          if (kod || tugadi || toxta) break;
          kod = await ishchiOl().oqi(kadr(c, img, [0, 0, w, hh], en, burch), true);
        }
        if (tugadi || toxta) return;
        if (kod) topdi(kod);
        else holat.textContent = 'Rasmdan shtrix-kod topilmadi — yaqinroqdan, tekis va yorug\'da qayta oling (shtrix-kod rasmning o\'rtasida bo\'lsin).';
      } catch (e) {
        if (!tugadi && !toxta) holat.textContent = (e && e.message) || 'Rasm o\'qilmadi';
      } finally { fayl.value = ''; }
    });

    box.append(h('div', { class: 'muted' }, 'Dori qutisidagi shtrix-kodni ramkaga yotiq to\'g\'rilang — o\'zi o\'qiladi.'), vb, holat, qayta,
      h('div', { class: 'muted', style: 'margin-top:8px' }, 'O\'qimayaptimi? Kamerada surat olib o\'qiting:'), suratTugma);
    document.addEventListener('visibilitychange', yashirildi);
    try { if (tgw && tgw.onEvent) tgw.onEvent('deactivated', yigildi); } catch (e) { /* eski Telegram */ }
    jonli();
    // Oyna yopilsa kamera darhol o'chadi (sheet tozalash funksiyasi); zaxira — video sahifadan olinganini kuzatish.
    const kuz = setInterval(() => { if (!video.isConnected) { clearInterval(kuz); yop(); } }, 500);
    return () => { clearInterval(kuz); yop(); };
  }, { fokus: false });
}
