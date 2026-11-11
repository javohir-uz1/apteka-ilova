// «Bilimdon» — jonli o'yin (29.10, foydalanuvchi: Kahoot kabi; direktor ochadi, boshlaydi va KUZATADI, xodimlar o'z panelida
// javob beradi; kim tez va to'g'ri javob bersa — ko'p ball). Server: 20261029100000_oyin.sql (to'g'ri javob ochilmaguncha
// telefonga kelmaydi, ball serverda). Ekran o'yin ochiq turganda har 2,5 s yangilanadi — faqat shu blok qayta chiziladi.
import { h, input, kartaSarlavha, pills, sheet, tasdiqlash } from './ui.mjs';

const TUR = {
  test: 'Test', togri_notogri: 'To\'g\'ri yoki noto\'g\'ri?', retseptli: 'Retsept kerakmi?', muloqot: 'Mijoz bilan',
  belgila: 'Hammasini belgilang', retsept: 'Retseptni o\'qing', shikoyat: 'Bemor shikoyati', simulyator: 'Simulyator',
  analog: 'Analoglarni toping', narx: 'Narxini toping', kassir: 'Tez kassir'
};
const KOP = ['belgila', 'analog'];                          // bir nechta javobli turlar
// O'yin turlari (direktor o'yin ochganda tanlaydi, 20261029150000_oyin_v2.sql).
const OYIN_TUR = [
  ['klassik', 'Klassik', 'Aralash savollar, tez javob — ko\'p ball'],
  ['oxirgi', 'Oxirgi qolgan', 'Xato qilgan chiqadi, oxirgi qolgan g\'olib'],
  ['simulyator', 'Simulyator kuni', 'Faqat bemor vaziyatlari, monitor bilan'],
  ['chaqmoq', 'Chaqmoq', '90 soniyada kim ko\'p to\'g\'ri topadi'],
  ['birinchi', 'Kim birinchi?', 'Birinchi to\'g\'ri javob — 1000 ball, qolganlar — 0'],
  ['mijoz', 'Mijoz keldi', 'Shikoyat, muloqot, retsept, simulyator']];
const TUR_NOMI = Object.fromEntries(OYIN_TUR.map(([k, n]) => [k, n]));
const MAVZU = [['', 'Aralash'], ['yurak', 'Yurak, bosim'], ['oshqozon', 'Oshqozon'], ['nafas', 'Yo\'tal, tumov'], ['allergiya', 'Allergiya'],
  ['antibiotik', 'Antibiotik'], ['ogriq', 'Og\'riq, isitma'], ['diabet', 'Qandli diabet'], ['teri', 'Teri']];
// Simulyator monitori: me'yor (lo–hi) yashil, shkala min–max.
const MON = {
  qb: { n: 'Qon bosimi', b: '', min: 60, max: 220, lo: 100, hi: 135 }, yurak: { n: 'Yurak urishi', b: ' /daq', min: 30, max: 180, lo: 60, hi: 90 },
  harorat: { n: 'Harorat', b: ' °C', min: 35, max: 41, lo: 36, hi: 37.2 }, qand: { n: 'Qondagi qand', b: ' mmol/l', min: 2, max: 20, lo: 3.9, hi: 6.1 },
  spo2: { n: 'Saturatsiya', b: '%', min: 70, max: 100, lo: 95, hi: 100 }, ogriq: { n: 'Og\'riq', b: ' /10', min: 0, max: 10, lo: 0, hi: 2 },
  ich: { n: 'Ich ketish', b: ' marta', min: 0, max: 15, lo: 0, hi: 3 }, yotal: { n: 'Yo\'tal', b: ' /10', min: 0, max: 10, lo: 0, hi: 2 },
  qichish: { n: 'Qichish', b: ' /10', min: 0, max: 10, lo: 0, hi: 2 }, burun: { n: 'Burun bitishi', b: ' /10', min: 0, max: 10, lo: 0, hi: 2 } };
// Bolada me'yor boshqacha (bemor matnidagi «N yosh» / «N oylik» dan): yurak urishi va sistolik bosim.
const BOLA = { yurak: [[1, 100, 160], [3, 90, 150], [6, 80, 120], [12, 70, 110]], qb: [[1, 70, 100], [3, 85, 105], [6, 90, 110], [12, 95, 120]] };
export function bemorYoshi(matn) {
  const t = String(matn || '');
  const oy = t.match(/(\d+(?:[.,]\d+)?)\s*oylik/i), y = t.match(/(\d+(?:[.,]\d+)?)\s*yosh/i);   // «1,5 yosh» — 1,5 (5 emas)
  const son = (m) => Number(m[1].replace(',', '.'));
  return oy ? son(oy) / 12 : y ? son(y) : null;
}
export function monMeyor(k, yosh) {
  const c = MON[k] || { n: k, b: '', min: 0, max: 100, lo: 0, hi: 100 };
  const b = yosh != null && BOLA[k] ? BOLA[k].find(([gacha]) => yosh < gacha) : null;
  return b ? { ...c, lo: b[1], hi: b[2] } : c;
}
// Ko'rsatkich holati: me'yorda — 'ok'; me'yordan oz chetda (shkalaning 15% igacha) — 'diq'; uzoq — 'xavf'.
export function monHolat(c, v) {
  if (v >= c.lo && v <= c.hi) return 'ok';
  const d = (v < c.lo ? c.lo - v : v - c.hi) / ((c.max - c.min) || 1);
  return d > 0.15 ? 'xavf' : 'diq';
}
const sonMatn = (x) => String(x).replace('.', ',');
const RANG = ['v0', 'v1', 'v2', 'v3', 'v4', 'v5'];          // variant ranglari (style.css .oyin-v*)
const HARF = ['A', 'B', 'C', 'D', 'E', 'F'];
// Javob vaqti (direktor tanlaydi, 29.10): 0 — avtomatik (turiga qarab 20–30 s).
const VAQTLAR = [[0, 'Avtomatik (20–30 soniya)'], [30, '30 soniya'], [45, '45 soniya'], [60, '1 daqiqa'], [90, '1,5 daqiqa'], [120, '2 daqiqa'], [180, '3 daqiqa']];
const vaqtNomi = (s) => (VAQTLAR.find(([v]) => v === (s || 0)) || [0, s + ' soniya'])[1];

// Direktor: «Javob vaqti» qatori — bosilsa tanlov oynasi. Ochilgan, hali boshlanmagan o'yinga ham darhol qo'llanadi.
function vaqtTugma(ctx, chiz) {
  const joriyV = (G.h && G.h.vaqt) || 0;
  return h('button', { type: 'button', class: 'iq oyin-vaqt', onclick: () => sheet('Javob vaqti', (box, close) => {
    box.append(h('div', { class: 'muted' }, 'Har savolga qancha vaqt beriladi. Tez javob bergan baribir ko\'proq ball oladi.'),
      ...VAQTLAR.map(([v, l]) => h('button', { type: 'button', class: v === joriyV ? 'p' : '', 'aria-pressed': String(v === joriyV),
        onclick: () => ctx.amal('oyinVaqt', v).then((ok) => {
          if (ok === null) return;
          close(); ctx.toast('Javob vaqti: ' + l + ' ✓');
          if (G.h) G.h.vaqt = v || null;
          yukla(ctx).then(chiz);
        }) }, l)));
  }, { fokus: false }) },
  h('span', { class: 'iq-m' }, h('b', {}, 'Javob vaqti'), h('span', {}, vaqtNomi(joriyV))), h('span', { class: 'qator-o', 'aria-hidden': 'true' }, '›'));
}

// Holat (shu telefonda): oxirgi server javobi, qachon olingani, xodimning belgilagan variantlari (bir nechta javobli savol).
const G = { h: null, vaqt: 0, xato: '', tanlov: [], tanlovSavol: null, yuborilmoqda: false, timer: null, tik: null, sahifa: 'oyin', reyting: null, bank: null, ovoz: null, yopiq: new Set(), elon: '' };

const haptik = (ctx, tur) => { try { const hf = ctx.tg && ctx.tg.HapticFeedback; if (!hf) return; if (tur === 'ok' || tur === 'xato') hf.notificationOccurred(tur === 'ok' ? 'success' : 'error'); else hf.impactOccurred('light'); } catch (e) { /* eski Telegram */ } };

// So'rovlar tartib raqami bilan: sekin internetda oldin yuborilgan so'rov keyin kelsa, yangiroq holat ustidan yozilmaydi.
let sorovN = 0, qollanganN = 0;
// Audit 10.11: ketayotgan so'rov (bo'lsa) — ekran qayta chizilganda (oyinView) ikkinchi so'rov yuborilmaydi. Amaldan keyingi
// yangilash (yangi = true) doim yangi so'rov: oldin ketgan so'rov amal yozilmasdan oldingi holatni olib kelishi mumkin.
let ketayotgan = null;
function yukla(ctx, yangi = true) {
  if (!yangi && ketayotgan) return ketayotgan;
  const p = yuklaSorov(ctx).finally(() => { if (ketayotgan === p) ketayotgan = null; });
  ketayotgan = p;
  return p;
}
async function yuklaSorov(ctx) {
  const n = ++sorovN;
  try {
    const h = await ctx.oqi('oyinHolat');
    if (n < qollanganN) return;
    qollanganN = n; G.h = h; G.vaqt = Date.now(); G.xato = ''; G.xatoSoni = 0;
  } catch (e) {
    // 29.10: bir martalik xato (server band) ekranga chiqmaydi — keyingi so'rov kutib turadi (davr uzayadi).
    if (n < qollanganN) return;
    G.xatoSoni = (G.xatoSoni || 0) + 1;
    if (G.xatoSoni >= 3) G.xato = 'Aloqa sekin — ma\'lumot yangilanmayapti, qayta ulanmoqda…';
  }
}
// O'yin amallari (javob, kirish, start, keyingi…) — fonda (app.mjs amalFon): butun ilova qayta chizilmaydi, taymerlar qayta
// yaratilmaydi, oyinHolat bir marta so'raladi (chaqiruvchi yukla().then(chiz)). Ikki marta bosish — shu yerda to'xtaydi.
let amalBand = false;
export function oyinAmal(ctx, nom, ...a) {
  if (amalBand) return Promise.resolve(null);
  amalBand = true;
  return Promise.resolve().then(() => (ctx.amalFon || ctx.amal)(nom, ...a)).finally(() => { amalBand = false; });
}

// Bosh ekrandagi xabar: xodim — jonli o'yin ochiq va u hali kirmagan bo'lsa; direktor — o'yin ketayotgan bo'lsa (kuzatishga qaytish).
// Holat 30 s da bir marta tekshiriladi.
let tekshirildi = 0;
// Bilimdon'ni boshidan ochish (05.11: xodim panelidagi belgidan — eski duel/reyting sahifasi qolib ketmasin).
export function oyinBosh() { G.sahifa = 'oyin'; G.duel = null; }

export function oyinBanner(ctx, ochish) {
  if (ctx.server && Date.now() - tekshirildi > 30000 && document.visibilityState !== 'hidden') {
    tekshirildi = Date.now();
    const oldin = JSON.stringify(G.h && G.h.jonli && [G.h.jonli.id, G.h.jonli.holat, !!G.h.jonli.men]);
    yukla(ctx, false).then(() => { if (JSON.stringify(G.h && G.h.jonli && [G.h.jonli.id, G.h.jonli.holat, !!G.h.jonli.men]) !== oldin) ctx.rerender(); });
  }
  const j = G.h && G.h.jonli;
  if (!j || j.holat === 'tugadi' || j.holat === 'bekor' || j.men) return null;
  const dir = G.h.rol === 'direktor';
  const [sarl, izoh] = dir
    ? ['Bilimdon o\'yini ketyapti', j.holat === 'kutish' ? 'Xodimlar kirmoqda — kirib «Start»ni bosing' : (j.joriy + 1) + ' / ' + j.soni + '-savol — kuzatish']
    : ['Bilimdon o\'yini ochildi!', j.holat === 'kutish' ? 'Kiring — direktor hozir boshlaydi' : 'O\'yin ketyapti — hali ham kirsa bo\'ladi'];
  return h('button', { type: 'button', class: 'card oyin-banner', onclick: () => { G.sahifa = 'oyin'; G.duel = null; ochish(); } },
    h('span', { class: 'oyin-banner-b', 'aria-hidden': 'true' }, oyinIkon()),
    h('span', { class: 'oyin-banner-m' }, h('b', {}, sarl), h('span', {}, izoh)),
    h('span', { class: 'qator-o', 'aria-hidden': 'true' }, '›'));
}

function oyinIkon() {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '2');
  s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round'); s.setAttribute('aria-hidden', 'true');
  s.innerHTML = '<rect x="2.5" y="7" width="19" height="11" rx="5"/><path d="M7.5 10.5v4M5.5 12.5h4"/><circle cx="15.5" cy="11.5" r="1"/><circle cx="17.5" cy="14" r="1"/>';
  return s;
}

// Asosiy ko'rinish. ctx: { amal, oqi, toast, rerender, x, tg, server }.
export function oyinView(m, ctx) {
  const wrap = h('div', { class: 'oyin', 'aria-live': 'off' });
  const elon = h('div', { class: 'yashirin', role: 'status', 'aria-live': 'polite' });
  m.append(wrap, elon);
  if (!ctx.server) {
    wrap.append(h('div', { class: 'card' }, kartaSarlavha('Bilimdon o\'yini'), h('div', { class: 'muted' }, 'O\'yin Telegram ilovasida (server bilan) ishlaydi. Sinov rejimida yo\'q.')));
    return;
  }
  // wrap sahifaga keyinroq qo'shilishi mumkin (xodim paneli m'ni oxirida qo'shadi) — "olib tashlangan" deb faqat
  // bir marta sahifada bo'lgandan keyin (yoki 5 s ichida hech qo'shilmasa) hisoblanadi.
  let ulangan = false, kutdi = 0;
  const ketdi = () => { if (wrap.isConnected) { ulangan = true; return false; } return ulangan || ++kutdi > 10; };
  const chiz = () => {
    if (ketdi()) { to_xtat(); return; }
    // Kirish animatsiyasi faqat yangi savol/natija/sahifada; boshqa yangilanishda (kimdir javob berdi) — jim.
    const r = joriy(G.h);
    const kalit = [G.sahifa, r && r.id, r && r.holat, r && r.joriy, r && r.ochiq].join('|');
    wrap.classList.toggle('jim', kalit === G.kalit);
    G.kalit = kalit;
    wrap.replaceChildren(...ekran(ctx, chiz));
    const e = G.sahifa === 'oyin' ? elonMatni(r) : '';
    if (e !== G.elon) { G.elon = e; elon.textContent = e; }
  };
  // Faqat O'Z taymerlarini to'xtatadi: amaldan keyin ilova qayta chizilganda eski ko'rinishning kech javobi
  // yangi ko'rinish taymerlarini o'chirib qo'ymasin (aks holda ekran yangilanmay qolardi).
  let timer = null, tik = null;
  const to_xtat = () => { clearInterval(timer); clearInterval(tik); if (G.timer === timer) G.timer = null; if (G.tik === tik) G.tik = null; };
  clearInterval(G.timer); clearInterval(G.tik);
  // 29.10: 1,5 s da server ulanishlari tugab qolgan edi — savolda 2,5 s, kutishda 4 s; xato bo'lsa oraliq uzayadi (10 s gacha).
  const davr = () => {
    const a = G.h && (aktiv(G.h.jonli) || aktiv(G.h.mashq));
    const asos = a && G.sahifa === 'oyin' ? (a.holat === 'savol' ? 2500 : 4000) : 15000;
    return Math.min(asos * 2 ** Math.min(G.xatoSoni || 0, 2), Math.max(asos, 10000));
  };
  let oxirgi = 0, ketyapti = false;
  G.timer = timer = setInterval(() => {
    if (ketdi()) { to_xtat(); return; }
    if (!wrap.isConnected) return;
    if (document.visibilityState === 'hidden' || ketyapti || Date.now() - oxirgi < davr()) return;
    // Server sekin bo'lsa so'rovlar ustma-ust yig'ilmasin: bittasi qaytmaguncha keyingisi ketmaydi, oraliq javobdan keyin sanaladi.
    ketyapti = true;
    const oldin = imzo(G.h);
    yukla(ctx).finally(() => { ketyapti = false; oxirgi = Date.now(); }).then(() => {
      if (G.sahifa !== 'oyin') return;   // duel, profil, reyting, bank — o'z ma'lumoti bilan (bosish yo'qolmasin)
      if (imzo(G.h) !== oldin) { chiz(); return; }
      // Faqat qolgan vaqt o'zgardi — ekran qayta chizilmaydi (miltillamasin), taymer yangi qiymatdan sanaydi.
      const t = wrap.querySelector('[data-taymer]:not([data-vaqt])'), a = joriy(G.h);  // ko'rinib turgan xona (duel taymeri emas)
      if (t && a && a.qoldi != null) t.dataset.taymer = String(a.qoldi);
    });
  }, 500);
  // Taymer chizig'i va soniyalar — har 250 ms (faqat raqam va chiziq yangilanadi).
  G.tik = tik = setInterval(() => {
    const t = wrap.querySelector('[data-taymer]');
    if (!t) return;
    const qoldi = Math.max(0, Number(t.dataset.taymer) - (Date.now() - (Number(t.dataset.vaqt) || G.vaqt)) / 1000), sek = Number(t.dataset.sek) || 20;
    t.querySelector('b').textContent = Math.ceil(qoldi);
    t.querySelector('i').style.transform = 'scaleX(' + (qoldi / sek) + ')';
    t.classList.toggle('kam', qoldi <= 5);
  }, 250);
  if (!G.h) wrap.append(h('div', { class: 'card muted', 'aria-live': 'polite' }, 'Yuklanmoqda…'));
  else chiz();
  oxirgi = Date.now();
  // Audit 10.11: ekran har qayta chizilganda yangi so'rov emas — ketayotgani bo'lsa o'sha, ma'lumot yangi (1,5 s) bo'lsa — so'rovsiz.
  if (!G.h || Date.now() - G.vaqt >= 1500) yukla(ctx, false).then(chiz);
}

const aktiv = (r) => (r && (r.holat === 'kutish' || r.holat === 'savol') ? r : null);
// Ko'rsatiladigan o'yin: ketayotgan mashq/jonli, bo'lmasa tugagan (server 30 daqiqa beradi), «Yopish» bosilgani — yo'q.
const joriy = (H) => (H ? [aktiv(H.jonli), aktiv(H.mashq), H.jonli, H.mashq].find((r) => r && !(r.holat === 'tugadi' && G.yopiq.has(r.id))) : null) || null;
// Qayta chizish kerakmi: qolgan vaqt hisobga olinmaydi; xodimga boshqalarning «javob berdi» belgisi ham (faqat direktor ko'radi) —
// aks holda har hamkasb javobida ekran qayta qurilib, barmoq ostidagi tugma almashib, bosish yo'qolardi.
const imzo = (x) => { const dir = x && x.rol === 'direktor'; return JSON.stringify(x, (k, v) => (k === 'qoldi' || (!dir && k === 'javobBerdi') ? undefined : v)); };
// Ekran o'quvchi e'loni (faqat matn o'zgarganda o'qiladi).
function elonMatni(r) {
  if (!r) return '';
  if (r.holat === 'kutish') return r.men ? 'Siz o\'yindasiz. Direktor boshlashini kuting' : 'O\'yin ochiq';
  if (r.holat === 'tugadi') return 'O\'yin tugadi' + (r.men ? '. Siz: ' + r.men.ball + ' ball' : '');
  const mj = r.men && r.men.javob;
  if (r.ochiq) return mj ? (mj.togri ? 'To\'g\'ri! Plyus ' + mj.ball + ' ball' : mj.ball > 0 ? 'Qisman to\'g\'ri, plyus ' + mj.ball + ' ball' : 'Noto\'g\'ri') : 'Javob ochildi';
  if (mj) return 'Javobingiz qabul qilindi';
  return (r.joriy + 1) + '-savol, ' + r.soni + ' tadan. ' + ((r.savol && r.savol.matn) || '');
}

function ekran(ctx, chiz) {
  const out = [];
  if (G.xato) out.push(h('div', { class: 'msg warn', role: 'alert' }, G.xato));
  const H = G.h || {};
  const direktor = H.rol === 'direktor';
  if (G.sahifa === 'reyting') return [...out, reytingEkran(ctx, chiz)];
  if (G.sahifa === 'bank' && direktor) return [...out, bankEkran(ctx, chiz)];
  if (G.sahifa === 'duel' && !direktor) return [...out, duelEkran(ctx, chiz)];
  if (G.sahifa === 'profil') return [...out, profilEkran(ctx, chiz)];
  const r = joriy(H);
  if (!r || r.holat === 'bekor') return [...out, ...bosh(ctx, chiz, H)];
  out.push(xonaEkran(ctx, chiz, r, direktor));
  return out;
}

// Bosh: o'yin yo'q — direktor ochadi; xodim kutadi yoki mashq qiladi.
function bosh(ctx, chiz, H) {
  const direktor = H.rol === 'direktor';
  const amal = (nom, ...a) => oyinAmal(ctx, nom, ...a).then((r) => { if (r !== null && r !== undefined) yukla(ctx).then(chiz); return r; });
  const out = [h('div', { class: 'card hero oyin-hero' },
    h('span', { class: 'muted' }, 'Jonli o\'yin'), h('b', { class: 'big' }, 'Bilimdon'),
    h('span', { class: 'muted' }, direktor ? '15 savol: test, retsept, simulyator, analoglar, narx va kassa. Siz ochasiz va kuzatasiz — xodimlar telefonida javob beradi.'
      : 'Direktor o\'yin ochganda bot xabar beradi. Tez va to\'g\'ri javob — ko\'p ball!'))];
  if (direktor) out.push(h('button', { class: 'p', style: 'min-height:58px;font-size:18px', onclick: () => oyinTurSheet(ctx, chiz) }, h('span', { 'aria-hidden': 'true' }, '🎮 '), 'Yangi o\'yin ochish'));
  if (!direktor) out.push(...xodimBosh(ctx, chiz, amal));
  else out.push(h('div', { class: 'row' },
    h('button', { onclick: () => amal('oyinMashq', 'klassik') }, 'Mashq qilish'),
    h('button', { onclick: () => { G.sahifa = 'reyting'; G.reyting = null; chiz(); } }, 'Reyting')));
  if (direktor) out.push(vaqtTugma(ctx, chiz), h('button', { class: 's', onclick: () => { G.sahifa = 'bank'; G.bank = null; chiz(); } }, 'Savollar banki · ' + (H.bank || 0) + ' ta savol'));
  if (direktor) out.push(h('div', { class: 'muted' }, 'Mashq — yolg\'iz o\'ynaysiz, ball reytingga kirmaydi.'));
  return out;
}

function xonaEkran(ctx, chiz, r, direktor) {
  const box = h('div', { class: 'oyin-xona' });
  const qayta = () => yukla(ctx).then(chiz);
  const amal = (nom, ...a) => oyinAmal(ctx, nom, ...a).then((x) => { qayta(); return x; });
  const kuzatuvchi = direktor && !r.mashq;
  if (r.tur === 'chaqmoq' && r.holat === 'savol') return chaqmoqEkran(ctx, chiz, r, kuzatuvchi, box, amal);
  // Sarlavha qatori: savol raqami, ball, o'rin.
  const bosh = h('div', { class: 'oyin-bosh' },
    h('span', { class: 'oyin-teg' + (r.tur === 'oxirgi' ? ' qizil' : '') }, r.mashq ? (r.tur === 'simulyator' ? 'Simulyator mashqi' : 'Mashq') : (TUR_NOMI[r.tur] || 'Jonli o\'yin')),
    r.holat === 'savol' ? h('span', { class: 'oyin-teg' }, (r.joriy + 1) + ' / ' + r.soni) : null,
    r.men ? h('span', { class: 'oyin-teg ball' }, r.men.ball + ' ball') : null,
    r.men && !r.mashq && r.holat !== 'kutish' ? h('span', { class: 'oyin-teg' }, r.men.orin + '-o\'rin') : null);
  box.append(bosh);

  if (r.holat === 'kutish') {
    if (!r.men && !kuzatuvchi) {
      box.append(h('div', { class: 'card hero oyin-hero' }, h('b', { class: 'big' }, 'O\'yin ochiq!'), h('span', { class: 'muted' }, 'Kiring — direktor boshlashini kutamiz.')),
        h('button', { class: 'p', style: 'min-height:60px;font-size:19px', onclick: () => { haptik(ctx); amal('oyinQoshil'); } }, 'O\'yinga kirish'));
    } else {
      box.append(h('div', { class: 'card hero oyin-hero' }, h('b', { class: 'big' }, kuzatuvchi ? 'Xodimlar kirmoqda…' : 'Siz o\'yindasiz ✓'),
        h('span', { class: 'muted' }, kuzatuvchi ? 'Hamma kirgach «Start»ni bosing.' : 'Direktor «Start»ni bosishini kuting.')));
    }
    box.append(ishtirokchilar(r, false));
    if (r.tur && r.tur !== 'klassik') box.append(h('div', { class: 'card oyin-qoida' }, h('b', {}, TUR_NOMI[r.tur]), h('span', {}, QOIDA[r.tur] || '')));
    if (kuzatuvchi) box.append(vaqtTugma(ctx, chiz));
    else if (G.h && G.h.vaqt) box.append(h('div', { class: 'muted', style: 'text-align:center' }, 'Har savolga: ' + vaqtNomi(G.h.vaqt)));
    if (kuzatuvchi) {
      box.append(h('button', { class: 'p', style: 'min-height:60px;font-size:19px', disabled: !r.ishtirokchilar.length, onclick: () => amal('oyinStart') }, '▶ Start'),
        h('button', { class: 's', onclick: () => tasdiqlash('O\'yin bekor qilinsinmi?').then((ha) => ha && amal('oyinBekor', false)) }, 'Bekor qilish'));
    }
    return box;
  }

  if (r.holat === 'tugadi') { box.append(...natijalar(ctx, chiz, r, direktor)); return box; }

  // Savol.
  const q = r.savol || {};
  const kop = KOP.includes(q.tur);
  if (G.tanlovSavol !== r.id + ':' + r.joriy) { G.tanlov = []; G.tanlovSavol = r.id + ':' + r.joriy; }
  const meningJavob = r.men && r.men.javob;
  const kech = r.men && r.men.kech;
  const chiqdi = r.men && r.men.chiqdi != null;
  const javobBera = !kuzatuvchi && r.men && !kech && !chiqdi && !meningJavob && !r.ochiq;
  if (r.tur === 'oxirgi' && !r.mashq) box.append(oxirgiQator(r));
  if (chiqdi) box.append(h('div', { class: 'card oyin-kutish' }, h('b', {}, 'Siz o\'yindan chiqdingiz'), h('span', { class: 'muted' }, 'O\'yinni kuzatib turing — kim oxirgi qolarkin?')));
  if (q.jekpot) box.append(h('div', { class: 'card oyin-jekpot', role: 'note' }, h('b', {}, 'JEKPOT'), h('span', {}, 'Bu savol — 2 barobar ball!')));
  if (kech && !r.ochiq) box.append(h('div', { class: 'card oyin-kutish' }, h('b', {}, 'Siz o\'yindasiz ✓'), h('span', { class: 'muted' }, 'Keyingi savoldan javob berasiz.')));
  if (r.ochiq && !kuzatuvchi && r.men && !kech && !chiqdi) {
    const navbat = !r.mashq && !r.egasimi ? h('span', { class: 'oyin-keyin' }, 'Direktor keyingi savolni ochadi — kuting') : null;
    if (meningJavob) {
      const ok = meningJavob.togri;
      if (G.ovoz !== r.id + ':' + r.joriy) { G.ovoz = r.id + ':' + r.joriy; haptik(ctx, ok ? 'ok' : 'xato'); }
      box.append(h('div', { class: 'card oyin-natija ' + (ok ? 'ok' : meningJavob.ball > 0 ? 'qisman' : 'yoq') },
        h('b', { class: 'oyin-natija-b' }, ok ? '✓ To\'g\'ri!' : meningJavob.ball > 0 ? 'Qisman to\'g\'ri' : '✗ Noto\'g\'ri'),
        h('span', {}, '+' + (meningJavob.ball || 0) + ' ball' + (ok && r.men.seriya >= 2 ? ' · ketma-ket ' + r.men.seriya + ' ' : ''),
          ok && r.men.seriya >= 2 ? h('span', { 'aria-hidden': 'true' }, '🔥') : null),
        r.men.chiqadi ? h('span', { class: 'oyin-keyin' }, 'Bu savolda o\'yindan chiqasiz') : null, navbat));
    } else box.append(h('div', { class: 'card oyin-natija yoq' }, h('b', { class: 'oyin-natija-b' }, 'Vaqt tugadi'), h('span', {}, 'Bu savolga javob bermadingiz'),
      r.men.chiqadi ? h('span', { class: 'oyin-keyin' }, 'Bu savolda o\'yindan chiqasiz') : null, navbat));
  }
  if (meningJavob && !r.ochiq) box.append(h('div', { class: 'card oyin-kutish' }, h('b', {}, 'Javobingiz qabul qilindi ✓'), h('span', { class: 'muted' }, 'Hamma javob bergach yoki vaqt tugagach natija chiqadi.')));
  if (!kuzatuvchi && !r.men && !r.mashq && r.tur !== 'oxirgi') {
    box.append(h('div', { class: 'card oyin-kutish' }, h('b', {}, 'Bu savolga javob bera olmaysiz'), h('span', { class: 'muted' }, 'O\'yin boshlangan. Kirsangiz — keyingi savoldan qatnashasiz.')),
      h('button', { class: 'p', onclick: () => amal('oyinQoshil') }, 'O\'yinga kirish'));
  }
  const savolKarta = h('div', { class: 'card oyin-savol' + (q.tur === 'simulyator' ? ' sim' : '') },
    h('span', { class: 'oyin-tur' }, TUR[q.tur] || 'Savol'),
    q.tur === 'simulyator' ? (q.qoshimcha && Array.isArray(q.qoshimcha.monitor) ? monitorKarta(q, r, meningJavob, kuzatuvchi) : bemorKarta(q, r, meningJavob)) : null,
    r.tur === 'birinchi' && !r.ochiq ? h('span', { class: 'muted' }, 'Birinchi to\'g\'ri javob bergan 1000 ball oladi') : null,
    q.tur === 'simulyator' && q.qoshimcha && Array.isArray(q.qoshimcha.monitor)
      ? h('div', { class: 'oyin-vazifa' }, h('small', {}, 'Vazifa'), h('b', {}, q.matn || '')) : h('div', { class: 'oyin-matn' }, q.matn || ''),
    kop && !r.ochiq ? h('span', { class: 'muted' }, 'Bir nechta to\'g\'ri javob bor — hammasini belgilang') : null);
  box.append(savolKarta);
  if (!r.ochiq) box.append(h('div', { class: 'oyin-taymer' + (meningJavob || kuzatuvchi ? ' tinch' : ''), 'data-taymer': String(r.qoldi), 'data-sek': String(r.sek), role: 'timer' },
    h('i', { style: 'transform:scaleX(' + (r.qoldi / r.sek) + ')' }), h('b', {}, Math.ceil(r.qoldi)), h('span', { class: 'yashirin' }, ' soniya qoldi')));

  // Variantlar.
  const tog = new Set(r.ochiq && Array.isArray(q.togri) ? q.togri : []);
  const men = new Set(meningJavob ? meningJavob.javob : []);
  // Ikki ustun — faqat qisqa variantlarda (To'g'ri / Noto'g'ri); uzun matn bir ustunda.
  const ikki = (q.variantlar || []).length === 2 && q.variantlar.every((v) => String(v).length <= 14);
  const vs = h('div', { class: 'oyin-variantlar' + (ikki ? ' ikki' : '') });
  (q.variantlar || []).forEach((v, i) => {
    const tanlangan = javobBera || G.yuborilmoqda ? G.tanlov.includes(i) : men.has(i);
    const cls = ['oyin-v', RANG[i % RANG.length], tanlangan ? 'tanlangan' : '', r.ochiq ? (tog.has(i) ? 'togri' : 'xira') : ''].filter(Boolean).join(' ');
    const yashirin = r.ochiq && tog.has(i) ? ' — to\'g\'ri javob' : '';
    const sanoq = r.ochiq && Array.isArray(r.taqsimot) ? r.taqsimot[i] : null;
    // Ko'p javobli savolda tanlov — faqat shu tugma o'zgaradi (audit 10.11: avval butun blok qayta qurilib, fokus body'ga tushardi).
    const siz = !kuzatuvchi ? h('small', { class: 'oyin-siz', hidden: !tanlangan }, 'Siz tanladingiz') : null;
    const sizY = !kuzatuvchi && !r.ochiq ? h('span', { class: 'yashirin', hidden: !tanlangan }, ' — sizning javobingiz') : null;
    const b = h('button', { type: 'button', class: cls, 'aria-pressed': kop ? String(tanlangan) : null, disabled: !javobBera,
      onclick: () => {
        haptik(ctx);
        if (kop) {
          const on = !G.tanlov.includes(i);
          G.tanlov = on ? [...G.tanlov, i] : G.tanlov.filter((z) => z !== i);
          b.classList.toggle('tanlangan', on);
          b.setAttribute('aria-pressed', String(on));
          if (siz) siz.hidden = !on;
          if (sizY) sizY.hidden = !on;
          yuborYangila();
          return;
        }
        G.tanlov = [i];
        yubor([i]);
      } },
      h('span', { class: 'oyin-harf', 'aria-hidden': 'true' }, HARF[i]), h('span', { class: 'oyin-vm' }, v, siz),
      sizY,
      yashirin || (r.ochiq && tanlangan && !kuzatuvchi) ? h('span', { class: 'yashirin' }, yashirin + (tanlangan && !kuzatuvchi ? ' — sizning javobingiz' : '')) : null,
      r.ochiq && tog.has(i) ? h('span', { class: 'oyin-belgi', 'aria-hidden': 'true' }, '✓') : null,
      r.ochiq && !tog.has(i) && tanlangan && !kuzatuvchi ? h('span', { class: 'oyin-belgi xato', 'aria-hidden': 'true' }, '✗') : null,
      sanoq != null && (kuzatuvchi || r.mashq === false) ? h('span', { class: 'oyin-sanoq', 'aria-label': sanoq + ' kishi tanladi' }, sanoq) : null);
    vs.append(b);
  });
  box.append(vs);
  // Tanlangan variant darhol belgilanadi (server javobini kutmasdan), xato bo'lsa — tanlov olib tashlanadi.
  const yubor = (javob) => {
    if (G.yuborilmoqda) return;
    G.yuborilmoqda = true;
    chiz();
    (ctx.amalFon || ctx.amal)('oyinJavob', r.id, r.joriy, javob).then((ok) => { G.yuborilmoqda = false; if (ok === null || ok === undefined || ok) G.tanlov = []; return yukla(ctx); }).then(chiz)
      .catch(() => { G.yuborilmoqda = false; G.tanlov = []; chiz(); });
  };
  const yuborT = javobBera && kop ? h('button', { class: 'p', style: 'min-height:56px', onclick: () => yubor(G.tanlov.slice().sort()) }) : null;
  // «Javobni yuborish (N)» — tanlovdan keyin shu yerda yangilanadi (blok qayta qurilmaydi).
  function yuborYangila() {
    if (!yuborT) return;
    yuborT.disabled = !G.tanlov.length;
    yuborT.textContent = 'Javobni yuborish' + (G.tanlov.length ? ' (' + G.tanlov.length + ')' : '');
  }
  yuborYangila();
  if (yuborT) box.append(yuborT);

  // Javob ochilgandan keyin: izoh va shu o'yindagi top 5 (natija kartasi — tepada).
  if (r.ochiq) {
    if (q.izoh) box.append(h('div', { class: 'card oyin-izoh' }, h('b', {}, q.tur === 'simulyator' ? 'Nega?' : 'Izoh'), h('span', {}, q.izoh)));
    if (q.qoshimcha && q.qoshimcha.maslahat) box.append(h('div', { class: 'card oyin-maslahat' }, h('b', {}, 'Mijozga nima deysiz?'), h('span', {}, q.qoshimcha.maslahat)));
    if (!r.mashq) box.append(ishtirokchilar(r, true));
  }
  // Boshqaruv: direktor (jonli) yoki xodimning o'zi (mashq).
  if (r.egasimi) {
    if (!r.ochiq) {
      if (!r.mashq) box.append(h('div', { class: 'muted', style: 'text-align:center' }, r.javobBerdi + ' / ' + r.ishtirokchilar.length + ' javob berdi'));
      if (kuzatuvchi) box.append(ishtirokchilar(r, false, true), h('button', { onclick: () => amal('oyinOch', r.id) }, 'Javobni hozir ochish'));
    } else {
      box.append(h('button', { class: 'p', style: 'min-height:58px;font-size:18px', onclick: () => { haptik(ctx); amal('oyinKeyingi', r.id); } },
        r.joriy + 1 >= r.soni ? 'Natijalar' : 'Keyingi savol ▶'));
    }
  }
  if (kuzatuvchi) box.append(h('button', { class: 's', onclick: () => tasdiqlash('O\'yin to\'xtatilsinmi? Natija saqlanmaydi.').then((ha) => ha && amal('oyinBekor', false)) }, 'O\'yinni to\'xtatish'));
  if (r.mashq) box.append(h('button', { class: 's', onclick: () => tasdiqlash('Mashq tugatilsinmi?').then((ha) => ha && amal('oyinBekor', true)) }, 'Mashqni tugatish'));
  return box;
}

// Simulyator: bemor kartasi — yuz, tavsif va sog'liq chizig'i; natijada yaxshilanadi yoki og'irlashadi (o'zi tanlagan javobga qarab).
function bemorKarta(q, r, mj) {
  const qo = q.qoshimcha || {};
  const natija = r.ochiq ? (mj ? (mj.togri ? 'yaxshi' : 'yomon') : (r.egasimi && !r.mashq ? 'kuzat' : 'yomon')) : 'kut';
  const yuz = natija === 'yaxshi' || natija === 'kuzat' ? 'xursand' : natija === 'yomon' ? 'kasal' : 'kut';
  const matn = natija === 'yaxshi' ? qo.yaxshi : natija === 'yomon' ? (mj ? qo.yomon : 'Javob berilmadi — bemor yordam kutib qoldi')
    : natija === 'kuzat' ? 'To\'g\'ri dori berilsa: ' + (qo.yaxshi || '') : null;
  return h('div', { class: 'bemor ' + (natija === 'kuzat' ? 'yaxshi' : natija) },
    h('div', { class: 'bemor-yuz ' + yuz, 'aria-hidden': 'true' }, bemorSvg(yuz)),
    h('div', { class: 'bemor-m' }, h('b', {}, qo.bemor || 'Bemor'),
      h('div', { class: 'bemor-sogliq', role: 'img', 'aria-label': natija === 'yaxshi' || natija === 'kuzat' ? 'Sog\'ayyapti' : natija === 'yomon' ? 'Ahvoli og\'irlashdi' : 'Davolash kutilmoqda' }, h('i', {})),
      matn ? h('span', { class: 'bemor-natija' }, matn) : null));
}

function bemorSvg(yuz) {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 48 48'); s.setAttribute('aria-hidden', 'true');
  const og = yuz === 'kasal', xu = yuz === 'xursand';
  s.innerHTML = '<circle cx="24" cy="24" r="20" fill="' + (og ? '#F6D58A' : xu ? '#BDE8CF' : '#F3E3CF') + '"/>'
    + (xu ? '<path d="M15 21c1.5-2.5 4.5-2.5 6 0M27 21c1.5-2.5 4.5-2.5 6 0" stroke="#0F241B" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="M16 29c4 5 12 5 16 0" stroke="#0F241B" stroke-width="2.4" fill="none" stroke-linecap="round"/>'
      : og ? '<path d="M15 19l5 3M33 19l-5 3" stroke="#0F241B" stroke-width="2.4" stroke-linecap="round"/><circle cx="18" cy="23.5" r="1.8" fill="#0F241B"/><circle cx="30" cy="23.5" r="1.8" fill="#0F241B"/><path d="M17 33c4-4 10-4 14 0" stroke="#0F241B" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="M36 14c1 2 1 3 0 4" stroke="#5DADE2" stroke-width="2" fill="none" stroke-linecap="round"/>'
        : '<circle cx="18" cy="22" r="2" fill="#0F241B"/><circle cx="30" cy="22" r="2" fill="#0F241B"/><path d="M18 31h12" stroke="#0F241B" stroke-width="2.4" stroke-linecap="round"/>');
  return s;
}

// Ishtirokchilar: kutishda — nomlar; savolda (direktor) — kim javob berdi; natijada — top 5.
function ishtirokchilar(r, top, javobBelgisi) {
  const list = r.ishtirokchilar || [];
  if (!list.length) return h('div', { class: 'card muted' }, 'Hali hech kim kirmadi');
  if (!top) {
    return h('div', { class: 'oyin-ishtirok' }, ...list.map((z) => h('span', { class: 'oyin-chip' + (javobBelgisi && z.javobBerdi ? ' berdi' : '') + (z.chiqdi != null ? ' chiqdi' : '') },
      javobBelgisi ? (z.javobBerdi ? '✓ ' : '… ') : '', z.ism)));
  }
  return h('div', { class: 'card oyin-top' }, kartaSarlavha('Shu o\'yinda — top 5'),
    ...list.slice(0, 5).map((z, i) => h('div', { class: 'oyin-qator' + (i === 0 ? ' birinchi' : '') + (z.men ? ' men' : ''), style: 'animation-delay:' + (i * 60) + 'ms' },
      h('span', { class: 'oyin-orin' }, String(i + 1)), h('span', { class: 'oyin-ism', 'data-asl': '' }, z.ism), h('b', {}, z.ball))));
}

function natijalar(ctx, chiz, r, direktor) {
  const list = r.ishtirokchilar || [];
  const out = [h('div', { class: 'card hero oyin-hero' }, h('b', { class: 'big' }, r.mashq ? null : h('span', { 'aria-hidden': 'true' }, '🏆 '), r.mashq ? 'Mashq tugadi' : 'O\'yin tugadi'),
    r.men ? h('span', { class: 'muted' }, 'Siz: ' + r.men.ball + ' ball · ' + r.men.togri + (r.tur === 'chaqmoq' ? '' : ' / ' + (r.tur === 'oxirgi' ? (r.men.chiqdi != null ? r.men.chiqdi : r.joriy) + 1 : r.soni)) + ' to\'g\'ri' + (r.mashq ? '' : ' · ' + r.men.orin + '-o\'rin')) : null,
    r.men && r.men.golib ? h('b', {}, 'Siz oxirgi qoldingiz — g\'olib! +1000') : null)];
  const gol = list.find((z) => z.golib);
  if (gol && !(r.men && r.men.golib)) out.push(h('div', { class: 'card oyin-qoida' }, h('b', {}, 'Oxirgi qolgan: ' + gol.ism), h('span', {}, '+1000 ball')));
  if (!r.mashq && list.length) {
    out.push(h('div', { class: 'podium' }, ...list.slice(0, 3).map((z, i) => h('div', { class: 'podium-u o' + (i + 1) },
      h('span', { class: 'podium-m', 'aria-hidden': 'true' }, ['🥇', '🥈', '🥉'][i]), h('span', { class: 'yashirin' }, (i + 1) + '-o\'rin: '),
      h('b', {}, z.ism), h('span', {}, z.ball + ' ball'), h('i', {})))));
    if (list.length > 3) out.push(h('div', { class: 'card oyin-top' }, ...list.slice(3).map((z, i) => h('div', { class: 'oyin-qator' },
      h('span', { class: 'oyin-orin' }, String(i + 4)), h('span', { class: 'oyin-ism' }, z.ism), h('b', {}, z.ball)))));
  }
  const amal = (nom, ...a) => oyinAmal(ctx, nom, ...a).then(() => yukla(ctx).then(chiz));
  out.push(h('div', { class: 'row' },
    direktor && !r.mashq ? h('button', { class: 'p', onclick: () => oyinTurSheet(ctx, chiz) }, 'Yangi o\'yin')
      : h('button', { class: 'p', onclick: () => amal('oyinMashq', r.tur === 'simulyator' ? 'simulyator' : 'klassik') }, 'Yana mashq'),
    h('button', { onclick: () => { G.sahifa = 'reyting'; G.reyting = null; chiz(); } }, 'Reyting')));
  out.push(h('button', { class: 's', onclick: () => { G.yopiq.add(r.id); chiz(); } }, 'Yopish — bosh sahifa'));
  return out;
}

function reytingEkran(ctx, chiz) {
  const box = h('div', { class: 'oyin-xona' });
  box.append(h('button', { class: 's', style: 'align-self:flex-start', onclick: () => { G.sahifa = 'oyin'; chiz(); } }, '‹ O\'yin'));
  if (!G.reyting) {
    box.append(h('div', { class: 'card muted', 'aria-live': 'polite' }, 'Yuklanmoqda…'));
    ctx.oqi('oyinReyting').then((r) => { G.reyting = r || []; chiz(); }).catch((e) => { G.xato = e.message; G.reyting = []; chiz(); });
    return box;
  }
  if (!G.reyting.length) { box.append(h('div', { class: 'card muted' }, 'Hali jonli o\'yin o\'tkazilmagan.')); return box; }
  let tartib = G.reytingTur || 'hafta';
  const qiy = (z) => (tartib === 'hafta' ? (z.hafta || 0) : tartib === 'oy' ? (z.oy || 0) : z.ball);
  const sort = (a, b) => qiy(b) - qiy(a);
  box.append(pills([['hafta', 'Shu hafta'], ['oy', 'Shu oy'], ['jami', 'Hamma vaqt']], tartib, (v) => { G.reytingTur = v; chiz(); }, 'Reyting davri'));
  const list = G.reyting.slice().sort(sort);
  if (tartib === 'hafta' && list[0] && list[0].hafta) box.append(h('div', { class: 'card hero oyin-hero' }, h('span', { class: 'muted' }, 'Hafta chempioni'), h('b', { class: 'big' }, h('span', { 'aria-hidden': 'true' }, '👑 '), list[0].ism), h('span', { class: 'muted' }, list[0].hafta + ' ball')));
  box.append(h('div', { class: 'card oyin-top' }, ...list.map((z, i) => h('div', { class: 'oyin-qator' + (z.men ? ' men' : '') },
    h('span', { class: 'oyin-orin' }, String(i + 1)),
    h('span', { class: 'oyin-ism' }, z.ism, h('small', {}, z.oyin + ' o\'yin · ' + z.golib + ' g\'alaba · ' + z.togri + ' to\'g\'ri')),
    h('b', {}, String(qiy(z)))))));
  return box;
}

// Savollar banki (direktor): turlar bo'yicha soni, o'z savollari, yangi savol qo'shish.
function bankEkran(ctx, chiz) {
  const box = h('div', { class: 'oyin-xona' });
  box.append(h('button', { class: 's', style: 'align-self:flex-start', onclick: () => { G.sahifa = 'oyin'; chiz(); } }, '‹ O\'yin'));
  if (!G.bank) {
    box.append(h('div', { class: 'card muted', 'aria-live': 'polite' }, 'Yuklanmoqda…'));
    ctx.oqi('oyinSavollar').then((r) => { G.bank = r || { turlar: {}, savollar: [] }; chiz(); }).catch((e) => { G.xato = e.message; G.bank = { turlar: {}, savollar: [] }; chiz(); });
    return box;
  }
  const t = G.bank.turlar || {};
  const hammasi = G.bank.savollar || [];
  // Tur qatori bosilsa — o'sha turdagi hamma savol (javobi va izohi bilan); noto'g'risini o'chirish mumkin.
  box.append(h('div', { class: 'card list' }, kartaSarlavha('Bankdagi savollar'),
    h('div', { class: 'muted' }, 'Turni bosing — savollarni ko\'rib chiqing. Tibbiy jihatdan noto\'g\'ri savolni «O\'chirish» bilan o\'yindan olib tashlang.'),
    ...Object.keys(TUR).filter((k) => k !== 'narx' && k !== 'kassir').map((k) => {
      const ochiq = hammasi.filter((s) => s.tur === k && !s.faol).length;
      return h('button', { type: 'button', class: 'iq', onclick: () => turSheet(ctx, chiz, k) },
        h('span', { class: 'iq-m' }, h('b', {}, TUR[k]), ochiq ? h('span', {}, ochiq + ' ta o\'chirilgan') : null),
        h('b', {}, String(t[k] || 0)), h('span', { class: 'qator-o', 'aria-hidden': 'true' }, '›'));
    }),
    h('div', { class: 'line' }, h('span', {}, TUR.narx + ', ' + TUR.kassir), h('b', {}, 'har o\'yinda avtomatik')),
    h('div', { class: 'muted' }, 'Har o\'yinda 15 savol tanlanadi: eng uzoq vaqt chiqmaganlari birinchi, tartib va variantlar har safar aralashadi.')));
  box.append(h('button', { class: 'p', onclick: () => savolQoshSheet(ctx, chiz) }, '+ O\'z savolimni qo\'shish'));
  const men = hammasi.filter((s) => s.manba === 'direktor');
  if (men.length) box.append(h('div', { class: 'card list' }, kartaSarlavha('Siz qo\'shgan savollar'), ...men.map((s) => savolQator(ctx, chiz, s))));
  return box;
}

function savolQator(ctx, chiz, s, yangila) {
  return h('div', { class: 'item' + (s.faol ? '' : ' oyin-ochiq') },
    h('div', { class: 'line', style: 'border:0;padding:0' }, h('b', {}, TUR[s.tur] || s.tur), h('span', { class: 'muted' }, s.faol ? 'faol' : 'o\'chirilgan')),
    h('div', {}, s.matn),
    h('div', { class: 'muted' }, s.variantlar.map((v, i) => (s.togri.includes(i) ? '✓ ' : '') + v).join(' · ')),
    s.izoh ? h('div', { class: 'muted' }, 'Izoh: ' + s.izoh) : null,
    h('button', { class: 's', style: 'align-self:flex-start', onclick: () => ctx.amal('oyinSavolFaol', s.id, !s.faol).then((ok) => {
      if (ok === null) return;
      s.faol = !s.faol; G.bank = null; chiz(); if (yangila) yangila();
    }) }, s.faol ? 'O\'chirish' : 'Qayta yoqish'));
}

function turSheet(ctx, chiz, tur) {
  const list = ((G.bank && G.bank.savollar) || []).filter((s) => s.tur === tur);
  sheet(TUR[tur] + ' · ' + list.length + ' ta', (box) => {
    const ichi = h('div', { class: 'card list' });
    const qayta = () => ichi.replaceChildren(...list.map((s) => savolQator(ctx, chiz, s, qayta)));
    qayta();
    box.append(ichi);
  }, { fokus: false });
}

function savolQoshSheet(ctx, chiz) {
  sheet('Yangi savol', (box, close) => {
    const f = { tur: 'test', togri: [0] };
    const matn = input('Savol', { inputmode: 'text', placeholder: 'Masalan: Konkor qaysi moddadan iborat?' });
    const vs = [0, 1, 2, 3].map((i) => input('Variant ' + HARF[i], { inputmode: 'text' }));
    const izoh = input('Izoh (javobdan keyin ko\'rinadi)', { inputmode: 'text' });
    const togriJoy = h('div', {});
    const chizT = () => {
      vs.forEach((v) => { v.el.hidden = f.tur === 'togri_notogri'; });
      const n = f.tur === 'togri_notogri' ? ["To'g'ri", "Noto'g'ri"] : vs.map((v, i) => HARF[i]);
      togriJoy.replaceChildren(h('b', {}, f.tur === 'belgila' ? 'To\'g\'ri javoblar (bir nechta)' : 'To\'g\'ri javob'),
        h('div', { class: 'row' }, ...n.map((l, i) => h('button', { type: 'button', class: 's' + (f.togri.includes(i) ? ' p' : ''), 'aria-pressed': String(f.togri.includes(i)),
          onclick: () => { f.togri = f.tur === 'belgila' ? (f.togri.includes(i) ? f.togri.filter((z) => z !== i) : [...f.togri, i]) : [i]; chizT(); } }, l))));
    };
    box.append(pills([['test', 'Test'], ['togri_notogri', 'To\'g\'ri / noto\'g\'ri'], ['belgila', 'Belgilash'], ['shikoyat', 'Shikoyat'], ['muloqot', 'Mijoz bilan']], f.tur,
      (v) => { f.tur = v; f.togri = [0]; chizT(); }, 'Savol turi'), matn.el, ...vs.map((v) => v.el), togriJoy, izoh.el,
    h('div', { class: 'msg info' }, 'Variantlar bir-biriga o\'xshash bo\'lsin — shunda javobni taxmin qilib topib bo\'lmaydi.'),
    h('button', { class: 'p', onclick: () => {
      const variantlar = vs.map((v) => String(v.i.value).trim());
      ctx.amal('oyinSavolQosh', f.tur, matn.i.value, f.tur === 'togri_notogri' ? [] : variantlar, f.togri, izoh.i.value)
        .then((ok) => { if (ok) { close(); ctx.toast('Savol qo\'shildi ✓'); G.bank = null; chiz(); } });
    } }, 'Saqlash'));
    chizT();
  });
}

// ===================== «Bilimdon» 2 (29.10): o'yin turlari, simulyator monitori, chaqmoq, duel, nishonlar =====================
const QOIDA = {
  oxirgi: 'Har savolda xato qilgan yoki javob bermagan chiqadi (hamma xato qilsa — hech kim). Oxirgi qolgan — g\'olib, +1000 ball.',
  simulyator: 'Bemor vaziyatlari: monitorga qarang, topshiriqni o\'qing, to\'g\'ri dorini tanlang.',
  chaqmoq: '90 soniya: savollar ketma-ket, har kim o\'z sur\'atida. Har to\'g\'ri javob — 100 ball (ketma-ket bo\'lsa ko\'proq).',
  birinchi: 'Birinchi bo\'lib to\'g\'ri javob bergan 1000 ball oladi, qolganlar — 0. Tez bo\'ling!',
  mijoz: 'Mijoz bilan ishlash: shikoyat, muloqot, retsept kerakmi va bemor vaziyatlari.'
};

// Direktor: yangi o'yin — turi, mavzu, savollar soni, jekpot.
function oyinTurSheet(ctx, chiz) {
  const f = { tur: 'klassik', mavzu: '', soni: 15, jekpot: true };
  sheet('Qanday o\'yin bo\'lsin?', (box, close) => {
    const joy = h('div', { style: 'display:flex;flex-direction:column;gap:10px' });
    const draw = () => {
      joy.replaceChildren(
        h('div', { class: 'oyin-turlar', role: 'radiogroup', 'aria-label': 'O\'yin turi' }, ...OYIN_TUR.map(([k, n, iz]) => h('button', { type: 'button', role: 'radio',
          class: 'oyin-tur-b' + (f.tur === k ? ' tanlandi' : ''), 'aria-checked': String(f.tur === k), onclick: () => { f.tur = k; draw(); } },
          h('b', {}, n), h('span', {}, iz)))),
        h('b', {}, 'Mavzu'), pills(MAVZU, f.mavzu, (v) => { f.mavzu = v; }, 'Mavzu'),
        f.tur === 'chaqmoq' ? h('div', { class: 'muted' }, 'Chaqmoqda vaqt umumiy — 90 soniya, savollar yetarlicha.')
          : h('div', { style: 'display:flex;flex-direction:column;gap:10px' },
            h('b', {}, 'Savollar soni'), pills([[10, '10'], [15, '15'], [20, '20']], f.soni, (v) => { f.soni = v; }, 'Savollar soni'),
            h('b', {}, 'Jekpot savol (2× ball)'), pills([[true, 'Bor'], [false, 'Yo\'q']], f.jekpot, (v) => { f.jekpot = v; }, 'Jekpot')));
    };
    draw();
    box.append(joy, h('button', { class: 'p', style: 'min-height:56px;font-size:18px', onclick: () => ctx.amal('oyinYarat', f.tur, f.soni, f.mavzu, f.tur !== 'chaqmoq' && f.jekpot)
      .then((r) => { if (r === null || r === undefined) return; close(); ctx.toast('O\'yin ochildi — xodimlarga xabar ketdi ✓'); yukla(ctx).then(chiz); }) }, 'O\'yinni ochish'));
  }, { fokus: false });
}

// Profil (hafta, oy, zaif turlar, nishonlar) — 1 daqiqa keshlanadi.
function profilOl(ctx, chiz) {
  if (G.profilYuk || Date.now() - (G.profilVaqt || 0) < 60000) return G.profil;
  G.profilYuk = true;
  G.profilVaqt = Date.now();
  ctx.oqi('oyinProfil').then((p) => { G.profil = p; G.profilVaqt = Date.now(); }).catch(() => { G.profilVaqt = Date.now(); G.profil = G.profil || {}; })
    .finally(() => { G.profilYuk = false; chiz(); });
  return G.profil;
}

// Xodimning o'yin bosh sahifasi (maket: «O'yin bosh sahifasi»).
function xodimBosh(ctx, chiz, amal) {
  const p = profilOl(ctx, chiz) || {};
  const out = [];
  const hf = (p.hafta && p.hafta.men) || null, ch = p.hafta && p.hafta.chempion;
  out.push(h('section', { class: 'card oyin-hafta' }, h('div', { class: 'line', style: 'border:0;padding:0' }, h('b', {}, 'Shu hafta'), h('span', { class: 'muted' }, 'dushanbadan')),
    h('div', { class: 'oyin-hafta-g' },
      h('div', {}, h('span', {}, 'O\'rningiz'), h('b', {}, hf ? String(hf.orin) : '—')),
      h('div', {}, h('span', {}, 'Ball'), h('b', {}, hf ? fmt(hf.ball) : '0')),
      h('div', {}, h('span', {}, 'To\'g\'ri'), h('b', {}, hf && hf.foiz != null ? hf.foiz + '%' : '—'))),
    ch ? h('span', { class: 'muted' }, 'Chempion: ' + ch.ism + ' — ' + fmt(ch.ball) + ' ball' + (hf && ch.ball > hf.ball ? '. Yana ' + fmt(ch.ball - hf.ball) + ' ball kerak.' : '')) : null));
  out.push(h('h2', { class: 'oyin-bo' }, 'O\'zim mashq qilaman'),
    h('div', { class: 'oyin-plitkalar' },
      h('button', { type: 'button', class: 'oyin-plitka', onclick: () => amal('oyinMashq', 'simulyator') },
        h('span', { class: 'oyin-pb qizil', 'aria-hidden': 'true' }, ikon('M3 12h4l2-5 4 10 2-5h6')), h('b', {}, 'Bemor simulyatori'), h('span', {}, '8 ta vaziyat · monitor bilan')),
      h('button', { type: 'button', class: 'oyin-plitka', onclick: () => amal('oyinMashq', 'klassik') },
        h('span', { class: 'oyin-pb', 'aria-hidden': 'true' }, ikon('M9 9a3 3 0 1 1 4 2.8c-.6.3-1 .9-1 1.6V14M12 18h.01')), h('b', {}, '10 savollik mashq'), h('span', {}, 'Faqat bizdagi dorilar'))),
    h('div', { class: 'oyin-plitkalar' },
      h('button', { type: 'button', class: 'oyin-plitka', onclick: () => { G.sahifa = 'duel'; G.duelH = null; G.duel = null; chiz(); } },
        h('span', { class: 'oyin-pb sariq', 'aria-hidden': 'true' }, ikon('M14.5 17.5L3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2')), h('b', {}, 'Duel 1×1'), h('span', {}, 'Hamkasbingizni chaqiring')),
      h('button', { type: 'button', class: 'oyin-plitka', onclick: () => { G.sahifa = 'profil'; G.sahifaOchildi = null; chiz(); } },
        h('span', { class: 'oyin-pb binafsha', 'aria-hidden': 'true' }, ikon('M8 4h8v5a4 4 0 0 1-8 0zM12 13v4M8 21h8M9 17h6')), h('b', {}, 'Nishonlar'),
        h('span', {}, (p.nishonlar ? p.nishonlar.filter((n) => n.olindi).length : 0) + ' / 12 · Oy bilimdoni'))));
  if (p.zaif && p.zaif.length) {
    out.push(h('section', { class: 'card' }, h('b', {}, 'Zaif joylaringiz'),
      ...p.zaif.map((z) => h('div', { class: 'line' }, h('span', {}, TUR[z.tur] || z.tur), h('b', { style: 'color:' + (z.foiz < 50 ? 'var(--chiqim)' : 'var(--warn)') }, z.foiz + '%'))),
      h('span', { class: 'muted' }, 'Mashqda shu turdagi savollar ham chiqadi — har kuni bir oz mashq qiling.')));
  }
  out.push(h('button', { onclick: () => { G.sahifa = 'reyting'; G.reyting = null; chiz(); } }, 'Reyting'));
  return out;
}

const fmt = (n) => String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
function ikon(d) {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '2');
  s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round'); s.setAttribute('aria-hidden', 'true');
  s.innerHTML = '<path d="' + d + '"/>';
  return s;
}

// Oxirgi qolgan: kim qoldi, kim chiqdi.
function oxirgiQator(r) {
  const list = r.ishtirokchilar || [];
  return h('section', { class: 'card oyin-oxirgi', 'aria-label': 'O\'yinchilar' },
    h('div', { class: 'line', style: 'border:0;padding:0' }, h('b', {}, 'O\'yinda qoldi: ' + r.faol + ' / ' + list.length), h('span', { class: 'muted' }, 'xato — chiqadi')),
    h('div', { class: 'oyin-ishtirok' }, ...list.map((z) => h('span', { class: 'oyin-chip' + (z.chiqdi != null ? ' chiqdi' : ' faol') },
      z.ism + (z.men ? ' (siz)' : ''), z.chiqdi != null ? h('span', { class: 'yashirin' }, ' — chiqdi') : null))));
}

// Simulyator monitori (B «kasalxona monitori», 29.10): qorong'i ekran, katta raqamlar, me'yor yozilgan.
// Javob ochilgach — tanlangan dori natijasi (direktorga: to'g'ri dori): «1 soatdan keyin», har raqam ostida «▼ 1,4 · edi 38,9»,
// rang — me'yorga yaqinlashdimi (yaxshilansa yashil/sariq, yomonlashsa qizil); xato dori — qizil «Ogohlantirish» (raqam yaxshi
// ko'rinsa ham dori xavfli bo'lishi mumkin), to'g'risi — «To'g'ri tanlov».
export function monitorKarta(q, r, mj, kuzatuvchi) {
  const qo = q.qoshimcha || {};
  // Tomoshabin (o'yinda emas, kech kirgan yoki chiqqan) — direktordek to'g'ri dori natijasini ko'radi; «javob berilmadi» — faqat javob bera olganga.
  if (r.ochiq && !mj && !kuzatuvchi && (!r.men || r.men.kech || r.men.chiqdi != null)) kuzatuvchi = true;
  const nat = Array.isArray(qo.natija) ? qo.natija : null;
  const tanlov = r.ochiq && nat ? (mj && Array.isArray(mj.javob) ? mj.javob[0] : kuzatuvchi && Array.isArray(q.togri) ? q.togri[0] : null) : null;
  const n = tanlov != null ? nat[tanlov] : null;
  const ok = r.ochiq ? (mj ? !!(mj.togri || mj.kech) : !!kuzatuvchi) : null;
  const javobsiz = r.ochiq && !mj && !kuzatuvchi;
  const yosh = bemorYoshi(qo.bemor);
  const qatorlar = (qo.monitor || []).map((m) => {
    const c = monMeyor(m.k, yosh);
    const yangi = n && n.qiymatlar && typeof n.qiymatlar[m.k] === 'number' ? n.qiymatlar[m.k] : null;
    const v = yangi != null ? yangi : m.qiymat;
    const eskiM = m.matn || sonMatn(m.qiymat);
    const holat = monHolat(c, v);
    const uzoq = (x) => (x < c.lo ? c.lo - x : x > c.hi ? x - c.hi : 0);
    // Natijada rang yo'nalishga qarab: me'yorga yaqinlashsa — me'yorda yashil, aks holda sariq; uzoqlashsa — qizil
    // (to'g'ri dorida — sariq: kutilgan nojo'ya ta'sir, masalan salbutamoldan puls biroz tezlashadi; izohda aytilgan).
    const rang = yangi == null ? holat : uzoq(yangi) > uzoq(m.qiymat) ? (ok ? 'diq' : 'xavf')
      : holat === 'ok' ? 'ok' : uzoq(yangi) < uzoq(m.qiymat) ? 'diq' : holat;
    const farq = yangi != null ? Math.round((yangi - m.qiymat) * 10) / 10 : 0;
    return { c, m, yangi, v, rang, holat, eskiM, farq,
      matn: yangi != null ? ((n.matnlar && n.matnlar[m.k]) || sonMatn(yangi)) : eskiM };
  });
  const bor = (x) => qatorlar.some((z) => (r.ochiq && n ? z.rang : z.holat) === x);
  const umumiy = !r.ochiq || javobsiz ? (bor('xavf') ? 'xavf' : bor('diq') ? 'diq' : 'ok') : ok ? (bor('xavf') || bor('diq') ? 'diq' : 'ok') : 'xavf';
  const yorliq = !r.ochiq ? { xavf: 'Xavf', diq: 'Kuzatuv', ok: 'Barqaror' }[umumiy]
    : javobsiz ? 'Yordam kutmoqda' : ok ? (umumiy === 'ok' ? 'Barqaror' : 'Yaxshilanmoqda') : 'Ogohlantirish';
  const dori = tanlov != null && Array.isArray(q.variantlar) ? q.variantlar[tanlov] : null;
  const sarlavha = !r.ochiq ? 'Bemor' : javobsiz ? 'Javob berilmadi'
    : (kuzatuvchi && !mj ? 'To\'g\'ri dori: ' : mj && mj.kech ? 'Vaqt tugagach: ' : '') + (dori ? dori + ' · ' : '') + '1 soatdan keyin';
  const iz = n && n.izoh ? n.izoh : null;
  // Xato dorida umumiy «yomon» matni shu dorining raqamlariga zid bo'lishi mumkin (ich to'xtadi, lekin xavfli) — o'z izohi bo'lsa, u yetarli.
  const iqtibos = !r.ochiq ? null : javobsiz ? 'Bemor yordam kutib qoldi.' : ok ? (qo.yaxshi || '') : iz ? null : (qo.yomon || '');
  return h('div', { class: 'monitor m-' + umumiy + (r.ochiq ? ' ochiq' : ''), role: 'group', 'aria-label': 'Bemor monitori' },
    h('div', { class: 'mon-top' }, h('span', {}, sarlavha), h('span', { class: 'mon-holat m-' + umumiy }, h('i', { 'aria-hidden': 'true' }), yorliq)),
    h('div', { class: 'mon-bemor' }, qo.bemor || 'Bemor'),
    ekg(umumiy),
    h('div', { class: 'mon-kat' + (qatorlar.length === 1 ? ' bir' : ''), role: 'list' }, ...qatorlar.map((z) => h('div', { class: 'mon-qut', role: 'listitem' },
      h('small', {}, z.c.n),
      h('b', { class: 'm-' + z.rang }, z.matn, z.c.b.trim() ? h('em', {}, z.c.b.trim()) : null),
      z.yangi != null ? h('span', {}, z.farq ? h('span', { 'aria-hidden': 'true' }, z.farq < 0 ? '▼ ' : '▲ ') : null,
        z.farq ? h('span', { class: 'yashirin' }, z.farq < 0 ? 'pasaydi ' : 'oshdi ') : null,
        (z.farq ? sonMatn(Math.abs(z.farq)) + ' · ' : '') + 'edi ' + z.eskiM)
        : h('span', {}, 'me\'yor ' + sonMatn(z.c.lo) + '–' + sonMatn(z.c.hi)),
      h('span', { class: 'yashirin' }, z.rang === 'ok' ? ' — me\'yorda' : z.rang === 'diq' ? ' — me\'yordan biroz chetda' : ' — xavfli darajada')))),
    r.ochiq && !javobsiz && (ok ? iz : true) ? h('div', { class: 'mon-xulosa ' + (ok ? 'ok' : 'xavf') },
      h('b', {}, mj && mj.kech ? '✓ Dori to\'g\'ri — lekin vaqt tugadi' : ok ? '✓ To\'g\'ri tanlov' : '⚠ Ogohlantirish'), iz ? h('span', {}, iz) : null) : null,
    iqtibos ? h('div', { class: 'mon-iqtibos' }, '«' + iqtibos.replace(/^«|»$/g, '') + '»') : null);
}

// Monitor chizig'i (EKG): holatga qarab rang; tez yurak — tishlar zichroq. Bezak (aria-hidden).
function ekg(holat) {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 340 40'); s.setAttribute('aria-hidden', 'true'); s.setAttribute('class', 'mon-ekg m-' + holat);
  const qadam = holat === 'xavf' ? 70 : 100;
  let p = '0,24';
  for (let x = 20; x + 30 < 340; x += qadam) p += ' ' + x + ',24 ' + (x + 6) + ',24 ' + (x + 11) + ',6 ' + (x + 17) + ',36 ' + (x + 22) + ',24';
  s.innerHTML = '<polyline points="' + p + ' 340,24" fill="none" stroke-width="2.5" stroke-linejoin="round"/>';
  return s;
}

// Chaqmoq: har kim o'z sur'atida, darhol natija; umumiy 90 s.
function chaqmoqEkran(ctx, chiz, r, kuzatuvchi, box, amal) {
  box.append(h('div', { class: 'oyin-bosh' }, h('span', { class: 'oyin-teg sariq' }, 'Chaqmoq'),
    r.men ? h('span', { class: 'oyin-teg' }, 'To\'g\'ri: ' + r.men.togri) : null, r.men ? h('span', { class: 'oyin-teg ball' }, r.men.ball + ' ball') : null));
  if (!r.ochiq) box.append(h('div', { class: 'oyin-taymer', 'data-taymer': String(r.qoldi), 'data-sek': String(r.sek), role: 'timer' },
    h('i', { style: 'transform:scaleX(' + (r.qoldi / r.sek) + ')' }), h('b', {}, Math.ceil(r.qoldi)), h('span', { class: 'yashirin' }, ' soniya qoldi')));
  if (r.ochiq) {
    box.append(h('div', { class: 'card oyin-natija ok' }, h('b', { class: 'oyin-natija-b' }, 'Vaqt tugadi!'),
      h('span', {}, r.men ? r.men.togri + ' ta to\'g\'ri · ' + r.men.ball + ' ball' : 'Natijalarni oching')));
  } else if (!kuzatuvchi && r.men && r.savol) {
    const q = r.savol;
    const fl = G.chaq && Date.now() - G.chaq.vaqt < 1200 ? G.chaq : null;
    if (fl) box.append(h('div', { class: 'card oyin-flash ' + (fl.togri ? 'ok' : 'yoq'), role: 'status' }, fl.togri ? '✓ To\'g\'ri! +' + fl.ball : '✗ Noto\'g\'ri'));
    box.append(h('div', { class: 'card oyin-savol' }, h('span', { class: 'oyin-tur' }, TUR[q.tur] || 'Savol'), h('div', { class: 'oyin-matn' }, q.matn || '')));
    const ikki = (q.variantlar || []).length === 2 && q.variantlar.every((v) => String(v).length <= 14);
    box.append(h('div', { class: 'oyin-variantlar' + (ikki ? ' ikki' : '') }, ...(q.variantlar || []).map((v, i) => h('button', { type: 'button', class: 'oyin-v ' + RANG[i % RANG.length],
      disabled: G.yuborilmoqda, onclick: () => {
        if (G.yuborilmoqda) return;
        G.yuborilmoqda = true; haptik(ctx);
        (ctx.amalFon || ctx.amal)('oyinJavob', r.id, r.joriy, [i]).then((res) => {
          if (res && typeof res === 'object' && !res.takror) { G.chaq = { togri: res.togri, ball: res.ball, vaqt: Date.now() }; haptik(ctx, res.togri ? 'ok' : 'xato'); }
          return yukla(ctx);
        }).then(() => { G.yuborilmoqda = false; chiz(); }).catch(() => { G.yuborilmoqda = false; chiz(); });
      } }, h('span', { class: 'oyin-harf', 'aria-hidden': 'true' }, HARF[i]), h('span', { class: 'oyin-vm' }, v)))));
  } else if (!kuzatuvchi && r.men && !r.savol) {
    box.append(h('div', { class: 'card oyin-natija ok' }, h('b', { class: 'oyin-natija-b' }, 'Hammasini yechdingiz!'), h('span', {}, 'Vaqt tugashini kuting')));
  } else if (!kuzatuvchi && !r.men) box.append(h('div', { class: 'card muted' }, 'Bu chaqmoq boshlangan — keyingi o\'yinda qatnashasiz.'));
  // Jonli reyting: kim nechta yechdi.
  box.append(h('div', { class: 'card oyin-top' }, kartaSarlavha('Hozir'), ...(r.ishtirokchilar || []).slice(0, 8).map((z, i) => h('div', { class: 'oyin-qator' + (z.men ? ' men' : '') },
    h('span', { class: 'oyin-orin' }, String(i + 1)), h('span', { class: 'oyin-ism' }, z.ism, h('small', {}, (z.togri || 0) + ' to\'g\'ri')), h('b', {}, z.ball)))));
  if (r.egasimi && r.ochiq) box.append(h('button', { class: 'p', style: 'min-height:58px;font-size:18px', onclick: () => amal('oyinKeyingi', r.id) }, 'Natijalar'));
  if (kuzatuvchi) box.append(h('button', { class: 's', onclick: () => tasdiqlash('O\'yin to\'xtatilsinmi? Natija saqlanmaydi.').then((ha) => ha && amal('oyinBekor', false)) }, 'O\'yinni to\'xtatish'));
  return box;
}

// ===== Duel =====
function duelHolatOl(ctx, chiz) {
  if (G.duelH || G.duelYuk) return G.duelH;
  G.duelYuk = true;
  ctx.oqi('duelHolat').then((d) => { G.duelH = d; }).catch((e) => { G.xato = e.message; G.duelH = { duellar: [], raqiblar: [], reyting: [] }; })
    .finally(() => { G.duelYuk = false; chiz(); });
  return null;
}
const duelYangila = (ctx, chiz) => { G.duelH = null; duelHolatOl(ctx, chiz); };

function duelEkran(ctx, chiz) {
  const box = h('div', { class: 'oyin-xona' });
  box.append(h('button', { class: 's', style: 'align-self:flex-start', onclick: () => { G.sahifa = 'oyin'; G.duel = null; chiz(); } }, '‹ O\'yin'));
  if (G.duel) return duelOyin(ctx, chiz, box);
  const d = duelHolatOl(ctx, chiz);
  if (!d) { box.append(h('div', { class: 'card muted', 'aria-live': 'polite' }, 'Yuklanmoqda…')); return box; }
  const amal = (nom, ...a) => ctx.amal(nom, ...a).then((x) => { if (x !== null && x !== undefined) duelYangila(ctx, chiz); return x; });
  const boshla = (id) => (typeof id !== 'string' ? duelYangila(ctx, chiz)
    : ctx.amal('duelSavol', id).then((s) => { if (s && s.savol) { G.duel = { id, s, vaqt: Date.now(), nat: null }; chiz(); } else if (s) duelYangila(ctx, chiz); }));
  const chaqiruv = d.duellar.filter((z) => z.holat === 'kutish' && !z.menChaqirdim);
  chaqiruv.forEach((z) => box.append(h('section', { class: 'card oyin-duel-ch' }, h('span', { class: 'muted' }, 'Sizga chaqiruv keldi'),
    h('div', { class: 'oyin-vs' }, h('b', {}, z.raqibIsm), h('span', {}, 'VS'), h('b', {}, 'Siz')),
    h('span', { class: 'muted' }, z.soni + ' savol · 24 soat ichida'),
    h('div', { class: 'row' }, h('button', { class: 'p', onclick: () => amal('duelQabul', z.id, true).then((ok) => ok !== null && boshla(z.id)) }, 'Qabul qilaman'),
      h('button', { onclick: () => amal('duelQabul', z.id, false) }, 'Rad etaman')))));
  const ochiq = d.duellar.filter((z) => z.holat !== 'tugadi' && z.holat !== 'rad' && !z.men.tugadi && (z.menChaqirdim || z.holat === 'qabul'));
  if (ochiq.length) box.append(h('section', { class: 'card list' }, kartaSarlavha('O\'ynash kerak'), ...ochiq.map((z) => h('div', { class: 'item' },
    h('div', { class: 'line', style: 'border:0;padding:0' }, h('b', {}, z.raqibIsm), h('span', { class: 'muted' }, z.men.joriy + ' / ' + z.soni)),
    h('button', { class: 'p', onclick: () => boshla(z.id) }, z.men.joriy ? 'Davom etish' : 'Boshlash')))));
  const kutish = d.duellar.filter((z) => z.holat !== 'tugadi' && z.holat !== 'rad' && z.men.tugadi);
  if (kutish.length) box.append(h('section', { class: 'card list' }, kartaSarlavha('Raqib o\'ynashini kutyapsiz'), ...kutish.map((z) => h('div', { class: 'line' },
    h('span', {}, z.raqibIsm), h('b', {}, fmt(z.men.ball) + ' ball')))));
  box.append(h('h2', { class: 'oyin-bo' }, 'Kimni chaqirasiz?'),
    h('section', { class: 'card list' }, ...d.raqiblar.map((z) => h('div', { class: 'oyin-raqib' },
      h('span', { class: 'oyin-orin', 'aria-hidden': 'true' }, z.ism[0]), h('span', { class: 'oyin-ism' }, z.ism, h('small', {}, z.golib + z.maglub ? 'siz bilan ' + z.golib + ':' + z.maglub : 'hali o\'ynamagansiz')),
      h('button', { class: 'p', onclick: () => amal('duelChaqir', z.id).then((id) => id && (ctx.toast(z.ism + 'ga chaqiruv ketdi ✓'), boshla(id))) }, 'Chaqirish'))),
      h('div', { class: 'oyin-raqib' }, h('span', { class: 'oyin-orin', 'aria-hidden': 'true' }, '?'), h('span', { class: 'oyin-ism' }, 'Tasodifiy raqib', h('small', {}, 'bo\'sh turgan hamkasb')),
        h('button', { onclick: () => amal('duelChaqir', null).then((id) => id && boshla(id)) }, 'Topish'))));
  const tug = d.duellar.filter((z) => z.holat === 'tugadi' || z.holat === 'rad').slice(0, 10);
  if (tug.length) box.append(h('section', { class: 'card list' }, kartaSarlavha('Natijalar'), ...tug.map((z) => h('div', { class: 'line' },
    h('span', {}, z.raqibIsm + (z.holat === 'rad' ? ' · rad etildi' : '')),
    h('b', { style: z.natija === 'golib' ? 'color:var(--kirim)' : z.natija === 'maglub' ? 'color:var(--chiqim)' : '' },
      z.holat === 'rad' ? '—' : fmt(z.men.ball) + ' : ' + (z.raqib.ball == null ? '—' : fmt(z.raqib.ball)) + (z.natija === 'golib' ? ' · g\'alaba' : z.natija === 'maglub' ? ' · mag\'lubiyat' : z.natija === 'durrang' ? ' · durrang' : ''))))));
  if (d.reyting.length) box.append(h('section', { class: 'card list' }, kartaSarlavha('Duel reytingi · shu oy'), ...d.reyting.map((z, i) => h('div', { class: 'line' + (z.men ? ' men' : '') },
    h('span', {}, (i + 1) + '. ' + z.ism), h('b', {}, z.golib + ' g\'alaba')))));
  return box;
}

function duelOyin(ctx, chiz, box) {
  const D = G.duel, s = D.s, q = s.savol || {};
  box.append(h('div', { class: 'oyin-bosh' }, h('span', { class: 'oyin-teg sariq' }, 'Duel'), h('span', { class: 'oyin-teg' }, (s.i + 1) + ' / ' + s.soni),
    h('span', { class: 'oyin-teg ball' }, fmt((D.nat ? D.nat.jami : s.ball) || 0) + ' ball')));
  const kop = KOP.includes(q.tur);
  if (D.nat) {
    const n = D.nat;
    // Vaqt tugagach to'g'ri variant bosilsa — server 0 ball beradi; «Noto'g'ri» emas, «Vaqt tugadi».
    // 11.11: server 'kech' beradi (to'g'ri variant raqibdan yashirin bo'lsa ham «Vaqt tugadi» to'g'ri chiqadi).
    const tanlovTogri = n.kech === true || (Array.isArray(n.togriJavob) && (D.tanlov || []).length === 1 && n.togriJavob.includes(D.tanlov[0]));
    box.append(h('div', { class: 'card oyin-natija ' + (n.togri ? 'ok' : 'yoq'), role: 'status' },
      h('b', { class: 'oyin-natija-b' }, n.togri ? '✓ To\'g\'ri!' : tanlovTogri ? 'Vaqt tugadi' : '✗ Noto\'g\'ri'),
      h('span', {}, '+' + (n.ball || 0) + ' ball')));
    if (n.yashirin) box.append(h('div', { class: 'muted' }, 'To\'g\'ri javob va izoh raqib ham shu savolga javob bergach ochiladi — adolatli bo\'lsin.'));
    const nq = n.qoshimcha && Array.isArray(n.qoshimcha.monitor) && Array.isArray(n.qoshimcha.natija) && q.tur === 'simulyator';
    if (nq) box.append(h('div', { class: 'card oyin-savol' }, monitorKarta({ ...q, qoshimcha: n.qoshimcha, togri: n.togriJavob }, { ochiq: true },
      { javob: D.tanlov || [], togri: n.togri, kech: !n.togri && tanlovTogri }, false)));
    if (n.izoh) box.append(h('div', { class: 'card oyin-izoh' }, h('b', {}, nq ? 'Nega?' : 'Izoh'), h('span', {}, n.izoh)));
    if (n.qoshimcha && n.qoshimcha.maslahat) box.append(h('div', { class: 'card oyin-maslahat' }, h('b', {}, 'Mijozga nima deysiz?'), h('span', {}, n.qoshimcha.maslahat)));
    box.append(h('button', { class: 'p', style: 'min-height:56px', onclick: () => {
      if (n.tugadi) { G.duel = null; duelYangila(ctx, chiz); chiz(); return; }
      ctx.amal('duelSavol', D.id).then((s2) => {
        if (s2 && s2.savol) { G.duel = { id: D.id, s: s2, vaqt: Date.now(), nat: null }; chiz(); }
        else if (s2) { G.duel = null; duelYangila(ctx, chiz); chiz(); }
      });
    } }, n.tugadi ? 'Tugatdim — natijani kutaman' : 'Keyingi savol ▶'));
    return box;
  }
  box.append(h('div', { class: 'card oyin-savol' }, h('span', { class: 'oyin-tur' }, TUR[q.tur] || 'Savol'),
    q.tur === 'simulyator' && q.qoshimcha && Array.isArray(q.qoshimcha.monitor) ? monitorKarta(q, { ochiq: false }, null, false) : null,
    q.tur === 'simulyator' && q.qoshimcha && Array.isArray(q.qoshimcha.monitor)
      ? h('div', { class: 'oyin-vazifa' }, h('small', {}, 'Vazifa'), h('b', {}, q.matn || '')) : h('div', { class: 'oyin-matn' }, q.matn || ''), kop ? h('span', { class: 'muted' }, 'Bir nechta to\'g\'ri javob bor — hammasini belgilang') : null));
  box.append(h('div', { class: 'oyin-taymer', 'data-taymer': String(s.qoldi), 'data-sek': String(s.sek), 'data-vaqt': String(D.vaqt), role: 'timer' },
    h('i', { style: 'transform:scaleX(' + (s.qoldi / s.sek) + ')' }), h('b', {}, Math.ceil(s.qoldi)), h('span', { class: 'yashirin' }, ' soniya qoldi')));
  D.tanlov = D.tanlov || [];
  const yubor = (javob) => {
    if (G.yuborilmoqda) return;
    G.yuborilmoqda = true;
    ctx.amal('duelJavob', D.id, s.i, javob).then((n) => {
      G.yuborilmoqda = false;
      if (n && n.takror) { G.duel = null; duelYangila(ctx, chiz); }
      else if (n) { haptik(ctx, n.togri ? 'ok' : 'xato'); D.nat = { ...n, jami: (s.ball || 0) + (n.ball || 0) }; }
      chiz();
    }).catch(() => { G.yuborilmoqda = false; chiz(); });
  };
  const ikki = (q.variantlar || []).length === 2 && q.variantlar.every((v) => String(v).length <= 14);
  box.append(h('div', { class: 'oyin-variantlar' + (ikki ? ' ikki' : '') }, ...(q.variantlar || []).map((v, i) => h('button', { type: 'button',
    class: 'oyin-v ' + RANG[i % RANG.length] + (D.tanlov.includes(i) ? ' tanlangan' : ''), 'aria-pressed': kop ? String(D.tanlov.includes(i)) : null, disabled: G.yuborilmoqda,
    onclick: () => { haptik(ctx); if (kop) { D.tanlov = D.tanlov.includes(i) ? D.tanlov.filter((z) => z !== i) : [...D.tanlov, i]; chiz(); return; } D.tanlov = [i]; yubor([i]); } },
  h('span', { class: 'oyin-harf', 'aria-hidden': 'true' }, HARF[i]), h('span', { class: 'oyin-vm' }, v)))));
  if (kop) box.append(h('button', { class: 'p', style: 'min-height:56px', disabled: !D.tanlov.length, onclick: () => yubor(D.tanlov.slice().sort()) }, 'Javobni yuborish' + (D.tanlov.length ? ' (' + D.tanlov.length + ')' : '')));
  return box;
}

// ===== Nishonlar va «Oy bilimdoni» =====
const OY_NOMI = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
const oyNomi = (k) => (k ? OY_NOMI[Number(k.slice(5, 7)) - 1] : '');
function profilEkran(ctx, chiz) {
  const box = h('div', { class: 'oyin-xona' });
  box.append(h('button', { class: 's', style: 'align-self:flex-start', onclick: () => { G.sahifa = 'oyin'; chiz(); } }, '‹ O\'yin'));
  if (G.sahifaOchildi !== 'profil') G.profilVaqt = 0;   // sahifa ochilganda yangilanadi
  G.sahifaOchildi = 'profil';
  const p = profilOl(ctx, chiz);
  if (!p) { box.append(h('div', { class: 'card muted', 'aria-live': 'polite' }, 'Yuklanmoqda…')); return box; }
  if (p.otganOy) box.append(h('section', { class: 'card oyin-oybil' }, h('span', {}, oyNomi(p.otganOy.oy).replace(/^./, (c) => c.toUpperCase()) + ' oyi bilimdoni'),
    h('b', {}, p.otganOy.ism), h('span', {}, fmt(p.otganOy.ball) + ' ball · mukofotni direktor belgilaydi')));
  const top = (p.oy && p.oy.top) || [];
  box.append(h('section', { class: 'card oyin-top' }, kartaSarlavha(oyNomi(p.oy && p.oy.oy).replace(/^./, (c) => c.toUpperCase()) + ' poygasi'),
    ...(top.length ? top.slice(0, 5).map((z, i) => h('div', { class: 'oyin-qator' + (z.men ? ' men' : '') }, h('span', { class: 'oyin-orin' }, String(i + 1)),
      h('span', { class: 'oyin-ism' }, z.ism), h('b', {}, fmt(z.ball)))) : [h('div', { class: 'muted' }, 'Bu oy hali o\'yin bo\'lmadi.')]),
    h('span', { class: 'muted' }, 'Oy oxirida eng ko\'p ball to\'plagan — «Oy bilimdoni» (jonli o\'yin va duel ballari).')));
  if (Array.isArray(p.nishonlar)) {
    box.append(h('h2', { class: 'oyin-bo' }, 'Nishonlar · ' + p.nishonlar.filter((n) => n.olindi).length + ' / ' + p.nishonlar.length),
      h('div', { class: 'oyin-nishonlar' }, ...p.nishonlar.map((n) => h('div', { class: 'oyin-nishon' + (n.olindi ? ' bor' : '') },
        h('span', { class: 'oyin-nb', 'aria-hidden': 'true' }, n.olindi ? '★' : '☆'), h('b', {}, n.nom),
        h('span', {}, n.olindi ? 'Olindi' : Math.min(n.qiymat, n.kerak) + ' / ' + n.kerak),
        h('span', { class: 'yashirin' }, n.izoh)))));
  }
  return box;
}
