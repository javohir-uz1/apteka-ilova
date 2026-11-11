// Telegram Mini App: xodim paneli (smena, qarz, oylik) va direktor paneli.
// Server manzili (config.mjs) bo'lsa va Telegram ichida ochilsa — server rejimi; aks holda sinov rejimi (shu brauzerda).
// Matnlar birinchi marta ochgan, o'rgatilmagan odam uchun yozilgan (audit 24.10): har ekranda — keyingi qadam nima.
import * as A from './amallar.mjs';
import * as H from './hisob.mjs';
import { API_URL } from './config.mjs';
import { yukla, saqla, tozala, serverga, rasmOl, faylOl, firmaPraysYukla, filialSuratYukla, yuklashManzil } from './store.mjs';
import { retseptBosh, retseptIchida, retseptRuxsat, retseptView } from './retsept.mjs';
import { renderPunkt } from './punkt.mjs';
import { serverSorovi, sinovdaBajar } from './ishlar.mjs';
import { bandBolsaQayta, kutayotganKuzat, kutayotganMatn, kutayotganTashlangan, qoidaXatosi, sorovchi, urinishMatni } from './sorov.mjs';
import { qarzXabari } from './xabar.mjs';
import { guruhXato, h, holatniEsla, holatniTikla, input, ishQator, kartaSarlavha, kunNomi, mavzu, nav, ochiladi, otishdami, oynalarYopilganda, oyKey, orqagaQoy, pills, qaytaOchOynaga, qaytaOchXatomi, sahifaOtish, sana, sheet, svg, tasdiqlash, tgKechiktir, tgOrqagaUlash, toast, unut, vaqt, xatoJoyla, yordam, yozuvTugma } from './ui.mjs';
import { KIRILL, kirillDom, kirillKuzat, kirillYut, yozuvKirillmi } from './kirill.mjs';
import { renderDirektor } from './direktor.mjs';
import { renderTaminotchi } from './taminotchi.mjs';
import { defekturaXodim, kelganKarta, praysQidiruv } from './bolimlar.mjs';
import { shtrixBormi, shtrixIzoh, shtrixKarta, shtrixRoyxatOyna } from './shtrix.mjs';
import { muddatiOtganKarta, osonQidiruv } from './oson-qoldiq.mjs';
import { narxXodimKarta } from './nazorat.mjs';
import { bronKarta, bronYuklanganmi } from './bron.mjs';
import { sorovKarta } from './filial-sorov.mjs';
import { otkazmaKarta, otkazmaSorashOch, otkazmaYuklanganmi } from './kassa.mjs';
import { kirimKarta, kirimYuklanganmi } from './kirim.mjs';
import { keldiHolat, keldiKarta, keldiOch } from './keldi.mjs';
import { inventarOrqaga, inventarView } from './inventar.mjs';
import { oyinBanner, oyinBosh, oyinView } from './oyin.mjs';
import { menDavomat } from './davomat.mjs';
import { bolimlar, qator as qobiqQator, eskiKorinishmi, haptik, korinishOyna, korinishQolla, orqagaTugma, sozlamaTugmasi } from './qobiq.mjs';
import { ikon } from './ikon.mjs';
import { qarzUsta } from './qarz-usta.mjs';
import { qrKerak, qrOyna, tasdiqHolati, tolovOyna, topshirKarta, yozilgandan } from './qarz-mijoz.mjs';
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
if (!SERVER) window.addEventListener('storage', (e) => { if (e.key === 'apteka-demo-v1') { S = yukla(); rerender({ fon: true }); } });
let kim = null;
if (!SERVER) { try { kim = sessionStorage.getItem('apteka-kim'); } catch (e) { /* saqlash bloklangan brauzer */ } }   // sinov rejimi: Telegram kirishi o'rniga
let tab = 'bosh';
let dTab = 'kam';   // xodim → Dorilar ichidagi bo'lim
const root = document.getElementById('app');

// Serverga yuboruvchi (sorov.mjs): C1 kalit — xatodan keyin aynan shu so'rov qayta yuborilsa o'sha kalit (server ikki marta
// yozmaydi); kech kelgan eski holat yangisining ustidan yozilmaydi. Oyna yopilib sahifa ko'ringach — eski kalitlar unutiladi.
const sorov = sorovchi({ serverga, initData: () => tg.initData, korinadimi: () => !document.querySelector('.sheet-bg:not(.yopilmoqda)') });
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
// Oxirgi muvaffaqiyatsiz amal sababi (audit 09.11): chaqiruvchi xabarni turiga qarab yozsin (qarz-usta.mjs xatoMatni).
// { tur: 'eskirdi' (401) | 'tarmoq' | 'server' (5xx) | 'band' (boshqa amal ketyapti) | 'qoida' (400, tekshiruv), matn }.
let oxirgiXato = null;
const xatoTuri = (e) => (e && e.status === 401 ? 'eskirdi' : e && e.tarmoq ? 'tarmoq' : e && e.status >= 500 ? 'server' : 'qoida');
// 401 (audit 09.11): Telegram kirish ma'lumoti eskirgan — amal ham, qidiruv ham endi o'tmaydi: tepada «Ilova eskirdi» va
// «Ilovani yopish» (avval faqat xabar chiqib, xodim qayta-qayta bosardi).
function eskirdiTekshir(e) {
  if (!SERVER || !e || e.status !== 401 || eskirdi) return;
  eskirdi = true; eskirgan = 'Ilova eskirdi — yopib, Telegram\'dan qayta oching';
  rerender({ fon: true });
}
// Server so'rovi ketayotganda — faqat bosilgan tugma o'chiq va «Saqlanmoqda…» (audit 09.11: avval body.band hamma tugmani,
// oyna «×» ini ham 35 s gacha bloklardi). Tugma: bosish hodisasi (window.event) yoki fokusdagi tugma. → qaytarish funksiyasi.
function tugmaBand() {
  let t = null;
  try { const ev = window.event; t = ev && ev.target && ev.target.closest ? ev.target.closest('button') : null; } catch (e) { t = null; }
  if (!t) { const a = document.activeElement; t = a && a.tagName === 'BUTTON' ? a : null; }
  if (!t || t.disabled || t.classList.contains('x')) return () => {};
  const bolalar = [...t.childNodes];
  t.disabled = true; t.setAttribute('aria-busy', 'true');
  // Yozuvli tugma — «Saqlanmoqda…»; faqat belgili (aria-label bilan) tugmaning ko'rinishi o'zgarmaydi (sig'masdi).
  const yozuvli = !t.hasAttribute('aria-label') && t.textContent.trim().length > 1;
  if (yozuvli) t.textContent = 'Saqlanmoqda…';
  return () => {
    if (!t.isConnected) return;   // ekran qayta chizildi — yangi tugma o'z holida
    t.disabled = false; t.removeAttribute('aria-busy');
    if (yozuvli) t.replaceChildren(...bolalar);
  };
}
async function bajar(nom, args, xatoQoy) {
  oxirgiXato = null;
  if (band) { oxirgiXato = { tur: 'band', matn: '' }; toast('Oldingi amal saqlanmoqda — bir soniyadan keyin qayta bosing', 'xato'); return null; }
  const men = H.ishdagi((S.xodimlar || []).find((z) => z.id === kim), S) || { id: kim };   // ta'minotchi: faqat id
  let qaytar = null;
  try {
    if (!SERVER) {
      const r = sinovdaBajar(nom, S, men, args);
      saqla(S); render({ unut: FORMA[nom] });
      haptik('ok');
      return r === undefined ? true : r;
    }
    const [api, a] = serverSorovi(nom, args);   // noto'g'ri summa — shu yerda xato, so'rov yuborilmaydi
    band = true;   // ikki marta yuborilmasin (ekran bloklanmaydi — faqat bosilgan tugma)
    qaytar = tugmaBand();
    const r = await sorov.yubor(api, a);
    if (r.holat) { S = r.holat; eskirgan = null; }   // audit 06.11: yangi holat keldi — «eski» ogohlantirishi olinadi
    band = false;
    render({ unut: FORMA[nom] });
    haptik('ok');   // 07.11: saqlandi — Telegram tebranishi (eski Telegram va brauzerda jim)
    // Takror: natija TAKROR (raqam/matn emas) — natijadan xabar tuzadigan joylar buni alohida ko'rsatadi.
    if (r.takror) toast('Bu amal avvalgi urinishda saqlangan ekan ✓');
    return r.natija;
  } catch (e) {
    band = false;
    haptik('xato');
    oxirgiXato = { tur: xatoTuri(e), matn: e && e.message };
    // Maydon tagiga — faqat qoida xatosi; tarmoq/server/kirish xatosi — umumiy xabar.
    // 10.11 (yangi kirish): server «ilovani yoping, qayta oching» desa — maydon tagiga emas: oyna tepasida va doimiy banner
    // («Ilovani yopish» bilan); oyna yopilmaydi — yozilganlar joyida qoladi.
    if (SERVER && qaytaOchXatomi(e)) qaytaOchKorsat();
    else if (!(xatoQoy && qoidaXatosi(e) && xatoQoy(e.message))) toast(e.message, 'xato');
    eskirdiTekshir(e);
    // Audit 09.11: qoida xatosi ko'pincha «holat o'zgardi» (boshqa xodim yozdi, mijoz botda tasdiqladi) — ekran fonda yangilansin,
    // aks holda har qayta urinish eski ma'lumot bilan yana yiqiladi.
    if (SERVER && e && e.status === 400) setTimeout(() => { serverdanYukla().catch(() => {}); }, 0);
    return null;
  } finally {
    band = false;
    if (qaytar) qaytar();   // oynadagi tugma (oyna yopilmagan bo'lsa) o'z holiga qaytadi; sahifadagisi qayta chizilgan
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
    // band — boshqa amal ketyapti, o'zi chizadi. Audit 09.11: fon chizishi — barmoq bosib turgan yoki yozayotgan bo'lsa kutadi.
    if (r.holat) { S = r.holat; eskirgan = null; if (!band) rerender({ fon: true }); }
    return r.natija;
  } catch (e) {
    if (qaytaOchXatomi(e)) qaytaOchKorsat(); else toast(e.message, 'xato');
    eskirdiTekshir(e);
    return null;
  }
}

// Server rejimi: holatni olish. Ro'yxatda yo'q odam taklif havolasi bilan kirgan bo'lsa — avval ulanadi.
// Ilovaga qaytganda ham chaqiriladi: kech kelgan javob undan keyin kelgan holat ustidan yozilmaydi.
async function serverdanYukla(avto = 0) {
  const start = tg && tg.initDataUnsafe && tg.initDataUnsafe.start_param;
  const sekinT = !S ? setTimeout(() => { if (!S && !xato) { sekin = true; rerender({ fon: true }); } }, 8000) : 0;
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
    } else if (!S || e.status === 400 || e.status === 403) {
      // Audit 09.11: 400/403 (masalan xodim ro'yxatdan chiqarilgan) — «internetni tekshiring» emas, server matni; eski
      // ma'lumot (oylik, qarzlar) ko'rinib qolmaydi — panel yashiriladi.
      if (S) { S = null; eskirgan = null; }
      xato = e.message; eskirdi = e.status === 401;   // eski holat bor bo'lsa — ko'rsatishda davom etamiz
      xatoTafsil = e.tarmoq ? [urinishMatni(e.urinishlar), typeof navigator !== 'undefined' && navigator.onLine === false ? 'telefonda internet o\'chiq' : '',
        new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })].filter(Boolean).join(' · ') : '';
    }
    // 28.10 (audit): eski holat ko'rinib turibdi — xodim buni bilsin (eski balans bilan ish qilmasin).
    else { eskirdi = e.status === 401; eskirgan = eskirdi ? 'Ilova eskirdi — yopib, Telegram\'dan qayta oching' : 'Ma\'lumot yangilanmadi — internetni tekshiring. Ekrandagi raqamlar eski bo\'lishi mumkin'; }
  }
  clearTimeout(sekinT); sekin = false;
  if (S) { kim = S.men.id; xatoTafsil = ''; }
  // Audit 09.11: fon chizishi — ilovaga qaytganda (visibilitychange) yozayotgan maydon almashtirilmaydi, bosish yo'qolmaydi.
  rerender({ fon: true });
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
    h('div', { class: 't' }, h('h1', {}, tab === 'bosh' ? h('span', { 'data-asl': '' }, x.ism) : XTAB[tab]),
      h('span', {}, h('span', { 'data-asl': '' }, filialOf(x.filialId).nom), (x.daraja === 2 ? ' · 2-daraja' : '') + (tab === 'bosh' ? '' : ' · '), tab === 'bosh' ? null : h('span', { 'data-asl': '' }, x.ism))),
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
    if (dTab === 'keldi' && SERVER && fy('x_qidiruv')) m.append(keldiKarta(retseptCtx(x), () => { if (tab === 'dorilar') rerender(); }, { doim: true }));   // 11.11: Oson'ga bugun kelganlar
    // Oson qoldig'i (02.11): «Qaysi filialda bor?» — har filialdagi soni va Oson'dagi sotuv narxi; prays-list — pastda.
    if (dTab === 'narx' && SERVER && fy('x_qidiruv')) m.append(osonQidiruv(retseptCtx(x), (id) => ((S.filiallar || []).find((f) => f.id === id) || {}).nom || id));
    if (dTab === 'narx') m.append(praysQidiruv({ S, qidir }));
  }
  const ochiq0 = { retsept: 'x_retsept', oyin: 'x_oyin', inventar: 'x_inventar' }[tab];
  if (ochiq0 && !fy(ochiq0)) m.append(h('div', { class: 'card muted' }, 'Bu bo\'lim direktor tomonidan o\'chirilgan.'));
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
    h('div', { class: 'x-karta-bosh' }, h('span', { class: 'muted' }, 'Oy oxirida olasiz'), h('span', { class: 'x-holat' }, jonliQoy(davomat))),
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
  if (SERVER) m.append(sorovKarta(ctx, () => { if (tab === 'bosh') rerender(); }));
  // 10.11 tun: «Kartaga tushdimi?» — mijoz o'tkazmasini direktorga so'rash (kassa.mjs).
  if (SERVER) { const ok = otkazmaKarta(ctx, () => { if (tab === 'bosh') rerender(); }); if (ok) m.append(ok); }
  // 10.11 kunduz: Oson'da filialga ko'chirilgan dorilar — sanab tasdiqlash (kirim.mjs).
  if (SERVER) { const kk = kirimKarta(ctx, () => { if (tab === 'bosh') rerender(); }); if (kk) m.append(kk); }
  // 11.11: «Yangi kelgan dorilar» — faqat ma'lumot (keldi.mjs): amal kartalaridan keyin; «Qidiruv» o'chiq bo'lsa — yo'q.
  if (SERVER && fy('x_qidiruv')) m.append(keldiKarta(ctx, () => { if (tab === 'bosh') rerender(); }));
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
  const mo = muddatiOtganKarta(ctx, (id) => filialOf(id).nom || id, () => { if (tab === 'bosh') rerender(); });
  if (mo) m.append(mo);
  // 07.11: direktor tanlagan narx — Oson'da tuzatish; narxi o'zgargan dorilarga yorliq (o'z filiali).
  const nk = SERVER && fy('x_narx') ? narxXodimKarta(ctx, (id) => filialOf(id).nom || id, () => { if (tab === 'bosh') rerender(); }) : null;
  if (nk) m.append(nk);
  { const bk = SERVER && fy('x_bron') ? bronKarta(ctx, (id) => filialOf(id).nom || id, () => { if (tab === 'bosh') rerender(); }) : null; if (bk) m.append(bk); }   // 07.11 kech: mijoz bronlari (bron.mjs)
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
  else m.append(h('div', { class: 'msg warn' }, 'Qarz yozish direktor tomonidan o\'chirilgan.'));
  // 09.11: xodimdagi qarz pullari — «direktorga bering» va «✓ Direktor qabul qildi».
  const tk = topshirKarta({ amal, toast }, S, x);
  if (tk) m.append(tk);
  m.append(yordam('Mijoz to\'lasa — qarz ostidagi «💵 To\'lov kiritish» ni bosing. Pulni kassaga qo\'shmang — alohida saqlab direktorga bering, direktor qabul qiladi. Mijoz botga ulangan bo\'lsa — unga xabar boradi.', 'Mijoz pulni qaytarsa?'));
  const list = h('div', { class: 'card list' }, kartaSarlavha('Siz yozgan qarzlar'));
  if (!mine.length) list.append(h('div', { class: 'muted' }, 'Hali qarz yozmagansiz. Mijoz pulsiz dori olsa — "+ Qarz yozish" ni bosing.'));
  const ctx = qarzCtx(x);
  // Audit 09.11: hamma qarz (yopilganlari ham, umrbod) har chizishda chizilardi. Endi: ochiq va ruxsat kutayotganlar tepada,
  // oxirgi 30 kunda yopilganlar (to'langan, rad) ostida; undan eskilari — «Eski qarzlar» ichida, faqat ochilganda chiziladi.
  const faol = (q) => q.holat === 'ochiq' || q.holat === 'ruxsat';
  const yopVaqt = (q) => q.hal || (q.tolovlar || []).reduce((a, t) => Math.max(a, t.ts || 0), q.berildi || 0);
  const chegara = Date.now() - 30 * 864e5;
  const yopilgan = mine.filter((q) => !faol(q)).sort((a, b) => yopVaqt(b) - yopVaqt(a));
  const eskiQarz = yopilgan.filter((q) => yopVaqt(q) < chegara);
  [...mine.filter(faol).sort((a, b) => H.qarzQoldiq(b) - H.qarzQoldiq(a)), ...yopilgan.filter((q) => yopVaqt(q) >= chegara)]
    .forEach((q) => list.append(qarzQator(q, ctx)));
  if (eskiQarz.length) {
    list.append(ochiladi('Eski qarzlar', () => eskiQarz.map((q) => qarzQator(q, ctx)),
      { k: 'qarz-eski', izoh: eskiQarz.length + ' ta · 30 kundan oldin yopilgan' }));
  }
  m.append(list);
}
function qarzQator(q, ctx) {
  const qol = H.qarzQoldiq(q), otgan = q.holat === 'ochiq' && H.muddatiOtgan(q);
  const kun = Math.ceil((H.muddatKuni(q) - Date.now()) / 864e5);
  // Audit 09.11: o'tganiga 1 kundan kam bo'lsa «0 kun o'tdi» (Math.ceil −0,4 = −0) chiqardi — kamida 1 kun.
  const otdi = Math.max(1, Math.ceil((Date.now() - H.muddatKuni(q)) / 864e5));
  const xodimda = (q.pullar || []).filter((p) => p.holat === 'xodimda').reduce((a, p) => a + p.summa, 0);
  const th = tasdiqHolati(q);
  const tolandi = q.holat === 'ochiq' && qol <= 0;
  return h('div', { class: 'item qm-item' }, h('div', { class: 'line' }, h('b', { 'data-asl': '' }, q.ism), h('b', {}, q.holat === 'undirildi' || tolandi ? 'To\'landi ✓' : H.som(qol))),
      q.dorilar ? h('div', { class: 'muted qm-dori' }, '💊 ', h('span', { 'data-asl': '' }, q.dorilar)) : null,
      h('div', { class: 'muted', style: otgan || q.holat === 'ruxsat' ? 'color:var(--warn);font-weight:600' : '' },
        q.holat === 'ruxsat' ? 'Direktor ruxsatini kutmoqda — javob kelguncha dorini qarzga bermang'
          : q.holat === 'rad' ? (q.izoh === 'Direktor bekor qildi' ? 'Direktor bekor qildi' : 'Direktor rad etdi — qarz berilmasin')
            : q.holat === 'undirildi' ? 'Yopildi · ' + H.som(q.summa)
              : tolandi ? 'To\'liq to\'landi — pulni direktorga bering'
                : otgan ? 'Muddati ' + otdi + ' kun o\'tdi (' + sana(H.muddatKuni(q)) + ') — qo\'ng\'iroq qiling!' : 'Qaytarishga ' + Math.max(1, kun) + ' kun qoldi · ' + sana(H.muddatKuni(q))),
      xodimda > 0 ? h('div', { class: 'qm-xodimda' }, 'Sizda: ' + H.som(xodimda) + ' — direktorga bering') : null,
      th ? h('div', { class: 'qm-tasdiq ' + th.rang }, th.matn) : null,
      q.holat !== 'ochiq' ? null : h('div', { class: 'qm-tugmalar' },
        qol > 0 ? h('button', { type: 'button', class: 'p s', onclick: () => tolovOyna(ctx, q) }, '💵 To\'lov kiritish') : null,
        SERVER && qol > 0 && qrKerak(q) ? h('button', { type: 'button', class: 's', onclick: () => qrOyna(ctx, q) }, 'QR ko\'rsatish') : null,
        qol > 0 ? h('a', { class: 'btn', href: 'tel:' + q.tel, 'aria-label': 'Qo\'ng\'iroq qilish: ' + q.tel }, '📞 ' + q.tel) : null));
}

function qarzSheet(x) {
  sheet('Qarz yozish', (box, close) => {
    const forma = { muddatKun: 7 };
    const ism = input('Mijozning ism-sharifi', { inputmode: 'text', placeholder: 'Familiya Ism' }),
      tel = input('Telefon raqami', { inputmode: 'tel', placeholder: '90 123 45 67' }), summa = input('Summa, so\'m'),
      dor = input('Qaysi dorilar? (ixtiyoriy)', { inputmode: 'text', placeholder: 'Masalan: Анальгин, Цитрамон', maxlength: '300' });
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
      const f = { ism: ism.i.value, tel: tel.i.value, summa: summa.i.value, muddatKun: forma.muddatKun, dorilar: String(dor.i.value).trim() };
      amalX(xatoJoyla([[ism, /ism/i], [tel, /telefon/i], [summa, /summa/i], [muddatX, /muddat/i]]), 'qarzBer', f).then((r) => {
        if (!r) return;
        close();
        // Takrorda natija yo'q — xabar yangi holatdagi shu qarzdan (ruxsat kutayotgan bo'lsa ogohlantirish yo'qolmaydi).
        toast(...qarzXabari(r, S, x.id, f));
        yozilgandan(qarzCtx(x), r, f);   // 09.11: QR yoki «so'rov botga ketdi»
      });
    });
    box.append(ism.el, tel.el, dor.el, summa.el, h('b', {}, 'Qachon qaytaradi?'), muddat, muddatX.el, res, btn);
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
  else if (dv.xato) dc.append(h('div', { class: 'msg warn' }, jonliQoy('Davomat olinmadi — internetni tekshirib, qayta oching.')));
  else {
    dc.append(h('div', { class: 'grid2' }, h('div', { class: 'kp-tile kirim' }, h('span', {}, 'Keldingiz'), h('b', {}, dv.keldi + ' kun')),
      h('div', { class: 'kp-tile chiqim' }, h('span', {}, 'Kelmadingiz'), h('b', {}, dv.kelmadi + ' kun'))));
    if (dv.kelmaganKunlar.length) dc.append(h('div', { class: 'muted' }, 'Kelmagan kunlar: ' + dv.kelmaganKunlar.map((k) => k.slice(8, 10) + '.' + k.slice(5, 7)).join(', ')));
    dc.append(h('div', { class: 'muted' }, 'Davomatni direktor belgilaydi. Xato bo\'lsa — direktorga ayting.'));
  }
  m.append(dc);
}

// ---- Xodim — yangi ko'rinish (07.11, egasi «variant A» ni tanladi) ----
// Pastki menyu yo'q. 11.11 dan Bosh sodda (xBosh): katta tugmalar (Defekturaga yozish, Dori qidirish, Bugun nima keldi, 12.11 dan
// Shtrix-kodlar), «Tez» qatori (Kartaga o'tkazma, Retseptlar), amal kartalari faqat ishi bo'lsa, dori so'rash, «Boshqa bo'limlar» (qarz, inventar,
// Bilimdon, oylik, Men). Ichki sahifada — Telegram «orqaga» va ‹ (kelgan sahifaga; Bosh'ga qaytganda aylantirish joyi tiklanadi).
// Qarz yozish — 3 qadamli oyna (qarz-usta.mjs; amal va tekshiruv eski oynadagidek).
const XY_TAB = { bosh: 'Bosh sahifa', qarz: 'Qarzlarim', men: 'Men', oylik: 'Oyligim', dorilar: 'Dorilar', retsept: 'Retseptlar', oyin: 'Bilimdon', inventar: 'Inventar' };
let xYol = [];   // ichki sahifalar yo'li (orqaga — shu tartibda)
// 07.11 tun: sahifa almashishi — View Transition (qo'llamasa — oddiy). sinxron — chizishdan keyin darhol DOM'ga tegiladi
// (qidiruvga fokus, kamera tugmasi: iPhone klaviatura va kamerani faqat bosish ichida ochadi) — o'tishsiz.
let boshScroll = 0, boshFokus = null;   // 11.11: Bosh'dan ichkariga o'tishdagi aylantirish joyi va ochgan tugma (qaytganda tiklanadi)
function xOch(t, d, sinxron) { if (tab === 'bosh' && t !== 'bosh') { boshScroll = window.scrollY || 0; boshFokus = fokusEsla(); } if (tab !== t) xYol.push(tab); tab = t; if (d) dTab = d; if (sinxron) render(true); else sahifaOtish(() => render(true)); }
function xOrqaga() {
  if (tab === 'retsept' && retseptIchida()) { retseptBosh(); render(true); return; }
  if (tab === 'inventar' && inventarOrqaga()) { render(true); return; }
  tab = xYol.pop() || 'bosh';
  sahifaOtish(() => { render(true); if (tab === 'bosh') { if (boshScroll) window.scrollTo(0, boshScroll); fokusTikla(boshFokus); boshFokus = null; } });
}
// 09.11: mijoz qarzi — saqlangach QR (mijoz botda tasdiqlaydi) yoki «so'rov botga ketdi».
// xatoTuri() — oxirgi saqlanmagan amal sababi (audit 09.11; qarz-usta.mjs xabarni shunga qarab yozadi).
const qarzCtx = (x) => ({ S: () => S, x, amal, amalX, toast, tg, server: SERVER, yangila: () => (SERVER ? serverdanYukla().catch(() => {}) : null), keyin: (r, f) => yozilgandan(qarzCtx(x), r, f),
  xatoTuri: () => oxirgiXato });
const qarzYoz = (x) => (eskiKorinishmi() ? qarzSheet(x) : qarzUsta(qarzCtx(x)));

function renderXodimYangi(x) {
  if (!XY_TAB[tab]) tab = 'bosh';
  if (tab === 'bosh') xYol = [];
  korinishQolla(true);
  const ichki = tab !== 'bosh';
  if (!SERVER) root.append(h('div', { class: 'demo' }, 'Sinov rejimi · ', h('button', { class: 's', onclick: () => { kim = null; sessionStorage.removeItem('apteka-kim'); render(true); } }, 'boshqa xodim')));
  // Retsept punkti ichida o'zining «‹ Retseptlar» tugmasi bor — ikkita qaytish chiqmasin (audit 05.11).
  const orqa = ichki && !(tab === 'retsept' && retseptIchida()) ? orqagaTugma(xOrqaga) : null;
  const fNom = filialOf(x.filialId).nom;   // audit 10.11: nomlar data-asl (kirill rejimida o'girilmaydi)
  root.append(h('header', { class: 'top yh' }, orqa || h('span', { class: 'avatar', 'aria-hidden': 'true' }, x.ism[0]),
    h('div', { class: 't' }, h('h1', {}, ichki ? XY_TAB[tab] : h('span', { 'data-asl': '' }, x.ism)), h('span', {}, h('span', { 'data-asl': '' }, fNom), (x.daraja === 2 ? ' · 2-daraja' : '') + ' · ', ichki ? h('span', { 'data-asl': '' }, x.ism) : kunNomi())),
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
    if (dTab === 'keldi' && SERVER && fy('x_qidiruv')) m.append(keldiKarta(retseptCtx(x), () => { if (tab === 'dorilar') rerender(); }, { doim: true }));   // 11.11: Oson'ga bugun kelganlar
    if (dTab === 'narx' && SERVER && fy('x_qidiruv')) m.append(osonQidiruv(retseptCtx(x), (id) => ((S.filiallar || []).find((f) => f.id === id) || {}).nom || id));
    if (dTab === 'narx') m.append(praysQidiruv({ S, qidir }));
  }
  const ochiq = { retsept: 'x_retsept', oyin: 'x_oyin', inventar: 'x_inventar' }[tab];
  if (ochiq && !fy(ochiq)) m.append(h('div', { class: 'card muted' }, 'Bu bo\'lim direktor tomonidan o\'chirilgan.'));
  else {
    if (tab === 'retsept') retseptView(m, retseptCtx(x));
    if (tab === 'oyin') oyinView(m, retseptCtx(x));
    if (tab === 'inventar') inventarView(m, retseptCtx(x), (id) => filialOf(id).nom || id);
  }
  // O'yin ochilgan bo'lsa (xodim hali kirmagan) — sahifa tepasida xabar.
  if (tab !== 'oyin' && fy('x_oyin')) {   // faqat jonli o'yin bo'lsa — vaqtga bog'liq, eng tepada (Bosh'da ham)
    const ob = oyinBanner(retseptCtx(x), () => { oyinBosh(); xOch('oyin'); });
    if (ob) m.prepend(ob);
  }
  root.append(m);
  orqagaQoy(ichki ? xOrqaga : null);
  tanishuvAvto('xodim', { fy });   // 07.11 tun: birinchi ochilishda 3 ta qisqa ekran (shu Telegram akkaunti uchun bir marta)
}

// Qidiruv sahifasini ochadi (Dorilar → Narxlar) va maydonga fokus beradi; skan — o'sha yerdagi kamera tugmasi bosiladi.
// Bosish ichida (iOS klaviatura va kamerani faqat foydalanuvchi bosganda ochadi).
function qidiruvOch(skan) {
  xOch('dorilar', 'narx', true);
  if (skan) { const b = root.querySelector('main .skan-tugma'); if (b) { b.click(); return; } }
  qidiruvgaFokus();
}

// Bosh sahifa (yangi; 11.11 soddalashtirildi — egasi: "ko'p narsa bo'lsa ishlata olmaydi"; 14 kunlik foydalanish: Defektura 139,
// Bilimdon 82 (07.11 dan keyin 0), O'raldi 18, qolganlari 0; R9/R10 ko'rigi). Tartib:
//   (Bilimdon o'yini — faqat jonli bo'lsa, eng tepada; renderXodimYangi) → salom + davomat (ixcham)
//   → katta tugmalar: Defekturaga yozish (asosiy, yagona to'ldirilgan), Dori qidirish, Bugun nima keldi, Shtrix-kodlar (bo'lsa; 12.11)
//   → «Tez» qatori: Kartaga o'tkazma, Retseptlar (ruxsati borga)
//   → amal kartalari (faqat ishi bo'lsa: kelgan dorilarni sanash, o'tkazma javobi, bronlar, «Bugun» — kelgan defektura, ruxsat
//     kutayotgan qarz, qarz pullari; muddati o'tgan; narx yorlig'i) → dori so'rash (pastda, egasi 11.11) → «Boshqa bo'limlar» (yopiq).
// Joy sakramasin: kech keladigan kartalar (kirim, o'tkazma, bron) birinchi marta kelguncha (ko'pi bilan 3 s) pastki qism (dori so'rash
// va «Boshqa») o'rnida yengil «Yuklanmoqda…» — keyin hammasi birga chiqadi, tugmalar ostidan hech narsa pastga surilmaydi.
// Hammasi Funksiyalar (fy) bo'yicha; eski ko'rinish (renderXodim/boshView) o'zgarmagan.
let boshBirinchi = 0;   // birinchi Bosh chizilgan payt (kartalar kutish chegarasi)
let kutishTaymer = 0;   // pastki qism kutishi — bitta taymer (har chizishda yangisi qo'yilmaydi)
// Sinov uchun: Bosh kutish holatini tiklash (birinchi chizilish va taymer).
export function boshUnut() { boshBirinchi = 0; clearTimeout(kutishTaymer); kutishTaymer = 0; }
function xBosh(m, x) {
  const ctx = retseptCtx(x);
  const qayta = () => { if (tab === 'bosh') rerender(); };
  const dv = menDavomat(ctx);
  const [dMatn, dRang] = !dv ? ['Davomat yuklanmoqda…', 'kul'] : dv.xato ? ['Davomat olinmadi', 'sariq'] : dv.bugun === true ? ['Bugun keldingiz', 'yashil']
    : dv.bugun === false ? ['Bugun «kelmadi» belgilangan', 'qizil'] : ['Davomat hali belgilanmagan', 'kul'];
  const soat = Number(new Date().toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: 'Asia/Tashkent' })) % 24;
  const salom = soat < 11 ? 'Xayrli tong' : soat < 18 ? 'Xayrli kun' : 'Xayrli kech';
  m.append(h('div', { class: 'yx-salom' }, h('b', {}, salom + '!'),
    h('span', { class: 'yx-pill ' + dRang }, dRang === 'yashil' ? ikon('check') : null, jonliQoy(dMatn))));

  // 3 ta katta tugma (ikonka, nom, bir qatorli izoh — balandligi o'zgarmaydi).
  const katta = (ik, nom, izoh, onclick, cls = '') => h('button', { type: 'button', class: 'yx-katta' + (cls ? ' ' + cls : ''), onclick },
    h('span', { class: 'yx-katta-i', 'aria-hidden': 'true' }, ikon(ik)),
    h('span', { class: 'yx-katta-m' }, h('b', {}, nom), h('span', { class: 'yx-katta-iz' }, izoh)),
    h('span', { class: 'yx-katta-o', 'aria-hidden': 'true' }, ikon('oldinga')));
  const defSoni = H.defekturaGuruh((S.defektura || []).filter((d) => d.filialId === x.filialId)).filter((d) => d.holat === 'yangi').length;
  const kh = SERVER && fy('x_qidiruv') ? keldiHolat(ctx, qayta) : null;
  m.append(h('nav', { class: 'yx-asosiy', 'aria-label': 'Asosiy amallar' },
    fy('x_defektura') ? katta('dori', 'Defekturaga yozish', defSoni ? defSoni + ' ta yozilgan' : 'Kam qolgan dorini yozing', () => xOch('dorilar', 'kam'), 'asosiy') : null,
    fy('x_qidiruv') ? katta('qidir', 'Dori qidirish', 'Narxi, qaysi filialda', () => qidiruvOch(false)) : null,
    kh ? katta('keldi', 'Bugun nima keldi', kh.izoh, () => keldiOch(ctx, qayta), kh.eski ? 'eski' : '') : null,
    // 12.11 (egasi: "shtrix-kod bo'limi asosiy ekranda ko'rinadigan joyda tursin, bosganda ichiga kirsin"): «Tez» qatoridan katta
    // tugmaga ko'tarildi — izohda guruhlar (Ампула · Катетер · Шприц); bosilsa guruhlar oynasi.
    shtrixBormi(S) ? katta('shtrix', 'Shtrix-kodlar', shtrixIzoh(S), () => shtrixRoyxatOyna(S), 'shtrix') : null));

  // «Tez» qatori: kichik tugmalar (bir qatorda, 320 px da o'raladi).
  const tez = (ik, nom, onclick, cls) => h('button', { type: 'button', class: 'yx-tez-t ' + cls, onclick }, h('span', { 'aria-hidden': 'true' }, ikon(ik)), h('span', {}, nom));
  const tezlar = [
    SERVER ? tez('kassa', 'Kartaga o\'tkazma', () => otkazmaSorashOch(ctx, qayta), 'otkazma') : null,
    retseptRuxsat(S, x) && fy('x_retsept') ? tez('retsept', 'Retseptlar', () => { retseptBosh(); xOch('retsept'); }, 'retsept') : null].filter(Boolean);
  if (tezlar.length) m.append(h('nav', { class: 'yx-tez', 'aria-label': 'Tez tugmalar' }, ...tezlar));

  // Amal kartalari — faqat ishi bo'lsa.
  const fil = (id) => filialOf(id).nom || id;
  // Yashirin belgilar (hidden, joy olmaydi) ham qo'yiladi — kartalarning 30–60 s kuzatuvi shu belgidan Bosh ochiqligini biladi.
  if (SERVER) { const kk = kirimKarta(ctx, qayta); if (kk) m.append(kk); }   // Oson'da filialga ko'chirilgan dorilar — sanash
  // O'tkazma: bugungi so'rov bo'lsa yoki ro'yxat olinmagan bo'lsa (xato) — karta; aks holda faqat «Tez»dagi tugma.
  if (SERVER) {
    const ok = otkazmaKarta(ctx, qayta);
    if (ok && !ok.hidden && (ok.querySelector('.otk-q') || /olinmadi/.test(ok.textContent))) m.append(ok);
    else if (ok) m.append(h('div', { 'data-otkazma-karta': '', hidden: true }));
  }
  if (SERVER && fy('x_bron')) { const bk = bronKarta(ctx, fil, qayta); if (bk) m.append(bk); }
  // «Bugun»: kam dori ro'yxatidagi dori keldi, direktor ruxsatini kutayotgan qarz, mijoz qaytargan qarz puli — faqat bo'lsa.
  const bugun = H.kunKey(Date.now());
  const keldi = kelganlarim(x);
  const ruxsat = S.qarzlar.filter((q) => q.xodimId === x.id && q.holat === 'ruxsat').length;   // R12: bugungisi emas — hammasi
  const qp = H.xodimdagiPullar(S.qarzlar, x.id);
  if (keldi.length || ruxsat || qp.length) {
    const c = h('section', { class: 'card list x-bugun yx-bugun' }, kartaSarlavha('Bugun'));
    if (ruxsat) c.append(ishQator({ icon: 'xato', rang: 'warn', sarlavha: ruxsat + ' ta qarz direktor ruxsatini kutmoqda', izoh: 'Javob kelguncha dorini bermang', onclick: () => xOch('qarz') }));
    keldi.forEach((nom) => c.append(ishQator({ icon: 'defektura', rang: 'kirim', sarlavha: [h('span', { 'data-asl': '' }, nom), ' keldi'], izoh: 'Kam dori ro\'yxatidagi dori · so\'ragan mijozga ayting', onclick: () => xOch('dorilar', 'keldi') })));
    if (qp.length) c.append(ishQator({ icon: 'kirim', rang: 'warn', sarlavha: 'Qarz pullari — direktorga bering',
      izoh: H.som(qp.reduce((a, z) => a + z.pul.summa, 0)) + ' · ' + qp.length + ' ta to\'lov · kassaga qo\'shmang', onclick: () => xOch('qarz') }));
    m.append(c);
  }
  // Muddati o'tgan: faqat ro'yxati bor bo'lsa (bo'sh «✓ … yo'q» kartasi Bosh'da ko'rsatilmaydi).
  const mo = muddatiOtganKarta(ctx, fil, qayta);
  if (mo && (mo.tagName === 'SECTION' || mo.querySelector('.javon-q'))) m.append(mo);   // R11: bo'sh karta — eski bo'lsa ham yo'q
  const nk = SERVER && fy('x_narx') ? narxXodimKarta(ctx, fil, qayta) : null;
  if (nk) m.append(nk);

  // Joy sakramasin: kech kartalar birinchi marta kelguncha (≤ 3 s) — pastki qism o'rnida yengil belgi.
  if (!boshBirinchi) boshBirinchi = Date.now();
  const kutish = SERVER && Date.now() - boshBirinchi < 3000 && !(kirimYuklanganmi() && otkazmaYuklanganmi() && (!fy('x_bron') || bronYuklanganmi()));
  if (kutish) {
    if (!kutishTaymer) kutishTaymer = setTimeout(() => { kutishTaymer = 0; qayta(); }, 3000 - (Date.now() - boshBirinchi) + 20);
    m.append(h('div', { class: 'yx-kutish muted' }, 'Yuklanmoqda…'));   // ovozli e'lonsiz (har chizishda qayta o'qilmasin)
    return;
  }

  // Dori so'rash (filiallararo) — pastda, «Boshqa» ustida (egasi 11.11).
  if (SERVER) m.append(sorovKarta(ctx, qayta));

  // «Boshqa bo'limlar» — yopiq; ichida qolgan hamma narsa (Funksiyalar bo'yicha).
  const mine = S.qarzlar.filter((q) => q.xodimId === x.id && (q.holat === 'ochiq' || q.holat === 'ruxsat'));
  const otgan = mine.filter((q) => q.holat === 'ochiq' && H.muddatiOtgan(q)).length;
  const kutRuxsat = mine.filter((q) => q.holat === 'ruxsat').length;
  const bugungi = S.qarzlar.filter((q) => q.xodimId === x.id && H.kunKey(q.berildi) === bugun && q.holat !== 'rad').length;
  const inventar = SERVER && fy('x_inventar'), oyin = fy('x_oyin'), qarz = fy('x_qarz');
  const ochiqN = mine.filter((q) => q.holat === 'ochiq').length;   // ruxsat kutayotgani alohida — ikki marta sanalmaydi
  const qarzIzoh = [ochiqN + ' ta ochiq', otgan ? otgan + ' tasi muddati o\'tgan' : null, kutRuxsat ? kutRuxsat + ' tasi ruxsatda' : null,
    bugungi ? 'bugun +' + bugungi : null].filter(Boolean).join(' · ');
  const qatorlar = [
    qarz ? { ikon: 'qarzYoz', rang: 'sariq', l: 'Qarz yozish', izoh: 'Mijoz pulsiz oldi', onclick: () => qarzYoz(x) } : null,
    { ikon: 'qarz', rang: 'sariq', l: 'Qarzlarim', izoh: qarzIzoh, diqqat: otgan > 0 || kutRuxsat > 0, qiymat: H.som(H.xodimOchiq(mine, x.id)), onclick: () => xOch('qarz') },
    inventar ? { ikon: 'inventar', rang: 'binafsha', l: 'Inventar', izoh: 'Telefon bilan sanash', onclick: () => xOch('inventar') } : null,
    oyin ? { ikon: 'oyin', rang: 'binafsha', l: 'Bilimdon', izoh: 'O\'yin va mashqlar', onclick: () => { oyinBosh(); xOch('oyin'); } } : null,
    { ikon: 'oylik', rang: 'yashil', l: 'Oyligim', izoh: 'Oylik, avanslar, davomat', onclick: () => xOch('oylik') },
    { ikon: 'men', rang: 'kul', l: 'Men va sozlamalar', izoh: 'Ko\'rinish, harf o\'lchami, yo\'riqnoma', onclick: () => xOch('men'), cls: 'yx-men' }].filter(Boolean);
  // Izoh qatori — ichidagi narsalardan (o'chirilgani yo'q).
  const tavsif = ['qarz', inventar ? 'inventar' : null, oyin ? 'Bilimdon' : null, 'oylik', 'sozlamalar'].filter(Boolean).join(', ');
  const d = ochiladi([h('span', { class: 'yx-boshqa-i', 'aria-hidden': 'true' }, ikon('daftar')), h('b', {}, 'Boshqa bo\'limlar')], [
    h('div', { class: 'card yb-r yx-boshqa-r' }, ...qatorlar.map((q) => { const b = qobiqQator(q); if (q.cls) b.classList.add(q.cls); return b; })),
    yordam(['Smena ochish-yopish yo\'q: kunlik savdoni direktor kiritadi. Kassadan pul chiqsa (suv, paket…) — direktorga ayting.',
      'Kelganingizni direktor belgilaydi.',
      fy('x_qidiruv') ? 'Mijoz dori so\'rasa — «Dori qidirish»: narxi va qaysi filialda borligi.' : null,
      fy('x_defektura') ? 'Dori kam qolsa — «Defekturaga yozish».' : null].filter(Boolean).join(' '), 'Har kuni nima qilaman?')], { k: 'x-boshqa', cls: 'yx-boshqa', izoh: tavsif });
  d.querySelector('summary').setAttribute('aria-label', 'Boshqa bo\'limlar: ' + tavsif);
  m.append(d);
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
      { ikon: 'xabar', rang: 'yashil', l: 'Qanday ishlatiladi?', izoh: '3 ta qisqa ekran — asosiy joylar', onclick: () => tanishuvOch('xodim', { fy }) }] }]));
}

// Prays-listdan qidirish (faqat o'qish — holat yangilanmaydi). Audit 09.11: xato endi yutilmaydi (avval [] — ekranda «Topilmadi»,
// xodim mijozga «yo'q» derdi): server band (503) — o'zi qayta; boshqa xato — chaqiruvchiga (bolimlar.mjs «Qidirib bo'lmadi»).
async function qidir(soz) {
  if (!SERVER) return A.praysQidir(soz);
  try { return (await bandBolsaQayta(() => serverga('prays_qidir', [soz], tg.initData))).natija || []; } catch (e) { eskirdiTekshir(e); throw e; }
}
const chiqish = () => { kim = null; sessionStorage.removeItem('apteka-kim'); render(true); };
// Faqat o'qiydigan so'rov (holat o'zgarmaydi): retseptlar ro'yxati.
async function oqi(nom, ...args) {
  if (!SERVER) return sinovdaBajar(nom, S, (S.xodimlar || []).find((z) => z.id === kim) || { id: kim }, args);
  const [api, a] = serverSorovi(nom, args);
  try { return (await bandBolsaQayta(() => serverga(api, a, tg.initData))).natija; } catch (e) { eskirdiTekshir(e); throw e; }   // server band (503) — o'zi qayta
}
const rasmniOl = (id) => (SERVER ? rasmOl(id, tg.initData) : Promise.resolve(null));
// yuklashManzil (07.11 tun) — telefonga yuklash havolasi (store.mjs; sinov rejimida yo'q).
// rerender — aqlli: foydalanuvchi bosishi ichida darhol, fondan (javob keldi, taymer) — jamlab, bosish/yozish tugagach (pastda).
const retseptCtx = (x) => ({ S, x, amal, amalX, amalFon, oqi, toast, rasmOl: rasmniOl, rerender, server: SERVER, tg,
  yuklashManzil: SERVER ? yuklashManzil : null });
// Firma prayslari (30.10): faylni olish va saqlash — server band (503) bo'lsa o'zi qayta.
// 08.11: surat — filial surati (filial-mijoz.mjs).
const firmaCtx = SERVER ? { fayl: (id) => bandBolsaQayta(() => faylOl(id, tg.initData)), yukla: (b) => bandBolsaQayta(() => firmaPraysYukla(b, tg.initData)),
  surat: (b) => bandBolsaQayta(() => filialSuratYukla(b, tg.initData)) } : null;

// Ekranni chizish. tepaga (true yoki { tepaga }) — boshqa bo'limga o'tildi: sahifa boshidan.
// Aks holda (yangi holat keldi, amaldan keyin) — aylantirish joyi, sahifadagi maydonlarga yozilgan qiymatlar va fokus saqlanadi.
// { unut: 'prefiks' } — muvaffaqiyatli yuborilgan formaning qiymatlari unutiladi.
// 11.11 (R9): fondagi qayta chizishda fokus yo'qolmasin — fokusdagi tugma/summary imzosi (teg, yozuv, tartib raqami) eslanadi.
const fokusImzo = (el) => (el.dataset && el.dataset.k ? 'k:' + el.dataset.k : el.id ? 'id:' + el.id : (el.getAttribute('aria-label') || '') + '|' + el.textContent.trim().slice(0, 80));
function fokusEsla() {
  const a = document.activeElement;
  if (!a || a === document.body || !root.contains(a) || !/^(BUTTON|A|SUMMARY)$/.test(a.tagName)) return null;
  const k = fokusImzo(a), mos = [...root.querySelectorAll(a.tagName)].filter((e) => fokusImzo(e) === k);
  return { tag: a.tagName, k, n: Math.max(0, mos.indexOf(a)), soni: mos.length };
}
// Oyna ochiq bo'lsa (fokus oynada) yoki imzo bo'yicha mos kelganlar soni o'zgargan bo'lsa (boshqa tugmaga tushib qolmasin) — tiklanmaydi.
function fokusTikla(f) {
  if (!f || (document.activeElement && document.activeElement !== document.body && root.contains(document.activeElement))) return;
  if (document.querySelector('.sheet-bg:not(.yopilmoqda)')) return;
  const mos = [...root.querySelectorAll(f.tag)].filter((e) => fokusImzo(e) === f.k);
  if (mos.length !== f.soni) return;
  const el = mos[f.n];
  if (el) { try { el.focus({ preventScroll: true }); } catch (e) { /* eski brauzer */ } }
}
function render(o) {
  fonKerak = false;   // kutilayotgan fon chizishi shu chizishga kiradi
  const tepaga = o === true || !!(o && o.tepaga);
  const fokus = tepaga ? null : fokusEsla();
  holatniEsla(root);
  if (o && o.unut) unut(o.unut);
  const y = window.scrollY;
  root.textContent = '';
  // Audit 09.11: Telegram tugmalari (orqaga, Sozlamalar) chizish davomida faqat eslanadi — oxirida bir marta qo'llanadi.
  tgKechiktir(true);
  // 28.10 (audit): chizishda xato bo'lsa (masalan serverdan kutilmagan ma'lumot) — oq ekran emas, tushunarli karta.
  try { chiz(); } catch (e) {
    console.error('chizish', e);
    root.textContent = '';
    root.append(h('div', { class: 'card warn', role: 'alert', style: 'margin:16px' }, kartaSarlavha('Ekran ochilmadi'),
      h('div', {}, 'Ilovada xatolik bo\'ldi. «Qayta urinish»ni bosing; takrorlansa — ilovani yopib qayta oching va direktorga ayting.'),
      h('button', { class: 'p', onclick: () => { render(true); if (SERVER && tg) serverdanYukla(); } }, 'Qayta urinish')));
    return;
  } finally { tgKechiktir(false); }
  try { eskirganBelgi(); } catch (e) { /* belgisiz */ }
  try { navbatBelgi(); } catch (e) { /* belgisiz */ }
  holatniTikla(root);
  fokusTikla(fokus);
  // Harakat (29.10): yangi bo'lim/sahifa ochilganda — bloklar ketma-ket chiqadi; holat yangilanganda harakat yo'q.
  // 07.11 tun: View Transition ketayotgan bo'lsa — ekranni brauzer almashtiradi, bloklar alohida chiqmaydi (ikki harakat bo'lmasin).
  if (tepaga && !otishdami()) { const mm = root.querySelector('main, .o-main'); if (mm) mm.classList.add('kirish'); }
  window.scrollTo(0, tepaga ? 0 : y);
}

// ---- Fon chizishi (audit 09.11) ----
// Bosh sahifadagi kartalar (davomat, narx, so'rovlar, bronlar, Oson) javobi kelganda va har daqiqada ekranni butunlay qayta
// chizardi: ochilishda 5–6 marta. Barmoq tugmani bosib turganda element almashsa — bosish yo'qolardi; yozayotgan maydon
// almashardi; ochiq bo'limlar yopilardi. Endi:
//  - foydalanuvchi bosishi (click, input, change, klaviatura) ichidagi chizish — darhol (oldingidek);
//  - fondan kelgan (javob, taymer, ilovaga qaytish) — bir kadrda bittaga jamlanadi (requestAnimationFrame) va barmoq bosib
//    turgan (pointerdown…click) yoki ekrandagi maydonga yozilayotgan bo'lsa — pointerup/click yoki focusout'gacha kutadi
//    (oson-qoldiq.mjs yozyapti + keyinChiz g'oyasi, markazda).
// Modullarga beriladigan ctx.rerender — shu rerender: rerender(true) va bosish ichida — darhol; rerender({ fon: true }) — doim fonda.
let fonKerak = false, fonKadr = 0, barmoq = 0, qoydi = 0;
const FOYDALANUVCHI = new Set(['click', 'input', 'change', 'keydown', 'keyup', 'submit', 'pointerup', 'mouseup', 'touchend']);
function hodisaIchida() {
  try { const ev = window.event; return !!(ev && FOYDALANUVCHI.has(ev.type)); } catch (e) { return false; }
}
const YOZISH_MAYDON = 'input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]):not([type=file]), textarea, select';
const yozyapti = () => { const a = document.activeElement; return !!(a && a !== document.body && root.contains(a) && a.matches && a.matches(YOZISH_MAYDON)); };
// Barmoq bosib turibdi (yoki qo'ydi, lekin click hali kelmadi). Uzoq bosish (5 s+) — kutilmaydi.
const bosibTuribdi = () => { const n = Date.now(); return (barmoq && n - barmoq < 5000) || (qoydi && n - qoydi < 400); };
function fonTekshir() {
  fonKadr = 0;
  if (!fonKerak) return;
  if (bosibTuribdi() || yozyapti()) return;   // pointerup/click yoki focusout — o'zi qayta tekshiradi
  render();
}
function fonRender() {
  fonKerak = true;
  if (fonKadr) return;
  try { fonKadr = window.requestAnimationFrame ? window.requestAnimationFrame(fonTekshir) : setTimeout(fonTekshir, 16); } catch (e) { fonKadr = setTimeout(fonTekshir, 16); }
}
const fonQayta = (ms = 0) => setTimeout(() => { if (fonKerak) fonRender(); }, ms);
function rerender(o) {
  if (o && o.fon) { fonRender(); return; }
  if (o === true || (o && (o.tepaga || o.unut)) || hodisaIchida()) { render(o); return; }
  fonRender();
}
if (typeof document !== 'undefined') {
  document.addEventListener('pointerdown', () => { barmoq = Date.now(); qoydi = 0; }, true);
  document.addEventListener('pointerup', () => { barmoq = 0; qoydi = Date.now(); fonQayta(420); }, true);
  document.addEventListener('pointercancel', () => { barmoq = 0; qoydi = 0; fonQayta(); }, true);
  document.addEventListener('click', () => { qoydi = 0; fonQayta(); }, true);   // click o'z ishini qilgach (setTimeout)
  document.addEventListener('focusout', () => { fonQayta(); }, true);           // boshqa maydonga o'tsa — yana kutadi
}

// ---- Doimiy xabar joylari (audit 09.11) ----
// Har chizishda yangi role=alert/status element yaratilardi — ekran o'quvchi bir xil matnni qayta-qayta o'qirdi. Endi #app dan
// tashqarida doimiy joy: matn faqat o'zgarganda yangilanadi (o'qiladi).
function jonli(matn, shoshilinch) {
  const id = shoshilinch ? 'jonli-alert' : 'jonli-status';
  let el = document.getElementById(id);
  if (!el) {
    el = h('div', { id, class: 'jonli', role: shoshilinch ? 'alert' : 'status', 'aria-live': shoshilinch ? 'assertive' : 'polite' });
    root.parentNode.insertBefore(el, root);
  }
  if (el.textContent !== (matn || '')) el.textContent = matn || '';
}
// Chizish ichida: holat matni ekranda (role'siz) va doimiy joyda (o'zgargandagina o'qiladi). Matnning o'zini qaytaradi.
const jonliQoy = (matn) => { try { jonli(matn, false); } catch (e) { /* joy yo'q — faqat ekranda */ } return matn; };
// «Ma'lumot yangilanmadi» / «Ilova eskirdi» — #app tepasida doimiy (navbatBelgi kabi): matn yoki tugma o'zgarsa yangilanadi.
let eskirganOxirgi = '';
// 10.11 (yangi kirish, Edge YANGI_KIRISH): server qaytaOch / «Xavfsizlik uchun ilovani yoping…» — kirish ma'lumoti eski; ilova
// yopilib ochilguncha shunday qoladi (yangi holat kelsa ham o'chmaydi — auth_date o'zgarmaydi). Tepada doimiy banner + ochiq oynada.
let qaytaOchKerak = false;
const QAYTA_OCH_BANNER = 'Xavfsizlik uchun ilovani to\'liq yoping va qayta oching (pastga surish yetmaydi), keyin yana bosing.';
function qaytaOchKorsat() {
  qaytaOchKerak = true;
  try { eskirganBelgi(); } catch (e) { /* #app hali yo'q */ }
  // Ochiq oyna bor — uning tepasida (yozilganlar joyida); oyna yo'q — xabar ham (banner sahifa tepasida).
  if (!qaytaOchOynaga(QAYTA_OCH_BANNER)) toast(QAYTA_OCH_BANNER, 'xato');
}
function eskirganBelgi() {
  let el = document.querySelector('.msg.eskirgan');
  const matn = qaytaOchKerak && S ? QAYTA_OCH_BANNER : eskirgan && S ? eskirgan : '';
  if (!matn) { if (el) el.remove(); eskirganOxirgi = ''; return; }
  const imzo = matn + '|' + eskirdi + '|' + qaytaOchKerak;
  if (el && imzo === eskirganOxirgi) return;
  eskirganOxirgi = imzo;
  if (!el) { el = h('div', { class: 'msg warn eskirgan' }); root.parentNode.insertBefore(el, root); }
  el.replaceChildren(h('span', {}, matn),
    eskirdi || qaytaOchKerak ? yopishTugma('sm') : h('button', { class: 'sm', onclick: () => serverdanYukla() }, 'Yangilash'));
  jonli(matn, true);
}

function chiz() {
  // Oddiy rejim belgisi (oddiy.mjs qo'yadi) — har chizishda olib tashlanadi, kerak bo'lsa qayta qo'yiladi.
  root.classList.remove('oddiy');
  document.documentElement.classList.remove('oddiy-rejim', 'oddiy-katta');
  panelChiz();
  // Yozuv (shu telefonda, hamma panel): kirill bo'lsa — chizilgan matn kirillga; oynalar va xabarlarni kuzatuvchi o'tkazadi.
  const kir = yozuvKirillmi(kim);
  document.documentElement.classList.toggle(KIRILL, kir);
  // Audit 09.11: kirillDom(root) dan keyin kuzatuvchi navbatidagi shu qo'shilishlar tashlanadi (ikki marta yurmasin).
  if (kir) { kirillKuzat(); kirillDom(root); kirillYut(root); }
}

function panelChiz() {
  orqagaQoy(null);   // har panel o'z «orqaga»sini qayta qo'yadi
  // 07.11: Telegram ⋮ → Sozlamalar va yangi ko'rinish belgisi — direktor va xodim paneli o'zi qo'yadi (punkt, ta'minotchi — yo'q).
  sozlamaTugmasi(null);
  korinishQolla(false);
  if (SERVER && !S) return renderServerKutish();
  // Punkt: o'z ro'yxatlari holati (faqat ko'rish).
  const pk = SERVER ? (S.men && S.men.rol === 'punkt' ? S.punkt : null) : kim && ((S.retsept || {}).punktlar || []).find((p) => p.id === kim);
  if (pk) return renderPunkt(root, { S, amal, amalX, toast, rerender, logout: SERVER ? null : chiqish }, SERVER ? pk : A.punktPanel(S, pk.id));
  // Ta'minotchi: serverda — o'z holati (S.taminotchi), sinovda — ro'yxatdan.
  const ta = SERVER ? (S.men && S.men.rol === 'taminotchi' ? S.taminotchi : null) : kim && (S.taminotchilar || []).find((t) => t.id === kim);
  if (ta) {
    if (!SERVER && !ta.uzildi) ta.ulangan = true;   // sinov: "havola bilan ulangan" deb hisoblaymiz (uzilgani — yo'q)
    return renderTaminotchi(root, { S, amal, amalX, toast, rerender, logout: SERVER ? null : chiqish }, ta);
  }
  const x = kim && H.ishdagi(S.xodimlar.find((z) => z.id === kim), S);   // vaqtincha boshqa filialda bo'lsa — o'sha filial
  if (!x) return renderKirish();
  if (x.rol === 'direktor') {
    return renderDirektor(root, { S, x, amal, amalX, toast, qidir, rerender, server: SERVER, logout: SERVER ? null : chiqish, retseptCtx: () => retseptCtx(x), firma: firmaCtx });
  }
  // 07.11: yangi ko'rinish standart; «Eski ko'rinish» (shu telefonda) — avvalgi panel o'zgarishsiz.
  sozlamaTugmasi(() => xKorinish());
  if (eskiKorinishmi()) renderXodim(x); else renderXodimYangi(x);
}
// Ko'rinish oynasi (Telegram ⋮ → Sozlamalar; ilovada — Men → «Ko'rinish»). Almashganda — Bosh sahifaga.
const xKorinish = () => korinishOyna({ rerender: render, almashdi: () => { tab = 'bosh'; xYol = []; }, tanishuv: () => tanishuvOch('xodim', { fy }) });

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
  // Ilovaga qaytganda — yangi holat (boshqa xodim smenani yopgan bo'lishi mumkin). Yozilgan qiymatlar saqlanadi; audit 09.11:
  // chizish fonda — maydonga yozilayotgan bo'lsa, yozib bo'lgach (focusout) chiziladi.
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && S && !band) serverdanYukla(); });
}
// Ochilish qorovuli (src/boshla.js): ilova ekranni chizdi — «Ilova yuklanmadi» kartasi endi kerak emas.
if (window.__ilova) window.__ilova.tayyor = true;
