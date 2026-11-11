// Kelgan dorilar (10.11 kunduz, server 20261110233000_filial_kirim; egasi: "Oson'dan Osnovnoy'dan boshqa filialga dori o'tkazmasi
// amalga oshsa — o'sha filial xodimiga nechta dori, qancha miqdorda o'tkazilgani haqida ma'lumot; Osnovnoy'ga kirgan dorilar —
// Osnovnoy xodimlariga"; "xodimga «sinxronizatsiya qiling» degan chiqishi kerak — shunda o'sha filialning Oson'ida ko'rinadi").
// Oson'da faollashtirilgan ko'chirish (kirim omboridan ham) → filial xodimlariga bot xabari va shu karta: xodim Oson kassasida
// sinxronizatsiya qiladi, sanaydi, «Hammasi joyida» yoki «Farq bor» (qaysi dori, nechta keldi); farqni direktor «Hal qilindi» bilan yopadi.
import { h, input, kartaSarlavha, sana, sheet, tasdiqlash, vaqt, yopishSorovYangila, yordam, faolmi, faolQaytganda } from './ui.mjs';

const YANGILASH = 60000;
const KARTADA = 6;
const SS = () => ({ j: null, xato: null, vaqt: 0, okVaqt: 0, avlod: 0, yuklanmoqda: null, imzo: '', taymer: 0, xatoChizildi: false });
// Yuborilayotgan hujjatlar (2-audit): oyna yopilib qayta ochilsa ham — javob kelguncha amal tugmalari yo'q.
const YUB = new Set();
const S = SS();
// Sinov uchun (tests): modul holatini tozalash.
export function kirimUnut() { clearTimeout(S.taymer); Object.assign(S, SS()); YUB.clear(); }

export const SINX = 'Oson kassa dasturida «Sinxronizatsiya»ni bosing — shunda dorilar filialingiz Oson\'ida ko\'rinadi.';
const asl = (t) => h('span', { 'data-asl': '' }, t || '');
const qachon = (ts) => (ts ? (sana(ts) === sana(Date.now()) ? vaqt(ts) : sana(ts) + ' ' + vaqt(ts)) : '');
export const sonMatn = (n) => String(Math.round((Number(n) || 0) * 1000) / 1000).replace('.', ',');
const r3 = (n) => Math.round(Number(n) * 1000) / 1000;
// Kelgan soni: «2», «0,5», «1.25» (3 xonagacha kasr); bo'sh joy olib tashlanadi; boshqasi (1,000 / 0x10 / 1e3) — null.
export function sonOl(v) {
  const s = String(v == null ? '' : v).replace(/\s+/g, '');
  // «1,000» — mingmi yoki birmi, noaniq (1-audit) — rad; «2,5», «0,333» — kasr.
  if (!/^\d{1,7}([.,]\d{1,3})?$/.test(s) || /[.,]000$/.test(s)) return null;
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) && n <= 1000000 ? r3(n) : null;
}
const HOLAT = { kutilmoqda: ['Sanash kerak', 'ogoh'], joyida: ['✓ Hammasi joyida', 'ok'], farq: ['⚠ Farq bor', 'yoq'], hal: ['✓ Hal qilindi', 'ok'],
  bekor: ['Bekor qilindi', 'muted'] };
const ochiq = (k) => k.holat === 'kutilmoqda' || k.holat === 'farq';
// Qayerdan: o'z filialimiz nomi / kirim ombori / Oson nomi — nomlar asl holicha (kirill rejimida o'zgarmaydi).
const qayerdan = (k) => (k.danFn ? [asl(k.danFn), 'dan'] : k.ombor ? 'Kirim omboridan' : k.danNom ? ['«', asl(k.danNom), '»dan'] : 'Oson\'dan');

function yukla(ctx, chiz, majbur = false) {
  if (S.yuklanmoqda) return majbur ? S.yuklanmoqda.then(() => yukla(ctx, chiz, true)) : S.yuklanmoqda;
  if (!majbur && (S.j || S.xato) && Date.now() - S.vaqt < YANGILASH) return null;
  const avlod = S.avlod;
  S.yuklanmoqda = Promise.resolve().then(() => ctx.oqi('kirimRoyxat'))
    .then((j) => {
      if (!j || typeof j !== 'object' || !Array.isArray(j.qatorlar)) throw new Error('Server javobi tushunarsiz');
      if (avlod !== S.avlod) return false;   // amal paytida boshlangan so'rov — eski ro'yxat yamoqni bosmasin (2-audit)
      S.okVaqt = Date.now();
      const imzo = JSON.stringify(j), ozgardi = imzo !== S.imzo || !!S.xato;
      S.j = j; S.imzo = imzo; S.xato = null;
      return ozgardi;
    })
    .catch((e) => { S.xato = (e && e.message) || 'Ro\'yxat olinmadi'; return 'xato'; })
    .then((ozgardi) => {
      S.vaqt = Date.now(); S.yuklanmoqda = null;
      // Xato: birinchisi chiziladi (bor ro'yxatda «yangilanmadi» qatori chiqadi), keyingilari — qayta chizilmaydi; muvaffaqiyatdan keyin — yana.
      if ((ozgardi === true || (ozgardi === 'xato' && !S.xatoChizildi)) && chiz) { if (ozgardi === 'xato') S.xatoChizildi = true; chiz(); }
      if (ozgardi !== 'xato') S.xatoChizildi = false;
      return ozgardi;
    });
  return S.yuklanmoqda;
}
let kuzatOxirgi = null;   // audit 11.11: jimlikdan qaytganda — darhol yangilash
faolQaytganda(() => { if (kuzatOxirgi && !document.hidden && document.querySelector('[data-kirim-karta]')) yukla(kuzatOxirgi[0], kuzatOxirgi[1], true); });
function kuzat(ctx, chiz) {
  kuzatOxirgi = [ctx, chiz];
  if (S.taymer || typeof setTimeout !== 'function') return;
  S.taymer = setTimeout(() => {
    S.taymer = 0;
    if (typeof document === 'undefined' || !document.querySelector('[data-kirim-karta]')) return;
    if (!document.hidden && faolmi()) yukla(ctx, chiz, true);   // audit 10.11: jim telefon so'rov yubormaydi
    kuzat(ctx, chiz);
  }, YANGILASH);
  if (S.taymer && typeof S.taymer.unref === 'function') S.taymer.unref();
}
// Sinov uchun: majburiy yangilash (kuzatuv taymeri bilan bir xil yo'l).
export function kirimYukla(ctx, chiz) { return yukla(ctx, chiz, true); }
// Amaldan keyin: server qaytargan yangi holat darhol ro'yxatga (karta eski tugma bilan qolmasin), so'ng serverdan qayta.
function yangila(ctx, chiz, r) {
  S.avlod++;
  if (r && typeof r === 'object' && r.id && S.j && Array.isArray(S.j.qatorlar)) {
    S.j.qatorlar = S.j.qatorlar.map((z) => (z.id === r.id ? r : z));
    S.imzo = '';
    if (chiz) chiz();
  }
  yukla(ctx, chiz, true);
}

// ---------- Asosiy ekran kartasi ----------
// Xodim: o'z filiallariga kelganlari (sanash kerak — har doim, qolgani 2 kun); direktor: faqat ochiqlari (sanash kutilmoqda / farq).
export function kirimKarta(ctx, chiz) {
  if (!ctx.server) return null;
  yukla(ctx, chiz);
  kuzat(ctx, chiz);
  const dir = !!((S.j && S.j.direktor) || (ctx.x && ctx.x.rol === 'direktor'));
  if (!S.j) {
    // Birinchi yuklash xatosi — xodimga ko'rinadi (direktor bosh sahifasi ortiqcha xabar bilan to'lmasin).
    if (S.xato && !dir) return h('section', { class: 'card list kirim-karta', 'data-kirim-karta': '' }, kartaSarlavha('📦 Kelgan dorilar'),
      h('div', { class: 'muted' }, 'Ro\'yxat olinmadi: ' + S.xato));
    return h('div', { 'data-kirim-karta': '', hidden: true });
  }
  const rows = S.j.qatorlar.filter((k) => (dir ? ochiq(k) : true));
  // Audit 11.11 (2-audit): Oson ko'chirishlari 3 soatdan ko'p o'qilmagan (yoki hech o'qilmagan) — yangi kelgan dorilar hali
  // ro'yxatda bo'lmasligi mumkin. Ro'yxat bo'sh bo'lsa ham direktorga ko'rinadi (aynan shunda yangi kelganlar yo'qoladi).
  const hv = S.j.hujjatVaqt;
  const eskiHujjat = hv === null || (typeof hv === 'number' && Date.now() - hv > 3 * 3600e3);
  const ogohEl = () => h('div', { class: 'msg warn' }, hv
    ? '⚠ Oson ko\'chirishlari ' + sana(hv) + ' ' + vaqt(hv) + ' dan beri o\'qilmagan — yangi kelgan dorilar hali bu ro\'yxatda bo\'lmasligi mumkin.'
    : '⚠ Oson ko\'chirishlari hali o\'qilmagan — aptekadagi kompyuterda Oson admin ochiq va kirilganini tekshiring.');
  if (!rows.length) {
    if (eskiHujjat && dir) return h('section', { class: 'card list kirim-karta', 'data-kirim-karta': '' }, kartaSarlavha('📦 Kelgan dorilar'), ogohEl());
    return h('div', { 'data-kirim-karta': '', hidden: true });
  }
  const kut = rows.filter((k) => k.holat === 'kutilmoqda').length, farq = rows.filter((k) => k.holat === 'farq').length;
  const koP = new Set(rows.map((k) => k.f)).size > 1 || dir;
  const k = h('section', { class: 'card list kirim-karta' + ((dir ? farq : kut) ? ' muhim' : ''), 'data-kirim-karta': '' },
    kartaSarlavha('📦 Kelgan dorilar' + (kut ? ' — sanash kerak (' + kut + ')' : '') + (dir && farq ? (kut ? ', ' : ' — ') + 'farq (' + farq + ')' : '')));
  if (!dir && kut) k.append(h('div', { class: 'kirim-sinx' }, '1) ' + SINX + ' 2) Ro\'yxatni ochib, kelgan dorilarni sanang.'));
  if (S.xato && S.okVaqt) k.append(h('div', { class: 'muted' }, 'Yangilanmadi (' + S.xato + ') — ro\'yxat ' + vaqt(S.okVaqt) + ' holatida.'));
  if (eskiHujjat) k.append(ogohEl());
  rows.slice(0, KARTADA).forEach((z) => k.append(kirimQator(ctx, chiz, z, koP)));
  if (rows.length > KARTADA) {
    k.append(h('button', { type: 'button', class: 'link', onclick: () => hammasiOyna(ctx, chiz, rows, koP) }, 'Hammasini ko\'rish (' + rows.length + ')'));
  }
  return k;
}

function holatEl(k) {
  const [t, c] = HOLAT[k.holat] || [k.holat, 'muted'];
  return h('span', { class: 'belgi ' + c }, t);
}

function kirimQator(ctx, chiz, k, koP, yopOldin) {
  const sanash = k.holat === 'kutilmoqda';
  return h('div', { class: 'kirim-q' },
    h('div', { class: 'kirim-s' }, koP ? [asl(k.fn), ' ← '] : null, h('b', {}, qayerdan(k))),
    h('div', { class: 'muted' }, k.soni + ' xil · ' + sonMatn(k.jami) + ' quti' + (k.raqam ? ' · Oson №' + k.raqam : '') + ' · ' + qachon(k.vaqt)),
    h('div', { class: 'kirim-h' }, holatEl(k),
      h('button', { type: 'button', class: sanash ? 'p' : 'link', onclick: () => { if (yopOldin) yopOldin(); kirimOyna(ctx, chiz, k); } },
        sanash ? 'Ro\'yxat va sanash' : 'Ro\'yxat')));
}

function hammasiOyna(ctx, chiz, rows, koP) {
  sheet('Kelgan dorilar', (box, close) => { rows.forEach((z) => box.append(kirimQator(ctx, chiz, z, koP, close))); });
}

// ---------- Hujjat oynasi: ro'yxat, sanash natijasi, direktor — hal qilish ----------
function kirimOyna(ctx, chiz, k) {
  const dir = !!((S.j && S.j.direktor) || (ctx.x && ctx.x.rol === 'direktor'));
  sheet('Kelgan dorilar', (box, close) => {
    const q = Array.isArray(k.q) ? k.q : [];
    box.append(
      h('div', { class: 'kirim-sarlavha' }, asl(k.fn), ' ← ', h('b', {}, qayerdan(k))),
      h('div', { class: 'muted' }, (k.raqam ? 'Oson №' + k.raqam + ' · ' : '') + (k.sana ? k.sana.split('-').reverse().join('.') + ' · ' : '')
        + k.soni + ' xil dori, jami ' + sonMatn(k.jami) + ' quti'),
      k.ozgardi && k.holat === 'kutilmoqda' ? h('div', { class: 'belgi ogoh' }, 'Oson\'da o\'zgardi — qayta sanang') : null,
      k.holat === 'kutilmoqda' ? h('div', { class: 'kirim-sinx' }, SINX) : null);
    // Sanash: har dori qatorida haqiqatda kelgan soni (farq rejimida).
    const maydonlar = [];
    const royxat = h('div', { class: 'kirim-royxat' });
    const farqMap = new Map((Array.isArray(k.farq) ? k.farq : []).map((f) => [f.n, f]));
    const chizRoyxat = (farqRejim) => {
      royxat.replaceChildren();
      maydonlar.length = 0;
      q.forEach((x) => {
        if (farqRejim) {
          const m = input(asl(x.n), { inputmode: 'decimal', maxlength: 12, value: sonMatn(x.s), onfocus: (e) => { try { e.target.select(); } catch (er) { /* eski */ } } });
          const izId = m.i.id + 'o';
          m.el.classList.add('kirim-maydon');
          m.i.setAttribute('aria-describedby', izId + ' ' + (m.i.getAttribute('aria-describedby') || ''));
          maydonlar.push({ x, m });
          royxat.append(h('div', { class: 'kirim-maydon-joy' }, m.el, h('span', { class: 'muted', id: izId }, 'Oson\'da: ' + sonMatn(x.s) + ' quti')));
          return;
        }
        const f = farqMap.get(x.n);
        royxat.append(h('div', { class: 'kirim-qator' + (f ? ' farq' : '') }, asl(x.n),
          h('b', {}, f ? 'keldi ' + sonMatn(f.s) + ' / ' + sonMatn(x.s) : sonMatn(x.s))));
      });
    };
    chizRoyxat(false);
    box.append(royxat);
    if (Array.isArray(k.farq) && k.farq.length) box.append(h('div', { class: 'muted' }, 'Farqli qatorlar: keldi / Oson\'da.'));
    if (k.izoh) box.append(h('div', { class: 'muted' }, 'Izoh: ', asl(k.izoh)));
    if (k.javobKim) box.append(h('div', { class: 'muted' }, 'Sanadi: ', asl(k.javobKim), ' · ' + qachon(k.javobVaqt)));
    if (k.halKim) box.append(h('div', { class: 'muted' }, 'Hal qildi: ', asl(k.halKim), ' · ' + qachon(k.halVaqt) + (k.halIzoh ? ' — ' : ''), k.halIzoh ? asl(k.halIzoh) : null));

    let band = false;
    if (YUB.has(k.id)) {
      // Oldingi oynadan yuborilgan javob hali kelmagan — bu oynada amal yo'q (faqat ro'yxat).
      box.append(h('div', { class: 'belgi ogoh' }, 'Yuborilmoqda… biroz kuting'));
      return;
    }
    // Natija: muvaffaqiyat — yangi holat darhol; takror — bir marta yuborilgan; xato (null) — oyna yopiladi, ro'yxat qayta olinadi
    // (masalan boshqa xodim allaqachon sanagan yoki Oson'da bekor qilingan — eski ro'yxat bilan qayta urinilmasin).
    const natija = (r, matn) => {
      if (r === null) {
        // 2-audit: xato — ro'yxat qayta olinadi; hujjat o'zgargan (boshqa xodim sanagan, Oson'da bekor/o'zgargan) bo'lsa oyna yopiladi,
        // aks holda (masalan internet uzildi) — ochiq qoladi, yozilgan sonlar yo'qolmaydi, qayta bosish mumkin.
        S.imzo = '';
        Promise.resolve(yukla(ctx, chiz, true)).then(() => {
          const y = S.j && S.j.qatorlar.find((z) => z.id === k.id);
          if (!y || y.holat !== k.holat || y.versiya !== k.versiya) close();
        });
        return;
      }
      close();
      if (r && r.takror) { ctx.toast('Yuborilgan'); yukla(ctx, chiz, true); return; }
      ctx.toast(matn(r));
      yangila(ctx, chiz, r);
    };
    const yuborish = async (farq, izoh, tugma) => {
      if (band) return;
      band = true; tugma.disabled = true; YUB.add(k.id);
      const r = await Promise.resolve(ctx.amalFon('kirimJavob', k.id, farq, izoh, k.versiya || '')).finally(() => YUB.delete(k.id));
      band = false; tugma.disabled = false;
      natija(r, (x) => (x && x.holat === 'farq' ? 'Farq direktorga yuborildi' : 'Rahmat — hammasi joyida ✓'));
    };
    let halJoy = null;
    if (k.holat === 'kutilmoqda') {
      const joyida = h('button', { type: 'button', class: 'p katta', onclick: async (e) => {
        const t = e.currentTarget;
        if (band) return;
        if (!(await tasdiqlash('Oson\'da sinxronizatsiya qildingizmi va hammasi keldimi? ' + k.soni + ' xil, jami ' + sonMatn(k.jami) + ' quti.'))) return;
        yuborish([], '', t);
      } }, '✓ Hammasi joyida');
      const farqBor = h('button', { type: 'button', class: 's katta', onclick: () => farqRejim() }, 'Farq bor');
      const tugmalar = h('div', { class: 'kirim-tugma' }, joyida, farqBor);
      box.append(tugmalar);
      const farqRejim = () => {
        chizRoyxat(true);
        if (halJoy) halJoy.remove();   // direktor: bitta oynada ikki izoh maydoni bo'lmasin
        const iz = input('Izoh (ixtiyoriy)', { inputmode: 'text', maxlength: 300, placeholder: 'Masalan: qutisi ezilgan, boshqa dori ortiqcha keldi' });
        const xatoJoy = h('div', { class: 'err', 'aria-live': 'polite' });
        const yubor = h('button', { type: 'button', class: 'p katta', onclick: async (e) => {
          const t = e.currentTarget;
          if (band) return;
          const farq = [];
          let xato = false;
          for (const { x, m } of maydonlar) {
            const n = sonOl(m.i.value);
            if (n == null) { m.xato('Faqat son: masalan 2 yoki 0,5 (0 — umuman kelmadi)'); if (!xato) m.i.focus(); xato = true; continue; }
            if (n !== r3(x.s)) farq.push({ n: x.n, s: n, k: r3(x.s) });
          }
          if (xato) return;
          const izoh = iz.i.value.trim();
          if (!farq.length && !izoh) { xatoJoy.textContent = 'Farq topilmadi — kelgan sonini o\'zgartiring yoki izoh yozing'; return; }
          xatoJoy.textContent = '';
          // Tasodifiy xato (masalan «3» ustiga «2» yozilib «32») direktorga ketmasin — qisqa xulosa bilan tasdiq.
          const xulosa = farq.slice(0, 3).map((f) => '«' + f.n.slice(0, 25) + '»: ' + sonMatn(f.k) + ' → ' + sonMatn(f.s)
            + (f.s > 2 * f.k && f.s - f.k >= 2 ? ' (ko\'p!)' : '')).join('; ') + (farq.length > 3 ? '; yana ' + (farq.length - 3) + ' ta' : '');
          if (!(await tasdiqlash('Direktorga ' + (farq.length ? farq.length + ' ta farq' : 'izoh') + ' yuborilsinmi? (Oson\'da → keldi) '
            + (xulosa || izoh.slice(0, 120))))) return;
          yuborish(farq.map((f) => ({ n: f.n, s: f.s })), izoh, t);
        } }, 'Farqni yuborish');
        tugmalar.replaceWith(h('div', { class: 'muted' }, 'Har doriga haqiqatda nechta kelganini yozing (o\'zgarmaganlarini qoldiring).'), iz.el, xatoJoy, yubor);
        yopishSorovYangila();   // endi yozish maydonlari bor — pastga surib yopishda Telegram so'raydi
        const birinchi = maydonlar[0];
        if (birinchi) birinchi.m.i.focus();
      };
      box.append(yordam('Oson\'da ko\'chirish faollashtirilgan — dorilar sizning filialga yozildi. Avval Oson kassa dasturida sinxronizatsiya '
        + 'qiling, keyin qutilarni ochib, har dorini sanang. Hammasi to\'g\'ri bo\'lsa «Hammasi joyida», kam yoki ortiqcha bo\'lsa — «Farq bor» '
        + 'va kelgan sonini yozing (direktorga boradi).', 'Nega sanash kerak?'));
    }
    // Direktor: farqni yopadi; sanalmay qolganini — alohida havola ortida (asosiy amal — sanash).
    if (dir && ochiq(k)) {
      halJoy = h('div', { class: 'kirim-hal' });
      const halChiz = () => {
        const iz = input(k.holat === 'farq' ? 'Nima qilindi?' : 'Sanamasdan yopish — sababi', { inputmode: 'text', maxlength: 300,
          placeholder: k.holat === 'farq' ? 'Masalan: Oson\'da tuzatildi, firmaga aytildi' : 'Masalan: o\'zim tekshirdim' });
        const hal = h('button', { type: 'button', class: k.holat === 'farq' ? 'p katta' : 's katta', onclick: async (e) => {
          const t = e.currentTarget;
          if (band) return;
          const v = iz.i.value.trim();
          if (v.length < 2) { iz.xato('Nima qilinganini yozing'); iz.i.focus(); return; }
          band = true; t.disabled = true; YUB.add(k.id);
          const r = await Promise.resolve(ctx.amalFon('kirimHal', k.id, v)).finally(() => YUB.delete(k.id));
          band = false; t.disabled = false;
          natija(r, () => 'Hal qilindi ✓');
        } }, k.holat === 'farq' ? 'Hal qilindi' : 'Sanamasdan yopish');
        halJoy.replaceChildren(iz.el, hal);
        yopishSorovYangila();
      };
      if (k.holat === 'farq') halChiz();
      else halJoy.append(h('button', { type: 'button', class: 'link', onclick: () => { halChiz(); const i = halJoy.querySelector('input'); if (i) i.focus(); } }, 'Sanamasdan yopish…'));
      box.append(halJoy);
    }
  });
}
