// Reimbursatsiya: punktlar botga yuborgan ro'yxatlar (matn, rasm, QR kodli rasm). Direktor va Osnovnoy xodimlari.
// Ma'lumot 7 kundan keyin serverda o'chadi. JSHSHIR va kodlar telefonga niqoblangan holda keladi (audit 10.11); to'liq — faqat
// kengaytma (serverdan o'zi oladi) va direktorning punkt Excel'ida.
import * as H from './hisob.mjs';
import { BOT_USERNAME } from './config.mjs';
import { h, input, ishQator, kartaSarlavha, kunNomi, matnMaydon, nusxaOl, ochiladi, pills, sana, sheet, tasdiqlash, vaqt, xatoJoyla, yordam } from './ui.mjs';
import { qrOqi } from './qr.mjs';
import { raqamMaydon } from './punkt.mjs';
import { qoldiqMatn } from './oson-qoldiq.mjs';
import { KIRILL, kirill } from './kirill.mjs';
const yozuvMatni = (m) => (document.documentElement.classList.contains(KIRILL) ? kirill(m) : m);
import { qrNiqob, rasmKorilganmi, rasmQrXabari, royxatXabari } from './xabar.mjs';
import { yuklashTugmalari } from './yuklash.mjs';

// Ro'yxat serverdan olinadi va ekranda turadi; yangisi kelguncha eskisi ko'rinadi (sahifa tepaga sakramaydi).
const BOSH = () => ({ punktlar: [], xabarlar: [], bemorlar: [] });
let R = null;            // serverdan: { punktlar, xabarlar, bemorlar }
let yuklanmoqda = false;
let yana = false;        // yuklash paytida yana yangilash so'raldi
let yuklashXato = null;  // oxirgi yuklash xatosi (ko'rsatiladi)
let yuklandi = 0;        // oxirgi muvaffaqiyatli yuklash vaqti
const ESKIRISH = 30e3;   // ekran 30 soniyadan keyin qayta chizilsa — fonda yangilanadi
// Shu telefonda QR'dan qo'shilgan yoki "Ko'rib chiqildi" qilingan rasmlar: R fonda yangilanguncha ham ular ko'rilgan (audit M1).
const korilganRasm = new Set();

export const retseptRuxsat = (S, x) => x.rol === 'direktor' || x.daraja === 2 || !!(S.filiallar.find((f) => f.id === x.filialId) || {}).asosiy || x.filialId === 'osnovnoy';
let ekran = null;       // null — bosh; { punktId, kun } — punkt ichi; 'mijoz' | 'partiya' | 'hisobot' | 'punktlar'
let ichki = 'bemorlar';
// Retseptning ichki sahifasi ochiqmi (punkt, mijozlar, partiyalar…) — xodim panelidagi qaytish tugmasi uchun (05.11).
export const retseptIchida = () => ekran !== null;  // punkt ichida: 'bemorlar' | 'orash' | 'oson'
let boshKor = 'ochiq';   // punkt ro'yxatlari: 'ochiq' — ishi qolgan; 'tugagan'
// 28.10 (foydalanuvchi: "chiqarildi bossa ro'yxat yo'qolib qolmasin, joyida tursin"): standart — hammasi; chiqarilgani o'z joyida
// "✓ chiqarildi" bo'lib qoladi. 'qolgan' — faqat chiqarilmaganlar (xohlasa).
let osonKorinish = 'hammasi';
const MIJOZ_NOM = 'Aptekadagi mijozlar';

// Kim berdi (30.10): kengaytma kompyuteri nomi (Javohir, Dada, Xodim) yoki ilovada qo'lda belgilagan xodim.
export const berdiMatn = (z) => (z.holat !== 'berildi' && z.holat !== 'olindi' ? '' : z.berdi ? z.berdi : z.qolda ? 'Qo\'lda · ' + z.qolda : '');
// «Berdi:» / «Qo'lda ·» — yozuvga qarab (Кирилл), nom — o'z yozuvida (data-asl).
const berdiQism = (z) => (z.berdi ? [h('span', { 'data-asl': '' }, z.berdi)] : ['Qo\'lda · ', h('span', { 'data-asl': '' }, z.qolda)]);
const berdiBelgi = (tag, z) => (berdiMatn(z) ? h(tag, { class: 'kim-berdi' }, 'Berdi: ', ...berdiQism(z)) : null);
const HOLAT = { navbat: ['Navbatda', 'var(--muted)'], berildi: ['Berildi ✓', 'var(--accent)'], ochilmadi: ['Ochilmadi', 'var(--warn)'], olindi: ['Olib ketildi', 'var(--info)'] };
// Audit 10.11: server JSHSHIRni niqoblab beradi (jshshir_niqob: 1-raqam va oxirgi 3); bu yerda ham faqat shular — 2–7-raqamlar
// (tug'ilgan sana) hech qachon ko'rinmaydi (avval birinchi 4 raqam ko'rinardi).
export const maskJ = (j) => (j ? String(j)[0] + '•'.repeat(10) + String(j).slice(-3) : 'JSHSHIR yo\'q');
// Kod ekranda: boshi 3 raqam (server kodlar_niqob ham shuni beradi).
const kodNiqob = (k) => String(k).slice(0, 3) + '-•••';
const kodlari = (z) => (Array.isArray(z.kodlar) ? z.kodlar : []);
// Aptekadagi kompyuter QR orqali bergan bemor (C4) — serverdagi aniq belgi (20261110170000_audit_retsept: kompyuter_qr_bemor yozgan).
// 04.11 dan QR bemorda JSHSHIR va kod ham bo'lishi mumkin — «JSHSHIR va kod yo'q» belgisidan tanib bo'lmaydi.
export const qrBemor = (z) => z.qr === true;
// 03.11: ro'yxatda yozilgan ism (z.yozilgan) DMED'dagi ism-sharifga (z.ism) o'xshaydimi — birorta so'z (3+ harf) boshi mos kelsa
// ha («Jamol» ↔ «Xudayberganov Jamol …», «Ilxom» ↔ «Ilxomboy»). Mos emas — boshqa odamga berilgan yoki ism xato yozilgan: ⚠.
export const ismMos = (yozilgan, dmed) => {
  const s = (t) => H.qidiruvKalit(t).split(' ').filter((w) => w.length >= 3);
  const a = s(yozilgan), b = s(dmed);
  return !a.length || !b.length || a.some((w) => b.some((v) => v.startsWith(w) || w.startsWith(v)));
};
const ismOgoh = (z) => !!z.yozilgan && !ismMos(z.yozilgan, z.ism);
const bemorQatori = (z) => (qrBemor(z) ? 'QR retsept · kompyuterda berilgan'
  : maskJ(z.jshshir) + ' · ' + (kodlari(z).length ? kodlari(z).length + ' ta kod' : 'kod yo\'q'));

// Aptekadagi mijozlar — serverdagi ichki "punkt": punktlar ro'yxatidan ajratiladi (qog'ozdan kiritish, havola, qadoqlash — faqat
// haqiqiy punktlar), bemorlari esa alohida bo'limda (foydalanuvchi: "punktlar bilan aralashib ketmasin").
function ajrat(r) {
  const ichki = (r.punktlar || []).find((p) => p.ichki);
  r.ichki = ichki ? ichki.id : null;
  r.punktlar = (r.punktlar || []).filter((p) => !p.ichki);
  return r;
}
const mijozmi = (z) => !!R && !!R.ichki && z.punktId === R.ichki;
// Belgilar (O'raldi, Oson) — fonda: tugmalar bloklanmaydi, ekran o'zi optimistik yangilanadi (app.mjs amalFon). Eski ctx — amal.
const fon = (ctx) => ctx.amalFon || ctx.amal;

function yukla(ctx) {
  if (yuklanmoqda) { yana = true; return; }
  yuklanmoqda = true;
  if (!R) yuklashXato = null;
  ctx.oqi('retseptlar').then((r) => { R = ajrat(r || BOSH()); yuklashXato = null; yuklandi = Date.now(); },
    (e) => { yuklashXato = (e && e.message) || 'Ro\'yxat ochilmadi'; yuklandi = Date.now(); })
    .finally(() => {
      yuklanmoqda = false;
      if (yana) { yana = false; yukla(ctx); }
      ctx.rerender();
    });
}

// Bosh ekranda va punktning «Bemorlar» yorlig'ida ro'yxat eskirsa to'liq qayta olinadi; O'rash/Oson'da — faqat jonli belgilar.
const toliqYuklash = () => !ekran || (typeof ekran === 'object' && ichki === 'bemorlar');

// Ro'yxat yuklangani (R) — bo'lmasa yuklash/xato kartasi va false. Amaldan keyin ro'yxat fonda qayta olinadi; ekranda eskisi turadi.
function tayyorla(m, ctx) {
  const yangila = () => { yukla(ctx); ctx.rerender(); };
  const qil = (...a) => ctx.amal(...a).then((r) => { if (r !== null) yukla(ctx); return r; });
  const qilX = (joyla, ...a) => ctx.amalX(joyla, ...a).then((r) => { if (r !== null) yukla(ctx); return r; });
  // Qadoqlash ekranida eskirish bo'yicha to'liq qayta yuklanmaydi — u yerda har 5 s yengil jonli so'rov ishlaydi.
  if (!yuklanmoqda && (!R && !yuklashXato || (toliqYuklash() && Date.now() - yuklandi > ESKIRISH))) yukla(ctx);
  if (!R) {
    if (yuklashXato && !yuklanmoqda) {
      m.append(h('div', { class: 'card warn', role: 'alert' }, kartaSarlavha('Ro\'yxat ochilmadi'), h('div', {}, yuklashXato),
        h('div', {}, 'Internetni tekshiring va qayta urinib ko\'ring.'),
        h('button', { class: 'p', style: 'align-self:flex-start', onclick: yangila }, 'Qayta urinish')));
    } else m.append(h('div', { class: 'card muted', 'aria-live': 'polite' }, 'Ro\'yxat yuklanmoqda…'));
    return null;
  }
  return { yangila, qil, qilX };
}

// Direktor → Bo'limlar → Punktlar: punktlar ro'yxati, qo'shish va bot havolasi (alohida sahifa — topish oson bo'lsin).
export function punktlarView(m, ctx) {
  const t = tayyorla(m, ctx);
  if (!t) return;
  punktlarKarta(m, ctx, t.qil, t.qilX, false);
  m.append(yordam('Punkt qo\'shing va "Havola" ni bosing — havolani punktga Telegram\'da yuboring. Punkt bosganda botga ulanadi va retsept ro\'yxatini '
    + 'shu botga yuboradi. Kelgan ro\'yxatlar — Bo\'limlar → Retseptlar.'));
}

// Retseptlar (30.10, foydalanuvchi A va B maketlarini tanladi — docs/maket/retsept-variantlar.html; avval 5 yorliq va davr tanlovlari edi):
// bosh ekranda «Bajarish kerak» (ko'rilmagan rasm, xatoli bemor, o'rash, Oson) va punkt ro'yxatlari — har to'plam (punkt + kun) bitta
// karta, 4 bosqich: Ro'yxat keldi → DMED'da berildi → O'raldi → Oson; kartada faqat keyingi qadam tugmasi. Karta bosilsa — shu to'plam
// ichida 3 yorliq: Bemorlar | O'rash | Oson. Aptekadagi mijozlar — alohida karta va sahifa. Partiyalar, Hisobot, Punktlar — pastda.
const berilganmi = (z) => z.holat === 'berildi' || z.holat === 'olindi';
// Oson'dan chiqariladigan dorilar: berilgan va reimbursatsiya dorisi (oddiy retsept emas).
const chiqarDori = (d) => !d.berilmadi && !d.oddiy;
// Faqat oddiy retsept dorisi (yoki «berilmadi») berilgan bemor — Oson'dan chiqarilmaydi: to'plam sanog'iga, tugmaga, jadvalga kirmaydi
// (server oson_toplam ham sanamaydi — ilova.faqat_oddiy, 20261110170000_audit_retsept).
export const faqatOddiy = (z) => Array.isArray(z.dorilar) && z.dorilar.length > 0 && !z.dorilar.some(chiqarDori);
// Oson'dan chiqarilishi kerak, lekin hali chiqarilmagan.
const osonKerak = (z) => berilganmi(z) && !z.oson && !faqatOddiy(z);
// Reimbursatsiya retsepti 7 kun amal qiladi, server ro'yxatni 7 kundan keyin o'chiradi (dmed_ism.sql: vaqt > now() - 7 days).
// Navbatdagi bemor 5+ kunlik bo'lsa — kartada «N kun qoldi» va «Bajarish kerak»da qator. bugun — test uchun.
export const MUDDAT = 7;
export const kunFarq = (kun, bugun = H.kunKey(Date.now())) => Math.round((Date.parse(bugun) - Date.parse(kun)) / 864e5);
export const qolganKun = (kun, bugun) => MUDDAT - kunFarq(kun, bugun);
export const muddatMatn = (q) => (q > 1 ? q + ' kun qoldi' : q === 1 ? '1 kun qoldi — ertaga o\'chadi' : 'Bugun oxirgi kun — ro\'yxat o\'chadi');
const kunQisqa = (k) => k.slice(8, 10) + '.' + k.slice(5, 7);
const kunNom = (k) => (k === H.kunKey(Date.now()) ? 'bugun' : k === H.kunKey(Date.now() - 864e5) ? 'kecha' : kunQisqa(k));

// To'plamlar (punkt + Toshkent kuni) va har birining bosqichi — sof funksiya (tests/miniapp-retsept-ui.test.mjs).
// qadam: 2 — DMED'da berilmoqda (navbatda bemor bor), 3 — o'rash, 4 — Oson, 5 — hammasi bajarildi. Aptekadagi mijozlar kirmaydi.
// oddiy — faqat oddiy retsept dorisi berilganlar (Oson'ga kirmaydi); qoldi — navbatda bemor bor va 5+ kunlik: necha kun qoldi (aks holda null).
export function toplamlar(r, korilgan = new Set(), bugun = H.kunKey(Date.now())) {
  const g = new Map();
  const ol = (punktId, ts) => {
    const kun = H.kunKey(ts), k = punktId + '|' + kun;
    if (!g.has(k)) g.set(k, { punktId, kun, bemorlar: [], xabarlar: [] });
    return g.get(k);
  };
  (r.xabarlar || []).filter((z) => !r.ichki || z.punktId !== r.ichki).forEach((z) => ol(z.punktId, z.ts).xabarlar.push(z));
  (r.bemorlar || []).filter((z) => !r.ichki || z.punktId !== r.ichki).forEach((z) => ol(z.punktId, z.ts).bemorlar.push(z));
  return [...g.values()].map((t) => {
    const b = t.bemorlar, c = (hl) => b.filter((z) => z.holat === hl).length;
    const s = { ...t, jami: b.length, berilgan: b.filter(berilganmi).length, navbat: c('navbat'), ochilmadi: c('ochilmadi'),
      xatoli: b.filter((z) => z.holat === 'navbat' && z.xato && z.xato.length).length,
      oralmagan: b.filter((z) => z.holat === 'berildi' && !z.oraldi).length,
      osonsiz: b.filter(osonKerak).length, oddiy: b.filter((z) => berilganmi(z) && faqatOddiy(z)).length,
      rasm: t.xabarlar.filter((z) => z.tur === 'rasm' && !rasmKorilganmi(z, korilgan)).length,
      vaqt: Math.min(...[...b, ...t.xabarlar].map((z) => z.ts)) };
    s.qoldi = s.navbat && kunFarq(t.kun, bugun) >= MUDDAT - 2 ? Math.max(0, qolganKun(t.kun, bugun)) : null;
    s.qadam = s.navbat ? 2 : s.oralmagan ? 3 : s.osonsiz ? 4 : 5;
    s.tugadi = s.qadam === 5 && !s.rasm;
    return s;
  }).sort((a, b) => (a.kun < b.kun ? 1 : a.kun > b.kun ? -1 : 0));
}
// To'plamning keyingi ishi: [yorliq, tugma matni] yoki null. Oson — hamma bemor berilgandan keyin (punktlar Oson'dan bir yo'la chiqariladi).
export function keyingiIsh(t) {
  if (t.rasm) return ['bemorlar', 'Rasmlarni ko\'rish — ' + t.rasm];
  if (t.xatoli) return ['bemorlar', 'Xatoni tuzatish — ' + t.xatoli + ' bemor'];
  if (t.oralmagan) return ['orash', 'O\'rash — ' + t.oralmagan + ' bemor'];
  if (t.osonsiz && !t.navbat) return ['oson', 'Oson jadvali — ' + t.osonsiz + ' bemor'];
  return null;
}
// «Bajarish kerak»: rasm va xato — alohida; o'rash yoki (o'ralgach) Oson — to'plamga bittasi; mijozlar Oson'i — bitta qator.
// 7 kunlik muddat yaqin (navbatda bemor qolgan, 5+ kun) — eng birinchi: ro'yxat jim o'chib ketmasin.
export function retseptIshlar(ts, mijozQolgan) {
  const r = [];
  ts.filter((t) => !t.tugadi).forEach((t) => {
    if (t.qoldi != null) r.push({ tur: 'muddat', t, n: t.navbat });
    if (t.rasm) r.push({ tur: 'rasm', t, n: t.rasm });
    if (t.xatoli) r.push({ tur: 'xato', t, n: t.xatoli });
    if (t.oralmagan) r.push({ tur: 'orash', t, n: t.oralmagan });
    else if (t.osonsiz && !t.navbat) r.push({ tur: 'oson', t, n: t.osonsiz });
  });
  if (mijozQolgan) r.push({ tur: 'mijoz', n: mijozQolgan });
  return r;
}

const orqaTugma = (ctx) => h('button', { class: 'link', onclick: () => { ekran = null; ctx.rerender(true); } }, '‹ Retseptlar');
const jonliBelgi = () => h('div', { id: 'qadoq-jonli', class: 'muted', style: 'display:flex;align-items:center;gap:6px' },
  h('span', { style: 'width:8px;height:8px;border-radius:4px;background:var(--accent);flex:none', 'aria-hidden': 'true' }),
  h('span', { 'aria-live': 'off' }, toliqYuklash() ? 'Jonli · har 30 soniyada yangilanadi' + (yuklandi ? ' · ' + vaqt(yuklandi) : '')
    : 'Jonli · har 5 soniyada yangilanadi' + (jonliVaqt ? ' · ' + vaqt(jonliVaqt) : '')),
  h('span', { 'aria-live': 'polite' }, yuklanmoqda ? ' · Yangilanmoqda…' : ''));
// Bosqichlar: [[nom, son, 'bor' | 'hoz' | 'yoq']].
const bosqichlar = (qs) => h('ol', { class: 'bosqich', 'aria-label': 'Bosqichlar', style: 'grid-template-columns:repeat(' + qs.length + ',minmax(0,1fr))' },
  ...qs.map(([nom, son, hl], i) => h('li', { class: 'bosqich-q ' + hl, 'aria-current': hl === 'hoz' ? 'step' : null },
    h('span', { class: 'bosqich-d', 'aria-hidden': 'true' }, hl === 'bor' ? '✓' : String(i + 1)), h('span', {}, nom),
    son ? h('span', { class: 'bosqich-son' }, son) : null,
    h('span', { class: 'yashirin' }, hl === 'bor' ? ' — bajarildi' : hl === 'hoz' ? ' — hozirgi qadam' : ' — hali emas'))));

// Pastdagi menyudan «Retsept» bosilsa — bosh ekranga (punkt ichida qolib ketmasin).
export function retseptBosh() { ekran = null; }

export function retseptView(m, ctx) {
  const t = tayyorla(m, ctx);
  if (!t) return;
  const punktNom = (id) => (id && id === R.ichki ? MIJOZ_NOM : (R.punktlar.find((p) => p.id === id) || {}).nom || 'Punkt');
  const ochTo = (e, ich) => { ekran = e; if (ich) ichki = ich; ctx.rerender(true); };
  if (ekran === 'partiya' || ekran === 'hisobot' || ekran === 'punktlar') {
    m.append(orqaTugma(ctx), h('h2', { class: 'bolim-s' }, { partiya: 'Partiyalar', hisobot: 'Berilgan dorilar', punktlar: 'Punktlar' }[ekran]));
    if (ekran === 'partiya') return partiyaView(m, ctx);
    if (ekran === 'hisobot') return hisobotView(m, ctx);
    return punktlarKarta(m, ctx, t.qil, t.qilX, false);
  }
  if (yuklashXato) m.append(h('div', { class: 'msg warn', role: 'status' }, 'Ro\'yxat yangilanmadi: ' + yuklashXato + '. Ko\'rinib turgani — eski nusxa.'));
  if (ekran === 'mijoz') return mijozView(m, ctx);
  const ts = toplamlar(R, korilganRasm);
  if (ekran) {
    const tp = ts.find((x) => x.punktId === ekran.punktId && x.kun === ekran.kun);
    if (tp) return punktView(m, ctx, tp, punktNom(tp.punktId), t);
    ekran = null;   // to'plam endi yo'q (7 kun o'tdi)
  }
  boshView(m, ctx, ts, punktNom, t, ochTo);
}

function boshView(m, ctx, ts, punktNom, t, ochTo) {
  jonliBoshla(ctx);
  const mj = mijozOsonJami(R.bemorlar, R.ichki);
  const mijozlar = R.bemorlar.filter((z) => mijozmi(z) && berilganmi(z));
  const ishlar = retseptIshlar(ts, mj.qolgan.length);
  const ish = (x) => {
    if (x.tur === 'mijoz') return ishQator({ icon: 'chiqar', rang: 'info', sarlavha: 'Oson\'dan chiqarish — ' + x.n + ' mijoz', izoh: MIJOZ_NOM, onclick: () => ochTo('mijoz') });
    if (x.tur === 'muddat') {
      return ishQator({ icon: 'xato', rang: 'warn', sarlavha: x.n + ' bemor navbatda · ' + muddatMatn(x.t.qoldi),
        izoh: punktNom(x.t.punktId) + ' · ' + kunNom(x.t.kun) + ' · retsept 7 kun amal qiladi', onclick: () => ochTo({ punktId: x.t.punktId, kun: x.t.kun }, 'bemorlar') });
    }
    const [icon, rang, sarlavha, ich] = {
      rasm: ['rasm', 'warn', x.n + ' ta rasm ko\'rilmagan', 'bemorlar'],
      xato: ['xato', 'warn', x.n + ' bemorda xato — tuzating', 'bemorlar'],
      orash: ['quti', '', 'O\'rash — ' + x.n + ' bemor', 'orash'],
      oson: ['chiqar', 'info', 'Oson\'dan chiqarish — ' + x.n + ' bemor', 'oson'] }[x.tur];
    return ishQator({ icon, rang, sarlavha, izoh: punktNom(x.t.punktId) + ' · ' + kunNom(x.t.kun), onclick: () => ochTo({ punktId: x.t.punktId, kun: x.t.kun }, ich) });
  };
  m.append(h('div', { class: 'bolim-bosh' }, h('h2', {}, 'Bajarish kerak'), h('span', { class: 'muted' }, ishlar.length ? ishlar.length + ' ta' : '')));
  m.append(ishlar.length ? h('div', { class: 'card ishlar' }, ...ishlar.map(ish)) : h('div', { class: 'card muted' }, '✓ Hozircha bajariladigan ish yo\'q'));
  if (R.punktlar.length) m.append(h('button', { onclick: () => qogozSheet(ctx, t.qilX) }, '+ Qog\'ozdan kiritish (punkt o\'zi olib keldi)'));

  const ochiq = ts.filter((x) => !x.tugadi), tugagan = ts.filter((x) => x.tugadi);
  const mijozOchiq = mj.qolgan.length > 0, mijozBor = mijozlar.length > 0;
  m.append(h('div', { class: 'bolim-bosh' }, h('h2', {}, 'Punkt ro\'yxatlari'),
    h('button', { class: 's', style: 'flex:none;min-height:44px', onclick: t.yangila }, 'Yangilash')));
  m.append(pills([['ochiq', 'Ochiq · ' + (ochiq.length + (mijozOchiq ? 1 : 0))], ['tugagan', 'Tugagan · ' + (tugagan.length + (mijozBor && !mijozOchiq ? 1 : 0))]],
    boshKor, (v) => { boshKor = v; ctx.rerender(); }, 'Ro\'yxatlar'));
  m.append(jonliBelgi());
  const kor = (boshKor === 'tugagan' ? tugagan : ochiq).slice()
    .sort((a, b) => (a.kun < b.kun ? 1 : a.kun > b.kun ? -1 : punktNom(a.punktId).localeCompare(punktNom(b.punktId))));
  const mijozKor = boshKor === 'tugagan' ? mijozBor && !mijozOchiq : mijozOchiq;
  if (!kor.length && !mijozKor) {
    m.append(h('div', { class: 'card muted' }, boshKor === 'tugagan' ? 'Tugagan ro\'yxat yo\'q.'
      : ts.length ? '✓ Hamma ro\'yxat tugagan — «Tugagan»da.' : 'So\'nggi 7 kunda punktlardan ro\'yxat kelmagan.'));
  }
  kor.forEach((x) => m.append(toplamKarta(x, punktNom(x.punktId), ochTo)));
  if (mijozKor) m.append(mijozKarta(mj, mijozlar.length, ochTo, mijozlar.filter((z) => !faqatOddiy(z)).length));

  m.append(h('div', { class: 'plitkalar', style: 'margin-top:4px' },
    ...[['partiya', 'Partiyalar', 'Seriya va muddatlar'], ['hisobot', 'Hisobot', 'Berilgan dorilar'],
      ctx.x.rol === 'direktor' ? ['punktlar', 'Punktlar', 'Qo\'shish, havola'] : null].filter(Boolean)
      .map(([e, l, n]) => h('button', { type: 'button', class: 'plitka', onclick: () => ochTo(e) }, h('b', {}, l), h('span', { class: 'muted' }, n)))));
  m.append(yordam('Punkt botga ro\'yxatni matn, rasm yoki QR kodli rasm qilib yuboradi — shu yerda karta bo\'lib chiqadi. Kompyuter DMED\'da beradi, '
    + 'keyin o\'raysiz va Oson Apteka\'dan chiqarasiz: kartadagi tugma doim keyingi ishni ko\'rsatadi. Hamma ma\'lumot 7 kundan keyin o\'chadi.'));
}

function toplamKarta(t, nom, ochTo) {
  const ochish = (ich) => ochTo({ punktId: t.punktId, kun: t.kun }, ich);
  // Hech biriga berilmagan (hammasi «chiqmadi») — keyingi bosqichlar bajarilgan emas.
  const qd = (n) => (t.qadam === n ? 'hoz' : t.qadam > n && t.berilgan ? 'bor' : 'yoq');
  const k = keyingiIsh(t);
  const osonJami = t.berilgan - t.oddiy;   // faqat oddiy retsept dorisi berilganlar Oson'dan chiqarilmaydi
  const izoh = [t.navbat ? 'Kompyuterda berilmoqda: ' + t.navbat + ' navbatda' : null, t.ochilmadi ? t.ochilmadi + ' tasi DMED\'da chiqmadi' : null].filter(Boolean).join(' · ');
  const ogoh = [t.rasm ? t.rasm + ' rasm ko\'rilmagan' : null, t.xatoli ? t.xatoli + ' bemorda xato' : null].filter(Boolean).join(' · ');
  return h('div', { class: 'card toplam' },
    h('button', { type: 'button', class: 'toplam-s', onclick: () => ochish('bemorlar') },
      h('b', { 'data-asl': '' }, nom + ' · ' + kunNom(t.kun)), h('span', { class: 'muted' }, t.jami + ' bemor ›')),
    t.jami ? bosqichlar([['Ro\'yxat keldi', '', 'bor'], ['DMED\'da berildi', t.berilgan + '/' + t.jami, qd(2)],
      ['O\'raldi', t.berilgan ? (t.berilgan - t.oralmagan) + '/' + t.berilgan : '', qd(3)], ['Oson', osonJami ? (osonJami - t.osonsiz) + '/' + osonJami : '', qd(4)]])
      : h('span', { class: 'muted' }, t.tugadi ? 'Faqat rasm yoki xabar keldi — bemor kiritilmagan' : 'Xabar keldi, bemorlar hali ajratilmagan — oching'),
    izoh ? h('span', { class: 'muted' }, izoh) : null,
    t.qoldi != null ? h('span', { class: 'toplam-ogoh', role: 'note' }, '⏳ ' + muddatMatn(t.qoldi) + ' — navbatdagi ' + t.navbat + ' bemorni tezroq bering') : null,
    ogoh ? h('span', { class: 'toplam-ogoh' }, ogoh) : null,
    t.tugadi && t.berilgan ? h('span', { class: 'toplam-tayyor' }, '✓ Tugadi') : null,
    t.tugadi && t.jami && !t.berilgan ? h('span', { class: 'toplam-ogoh' }, 'Hech biriga berilmadi — punktga xabar bering («Boshqa amallar»)') : null,
    k ? h('button', { type: 'button', class: 'p', onclick: () => ochish(k[0]) }, k[1]) : null);
}

// jami — berilgan mijozlar; osonJami — ulardan Oson'dan chiqariladiganlari (faqat oddiy retsept dorisi berilganlar kirmaydi).
function mijozKarta(mj, jami, ochTo, osonJami = jami) {
  const qolgan = mj.qolgan.length;
  return h('div', { class: 'card toplam' },
    h('button', { type: 'button', class: 'toplam-s', onclick: () => ochTo('mijoz') }, h('b', {}, MIJOZ_NOM), h('span', { class: 'muted' }, jami + ' mijoz ›')),
    bosqichlar([['DMED\'da berildi', String(jami), 'bor'], ['Oson', (osonJami - qolgan) + '/' + osonJami, qolgan ? 'hoz' : 'bor']]),
    h('span', { class: 'muted' }, 'O\'z retsepti bilan kelgan mijozlar — punktlar bilan aralashmaydi'),
    qolgan ? h('button', { type: 'button', class: 'p', onclick: () => ochTo('mijoz') }, 'Oson jadvali — ' + qolgan + ' mijoz')
      : h('span', { class: 'toplam-tayyor' }, '✓ Hammasi Oson\'dan chiqarilgan'));
}

function punktView(m, ctx, tp, nom, t) {
  jonliBoshla(ctx);
  if (!['bemorlar', 'orash', 'oson'].includes(ichki)) ichki = 'bemorlar';
  m.append(orqaTugma(ctx));
  m.append(h('div', { class: 'punkt-bosh' }, h('h2', { class: 'bolim-s', 'data-asl': '' }, nom + ' · ' + kunQisqa(tp.kun)),
    h('div', { class: 'muted' }, tp.jami + ' bemor · ro\'yxat ' + vaqt(tp.vaqt) + ' da keldi')));
  m.append(pills([['bemorlar', 'Bemorlar'], ['orash', 'O\'rash' + (tp.oralmagan ? ' · ' + tp.oralmagan : '')], ['oson', 'Oson' + (tp.osonsiz ? ' · ' + tp.osonsiz : '')]],
    ichki, (v) => { ichki = v; ctx.rerender(); }, 'Bo\'lim'));
  m.append(jonliBelgi());
  if (ichki === 'orash') orashView(m, ctx, tp);
  else if (ichki === 'oson') osonPunkt(m, ctx, tp, nom);
  else m.append(bemorlarKarta(tp, ctx, t.qil, t.qilX));
  const amallar = amallarRoyxati(tp, nom, ctx, t.qil);
  m.append(h('div', { class: 'grid2' }, h('button', { class: 's', onclick: t.yangila }, 'Yangilash'),
    amallar.length ? h('button', { class: 's', onclick: () => sheet(nom + ' · ' + kunQisqa(tp.kun), (box, close) => box.append(
      ...amallar.flatMap(([l, f, izoh]) => [h('button', { onclick: () => { close(); f(); } }, l),
        izoh ? h('div', { class: 'muted', style: 'font-size:13px;margin:-4px 0 4px' }, izoh) : null].filter(Boolean)))) }, 'Boshqa amallar') : null));
}

// «Punktga xabar: tayyor» matni — server punktga_xabar bilan bir xil (tasdiq oynasida aynan nima borishi ko'rinsin).
export function punktXabarMatni(bemorlar, kun, apteka = '') {
  const jami = bemorlar.length, tayyor = bemorlar.filter(berilganmi).length, olindi = bemorlar.filter((z) => z.holat === 'olindi').length;
  const ochilmagan = bemorlar.filter((z) => z.holat === 'ochilmadi').sort((a, b) => a.n - b.n)
    .map((z) => z.n + ') ' + (z.ism || 'ismsiz') + ' — ' + (z.sabab || ''));
  return (apteka ? apteka + '\n' : '') + kunQisqa(kun) + ' ro\'yxat: ' + jami + ' tadan ' + tayyor + ' tasi tayyor'
    + (olindi ? ' (' + olindi + ' tasi olib ketildi)' : '') + (tayyor > olindi ? '.\n✅ Tayyor — olib ketishingiz mumkin.' : '.')
    + (ochilmagan.length ? '\nOchilmadi:\n' + ochilmagan.join('\n') : '');
}
// Shu telefonda yuborilgan «tayyor» xabarlar (punkt|kun → vaqt): qayta bosilsa — ogohlantiriladi (har bosish yangi xabar).
const xabarYuborilgan = new Map();

// Kam ishlatiladigan amallar — «Boshqa amallar» oynasida.
function amallarRoyxati(tp, nom, ctx, qil) {
  const b = tp.bemorlar;
  const xk = tp.punktId + '|' + tp.kun;
  // Audit 10.11: «tayyor» xabari — matnni ko'rsatib tasdiq; shu telefondan oldin yuborilgan bo'lsa — aytiladi.
  const xabarYubor = async () => {
    const oldin = xabarYuborilgan.get(xk);
    // Telegram tasdiq oynasi 250 belgidan keyin kesadi — avval savol, keyin xabar matni.
    const ha = await tasdiqlash((oldin ? 'Bu xabar ' + vaqt(oldin) + ' da yuborilgan edi — yana yuborilsa, punktga ikkinchi xabar boradi. ' : '')
      + nom + ' punktiga yuborilsinmi?\n\n' + punktXabarMatni(b, tp.kun));
    if (!ha) return;
    const r = await qil('punktgaXabar', tp.punktId, tp.kun);
    if (r) { xabarYuborilgan.set(xk, Date.now()); ctx.toast('Punktga yuborildi ✓'); }
  };
  return [
    tp.navbat ? ['Hammasi berildi (qog\'ozda berilgan)', () => tasdiqlash('Navbatdagi (xatosiz) hamma bemorlar "Berildi" bo\'lsinmi? Diqqat: aptekadagi kompyuter ularni endi DMED\'da OCHMAYDI va dorilari yozilmaydi — faqat dori DMED\'siz (qog\'ozda) berilgan bo\'lsa bosing.').then((ha) => ha && qil('bemorlarHammasi', tp.punktId, tp.kun, 'berildi'))] : null,
    b.some((z) => z.holat === 'berildi') ? ['Hammasini punkt olib ketdi', () => tasdiqlash('Berilganlarning hammasini punkt olib ketdimi?').then((ha) => ha && qil('bemorlarHammasi', tp.punktId, tp.kun, 'olindi'))] : null,
    b.length ? ['Punktga xabar: «tayyor»', xabarYubor] : null,
    // 28.10: direktorga shu punkt + kunning to'liq ro'yxati (JSHSHIR, kod, MNN, doza, soni, berilmadi/chiqmadi, izoh) — Telegram'ga.
    // Audit 10.11: fayl chatda muddatsiz qoladi — izoh.
    ctx.x.rol === 'direktor' && b.length ? ['Excel (to\'liq) — Telegram\'ga', () => ctx.amal('punktRoyxatExcel', tp.punktId, tp.kun)
      .then((r) => r && ctx.toast('Excel Telegram\'ga yuborildi ✓ — olib ketilgach chatdan o\'chiring')),
    'Faylda to\'liq JSHSHIR va kodlar bor. Fayl chatda qoladi — punkt olib ketgach uni chatdan o\'chiring.'] : null
    // 10.11: «Kengaytma uchun nusxa» olib tashlandi — kengaytma ro'yxatni serverdan o'zi oladi (0.6.0), telefon to'liq JSHSHIR olmaydi.
  ].filter(Boolean);
}

function bemorlarKarta(tp, ctx, qil, qilX) {
  const b = tp.bemorlar;
  const c = (hl) => b.filter((z) => z.holat === hl).length;
  const card = h('div', { class: 'card list' },
    // Dizayn A (29.10): jarayon chizig'i (yashil — berildi/olib ketildi, qizil — chiqmadi) va holat belgilari.
    h('div', { class: 'jarayon', role: 'img', 'aria-label': (c('berildi') + c('olindi')) + ' ta berildi, ' + c('ochilmadi') + ' ta chiqmadi, ' + c('navbat') + ' ta navbatda' },
      h('i', { style: 'width:' + (b.length ? (c('berildi') + c('olindi')) / b.length * 100 : 0) + '%;background:var(--kirim)' }),
      h('i', { style: 'width:' + (b.length ? c('ochilmadi') / b.length * 100 : 0) + '%;background:var(--chiqim)' })),
    h('div', { class: 'belgilar' },
      c('berildi') ? h('span', { class: 'belgi ok' }, c('berildi') + ' berildi') : null,
      c('olindi') ? h('span', { class: 'belgi ok' }, c('olindi') + ' olib ketildi') : null,
      c('ochilmadi') ? h('span', { class: 'belgi yoq' }, c('ochilmadi') + ' chiqmadi') : null,
      c('navbat') ? h('span', { class: 'belgi nav' }, c('navbat') + ' navbatda') : null,
      tp.xatoli ? h('span', { class: 'belgi ogoh' }, tp.xatoli + ' tasida xato') : null,
      // Kim nechta berdi (kompyuter / qo'lda) — faqat berilganlar bo'lsa.
      ...[...b.reduce((mp, z) => { const k = berdiMatn(z); if (k) mp.set(k, { z, n: (mp.has(k) ? mp.get(k).n : 0) + 1 }); return mp; }, new Map()).values()]
        .map(({ z, n }) => h('span', { class: 'belgi kim' }, ...berdiQism(z), ': ' + n))));

  // Rasmlar: ko'rilmaganlari ajralib turadi.
  tp.xabarlar.filter((z) => z.tur === 'rasm').forEach((z) => {
    const kor = rasmKorilganmi(z, korilganRasm);
    card.append(h('div', { class: 'item' },
      h('div', { class: 'line', style: 'border:0;padding:0' }, h('span', {}, 'Rasm · ' + vaqt(z.ts) + (z.matn ? ' · izoh bor' : '')),
        h('span', { style: 'color:' + (kor ? 'var(--accent)' : 'var(--warn)') + ';font-weight:600' }, kor ? 'Ko\'rildi ✓' : 'Ko\'rilmagan')),
      z.qr ? h('div', { class: 'muted', style: 'word-break:break-all' }, 'QR: ' + qrNiqob(z.qr).slice(0, 160)) : null,
      h('button', { class: kor ? 's' : 'p s', style: 'align-self:flex-start', onclick: () => rasmSheet(z, ctx, qil, qilX) }, kor ? 'Rasmni ko\'rish' : 'Ochish')));
  });

  if (!b.length && !tp.xabarlar.some((z) => z.tur === 'rasm')) card.append(h('div', { class: 'muted' }, 'Xabar keldi, lekin bemor topilmadi.'));
  b.slice().sort((a, z) => a.n - z.n).forEach((z) => {
    const [l, col] = HOLAT[z.holat] || [z.holat, 'var(--muted)'];
    card.append(h('button', { class: 'item', style: 'text-align:left;background:none;border-radius:0;padding:10px 0;height:auto;display:flex;flex-direction:column;align-items:stretch;gap:2px;font-weight:400',
      onclick: () => bemorSheet(z, ctx, qil, qilX) },
      h('div', { class: 'line', style: 'border:0;padding:0' }, h('span', { style: 'font-weight:600', 'data-asl': '' }, z.n + ') ' + (z.ism || 'Ismsiz')), h('span', { style: 'color:' + col + ';white-space:nowrap;font-weight:600' }, l)),
      h('span', { class: 'muted' }, bemorQatori(z) + (z.sabab ? ' · ' + z.sabab : '')),
      berdiBelgi('span', z),
      ismOgoh(z) ? h('span', { style: 'color:var(--warn);font-size:13px;font-weight:600' }, '⚠ Ism mos emas — ro\'yxatda: ', h('span', { 'data-asl': '' }, z.yozilgan)) : null,
      z.xato && z.xato.length ? h('span', { style: 'color:var(--warn);font-size:13px;font-weight:600' }, 'Xato: ' + z.xato.join(', ')) : null));
  });
  return card;
}

// Qadoqlash: berilgan bemorlar — har biriga berilgan dorilar; qog'ozga o'ragach "O'raldi ✓". Belgi serverda saqlanadi.
// Bir necha xodim birga o'raydi: ekran ochiq turganda har 5 soniyada belgilar (qadoq_holat — yengil, JSHSHIR va kodlarsiz)
// olinadi — boshqa xodim qo'ygan belgi kim qo'ygani bilan shu telefonda ham chiqadi. Tartib raqam bo'yicha, belgi qo'yilganda qatorlar sakramaydi.
// Dori nomi — ta'sir etuvchi modda va doza ("Asetilsalitsil kislotasi 150 mg"; foydalanuvchi: "Trombopol emas"). Kengaytma xpn'da
// shuni yuboradi; xpn bo'lmasa — "Modda nomi yo'q" (savdo nomi emas). Savdo nomi (bergan dorimiz) hech qayerda ko'rsatilmaydi.
const doriNomi = (d) => (d.xpn && String(d.xpn).trim().length > 1 ? String(d.xpn).trim() : 'Modda nomi yo\'q');
const doriMatni = (d) => doriNomi(d) + (d.berilmadi ? ' — berilmadi' : d.soni != null ? ' — ' + d.soni + ' dona' : '')
  // 10.11: reimbursatsiya partiyalarida yo'q modda — oddiy retsept (kassa orqali sotiladi), Oson'dan chiqarishga qo'shilmaydi.
  + (d.oddiy && !d.berilmadi ? ' · oddiy retsept — Oson\'dan chiqarilmaydi' : '');
const JONLI = 5e3;
let jonli = null;          // setInterval
let jonliCtx = null;
let jonliBand = false;
let jonliVaqt = 0;         // oxirgi muvaffaqiyatli yangilanish
let kechikkan = false;     // o'zgarish bor, lekin foydalanuvchi aylantirayotgan edi — keyingi navbatda chiziladi
const kutilmoqda = new Set();   // shu telefonda bosilgan, server javobi kelmagan bemorlar — jonli yangilanish ularga tegmaydi
let mahalliyVaqt = 0;           // oxirgi o'z belgimiz serverga yetgan payt: undan oldin boshlangan so'rov javobi e'tiborsiz
let aylanish = 0;               // foydalanuvchi sahifani aylantirgan/tekkan payt — shu payt qayta chizilmaydi
if (typeof window !== 'undefined') ['scroll', 'touchstart', 'touchmove'].forEach((t) => window.addEventListener(t, () => { aylanish = Date.now(); faol = Date.now(); }, { passive: true }));
// Audit 06.11: ekran ochiq qolib, hech kim tegmasa — 5 daqiqadan keyin jonli so'rovlar to'xtaydi (har 5 s so'rov Supabase bepul
// chegarasini — oyiga 500 ming — tugatib qo'ymasin); tegilishi bilan (bosish, aylantirish, yozish) yana boshlanadi.
const JIM = 5 * 60e3;
let faol = Date.now();
if (typeof window !== 'undefined') ['pointerdown', 'keydown'].forEach((t) => window.addEventListener(t, () => { faol = Date.now(); }, { passive: true }));

function jonliYangila() {
  if (!jonliCtx || jonliBand || yuklanmoqda) return;
  jonliBand = true;
  const boshlandi = Date.now();
  jonliCtx.oqi('qadoqHolat').then((list) => {
    if (boshlandi < mahalliyVaqt) return;
    jonliVaqt = Date.now();
    if (qadoqQosh(list)) { if (Date.now() - aylanish > 1200) jonliCtx.rerender(); else kechikkan = true; }
  }, () => {})
    .finally(() => { jonliBand = false; });
}
function jonliBoshla(ctx) {
  jonliCtx = ctx;
  faol = Date.now();
  if (jonli) return;
  jonli = setInterval(() => {
    // Qadoqlash ekrani yopilgan — to'xtaymiz; ilova fonda — so'rov yubormaymiz.
    if (!document.getElementById('qadoq-jonli')) { clearInterval(jonli); jonli = null; return; }
    if (document.hidden) return;
    if (Date.now() - faol > JIM) return;   // hech kim ishlatmayapti
    if (kechikkan && Date.now() - aylanish > 1200) { kechikkan = false; jonliCtx.rerender(); }
    // Bosh ekran va «Bemorlar» — yangi ro'yxat va navbatdagi bemorlar ham kerak: 30 s da bir marta to'liq ro'yxat (yengil so'rov
    // ularni bermaydi); foydalanuvchi aylantirayotgan paytda emas. O'rash, Oson, mijozlar — har 5 s yengil belgilar.
    if (toliqYuklash()) { if (!yuklanmoqda && Date.now() - yuklandi > ESKIRISH && Date.now() - aylanish > 1200) yukla(jonliCtx); return; }
    jonliYangila();
  }, JONLI);
}
// Kelgan belgilarni ro'yxatga qo'shish. Yangi berilgan yoki navbatga qaytarilgan bemor bo'lsa — to'liq ro'yxat qayta olinadi.
function qadoqQosh(list) {
  if (!R || !Array.isArray(list)) return false;
  const byId = new Map(R.bemorlar.map((z) => [z.id, z]));
  const ids = new Set(list.map((y) => y.id));
  let ozgardi = false;
  list.forEach((y) => {
    const z = byId.get(y.id);
    if (!z || kutilmoqda.has(y.id)) return;
    ['holat', 'oraldi', 'oraldiKim', 'oson', 'osonKim', 'berdi', 'qolda'].forEach((k) => { if (z[k] !== y[k]) { if (y[k] == null) delete z[k]; else z[k] = y[k]; ozgardi = true; } });
    if (JSON.stringify(z.dorilar || null) !== JSON.stringify(y.dorilar || null)) { z.dorilar = y.dorilar; ozgardi = true; }
  });
  if (list.some((y) => !byId.has(y.id)) || R.bemorlar.some((z) => (z.holat === 'berildi' || z.holat === 'olindi') && !ids.has(z.id))) yukla(jonliCtx);
  return ozgardi;
}

// Partiyalar (26.10): kompyuterlardagi kengaytma ro'yxati serverda sinxron — shu yerda faqat ko'rish (tahrirlash — kompyuterda,
// kengaytmaning "Partiyalar" sahifasida). Muddati o'tgan va 30 kun ichida tugaydigani yuqorida, ajratilgan.
let PART = null, partXato = null, partYuklanmoqda = false, partVaqt = 0;
// 07.11 (20261107180000_narx_kassa_partiya): har partiya — Oson'dagi dori, qoldiq, bir donasi qimmatroq analog, ogohlantirish.
let NAZ = null, nazXato = null, narxBand = false;
export function partiyaUnut() { PART = null; partXato = null; partYuklanmoqda = false; partVaqt = 0; NAZ = null; nazXato = null; narxBand = false; }
const muddatKun = (s) => {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(String(s || '').trim());
  if (!m) return null;
  const t = Date.UTC(+m[3], +m[2] - 1, +m[1]), dt = new Date(t);
  if (dt.getUTCDate() !== +m[1] || dt.getUTCMonth() !== +m[2] - 1) return null;   // 31.02 — sana noto'g'ri
  return Math.floor((t - Date.parse(H.kunKey(Date.now()))) / 864e5);
};
function partiyaOson(ctx, z, direktor) {
  if (!z) return [];
  const el = [];
  const mos = z.mos.slice(0, 3);
  if (mos.length) {
    // Bir nomli generiklar (Navbahor, Radiks…) — ishlab chiqaruvchisi bilan ajraladi.
    el.push(h('div', { class: 'muted', style: 'font-size:13px' }, 'Oson\'da: ', ...mos.map((d, i) => h('span', {}, i ? '; ' : '', h('span', { 'data-asl': '' }, d.nom),
      z.mos.length > 1 && d.ishlab ? h('span', { 'data-asl': '' }, ' (' + String(d.ishlab).split(',')[0].replace(/\s*\(.*$/, '') + ')') : null,
      ' · ' + (Number(d.soni) > 0 ? qoldiqMatn(d.soni, d.dona) : 'qoldiq yo\'q') + (d.narx ? ' · ' + H.som(d.narx) : ''))),
    z.mos.length > 3 ? ' va yana ' + (z.mos.length - 3) + ' ta' : ''));
  }
  if (z.ogoh.includes('topilmadi')) el.push(h('div', { class: 'oson-otgan' }, 'Oson\'da bu nom topilmadi — Oson\'dagi nomi boshqacha bo\'lishi mumkin. Dori yo\'q bo\'lsa — partiyani kompyuterda to\'xtating.'));
  if (z.ogoh.includes('qoldiqsiz')) el.push(h('div', { class: 'oson-otgan' }, 'Oson\'da qoldiq yo\'q — berib bo\'lmaydi: boshqa partiyani faollashtiring yoki buni to\'xtating.'));
  if (z.ogoh.includes('narxsiz')) el.push(h('div', { class: 'muted', style: 'font-size:13px' }, 'Narx yozilmagan — bir modda va dozada bir nechta faol partiya bo\'lsa, kompyuter qaysi birini berishni so\'raydi.'));
  if (direktor) el.push(h('button', { class: 'link', onclick: () => partiyaNarxOyna(ctx, z) }, z.narx != null ? 'Narxni o\'zgartirish' : 'Narx yozish'));
  return el;
}
// Guruh (modda + doza) oxirida: faol partiyalar o'rniga bizda bor, bir donasi qimmatroq dorilar.
function qimmatroq(zs) {
  const bor = new Map();
  let ehtiyot = false;
  zs.forEach((z) => { if (z.ehtiyot) ehtiyot = true; z.analoglar.forEach((a) => { if (!bor.has(a.g)) bor.set(a.g, a); }); });
  if (ehtiyot && !bor.size) return [h('div', { class: 'muted', style: 'font-size:13px;margin-top:6px' }, 'Bu moddada brend almashtirish tavsiya etilmaydi — qimmatroq analog taklif qilinmaydi.')];
  if (!bor.size) return [];
  const rows = [...bor.values()].sort((a, b) => (b.dn || 0) - (a.dn || 0));
  return [h('div', { class: 'nz-qimmat' }, h('b', {}, 'Bizda qimmatroq (shu modda, shakl, doza):'),
    ...rows.map((a) => h('div', { class: 'line', style: 'padding:4px 0' }, h('span', {}, h('span', { 'data-asl': '' }, a.nom),
      h('span', { class: 'muted' }, ' · ' + qoldiqMatn(a.soni, a.dona) + ' · ' + H.som(a.narx))),
      h('b', { style: 'white-space:nowrap' }, H.som(a.dn) + '/dona' + (a.foiz != null ? ' (+' + a.foiz + '%)' : '')))),
    rows.some((a) => a.foiz == null) ? h('div', { class: 'muted', style: 'font-size:13px' }, 'Partiya dorisi Oson\'da topilmadi — narxi bilan solishtirilmadi, bizdagi shu modda va dozadagi dorilar.') : null)];
}
function partiyaNarxOyna(ctx, z) {
  sheet('Partiya narxi', (box, close) => {
    // 1 dona (tabletka) narxi — Qimmat dori rejimi har xil qadoqli partiyalarni shu bo'yicha solishtiradi (tekshiruv 07.11).
    const f = input('1 dona (tabletka) narxi, so\'m', { placeholder: z.taklif ? H.som(z.taklif) : '600', enterkeyhint: 'done' });
    f.qiymat(z.narx != null ? String(z.narx) : z.taklif != null ? String(Math.round(z.taklif)) : '');
    f.i.defaultValue = f.i.value;   // oldindan qo'yilgan qiymat — yopishda «yozganlaringiz o'chadi» deb so'ralmasin
    let band = false;
    // v === null — faqat «Narxni o'chirish»; bo'sh yoki noto'g'ri yozuv — xato (narx o'chib ketmasin).
    const saqla = async (v) => {
      if (band) return;
      const n = v == null ? null : H.pul(v);
      if (v != null && !(n > 0)) { f.xato('Narxni yozing — masalan: 600'); return; }
      // Ortiqcha nol yoki quti narxi yozilsa (Oson'dagi 1 dona narxidan 3 baravar farq) — so'raladi.
      if (n != null && z.taklif > 0 && (n > 3 * z.taklif || n < z.taklif / 3)
        && !(await tasdiqlash(H.som(n) + ' — Oson\'dagi 1 dona narxidan (' + H.som(z.taklif) + ') ancha farq qiladi. Quti emas, 1 dona narxini yozing. Shu narx to\'g\'rimi?'))) return;
      band = true;
      try {
        const r = await ctx.amalFon('partiyaNarx', z.id, n == null ? null : String(n));
        if (r != null) { ctx.toast(n == null ? 'Narx o\'chirildi' : 'Saqlandi ✓ — kompyuterlar bir necha daqiqada oladi'); partVaqt = 0; close(); ctx.rerender(); }
      } finally { band = false; }
    };
    box.append(h('b', { 'data-asl': '' }, z.savdoNomi || ''), h('div', { class: 'muted' }, (z.xpn || '') + ' · ' + (z.doza || '')),
      z.taklif != null ? h('div', { class: 'muted', style: 'margin:8px 0' }, 'Oson bo\'yicha 1 dona: ' + H.som(z.taklif)) : null,
      f.el, h('button', { class: 'p', onclick: () => saqla(f.i.value) }, 'Saqlash'),
      z.narx != null ? h('button', { class: 'link', onclick: () => saqla(null) }, 'Narxni o\'chirish') : null,
      h('div', { class: 'muted', style: 'font-size:13px;margin-top:8px' }, 'Qimmat dori rejimi: bir modda va dozada bir nechta faol partiya bo\'lsa — kompyuter 1 dona narxi balandini beradi. Hamma partiyaga 1 dona narxini yozing.'));
    f.i.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); saqla(f.i.value); } });
  }, { fokus: false });
}
function partiyaView(m, ctx) {
  // Audit 07.11: xatodan keyin 1 daqiqa kutiladi («Qayta urinish» — darhol); aks holda chizish → so'rov → xato → chizish to'xtovsiz.
  if (!partYuklanmoqda && ((!PART && !partXato) || Date.now() - partVaqt > 60000)) {
    partYuklanmoqda = true;
    Promise.all([
      ctx.oqi('partiyalar').then((r) => { PART = Array.isArray(r) ? r : []; partXato = null; }, (e) => { partXato = (e && e.message) || 'Ochilmadi'; }),
      ctx.server ? ctx.oqi('partiyaNazorat').then((r) => { NAZ = r && Array.isArray(r.partiyalar) ? r : null; nazXato = NAZ ? null : 'Server javobi tushunarsiz'; },
        (e) => { nazXato = (e && e.message) || 'Olinmadi'; }) : null])
      .finally(() => { partYuklanmoqda = false; partVaqt = Date.now(); ctx.rerender(); });
  }
  m.append(yordam('Partiyalar aptekadagi kompyuterda kiritiladi (kengaytma → "Partiyalar") va hamma kompyuterda bir xil bo\'ladi. Bu yerda — ko\'rish: qaysi dori qaysi seriya bilan yoziladi, muddati qachon tugaydi, Oson\'da bormi va bizda qimmatroq analogi bormi. Direktor partiya narxini shu yerda yozishi mumkin.'));
  const qayta = () => { partVaqt = 0; PART = PART || null; partXato = null; ctx.rerender(); };
  if (partXato) m.append(h('div', { class: 'msg warn', role: 'status' }, 'Partiyalar ochilmadi: ' + partXato + ' ', h('button', { class: 's', onclick: qayta }, 'Qayta urinish')));
  if (!PART) { m.append(h('div', { class: 'card muted' }, partXato ? 'Ochilmadi.' : 'Yuklanmoqda…')); return; }
  m.append(h('button', { class: 's', style: 'align-self:flex-start', onclick: qayta }, partYuklanmoqda ? 'Yangilanmoqda…' : 'Yangilash'));
  if (!PART.length) { m.append(h('div', { class: 'card muted' }, 'Hali partiya yo\'q. Aptekadagi kompyuterda kengaytmaning "Partiyalar" sahifasida kiriting — server kaliti kiritilgan bo\'lsa, shu yerda bir daqiqada paydo bo\'ladi.')); return; }
  const list = PART.map((p) => ({ p, kun: muddatKun(p.yaroqlilik) }));
  const otgan = list.filter((x) => x.p.faol !== false && x.kun != null && x.kun < 0);
  const yaqin = list.filter((x) => x.p.faol !== false && x.kun != null && x.kun >= 0 && x.kun <= 30);
  m.append(h('div', { class: 'card hero' }, h('div', { class: 'line', style: 'border:0' }, h('span', { class: 'muted' }, 'Faol partiyalar'),
    h('b', { class: 'big' }, String(list.filter((x) => x.p.faol !== false && !(x.kun != null && x.kun < 0)).length))),
    h('div', { class: 'muted' }, (otgan.length ? otgan.length + ' tasining muddati o\'tgan (ishlatilmaydi) · ' : '') + (yaqin.length ? yaqin.length + ' tasi 30 kunda tugaydi' : 'Muddati yaqin partiya yo\'q'))));
  const nz = new Map(((NAZ && NAZ.partiyalar) || []).map((z) => [z.id, z]));
  const direktor = ctx.x && ctx.x.rol === 'direktor';
  if (nazXato) m.append(h('div', { class: 'msg info' }, 'Oson qoldig\'i bilan solishtirib bo\'lmadi: ' + nazXato));
  if (NAZ) {
    const faol = NAZ.partiyalar.filter((z) => z.faol);
    const yoq = faol.filter((z) => z.ogoh.includes('topilmadi') || z.ogoh.includes('qoldiqsiz')).length;
    const narxsiz = faol.filter((z) => z.ogoh.includes('narxsiz')).length;
    const yoziladi = faol.filter((z) => z.narx == null && z.taklif != null).length;
    const qimmat = faol.filter((z) => z.analoglar.length && z.analoglar.some((a) => a.foiz != null)).length;
    m.append(h('div', { class: 'card' }, kartaSarlavha('Oson qoldig\'i bilan'),
      h('div', { class: yoq ? 'oson-otgan' : 'muted' }, yoq ? '⚠️ ' + yoq + ' ta faol partiya dorisi Oson\'da yo\'q yoki tugagan — pastda qizil yozuv bilan' : '✓ Faol partiyalar dorisi Oson\'da bor'),
      narxsiz ? h('div', { class: 'muted' }, narxsiz + ' ta partiyada narx yo\'q, bir modda va dozada bir nechta faol partiya — Qimmat dori rejimi har safar so\'raydi') : null,
      qimmat ? h('div', { class: 'muted' }, qimmat + ' ta partiya o\'rniga bizda bir donasi qimmatroq dori bor — pastda «Bizda qimmatroq»') : null,
      direktor && yoziladi ? h('button', { class: 's', disabled: narxBand ? '' : null, onclick: async () => {
        if (narxBand || !(await tasdiqlash(yoziladi + ' ta partiyaga Oson\'dagi 1 dona narxi yozilsinmi? Kompyuterlar bir necha daqiqada oladi.'))) return;
        narxBand = true; ctx.rerender();
        try {
          const r = await ctx.amalFon('partiyaNarxOson');
          // Audit 07.11: tarmoq qayta yuborsa server «takror» qaytaradi (son emas).
          if (r && r.takror) ctx.toast('Avvalgi urinishda saqlangan ✓');
          else if (typeof r === 'number') ctx.toast(r + ' ta partiyaga narx yozildi ✓');
          if (r != null) partVaqt = 0;
        } finally { narxBand = false; ctx.rerender(); }
      } }, narxBand ? 'Yozilmoqda…' : 'Narxi yo\'qlarga Oson narxini yozish — 1 dona (' + yoziladi + ' ta)') : null));
  }
  const holat = (x) => x.p.faol === false ? ['To\'xtatilgan', 'var(--muted)']
    : x.kun == null ? ['Sana noto\'g\'ri', 'var(--warn)'] : x.kun < 0 ? ['Muddati o\'tgan', 'var(--err, #B42318)']
      : x.kun <= 30 ? [x.kun === 0 ? 'Bugun tugaydi' : x.kun + ' kunda tugaydi', 'var(--warn)'] : ['Faol', 'var(--accent)'];
  const tartib = (x) => (x.p.faol === false ? 4 : x.kun != null && x.kun < 0 ? 0 : x.kun != null && x.kun <= 30 ? 1 : 2);
  // XPN + doza bo'yicha guruh: bitta moddaga bir nechta partiya bo'lsa (Trombopol va Kardiomagnil) — birga ko'rinadi.
  const guruh = new Map();
  list.sort((a, b) => tartib(a) - tartib(b) || String(a.p.xpn).localeCompare(String(b.p.xpn))).forEach((x) => {
    const k = String(x.p.xpn || '').trim() + ' ' + String(x.p.doza || '').trim();
    if (!guruh.has(k)) guruh.set(k, []);
    guruh.get(k).push(x);
  });
  guruh.forEach((xs, k) => {
    m.append(h('div', { class: 'card list' }, kartaSarlavha(k), ...xs.map((x) => {
      const [matn, rang] = holat(x);
      return h('div', { class: 'item', style: x.p.faol === false ? 'background:#F1F4F2' : '' },
        h('div', { class: 'line', style: 'border:0;padding:0' }, h('b', {}, x.p.savdoNomi || '—'), h('span', { style: 'color:' + rang + ';font-weight:600;white-space:nowrap' }, matn)),
        h('div', { class: 'muted' }, 'Seriya ' + (x.p.seriya || '—') + ' · ' + (x.p.ishlabChiqarilgan || '?') + ' – ' + (x.p.yaroqlilik || '?') + (x.p.narx ? ' · narx (1 dona): ' + x.p.narx + ' so\'m' : '')),
        ...partiyaOson(ctx, nz.get(x.p.id), direktor));
    }), ...qimmatroq(xs.map((x) => nz.get(x.p.id)).filter((z) => z && z.faol))));
  });
  if (NAZ) m.append(h('div', { class: 'muted' }, 'Oson\'dagi dori — partiya savdo nomining birinchi so\'zi va dozasi bo\'yicha topiladi. «Bizda qimmatroq» — shu modda, shakl va dozada bir donasi kamida 5% qimmat, qoldig\'i bor dori. Reimbursatsiyada berish uchun u DMED «Торговое название» ro\'yxatida chiqishi va kompyuterda partiya qilib kiritilishi kerak.'));
}

// Berilgan dorilar hisoboti (27.10): davr bo'yicha qaysi modda qancha berildi — jami va punktlar kesimida, Excel Telegram'ga.
// Ma'lumot serverda alohida saqlanadi (bemor ma'lumotisiz), 7 kundan keyin ham qoladi. Savdo nomi ko'rsatilmaydi.
let HIS = { kalit: '', list: null, xato: null, yuklanmoqda: false, davr: 'oy', vaqt: 0 };
function hisobotDavr(davr) {
  const bugun = H.kunKey(Date.now()), oy = bugun.slice(0, 7);
  if (davr === 'bugun') return [bugun, bugun, 'Bugun'];
  if (davr === 'hafta') return [H.kunQosh(bugun, -6), bugun, '7 kun'];
  if (davr === 'otgan') { const o = H.oyQosh(oy, -1); return [o + '-01', H.oyOxirgiKun(o), 'O\'tgan oy']; }
  return [oy + '-01', bugun, 'Shu oy'];
}
function hisobotView(m, ctx) {
  const [dan, gacha] = hisobotDavr(HIS.davr), kalit = dan + ':' + gacha;
  if ((HIS.kalit !== kalit || Date.now() - HIS.vaqt > 60000) && !HIS.yuklanmoqda) {
    HIS = { ...HIS, kalit, list: HIS.kalit === kalit ? HIS.list : null, xato: null, yuklanmoqda: true, vaqt: Date.now() };
    ctx.oqi('dorilarHisobot', dan, gacha).then((r) => { if (HIS.kalit === kalit) HIS.list = Array.isArray(r) ? r : []; },
      (e) => { if (HIS.kalit === kalit) HIS.xato = (e && e.message) || 'Ochilmadi'; })
      .finally(() => { HIS.yuklanmoqda = false; ctx.rerender(); });
  }
  m.append(yordam('Berilgan dorilar: qaysi ta\'sir etuvchi modda (doza bilan) qancha berilgani — jami va har punkt alohida. Ma\'lumot bemor ismi va kodlarisiz saqlanadi, 7 kundan keyin ham qoladi.'));
  m.append(pills([['bugun', 'Bugun'], ['hafta', '7 kun'], ['oy', 'Shu oy'], ['otgan', 'O\'tgan oy']], HIS.davr, (v) => { HIS.davr = v; ctx.rerender(); }, 'Davr'));
  m.append(h('div', { class: 'muted' }, sana(dan + 'T12:00:00+05:00') + (dan !== gacha ? ' — ' + sana(gacha + 'T12:00:00+05:00') : '')));
  if (HIS.xato) { m.append(h('div', { class: 'msg warn', role: 'status' }, 'Hisobot ochilmadi: ' + HIS.xato + ' ', h('button', { class: 's', onclick: () => { HIS.kalit = ''; ctx.rerender(); } }, 'Qayta urinish'))); return; }
  // Audit 07.11: davr almashtirilganda eski davr so'rovi hali kelmagan bo'lsa — eski ro'yxat yangi davr ostida ko'rinmasin.
  if (!HIS.list || HIS.kalit !== kalit) { m.append(h('div', { class: 'card muted' }, 'Yuklanmoqda…')); return; }
  if (!HIS.list.length) { m.append(h('div', { class: 'card muted' }, 'Bu davrda berilgan dori yo\'q.')); return; }
  // Server har punkt + XPN matni bo'yicha beradi — rus va o'zbek nomi (H.xpnGuruh) bu yerda bitta qatorga qo'shiladi (03.11).
  const qosh = (map, r) => {
    const nom = doriNomi(r), k = H.xpnGuruh(nom), j = map.get(k) || { nom, soni: 0, bemor: 0 };
    j.nom = H.xpnAfzal(j.nom, nom); j.soni += Number(r.soni) || 0; j.bemor += Number(r.bemor) || 0; map.set(k, j);
  };
  const jami = new Map();
  HIS.list.forEach((r) => qosh(jami, r));
  const qatorlar = [...jami.values()].sort((a, b) => b.soni - a.soni);
  m.append(h('div', { class: 'card list' }, kartaSarlavha('Jami · ' + qatorlar.length + ' xil dori'),
    ...qatorlar.map((j) => h('div', { class: 'line' }, h('span', {}, j.nom), h('b', { style: 'white-space:nowrap' }, j.soni + ' dona')))));
  const punktlar = new Map();
  HIS.list.forEach((r) => { const k = r.ichki ? MIJOZ_NOM : r.punkt; if (!punktlar.has(k)) punktlar.set(k, new Map()); qosh(punktlar.get(k), r); });
  punktlar.forEach((map, nom) => { const rows = [...map.values()].sort((a, b) => b.soni - a.soni);
    m.append(ochiladi(nom, rows.map((r) => h('div', { class: 'line' }, h('span', {}, r.nom), h('b', { style: 'white-space:nowrap' }, r.soni + ' dona'))),
      { k: 'hisobot-' + nom, cls: 'karta list', izoh: rows.reduce((a, r) => a + r.soni, 0) + ' dona' })); });
  // 07.11 tun: Telegram 8.0+ — to'g'ridan telefonga (bemor ma'lumoti yo'q hisobot); eski Telegram — avvalgidek bot orqali.
  m.append(...yuklashTugmalari(ctx, { tur: 'dorilar_excel', args: [dan, gacha], botga: () => ctx.amal('dorilarExcel', dan, gacha) }));
}

function orashView(m, ctx, tp) {
  const b = tp.bemorlar.filter(berilganmi);
  const oralgan = b.filter((z) => z.oraldi).length;
  m.append(h('div', { class: 'card hero' }, h('div', { class: 'line', style: 'border:0' }, h('span', { class: 'muted' }, 'O\'ralmagan'), h('b', { class: 'big' }, String(tp.oralmagan))),
    h('div', { class: 'muted' }, 'Berilgan: ' + b.length + ' · o\'ralgan: ' + oralgan
      + (b.length - oralgan - tp.oralmagan ? ' · o\'ralmay olib ketilgan: ' + (b.length - oralgan - tp.oralmagan) : ''))));
  if (!b.length) { m.append(h('div', { class: 'card muted' }, 'Hali dori berilmagan. Kompyuter DMED\'da berganda shu yerda chiqadi.')); return; }
  m.append(h('div', { class: 'muted' }, 'Har birini qog\'ozga o\'rab, ustiga ismini yozing va «O\'raldi»ni bosing. Boshqa xodim qo\'ygan belgi ham shu yerda chiqadi.'));
  const card = h('div', { class: 'card list' });
  // Belgi darhol ko'rinadi; server javobidan keyin hamma telefonda. Kimdir oldinroq o'ragan bo'lsa — uning belgisi qoladi.
  const belgila = (z, v) => {
    const eski = { oraldi: z.oraldi, oraldiKim: z.oraldiKim };
    kutilmoqda.add(z.id);
    if (v) { z.oraldi = z.oraldi || Date.now(); z.oraldiKim = z.oraldiKim || ctx.x.ism; } else { delete z.oraldi; delete z.oraldiKim; }
    ctx.rerender();
    // Audit 10.11: fonda (amalFon) — umumiy «band» qulfi yo'q: 20 bemorni ketma-ket o'raganda keyingi bosish rad etilmaydi.
    fon(ctx)('bemorOraldi', z.id, v).then((r) => {
      kutilmoqda.delete(z.id);
      mahalliyVaqt = Date.now();
      if (r === null) { Object.assign(z, eski); if (!eski.oraldi) { delete z.oraldi; delete z.oraldiKim; } ctx.rerender(); yukla(ctx); }
      jonliYangila();
    });
  };
  b.slice().sort((a, c) => a.n - c.n).forEach((z) => {
    const dorilar = Array.isArray(z.dorilar) ? z.dorilar : [];
    card.append(h('div', { class: 'item', style: z.oraldi ? 'background:#F1F4F2' : '' },
      h('div', { class: 'line', style: 'border:0;padding:0' }, h('b', { 'data-asl': '' }, z.n + ') ' + (z.ism || 'Ismsiz')),
        z.oraldi ? h('span', { style: 'color:var(--accent);font-weight:600;white-space:nowrap' }, '✓ ' + (z.oraldiKim || 'O\'raldi') + ' · ' + vaqt(z.oraldi))
          : z.holat === 'olindi' ? h('span', { style: 'color:var(--info);font-weight:600' }, 'Olib ketildi') : qrBemor(z) ? h('span', { class: 'muted' }, 'QR retsept') : null),
      ...(dorilar.length ? dorilar.map((d) => h('div', { style: 'padding-left:12px', 'data-asl': '' }, '• ' + doriMatni(d)))
        : [h('div', { class: 'muted', style: 'padding-left:12px' }, 'Dorilar ro\'yxati kelmagan (kengaytma eski yoki qo\'lda belgilangan)')]),
      z.oraldi
        ? h('button', { class: 's', style: 'align-self:flex-start', 'aria-pressed': 'true',
          onclick: () => tasdiqlash('"O\'raldi" belgisi olib tashlansinmi?' + (z.oraldiKim ? ' (' + z.oraldiKim + ' qo\'ygan)' : '')).then((ha) => ha && belgila(z, false)) }, 'Belgini olib tashlash')
        : h('button', { class: 'p s', style: 'align-self:flex-start', 'aria-pressed': 'false', onclick: () => belgila(z, true) }, 'O\'raldi')));
  });
  m.append(card);
}

// Oson Apteka: berilgan reimbursatsiya dorisini Oson Apteka dasturidan chiqarib, shu yerda belgilaysiz. Savdo nomi ko'rsatilmaydi —
// faqat ta'sir etuvchi modda va doza, soni, bemor (foydalanuvchi 26.10). Punktlar — to'plam (punkt + kun) bo'yicha jami jadval va bitta
// tugma (oson_toplam: belgilanmaganlarga); aptekadagi mijozlar — har biri alohida (bemor_oson). Belgi serverda — hamma telefonda
// jonli (har 5 s, qadoq_holat), kim va qachon chiqargani bilan.
// Dorilar jami: [[modda va doza, soni]] — alifbo bo'yicha. Rus va o'zbek nomi bitta qatorda (H.xpnGuruh, 03.11: avval
// «Метформин 500 mg» va «Metformin 500 mg» ikki qator bo'lib, son bo'linib ko'rinardi).
function doriJami(bemorlar) {
  const j = new Map();
  bemorlar.forEach((z) => (Array.isArray(z.dorilar) ? z.dorilar : []).filter(chiqarDori).forEach((d) => {
    const nom = doriNomi(d), k = H.xpnGuruh(nom), e = j.get(k);
    j.set(k, { nom: H.xpnAfzal(e && e.nom, nom), soni: (e ? e.soni : 0) + (Number(d.soni) || 0) });
  }));
  // Tartib — lotin kalit bo'yicha (kirill nomi lotinchadan oldin chiqib, «Метформин 1000» «Metformin 500» dan uzoqda turardi).
  return [...j.entries()].sort((a, b) => a[0].localeCompare(b[0], 'en', { numeric: true })).map(([, e]) => [e.nom, e.soni]);
}
// 30.10 (foydalanuvchi: "aptekadagi mijozlarning Oson'dan chiqarilmaganini umumiy hisoblash — atsetilsalitsildan nechta…; chiqarilganlari
// hisoblanib ketmasin, punktlar qo'shilmasin"): faqat ichki punkt (aptekadagi mijozlar), berilgan va hali Oson belgisi yo'qlar,
// «berilmadi» dorisiz; davr tanlovidan qat'i nazar — yuklangan hamma kunlar (server 7 kun beradi).
export function mijozOsonJami(bemorlar, ichki) {
  // 10.11: faqat oddiy retsept dorisi berilgan mijoz — Oson'dan chiqarilmaydi (ro'yxatga ham, belgiga ham kirmaydi).
  const qolgan = ichki ? (bemorlar || []).filter((z) => z.punktId === ichki && (z.holat === 'berildi' || z.holat === 'olindi') && !z.oson && !faqatOddiy(z)) : [];
  return { qolgan, dorisiz: qolgan.filter((z) => !(Array.isArray(z.dorilar) && z.dorilar.length)).length, jami: doriJami(qolgan) };
}
// «Hammasi Oson'dan chiqarildi» — tasdiq oynasida aynan belgilanadigan mijozlar jadvali (Oson'dan chiqarilgan miqdor bilan solishtirish
// uchun). Oyna ochilgan paytdagi ro'yxat yuboriladi; server faqat shularni va faqat hammasi hali belgilanmagan bo'lsa belgilaydi
// (oson_mijozlar) — aks holda hech narsa o'zgarmaydi. Dorilari kelmagan mijozlar kirmaydi (ular alohida).
function osonMijozlarSheet(ctx, mj, oraliq, qoy) {
  const list = mj.qolgan.filter((z) => Array.isArray(z.dorilar) && z.dorilar.length);
  const jami = doriJami(list), idlar = list.map((z) => z.id);
  sheet('Oson\'dan chiqarildimi?', (box, close) => {
    box.append(
      h('p', { class: 'muted', style: 'margin:0' }, MIJOZ_NOM + ' · ' + list.length + ' mijoz · ' + oraliq + '. Oson Apteka\'dan aynan shu miqdor chiqarilganini tekshiring:'),
      h('div', { class: 'card list' }, h('div', { class: 'line muted', style: 'font-size:13px' }, h('span', {}, 'Dori'), h('span', {}, 'Jami')),
        ...jami.map(([d, n]) => h('div', { class: 'line' }, h('span', { 'data-asl': '' }, d), h('b', { style: 'white-space:nowrap' }, String(n))))),
      mj.dorisiz ? h('div', { class: 'msg warn' }, mj.dorisiz + ' mijozning dorilari ro\'yxati yo\'q — ular belgilanmaydi') : null,
      h('button', { class: 'p', onclick: () => {
        close();
        qoy(list, true, () => fon(ctx)('osonMijozlar', idlar).then((r) => { if (r !== null) ctx.toast(list.length + ' mijoz Oson\'dan chiqarildi ✓'); return r; }));
      } }, 'Ha, chiqardim — ' + list.length + ' mijoz'),
      h('button', { class: 's', onclick: close }, 'Yo\'q, bekor'));
  }, { fokus: false });
}
// Belgi darhol ko'rinadi (optimistik); server javobidan keyin hamma telefonda. Xato bo'lsa — eski holat qaytadi.
function qoyOson(ctx, zlar, v, amal) {
  const eski = zlar.map((z) => [z, z.oson, z.osonKim]);
  const t = Date.now();
  zlar.forEach((z) => { kutilmoqda.add(z.id); if (v) { z.oson = z.oson || t; z.osonKim = z.osonKim || ctx.x.ism; } else { delete z.oson; delete z.osonKim; } });
  ctx.rerender();
  amal().then((r) => {
    zlar.forEach((z) => kutilmoqda.delete(z.id));
    mahalliyVaqt = Date.now();
    if (r === null) { eski.forEach(([z, o, k]) => { if (o) { z.oson = o; z.osonKim = k; } else { delete z.oson; delete z.osonKim; } }); ctx.rerender(); yukla(ctx); }
    jonliYangila();
  });
}
const osonBelgiMatni = (zlar) => {
  const oxirgi = zlar.slice().sort((a, b) => b.oson - a.oson)[0];
  return '✓ Oson\'dan chiqarildi · ' + (oxirgi.osonKim ? oxirgi.osonKim + ' · ' : '') + vaqt(oxirgi.oson);
};

// Punkt to'plami: Oson'dan bir yo'la — jami jadval va bitta tugma (oson_toplam: hali belgilanmaganlarga, ekranda ko'ringan soni bilan).
function osonPunkt(m, ctx, tp, nom) {
  const bem = tp.bemorlar.filter(berilganmi);
  if (!bem.length) { m.append(h('div', { class: 'card muted' }, 'Hali dori berilmagan — Oson\'dan chiqaradigan narsa yo\'q.')); return; }
  if (tp.navbat) m.append(h('div', { class: 'msg warn', role: 'status' }, 'Hali ' + tp.navbat + ' bemor navbatda. Punkt dorilarini Oson\'dan hammasi berilgandan keyin bir yo\'la chiqargan qulay.'));
  const qoy = (zlar, v, amal) => qoyOson(ctx, zlar, v, amal);
  // Audit 10.11: faqat oddiy retsept dorisi berilganlar Oson'dan chiqarilmaydi — «yangi» ga kirmaydi (server oson_toplam ham sanamaydi).
  const yangi = bem.filter(osonKerak), belgili = bem.filter((z) => z.oson), oddiy = bem.filter((z) => !z.oson && faqatOddiy(z));
  // Jadval: hali chiqarilmaganlar (keyin qo'shilganlar bo'lsa — faqat ular); hammasi chiqarilgan bo'lsa — butun to'plam.
  const jami = doriJami(yangi.length ? yangi : bem);
  const sar = nom + ' · ' + kunQisqa(tp.kun);
  const card = h('div', { class: 'card list' },
    h('div', { class: 'line', style: 'border:0;padding:0' }, kartaSarlavha('Oson Apteka\'dan chiqarish'), h('span', { class: 'muted' }, bem.length + ' bemor')),
    oddiy.length ? h('span', { class: 'muted' }, oddiy.length + ' bemorga faqat oddiy retsept dorisi berilgan — Oson\'dan chiqarilmaydi') : null,
    !yangi.length && !belgili.length ? h('span', { style: 'color:var(--accent);font-weight:600' }, '✓ Oson\'dan chiqariladigan dori yo\'q')
    : !yangi.length ? h('span', { style: 'color:var(--accent);font-weight:600' }, osonBelgiMatni(belgili))
      : belgili.length ? h('span', { style: 'color:var(--warn);font-weight:600' }, belgili.length + ' tasi chiqarilgan · ' + yangi.length + ' ta yangi bemor — jadvalda faqat yangilari')
        : h('span', { style: 'color:var(--warn);font-weight:600' }, 'Oson\'dan hali chiqarilmagan'),
    h('div', { class: 'line muted', style: 'font-size:13px' }, h('span', {}, 'Dori'), h('span', {}, 'Jami')),
    ...(jami.length ? jami.map(([d, n]) => h('div', { class: 'line' }, h('span', {}, d), h('b', { style: 'white-space:nowrap' }, String(n))))
      : [h('div', { class: 'muted' }, 'Dorilar ro\'yxati kelmagan')]));
  const nusxa = sar + ' · ' + (yangi.length || bem.length) + ' bemor\n' + jami.map(([d, n]) => d + ' — ' + n).join('\n');
  card.append(h('div', { class: 'row', style: 'flex-wrap:wrap' },
    yangi.length ? h('button', { class: 'p s', onclick: () => tasdiqlash(sar + ': ' + yangi.length + ' bemorning dorilari Oson Apteka\'dan chiqarildimi?\n'
      + 'Tasdiqlasangiz, ular «chiqarildi» deb belgilanadi (hamma telefonda ko\'rinadi).')
      .then((ha) => ha && qoy(yangi, true, () => fon(ctx)('osonToplam', tp.punktId, tp.kun, true, yangi.length))) },
      'Oson\'dan chiqardim — ' + yangi.length + ' bemor') : null,
    h('button', { class: 's', onclick: () => nusxaOl(nusxa, ctx.toast, 'Jadval nusxalandi ✓') }, 'Jadvalni nusxalash'),
    !yangi.length && belgili.length ? h('button', { class: 's', onclick: () => tasdiqlash(sar + ' — "Oson\'dan chiqarildi" belgisi hamma bemordan olib tashlansinmi?')
      .then((ha) => ha && qoy(belgili, false, () => fon(ctx)('osonToplam', tp.punktId, tp.kun, false, belgili.length))) }, 'Belgini olib tashlash') : null));
  card.append(ochiladi('Bemorlar ro\'yxati (' + bem.length + ')', bem.slice().sort((a, c) => a.n - c.n).map((z) => h('div', { class: 'item', style: z.oson ? 'background:#F1F4F2' : '' },
    h('div', { class: 'line', style: 'border:0;padding:0' }, h('b', { 'data-asl': '' }, z.n + ') ' + (z.ism || 'Ismsiz')), z.oson ? h('span', { style: 'color:var(--accent)' }, '✓') : null),
    ...(Array.isArray(z.dorilar) ? z.dorilar : []).map((d) => h('div', { style: 'padding-left:12px', 'data-asl': '' }, '• ' + doriMatni(d))))),
    { k: 'oson-' + tp.punktId + tp.kun, cls: 'karta list' }));
  m.append(card);
}

// Aptekadagi mijozlar (o'z retsepti bilan kelgan, kengaytma bergan): chiqarilmaganlar jami jadvali, «Hammasi Oson'dan chiqarildi»
// va har mijoz alohida. Server 7 kun beradi.
function mijozView(m, ctx) {
  jonliBoshla(ctx);
  m.append(orqaTugma(ctx), h('h2', { class: 'bolim-s' }, MIJOZ_NOM));
  m.append(h('div', { class: 'muted' }, 'Oson Apteka dasturidan chiqargach shu yerda belgilang — belgi hamma telefonda ko\'rinadi.'));
  m.append(jonliBelgi());
  const qoy = (zlar, v, amal) => qoyOson(ctx, zlar, v, amal);
  const hammasi = R.bemorlar.filter((z) => mijozmi(z) && berilganmi(z));
  if (!hammasi.length) { m.append(h('div', { class: 'card muted' }, 'So\'nggi 7 kunda aptekadagi mijozga dori berilmagan.')); return; }
  // Oson'dan chiqarilmaganlar jami (har dori nechta). Punktlar kirmaydi — ular o'z to'plamida.
  const mj = mijozOsonJami(R.bemorlar, R.ichki);
  if (mj.qolgan.length) {
    const kunlar = [...new Set(mj.qolgan.map((z) => H.kunKey(z.ts)))].sort();
    const oraliq = kunlar.length > 1 ? kunQisqa(kunlar[0]) + '–' + kunQisqa(kunlar[kunlar.length - 1]) : kunQisqa(kunlar[0]);
    const nusxa = MIJOZ_NOM + ' · Oson\'dan chiqarilmagan · ' + mj.qolgan.length + ' mijoz (' + oraliq + ')\n' + mj.jami.map(([d, n]) => d + ' — ' + n).join('\n');
    m.append(h('div', { class: 'card list', id: 'mijoz-oson-jami' },
      h('div', { class: 'line', style: 'border:0;padding:0' }, kartaSarlavha('Oson\'dan chiqarilmagan'), h('span', { class: 'muted' }, mj.qolgan.length + ' mijoz')),
      h('span', { class: 'muted' }, oraliq + ' · Oson\'dan chiqarilganlar va punktlar kirmaydi'),
      h('div', { class: 'line muted', style: 'font-size:13px' }, h('span', {}, 'Dori'), h('span', {}, 'Jami')),
      ...(mj.jami.length ? mj.jami.map(([d, n]) => h('div', { class: 'line' }, h('span', { 'data-asl': '' }, d), h('b', { style: 'white-space:nowrap' }, String(n))))
        : [h('div', { class: 'muted' }, 'Dorilar ro\'yxati kelmagan')]),
      mj.dorisiz ? h('div', { class: 'msg warn' }, mj.dorisiz + ' mijozning dorilari ro\'yxati kelmagan — jadvalga kirmadi, ularni pastda alohida belgilang') : null,
      h('div', { class: 'row', style: 'flex-wrap:wrap' },
        mj.jami.length ? h('button', { class: 'p s', onclick: () => osonMijozlarSheet(ctx, mj, oraliq, qoy) }, 'Hammasi Oson\'dan chiqarildi') : null,
        h('button', { class: 's', onclick: () => nusxaOl(nusxa, ctx.toast, 'Jadval nusxalandi ✓') }, 'Jadvalni nusxalash'))));
  } else m.append(h('div', { class: 'card', style: 'color:var(--kirim);font-weight:600' }, '✓ Hammasi Oson\'dan chiqarilgan'));
  m.append(pills([['hammasi', 'Hammasi · ' + hammasi.length], ['qolgan', 'Chiqarilmagan · ' + mj.qolgan.length]], osonKorinish, (v) => { osonKorinish = v; ctx.rerender(); }, 'Ko\'rsatish'));
  const kor = osonKorinish === 'qolgan' ? hammasi.filter((z) => !z.oson && !faqatOddiy(z)) : hammasi;
  if (!kor.length) { m.append(h('div', { class: 'card muted' }, 'Chiqarilmagan mijoz yo\'q ✓')); return; }
  m.append(h('div', { class: 'card list' }, ...kor.slice().sort((a, c) => c.ts - a.ts).map((z) => h('div', { class: 'item', style: z.oson ? 'background:#F1F4F2' : '' },
    h('div', { class: 'line', style: 'border:0;padding:0' }, h('b', { 'data-asl': '' }, z.ism || 'Mijoz'), h('span', { class: 'muted' }, sana(z.ts) + ' ' + vaqt(z.ts))),
    berdiBelgi('span', z),
    ...(Array.isArray(z.dorilar) && z.dorilar.length ? z.dorilar.map((d) => h('div', { style: 'padding-left:12px', 'data-asl': '' }, '• ' + doriMatni(d)))
      : [h('div', { class: 'muted', style: 'padding-left:12px' }, 'Dorilar ro\'yxati kelmagan')]),
    z.oson
      ? h('div', { class: 'line', style: 'border:0;padding:0;align-items:center' }, h('span', { style: 'color:var(--accent);font-weight:600' }, osonBelgiMatni([z])),
        h('button', { class: 's', style: 'flex:none', onclick: () => tasdiqlash('"Oson\'dan chiqarildi" belgisi olib tashlansinmi?')
          .then((ha) => ha && qoy([z], false, () => fon(ctx)('bemorOson', z.id, false))) }, 'Olib tashlash'))
      : faqatOddiy(z) ? h('span', { class: 'muted' }, 'Oddiy retsept — Oson\'dan chiqarilmaydi')
      : h('button', { class: 'p s', style: 'align-self:flex-start', onclick: () => tasdiqlash((z.ism || 'Mijoz') + ' — dorilar Oson Apteka\'dan chiqarildimi?')
        .then((ha) => ha && qoy([z], true, () => fon(ctx)('bemorOson', z.id, true))) }, 'Oson\'dan chiqardim')))));
}

// Bemor oynasidagi holat tugmalari (audit 10.11) — sof funksiya (tests/miniapp-audit-retsept.test.mjs). Qoidalar server bemor_holat
// bilan bir xil (20261028160000_pul_audit): olib ketildi — faqat berilgandan; DMED'da kodi berilgan bemor qaytmaydi; o'ralgan yoki Oson'dan
// chiqarilganni faqat direktor qaytaradi. Natija: { berildi, olindi, navbat, ochilmadi } — null (tugma yo'q) yoki { tasdiq: matn | null };
// izoh — nega qaytarish tugmasi yo'q.
export function bemorAmallari(z, direktor) {
  const ber = berilganmi(z), qr = qrBemor(z);
  let izoh = null, qaytar = true;
  if (ber && z.dmedKod) { qaytar = false; izoh = 'Kodi DMED\'da berilgan — navbatga qaytarib bo\'lmaydi. Berilmagan kodi bo\'lsa — aptekadagi kompyuterda «Qayta urinish» bilan bering.'; }
  else if (ber && (z.oraldi || z.oson) && !direktor) {
    qaytar = false;
    izoh = (z.oson ? 'Oson\'dan chiqarilgan' : 'O\'ralgan') + ' — navbatga yoki «Ochilmadi»ga qaytarishni faqat direktor qiladi.';
  }
  // Berilgan bemor qaytsa server dorilar, O'raldi va Oson belgisini o'chiradi, partiya sarfini bekor qiladi — oqibati aytiladi.
  const yoqoladi = (nima) => (ber ? nima + '\n\nDiqqat: shu bemorning dorilar ro\'yxati, «O\'raldi» va «Oson» belgisi o\'chadi.'
    + (z.berdi ? ' Uni kompyuter (' + z.berdi + ') bergan — dori haqiqatan berilmagan bo\'lsagina bosing.' : '') : null);
  return {
    berildi: z.holat === 'berildi' ? null : { tasdiq: z.holat === 'navbat' ? '«Berildi» deb belgilansinmi?\n\nDiqqat: aptekadagi kompyuter bu bemorni endi DMED\'da OCHMAYDI '
      + 'va dorilari yozilmaydi. Faqat dori DMED\'siz (qog\'ozda) berilgan bo\'lsa bosing.' : null },
    olindi: z.holat === 'berildi' ? { tasdiq: null } : null,
    navbat: z.holat === 'navbat' || qr || !qaytar ? null : { tasdiq: yoqoladi('Navbatga qaytarilsinmi? Kompyuter uni DMED\'da yana ochadi.') },
    ochilmadi: qr || !qaytar ? null : { tasdiq: yoqoladi('«Ochilmadi» deb belgilansinmi?') },
    izoh
  };
}

function bemorSheet(z, ctx, qil, qilX) {
  sheet(z.n + ') ' + (z.ism || 'Ismsiz'), (box, close) => {
    const sb = input('Ochilmadi — sababi', { inputmode: 'text', placeholder: 'Masalan: retsept topilmadi, muddati o\'tgan' });
    const qilYop = (...a) => qil(...a).then((ok) => ok && close());
    const dorilar = Array.isArray(z.dorilar) ? z.dorilar : [];
    const a = bemorAmallari(z, ctx.x && ctx.x.rol === 'direktor');
    // Tasdiq kerak bo'lsa — avval so'raladi (oqibati bilan).
    const sora = (x, f) => () => (x.tasdiq ? tasdiqlash(x.tasdiq) : Promise.resolve(true)).then((ha) => ha && f());
    const kodMatn = kodlari(z).length ? kodlari(z).map(kodNiqob).join(', ') : 'kod yo\'q';
    box.append(h('div', { class: 'muted' }, qrBemor(z) ? 'QR retsept · aptekadagi kompyuter bergan' + (z.jshshir ? ' · ' + maskJ(z.jshshir) + ' · ' + kodMatn : '')
      : maskJ(z.jshshir) + ' · ' + kodMatn),
      // 03.11: sarlavhada DMED'dagi ism-sharif (server 'ism'); ro'yxatda boshqacha yozilgan bo'lsa — shu yerda.
      z.yozilgan ? h('div', { class: ismOgoh(z) ? 'msg warn' : 'muted' }, ismOgoh(z) ? '⚠ Ro\'yxatda boshqa ism yozilgan: ' : 'Ro\'yxatda yozilgan: ',
        h('span', { 'data-asl': '' }, z.yozilgan), ismOgoh(z) ? ' — DMED\'dagi ism bilan mos emas. To\'g\'ri bemorga berilganini tekshiring.' : '') : null,
      dorilar.length ? h('div', {}, ...dorilar.map((d) => h('div', { 'data-asl': '' }, '• ' + doriMatni(d)))) : null,
      berdiBelgi('div', z),
      z.xato && z.xato.length ? h('div', { class: 'msg warn' }, z.xato.join(', ') + ' — punktdan to\'g\'risini so\'rang') : null,
      // Audit 10.11: navbatdagi bemorda «Berildi» — asosiy emas va tasdiq bilan (adashib bosilsa kompyuter uni DMED'da ochmaydi).
      h('div', { class: 'row', style: 'flex-wrap:wrap' },
        a.olindi ? h('button', { class: 'p s', onclick: sora(a.olindi, () => qilYop('bemorHolat', z.id, 'olindi', '')) }, 'Olib ketildi') : null,
        a.berildi ? h('button', { class: 's', onclick: sora(a.berildi, () => qilYop('bemorHolat', z.id, 'berildi', '')) },
          z.holat === 'navbat' ? 'Berildi (qog\'ozda)' : 'Berildi') : null,
        a.navbat ? h('button', { class: 's', onclick: sora(a.navbat, () => qilYop('bemorHolat', z.id, 'navbat', '')) }, 'Navbatga qaytarish') : null),
      a.izoh ? h('div', { class: 'muted', role: 'note' }, a.izoh) : null,
      a.ochilmadi ? sb.el : null,
      a.ochilmadi ? h('button', { onclick: () => {
        if (String(sb.i.value).trim().length < 2) { sb.xato('Sababini yozing'); sb.i.focus(); return; }
        sora(a.ochilmadi, () => qilX(xatoJoyla([[sb, /sabab/i]]), 'bemorHolat', z.id, 'ochilmadi', sb.i.value).then((ok) => ok && close()))();
      } }, 'Ochilmadi deb belgilash') : null);
  }, { fokus: false });
}

// Rasm: serverdan olinadi, QR kod(lar) shu telefonda (Web Worker'da) o'qiladi.
// Ko'rilmagan rasm: QR ichida JSHSHIR va kod bo'lsa — ro'yxatga o'zi qo'shiladi. Qidiruv bosqichli (qr.mjs 'bosqich'): bitta
// retseptli rasmda 5 bo'lakdan keyin to'xtaydi; rasmda yana retsept bo'lsa — "Yana QR qidirish" (topilgani qo'lda maydonga tushadi,
// xodim tekshirib qo'shadi — rasm endi ko'rib chiqilgan, server QR'dan qayta qo'shmaydi).
// Ko'rib chiqilgan rasm (audit M1): QR faqat ko'rsatiladi, bemorlar qayta qo'shilmaydi; birinchi topilgan QR'da to'xtaydi.
function rasmSheet(z, ctx, qil, qilX) {
  // To'liq ekran: tepada rasm (kattalashtirish, surish), pastda bemor formasi. Klaviatura o'zi chiqmaydi (fokus: false);
  // ochilganda oyna ko'rinadigan qismga moslashadi — rasm ham, yozilayotgan maydon ham ko'rinib turadi.
  sheet('Rasm · ' + sana(z.ts) + ' ' + vaqt(z.ts), (box, close) => {
    const ac = new AbortController();
    let url = null, kenglik = 100;
    const korilgan = rasmKorilganmi(z, korilganRasm);
    const img = h('img', { alt: 'Punkt yuborgan rasm' });
    const zoom = (d) => { kenglik = Math.max(100, Math.min(300, kenglik + d)); img.style.width = kenglik + '%'; };
    const tugmalar = h('div', { class: 'rasm-tugmalar' },
      h('button', { type: 'button', 'aria-label': 'Rasmni kattalashtirish', onclick: () => zoom(50) }, '+'),
      h('button', { type: 'button', 'aria-label': 'Rasmni kichraytirish', onclick: () => zoom(-50) }, '−'));
    const ko = h('div', { class: 'rasm-ko' }, h('div', { class: 'bosh-holat' }, 'Rasm yuklanmoqda…'));
    const forma = h('div', { class: 'rasm-forma' });
    box.append(ko, forma);
    const qosh = (...k) => forma.append(...k.filter(Boolean));

    const holat = h('div', { class: 'msg info', 'aria-live': 'polite' }, 'Rasm yuklanmoqda…');
    const yanaJoy = h('div', {});

    // Bitta bemor: ism, JSHSHIR va kodlar alohida maydonda (qog'ozdan kiritish bilan bir xil forma).
    const bemor = bemorFormasi(ctx, 'Shu rasmdan qo\'shildi', 'Rasmdagidek', (joyla, qator) =>
      qilX(joyla, 'rasmRoyxat', z.id, false, qator).then((n) => { if (n !== null) korilganRasm.add(z.id); return n; }));

    // Bir nechta bemorni matn bilan (yoki "Yana QR qidirish" topgan QR'lar) — yopiq bo'lim.
    const qolda = matnMaydon('Bir nechta bemor — har biri yangi qatorda', { rows: '4', placeholder: '1) Ism Familiya  JSHSHIR(14 raqam)  123-456' });
    const matnBolim = ochiladi('Bir nechtasini matn bilan qo\'shish', [qolda.el,
      h('button', { onclick: () => {
        if (!qolda.i.value.trim()) { qolda.xato('Ism, JSHSHIR va himoya kodini yozing'); qolda.i.focus(); return; }
        qilX(xatoJoyla([[qolda]]), 'rasmRoyxat', z.id, false, qolda.i.value).then((n) => {
          if (n === null) return;
          korilganRasm.add(z.id);
          qolda.i.value = '';
          ctx.toast(royxatXabari(n));
        });
      } }, 'Ro\'yxatga qo\'shish')], { cls: 'karta' });

    qosh(holat, yanaJoy,
      z.matn ? h('div', { class: 'muted', style: 'white-space:pre-line' }, 'Izoh: ' + qrNiqob(z.matn).slice(0, 500)) : null,
      h('b', { style: 'font-size:17px' }, 'Rasmdan bemor qo\'shish'),
      h('div', { class: 'muted' }, 'Rasmga qarab bittalab yozing. Rasmni +/− bilan kattalashtiring va barmoq bilan suring. Bo\'sh joyga bossangiz — klaviatura yopiladi.'),
      bemor.el, matnBolim,
      korilgan ? null : h('button', { class: 's', onclick: () => qil('rasmRoyxat', z.id, true, z.qr || '').then((ok) => { if (ok !== null) { korilganRasm.add(z.id); close(); } }) }, 'Ko\'rib chiqildi (qo\'shadigan narsa yo\'q)'),
      h('button', { type: 'button', onclick: close }, 'Tayyor — yopish'));

    // Qidiruv holati — faqat bosqich chegaralarida (butun rasm, 2×2, 3×3): ekran o'quvchi har bo'lakda gapirmasin.
    const qidiruv = (i, n) => { if (!ac.signal.aborted && (i === 1 || i === 5) && i < n) holat.textContent = 'QR kod qidirilmoqda… ' + i + '/' + n + ' bo\'lak'; };
    // Rasmda yana retsept bo'lsa: hamma 14 bo'lak. Yangi QR'lar matn maydoniga — xodim tekshirib qo'shadi.
    const yanaTugma = (blob, oldin) => {
      const b = h('button', { class: 's', onclick: async () => {
        b.disabled = true;
        const { qrlar } = await qrOqi(blob, { rejim: 'hammasi', signal: ac.signal, bosqich: qidiruv }).catch(() => ({ qrlar: [] }));
        if (ac.signal.aborted) return;
        const yangi = qrlar.filter((q) => !oldin.includes(q));
        b.remove();
        if (!yangi.length) { holat.textContent = 'Boshqa QR topilmadi.'; return; }
        qolda.i.value += (qolda.i.value && !qolda.i.value.endsWith('\n') ? '\n' : '') + yangi.join('\n');
        qolda.xato('');
        matnBolim.open = true;
        holat.textContent = 'Yana ' + yangi.length + ' ta QR topildi — «Bir nechtasini matn bilan qo\'shish» ga qo\'yildi. Tekshirib, «Ro\'yxatga qo\'shish»ni bosing.';
      } }, 'Yana QR qidirish (rasmda boshqa retsept bo\'lsa)');
      return b;
    };
    ctx.rasmOl(z.id).then(async (blob) => {
      if (ac.signal.aborted) return;
      if (!blob) { ko.replaceChildren(h('div', { class: 'bosh-holat' }, 'Sinov rejimida rasm yo\'q.')); holat.textContent = 'Sinov rejimida rasm yo\'q — formani sinab ko\'rishingiz mumkin.'; return; }
      url = URL.createObjectURL(blob);
      img.src = url;
      ko.replaceChildren(tugmalar, img);
      holat.textContent = 'QR kod qidirilmoqda…';
      const { qrlar, qoldi } = await qrOqi(blob, { rejim: korilgan ? 'birinchi' : 'bosqich', signal: ac.signal, bosqich: qidiruv }).catch(() => ({ qrlar: [], qoldi: false }));
      if (ac.signal.aborted) return;
      if (!qrlar.length) { holat.textContent = 'QR kod topilmadi — rasmga qarab pastdagi formaga yozing.'; return; }
      if (korilgan) {
        holat.textContent = 'Bu rasm avval ko\'rib chiqilgan — bemorlar qayta qo\'shilmaydi. QR ichida: «' + qrNiqob(qrlar.join(' | ')).slice(0, 200) + '»';
        return;
      }
      holat.textContent = qrlar.length + ' ta QR o\'qildi. Ro\'yxatga qo\'shilmoqda…';
      const n = await qil('rasmRoyxat', z.id, true, qrlar.join('\n'));
      if (n !== null) korilganRasm.add(z.id);   // R yangilanguncha qayta ochilsa ham — faqat ko'rsatish
      if (ac.signal.aborted) return;
      holat.textContent = rasmQrXabari(n, qrlar);
      if (n !== null && qoldi) yanaJoy.append(yanaTugma(blob, qrlar));
    }, (e) => { if (!ac.signal.aborted) { holat.textContent = e.message; ko.replaceChildren(h('div', { class: 'bosh-holat' }, e.message)); } });
    // Oyna yopilganda: QR o'qish to'xtaydi, rasm xotiradan bo'shaydi.
    return () => { ac.abort(); if (url) URL.revokeObjectURL(url); };
  }, { fokus: false, toliq: true });
}

// Bitta bemor formasi (rasmdan va qog'ozdan kiritish): ism-familiya, JSHSHIR (14 raqam) va 1–5 himoya kodi — har biri alohida
// maydonda, raqamlar faqat raqam klaviaturasida. "Qo'shish va keyingisi" — bemor darhol saqlanadi, forma tozalanadi.
// yubor(joyla, qator) → Promise<soni | null>; serverga "Ism Familiya JSHSHIR kod kod" matni boradi (server ajratadi).
function bemorFormasi(ctx, qoshildiSarlavha, ismIzoh, yubor) {
  const ism = input('Bemorning ism-familiyasi', { inputmode: 'text', autocapitalize: 'words', enterkeyhint: 'next', maxlength: '100', placeholder: ismIzoh });
  const jsh = raqamMaydon('JSHSHIR (14 raqam)', 14, (d) => d, { enterkeyhint: 'next', placeholder: '14 ta raqam' });
  const kodlar = [];
  const kodBox = h('div', { style: 'display:flex;flex-direction:column;gap:10px' });
  const yanaKod = h('button', { class: 's', type: 'button', onclick: () => { kodQosh(); kodlar[kodlar.length - 1].i.focus(); } }, '+ Yana himoya kodi');
  const kodQosh = () => {
    const k = raqamMaydon(kodlar.length ? (kodlar.length + 1) + '-himoya kodi' : 'Himoya kodi (6 raqam)', 6, H.kodKorinish, { enterkeyhint: 'done', placeholder: '123-456' });
    k.i.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); saqla(); } });
    kodlar.push(k);
    kodBox.append(k.el);
    yanaKod.hidden = kodlar.length >= 5;
  };
  kodQosh();
  ism.i.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); jsh.i.focus(); } });
  jsh.i.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); kodlar[0].i.focus(); } });
  const toza = (f) => { f.i.value = ''; f.i.dispatchEvent(new Event('input')); f.xato(''); };
  const tozala = () => {
    [ism, jsh].forEach(toza);
    kodlar.splice(1).forEach((k) => k.el.remove());
    toza(kodlar[0]);
    yanaKod.hidden = false;
  };
  const qoshildi = [];
  const qoshildiEl = h('div', { class: 'qoshildi', 'aria-live': 'polite' });
  let band = false;
  const saqla = async () => {
    if (band) return;
    const f = { ism: ism.i.value, jshshir: jsh.i.value, kodlar: kodlar.map((k) => k.i.value) };
    const x = H.punktBemorXato(f) || {};
    const juft = [[ism, x.ism], [jsh, x.jshshir], ...kodlar.map((k, i) => [k, x['kod' + i]])];
    juft.forEach(([m, t]) => m.xato(t || ''));
    const birinchi = juft.find(([, t]) => t);
    if (birinchi) { birinchi[0].i.focus(); return; }
    const nom = H.defNom(String(f.ism).replace(/[0-9]/g, ' '));
    const qator = nom + ' ' + H.raqamlar(f.jshshir) + ' ' + f.kodlar.map(H.raqamlar).filter(Boolean).join(' ');
    band = true;
    const n = await yubor(xatoJoyla([[ism, /ism/i], [jsh, /JSHSHIR/i], [kodlar[0], /kod|yozilgan/i]]), qator).finally(() => { band = false; });
    if (n === null) return;
    qoshildi.push(nom);
    qoshildiEl.replaceChildren(h('b', {}, qoshildiSarlavha + ': ' + qoshildi.length + ' ta'),
      ...qoshildi.map((s, i) => h('span', { class: 'muted' }, (i + 1) + ') ' + s)));
    ctx.toast(nom + ' — ro\'yxatga qo\'shildi ✓');
    tozala();
    ism.i.focus();
  };
  const el = h('div', { style: 'display:flex;flex-direction:column;gap:12px' }, ism.el, jsh.el, kodBox, yanaKod,
    h('button', { class: 'p', type: 'button', 'data-klav': 'qoldir', onclick: saqla }, 'Qo\'shish va keyingisi'), qoshildiEl);
  return { el, fokus: () => ism.i.focus() };
}

// Punkt retseptlarni o'zi olib kelsa: punktni tanlab, har bemorni alohida maydonlarga yozasiz (yoki kamera bilan QR'larni).
// Har bemor darhol saqlanadi. Shu kuni shu punktga keyin yana qo'shilganlar ham — bitta ro'yxat (raqamlar davom etadi),
// aptekadagi kompyuterda (kengaytma) ham o'sha punktning bugungi ro'yxatiga tushadi.
function qogozSheet(ctx, qilX) {
  sheet('Qog\'ozdan kiritish', (box) => {
    let punktId = R.punktlar[0].id, soni = 0, boshi = 0, qoshildi = 0;
    const bugun = H.kunKey(Date.now());
    const bugungi = () => R.bemorlar.filter((b) => b.punktId === punktId && H.kunKey(b.ts) === bugun).length;
    const holatEl = h('div', { class: 'msg info', 'aria-live': 'polite' });
    const holatYoz = () => {
      const n = boshi + qoshildi, nom = (R.punktlar.find((p) => p.id === punktId) || {}).nom || 'Punkt';
      holatEl.textContent = n ? 'Bugun «' + nom + '» ro\'yxatida ' + n + ' bemor bor — yangilari shu ro\'yxatga qo\'shiladi (raqamlar davom etadi).'
        : 'Bugun «' + nom + '» ro\'yxati hali bo\'sh. Kiritganlaringiz aptekadagi kompyuterda ham shu punkt ro\'yxatiga tushadi.';
    };
    boshi = bugungi(); holatYoz();
    const bemor = bemorFormasi(ctx, 'Hozir qo\'shildi', 'Qog\'ozdagidek', (joyla, qator) => qilX(joyla, 'punktQolda', punktId, qator)
      .then((n) => { if (n !== null) { qoshildi += Number(n) || 1; holatYoz(); } return n; }));
    // Bir nechta bemor matn bilan yoki kamera bilan o'qilgan QR'lar — yopiq bo'lim.
    const matn = matnMaydon('Bir nechta bemor — har biri yangi qatorda', { rows: '4', placeholder: '1) Ism Familiya  JSHSHIR(14 raqam)  123-456' });
    const qrHolat = h('div', { class: 'muted', 'aria-live': 'polite' });
    const matnBolim = ochiladi('Bir nechtasini matn bilan qo\'shish', [matn.el, h('button', { onclick: () => {
      if (!matn.i.value.trim()) { matn.xato('Ro\'yxatni yozing yoki QR skanerlang'); matn.i.focus(); return; }
      qilX(xatoJoyla([[matn]]), 'punktQolda', punktId, matn.i.value).then((n) => { if (n !== null) { matn.i.value = ''; ctx.toast(royxatXabari(n)); } });
    } }, 'Ro\'yxatga qo\'shish')], { cls: 'karta' });
    const tg = ctx.tg;
    box.append(h('b', {}, 'Qaysi punkt?'), pills(R.punktlar.map((p) => [p.id, p.nom]), punktId, (v) => { punktId = v; boshi = bugungi(); qoshildi = 0; holatYoz(); }, 'Punkt'), holatEl,
      h('b', { style: 'font-size:17px' }, 'Bemorni qo\'shish'), bemor.el,
      tg && tg.showScanQrPopup ? h('button', { onclick: () => {
        tg.showScanQrPopup({ text: yozuvMatni('Retseptdagi QR kodni ko\'rsating (ketma-ket)') }, (data) => {
          if (data) {
            matn.i.value += (matn.i.value && !matn.i.value.endsWith('\n') ? '\n' : '') + data + '\n';
            soni += 1; qrHolat.textContent = soni + ' ta QR o\'qildi — «Bir nechtasini matn bilan qo\'shish» ichida, tekshirib qo\'shing'; matn.xato(''); matnBolim.open = true;
          }
          return false;   // skaner ochiq qoladi — keyingi retsept
        });
      } }, 'QR kodlarni skanerlash (kamera)') : null,
      qrHolat, matnBolim,
      // "Tugatdim" (27.10): punktning bugungi, hali yuborilmagan bemorlari Excel bo'lib direktorga (punkt nomi bilan).
      // Ikkinchi marta olib kelsa — yana kiritib, yana bosiladi: faqat yangilari, alohida fayl.
      // 28.10: DMED'da hali ochilmaganlar bo'lsa — avval so'raladi (Excel'da ular "Navbatda" bo'lib chiqadi).
      h('button', { class: 'p', onclick: async () => {
        const navbatda = R.bemorlar.filter((b) => b.punktId === punktId && H.kunKey(b.ts) === bugun && b.holat === 'navbat').length;
        if (navbatda && !(await tasdiqlash(navbatda + ' ta bemor hali DMED\'da ochilmagan — Excel\'da «Navbatda» deb chiqadi. Baribir yuborilsinmi?'))) return;
        const r = await ctx.amal('punktExcel', punktId);
        if (r && r.soni) ctx.toast(r.raqam + '-ro\'yxat Excel bo\'lib direktorga yuborildi ✓ — ' + r.soni + ' bemor');
      } }, 'Tugatdim — Excel direktorga'),
      h('div', { class: 'muted' }, 'Hammasini kiritib bo\'lgach bosing: punkt nomi bilan Excel fayl botdan direktorga boradi. Keyin yana olib kelishsa — kiritib, yana bosing. '
        + 'Faylda to\'liq JSHSHIR va kodlar bor — u chatda qoladi: punkt olib ketgach chatdan o\'chiring.'));
  }, { fokus: false });
}

// Direktor: punktlar ro'yxati va bot havolasi.
function punktlarKarta(m, ctx, qil, qilX, yopiq = true) {
  const card = h('div', { class: 'card list' }, kartaSarlavha(R.punktlar.length + ' ta punkt'));
  if (!R.punktlar.length) card.append(h('div', { class: 'muted' }, 'Hali punkt yo\'q. Qo\'shing va havolani punktga yuboring — ular botga shu havola orqali ulanadi.'));
  R.punktlar.forEach((p) => card.append(h('div', { class: 'line' }, h('span', {}, p.nom + (p.ulangan ? ' · botda ✓' : ' · ulanmagan')),
    h('button', { class: 's', style: 'flex:none', onclick: () => punktSheet(ctx, p, qil, qilX) }, p.ulangan ? 'Boshqarish' : 'Havola'))));
  card.append(h('button', { class: yopiq ? null : 'p', onclick: () => sheet('Yangi punkt', (box, close) => {
    const nom = input('Punkt nomi', { inputmode: 'text', placeholder: 'Masalan: 3-oilaviy poliklinika' });
    box.append(nom.el, h('button', { class: 'p', onclick: () => {
      if (String(nom.i.value).trim().length < 2) { nom.xato('Punkt nomini yozing'); nom.i.focus(); return; }
      qilX(xatoJoyla([[nom]]), 'punktQosh', nom.i.value).then((ok) => ok && close());
    } }, 'Qo\'shish'));
  }) }, '+ Punkt qo\'shish'));
  if (!yopiq) { m.append(card); return; }
  // Retseptlar sahifasida punktlar boshqaruvi kamdan-kam kerak — yopiq bo'lim (punkt yo'q bo'lsa — ochiq).
  card.firstChild.remove();
  m.append(ochiladi('Punktlar', [...card.childNodes], { k: 'retsept-punktlar', ochiq: !R.punktlar.length, cls: 'karta list',
    izoh: R.punktlar.length + ' ta · ' + R.punktlar.filter((p) => p.ulangan).length + ' tasi botda' }));
}

// Punkt: havola — avval punktdagi odamning telefon raqami (havola faqat shu raqamli Telegram'da ochiladi); ulangan bo'lsa — uzish.
function punktSheet(ctx, p, qil, qilX) {
  sheet(p.nom, (box, close) => {
    const tel = input('Punktdagi odamning telefon raqami (Telegram\'dagi)', { type: 'tel', inputmode: 'tel' });
    box.append(h('div', { class: 'msg info' }, (p.ulangan ? 'Punkt botga ulangan ✓. Odam almashsa yoki telefoni o\'zgarsa — yangi havola bering. ' : '')
      + 'Havola faqat shu raqamli Telegram\'da ochiladi — boshqa odamga borib qolsa, u ocha olmaydi.'), tel.el,
    h('button', { class: 'p', onclick: () => {
      if (!H.normTel(tel.i.value)) { tel.xato('Telefon raqami noto\'g\'ri (+998 XX XXX XX XX)'); tel.i.focus(); return; }
      qilX(xatoJoyla([[tel, /telefon|raqam/i]]), 'punktTelefon', p.id, tel.i.value).then((t) => { if (!t) return; close(); havolaSheet(ctx, p, qil, typeof t === 'string' ? t : null); });
    } }, p.ulangan ? 'Yangi havola' : 'Havola yaratish'),
    p.ulangan ? h('button', { class: 's', onclick: () => tasdiqlash(p.nom + ' botdan uzilsinmi? Ular ro\'yxat yubora olmaydi, eski havolalar ishlamaydi. Ro\'yxatlar tarixi qoladi.')
      .then((ha) => ha && qil('punktUzish', p.id).then((r) => { if (r === null) return; close(); ctx.toast(p.nom + ' botdan uzildi'); })) }, 'Botdan uzish') : null);
  });
}

function havolaSheet(ctx, p, qil, telefon = null) {
  qil('punktTaklif', p.id).then((kod) => {
    if (typeof kod !== 'string' || !kod) return;   // havola/kalit matni kelmadi (xato yoki takror)
    const link = 'https://t.me/' + BOT_USERNAME + '?start=p' + kod;
    const tgApp = window.Telegram && window.Telegram.WebApp;
    sheet('Havola: ' + p.nom, (box) => box.append(...[
      h('div', { class: 'msg info' }, 'Havolani punktga yuboring. Ular bosib "Start" ni bosadi — bot ularni ' + p.nom + ' sifatida taniydi. 7 kun amal qiladi, bir marta ishlaydi'
        + (telefon ? ' — faqat ' + telefon + ' raqamli Telegram\'da ochiladi (bot raqamni so\'raydi).' : '.')),
      ctx.server && tgApp && tgApp.openTelegramLink ? h('button', { class: 'p', onclick: () => tgApp.openTelegramLink('https://t.me/share/url?url=' + encodeURIComponent(link)) }, 'Telegram orqali yuborish') : null,
      h('button', { onclick: () => nusxaOl(link, ctx.toast) }, 'Havoladan nusxa olish'),
      h('div', { class: 'calc', 'data-asl': '', style: 'word-break:break-all;font-size:13px' }, link)].filter(Boolean)));
  });
}

export const retseptSarlavha = () => kunNomi();
