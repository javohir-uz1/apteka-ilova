// Telegram Mini App: xodim paneli (smena, qarz, oylik) va direktor paneli.
// Server manzili (config.mjs) bo'lsa va Telegram ichida ochilsa — server rejimi; aks holda sinov rejimi (shu brauzerda).
// Matnlar birinchi marta ochgan, o'rgatilmagan odam uchun yozilgan (audit 24.10): har ekranda — keyingi qadam nima.
import * as A from './amallar.mjs';
import * as H from './hisob.mjs';
import { API_URL } from './config.mjs';
import { yukla, saqla, tozala, serverga, rasmOl, faylOl, firmaPraysYukla, yuklashManzil } from './store.mjs';
import { retseptBosh, retseptIchida, retseptRuxsat, retseptView } from './retsept.mjs';
import { renderPunkt } from './punkt.mjs';
import { serverSorovi, sinovdaBajar } from './ishlar.mjs';
import { bandBolsaQayta, kutayotganKuzat, kutayotganMatn, kutayotganTashlangan, qoidaXatosi, sorovchi, urinishMatni } from './sorov.mjs';
import { qarzXabari } from './xabar.mjs';
import { guruhXato, h, holatniEsla, holatniTikla, input, ishQator, kartaSarlavha, kunNomi, mavzu, nav, ochiladi, otishdami, oynalarYopilganda, oyKey, orqagaQoy, pills, sahifaOtish, sana, sheet, svg, tasdiqlash, tgOrqagaUlash, toast, unut, vaqt, xatoJoyla, yordam, yozuvTugma } from './ui.mjs';
import { KIRILL, kirillDom, kirillKuzat, yozuvKirillmi } from './kirill.mjs';
import { renderDirektor } from './direktor.mjs';
import { renderTaminotchi } from './taminotchi.mjs';
import { defekturaXodim, kelganKarta, praysQidiruv } from './bolimlar.mjs';
import { shtrixKarta } from './shtrix.mjs';
import { muddatiOtganKarta, osonQidiruv } from './oson-qoldiq.mjs';
import { narxXodimKarta } from './nazorat.mjs';
import { bronKarta } from './bron.mjs';
import { sorovKarta } from './filial-sorov.mjs';
import { inventarOrqaga, inventarView } from './inventar.mjs';
import { oyinBanner, oyinBosh, oyinView } from './oyin.mjs';
import { menDavomat } from './davomat.mjs';
import { bolimlar, eskiKorinishmi, haptik, korinishOyna, korinishQolla, orqagaTugma, sozlamaTugmasi } from './qobiq.mjs';
import { ikon } from './ikon.mjs';
import { qarzUsta } from './qarz-usta.mjs';
import { tanishuvAvto, tanishuvOch } from './tanishuv.mjs';

// Telegram skripti brauzerda ham WebApp obyektini yaratadi — haqiqiy Telegram'da initData bo'sh bo'lmaydi.
const tg = window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData ? window.Telegram.WebApp : null;
if (tg) {
  tg.ready(); tg.expand();
  // Pastga surilganda ilova yopilib qolmasin (sahifa ichida aylantirish ishlayveradi). Telegram 7.7+.
  try { if (tg.disableVerticalSwipes) tg.disableVerticalSwipes(); } catch (e) { /* eski Telegram */ }
}
mavzu(tg);   // doim yorug' mavzu; Telegram sarlavhasi va foni ham shu ranglarda

const SERVER = !!API_URL;
let S = SERVER ? null : yukla();
let xato = null;     // server rejimi: holatni olib bo'lmadi
// 06.11 (ikki marta «Mini appga kirmayabdi»): qaysi yo'l nima bo'ldi — xato ekranida (skrinshotdan sababi ko'rinsin).
let xatoTafsil = '';
let eskirdi = false;  // server 401 (Telegram kirish ma'lumoti eskirgan) — qayta urinish foyda bermaydi, ilovani yopib ochish kerak
let sekin = false;   // birinchi yuklash 8 s dan oshdi — «boshqa yo'l sinalmoqda»
let eskirgan = null; // holat bor, lekin yangilanmadi (internet / eskirgan initData) — tepada ogohlantirish
// Taklif havolasi telefon raqamni so'radi (SQL taklif_qabul matni). raqamKutish — raqam yuborildi, bot olguncha kutilmoqda.
const RAQAM_KERAK = /Telefon raqamingizni yuboring/;
let raqamKerak = false, raqamKutish = false;
let band = false;    // server so'rovi ketyapti — ikki marta bosilmasin
// Sinov rejimi: boshqa tab saqlasa — shu tab eski nusxa bilan ustidan yozmasin.
if (!SERVER) window.addEventListener('storage', (e) => { if (e.key === 'apteka-demo-v1') { S = yukla(); render(); } });
let kim = SERVER ? null : sessionStorage.getItem('apteka-kim');   // sinov rejimi: Telegram kirishi o'rniga
let tab = 'bosh';
let dTab = 'kam';   // xodim → Dorilar ichidagi bo'lim
const root = document.getElementById('app');

// Serverga yuboruvchi (sorov.mjs): C1 kalit — xatodan keyin aynan shu so'rov qayta yuborilsa o'sha kalit (server ikki marta
// yozmaydi); kech kelgan eski holat yangisining ustidan yozilmaydi. Oyna yopilib sahifa ko'ringach — eski kalitlar unutiladi.
const sorov = sorovchi({ serverga, initData: () => tg.initData, korinadimi: () => !document.querySelector('.sheet-bg') });
oynalarYopilganda(() => sorov.korildi());
// 07.11: internet kutayotgan yozuvlar (sorov.mjs oflayn navbat) — tepada kichik belgi; son o'zgarsa faqat shu belgi yangilanadi.
function navbatBelgi() {
  const t = kutayotganMatn();
  let el = document.querySelector('.oflayn-navbat');
  if (!t) { if (el) el.remove(); return; }
  if (!el) { el = h('div', { class: 'msg info oflayn-navbat', role: 'status' }); root.parentNode.insertBefore(el, root); }
  el.textContent = '⏳ ' + t + ' — internet kelganda o\'zi yuboriladi';
}
// Audit 07.11: navbatdagi yozuvni server rad etsa / eskirsa — jim yo'qolmasin: bir marta xabar.
let tashOxirgi = null;
function tashlanganTekshir() {
  const t = kutayotganTashlangan();
  const oxirgi = t.reduce((a, z) => Math.max(a, z.vaqt || 0), 0);
  if (tashOxirgi === null) { tashOxirgi = oxirgi; return; }
  const yangi = t.filter((z) => (z.vaqt || 0) > tashOxirgi);
  tashOxirgi = Math.max(tashOxirgi, oxirgi);
  if (yangi.length) setTimeout(() => toast(yangi.length + ' ta yozuv serverga yetmadi va saqlanmadi — ekranni yangilab, qaytadan kiriting', 'xato'), 0);
}
try { tashlanganTekshir(); kutayotganKuzat(() => { navbatBelgi(); tashlanganTekshir(); }); } catch (e) { /* xotira yo'q — belgisiz */ }

const xodimOf = (id) => S.xodimlar.find((x) => x.id === id) || {};
// 07.11: direktor o'chirgan imkoniyat (Xodimlar → Funksiyalar; server ham rad etadi — api.mjs FUNKSIYA_KALIT). Yo'q kalit — yoqiq.
const fy = (k) => ((S && S.sozlama && S.sozlama.funksiyalar) || {})[k] !== false;
const filialOf = (id) => S.filiallar.find((f) => f.id === id) || {};
const kimNomi = (id) => (id === kim ? 'siz' : xodimOf(id).ism || '?');
// Amal muvaffaqiyatli bo'lgach — shu formaning sahifadagi maydonlari bo'sh ochiladi (saqlangan qiymat unutiladi).
const FORMA = { smenaOchish: 'ochish-', punktBemor: 'punkt-', defekturaYoz: 'def-', shtrixQosh: 'shtrix-', boshlangichSaqla: 'bosh-', aptekaNomla: 'apteka-', sozlamaSaqla: 'limit-' };

// Amal: amal('smenaYopish', smenaId, forma) → Promise<natija | null>. Xato bo'lsa — xabar ko'rsatiladi va null.
// amalX(xatoQoy, nom, ...args) — qoida xatosi (server 400, shu yerdagi tekshiruv) matnini avval xatoQoy(matn) ga beradi
// (maydon tagiga qo'yish); qo'ymasa yoki xato tarmoq/server/kirishniki bo'lsa — umumiy xabar.
// Natija: muvaffaqiyatda — server natijasi (bo'sh bo'lsa true), takrorda — TAKROR (sorov.mjs), xatoda — null.
async function bajar(nom, args, xatoQoy) {
  if (band) { toast('Oldingi amal saqlanmoqda — bir soniyadan keyin qayta bosing', 'xato'); return null; }
  const men = H.ishdagi((S.xodimlar || []).find((z) => z.id === kim), S) || { id: kim };   // ta'minotchi: faqat id
  try {
    if (!SERVER) {
      const r = sinovdaBajar(nom, S, men, args);
      saqla(S); render({ unut: FORMA[nom] });
      haptik('ok');
      return r === undefined ? true : r;
    }
    const [api, a] = serverSorovi(nom, args);   // noto'g'ri summa — shu yerda xato, so'rov yuborilmaydi
    band = true; document.body.classList.add('band');
    const r = await sorov.yubor(api, a);
    if (r.holat) { S = r.holat; eskirgan = null; }   // audit 06.11: yangi holat keldi — «eski» ogohlantirishi olinadi
    render({ unut: FORMA[nom] });
    haptik('ok');   // 07.11: saqlandi — Telegram tebranishi (eski Telegram va brauzerda jim)
    // Takror: natija TAKROR (raqam/matn emas) — natijadan xabar tuzadigan joylar buni alohida ko'rsatadi.
    if (r.takror) toast('Bu amal avvalgi urinishda saqlangan ekan ✓');
    return r.natija;
  } catch (e) {
    haptik('xato');
    // Maydon tagiga — faqat qoida xatosi; tarmoq/server/kirish xatosi — umumiy xabar.
    if (!(xatoQoy && qoidaXatosi(e) && xatoQoy(e.message))) toast(e.message, 'xato');
    return null;
  } finally {
    if (band) { band = false; document.body.classList.remove('band'); }
  }
}
const amal = (nom, ...args) => bajar(nom, args, null);
const amalX = (xatoQoy, nom, ...args) => bajar(nom, args, xatoQoy);
// Fonda amal (05.11; foydalanuvchi: "Oson qoldiqda + ni bossam qotib turib keyin o'tyapti"): tugmalar bloklanmaydi — chaqiruvchi
// natijani ekranda darhol o'zi ko'rsatadi; javob kelgach yangi holat jim qo'llanadi (navbat — kech kelgan eski holat yangisi
// ustidan yozilmaydi; kalit — tarmoq xatosidan keyin qayta yuborilsa ikki marta yozilmaydi). Xato — xabar va null.
async function amalFon(nom, ...args) {
  if (!SERVER) return bajar(nom, args, null);
  try {
    const [api, a] = serverSorovi(nom, args);
    const r = await sorov.yubor(api, a);
    if (r.holat) { S = r.holat; eskirgan = null; if (!band) render(); }   // band — boshqa amal ketyapti, o'zi chizadi
    return r.natija;
  } catch (e) {
    toast(e.message, 'xato');
    return null;
  }
}

// Server rejimi: holatni olish. Ro'yxatda yo'q odam taklif havolasi bilan kirgan bo'lsa — avval ulanadi.
// Ilovaga qaytganda ham chaqiriladi: kech kelgan javob undan keyin kelgan holat ustidan yozilmaydi.
async function serverdanYukla(avto = 0) {
  const start = tg && tg.initDataUnsafe && tg.initDataUnsafe.start_param;
  const sekinT = !S ? setTimeout(() => { if (!S && !xato) { sekin = true; render(); } }, 8000) : 0;
  try {
    const r = await sorov.holatOl();
    if (!r) { clearTimeout(sekinT); return; }   // eski javob — undan keyingisi allaqachon qo'llangan
    S = r.holat; xato = null; eskirgan = null; eskirdi = false;
  } catch (e) {
    if (e.status === 400 && start && /ro'yxatda yo'q/.test(e.message)) {
      try {
        const r = await sorov.yubor('taklif_qabul', [start]);
        if (!r.holat) { clearTimeout(sekinT); return; }
        S = r.holat; xato = null; raqamKerak = false;
        const n = r.natija;
        toast('Xush kelibsiz' + (n && n.ism ? ', ' + n.ism : '') + '!');
      } catch (e2) { xato = e2.message; raqamKerak = RAQAM_KERAK.test(e2.message); }
    } else if (!S && e.tarmoq && avto < 1) {
      // Ikkala yo'l ham ulanmadi — bir marta o'zi qayta urinadi (mobil internet bir lahzaga uzilgan bo'lishi mumkin).
      clearTimeout(sekinT);
      await new Promise((r) => setTimeout(r, 2000));
      return serverdanYukla(avto + 1);
    } else if (!S) {
      xato = e.message; eskirdi = e.status === 401;   // eski holat bor bo'lsa — ko'rsatishda davom etamiz
      xatoTafsil = e.tarmoq ? [urinishMatni(e.urinishlar), typeof navigator !== 'undefined' && navigator.onLine === false ? 'telefonda internet o\'chiq' : '',
        new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })].filter(Boolean).join(' · ') : '';
    }
    // 28.10 (audit): eski holat ko'rinib turibdi — xodim buni bilsin (eski balans bilan ish qilmasin).
    else { eskirdi = e.status === 401; eskirgan = eskirdi ? 'Ilova eskirdi — yopib, Telegram\'dan qayta oching' : 'Ma\'lumot yangilanmadi — internetni tekshiring. Ekrandagi raqamlar eski bo\'lishi mumkin'; }
  }
  clearTimeout(sekinT); sekin = false;
  if (S) { kim = S.men.id; xatoTafsil = ''; }
  render();
}

// Telegram raqamni so'raydi (requestContact) → bot kontaktni oladi (bir-ikki soniya) → taklif qayta yuboriladi.
async function raqamYubor() {
  const ok = await new Promise((res) => { try { tg.requestContact((v) => res(!!v)); } catch { res(false); } });
  if (!ok) { toast('Raqam yuborilmadi — ulanish uchun raqamingiz kerak', 'xato'); return; }
  raqamKutish = true; render();
  for (let i = 0; i < 8 && raqamKutish; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    await serverdanYukla();
    if (!raqamKerak) break;
  }
  raqamKutish = false; render();
}

// Pul maydonini tekshirish: bo'sh → xabar; noto'g'ri yozilgan → xabar; aks holda null (xato yo'q).
function pulXato(f, boshXabar) {
  const v = String(f.i.value).trim();
  if (!v) return boshXabar;
  return H.pul(v) == null ? 'Raqam noto\'g\'ri — masalan: 1 250 000' : null;
}
// Xatolarni maydon tagiga qo'yadi; birinchi xatoli maydonga fokus. Xato bo'lsa — true.
function xatolarniKorsat(juftlar) {
  let birinchi = null;
  juftlar.forEach(([f, m]) => { f.xato(m); if (m && !birinchi) birinchi = f; });
  if (birinchi) birinchi.i.focus();
  return !!birinchi;
}

// ---- Kirish (sinov rejimi) ----
function renderKirish() {
  root.append(h('div', { class: 'demo' }, 'Sinov rejimi — Telegram ulanmagan, ma\'lumotlar uydirma'));
  root.append(h('header', { class: 'top' }, h('div', { class: 't' }, h('h1', {}, 'Apteka'), h('span', {}, 'Sinov rejimi'))));
  const m = h('main', {});
  m.append(h('div', { class: 'card' }, kartaSarlavha('Kim sifatida kirasiz?'),
    h('div', { class: 'muted' }, 'Telegram ulanganda bu ekran bo\'lmaydi — tizim sizni o\'zi taniydi.'),
    ...S.xodimlar.map((x) => h('button', { onclick: () => { kim = x.id; sessionStorage.setItem('apteka-kim', kim); tab = 'bosh'; render(true); } },
      x.ism + ' · ' + filialOf(x.filialId).nom + (x.rol === 'direktor' ? ' · direktor' : ' · ' + x.smena))),
    ...S.taminotchilar.slice(0, 2).map((t) => h('button', { class: 's', onclick: () => { kim = t.id; sessionStorage.setItem('apteka-kim', kim); render(true); } }, t.nom + ' · ta\'minotchi')),
    ...((S.retsept || {}).punktlar || []).slice(0, 1).map((p) => h('button', { class: 's', onclick: () => { kim = p.id; sessionStorage.setItem('apteka-kim', kim); render(true); } }, p.nom + ' · punkt'))));
  m.append(h('button', { class: 's', onclick: () => tasdiqlash('Sinov ma\'lumotlari o\'chirilsinmi?').then((ha) => { if (ha) { tozala(); S = yukla(); render(); } }) }, 'Sinov ma\'lumotlarini tozalash'));
  root.append(m);
}

// ---- Xodim ----
// 05.11 (foydalanuvchi: "xodim panelini Click uslubiga o'zgartiramiz"; maket docs/maket/dada-xodim-variantlar.html, xodim A):
// pastda 4 bo'lim — Bosh · Dori · Qarz · Men. Bosh: yashil karta (oy oxirida olasiz + davomat), belgilar to'ri (har belgi yozuvli),
// «Bugun» — e'tibor kerak bo'lgan narsalar. Retsept va Bilimdon — to'rdan ochiladi (menyuda emas: 6 ta bo'lim 375 px'ga sig'masdi).
const XTAB = { bosh: 'Bosh sahifa', qarz: 'Qarzlar', men: 'Men', dorilar: 'Dorilar', retsept: 'Retseptlar', oyin: 'Bilimdon', inventar: 'Inventar' };

// 29.10 (foydalanuvchi: "smenani ochish-yopishni olib tashla, davomatni direktor qiladi"): xodim smena ochmaydi, yopmaydi,
// kassadan xarajat yozmaydi — savdoni direktor kiritadi.
function renderXodim(x) {
  if (tab === 'oylik') tab = 'men';   // eski nom
  if (!XTAB[tab]) tab = 'bosh';
  if (!SERVER) root.append(h('div', { class: 'demo' }, 'Sinov rejimi · ', h('button', { class: 's', onclick: () => { kim = null; sessionStorage.removeItem('apteka-kim'); render(true); } }, 'boshqa xodim')));
  root.append(h('header', { class: 'top' }, h('span', { class: 'avatar', 'aria-hidden': 'true' }, x.ism[0]),
    h('div', { class: 't' }, h('h1', {}, tab === 'bosh' ? x.ism : XTAB[tab]),
      h('span', {}, filialOf(x.filialId).nom + (x.daraja === 2 ? ' · 2-daraja' : '') + (tab === 'bosh' ? '' : ' · ' + x.ism))),
    yozuvTugma(render, x.id)));
  const m = h('main', {});
  // Retsept va Bilimdon menyuda yo'q — tepada qaytish (qayerdan kelgan bo'lsa — o'sha bo'limga). Retseptning ichki sahifasida
  // o'zining «‹ Retseptlar» tugmasi bor — ikkita qaytish chiqmasin (audit 05.11).
  const ichki = tab === 'retsept' || tab === 'oyin' || tab === 'inventar';
  if (ichki && !(tab === 'retsept' && retseptIchida())) {
    m.append(h('button', { type: 'button', class: 'link orqa-bosh', onclick: orqaga }, '‹ ' + XTAB[qaytishTab]));
  }
  // Defekturadagi dori keldi (oxirgi 3 kun) — Dorilar'da karta (Bosh'da «Bugun» ichida; «Keldi» bo'limida — ro'yxatning o'zi).
  const keldi = kelganlarim(x);
  if (keldi.length && tab === 'dorilar' && dTab !== 'keldi') {
    m.append(h('div', { class: 'card ok' }, kartaSarlavha(['Keldi: ', h('span', { 'data-asl': '' }, keldi.join(', '))]),
      h('div', { class: 'muted' }, 'Kam dori ro\'yxatidagi dori aptekaga keldi.')));
  }
  if (tab === 'bosh') boshView(m, x);
  if (tab === 'qarz') qarzView(m, x);
  if (tab === 'men') menView(m, x);
  // "Dorilar": narx qidirish + kam qolgan dori. Uchta bo'lim bitta sahifada emas — tanlov bilan.
  if (tab === 'dorilar') {
    m.append(pills([['kam', 'Kam qoldi'], ['keldi', 'Keldi'], ['narx', 'Narxlar']], dTab, (v) => { dTab = v; render(true); }, 'Dorilar bo\'limi'));
    if (dTab === 'kam' && !fy('x_defektura')) m.append(h('div', { class: 'card muted' }, 'Kam qolgan dorini yozish direktor tomonidan o\'chirilgan.'));
    else if (dTab === 'kam') defekturaXodim(m, { S, amal, amalX, toast, qidir, oson: { ...retseptCtx(x), qidiruvYoq: !fy('x_qidiruv') } }, x);
    if (dTab === 'keldi') m.append(kelganKarta(S));
    // Oson qoldig'i (02.11): «Qaysi filialda bor?» — har filialdagi soni va Oson'dagi sotuv narxi; prays-list — pastda.
    if (dTab === 'narx' && SERVER && fy('x_qidiruv')) m.append(osonQidiruv(retseptCtx(x), (id) => ((S.filiallar || []).find((f) => f.id === id) || {}).nom || id));
    if (dTab === 'narx') m.append(praysQidiruv({ S, qidir }));
  }
  const ochiq0 = { retsept: 'x_retsept', oyin: 'x_oyin', inventar: 'x_inventar' }[tab];
  if (ochiq0 && !fy(ochiq0)) m.append(h('div', { class: 'card muted', role: 'status' }, 'Bu bo\'lim direktor tomonidan o\'chirilgan.'));
  else {
    if (tab === 'retsept') retseptView(m, retseptCtx(x));
    if (tab === 'oyin') oyinView(m, retseptCtx(x));
    if (tab === 'inventar') inventarView(m, retseptCtx(x), (id) => filialOf(id).nom || id);
  }
  // O'yin ochilgan bo'lsa (xodim hali kirmagan) — har bo'limning tepasida xabar (qaytish tugmasidan keyin).
  if (tab !== 'oyin' && fy('x_oyin')) {
    const ob = oyinBanner(retseptCtx(x), () => { qaytishTab = ichki ? qaytishTab : tab; tab = 'oyin'; render(true); });
    if (ob) { const orqa = m.querySelector(':scope > .orqa-bosh'); if (orqa) orqa.after(ob); else m.prepend(ob); }
  }
  root.append(m);
  root.append(nav([['bosh', 'Bosh'], ['dorilar', 'Dori', 'defektura'], ['qarz', 'Qarz'], ['men', 'Men', 'men']], tab,
    (k) => { tab = k; render(true); }));
  // Telegram'ning «orqaga» tugmasi (Android'da telefon tugmasi ham): Retsept/Bilimdon'dan — oldingi bo'limga (ilova yopilmasin).
  orqagaQoy(ichki ? orqaga : tab !== 'bosh' ? () => { tab = 'bosh'; render(true); } : null);   // asosiy bo'limlardan — Bosh'ga
}
let qaytishTab = 'bosh';   // Retsept/Bilimdon qaysi bo'limdan ochilgan
function orqaga() {
  if (tab === 'retsept' && retseptIchida()) { retseptBosh(); render(true); return; }
  if (tab === 'inventar' && inventarOrqaga()) { render(true); return; }
  tab = qaytishTab; render(true);
}
tgOrqagaUlash();   // audit 06.11: markaziy — oyna, direktor/oddiy ichki sahifa, xodim Retsept/Bilimdon (ui.mjs orqagaQoy)
// Bosh sahifadagi oylik — bosilgandagina ko'rinadi (audit 05.11: kassa oldida mijoz yoki hamkasb ko'rib qolmasin).
let oylikKorin = false;
// Dori qidirish maydoniga fokus — bosish ichida (iOS klaviaturani faqat foydalanuvchi bosganda ochadi).
function qidiruvgaFokus() {
  const el = document.querySelector('[data-k="oson-qidir"]') || document.querySelector('[data-k="prays-soz"]');
  if (el) el.focus();
}

// Xodim filialidagi «Keldi» bo'lgan defektura (oxirgi 3 kun) — nomlari.
function kelganlarim(x) {
  return [...new Set((S.defektura || []).filter((d) => d.filialId === x.filialId && d.holat === 'keldi' && Date.now() - (d.holatTs || 0) < 3 * 864e5).map((d) => d.nom))];
}

// Bosh sahifa (Click uslubi): yashil karta, belgilar to'ri, «Bugun», muddati o'tgan dorilar, shtrix-kodlar.
function boshView(m, x) {
  const ctx = retseptCtx(x);
  const dv = menDavomat(ctx);
  const davomat = !dv ? 'Davomat yuklanmoqda…' : dv.xato ? 'Davomat olinmadi' : dv.bugun === true ? '✓ Bugun keldingiz'
    : dv.bugun === false ? 'Bugun «kelmadi»' : 'Davomat hali belgilanmagan';
  m.append(h('div', { class: 'card hero x-karta' },
    h('div', { class: 'x-karta-bosh' }, h('span', { class: 'muted' }, 'Oy oxirida olasiz'), h('span', { class: 'x-holat', role: 'status' }, davomat)),
    h('button', { type: 'button', class: 'x-oylik', 'aria-pressed': String(oylikKorin), onclick: () => { oylikKorin = !oylikKorin; render(); } },
      h('span', { class: 'big' }, oylikKorin ? H.som(H.oyOxiri(x, oyKey())) : '••• ••• so\'m'),
      h('span', { class: 'x-oylik-t' }, oylikKorin ? 'Yashirish' : 'Ko\'rsatish')),
    h('div', { class: 'muted' }, kunNomi())));
  const retsept = retseptRuxsat(S, x) && fy('x_retsept');
  const ochir = (t, d) => () => { tab = t; if (d) dTab = d; render(true); };
  const belgi = (icon, nom, rang, onclick) => h('button', { type: 'button', class: 'x-belgi', onclick },
    h('span', { class: 'x-belgi-d ' + rang }, svg(icon)), h('span', {}, nom));
  m.append(h('nav', { class: 'card x-tor', 'aria-label': 'Amallar' },
    fy('x_qidiruv') ? belgi('qidir', 'Dori qidirish', 'yashil', () => { tab = 'dorilar'; dTab = 'narx'; render(true); qidiruvgaFokus(); }) : null,
    fy('x_qarz') ? belgi('odam', 'Qarz yozish', 'sariq', () => qarzSheet(x)) : null,
    fy('x_defektura') ? belgi('defektura', 'Kam dori', 'kok', ochir('dorilar', 'kam')) : null,
    retsept ? belgi('retsept', 'Retsept', 'kok', () => { retseptBosh(); qaytishTab = 'bosh'; tab = 'retsept'; render(true); }) : null,
    belgi('qarz', 'Qarzlarim', 'sariq', ochir('qarz')),
    belgi('oylik', 'Oyligim', 'yashil', ochir('men')),
    fy('x_oyin') ? belgi('oyin', 'Bilimdon', 'qizil', () => { oyinBosh(); qaytishTab = 'bosh'; tab = 'oyin'; render(true); }) : null,
    SERVER && fy('x_inventar') ? belgi('quti', 'Inventar', 'kok', () => { qaytishTab = 'bosh'; tab = 'inventar'; render(true); }) : null));
  // Shtrix-kodlar — sotuvda doim kerak (28.10; 05.11 foydalanuvchi: "asosiy ekranga — uni doim ishlatadilar"): belgilar ostida.
  // 07.11 kech (foydalanuvchi: "dori so'rovi asosiy ekranda ajralib ko'rinib tursin"): amallar ostida, birinchi karta (filial-sorov.mjs).
  if (SERVER) m.append(sorovKarta(ctx, () => { if (tab === 'bosh') render(); }));
  const sk = shtrixKarta(S);
  if (sk) { sk.id = 'shtrix-karta'; sk.tabIndex = -1; m.append(sk); }
  // Bugun: kelgan dorilar va bugun yozgan qarzlar.
  const bugun = H.kunKey(Date.now());
  const qarzlarim = S.qarzlar.filter((q) => q.xodimId === x.id && H.kunKey(q.berildi) === bugun && q.holat !== 'rad').sort((a, b) => a.berildi - b.berildi);
  const keldi = kelganlarim(x);
  const c = h('section', { class: 'card list x-bugun' }, kartaSarlavha('Bugun'));
  keldi.forEach((nom) => c.append(ishQator({ icon: 'defektura', rang: 'kirim', sarlavha: [h('span', { 'data-asl': '' }, nom), ' keldi'], izoh: 'Kam dori ro\'yxatidagi dori · so\'ragan mijozga ayting', onclick: ochir('dorilar', 'keldi') })));
  // Qarz: faqat soni va jami (mijoz ismlari — Qarz bo'limida; audit 05.11 — kassa oldida ko'rinmasin).
  if (qarzlarim.length) {
    const ruxsat = qarzlarim.filter((q) => q.holat === 'ruxsat').length;
    c.append(ishQator({ icon: 'odam', rang: 'warn', sarlavha: 'Bugun ' + qarzlarim.length + ' ta qarz yozdingiz',
      izoh: 'Jami ' + H.som(qarzlarim.reduce((a, q) => a + (q.summa || 0), 0)) + (ruxsat ? ' · ' + ruxsat + ' tasi ruxsat kutmoqda' : ''), onclick: ochir('qarz') }));
  }
  if (!keldi.length && !qarzlarim.length) c.append(h('div', { class: 'muted' }, 'Hozircha yangilik yo\'q. Mijozga qarzga dori bersangiz — «Qarz yozish».'));
  m.append(c);
  // Muddati o'tgan dorilar — o'z filiali (vaqtincha biriktirilgan bo'lsa — o'sha filial; 03.11).
  const mo = muddatiOtganKarta(ctx, (id) => filialOf(id).nom || id, () => { if (tab === 'bosh') render(); });
  if (mo) m.append(mo);
  // 07.11: direktor tanlagan narx — Oson'da tuzatish; narxi o'zgargan dorilarga yorliq (o'z filiali).
  const nk = SERVER && fy('x_narx') ? narxXodimKarta(ctx, (id) => filialOf(id).nom || id, () => { if (tab === 'bosh') render(); }) : null;
  if (nk) m.append(nk);
  { const bk = SERVER && fy('x_bron') ? bronKarta(ctx, (id) => filialOf(id).nom || id, () => { if (tab === 'bosh') render(); }) : null; if (bk) m.append(bk); }   // 07.11 kech: mijoz bronlari (bron.mjs)
  m.append(yordam('Smena ochish-yopish yo\'q: kunlik savdoni direktor kiritadi. Kassadan pul chiqsa (suv, paket…) — direktorga ayting. '
    + 'Kelganingizni direktor belgilaydi. Mijoz dori so\'rasa — «Dori qidirish»: narxi va qaysi filialda borligi.', 'Har kuni nima qilaman?'));
}

// Men: oylik, avanslar, davomat va Bilimdon.
function menView(m, x) {
  oylikView(m, x);
  m.append(h('div', { class: 'card list' }, !fy('x_oyin') ? null : ishQator({ icon: 'oyin', rang: 'warn', sarlavha: 'Bilimdon', izoh: 'O\'yin va mashqlar — dorilarni yaxshiroq bilish uchun', onclick: () => { oyinBosh(); qaytishTab = 'men'; tab = 'oyin'; render(true); } }),
    // 07.11: eski ko'rinishdan yangisiga qaytish (Telegram ⋮ → Sozlamalar ham shu oynani ochadi).
    ishQator({ icon: 'more', rang: '', sarlavha: 'Ko\'rinish', izoh: 'Yangi ko\'rinishga qaytish, harf o\'lchami', onclick: () => xKorinish() })));
}

function qarzView(m, x) {
  const mine = S.qarzlar.filter((q) => q.xodimId === x.id);
  // Limit ruxsat kutayotgan qarzlarni ham hisoblaydi — chiziq ham shunday.
  const ochiq = H.xodimOchiq(mine.filter((q) => q.holat === 'ochiq' || q.holat === 'ruxsat'), x.id);
  const pct = S.sozlama.limitXodim > 0 ? Math.min(100, Math.round(ochiq / S.sozlama.limitXodim * 100)) : 0;   // audit 06.11: limit 0 — NaN emas
  m.append(h('div', { class: 'card hero' }, h('div', { class: 'line', style: 'border:0;align-items:baseline' }, h('span', { class: 'muted' }, 'Ochiq qarzlaringiz'), h('b', { class: 'big', style: 'font-size:28px' }, H.som(ochiq))),
    h('div', { class: 'bar' + (pct > 80 ? ' over' : ''), role: 'progressbar', 'aria-valuenow': String(pct), 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-label': 'Qarz limitidan foydalanish' }, h('i', { style: 'width:' + pct + '%' })),
    h('div', { class: 'muted' }, 'Limitingiz ' + H.som(S.sozlama.limitXodim) + ' — yana ' + H.som(Math.max(0, S.sozlama.limitXodim - ochiq)) + ' yozish mumkin · bitta mijozga ko\'pi bilan ' + H.som(S.sozlama.limitMijoz))));
  if (fy('x_qarz')) m.append(h('button', { class: 'p', onclick: () => qarzYoz(x) }, '+ Qarz yozish'));
  else m.append(h('div', { class: 'msg warn', role: 'status' }, 'Qarz yozish direktor tomonidan o\'chirilgan.'));
  m.append(yordam('Mijoz pul qaytarsa — kassaga qo\'shmang, direktorga olib boring. Qarzni direktor yopadi.', 'Mijoz pulni qaytarsa?'));
  const list = h('div', { class: 'card list' }, kartaSarlavha('Siz yozgan qarzlar'));
  if (!mine.length) list.append(h('div', { class: 'muted' }, 'Hali qarz yozmagansiz. Mijoz pulsiz dori olsa — "+ Qarz yozish" ni bosing.'));
  mine.sort((a, b) => H.qarzQoldiq(b) - H.qarzQoldiq(a)).forEach((q) => {
    const qol = H.qarzQoldiq(q), otgan = q.holat === 'ochiq' && H.muddatiOtgan(q);
    const kun = Math.ceil((H.muddatKuni(q) - Date.now()) / 864e5);
    list.append(h('div', { class: 'item' }, h('div', { class: 'line' }, h('b', { 'data-asl': '' }, q.ism), h('b', {}, q.holat === 'undirildi' ? 'Yopildi ✓' : H.som(qol))),
      h('div', { class: 'muted', style: otgan || q.holat === 'ruxsat' ? 'color:var(--warn);font-weight:600' : '' },
        q.holat === 'ruxsat' ? 'Direktor ruxsatini kutmoqda — javob kelguncha dorini qarzga bermang'
          : q.holat === 'rad' ? 'Direktor rad etdi — qarz berilmasin' : q.holat === 'undirildi' ? 'Direktor yopdi · ' + H.som(q.summa)
            : otgan ? 'Muddati ' + Math.abs(kun) + ' kun o\'tdi — qo\'ng\'iroq qiling!' : 'Qaytarishga ' + kun + ' kun qoldi'),
      q.holat === 'undirildi' || q.holat === 'rad' ? null
        : h('a', { class: 'btn', style: 'min-height:44px;align-self:flex-start;font-size:15px', href: 'tel:' + q.tel }, 'Qo\'ng\'iroq qilish: ' + q.tel)));
  });
  m.append(list);
}

function qarzSheet(x) {
  sheet('Qarz yozish', (box, close) => {
    const forma = { muddatKun: 7 };
    const ism = input('Mijozning ism-sharifi', { inputmode: 'text', placeholder: 'Familiya Ism' }),
      tel = input('Telefon raqami', { inputmode: 'tel', placeholder: '90 123 45 67' }), summa = input('Summa, so\'m');
    const res = h('div', { 'aria-live': 'polite' });
    const btn = h('button', { class: 'p' }, 'Qarzni yozish');
    const upd = () => {
      const t = H.qarzTekshir({ ism: ism.i.value, tel: tel.i.value, summa: summa.i.value, muddatKun: forma.muddatKun }, S.qarzlar.filter((q) => q.holat !== 'rad'), x.id, S.sozlama);
      res.textContent = '';
      if (t.limit) res.append(h('div', { class: 'msg warn' }, t.limit));
      t.ogohlantirish.forEach((o) => res.append(h('div', { class: 'msg info' }, o)));
      btn.textContent = t.limit ? 'Direktordan ruxsat so\'rash' : 'Qarzni yozish';
    };
    [ism, tel, summa].forEach((f) => f.i.addEventListener('input', upd));
    const muddat = pills([[3, '3 kun'], [7, '7 kun'], [14, '14 kun'], [30, '30 kun']], 7, (v) => { forma.muddatKun = v; upd(); }, 'Qaytarish muddati');
    const muddatX = guruhXato(muddat);
    btn.addEventListener('click', () => {
      if (xatolarniKorsat([[ism, String(ism.i.value).trim().length < 3 ? 'Ism-sharifni to\'liq yozing' : null],
        [tel, H.normTel(tel.i.value) ? null : 'Raqam noto\'g\'ri — masalan: 90 123 45 67'], [summa, pulXato(summa, 'Summani yozing')]])) return;
      const f = { ism: ism.i.value, tel: tel.i.value, summa: summa.i.value, muddatKun: forma.muddatKun };
      amalX(xatoJoyla([[ism, /ism/i], [tel, /telefon/i], [summa, /summa/i], [muddatX, /muddat/i]]), 'qarzYozish', f).then((r) => {
        if (!r) return;
        close();
        // Takrorda natija yo'q — xabar yangi holatdagi shu qarzdan (ruxsat kutayotgan bo'lsa ogohlantirish yo'qolmaydi).
        toast(...qarzXabari(r, S, x.id, f));
      });
    });
    box.append(ism.el, tel.el, summa.el, h('b', {}, 'Qachon qaytaradi?'), muddat, muddatX.el, res, btn);
  });
}

function oylikView(m, x) {
  const oy = oyKey(), av = (x.avanslar || []).filter((a) => a.oy === oy && !a.bekor);
  m.append(h('div', { class: 'card hero' }, h('div', { class: 'muted' }, 'Oy oxirida olasiz'), h('div', { class: 'big' }, H.som(H.oyOxiri(x, oy))),
    h('div', { class: 'muted' }, 'Oylik ' + H.som(x.oylik) + ' − shu oy olgan avanslaringiz ' + H.som(H.avansJami(x, oy)))));
  const c = h('div', { class: 'card' }, kartaSarlavha('Olingan avanslar'));
  if (!av.length) c.append(h('div', { class: 'muted' }, 'Bu oy avans olmagansiz. Avansni direktor beradi va shu yerda ko\'rinadi.'));
  av.forEach((a) => c.append(h('div', { class: 'line' }, h('span', {}, sana(a.ts)), h('b', {}, H.som(a.summa)))));
  m.append(c);
  // Davomat (29.10): direktor belgilaydi, xodim faqat ko'radi.
  const dv = menDavomat(retseptCtx(x));
  const dc = h('div', { class: 'card' }, kartaSarlavha('Davomat · shu oy'));
  if (!dv) dc.append(h('div', { class: 'muted', 'aria-live': 'polite' }, 'Yuklanmoqda…'));
  else if (dv.xato) dc.append(h('div', { class: 'msg warn', role: 'alert' }, 'Davomat olinmadi — internetni tekshirib, qayta oching.'));
  else {
    dc.append(h('div', { class: 'grid2' }, h('div', { class: 'kp-tile kirim' }, h('span', {}, 'Keldingiz'), h('b', {}, dv.keldi + ' kun')),
      h('div', { class: 'kp-tile chiqim' }, h('span', {}, 'Kelmadingiz'), h('b', {}, dv.kelmadi + ' kun'))));
    if (dv.kelmaganKunlar.length) dc.append(h('div', { class: 'muted' }, 'Kelmagan kunlar: ' + dv.kelmaganKunlar.map((k) => k.slice(8, 10) + '.' + k.slice(5, 7)).join(', ')));
    dc.append(h('div', { class: 'muted' }, 'Davomatni direktor belgilaydi. Xato bo\'lsa — direktorga ayting.'));
  }
  m.append(dc);
}

// ---- Xodim — yangi ko'rinish (07.11, egasi «variant A» ni tanladi) ----
// Pastki menyu yo'q: Bosh sahifadan hamma narsa bir bosishda — salom va davomat, katta qidiruv (+ skaner), 2×2 katta plitka
// (Qarz yozish, Kam qolgan, Retseptlar — ruxsat bo'lsa, Inventar), shtrix-kodlar, «Bugun», «Men». Ichki sahifada — Telegram
// «orqaga» va ‹ (kelgan sahifaga). Qarz yozish — 3 qadamli oyna (qarz-usta.mjs; amal va tekshiruv eski oynadagidek).
const XY_TAB = { bosh: 'Bosh sahifa', qarz: 'Qarzlarim', men: 'Men', oylik: 'Oyligim', dorilar: 'Dorilar', retsept: 'Retseptlar', oyin: 'Bilimdon', inventar: 'Inventar' };
let xYol = [];   // ichki sahifalar yo'li (orqaga — shu tartibda)
// 07.11 tun: sahifa almashishi — View Transition (qo'llamasa — oddiy). sinxron — chizishdan keyin darhol DOM'ga tegiladi
// (qidiruvga fokus, kamera tugmasi: iPhone klaviatura va kamerani faqat bosish ichida ochadi) — o'tishsiz.
function xOch(t, d, sinxron) { if (tab !== t) xYol.push(tab); tab = t; if (d) dTab = d; if (sinxron) render(true); else sahifaOtish(() => render(true)); }
function xOrqaga() {
  if (tab === 'retsept' && retseptIchida()) { retseptBosh(); render(true); return; }
  if (tab === 'inventar' && inventarOrqaga()) { render(true); return; }
  tab = xYol.pop() || 'bosh';
  sahifaOtish(() => render(true));
}
const qarzYoz = (x) => (eskiKorinishmi() ? qarzSheet(x) : qarzUsta({ S: () => S, x, amalX, toast }));

function renderXodimYangi(x) {
  if (!XY_TAB[tab]) tab = 'bosh';
  if (tab === 'bosh') xYol = [];
  korinishQolla(true);
  const ichki = tab !== 'bosh';
  if (!SERVER) root.append(h('div', { class: 'demo' }, 'Sinov rejimi · ', h('button', { class: 's', onclick: () => { kim = null; sessionStorage.removeItem('apteka-kim'); render(true); } }, 'boshqa xodim')));
  // Retsept punkti ichida o'zining «‹ Retseptlar» tugmasi bor — ikkita qaytish chiqmasin (audit 05.11).
  const orqa = ichki && !(tab === 'retsept' && retseptIchida()) ? orqagaTugma(xOrqaga) : null;
  const fNom = filialOf(x.filialId).nom + (x.daraja === 2 ? ' · 2-daraja' : '');
  root.append(h('header', { class: 'top yh' }, orqa || h('span', { class: 'avatar', 'aria-hidden': 'true' }, x.ism[0]),
    h('div', { class: 't' }, h('h1', {}, ichki ? XY_TAB[tab] : x.ism), h('span', {}, fNom + ' · ' + (ichki ? x.ism : kunNomi()))),
    yozuvTugma(render, x.id)));
  const m = h('main', { class: ichki ? 'y-ichki' : 'y-ildiz yx' });
  if (tab === 'bosh') xBosh(m, x);
  if (tab === 'qarz') qarzView(m, x);
  if (tab === 'men') xMen(m, x);
  if (tab === 'oylik') oylikView(m, x);
  if (tab === 'dorilar') {
    // Defekturadagi dori keldi (oxirgi 3 kun) — karta («Keldi» bo'limida — ro'yxatning o'zi). Eski ko'rinishdagi bilan bir xil.
    const keldi = kelganlarim(x);
    if (keldi.length && dTab !== 'keldi') {
      m.append(h('div', { class: 'card ok' }, kartaSarlavha(['Keldi: ', h('span', { 'data-asl': '' }, keldi.join(', '))]),
        h('div', { class: 'muted' }, 'Kam dori ro\'yxatidagi dori aptekaga keldi.')));
    }
    m.append(pills([['kam', 'Kam qoldi'], ['keldi', 'Keldi'], ['narx', 'Narxlar']], dTab, (v) => { dTab = v; render(true); }, 'Dorilar bo\'limi'));
    if (dTab === 'kam' && !fy('x_defektura')) m.append(h('div', { class: 'card muted' }, 'Kam qolgan dorini yozish direktor tomonidan o\'chirilgan.'));
    else if (dTab === 'kam') defekturaXodim(m, { S, amal, amalX, toast, qidir, oson: { ...retseptCtx(x), qidiruvYoq: !fy('x_qidiruv') } }, x);
    if (dTab === 'keldi') m.append(kelganKarta(S));
    if (dTab === 'narx' && SERVER && fy('x_qidiruv')) m.append(osonQidiruv(retseptCtx(x), (id) => ((S.filiallar || []).find((f) => f.id === id) || {}).nom || id));
    if (dTab === 'narx') m.append(praysQidiruv({ S, qidir }));
  }
  const ochiq = { retsept: 'x_retsept', oyin: 'x_oyin', inventar: 'x_inventar' }[tab];
  if (ochiq && !fy(ochiq)) m.append(h('div', { class: 'card muted', role: 'status' }, 'Bu bo\'lim direktor tomonidan o\'chirilgan.'));
  else {
    if (tab === 'retsept') retseptView(m, retseptCtx(x));
    if (tab === 'oyin') oyinView(m, retseptCtx(x));
    if (tab === 'inventar') inventarView(m, retseptCtx(x), (id) => filialOf(id).nom || id);
  }
  // O'yin ochilgan bo'lsa (xodim hali kirmagan) — sahifa tepasida xabar.
  if (tab !== 'oyin' && fy('x_oyin')) {
    const ob = oyinBanner(retseptCtx(x), () => { oyinBosh(); xOch('oyin'); });
    if (ob) m.prepend(ob);
  }
  root.append(m);
  orqagaQoy(ichki ? xOrqaga : null);
  tanishuvAvto('xodim');   // 07.11 tun: birinchi ochilishda 3 ta qisqa ekran (shu Telegram akkaunti uchun bir marta)
}

// Qidiruv sahifasini ochadi (Dorilar → Narxlar) va maydonga fokus beradi; skan — o'sha yerdagi kamera tugmasi bosiladi.
// Bosish ichida (iOS klaviatura va kamerani faqat foydalanuvchi bosganda ochadi).
function qidiruvOch(skan) {
  xOch('dorilar', 'narx', true);
  if (skan) { const b = root.querySelector('main .skan-tugma'); if (b) { b.click(); return; } }
  qidiruvgaFokus();
}

// Bosh sahifa (yangi): salom va davomat, qidiruv, 2×2 plitka, shtrix-kodlar, «Bugun», «Men».
function xBosh(m, x) {
  const ctx = retseptCtx(x);
  const dv = menDavomat(ctx);
  const [dMatn, dRang] = !dv ? ['Davomat yuklanmoqda…', 'kul'] : dv.xato ? ['Davomat olinmadi', 'sariq'] : dv.bugun === true ? ['Bugun keldingiz', 'yashil']
    : dv.bugun === false ? ['Bugun «kelmadi» belgilangan', 'qizil'] : ['Davomat hali belgilanmagan', 'kul'];
  const soat = Number(new Date().toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: 'Asia/Tashkent' })) % 24;
  const salom = soat < 11 ? 'Xayrli tong' : soat < 18 ? 'Xayrli kun' : 'Xayrli kech';
  m.append(h('div', { class: 'yx-salom' }, h('b', {}, salom + '!'),
    h('span', { class: 'yx-pill ' + dRang, role: 'status' }, dRang === 'yashil' ? ikon('check') : null, dMatn)));
  // Katta qidiruv (≥ 60 px) va skaner.
  if (fy('x_qidiruv')) m.append(h('div', { class: 'yx-qidir' },
    h('button', { type: 'button', class: 'yx-qidir-t', onclick: () => qidiruvOch(false) }, ikon('qidir'), h('span', {}, 'Dori qidirish — narxi, qaysi filialda')),
    h('button', { type: 'button', class: 'yx-skan', 'aria-label': 'Qutidagi shtrix-kodni kamera bilan o\'qish', onclick: () => qidiruvOch(true) }, ikon('skan'))));
  // 2×2 katta plitka.
  const plitka = (ik, nom, rang, onclick, izoh) => h('button', { type: 'button', class: 'yx-p', onclick },
    h('span', { class: 'yq-d ' + rang, 'aria-hidden': 'true' }, ikon(ik)), h('b', {}, nom), izoh ? h('span', { class: 'muted' }, izoh) : null);
  const defSoni = H.defekturaGuruh((S.defektura || []).filter((d) => d.filialId === x.filialId)).filter((d) => d.holat === 'yangi').length;
  m.append(h('nav', { class: 'yx-plitkalar', 'aria-label': 'Asosiy amallar' },
    fy('x_qarz') ? plitka('qarzYoz', 'Qarz yozish', 'sariq', () => qarzYoz(x), 'Mijoz pulsiz oldi') : null,
    !fy('x_defektura') ? null : plitka('dori', 'Kam qolgan', 'kok', () => xOch('dorilar', 'kam'), defSoni ? defSoni + ' ta yozilgan' : 'Defekturaga yozish'),
    retseptRuxsat(S, x) && fy('x_retsept') ? plitka('retsept', 'Retseptlar', 'yashil', () => { retseptBosh(); xOch('retsept'); }, 'Punkt ro\'yxatlari') : null,
    SERVER && fy('x_inventar') ? plitka('inventar', 'Inventar', 'binafsha', () => xOch('inventar'), 'Telefon bilan sanash') : null));
  // Shtrix-kodlar — sotuvda doim kerak (05.11 foydalanuvchi: "asosiy ekranga — uni doim ishlatadilar").
  // 07.11 kech (foydalanuvchi: "dori so'rovi asosiy ekranda ajralib ko'rinib tursin"): amallar ostida, birinchi karta (filial-sorov.mjs).
  if (SERVER) m.append(sorovKarta(ctx, () => { if (tab === 'bosh') render(); }));
  const sk = shtrixKarta(S);
  if (sk) { sk.id = 'shtrix-karta'; sk.tabIndex = -1; m.append(sk); }
  // «Bugun»: kelgan dorilar va bugun yozgan qarzlar (ismsiz — kassa oldida begona ko'rmasin; audit 05.11).
  const bugun = H.kunKey(Date.now());
  const qarzlarim = S.qarzlar.filter((q) => q.xodimId === x.id && H.kunKey(q.berildi) === bugun && q.holat !== 'rad');
  const keldi = kelganlarim(x);
  const c = h('section', { class: 'card list x-bugun yx-bugun' }, kartaSarlavha('Bugun'));
  keldi.forEach((nom) => c.append(ishQator({ icon: 'defektura', rang: 'kirim', sarlavha: [h('span', { 'data-asl': '' }, nom), ' keldi'], izoh: 'Kam dori ro\'yxatidagi dori · so\'ragan mijozga ayting', onclick: () => xOch('dorilar', 'keldi') })));
  if (qarzlarim.length) {
    const ruxsat = qarzlarim.filter((q) => q.holat === 'ruxsat').length;
    c.append(ishQator({ icon: 'odam', rang: 'warn', sarlavha: 'Bugun ' + qarzlarim.length + ' ta qarz yozdingiz',
      izoh: 'Jami ' + H.som(qarzlarim.reduce((a, q) => a + (q.summa || 0), 0)) + (ruxsat ? ' · ' + ruxsat + ' tasi ruxsat kutmoqda' : ''), onclick: () => xOch('qarz') }));
  }
  if (!keldi.length && !qarzlarim.length) c.append(h('div', { class: 'muted' }, 'Hozircha yangilik yo\'q.'));
  m.append(c);
  const mo = muddatiOtganKarta(ctx, (id) => filialOf(id).nom || id, () => { if (tab === 'bosh') render(); });
  if (mo) m.append(mo);
  const nk = SERVER && fy('x_narx') ? narxXodimKarta(ctx, (id) => filialOf(id).nom || id, () => { if (tab === 'bosh') render(); }) : null;
  if (nk) m.append(nk);
  { const bk = SERVER && fy('x_bron') ? bronKarta(ctx, (id) => filialOf(id).nom || id, () => { if (tab === 'bosh') render(); }) : null; if (bk) m.append(bk); }   // mijoz bronlari (bron.mjs)
  // «Men» — qarzlarim, oyligim, Bilimdon.
  m.append(h('button', { type: 'button', class: 'card yx-men', onclick: () => xOch('men') },
    h('span', { class: 'avatar', 'aria-hidden': 'true' }, x.ism[0]),
    h('span', { class: 'yq-m' }, h('b', {}, 'Men'), h('span', { class: 'muted' }, 'Qarzlarim, oyligim, davomat, Bilimdon')),
    h('span', { class: 'yq-o' }, ikon('oldinga'))));
  m.append(yordam('Smena ochish-yopish yo\'q: kunlik savdoni direktor kiritadi. Kassadan pul chiqsa (suv, paket…) — direktorga ayting. '
    + 'Kelganingizni direktor belgilaydi. Mijoz dori so\'rasa — «Dori qidirish»: narxi va qaysi filialda borligi.', 'Har kuni nima qilaman?'));
}

// Men (yangi): qarzlarim, oyligim (davomat bilan), Bilimdon, ko'rinish.
function xMen(m, x) {
  const mine = S.qarzlar.filter((q) => q.xodimId === x.id && (q.holat === 'ochiq' || q.holat === 'ruxsat'));
  const otgan = mine.filter((q) => q.holat === 'ochiq' && H.muddatiOtgan(q)).length;
  const dv = menDavomat(retseptCtx(x));
  m.append(...bolimlar([
    { nom: 'Men', qatorlar: [
      { ikon: 'qarz', rang: 'sariq', l: 'Qarzlarim', izoh: otgan ? otgan + ' tasining muddati o\'tgan' : mine.length + ' ta ochiq qarz', diqqat: otgan > 0,
        qiymat: H.som(H.xodimOchiq(mine, x.id)), onclick: () => xOch('qarz') },
      { ikon: 'oylik', rang: 'yashil', l: 'Oyligim', izoh: 'Oylik, avanslar' + (dv && !dv.xato ? ' · shu oy ' + dv.keldi + ' kun keldingiz' : ', davomat'), onclick: () => xOch('oylik') },
      fy('x_oyin') ? { ikon: 'oyin', rang: 'binafsha', l: 'Bilimdon', izoh: 'O\'yin va mashqlar — dorilarni yaxshiroq bilish uchun', onclick: () => { oyinBosh(); xOch('oyin'); } } : null].filter(Boolean) },
    { nom: 'Ilova', qatorlar: [
      { ikon: 'korinish', rang: 'kul', l: 'Ko\'rinish', izoh: 'Eski ko\'rinish, harf o\'lchami', onclick: () => xKorinish() },
      { ikon: 'xabar', rang: 'yashil', l: 'Qanday ishlatiladi?', izoh: '3 ta qisqa ekran — asosiy joylar', onclick: () => tanishuvOch('xodim') }] }]));
}

// Prays-listdan qidirish (faqat o'qish — holat yangilanmaydi). Xato bo'lsa — bo'sh ro'yxat.
async function qidir(soz) {
  if (!SERVER) return A.praysQidir(soz);
  try { return (await serverga('prays_qidir', [soz], tg.initData)).natija || []; } catch (e) { return []; }
}
const chiqish = () => { kim = null; sessionStorage.removeItem('apteka-kim'); render(true); };
// Faqat o'qiydigan so'rov (holat o'zgarmaydi): retseptlar ro'yxati.
async function oqi(nom, ...args) {
  if (!SERVER) return sinovdaBajar(nom, S, (S.xodimlar || []).find((z) => z.id === kim) || { id: kim }, args);
  const [api, a] = serverSorovi(nom, args);
  return (await bandBolsaQayta(() => serverga(api, a, tg.initData))).natija;   // server band (503) — o'zi qayta
}
const rasmniOl = (id) => (SERVER ? rasmOl(id, tg.initData) : Promise.resolve(null));
// yuklashManzil (07.11 tun) — telefonga yuklash havolasi (store.mjs; sinov rejimida yo'q).
const retseptCtx = (x) => ({ S, x, amal, amalX, amalFon, oqi, toast, rasmOl: rasmniOl, rerender: render, server: SERVER, tg,
  yuklashManzil: SERVER ? yuklashManzil : null });
// Firma prayslari (30.10): faylni olish va saqlash — server band (503) bo'lsa o'zi qayta.
const firmaCtx = SERVER ? { fayl: (id) => bandBolsaQayta(() => faylOl(id, tg.initData)), yukla: (b) => bandBolsaQayta(() => firmaPraysYukla(b, tg.initData)) } : null;

// Ekranni chizish. tepaga (true yoki { tepaga }) — boshqa bo'limga o'tildi: sahifa boshidan.
// Aks holda (yangi holat keldi, amaldan keyin) — aylantirish joyi, sahifadagi maydonlarga yozilgan qiymatlar va fokus saqlanadi.
// { unut: 'prefiks' } — muvaffaqiyatli yuborilgan formaning qiymatlari unutiladi.
function render(o) {
  const tepaga = o === true || !!(o && o.tepaga);
  holatniEsla(root);
  if (o && o.unut) unut(o.unut);
  const y = window.scrollY;
  root.textContent = '';
  // 28.10 (audit): chizishda xato bo'lsa (masalan serverdan kutilmagan ma'lumot) — oq ekran emas, tushunarli karta.
  try { chiz(); } catch (e) {
    console.error('chizish', e);
    root.textContent = '';
    root.append(h('div', { class: 'card warn', role: 'alert', style: 'margin:16px' }, kartaSarlavha('Ekran ochilmadi'),
      h('div', {}, 'Ilovada xatolik bo\'ldi. «Qayta urinish»ni bosing; takrorlansa — ilovani yopib qayta oching va direktorga ayting.'),
      h('button', { class: 'p', onclick: () => { render(true); if (SERVER && tg) serverdanYukla(); } }, 'Qayta urinish')));
    return;
  }
  if (eskirgan && S) {
    root.prepend(h('div', { class: 'msg warn eskirgan', role: 'alert' }, h('span', {}, eskirgan),
      eskirdi ? yopishTugma('sm') : h('button', { class: 'sm', onclick: () => serverdanYukla() }, 'Yangilash')));
  }
  try { navbatBelgi(); } catch (e) { /* belgisiz */ }
  holatniTikla(root);
  // Harakat (29.10): yangi bo'lim/sahifa ochilganda — bloklar ketma-ket chiqadi; holat yangilanganda harakat yo'q.
  // 07.11 tun: View Transition ketayotgan bo'lsa — ekranni brauzer almashtiradi, bloklar alohida chiqmaydi (ikki harakat bo'lmasin).
  if (tepaga && !otishdami()) { const mm = root.querySelector('main, .o-main'); if (mm) mm.classList.add('kirish'); }
  window.scrollTo(0, tepaga ? 0 : y);
}

function chiz() {
  // Oddiy rejim belgisi (oddiy.mjs qo'yadi) — har chizishda olib tashlanadi, kerak bo'lsa qayta qo'yiladi.
  root.classList.remove('oddiy');
  document.documentElement.classList.remove('oddiy-rejim', 'oddiy-katta');
  panelChiz();
  // Yozuv (shu telefonda, hamma panel): kirill bo'lsa — chizilgan matn kirillga; oynalar va xabarlarni kuzatuvchi o'tkazadi.
  const kir = yozuvKirillmi(kim);
  document.documentElement.classList.toggle(KIRILL, kir);
  if (kir) { kirillKuzat(); kirillDom(root); }
}

function panelChiz() {
  orqagaQoy(null);   // har panel o'z «orqaga»sini qayta qo'yadi
  // 07.11: Telegram ⋮ → Sozlamalar va yangi ko'rinish belgisi — direktor va xodim paneli o'zi qo'yadi (punkt, ta'minotchi — yo'q).
  sozlamaTugmasi(null);
  korinishQolla(false);
  if (SERVER && !S) return renderServerKutish();
  // Punkt: o'z ro'yxatlari holati (faqat ko'rish).
  const pk = SERVER ? (S.men && S.men.rol === 'punkt' ? S.punkt : null) : kim && ((S.retsept || {}).punktlar || []).find((p) => p.id === kim);
  if (pk) return renderPunkt(root, { S, amal, amalX, toast, rerender: render, logout: SERVER ? null : chiqish }, SERVER ? pk : A.punktPanel(S, pk.id));
  // Ta'minotchi: serverda — o'z holati (S.taminotchi), sinovda — ro'yxatdan.
  const ta = SERVER ? (S.men && S.men.rol === 'taminotchi' ? S.taminotchi : null) : kim && (S.taminotchilar || []).find((t) => t.id === kim);
  if (ta) {
    if (!SERVER && !ta.uzildi) ta.ulangan = true;   // sinov: "havola bilan ulangan" deb hisoblaymiz (uzilgani — yo'q)
    return renderTaminotchi(root, { S, amal, amalX, toast, rerender: render, logout: SERVER ? null : chiqish }, ta);
  }
  const x = kim && H.ishdagi(S.xodimlar.find((z) => z.id === kim), S);   // vaqtincha boshqa filialda bo'lsa — o'sha filial
  if (!x) return renderKirish();
  if (x.rol === 'direktor') {
    return renderDirektor(root, { S, x, amal, amalX, toast, qidir, rerender: render, server: SERVER, logout: SERVER ? null : chiqish, retseptCtx: () => retseptCtx(x), firma: firmaCtx });
  }
  // 07.11: yangi ko'rinish standart; «Eski ko'rinish» (shu telefonda) — avvalgi panel o'zgarishsiz.
  sozlamaTugmasi(() => xKorinish());
  if (eskiKorinishmi()) renderXodim(x); else renderXodimYangi(x);
}
// Ko'rinish oynasi (Telegram ⋮ → Sozlamalar; ilovada — Men → «Ko'rinish»). Almashganda — Bosh sahifaga.
const xKorinish = () => korinishOyna({ rerender: render, almashdi: () => { tab = 'bosh'; xYol = []; }, tanishuv: () => tanishuvOch('xodim') });

// Telegram ichida ochilganmi (SDK kelmagan bo'lsa ham): Telegram manzilga tgWebAppData qo'shadi va o'z ko'prigini qo'yadi.
const telegramdanOchilgan = () => /tgWebAppData=/.test(location.hash) || typeof window.TelegramWebviewProxy !== 'undefined';
// 401 (audit 06.11): Telegram kirish ma'lumoti eskirgan — «Qayta urinish» foyda bermaydi; ilovani yopish (keyin qayta ochiladi).
const yopishTugma = (cls) => h('button', { class: cls, onclick: () => { try { if (tg && tg.close) tg.close(); else location.reload(); } catch (e) { location.reload(); } } }, 'Ilovani yopish');

// Server rejimi: yuklanmoqda / Telegram'dan tashqarida ochilgan / xato.
function renderServerKutish() {
  root.append(h('header', { class: 'top' }, h('div', { class: 't' }, h('h1', {}, 'Apteka'))));
  const m = h('main', {});
  if (!tg && telegramdanOchilgan()) {
    // Audit 06.11: Telegram ichida ochilgan, lekin Telegram skripti (vendor/telegram-web-app.js) kelmadi — internet.
    m.append(h('div', { class: 'card warn', role: 'alert' }, kartaSarlavha('Ilova yuklanmadi'),
      h('div', {}, 'Internet sekin yoki uzilgan — ilovaning bir fayli kelmadi. «Qayta urinish»ni bosing.'),
      h('button', { class: 'p', onclick: () => location.reload() }, 'Qayta urinish')));
  } else if (!tg) {
    m.append(h('div', { class: 'card' }, kartaSarlavha('Ilovani Telegram ichida oching'),
      h('div', { class: 'muted' }, 'Botdagi "Ochish" tugmasi yoki direktor yuborgan havola orqali.')));
  } else if (raqamKutish) {
    m.append(h('div', { class: 'card muted', 'aria-live': 'polite' }, 'Raqam tekshirilmoqda…'));
  } else if (xato && raqamKerak) {
    const bor = typeof tg.requestContact === 'function' && (!tg.isVersionAtLeast || tg.isVersionAtLeast('6.9'));
    m.append(h('div', { class: 'card', role: 'alert' }, kartaSarlavha('Telefon raqamingizni tasdiqlang'),
      h('div', {}, 'Bu havola faqat egasining telefon raqamida ochiladi. '
        + (bor ? 'Pastdagi tugmani bosing — Telegram raqamingizni yuboradi.' : 'Botga /raqam deb yozing, tugmani bosing va havolani qayta oching.')),
      bor ? h('button', { class: 'p', onclick: () => raqamYubor() }, '📱 Raqamni yuborish') : null));
  } else if (xato) {
    m.append(h('div', { class: 'card warn', role: 'alert' }, kartaSarlavha('Ilova ochilmadi'), h('div', {}, xato),
      xatoTafsil ? h('div', { class: 'muted', style: 'margin-top:6px;font-size:14px' }, 'Tekshirildi: ' + xatoTafsil) : null,
      eskirdi ? yopishTugma('p') : h('button', { class: 'p', onclick: () => { xato = null; xatoTafsil = ''; render(); serverdanYukla(); } }, 'Qayta urinish')));
  } else {
    m.append(h('div', { class: 'card muted', 'aria-live': 'polite' }, sekin ? 'Internet sekin — boshqa yo\'l bilan ulanmoqda…' : 'Yuklanmoqda…'));
  }
  root.append(m);
}

// Ushlanmagan xato (tugma ichida va h.k.) — jim qolmasin.
window.addEventListener('unhandledrejection', (ev) => { console.error('ushlanmagan', ev.reason); toast('Kutilmagan xato — amal bajarilmagan bo\'lishi mumkin. Tekshirib, qayta urinib ko\'ring', 'xato'); });
window.addEventListener('error', (ev) => { if (ev && ev.error) toast('Kutilmagan xato — ilovani yopib qayta oching', 'xato'); });

render();
if (SERVER && tg) {
  serverdanYukla();
  // Ilovaga qaytganda — yangi holat (boshqa xodim smenani yopgan bo'lishi mumkin). Yozilgan qiymatlar saqlanadi.
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && S && !band) serverdanYukla(); });
}
// Ochilish qorovuli (src/boshla.js): ilova ekranni chizdi — «Ilova yuklanmadi» kartasi endi kerak emas.
if (window.__ilova) window.__ilova.tayyor = true;
