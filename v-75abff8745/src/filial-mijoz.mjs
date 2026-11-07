// 08.11: filial mijozlar uchun (egasi: "mijoz botida dorixonalar nomi Osnovnoy, 1-filial, 4-filial bo'lib ko'rinyapti — boshqacha
// ko'rinishi kerak, lokatsiyasi va surati bilan"). Direktor → Sozlamalar → Filiallar → «Mijozlar uchun»: mijozlar ko'radigan nom,
// manzil, mo'ljal, ish vaqti, telefon, xarita nuqtasi (aptekada turib «Hozir turgan joyim» yoki xarita havolasi), surat.
// Server: 20261108100000_filial_mijoz (filial_mijoz_royxat / _yoz, filial_surat_ochir), Edge /filial_surat (surat Telegram'da turadi).
import { h, input, sheet, tasdiqlash, xatoJoyla } from './ui.mjs';

// Xarita havolasi yoki koordinata → { lat, lon } | null. Google: «!3d…!4d…» (qo'yilgan nuqta) avval, keyin «@lat,lon» (ekran
// markazi), «q=lat,lon»; Yandex: «whatshere[point]», «pt» (nuqta), keyin «ll» (markaz) — avval uzunlik; 2GIS «m=lon,lat»;
// oddiy «41.311, 69.279». O'zbekiston atrofida (37–46 kenglik, 55–74 uzunlik) juft teskari kelsa — almashtiriladi.
// Qisqa havola (maps.app.goo.gl, yandex …/-/…) — null (ichida koordinata yo'q).
export function joyTahlil(matn) {
  const t = String(matn || '').trim();
  if (!t) return null;
  const s = (() => { try { return decodeURIComponent(t); } catch (e) { return t; } })();
  const SON = '(-?\\d{1,3}(?:\\.\\d+)?)';
  const ol = (re) => { const m = new RegExp(re, 'i').exec(s); return m ? [Number(m[1]), Number(m[2])] : null; };
  let j = null, uzunlikAvval = false;
  if (/yandex|ya\.ru/i.test(s)) {
    j = ol('[?&]whatshere\\[point\\]=' + SON + ',\\s*' + SON) || ol('[?&]pt=' + SON + ',\\s*' + SON) || ol('[?&]ll=' + SON + ',\\s*' + SON);
    if (j) uzunlikAvval = true;
  } else if (/2gis/i.test(s)) {
    j = ol('[?&]m=' + SON + ',\\s*' + SON);
    if (j) uzunlikAvval = true;
  }
  j = j || ol('!3d' + SON + '!4d' + SON) || ol('[?&](?:q|query|destination|daddr)=(?:loc:)?' + SON + ',\\s*' + SON) || ol('@' + SON + ',\\s*' + SON)
    || ol('/search/' + SON + ',\\+?\\s*' + SON) || ol('^' + SON + '\\s*[,;]\\s*' + SON + '$') || ol('^' + SON + '\\s+' + SON + '$');
  if (!j || !j.every(Number.isFinite)) return null;
  let [lat, lon] = uzunlikAvval ? [j[1], j[0]] : j;
  const uz = (a, b) => a >= 37 && a <= 46 && b >= 55 && b <= 74;
  if (!uz(lat, lon) && uz(lon, lat)) [lat, lon] = [lon, lat];
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180 || (lat === 0 && lon === 0)) return null;
  // Butun sonlar («41,31» — vergulli kasr yoki noaniq) — nuqta emas: kamida bittasida kasr qismi bo'lsin.
  if (Number.isInteger(lat) && Number.isInteger(lon)) return null;
  return { lat: Math.round(lat * 1e6) / 1e6, lon: Math.round(lon * 1e6) / 1e6 };
}
export const joyMatn = (j) => (j ? j.lat.toFixed(6) + ',' + j.lon.toFixed(6) : '');
const xaritaUrl = (j) => 'https://maps.google.com/?q=' + j.lat + ',' + j.lon;

const RAD = 'Joylashuvga ruxsat berilmagan — xarita havolasini qo\'ying';
// Hozirgi joy: Telegram LocationManager (8.0+), bo'lmasa brauzer. → { lat, lon, aniq (m) }. 25 soniyada javob bo'lmasa — xato
// (Telegram ilovasi javob bermasa tugma qotib qolmasin). e.sozlama — avval rad etilgan (Telegram sozlamalarida yoqish kerak).
export function joyOl(tg, muddat = 25000) {
  return new Promise((res, rej) => {
    const vaqt = setTimeout(() => rej(new Error('Joylashuv aniqlanmadi — yana bir bor bosing yoki xarita havolasini qo\'ying')), muddat);
    const ok = (v) => { clearTimeout(vaqt); res(v); };
    const yoq = (e) => { clearTimeout(vaqt); rej(e); };
    const brauzer = () => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) { yoq(new Error('Telefon joylashuvni bermadi — xarita havolasini qo\'ying')); return; }
      navigator.geolocation.getCurrentPosition((p) => ok({ lat: p.coords.latitude, lon: p.coords.longitude, aniq: p.coords.accuracy }),
        (e) => yoq(new Error(e && e.code === 1 ? RAD + ' (telefon sozlamalarida Telegram\'ga joylashuv ruxsatini bering)'
          : 'Joylashuv aniqlanmadi — GPS yoqilganini tekshiring yoki xarita havolasini qo\'ying')),
        { enableHighAccuracy: true, timeout: Math.max(1000, muddat - 2000), maximumAge: 0 });
    };
    const lm = tg && tg.LocationManager;
    if (!lm || !tg.isVersionAtLeast || !tg.isVersionAtLeast('8.0')) { brauzer(); return; }
    const keyin = () => {
      if (!lm.isLocationAvailable) { brauzer(); return; }
      const radEtilgan = !!(lm.isAccessRequested && !lm.isAccessGranted);
      lm.getLocation((d) => (d && Number.isFinite(d.latitude) ? ok({ lat: d.latitude, lon: d.longitude, aniq: d.horizontal_accuracy })
        : yoq(Object.assign(new Error(RAD), { sozlama: radEtilgan && typeof lm.openSettings === 'function' }))));
    };
    try { if (lm.isInited) keyin(); else lm.init(keyin); } catch (e) { brauzer(); }   // init ikkinchi marta chaqirilsa — javob bermaydi
  });
}

// Rasm → JPEG base64 (uzun tomoni 1600 px gacha). Shaffof PNG — oq fon. Telegram suratni baribir siqadi.
async function suratTayyorla(file) {
  if (!file || (file.type && !/^image\//.test(file.type))) throw new Error('Rasm tanlang (surat)');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Rasm ochilmadi — boshqa surat tanlang')); i.src = url; });
    const w = img.naturalWidth || 1, hh = img.naturalHeight || 1;
    if (Math.max(w, hh) / Math.min(w, hh) > 10) throw new Error('Surat juda cho\'zinchoq — oddiy surat tanlang');
    const k = Math.min(1, 1600 / Math.max(w, hh));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * k));
    c.height = Math.max(1, Math.round(hh * k));
    const g = c.getContext('2d');
    g.fillStyle = '#fff';
    g.fillRect(0, 0, c.width, c.height);
    g.drawImage(img, 0, 0, c.width, c.height);
    let q = 0.85, d = c.toDataURL('image/jpeg', q);
    while (d.length > 2600000 && q > 0.4) { q -= 0.15; d = c.toDataURL('image/jpeg', q); }
    const b = d.split(',')[1] || '';
    if (!/^\/9j\//.test(b)) throw new Error('Rasm tayyorlanmadi — boshqa surat tanlang');
    return b;
  } finally { URL.revokeObjectURL(url); }
}

// Oyna. ctx: oqi, amalX, amalFon, toast, tg, firma.surat (yuklash). z — S.filiallar dagi filial ({ id, nom }).
export function filialMijozOyna(ctx, z) {
  sheet('Mijozlar uchun: ' + z.nom, (box, close) => {
    const kut = h('div', { class: 'muted', 'aria-live': 'polite' }, 'Yuklanmoqda…');
    box.append(kut);
    const yukla = async () => {
      kut.textContent = 'Yuklanmoqda…';
      let fl;
      try { fl = await ctx.oqi('filialMijozRoyxat'); } catch (e) {
        kut.textContent = ((e && e.message) || 'Olinmadi') + ' ';
        kut.append(h('button', { type: 'button', class: 's', onclick: yukla }, 'Qayta urinish'));
        return;
      }
      const d = (Array.isArray(fl) ? fl : []).find((f) => f.id === z.id);
      if (!d) { kut.textContent = 'Filial topilmadi — ilovani yangilang'; return; }
      kut.remove();
      chiz(d);
    };
    const chiz = (d) => {
      let joy = Number.isFinite(d.lat) && Number.isFinite(d.lon) ? { lat: d.lat, lon: d.lon } : null;
      let surat = !!d.surat, suratBand = false;
      const nom = input('Mijozlar ko\'radigan nom', { inputmode: 'text', value: d.mijoz_nom || '', placeholder: 'Masalan: Shifo dorixonasi — Chilonzor', maxlength: '60' });
      const manzil = input('Manzil', { inputmode: 'text', value: d.manzil || '', placeholder: 'Ko\'cha, uy', maxlength: '200' });
      const moljal = input('Mo\'ljal', { inputmode: 'text', value: d.moljal || '', placeholder: 'Masalan: bozor yonida, bekat ro\'parasi', maxlength: '200' });
      const ish = input('Ish vaqti', { inputmode: 'text', value: d.ish_vaqti || '', placeholder: 'Masalan: har kuni 08:00–22:00', maxlength: '80' });
      const tel = input('Telefon (aptekaniki)', { inputmode: 'tel', value: d.telefon || '', placeholder: '+998 90 123 45 67', maxlength: '20' });
      const havola = input('Yoki xarita havolasi / koordinata', { inputmode: 'url', value: '', placeholder: 'Google yoki Yandex xaritadan nusxa' });

      const joyHolat = h('div', { class: 'muted', 'aria-live': 'polite' });
      const joyChiz = () => {
        joyHolat.textContent = '';
        if (!joy) { joyHolat.append('📍 Xarita nuqtasi yo\'q'); return; }
        joyHolat.append('📍 ' + joyMatn(joy) + ' · ', h('a', { href: xaritaUrl(joy), target: '_blank', rel: 'noopener' }, 'xaritada ko\'rish'));
      };
      joyChiz();
      const qisqami = (v) => /goo\.gl|\/-\//.test(v);
      // Havola — har yozilganda tahlil (iPhone'da «Saqlash» bosilganda change kelmay qolishi mumkin; saqlashda ham qayta o'qiladi).
      const havolaOqi = (xatoKorsat) => {
        const v = String(havola.i.value).trim();
        if (!v) return true;
        const j = joyTahlil(v);
        if (!j) {
          if (xatoKorsat) havola.xato(qisqami(v) ? 'Qisqa havola ichida joy yo\'q — xaritada nuqtani bosib, koordinatani nusxalang' : 'Bu havoladan joy topilmadi');
          return false;
        }
        joy = j; joyChiz(); havola.xato('');
        return true;
      };
      havola.i.addEventListener('input', () => havolaOqi(false));
      havola.i.addEventListener('change', () => havolaOqi(true));
      const joyTugma = h('button', { type: 'button', class: 's', onclick: async () => {
        joyTugma.disabled = true;
        const eski = joyTugma.textContent;
        joyTugma.textContent = 'Joylashuv aniqlanmoqda…';
        try {
          const j = await joyOl(ctx.tg);
          joy = { lat: Math.round(j.lat * 1e6) / 1e6, lon: Math.round(j.lon * 1e6) / 1e6 };
          havola.i.value = ''; havola.xato('');
          joyChiz();
          if (Number.isFinite(j.aniq) && j.aniq > 150) ctx.toast('Aniqlik past (~' + Math.round(j.aniq) + ' m) — xaritada tekshiring, kerak bo\'lsa havola qo\'ying');
          else ctx.toast('Joy olindi ✓ — «Saqlash» ni bosing');
        } catch (e) {
          if (e && e.sozlama) {
            if (await tasdiqlash('Joylashuv ruxsati o\'chiq. Telegram sozlamalarini ochaymi? U yerda joylashuvga ruxsat bering.')) {
              try { ctx.tg.LocationManager.openSettings(); } catch (x) { /* bo'sh */ }
            }
          } else ctx.toast((e && e.message) || 'Joy olinmadi', 'xato');
        } finally { joyTugma.disabled = false; joyTugma.textContent = eski; }
      } }, '📍 Hozir turgan joyim (aptekada turib bosing)');
      const joyOchir = h('button', { type: 'button', class: 's', onclick: () => { joy = null; havola.i.value = ''; havola.xato(''); joyChiz(); } }, 'Nuqtani olib tashlash');

      // Surat. <label> ichidagi fayl maydoni — bosilganda telefon o'zi ochadi (iPhone yashirin maydonga .click() ni e'tiborsiz
      // qoldirishi mumkin; shtrix-skan.mjs bilan bir xil). Yuklash/o'chirish paytida — ikkinchisi yo'q (suratBand).
      const suratHolat = h('div', { class: 'muted', 'aria-live': 'polite' });
      const fayl = h('input', { type: 'file', accept: 'image/*', class: 'skan-fayl', onclick: (e) => { if (suratBand) e.preventDefault(); else fayl.value = ''; } });
      const suratTugma = h('label', { class: 'btn' }, '📷 Surat tanlash', fayl);
      const suratOchir = h('button', { type: 'button', class: 's' }, 'Suratni olib tashlash');
      const suratChiz = (matn) => {
        suratHolat.textContent = matn || (surat ? '🖼 Surat bor — mijozlar shuni ko\'radi' : '🖼 Surat yo\'q');
        suratOchir.hidden = !surat;
        suratOchir.disabled = suratBand;
        suratTugma.classList.toggle('band', suratBand);
      };
      fayl.addEventListener('change', async () => {
        const f = fayl.files && fayl.files[0];
        if (!f || suratBand) return;
        if (!ctx.firma || !ctx.firma.surat) { ctx.toast('Surat faqat Telegram ilovasida yuklanadi', 'xato'); return; }
        suratBand = true;
        suratChiz('Surat yuklanmoqda…');
        try {
          await ctx.firma.surat({ f: z.id, rasm: await suratTayyorla(f) });
          surat = true;
          ctx.toast('Surat saqlandi ✓ — botda sizga ham yuborildi');
        } catch (e) { ctx.toast((e && e.message) || 'Surat yuklanmadi', 'xato'); }
        finally { suratBand = false; suratChiz(); }
      });
      suratOchir.addEventListener('click', async () => {
        if (suratBand || !(await tasdiqlash('Suratni olib tashlaysizmi? Mijozlar suratsiz ko\'radi.'))) return;
        suratBand = true; suratChiz();
        try {
          const r = await ctx.amalFon('filialSuratOchir', z.id);
          if (r) { surat = false; ctx.toast('Surat olib tashlandi'); }
        } finally { suratBand = false; suratChiz(); }
      });
      suratChiz();

      const saqla = h('button', { class: 'p', onclick: async () => {
        const n = String(nom.i.value).trim(), t = String(tel.i.value).trim();
        let xato = false;
        if (n && (n.length < 2 || n.length > 60)) { nom.xato('2–60 harf'); xato = true; }
        if (t && !/^\+?[0-9][0-9 ()-]{4,19}$/.test(t)) { tel.xato('Masalan: +998 90 123 45 67'); xato = true; }
        if (!havolaOqi(true)) xato = true;   // qo'yilgan havola — shu yerda nuqtaga aylanadi
        if (xato) return;
        saqla.disabled = true;
        try {
          const r = await ctx.amalX(xatoJoyla([[nom, /nom/i], [tel, /telefon/i], [havola, /lokatsiya/i], [manzil, /manzil/i], [moljal, /mo'ljal/i], [ish, /ish vaqti/i]]),
            'filialMijozYoz', z.id, { nom: n, manzil: manzil.i.value, moljal: moljal.i.value, ish: ish.i.value, tel: t, joy: joyMatn(joy) });
          if (r) { ctx.toast('Saqlandi ✓ — mijozlar «' + r.n + '» deb ko\'radi'); close(); }
        } finally { saqla.disabled = false; }
      } }, 'Saqlash');

      box.append(
        h('div', { class: 'muted' }, 'Mijozlar botda filialni shu nom bilan, manzili, surati va xaritasi bilan ko\'radi. Ichki nom («' + z.nom + '») xodimlar uchun qoladi.'),
        nom.el, manzil.el, moljal.el, ish.el, tel.el,
        h('div', { class: 'card' }, h('b', {}, 'Xaritadagi joyi'), joyHolat, joyTugma, havola.el, joyOchir),
        h('div', { class: 'card' }, h('b', {}, 'Dorixona surati'), suratHolat, suratTugma, suratOchir),
        saqla);
    };
    yukla();
  });
}
