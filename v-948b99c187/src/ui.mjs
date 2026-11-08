// Ekranlar uchun umumiy yordamchilar (DOM). Matn har doim textContent orqali — HTML kiritilmaydi.
import * as H from './hisob.mjs';
import { KIRILL, kirill, yozuvKirillmi, yozuvQoy } from './kirill.mjs';

export function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  kids.flat().forEach((c) => c != null && c !== false && e.append(c.nodeType ? c : document.createTextNode(String(c))));
  return e;
}

// Karta sarlavhasi — ekran o'quvchi uchun haqiqiy sarlavha (h2), ko'rinishi oddiy qalin matn.
export const kartaSarlavha = (t, attrs) => h('h2', { class: 'ct', ...attrs }, t);

// ---- Soddalashtirish (26.10, docs/ux-soddalashtirish-2026-10-26.md) ----
// Ochiladigan bo'lim (<details>): sarlavha bosilsa ichi ochiladi. k — kalit: ekran qayta chizilganda ochiq/yopiqligi saqlanadi.
const ochiqlar = new Set();
export function ochiladi(sarlavha, ichki, { k = null, izoh = null, ochiq = false, cls = '' } = {}) {
  const d = h('details', { class: 'ochil' + (cls ? ' ' + cls : ''), open: (k ? ochiqlar.has(k) : false) || ochiq,
    ontoggle: (e) => { if (k) { if (e.currentTarget.open) ochiqlar.add(k); else ochiqlar.delete(k); } } },
  h('summary', {}, h('span', { class: 'ochil-s' }, h('span', {}, sarlavha), izoh != null ? h('span', { class: 'muted' }, izoh) : null)));
  d.append(h('div', { class: 'ochil-ich' }, ...[].concat(ichki)));
  return d;
}
// Bo'limni oldindan ochiq qilib qo'yish (07.11, yangi ko'rinish: «Xodimlar» qatoridan Sozlamalar → Xodimlar ochiq keladi).
export function ochiqQoy(k) { if (k) ochiqlar.add(k); }
// Qisqa yo'riqnoma: ekranda bitta qator, bosilsa to'liq matn.
export const yordam = (matn, sarlavha = 'Qanday ishlaydi?') => h('details', { class: 'yordam' }, h('summary', {}, sarlavha),
  h('p', {}, matn));
// Guruhlangan ro'yxat (telefon sozlamalari kabi): [{ nom, qatorlar: [{ l, n, onclick, diqqat }] }]. Har qator — bitta tugma.
export function guruhlar(gs, o = {}) {
  // Dizayn A (29.10): { plitka: true } — 2 ustunli plitkalar (Bo'limlar), aks holda ro'yxat (Sozlamalar va h.k.).
  if (o.plitka) {
    return gs.map((g) => h('section', { class: 'guruh', 'aria-label': g.nom }, h('h2', { class: 'guruh-s' }, g.nom),
      h('div', { class: 'plitkalar' }, ...g.qatorlar.filter(Boolean).map((q) => h('button', { type: 'button', class: 'plitka' + (q.diqqat ? ' diqqat' : ''), onclick: q.onclick },
        h('b', {}, q.l), q.n != null ? h('span', { class: 'muted' }, q.n) : null)))));
  }
  return gs.map((g) => h('section', { class: 'guruh', 'aria-label': g.nom },
    h('h2', { class: 'guruh-s' }, g.nom),
    h('div', { class: 'card qatorlar' }, ...g.qatorlar.filter(Boolean).map((q) => h('button', { type: 'button', class: 'qator' + (q.diqqat ? ' diqqat' : ''), onclick: q.onclick },
      h('span', { class: 'qator-m' }, h('b', {}, q.l), q.n != null ? h('span', { class: 'muted' }, q.n) : null),
      h('span', { class: 'qator-o', 'aria-hidden': 'true' }, '›'))))));
}

// Vaqt va sana — Toshkent vaqtida (telefon boshqa mintaqada bo'lsa ham; server bilan bir xil).
export const vaqt = (ts) => new Date(ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tashkent' });
export const sana = (ts) => new Date(ts).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', timeZone: 'Asia/Tashkent' });
const toshkent = (d) => new Date(new Date(d).getTime() + 5 * 3600e3);   // UTC getter'lari bilan o'qiladi
export const oyKey = (d = new Date()) => toshkent(d).toISOString().slice(0, 7);

const HAFTA = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];
const OYLAR = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
// "Shanba, 24-oktabr"
export const kunNomi = (d = new Date()) => { const t = toshkent(d); return HAFTA[t.getUTCDay()] + ', ' + t.getUTCDate() + '-' + OYLAR[t.getUTCMonth()]; };

// Xabar: muvaffaqiyat — 3 s; xato — 6 s va ajralib turadigan rang (xato matni o'qib ulgurilsin).
export function toast(t, tur = 'ok') {
  document.querySelectorAll('.toast').forEach((e) => e.remove());
  const el = h('div', { class: 'toast' + (tur === 'xato' ? ' xato' : ''), role: tur === 'xato' ? 'alert' : 'status' }, t);
  document.body.append(el);
  setTimeout(() => el.remove(), tur === 'xato' ? 6000 : 3000);
}

// Tasdiq: Telegram ichida — Telegram'ning o'z oynasi, aks holda brauzerniki. Promise<boolean>.
// Sarlavhadagi yozuv tugmasi (hamma panelda): bosilsa Lotin ↔ Кирилл, shu telefonda eslab qolinadi.
// Tugma yozuvi o'zgarmaydi (data-asl) — kirillni o'qiy olmagan odam ham "Lotin" ni topsin.
export function yozuvTugma(rerender, id) {
  const kir = yozuvKirillmi(id);
  return h('button', { type: 'button', class: 'yozuv-tugma', 'data-asl': '', 'aria-label': kir ? 'Lotin yozuviga o\'tish' : 'Кирилл ёзувига ўтиш',
    onclick: () => { yozuvQoy(!kir); rerender(true); } }, kir ? 'Lotin' : 'Кирилл');
}

// Kirill yozuvi tanlangan bo'lsa — matn ham kirillda (Telegram oynasi DOM emas, kuzatuvchi ko'rmaydi).
// Bitta tasdiq oynasi ochiq turganda ikkinchisi so'ralmaydi — "yo'q" (pul auditi 28.10: ikki marta bosilsa ikki so'rov ketmasin).
let tasdiqOchiq = false;
export function tasdiqlash(matn) {
  if (tasdiqOchiq) return Promise.resolve(false);
  // Audit 09.11: «…» ichidagi dori/odam nomlari asl holicha qoladi (Cefazolin → Сефазолин bo'lib ketmasin).
  if (document.documentElement.classList.contains(KIRILL)) matn = String(matn).split(/(«[^»]*»)/).map((s, i) => (i % 2 ? s : kirill(s))).join('');
  const tg = window.Telegram && window.Telegram.WebApp;
  tasdiqOchiq = true;
  const yop = (v) => { tasdiqOchiq = false; return v; };
  if (tg && tg.initData && tg.showConfirm) {
    // Telegram oynasi 256 belgidan uzun matnni rad etadi (28.10 audit) — qisqartiriladi.
    if (matn.length > 250) matn = matn.slice(0, 248).trimEnd() + '…';
    return new Promise((ok) => { try { tg.showConfirm(matn, (x) => ok(yop(!!x))); } catch (e) { ok(yop(confirm(matn))); } });
  }
  return Promise.resolve(yop(confirm(matn)));
}

// ---- Pastdan chiqadigan oyna ----
// Bir nechta oyna ustma-ust ochilishi mumkin: Esc va Tab faqat eng ustidagisiga ishlaydi.
// Yopilganda fokus oynani ochgan tugmaga qaytadi; u qayta chizilgan bo'lsa — xuddi shu matnli tugmaga (o'sha tartibda),
// topilmasa — sahifa sarlavhasiga (fokus <body>ga tushib qolmasin).
const FOKUSLANADI = 'button, input, textarea, select, summary, a[href], [tabindex]:not([tabindex="-1"])';
const korinadi = (el) => !el.disabled && !el.closest('[hidden]') && el.getClientRects().length > 0;
const oynalar = [];
// Telegram «orqaga» tugmasi (audit 06.11; Android'da telefon tugmasi ham — u ko'rinmasa ilova yopilardi, yozilgan pul summasi
// yo'qolardi): oyna ochiq bo'lsa — eng yuqorigi oyna yopiladi (yozilgan bo'lsa so'raladi); aks holda panel bergan «orqaga»
// (direktor ichki sahifasi, oddiy rejim sahifasi, xodim Retsept/Bilimdon). Yo'q bo'lsa — tugma yashirin (ilova yopiladi).
// Oyna ochiq turganda pastga surib yopish — Telegram so'raydi (enableClosingConfirmation).
let panelOrqaga = null;
const tgOl = () => { const w = typeof window !== 'undefined' ? window : null; const t = w && w.Telegram && w.Telegram.WebApp; return t && t.initData ? t : null; };
function orqagaYangila() {
  asosiyQolla();   // 07.11 tun: Telegram asosiy tugmasi faqat o'z oynasi eng ustida bo'lsa ko'rinadi
  const tg = tgOl();
  if (!tg) return;
  try {
    if (tg.BackButton) { if (oynalar.length || panelOrqaga) tg.BackButton.show(); else tg.BackButton.hide(); }
    // Yopishni so'rash — faqat yozish maydoni bor oyna ochiq bo'lsa (QR, kamera, «Shu dorimi?» kabi oynalarda so'ramaydi).
    const yozish = oynalar.some((o) => o.box && o.box.querySelector('input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=file]), textarea'));
    if (tg.enableClosingConfirmation) { if (yozish) tg.enableClosingConfirmation(); else tg.disableClosingConfirmation(); }
  } catch (e) { /* eski Telegram */ }
}
export function orqagaQoy(fn) { panelOrqaga = typeof fn === 'function' ? fn : null; orqagaYangila(); }
export function orqagaBos() {
  const o = oynalar[oynalar.length - 1];
  // 07.11: ko'p qadamli oyna (qarz yozish) — «orqaga» avval oldingi qadamga (o.orqaga() true qaytarsa — oyna yopilmaydi).
  if (o && o.orqaga) { try { if (o.orqaga()) return true; } catch (e) { /* oyna baribir yopiladi */ } }
  if (o) { (o.sorabYop || o.close)(); return true; }
  if (panelOrqaga) { panelOrqaga(); return true; }
  return false;
}
let orqagaUlangan = false;
export function tgOrqagaUlash() {
  const tg = tgOl();
  if (orqagaUlangan || !tg || !tg.BackButton) return;
  orqagaUlangan = true;
  try { tg.BackButton.onClick(() => { orqagaBos(); }); } catch (e) { /* eski Telegram */ }
}
let oynaId = 0;
// Oxirgi oyna yopilganda (sahifa yana ko'rinadi) chaqiriladi — app.mjs: eski takror kalitlari unutiladi (sorov.mjs korildi).
let hammasiYopildi = null;
export function oynalarYopilganda(fn) { hammasiYopildi = fn; }

const imzoKalit = (el) => (el.dataset && el.dataset.k) || (el.getAttribute('aria-label') || '') + '|' + el.textContent.trim();
function imzo(el) {
  const app = document.getElementById('app');
  if (!el || !el.tagName || el === document.body || !app || !app.contains(el)) return null;
  const k = imzoKalit(el);
  const mos = [...app.querySelectorAll(el.tagName)].filter((e) => imzoKalit(e) === k);
  return { tag: el.tagName, k, n: Math.max(0, mos.indexOf(el)) };
}
function fokusQaytar(opener, iz) {
  if (opener && opener.isConnected && opener !== document.body && korinadi(opener)) { opener.focus({ preventScroll: true }); return; }
  const app = document.getElementById('app');
  if (!app) return;
  if (iz) {
    const mos = [...app.querySelectorAll(iz.tag)].filter((e) => imzoKalit(e) === iz.k && korinadi(e));
    const el = mos[Math.min(iz.n, mos.length - 1)];
    if (el) { el.focus({ preventScroll: true }); return; }
  }
  const t = app.querySelector('h1');
  if (t) { t.setAttribute('tabindex', '-1'); t.focus({ preventScroll: true }); }
}

function oynaTugmasi(e) {
  const o = oynalar[oynalar.length - 1];
  if (!o) return;
  if (e.key === 'Escape') { e.preventDefault(); (o.sorabYop || o.close)(); return; }
  if (e.key !== 'Tab') return;
  const f = [...o.box.querySelectorAll(FOKUSLANADI)].filter(korinadi);
  if (!f.length) return;
  const first = f[0], last = f[f.length - 1];
  if (!o.box.contains(document.activeElement)) { e.preventDefault(); (e.shiftKey ? last : first).focus(); }
  else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

// ---- Klaviatura (26.10) ----
// Telefonda yozish maydonidan tashqariga bosilsa — klaviatura yopiladi (Telegram'da "Tayyor" tugmasi yo'q, yopib bo'lmay qolardi).
// Ko'rinadigan balandlik (klaviatura ochiq bo'lsa — undan yuqorisi) CSS'ga beriladi: to'liq ekranli oyna shunga moslashadi.
const YOZISH = 'input:not([type="button"]):not([type="checkbox"]):not([type="radio"]), textarea, select, [contenteditable="true"]';
// Tugma bosilganda klaviatura tugma ishlagandan KEYIN yopiladi: pointerdown'da yopilsa, oyna pastga siljiydi va bosish
// tugmaga emas, orqa fonga tushadi — oyna yopilib ketardi (26.10: "summani yozib Bankka bossam chiqib ketyapti").
const BOSILADI = 'button, a, [role="button"], summary';
// Bo'sh joyga bosib klaviatura yopilganda: shu bosish faqat klaviaturani yopadi — oyna siljib, barmoq ostiga kelib qolgan
// tugma yoki orqa fon bosilmaydi (audit 26.10). yopildi — o'sha pointerdown vaqti va nishoni.
let klavYopildi = { vaqt: 0, nishon: null };
export const klaviaturaYopildimi = () => Date.now() - klavYopildi.vaqt < 120;
if (typeof document !== 'undefined' && typeof window !== 'undefined' && !window.__klaviatura) {
  window.__klaviatura = true;
  document.addEventListener('pointerdown', (e) => {
    const a = document.activeElement;
    if (!a || !a.matches || !a.matches(YOZISH)) return;
    const t = e.target && e.target.closest ? e.target : null;
    if (t && t.closest(YOZISH + ', label')) return;   // boshqa maydonga o'tyapti
    if (t && t.closest(BOSILADI)) return;             // tugma — klaviatura bosishdan keyin yopiladi (pastda)
    klavYopildi = { vaqt: Date.now(), nishon: t };
    a.blur();
  }, true);
  // Klaviaturani yopgan bosishdan keyingi "click" boshqa elementga tushsa (oyna siljidi) — bekor qilinadi.
  document.addEventListener('click', (e) => {
    const k = klavYopildi;
    if (!k.nishon || Date.now() - k.vaqt > 700) return;
    klavYopildi = { vaqt: 0, nishon: null };
    const t = e.target;
    if (t && !(k.nishon === t || (k.nishon.contains && k.nishon.contains(t)))) { e.preventDefault(); e.stopPropagation(); }
  }, true);
  document.addEventListener('click', (e) => {
    const a = document.activeElement;
    const t = e.target && e.target.closest ? e.target : null;
    if (!a || !a.matches || !a.matches(YOZISH) || !t || !t.closest(BOSILADI) || t.closest(YOZISH + ', label')) return;
    // "Qo'shish va keyingisi" kabi tugmalar (data-klav="qoldir") — keyingi maydonga o'tiladi, klaviatura yopilmasin.
    if (t.closest('[data-klav="qoldir"]')) return;
    setTimeout(() => { if (document.activeElement === a) a.blur(); }, 0);
  });
  // 09.11 (egasi: "yozganda, klaviatura chiqqanda hamma joyda qotish bor"): klaviatura ochilayotganda visualViewport har kadrda
  // resize/scroll beradi — har birida oyna o'lchami yozilib, maydon surilib (majburiy layout) qotardi. Endi hodisalar
  // jamlanadi: harakat to'xtagach (120 ms) bir marta. Sahifa balandligi (#app) — px'da, faqat ekran burilganda/klaviatura
  // yopiq paytda yangilanadi (100vh klaviatura har qadamida butun sahifani qayta hisoblatardi).
  const appH = () => {
    const a = document.activeElement;
    if (a && a.matches && a.matches(YOZISH)) return;   // klaviatura ochiq — sahifa balandligi o'zgarmasin
    const v = window.innerHeight + 'px';
    if (document.documentElement.style.getPropertyValue('--app-h') !== v) document.documentElement.style.setProperty('--app-h', v);
  };
  appH();
  window.addEventListener('orientationchange', () => setTimeout(appH, 300));
  const vv = window.visualViewport;
  if (vv) {
    let vvT = 0, vsT = 0;
    const qoy = () => { try { vvQoy(); } catch (e) { /* o'lcham berilmasa ham oyna ishlaydi */ } };
    vv.addEventListener('resize', () => { clearTimeout(vvT); vvT = setTimeout(() => { qoy(); korsatKeyin(); appH(); }, 120); });
    // Siljish — faqat oyna o'lchami (audit 09.11: iPhone'da natijalarga surilganda maydonga qaytarib tortmasin).
    vv.addEventListener('scroll', () => { clearTimeout(vsT); vsT = setTimeout(qoy, 120); });
  }
  // Yozish maydoni bosilganda: klaviatura chiqqach maydon ko'rinadigan joyga suriladi (iPhone Telegram'da o'zi surmasdi — 28.10).
  // Bir marta — klaviatura chiqib bo'lgach (qolganini jamlangan resize qiladi).
  document.addEventListener('focusin', (e) => {
    if (!e.target.matches || !e.target.matches(YOZISH)) return;
    setTimeout(korsatKeyin, 400);
  });
  document.addEventListener('focusout', () => setTimeout(() => {
    const a = document.activeElement;
    if (!(a && a.matches && a.matches(YOZISH))) klavJoy(0);
  }, 100));
}

// Ko'rinadigan qism o'lchami faqat ochiq oynalarga beriladi (hujjat ildiziga emas — har siljishda butun sahifa qayta hisoblanib,
// telefonda qotardi). Oyna fonining o'zi ko'rinadigan qismga teng: klaviatura ochiq bo'lsa — undan yuqorisi.
function vvQoy(els) {
  const vv = typeof window !== 'undefined' && window.visualViewport;
  if (!vv) return;
  const hv = Math.round(vv.height) + 'px', tv = Math.round(vv.offsetTop) + 'px';
  (els || document.querySelectorAll('.sheet-bg:not(.yopilmoqda)')).forEach((b) => {
    if (b.style.getPropertyValue('--vv-h') !== hv) b.style.setProperty('--vv-h', hv);
    if (b.style.getPropertyValue('--vv-top') !== tv) b.style.setProperty('--vv-top', tv);
  });
}
const klaviaturaBalandligi = () => {
  const vv = window.visualViewport;
  return vv ? Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)) : 0;
};
// Sahifa qisqa bo'lsa, maydonni klaviatura ustiga surish uchun pastda joy yetmaydi — klaviatura ochiqligida bo'sh joy qo'shiladi.
function klavJoy(px) {
  let j = document.getElementById('klav-joy');
  if (!px) { if (j) j.remove(); return; }
  if (!j) { j = document.createElement('div'); j.id = 'klav-joy'; j.setAttribute('aria-hidden', 'true'); document.body.append(j); }
  j.style.height = px + 'px';
}
let korsatNavbat = 0;
function korsatKeyin() {
  if (korsatNavbat) return;
  // window.requestAnimationFrame'ni alohida o'zgaruvchiga olib chaqirib bo'lmaydi — iPhone (Safari) "Kutilmagan xato" berardi (28.10).
  const ish = () => {
    korsatNavbat = 0;
    try { korsat(document.activeElement); } catch (e) { /* surish ishlamasa ham yozish davom etsin */ }
  };
  try { korsatNavbat = window.requestAnimationFrame ? window.requestAnimationFrame(ish) : setTimeout(ish, 16); } catch (e) { korsatNavbat = 0; }
}
// Maydon ko'rinadi va ostida yana biroz joy bor (yordam matni, qidiruv natijasining boshi) — surilmaydi.
const korinib = (r, yuqori, past) => r.top >= yuqori && Math.min(r.bottom + 60, r.top + 160) <= past;
const suriladi = (e) => { const s = getComputedStyle(e).overflowY; return (s === 'auto' || s === 'scroll') && e.scrollHeight > e.clientHeight + 1; };
// Fokusdagi maydonni (yorlig'i bilan) ko'rinadigan qismning yuqori qismiga suradi — ostidagi qidiruv natijalari ham ko'rinsin.
// Faqat maydon ko'rinmay qolgan bo'lsa suriladi (telefon o'zi surgan bo'lsa — tegilmaydi).
export function korsat(el) {
  if (!el || !el.matches || !el.matches(YOZISH) || !el.isConnected) return;
  const vv = window.visualViewport;
  const vTop = vv ? vv.offsetTop : 0, vPast = vv ? vv.offsetTop + vv.height : window.innerHeight;
  const t = el.closest('label') || el;
  const r = t.getBoundingClientRect();
  let q = el.parentElement;
  while (q && q !== document.body && !suriladi(q)) q = q.parentElement;
  if (!q || q === document.body) {
    if (el.closest('.sheet')) return;   // oyna ko'rinadigan qismga teng va surilmaydi — maydon allaqachon ko'rinadi
  } else {
    const cr = q.getBoundingClientRect();
    const bosh = q.querySelector(':scope > .head');
    const yuqori = Math.max(cr.top, vTop) + (bosh ? bosh.offsetHeight : 0) + 8;
    const past = Math.min(cr.bottom, vPast) - 8;
    if (korinib(r, yuqori, past)) return;
    q.scrollTop += r.top - yuqori;
    return;
  }
  const bar = document.querySelector('.top');
  const yuqori = Math.max(vTop, bar ? bar.offsetHeight : 0) + 8;   // surilgandan keyin tepaga yopishgan sarlavha ostidan
  const past = vPast - 8;
  if (korinib(r, yuqori, past)) return;
  const kerak = r.top - yuqori;
  const qoldi = document.documentElement.scrollHeight - window.innerHeight - window.scrollY;
  if (kerak > qoldi) klavJoy(Math.max(klaviaturaBalandligi(), kerak - qoldi + 16));
  window.scrollBy(0, kerak);
}

// build(box, close) oyna ichini to'ldiradi; funksiya qaytarsa — u oyna yopilganda chaqiriladi (masalan, rasm URL'ini bo'shatish).
// o.fokus = false — ochilganda yozish maydoniga fokus berilmaydi (klaviatura o'zi chiqmasin; masalan rasm oynasi).
// o.toliq = true — to'liq ekranli oyna: balandligi klaviatura ochiqligida ham ko'rinadigan qismga teng.
// o.orqaga — Telegram «orqaga» bosilganda avval shu chaqiriladi; true qaytarsa oyna yopilmaydi (ko'p qadamli oyna, 07.11).
export function sheet(title, build, o2 = {}) {
  // Yozish maydoni fokusda turganda oyna ochilsa: klaviatura yopiladi va oyna yopilganda o'sha maydonga qaytilmaydi
  // (qaytsa, klaviatura yana chiqib, sahifa sakraydi — audit 26.10).
  const faol = document.activeElement;
  const yozishdan = !!(faol && faol.matches && faol.matches(YOZISH));
  if (yozishdan) faol.blur();
  const opener = yozishdan ? null : faol;
  const iz = yozishdan ? null : imzo(opener);
  const id = 'oyna' + (++oynaId);
  const bg = h('div', { class: 'sheet-bg' + (o2.toliq ? ' toliq' : '') });
  vvQoy([bg]);
  let tozala = null;
  const o = { box: null, close: null, orqaga: typeof o2.orqaga === 'function' ? o2.orqaga : null };
  let yopildi = false;
  const close = () => {
    if (!bg.isConnected || yopildi) return;
    yopildi = true;
    // 07.11 (dizayn: "ochilishlar iPhone'dek silliq"): oyna pastga sirg'alib, fon so'nib yopiladi. Holat darhol tozalanadi,
    // faqat DOM 240 ms keyin olinadi; harakat imkoni bo'lmasa (jsdom, «kamroq harakat») — darhol.
    if (animMumkin(box) && !o2.toliq) {
      bg.classList.add('yopilmoqda');
      const y = box.getBoundingClientRect ? Math.max(120, box.getBoundingClientRect().height) : 400;
      const joriy = getComputedStyle(box).transform;
      anim(box, [{ transform: joriy && joriy !== 'none' ? joriy : 'none' }, { transform: 'translateY(' + y + 'px)' }], 240, () => bg.remove());
      anim(bg, [{ opacity: 1 }, { opacity: 0 }], 240);
    } else bg.remove();
    const i = oynalar.indexOf(o);
    if (i >= 0) oynalar.splice(i, 1);
    if (!oynalar.length) document.removeEventListener('keydown', oynaTugmasi);
    orqagaYangila();
    if (typeof tozala === 'function') { try { tozala(); } catch (e) { /* tozalash xatosi oynani yopishga xalal bermasin */ } }
    // Audit 08.11: oyna yopilganda ustida boshqa oyna qolsa — fokus o'sha oynada qoladi (ochuvchi orqa sahifada bo'lsa ham;
    // masalan xodim oynasidan «Oylik» — yangi oyna ochilib, keyin eskisi yopiladi: klaviatura yangi oynadagi maydonda qolsin).
    if (oynalar.length) {
      const ust = oynalar[oynalar.length - 1].box;
      if (!ust.contains(document.activeElement)) {
        if (opener && opener.isConnected && ust.contains(opener)) fokusQaytar(opener, iz);
        else { const f = [...ust.querySelectorAll(FOKUSLANADI)].filter(korinadi)[0]; if (f) f.focus(); }
      }
    } else fokusQaytar(opener, iz);
    if (!oynalar.length && hammasiYopildi) { try { hammasiYopildi(); } catch (e) { /* oynani yopishga xalal bermasin */ } }
  };
  // 07.11 tun: tepada tutqich — sarlavhani pastga surib (80 px dan ko'p yoki tez siltab) yopish; to'liq ekranli oynada yo'q.
  const tortish = !o2.toliq && document.documentElement.classList.contains('yangi-qobiq');   // audit 07.11: eski ko'rinish o'zgarmasin
  const head = h('div', { class: 'head' + (tortish ? ' tortiladi' : '') }, !tortish ? null : h('span', { class: 'sheet-tutqich', 'aria-hidden': 'true' }),
    h('h2', { id }, title), h('button', { class: 'x', type: 'button', 'aria-label': 'Yopish', onclick: close }, '×'));
  const box = h('div', { class: 'sheet' + (o2.toliq ? ' toliq' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': id }, head);
  // Oyna ichiga shartli element qo'shilganda (x ? h(...) : null) DOM "null" matnini yozib qo'ymasin.
  const qosh = box.append.bind(box);
  box.append = (...k) => qosh(...k.filter((e) => e != null && e !== false));
  o.box = box; o.close = close;
  // Fon yoki Esc bilan yopishda (28.10 audit): oynada yozilgan qiymat bo'lsa — avval so'raladi (pul formasi tasodifan yo'qolmasin).
  // × tugmasi — ataylab yopish, so'ralmaydi.
  const yozilgan = () => [...box.querySelectorAll('input, textarea')].some((i) => i.type !== 'hidden' && i.type !== 'checkbox'
    && i.type !== 'radio' && i.type !== 'file' && !i.readOnly && String(i.value || '') !== String(i.defaultValue || ''));
  o.sorabYop = async () => { if (yozilgan() && !(await tasdiqlash('Yozganlaringiz o\'chadi. Oyna yopilsinmi?'))) return; close(); };
  // Orqa fon faqat bosish shu fonning o'zida boshlanib, shu yerda tugasa yopadi: klaviatura yopilib oyna siljiganda
  // tugmaga qilingan bosish fonga tushib qolsa ham oyna yopilmaydi.
  // Klaviaturani yopish uchun fonga bosilgan bo'lsa — oyna yopilmaydi (yozilgani yo'qolmasin).
  let fondaBoshlandi = false;
  bg.addEventListener('pointerdown', (e) => { fondaBoshlandi = e.target === bg && !klaviaturaYopildimi(); });
  bg.addEventListener('click', (e) => { if (e.target === bg && fondaBoshlandi) o.sorabYop(); fondaBoshlandi = false; });
  // Pastga surib yopish — fon bosilgandagi yo'l bilan bir xil: yozilgan bo'lsa so'raladi (oyna joyiga qaytadi), aks holda pastga ketadi.
  if (tortish) surishUlash(box, head, () => { if (yozilgan()) { o.sorabYop(); return false; } return true; }, close);
  if (!oynalar.length) document.addEventListener('keydown', oynaTugmasi);
  oynalar.push(o);
  // Qayta audit 06.11: build xato bersa — oyna ro'yxatda «ko'rinmas» qolib, Telegram «orqaga» va Esc butunlay ishlamay qolardi.
  try { tozala = build(box, close); } catch (e) {
    const i = oynalar.indexOf(o);
    if (i >= 0) oynalar.splice(i, 1);
    if (!oynalar.length) document.removeEventListener('keydown', oynaTugmasi);
    orqagaYangila();
    throw e;
  }
  orqagaYangila();
  bg.append(box);
  document.body.append(bg);
  const first = o2.fokus === false ? box.querySelector('.x') : box.querySelector('input:not([type="hidden"]):not([readonly]), textarea, button.pill, button.p');
  if (first && korinadi(first)) first.focus({ preventScroll: true });
  return close;
}

// ===================== 07.11 tun: harakat va Telegram tugmalari (GitHub hisobotidagi g'oyalar, o'z kodimiz) =====================
// Qoidalar (CLAUDE.md): faqat transform/opacity; «kamroq harakat» sozlamasida — harakat yo'q; brauzer qo'llamasa — jim (oddiy holat).
export function harakatMumkin() {
  try {
    return !(typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  } catch (e) { return true; }
}
const animMumkin = (el) => !!el && typeof el.animate === 'function' && harakatMumkin();
// Element.animate — tugagach (yoki 1 s ichida tugamasa) hech qanday iz qolmaydi (fill yo'q); xato bo'lsa — jim.
function anim(el, kadrlar, ms, keyin) {
  let bitdi = false;
  const tugadi = () => { if (bitdi) return; bitdi = true; if (keyin) { try { keyin(); } catch (e) { /* jim */ } } };
  try {
    const a = el.animate(kadrlar, { duration: ms, easing: 'cubic-bezier(.2, .8, .2, 1)' });
    a.onfinish = tugadi; a.oncancel = tugadi;
  } catch (e) { tugadi(); return; }
  setTimeout(tugadi, ms + 700);
}

// ---- Oynani pastga surib yopish (pointer events) ----
// Faqat tepadagi joydan (tutqich va sarlavha) — oyna ichidagi ro'yxat odatdagidek aylanadi. Barmoq ortidan faqat transform.
// 80 px dan ko'p tortilsa yoki tez siltansa — yopiladi; aks holda joyiga qaytadi. «Kamroq harakat»da ham barmoqqa ergashadi
// (bevosita boshqaruv), lekin qaytish va ketish — darhol.
export const surishYopadimi = (dy, tezlik) => dy > 80 || (dy > 24 && tezlik > 0.6);   // px va px/ms
function surishUlash(box, joy, ruxsat, close) {
  let p = null;
  const vaqtOl = (e) => (e && e.timeStamp) || Date.now();
  const qaytar = (dy) => {
    box.style.transform = '';
    if (dy > 0 && animMumkin(box)) anim(box, [{ transform: 'translateY(' + dy + 'px)' }, { transform: 'none' }], 180);
  };
  joy.addEventListener('pointerdown', (e) => {
    if ((e.button != null && e.button > 0) || (e.target && e.target.closest && e.target.closest('button, a, input, textarea, select'))) return;
    p = { id: e.pointerId, y0: e.clientY, dy: 0, iz: [{ y: e.clientY, t: vaqtOl(e) }] };
    box.style.animation = 'none';   // audit 07.11: ochilish animatsiyasi (fill both) transform'ni ushlab qolmasin — oyna barmoqqa ergashsin
    try { if (joy.setPointerCapture && e.pointerId != null) joy.setPointerCapture(e.pointerId); } catch (er) { /* eski brauzer */ }
  });
  joy.addEventListener('pointermove', (e) => {
    if (!p || e.pointerId !== p.id) return;
    p.dy = Math.max(0, e.clientY - p.y0);
    const t = vaqtOl(e);
    p.iz.push({ y: e.clientY, t });
    while (p.iz.length > 2 && t - p.iz[0].t > 100) p.iz.shift();
    box.style.transform = p.dy ? 'translateY(' + p.dy + 'px)' : '';
  });
  const tugat = (e, bekor) => {
    if (!p || (e && e.pointerId !== p.id)) return;
    const q = p;
    p = null;
    const bosh = q.iz[0], ox = q.iz[q.iz.length - 1];
    const tezlik = ox.t > bosh.t ? (ox.y - bosh.y) / (ox.t - bosh.t) : 0;
    if (bekor || !surishYopadimi(q.dy, tezlik)) { qaytar(q.dy); return; }
    // Yozilgan bo'lsa — so'raladi (ruxsat false qaytaradi), oyna joyiga qaytadi.
    if (!ruxsat()) { qaytar(q.dy); return; }
    // 07.11 kech: close() o'zi oynani joriy joyidan (barmoq qoldirgan translateY) pastga sirg'altiradi — ikkinchi animatsiya yo'q
    // (avval bu yerda pastga tushib, close() uni yana yuqoridan tushirardi — oyna «sakrardi»).
    if (!animMumkin(box)) box.style.transform = '';
    close();
  };
  joy.addEventListener('pointerup', (e) => tugat(e, false));
  joy.addEventListener('pointercancel', (e) => tugat(e, true));
  joy.addEventListener('lostpointercapture', (e) => tugat(e, true));
}

// ---- Telegram asosiy tugmasi (MainButton / BottomButton) ----
// To'liq ekranli oqimdagi BITTA asosiy amal (qarz yozish ustasi, savdo kiritish) ekran pastida, klaviatura ustida turadi.
// asosiyTugma({ matn, bosildi, faol, band, tugma, oyna }) → tozala() (oyna yopilganda chaqiriladi; tozala.yangila({...}),
// tozala.korinadimi()). tugma — sahifadagi o'sha tugma: Telegram tugmasi ko'ringandagina yashiriladi (eski Telegram, brauzer —
// sahifadagi tugma qoladi). oyna — oyna (sheet box): Telegram tugmasi faqat shu oyna eng ustida bo'lsa ko'rinadi.
// Bir nechta bo'lsa — oxirgisi (ustma-ust oynalar). Hammasi tozalanganda — offClick + hide.
const asosiylar = [];
let mbUlangan = null, mbBizda = false;
const MB_RANG = '#0B7A6B', MB_OCHIQ = '#9FC4BC';   // --accent; o'chiq holat — xira (ko'rinib turadi, bosilmaydi)
function mbOl() {
  const tg = tgOl();
  const b = tg && tg.MainButton;
  if (!b || typeof b.onClick !== 'function' || typeof b.show !== 'function') return null;
  if (tg.isVersionAtLeast && !tg.isVersionAtLeast('6.0')) return null;
  return b;
}
function mbBosildi() {
  const e = asosiylar[asosiylar.length - 1];
  if (!e || !e.korinadi || !e.faol || e.band) return;
  try { e.bosildi(); } catch (er) { console.error('asosiy tugma', er); }
}
function asosiyQolla() {
  const b = mbOl();
  const e = asosiylar[asosiylar.length - 1];
  const ust = oynalar[oynalar.length - 1];
  asosiylar.forEach((x) => { x.korinadi = false; });
  const kor = !!(b && e && (e.oyna ? !!ust && ust.box === e.oyna : !oynalar.length));
  if (e) e.korinadi = kor;
  asosiylar.forEach((x) => { if (x.tugma) x.tugma.hidden = x.korinadi; });
  if (!b) return;
  try {
    if (kor) {
      if (!mbUlangan) { b.onClick(mbBosildi); mbUlangan = mbBosildi; }
      const matn = document.documentElement.classList.contains(KIRILL) ? kirill(e.matn) : e.matn;
      const ishlaydi = e.faol && !e.band;
      if (typeof b.setParams === 'function') b.setParams({ text: matn, color: ishlaydi || e.band ? MB_RANG : MB_OCHIQ, text_color: '#FFFFFF', is_active: ishlaydi, is_visible: true });
      else { if (b.setText) b.setText(matn); if (ishlaydi) { if (b.enable) b.enable(); } else if (b.disable) b.disable(); }
      if (e.band) { if (b.showProgress) b.showProgress(false); } else if (b.hideProgress) b.hideProgress();
      b.show();
      mbBizda = true;
    } else if (mbBizda || mbUlangan) {   // har chizishda Telegram'ga keraksiz chaqiruv yubormaslik
      if (b.hideProgress) b.hideProgress();
      b.hide();
      mbBizda = false;
      if (mbUlangan && !asosiylar.length) { if (b.offClick) b.offClick(mbUlangan); mbUlangan = null; }
    }
  } catch (er) {   // eski/g'alati Telegram — sahifadagi tugma qaytadi (ikkalasi ham yashirin qolmasin)
    asosiylar.forEach((x) => { x.korinadi = false; if (x.tugma) x.tugma.hidden = false; });
    mbBizda = false;
  }
}
export function asosiyTugma(o = {}) {
  const e = { matn: o.matn || 'Davom etish', bosildi: o.bosildi || (() => {}), faol: o.faol !== false, band: !!o.band, tugma: o.tugma || null, oyna: o.oyna || null, korinadi: false };
  asosiylar.push(e);
  asosiyQolla();
  let tozalandi = false;
  const tozala = () => {
    if (tozalandi) return;
    tozalandi = true;
    const i = asosiylar.indexOf(e);
    if (i >= 0) asosiylar.splice(i, 1);
    if (e.tugma) e.tugma.hidden = false;
    asosiyQolla();
  };
  // yangila({ matn, faol, band, tugma }) — faqat berilganlari o'zgaradi. Yangi sahifa tugmasi berilsa, eskisi o'z holiga qaytadi.
  tozala.yangila = (u = {}) => {
    if (tozalandi) return;
    if (u.tugma !== undefined && u.tugma !== e.tugma) { if (e.tugma) e.tugma.hidden = false; e.tugma = u.tugma; }
    if (u.matn != null) e.matn = u.matn;
    if (u.faol != null) e.faol = !!u.faol;
    if (u.band != null) e.band = !!u.band;
    asosiyQolla();
  };
  tozala.korinadimi = () => !tozalandi && e.korinadi;
  return tozala;
}

// ---- Ro'yxat harakati (auto-animate g'oyasi, FLIP) ----
// Ekran ko'pincha butunlay qayta chiziladi — shuning uchun qatorlar kaliti (data-rk) bo'yicha oldingi joyi nom bo'yicha eslab
// qolinadi (konteynerga nisbatan — sahifa aylantirilsa ham to'g'ri). Keyingi chizishda: joyi o'zgargan qator eski joyidan suriladi,
// yangisi paydo bo'ladi, ketgani (eski element, bosilmaydi) xiralashib yo'qoladi. ~200 ms, faqat transform/opacity, hech
// qanday iz qolmaydi. Sahifa almashganda (kirish harakati yoki View Transition), ro'yxat butunlay almashganda — harakat yo'q.
const royxatlar = new Map();   // nom → Map(kalit → { el, x, y, w, h })
const ROYXAT_KOP = 12;         // shundan ko'p qator qo'shilsa/ketsa — bu boshqa ro'yxat (filtr), harakatsiz
const ROYXAT_MS = 200;
// Sof hisob (test): oldingi va yangi joylar → { kochdi: [{ k, dx, dy }], yangi: [k], ketdi: [k] }.
export function flipFarq(oldin, keyin) {
  const ol = oldin instanceof Map ? oldin : new Map(Object.entries(oldin || {}));
  const ke = keyin instanceof Map ? keyin : new Map(Object.entries(keyin || {}));
  const kochdi = [], yangi = [], ketdi = [];
  for (const [k, b] of ke) {
    const a = ol.get(k);
    if (!a) { yangi.push(k); continue; }
    const dx = Math.round(a.x - b.x), dy = Math.round(a.y - b.y);
    if (Math.abs(dx) >= 1 || Math.abs(dy) >= 1) kochdi.push({ k, dx, dy });
  }
  for (const k of ol.keys()) if (!ke.has(k)) ketdi.push(k);
  return { kochdi, yangi, ketdi };
}
export function royxatHarakat(el, nom) {
  if (!el || !nom) return el;
  el.setAttribute('data-royxat', '');
  const ish = () => {
    if (!el.isConnected) return;   // shu orada yana qayta chizildi — keyingi nusxa o'zi yozadi
    const cr = el.getBoundingClientRect();
    const joy = new Map();
    for (const c of el.children) {
      const k = c.getAttribute && c.getAttribute('data-rk');
      if (k == null || joy.has(k) || joy.size >= 150) continue;
      const r = c.getBoundingClientRect();
      joy.set(k, { el: c, x: r.left - cr.left, y: r.top - cr.top, w: r.width, h: r.height });
    }
    const old = royxatlar.get(nom);
    royxatlar.set(nom, joy);
    // Eski ko'rinish («Eski ko'rinish» yoqilgan) — avvalgidek, harakatsiz (<html class="yangi-qobiq"> faqat yangi panelda).
    if (!old || otishda || el.closest('.kirish') || !animMumkin(el) || !document.documentElement.classList.contains('yangi-qobiq')) return;
    const f = flipFarq(old, joy);
    if (f.yangi.length + f.ketdi.length > ROYXAT_KOP) return;
    f.kochdi.forEach(({ k, dx, dy }) => anim(joy.get(k).el, [{ transform: 'translate(' + dx + 'px,' + dy + 'px)' }, { transform: 'none' }], ROYXAT_MS));
    // Birinchi marta ko'rinayotgan ro'yxatga emas (old bo'sh bo'lsa — hammasi yangi, harakatsiz).
    if (old.size) f.yangi.forEach((k) => anim(joy.get(k).el, [{ opacity: 0, transform: 'scale(.98)' }, { opacity: 1, transform: 'none' }], ROYXAT_MS));
    f.ketdi.forEach((k) => {
      const g = old.get(k);
      if (!g || !g.el || g.el.isConnected || !g.w) return;
      const s = g.el.style;
      s.position = 'absolute'; s.left = g.x + 'px'; s.top = g.y + 'px'; s.width = g.w + 'px'; s.height = g.h + 'px';
      s.margin = '0'; s.pointerEvents = 'none'; s.boxSizing = 'border-box';
      g.el.setAttribute('aria-hidden', 'true'); g.el.inert = true; g.el.removeAttribute('data-rk');
      el.append(g.el);
      anim(g.el, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.97)' }], ROYXAT_MS, () => g.el.remove());
    });
  };
  // Chizish tugagach, rasm chizilishidan oldin (bir marta o'lchanadi; sahifa aylantirish joyi tiklangandan keyin).
  if (typeof queueMicrotask === 'function') queueMicrotask(ish); else Promise.resolve().then(ish);
  return el;
}

// ---- Raqam aylanishi (number-flow g'oyasi) ----
// Hero summa (Seyfda hozir, bugungi savdo) chizishlar orasida o'zgarsa — eski qiymatdan yangisiga ~400 ms sanaladi
// (requestAnimationFrame). Oxirgi matn doim aniq: H.som(summa). Raqam qismi alohida span (data-asl — kirillga o'tkazilmaydi,
// faqat raqam), « so'm» — oddiy matn (kirill yozuvida «сўм» bo'ladi). Oldingi qiymat — kalit bo'yicha (modul xotirasida).
const sonlar = new Map();
const ROLL_MS = 400;
export const rollQiymat = (eski, yangi, p) => { const q = Math.min(1, Math.max(0, p)); return Math.round(eski + (yangi - eski) * (1 - Math.pow(1 - q, 3))); };
const raqam = (n) => H.som(n).replace(/ so'm$/, '');
export function pulSon(kalit, summa, attrs) {
  const n = Math.round(Number(summa) || 0);
  const s = h('span', { class: 'son-r', 'data-asl': '' }, raqam(n));
  const el = h('b', attrs || {}, s, ' so\'m');
  const eski = sonlar.get(kalit);
  sonlar.set(kalit, n);
  const raf = typeof window !== 'undefined' && window.requestAnimationFrame;
  if (eski == null || eski === n || !raf || !harakatMumkin()) return el;
  s.textContent = raqam(eski);
  let t0 = null;
  const qadam = (t) => {
    if (t0 == null) t0 = t;
    const p = (t - t0) / ROLL_MS;
    if (p >= 1 || !s.isConnected) { s.textContent = raqam(n); return; }
    s.textContent = raqam(rollQiymat(eski, n, p));
    window.requestAnimationFrame(qadam);
  };
  // Birinchi kadr: element hali sahifaga qo'shilmagan bo'lishi mumkin — kutiladi (2 kadrdan keyin ham yo'q bo'lsa — aniq qiymat).
  let kutish = 0;
  const bosh = (t) => {
    if (!s.isConnected && kutish++ < 2) { window.requestAnimationFrame(bosh); return; }
    qadam(t);
  };
  try { window.requestAnimationFrame(bosh); } catch (e) { s.textContent = raqam(n); }
  return el;
}

// ---- Sahifa almashishi (View Transitions) ----
// Yangi ko'rinishda bo'lim/sahifa almashganda — butun ekran yumshoq almashadi (brauzer o'zi; CSS: ::view-transition-*).
// Qo'llamasa, «kamroq harakat», oyna ochiq yoki ilova fonda bo'lsa — oddiy chizish. fn darhol emas, keyingi kadrda bajariladi —
// chizishdan keyin DOM'ga darhol tegadigan joylar (masalan qidiruvga fokus, kamera) sinxron yo'lni ishlatsin.
let otishda = false, otishId = 0;
export const otishdami = () => otishda;
export function sahifaOtish(fn) {
  const d = typeof document !== 'undefined' ? document : null;
  // Audit 08.11: yopilayotgan oyna (pastga sirg'alayotgan) yangi sahifa rasmiga tushmasin — darhol olinadi.
  if (d) d.querySelectorAll('.sheet-bg.yopilmoqda').forEach((b) => b.remove());
  if (!d || typeof d.startViewTransition !== 'function' || otishda || oynalar.length || d.visibilityState === 'hidden' || !harakatMumkin()) { fn(); return; }
  otishda = true;
  const men = ++otishId;
  const tugadi = () => { if (otishId === men) otishda = false; };
  let bajarildi = false;
  const ish = () => { if (bajarildi) return; bajarildi = true; fn(); };
  try {
    const vt = d.startViewTransition(ish);
    if (vt && vt.finished) vt.finished.then(tugadi, tugadi); else tugadi();
    // Ehtiyot: brauzer chaqirmay qolsa ham sahifa almashadi.
    setTimeout(() => { ish(); tugadi(); }, 1500);
  } catch (e) { tugadi(); ish(); }
}

// ---- Maydon ----
// { el, i, xato(matn), qiymat(v), yorliq(matn) }.
// Pul maydonlari (inputmode numeric) ostida kiritilgan summa H.pul() bilan o'qiladi va ajratib ko'rsatiladi: "4 800 000 so'm" —
// 480 000 va 4 800 000 ni adashtirmaslik uchun. "1,5" kabi noto'g'ri yozuv "15 so'm" bo'lib ko'rinmaydi.
// Xato matni maydon tagida chiqadi (aria-describedby).
// attrs.pul === false — raqamli, lekin pul emas (JSHSHIR, kod): "so'm" yozuvi chiqmaydi.
// attrs.k — sahifadagi maydon kaliti: ekran qayta chizilganda (ilovaga qaytganda, yangi holat kelganda) yozilgan qiymat saqlanadi.
let maydonId = 0;
export const qiymatlar = new Map();
let fokusda = null;

export function input(label, attrs) {
  const { pul: pulBelgi, k, ...rest } = attrs || {};
  const a = { inputmode: 'numeric', autocomplete: 'off', ...rest };
  const id = 'm' + (++maydonId);
  const i = h('input', { ...a, id, 'aria-describedby': id + 'x', 'data-k': k || null });
  if (k && qiymatlar.has(k)) i.value = qiymatlar.get(k);
  const nom = h('span', {}, label);
  const err = h('span', { class: 'err', id: id + 'x', 'aria-live': 'polite' });
  const pulMaydon = pulBelgi !== false && a.inputmode === 'numeric' && a.type !== 'date' && !/vaqt|soni/i.test(label);   // soni — dona, so'm emas
  const hint = pulMaydon ? h('span', { class: 'hint', 'aria-live': 'polite' }) : null;
  const upd = () => {
    if (!hint) return;
    const v = String(i.value).trim();
    const n = H.pul(v);
    hint.className = n == null && v ? 'hint yordam' : 'hint';
    hint.textContent = !v ? '' : n != null ? H.som(n) : 'Faqat butun so\'m — masalan: 1 250 000';
  };
  const xato = (m) => {
    err.textContent = m || '';
    if (m) i.setAttribute('aria-invalid', 'true'); else i.removeAttribute('aria-invalid');
  };
  i.addEventListener('input', () => { upd(); xato(''); });
  upd();
  return {
    el: h('label', { class: 'f' }, nom, i, hint, err), i, xato,
    qiymat: (v) => { i.value = v; upd(); },
    yorliq: (m) => { nom.textContent = m; }
  };
}

// Ko'p qatorli matn maydoni (ro'yxat): input() bilan bir xil — { el, i, xato }, xato maydon tagida.
export function matnMaydon(label, attrs) {
  const { k, ...rest } = attrs || {};
  const id = 'm' + (++maydonId);
  const i = h('textarea', { rows: '5', ...rest, id, 'aria-describedby': id + 'x', 'data-k': k || null });
  if (k && qiymatlar.has(k)) i.value = qiymatlar.get(k);
  const err = h('span', { class: 'err', id: id + 'x', 'aria-live': 'polite' });
  const xato = (m) => { err.textContent = m || ''; if (m) i.setAttribute('aria-invalid', 'true'); else i.removeAttribute('aria-invalid'); };
  i.addEventListener('input', () => xato(''));
  return { el: h('label', { class: 'f' }, h('span', {}, label), i, err), i, xato };
}

// Xato uchun joy — maydon bo'lmagan tanlovlar (pills) tagida. { el, xato(m), i: { focus } } — input() bilan bir xil.
export function guruhXato(guruh) {
  const id = 'g' + (++maydonId);
  const err = h('span', { class: 'err', id, 'aria-live': 'polite' });
  if (guruh) guruh.setAttribute('aria-describedby', id);
  return { el: err, xato: (m) => { err.textContent = m || ''; }, i: { focus: () => { const b = guruh && (guruh.querySelector('[aria-pressed="true"]') || guruh.querySelector('button')); if (b) b.focus(); } } };
}

// Xatoni (tekshiruv yoki server P0001) eng mos maydon tagiga qo'yadi. juftlar: [[maydon, /kalit so'z/], …, [maydon]] —
// regex'siz oxirgisi qolgan hamma xatolar uchun. Bir nechta xato ". " bilan kelsa — har biri o'z maydoniga.
// Qaytaradi: (matn) => true (joylandi, birinchi xatoli maydonga fokus) | false (mos maydon yo'q — chaqiruvchi toast qiladi).
export function xatoJoyla(juftlar) {
  return (matn) => {
    const qismlar = String(matn || '').split(/\.\s+/).map((s) => s.trim().replace(/\.$/, '')).filter(Boolean);
    const yig = new Map();
    let birinchi = null;
    for (const q of qismlar) {
      const j = juftlar.find(([, re]) => !re || re.test(q));
      if (!j) return false;
      yig.set(j[0], (yig.has(j[0]) ? yig.get(j[0]) + '. ' : '') + q);
      if (!birinchi) birinchi = j[0];
    }
    if (!birinchi) return false;
    new Set(juftlar.map(([f]) => f)).forEach((f) => f.xato(yig.get(f) || ''));
    birinchi.i.focus();
    return true;
  };
}

// Ekran qayta chizilishidan oldin: foydalanuvchi yozgan qiymatlar va fokus (kaliti bor maydonlar).
export function holatniEsla(root) {
  qiymatlar.clear();
  root.querySelectorAll('input[data-k], textarea[data-k], select[data-k]').forEach((el) => { if (el.value !== el.defaultValue) qiymatlar.set(el.dataset.k, el.value); });
  const a = document.activeElement;
  fokusda = a && root.contains(a) && a.dataset && a.dataset.k ? { k: a.dataset.k, s: a.selectionStart, e: a.selectionEnd } : null;
}
// Qayta chizilgandan keyin: fokus o'sha maydonga (oyna ochiq bo'lmasa).
export function holatniTikla(root) {
  const f = fokusda;
  fokusda = null;
  if (!f || document.querySelector('.sheet-bg:not(.yopilmoqda)')) return;
  const el = [...root.querySelectorAll('[data-k]')].find((e) => e.dataset.k === f.k);
  if (!el) return;
  el.focus({ preventScroll: true });
  try { if (f.s != null) el.setSelectionRange(f.s, f.e); } catch (e) { /* sana kabi maydonlarda yo'q */ }
}
// Forma muvaffaqiyatli yuborilgach — uning saqlangan qiymatlari unutiladi (yangi forma bo'sh ochilsin).
export function unut(prefiks) { for (const k of [...qiymatlar.keys()]) if (k.startsWith(prefiks)) qiymatlar.delete(k); }

// Nusxa olish: bufer ishlamasa (eski Telegram, ruxsat yo'q) — matn oynada ko'rsatiladi, qo'lda belgilab olinadi.
export function nusxaOl(matn, t, okMatn = 'Nusxa olindi ✓') {
  const qolda = () => sheet('Nusxa oling', (box) => {
    const ta = h('textarea', { rows: String(Math.min(10, Math.max(3, String(matn).split('\n').length + 1))), readonly: true, 'aria-label': 'Nusxa olinadigan matn', style: 'word-break:break-all' }, matn);
    box.append(h('div', { class: 'msg info' }, 'Avtomatik nusxa olinmadi. Matnni bosib turing, hammasini belgilang va «Nusxa olish»ni tanlang.'), ta);
    setTimeout(() => { ta.focus(); ta.select(); }, 0);
  });
  const cb = typeof navigator !== 'undefined' && navigator.clipboard;
  if (!cb || !cb.writeText) { qolda(); return Promise.resolve(false); }
  return cb.writeText(matn).then(() => { if (t) t(okMatn); return true; }, () => { qolda(); return false; });
}

// Mavzu: doim yorug' (dizayn B "Yalpiz"). Telegram sarlavhasi va foni ham shu ranglarda.
export const RANG = { fon: '#F2F2F7', karta: '#FFFFFF' };   // 07.11 kech: iOS qatlami foni (style.css)
export function mavzu(tg) {
  document.documentElement.dataset.theme = 'light';
  if (!tg) return;
  try {
    if (tg.setHeaderColor) tg.setHeaderColor(RANG.fon);
    if (tg.setBackgroundColor) tg.setBackgroundColor(RANG.fon);
    if (tg.setBottomBarColor) tg.setBottomBarColor(RANG.karta);
  } catch (e) { /* eski Telegram */ }
}

// Telefon ekraniga qo'shish (Telegram Bot API 8.0+): ekrandagi ikonka bosilsa ilova to'g'ridan-to'g'ri ochiladi.
// Qo'shilgan yoki telefon qo'llamasa — tugma ko'rinmaydi; Telegram eski bo'lsa — yangilash maslahati.
let ekranHolati = null;   // null (hali so'ralmagan) | 'unsupported' | 'unknown' | 'added' | 'missed'
let ekranHodisa = false;
export function ekranTugmasi() {
  const tg = window.Telegram && window.Telegram.WebApp;
  if (!tg || !tg.initData) return null;   // brauzerda (sinov rejimi) — yo'q
  if (!tg.isVersionAtLeast || !tg.isVersionAtLeast('8.0') || !tg.addToHomeScreen) {
    return h('p', { class: 'muted', style: 'text-align:center' }, 'Telefon ekraniga ikonka qo\'yish uchun Telegram\'ni yangilang');
  }
  if (ekranHolati === 'added' || ekranHolati === 'unsupported') return null;
  if (!ekranHodisa && tg.onEvent) {
    ekranHodisa = true;
    tg.onEvent('homeScreenAdded', () => {
      ekranHolati = 'added';
      document.querySelectorAll('.ekran-tugma').forEach((e) => e.remove());
      toast('Ikonka telefon ekraniga qo\'shildi ✓');
    });
  }
  const btn = h('button', { type: 'button', class: 'ekran-tugma', hidden: ekranHolati === null ? true : null, onclick: () => tg.addToHomeScreen() },
    'Telefon ekraniga qo\'shish');
  if (ekranHolati === null && tg.checkHomeScreenStatus) {
    tg.checkHomeScreenStatus((st) => {
      ekranHolati = st;
      if (st === 'missed' || st === 'unknown') document.querySelectorAll('.ekran-tugma').forEach((e) => { e.hidden = false; });
      else document.querySelectorAll('.ekran-tugma').forEach((e) => e.remove());
    });
  } else if (ekranHolati === null) btn.hidden = false;
  return btn;
}

// Tanlov tugmalari (segmentli boshqaruv): tanlangani rang bilan ham, "✓" bilan ham ajraladi (faqat rangga tayanmaslik uchun).
// Guruh kaliti (data-g: nomi + qiymatlar): tanlov butun ekranni qayta chizsa (ctx.rerender), fokus yangi guruhdagi
// tanlangan tugmaga o'tadi — klaviatura va ekran o'quvchi joyini yo'qotmaydi, "tanlangan" holati o'qiladi.
const guruhKaliti = (values, label) => (label || '') + '|' + values.map(([v]) => String(v)).join('|');
export function pills(values, current, onPick, label) {
  const g = guruhKaliti(values, label);
  const wrap = h('div', { class: 'pills', role: 'group', 'aria-label': label || null, 'data-g': g });
  const draw = (cur) => {
    wrap.textContent = '';
    values.forEach(([v, l]) => wrap.append(h('button', { type: 'button', class: 'pill', 'aria-pressed': String(v === cur), onclick: () => {
      onPick(v);
      if (!wrap.isConnected) {   // tanlov ekranni qayta chizdi — o'sha guruhning yangi nusxasidagi tanlangan tugma
        const yangi = [...document.querySelectorAll('.pills')].find((e) => e.dataset.g === g && korinadi(e));
        const b = yangi && (yangi.querySelector('[aria-pressed="true"]') || yangi.querySelector('button'));
        if (b) b.focus({ preventScroll: true });
        return;
      }
      draw(v);
      const b = [...wrap.children][values.findIndex(([x]) => x === v)];
      if (b) b.focus({ preventScroll: true });   // tugma qayta chizildi — fokus yo'qolmasin
    } }, (v === cur ? '✓ ' : '') + l)));
  };
  draw(current);
  return wrap;
}

const ICON = {
  smena: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>',
  qidir: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.3-4.3"/>',
  men: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5c1.4-3.7 4.3-5.5 7.5-5.5s6.1 1.8 7.5 5.5"/>',
  qarz: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18"/>',
  oylik: '<circle cx="12" cy="12" r="8"/><path d="M9 12h6M12 9v6"/>',
  bosh: '<path d="M4 11l8-7 8 7v9H4z"/>',
  qoldiq: '<path d="M3 7.5l9-4.5 9 4.5v9l-9 4.5-9-4.5z"/><path d="M3 7.5l9 4.5 9-4.5M12 12v9"/>',
  defektura: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4v3h6V4M9 12h6M12 9v6"/>',
  prays: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>',
  daftar: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/>',
  tamin: '<path d="M3 7h11v9H3zM14 10h4l3 3v3h-7"/><circle cx="7" cy="18" r="1.6"/><circle cx="17" cy="18" r="1.6"/>',
  more: '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/>',
  // 29.10, dizayn A: tez tugmalar va «Bajarish kerak» qatorlari.
  retsept: '<rect x="3" y="7" width="18" height="12" rx="2"/><path d="M8 7V5h8v2M12 10v6M9 13h6"/>',
  kirim: '<path d="M12 5v14M5 12l7 7 7-7"/>',
  chiqim: '<path d="M12 19V5M5 12l7-7 7 7"/>',
  qosh: '<path d="M12 5v14M5 12h14"/>',
  shtrix: '<path d="M4 5v14M7 5v14M10 5v14M14 5v14M16 5v14M20 5v14"/>',
  odam: '<circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M17 8h4M19 6v4"/>',
  soat: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>',
  oyin: '<rect x="2.5" y="7" width="19" height="11" rx="5"/><path d="M7.5 10.5v4M5.5 12.5h4"/><circle cx="15.5" cy="11.5" r="1"/><circle cx="17.5" cy="14" r="1"/>',
  rasm: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-8 8"/>',
  quti: '<path d="M3 8l9-5 9 5v8l-9 5-9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
  chiqar: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
  xato: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16.5v.5"/>'
};

// Tez tugmalar (dizayn A, 29.10): dumaloq belgi + nom, 4 tagacha bir qatorda. [icon, nom, rang ('kirim'|'chiqim'|'warn'|''), onclick]
export function tezTugmalar(items) {
  const bor = items.filter(Boolean);
  return h('div', { class: 'tez', style: 'grid-template-columns:repeat(' + bor.length + ',minmax(0,1fr))' },
    ...bor.map(([icon, nom, rang, onclick]) => h('button', { type: 'button', class: 'tez-t', onclick },
      h('span', { class: 'tez-d' + (rang ? ' ' + rang : '') }, svg(icon)), nom)));
}

// «Bajarish kerak» qatori: rangli belgi, sarlavha, izoh va bitta tugma (yoki butun qator bosiladi).
export function ishQator({ icon, rang = '', sarlavha, izoh, tugma, asosiy = true, onclick }) {
  const ichi = [h('span', { class: 'iq-d ' + rang, 'aria-hidden': 'true' }, svg(icon)),
    h('span', { class: 'iq-m' }, h('b', {}, sarlavha), izoh ? h('span', { class: 'muted' }, izoh) : null)];
  if (tugma) return h('div', { class: 'iq' }, ...ichi, h('button', { type: 'button', class: 'iq-t' + (asosiy ? ' p' : ''), 'aria-label': tugma[0] + ': ' + sarlavha, onclick: tugma[1] }, tugma[0]));
  return h('button', { type: 'button', class: 'iq', onclick }, ...ichi, h('span', { class: 'qator-o', 'aria-hidden': 'true' }, '›'));
}

export function svg(k) {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor');
  s.setAttribute('stroke-width', '2'); s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round'); s.setAttribute('aria-hidden', 'true');
  s.innerHTML = ICON[k];
  return s;
}

export function nav(items, current, onGo) {
  const n = h('nav', { class: 'nav', 'aria-label': 'Bo\'limlar', style: 'grid-template-columns:repeat(' + items.length + ',1fr)' });
  items.forEach(([k, l, icon]) => n.append(h('button', { type: 'button', 'aria-current': current === k ? 'page' : null, onclick: () => onGo(k) }, svg(icon || k), l)));
  return n;
}
