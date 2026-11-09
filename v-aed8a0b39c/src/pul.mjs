// Pul nazorati va Aqlli buyurtma (06.11; foydalanuvchi: "tavsiyang — avval shu 4 tasini qilamiz", "aqlli buyurtmani ham qo'sh").
// Faqat direktor, faqat serverda; ma'lumot — Oson qoldig'i (kengaytma har 30 daqiqada yuboradi).
// Pul nazorati: muddati o'tgan / 3 oyda tugaydigan dorilar puli, sekin aylanayotgan pul (90+ kun yangi partiya kelmagan va
// 30 kun sotilmagan), kam foyda yoki zarar (oxirgi partiya sotuv narxi kirim narxidan 10% dan kam yuqori). Pul — tannarxda
// (Oson kirim narxi, kengaytma 0.9.13); kirim narxi bo'lmasa — sotuv narxida (belgilanadi).
// Aqlli buyurtma: kunlik sotuv (Oson qoldig'i kamayishi, 30 kun) → necha kunga yetadi, qancha quti kerak; eng arzon firma
// (firma prayslari, telefonda moslanadi) bo'yicha guruhlanadi — har firma ro'yxatini nusxalab agentga yuborasiz.
// 07.11 kech (20261107200000_ombor_aqlli): Aqlli buyurtma 2 — tugagan kunlar hisobga olinmaydi, defekturada kutayotganlar,
// uzuq-uzuq sotuv (Syntetos–Boylan, SBA), ABC zaxira kunlari, firma odatda necha kunda olib kelishi (belgilar va «Qanday
// hisoblanadi?»); Pul nazorati → Muddat xavfi: muddat siyosati (ogohlantirish / javondan olish kunlari) va «Javondan oling».
// Eski server javobi (yangi maydonlarsiz) — avvalgidek chiziladi.
import * as H from './hisob.mjs';
import { h, kartaSarlavha, nusxaOl, ochiladi, pills, sana, sheet, tasdiqlash, vaqt, yordam } from './ui.mjs';
import { ikon } from './ikon.mjs';
import { osonVaqtEl, qoldiqMatn } from './oson-qoldiq.mjs';
import { firmalarOl, narxlar } from './firma.mjs';
import { ozFilialmi, sorovHolati, sorovYuklanganmi, sorovYukla } from './filial-sorov.mjs';

const PB = () => ({ j: null, vaqt: 0, yuklanmoqda: null, xato: null, bolim: 'muddat', filial: '', ochiq: false });
// 10.11 kech: Aqlli buyurtma sozlamasi (zaxira, yetkazish) va savati — shu telefonda (localStorage; yopiq bo'lsa — shu ochilishda).
const SAVAT_K = 'apteka-buyurtma-savat', SOZ_K = 'apteka-buyurtma-soz';
const ZAXIRALAR = [3, 7, 14, 30], YETKAZISHLAR = [1, 2, 3];
function lsOl(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
function lsQoy(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* xotira yopiq — faqat shu ochilishda */ } }
function sozOl() {
  const s = lsOl(SOZ_K) || {};
  return { zaxira: ZAXIRALAR.includes(s.zaxira) ? s.zaxira : 7, yetkazish: YETKAZISHLAR.includes(s.yetkazish) ? s.yetkazish : 2 };
}
const BB = () => ({ j: null, kalit: '', vaqt: 0, yuklanmoqda: null, keyin: false, xato: null, xatoKalit: '', ...sozOl(), filial: '', tur: '', ochiq: {},
  firmaBor: false, firmaXato: 0, firmaSoni: 0, savat: null, berdimBand: false });
const P = PB(), B = BB();
// Sinov uchun (tests): modul holatini tozalash.
export function pulUnut() {
  try { localStorage.removeItem(SAVAT_K); localStorage.removeItem(SOZ_K); } catch (e) { /* jsdom'siz */ }
  Object.assign(P, PB()); Object.assign(B, BB());
}
const KORINADI = 40;

const asl = (t) => h('span', { 'data-asl': '' }, t);
const kunMatn = (d) => (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}/.test(d) ? d.slice(8, 10) + '.' + d.slice(5, 7) + '.' + d.slice(0, 4) : '');
const kunOldin = (d) => Math.max(0, Math.round((Date.now() - Date.parse(d + 'T00:00:00+05:00')) / 864e5));
// 1 840 000 → «1,8 mln», 640 000 → «640 ming».
export const qisqa = (n) => {
  const v = Math.round(Number(n) || 0);
  if (Math.abs(v) >= 1e6) return String(Math.round(v / 1e5) / 10).replace('.', ',') + ' mln';
  if (Math.abs(v) >= 1e3) return Math.round(v / 1e3) + ' ming';
  return String(v);
};
const filNom = (fil, x) => (x.f ? fil(x.f) : x.fn || '');
// Yangilash xato berdi, ekranda avvalgi ma'lumot (audit 10.11 kech).
const yangilanmadiEl = (xato, qayta) => h('div', { class: 'msg warn', role: 'status' }, 'Yangilanmadi: ' + xato + ' — ko\'rinib turgani avvalgi ma\'lumot. ',
  h('button', { type: 'button', class: 'link', onclick: qayta }, 'Qayta urinish'));
const izohEl = (qismlar, cls = 'muted') => {
  const el = h('div', { class: cls });
  qismlar.filter(Boolean).forEach((q, i) => { if (i) el.append(' · '); el.append(q); });
  return el;
};
// Filial tanlovi — ro'yxatdagi filiallardan (bitta bo'lsa — yo'q).
function filialPills(rows, fil, joriy, tanla) {
  const ids = [...new Set(rows.map((x) => x.f || x.fn).filter(Boolean))];
  if (ids.length < 2) return null;
  return pills([['', 'Hammasi'], ...ids.map((id) => [id, fil(id)])], joriy, tanla, 'Filial');
}

// Qoldiq sahifasi tepasida: ikki katta tugma.
export function pulKirish(och) {
  const t = (s, belgi, nom, izoh) => h('button', { type: 'button', class: 'pul-kirish-t', onclick: () => och(s) },
    h('span', { class: 'pul-kirish-b', 'aria-hidden': 'true' }, belgi), h('b', {}, nom), h('span', { class: 'muted' }, izoh));
  return h('div', { class: 'pul-kirish' },
    t('pul', '💰', 'Pul nazorati', 'Muddat, muzlagan pul, kam foyda'),
    t('buyurtma', '🛒', 'Aqlli buyurtma', 'Nima va qancha olish kerak'),
    // 07.11: filiallar orasida ko'chirish tavsiyasi va telefon bilan inventarizatsiya.
    t('kochirish', '🔁', 'Ko\'chirish', 'Filiallar orasida — muddat, ortiqcha'),
    t('inventar', '📋', 'Inventarizatsiya', 'Telefon bilan sanash, Oson bilan solishtirish'),
    // 07.11: filiallarda narx farqi va yorliqlar; kiritilgan savdo va Oson sotuvi.
    t('narx', '🏷', 'Narx farqi', 'Filiallarda har xil narx, yorliqlar'),
    t('kassa', '💵', 'Kassa ↔ Oson', 'Kiritilgan savdo va Oson sotuvi'),
    // 07.11 tun: hisobdan chiqarilgan va firmaga qaytarilgan dorilar (sabab bilan).
    t('chiqarish', '🗑', 'Hisobdan chiqarilganlar', 'Muddati o\'tgan, singan, qaytarilgan'));
}

// Audit 06.11: xatodan keyin ham 1 daqiqa kutiladi («Qayta urinish» — majbur); aks holda har chizishda yangi so'rov ketib,
// to'xtovsiz aylanardi (chizish → so'rov → xato → chizish).
function yukla(ctx, chiz, majbur = false) {
  if (P.yuklanmoqda) return;
  if (!majbur && (P.j || P.xato) && Date.now() - P.vaqt < 60000) return;
  P.yuklanmoqda = ctx.oqi('osonPul')
    .then((j) => { if (!j || !j.muddat) throw new Error('Server javobi tushunarsiz'); P.j = j; P.xato = null; })
      .catch((e) => { P.xato = (e && e.message) || 'Ma\'lumot olinmadi'; })
    .finally(() => { P.vaqt = Date.now(); P.yuklanmoqda = null; chiz(); });
}

export function pulView(m, ctx, fil) {
  const chiz = () => ctx.rerender();
  yukla(ctx, chiz);
  if (!P.j) {
    m.append(P.xato ? h('div', { class: 'card' }, h('div', { class: 'muted' }, P.xato), h('button', { class: 's', onclick: () => { P.xato = null; yukla(ctx, chiz, true); chiz(); } }, 'Qayta urinish'))
      : h('div', { class: 'card muted', role: 'status' }, 'Yuklanmoqda…'));
    return;
  }
  const j = P.j;
  // Audit 10.11 kech: Oson vaqti (eskirgan — sariq) va yangilash xatosi (avval eski ma'lumot jim qolardi).
  m.append(osonVaqtEl(j.vaqt == null ? null : j.vaqt));
  if (P.xato) m.append(yangilanmadiEl(P.xato, () => { P.xato = null; yukla(ctx, chiz, true); chiz(); }));
  if (!j.tannarxBor) {
    m.append(h('div', { class: 'msg warn' }, 'Oson kirim narxi hali kelmagan — pul sotuv narxida ko\'rsatilmoqda. Aptekadagi kompyuterga kengaytma 0.9.13 o\'rnatilgach tannarxda chiqadi; «Kam foyda» ham shundan keyin ishlaydi.'));
  }
  const tab = (k, cls, son, nom) => h('button', { type: 'button', class: 'oq-tab ' + cls, 'aria-pressed': String(P.bolim === k),
    onclick: () => { P.bolim = k; P.ochiq = false; chiz(); } }, h('b', {}, son), h('span', {}, nom));
  m.append(h('div', { class: 'oq-tablar pul-tablar', role: 'group', 'aria-label': 'Bo\'lim' },
    tab('muddat', 'qizil', qisqa(j.muddat.jami), 'Muddat xavfi'),
    tab('sekin', 'sariq', qisqa(j.sekin.jami), 'Muzlagan pul'),
    tab('foyda', 'kok', String(j.foyda.soni), 'Kam foyda')));
  const b = j[P.bolim];
  // Tanlangan filial bu bo'limda yo'q bo'lsa — «Hammasi» (aks holda ro'yxat bo'sh, tanlov esa ko'rinmay qolardi).
  if (P.filial && !b.qatorlar.some((x) => (x.f || x.fn) === P.filial)) P.filial = '';
  const fp = filialPills(b.qatorlar, fil, P.filial, (v) => { P.filial = v; chiz(); });
  if (fp) m.append(fp);
  const rows = b.qatorlar.filter((x) => !P.filial || (x.f || x.fn) === P.filial);
  const kor = P.ochiq ? rows : rows.slice(0, KORINADI);
  const list = h('div', { class: 'card list' });
  const jami = rows.reduce((s, x) => s + (Number(x.summa) || 0), 0);
  const tansiz = rows.some((x) => x.tan === false);
  // Muddat siyosati (07.11 kech): server kunlarni bersa — kunlar bilan va «Javondan oling».
  const mKun = P.bolim === 'muddat' && j.muddat.kun != null ? j.muddat.kun : null;
  if (mKun != null) m.append(muddatSiyosatEl(ctx, chiz, j.muddat, rows));
  const sarlavha = {
    muddat: 'Muddati o\'tgan yoki ' + (mKun != null ? mKun + ' kun ichida tugaydi' : j.muddat.oy + ' oyda tugaydi'),
    sekin: j.sekin.kun + '+ kun yangi partiya kelmagan, kuzatuvda sotilmagan',
    foyda: 'Foydasi ' + j.foyda.chegara + '% dan kam yoki zarar'
  }[P.bolim];
  list.append(h('div', { class: 'line', style: 'border:0;padding:0' }, kartaSarlavha(sarlavha),
    P.bolim === 'foyda' ? h('b', {}, rows.length + ' xil') : h('b', { class: 'pul-jami' }, H.som(Math.round(jami)))));
  if (P.bolim !== 'foyda' && rows.length) list.append(h('div', { class: 'muted' }, rows.length + ' xil dori' + (tansiz ? ' · ba\'zilari sotuv narxida (*)' : ' · tannarxda')
    + (b.soni > b.qatorlar.length ? ' · eng kattalari ' + b.qatorlar.length + ' tasi (jami ' + b.soni + ' xil)' : '')));
  if (!rows.length) list.append(h('div', { class: 'muted' }, {
    muddat: '✓ ' + (mKun != null ? mKun + ' kun' : j.muddat.oy + ' oy') + ' ichida muddati tugaydigan dori yo\'q',
    sekin: j.kuzatuv && Date.now() - j.kuzatuv < 7 * 864e5
      ? 'Sotuv ' + sana(j.kuzatuv) + ' dan kuzatilmoqda — muzlagan pul ' + sana(j.kuzatuv + 7 * 864e5) + ' dan ko\'rinadi (kamida 7 kun kuzatuv kerak).'
      : '✓ Muzlagan pul topilmadi',
    foyda: j.tannarxBor ? '✓ Hamma dorida foyda ' + j.foyda.chegara + '% dan yuqori' : 'Kirim narxi kelgach ko\'rinadi (kengaytma 0.9.13)'
  }[P.bolim]));
  kor.forEach((x) => list.append(qator(x, fil)));
  if (rows.length > KORINADI) list.append(h('button', { type: 'button', class: 'oq-yana', onclick: () => { P.ochiq = !P.ochiq; chiz(); } },
    P.ochiq ? 'Yig\'ish ▴' : 'Yana ' + (rows.length - kor.length) + ' ta ▾'));
  m.append(list);
  m.append(h('div', { class: 'muted' }, {
    muddat: 'Muddati yaqinlarini oldin soting, firmaga qaytaring yoki savdosi ko\'p filialga ko\'chiring.',
    sekin: 'Bu dorilarda pul muzlab yotibdi: boshqa filialga ko\'chiring, chegirma qiling yoki qayta buyurtma bermang. Sotuv '
      + (j.kuzatuv ? sana(j.kuzatuv) + ' dan' : 'endi') + ' beri kuzatilmoqda — kunlar o\'tgan sari ro\'yxat aniqlashadi.',
    foyda: 'Oxirgi kelgan partiya: kirim narxi → Oson\'dagi sotuv narxi. Firma narxni oshirgan bo\'lsa — Oson\'da sotuv narxini yangilang.'
      + (j.foyda.astatkasiz ? ' Boshlang\'ich qoldiq (astatka) partiyalari ko\'rsatilmaydi — ularning kirim narxi Oson\'ga taxminiy kiritilgan.' : '')
  }[P.bolim]));
}

function qator(x, fil) {
  const summa = (v, tan) => h('b', { class: 'pul-summa' }, H.som(Math.round(v || 0)) + (tan === false ? '*' : ''));
  if (P.bolim === 'muddat') {
    return h('div', { class: 'item' }, h('div', { class: 'line', style: 'border:0;padding:0' }, h('span', { 'data-asl': '' }, x.nom), summa(x.summa, x.tan)),
      izohEl([asl(filNom(fil, x)), (x.otgan ? 'muddati o\'tgan: ' : 'muddati: ') + kunMatn(x.muddat),
        x.msoni != null ? qoldiqMatn(x.msoni, x.dona) : null], x.otgan ? 'oson-otgan' : 'muted'),
      x.javon ? h('div', { class: 'belgilar' }, h('span', { class: 'belgi javon' }, 'Javondan oling')) : null);
  }
  if (P.bolim === 'sekin') {
    const sot = x.sotildi ? 'oxirgi sotuv ' + sana(x.sotildi) : 'kuzatuvda sotilmadi (' + sana(x.kuzatildi) + ' dan)';
    return h('div', { class: 'item' }, h('div', { class: 'line', style: 'border:0;padding:0' }, h('span', { 'data-asl': '' }, x.nom), summa(x.summa, x.tan)),
      izohEl([asl(filNom(fil, x)), qoldiqMatn(x.soni, x.dona), 'oxirgi partiya ' + kunMatn(x.keldi) + ' (' + kunOldin(x.keldi) + ' kun)', sot]));
  }
  const zarar = x.foiz < 0;
  return h('div', { class: 'item' }, h('div', { class: 'line', style: 'border:0;padding:0' }, h('span', { 'data-asl': '' }, x.nom),
    h('b', { class: zarar ? 'pul-zarar' : 'pul-kam' }, (x.foiz > 0 ? '+' : '') + String(x.foiz).replace('.', ',') + '%')),
    izohEl([asl(filNom(fil, x)), 'kirim ' + H.som(Math.round(x.kirim)) + ' → sotuv ' + H.som(Math.round(x.sotuv)), x.firma ? asl(x.firma) : null,
      zarar ? 'zarariga sotilyapti' : null], zarar ? 'oson-otgan' : 'muted'));
}

// ---------- Muddat siyosati (07.11 kech) ----------
// Direktor: «Ogohlantirish» — muddati shuncha kun ichida tugaydiganlar Muddat xavfida va ertalabki hisobotda; «Javondan olish» —
// shuncha kun qolganda dori sotilmaydi (javondan olinadi, firmaga qaytariladi yoki hisobdan chiqariladi).
const OGOH_KUN = [30, 60, 90, 120, 180], JAVON_KUN = [0, 7, 14, 30, 45, 60];
function muddatSiyosatEl(ctx, chiz, mud, rows) {
  const javon = rows.filter((x) => x.javon);
  const el = h('div', { class: 'card muddat-siyosat' },
    h('div', { class: 'line', style: 'border:0;padding:0' },
      h('span', {}, 'Ogohlantirish: ', h('b', {}, mud.ogoh + ' kun'), ' · javondan olish: ', h('b', {}, mud.javonKun + ' kun')),
      ctx.amal ? h('button', { type: 'button', class: 's', onclick: () => siyosatSheet(ctx, chiz, mud) }, 'O\'zgartirish') : null));
  if (javon.length) {
    const s = javon.reduce((a, x) => a + (Number(x.summa) || 0), 0);
    el.append(h('div', { class: 'msg warn', role: 'note' }, '⏳ Javondan oling: ' + javon.length + ' xil dori (' + qisqa(s) + ') — muddati '
      + (mud.javonKun > 0 ? mud.javonKun + ' kun ichida tugaydi yoki o\'tgan' : 'o\'tgan') + '. Sotmang: firmaga qaytaring yoki hisobdan chiqaring.'));
  }
  return el;
}
function siyosatSheet(ctx, chiz, mud) {
  const qiymat = (arr, v) => (arr.includes(v) ? arr : [...arr, v].sort((a, b) => a - b)).map((x) => [x, x + ' kun']);
  sheet('Muddat siyosati', (box, close) => {
    let ogoh = mud.ogoh, javon = mud.javonKun;
    const xato = h('div', { class: 'msg xato', role: 'alert', style: 'display:none' });
    const saqla = h('button', { class: 'p', onclick: () => {
      if (!(javon < ogoh)) { xato.textContent = 'Javondan olish kunlari ogohlantirishdan kam bo\'lsin'; xato.style.display = ''; return; }
      saqla.disabled = true;
      Promise.resolve(ctx.amal('muddatSiyosat', ogoh, javon)).then((r) => {
        if (r == null) return;   // saqlanmadi — sababi xabarda, oyna ochiq qoladi
        close();
        ctx.toast('Muddat siyosati saqlandi ✓');
        yukla(ctx, chiz, true);
      }, () => {}).finally(() => { saqla.disabled = false; });
    } }, 'Saqlash');
    box.append(
      h('div', { class: 'muted' }, 'Ogohlantirish — muddati shuncha kun ichida tugaydigan dorilar «Muddat xavfi»da va ertalabki hisobotda ko\'rinadi: oldin soting yoki savdosi ko\'p filialga ko\'chiring.'),
      h('b', {}, 'Ogohlantirish'), pills(qiymat(OGOH_KUN, ogoh), ogoh, (v) => { ogoh = v; xato.style.display = 'none'; }, 'Ogohlantirish kunlari'),
      h('div', { class: 'muted' }, 'Javondan olish — muddati tugashiga shuncha kun qolgan dori sotilmaydi: javondan olinadi, firmaga qaytariladi yoki hisobdan chiqariladi. Xodimlar Bosh sahifada «Javondan oling» ro\'yxatini ko\'radi.'),
      h('b', {}, 'Javondan olish'), pills(qiymat(JAVON_KUN, javon), javon, (v) => { javon = v; xato.style.display = 'none'; }, 'Javondan olish kunlari'),
      xato, saqla);
  }, { fokus: false });
}

// ---------- Aqlli buyurtma ----------
// 10.11 kech (egasi maketlarni ko'rib: "Ha qo'sh"; maketlar: claude.ai/artifact/4CwHG1syZ293fE6fuU9W9m). G'oyalar (kod
// ko'chirilmagan): Katana «Suggested order by», Prediko «Stockout / At risk» — ro'yxat eng shoshilinchidan (tugagan → 3 kunda
// tugaydi → keyinroq); Inventory Planner — bitta jumla «Bugun N quti buyurtma bering»; Odoo replenishment — ta'minotchi
// bo'yicha savat va «Snooze» (N kunga yashirish); McKesson / PioneerRx — zaxira va yetkazish kunlari sozlamada.
// Ekran: (1) ro'yxat — har qatorda belgi (savatga), nom, qayerda qancha qoldi, necha kunga yetishi chizig'i, necha quti olish;
// (2) qatorga bosilsa — tafsilot oynasi: kunlar chizig'i (firma kelguncha dori yo'q kunlar — qizil, boshqa filialdan so'rash),
// «Nega N quti?», firma tanlash, son, «7 kunga yashirish»; (3) «Buyurtma tayyorlash» — savat firma bo'yicha: nusxa / Telegram,
// so'ng «Buyurtma berdim» (server: defekturaga «buyurtma», soni va firmasi bilan — kelguncha qayta tavsiya qilinmaydi);
// (4) «Sozlash» oynasi — zaxira va yetkazish kunlari (shu telefonda eslab qolinadi), firmalar haqiqiy yetkazish vaqti.
// Savat (belgi, son, tanlangan firma, «yuborildi») — shu telefonda, shu kun uchun (localStorage).
function bYukla(ctx, chiz, majbur = false) {
  const kalit = B.zaxira + ':' + B.yetkazish;
  if (B.yuklanmoqda) { if (majbur) B.keyin = true; return; }
  if (!majbur && ((B.j && B.kalit === kalit) || (B.xato && B.xatoKalit === kalit)) && Date.now() - B.vaqt < 60000) return;
  B.yuklanmoqda = ctx.oqi('osonBuyurtma', B.zaxira, B.yetkazish)
    .then((j) => { if (!j || !Array.isArray(j.qatorlar)) throw new Error('Server javobi tushunarsiz'); if (kalit === B.zaxira + ':' + B.yetkazish) { B.j = j; B.kalit = kalit; B.xato = null; } })
      .catch((e) => { B.xato = (e && e.message) || 'Ma\'lumot olinmadi'; B.xatoKalit = kalit; })
    .finally(() => {
      B.vaqt = Date.now(); B.yuklanmoqda = null;
      // Yuklanayotganda majburiy yangilash so'ralgan bo'lsa (masalan «Buyurtma berdim» dan keyin) — yana bir marta.
      if (B.keyin) { B.keyin = false; bYukla(ctx, chiz, true); }
      chiz();
    });
}

// Har qatorga eng arzon firma (aniq moslik avval; firma prayslari yuklanmagan bo'lsa — null).
export function firmagaBol(rows, narxOl) {
  const g = new Map();
  for (const x of rows) {
    const r = narxOl ? narxOl(x.nom) : [];
    const e = r && r.length ? r[0] : null;
    const k = e ? e.firma : '';
    if (!g.has(k)) g.set(k, { firma: k, qatorlar: [], jami: 0 });
    const o = g.get(k);
    o.qatorlar.push({ ...x, eng: e });
    if (e && e.yuz) o.jami += e.yuz * x.kerak;
  }
  // Firmalar — ko'p dorilisidan; topilmaganlar oxirida.
  return [...g.values()].sort((a, b) => (!a.firma) - (!b.firma) || b.qatorlar.length - a.qatorlar.length);
}
export function buyurtmaMatn(firma, qatorlar, fil) {
  return (firma ? firma + ' — buyurtma' : 'Buyurtma') + '\n' + qatorlar.map((x, i) => (i + 1) + '. ' + (x.eng ? x.eng.nom : x.nom) + ' — ' + x.kerak + ' quti'
    + (x.f || x.fn ? ' (' + filNom(fil, x) + ')' : '')).join('\n');
}

// Savat va sozlama (shu telefonda).
function savat() {
  const bugun = H.kunKey(Date.now());
  if (!B.savat || B.savat.kun !== bugun) {
    const s = lsOl(SAVAT_K);
    const ob = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
    B.savat = s && s.kun === bugun ? { kun: bugun, q: ob(s.q), yub: ob(s.yub) } : { kun: bugun, q: {}, yub: {} };
  }
  return B.savat;
}
const savatSaqla = () => lsQoy(SAVAT_K, savat());
const qKey = (x) => x.b + '|' + x.p;
const qHol = (x) => savat().q[qKey(x)] || {};
function qQoy(x, o) {
  const s = savat(), k = qKey(x);
  const v = { ...(s.q[k] || {}), ...o };
  for (const z of Object.keys(v)) if (v[z] === undefined) delete v[z];
  if (Object.keys(v).length) s.q[k] = v; else delete s.q[k];
  savatSaqla();
}
export const tanlanganmi = (x) => !qHol(x).o;
export function qSoni(x) {
  const s = Number(qHol(x).s);
  return Number.isInteger(s) && s >= 1 && s <= 9999 ? s : Math.max(1, Math.min(9999, Math.round(Number(x.kerak) || 1)));
}
const astatkami = (f) => /astatka|остат/i.test(f || '');
// Firma: oynada tanlangani → firma prayslarida eng arzoni → Oson'da oxirgi kelgan firma. {firma, yuz (quti narxi), nom (praysdagi nom)}.
function qFirma(x, bor) {
  const r = bor ? narxlar(x.nom) : [];
  const fi = qHol(x).fi;
  if (fi) { const e = r.find((z) => z.firma === fi); return e ? { ...e } : { firma: fi, yuz: null }; }
  if (r.length) return { ...r[0] };
  return { firma: x.firma && !astatkami(x.firma) ? x.firma : '', yuz: null };
}
// Bir quti narxi: firma praysidan, bo'lmasa Oson'dagi oxirgi kirim narxi (taxminiy).
const qutiNarx = (x, f) => (f && Number(f.yuz) > 0 ? Number(f.yuz) : Number(x.kirim) > 0 ? Number(x.kirim) : null);
function pulJami(rows, bor) {
  let jami = 0, narxsiz = 0;
  for (const x of rows) { const n = qutiNarx(x, qFirma(x, bor)); if (n) jami += n * qSoni(x); else narxsiz++; }
  return { jami, narxsiz };
}
const firmaKalit = (s) => String(s || '').toUpperCase().replace(/[^A-ZА-ЯЁЎҚҒҲ0-9]/g, '');
const firmaTeng = (a, b) => { const x = firmaKalit(a), y = firmaKalit(b); return !!x && !!y && (x === y || x.includes(y) || y.includes(x)); };
const firmaBormi = () => B.firmaBor && B.firmaSoni > 0;

// Qachon tugaydi: tugagan | tez (3 kun ichida) | keyin.
export function buyTuri(x) {
  if (x.tugadi || !(Number(x.qoldiq) > 0)) return 'tugagan';
  return x.yetadi != null && Number(x.yetadi) <= 3 ? 'tez' : 'keyin';
}
const TUR_SAR = { tugagan: 'Tugagan — bugun buyurtma bering', tez: '3 kun ichida tugaydi', keyin: 'Keyinroq tugaydi' };
const TUR_TILE = { tugagan: 'Tugagan', tez: '3 kunda tugaydi', keyin: 'Keyinroq' };
const TURLAR = ['tugagan', 'tez', 'keyin'];
const yetkKun = (x) => (x.yetkazish != null && Number.isFinite(Number(x.yetkazish)) ? Number(x.yetkazish) : B.yetkazish);
const jamiKun = (x) => (Number(x.jamiKun) > 0 ? Number(x.jamiKun) : B.zaxira + yetkKun(x));
// Firma kelguncha javonda dori bo'lmaydigan kunlar (butun; 0 — yetadi). Sotuv ko'rinmagan dori — 0.
export function buyYoqKun(x) {
  if (!(Number(x.kunlik) > 0)) return 0;
  const v = yetkKun(x) - (buyTuri(x) === 'tugagan' ? 0 : Number(x.yetadi) || 0);
  // Yuqoriga (1,4 kun — «2 kun»): ehtiyot uchun; yarim kundan kami — yetadi deb olinadi.
  return v >= 0.5 ? Math.ceil(v - 0.05) : 0;
}

export function buyurtmaView(m, ctx, fil) {
  const chiz = () => ctx.rerender();
  bYukla(ctx, chiz);
  // Firma prayslari (eng arzon firma uchun) — fonda; yuklangach qayta chiziladi.
  // Xatodan keyin 1 daqiqa so'ralmaydi (har chizishda emas — audit 06.11).
  let firmaHolat = 'yuklanmoqda';
  if (B.firmaBor || !B.firmaXato || Date.now() - B.firmaXato > 60000) {
    firmalarOl(ctx).then((r) => { if (!B.firmaBor || B.firmaSoni !== r.length) { B.firmaBor = true; B.firmaXato = 0; B.firmaSoni = r.length; chiz(); } },
      () => { const bor = B.firmaXato; B.firmaXato = Date.now(); if (!bor) chiz(); });
  }
  if (B.firmaBor) firmaHolat = B.firmaSoni ? 'bor' : 'yoq';
  else if (B.firmaXato) firmaHolat = 'xato';
  const j = B.j && B.kalit === B.zaxira + ':' + B.yetkazish ? B.j : null;
  if (!j) {
    m.append(B.xato ? h('div', { class: 'card' }, h('div', { class: 'muted' }, B.xato), h('button', { class: 's', onclick: () => { B.xato = null; bYukla(ctx, chiz, true); chiz(); } }, 'Qayta urinish'))
      : h('div', { class: 'card muted', role: 'status' }, 'Hisoblanmoqda…'));
    return;
  }
  // Audit 10.11 kech: tavsiya qaysi Oson ro'yxatidan — eskirgan bo'lsa sariq; yangilash xatosi — jim emas.
  const kalit = B.zaxira + ':' + B.yetkazish;
  if (j.vaqt !== undefined) m.append(osonVaqtEl(j.vaqt, { izoh: 'tavsiya eski qoldiqdan — aptekadagi kompyuterda Oson admin\'ni oching' }));
  if (B.xato && B.xatoKalit === kalit) m.append(yangilanmadiEl(B.xato, () => { B.xato = null; B.xatoKalit = ''; bYukla(ctx, chiz, true); chiz(); }));
  const kuzKun = j.kuzatuv ? (Date.now() - j.kuzatuv) / 864e5 : 0;
  if (kuzKun < 14) {
    m.append(h('div', { class: kuzKun < 3 ? 'msg warn' : 'msg info' }, kuzKun < 3
      ? 'Sotuv tezligi hisoblanmoqda: Oson qoldig\'i ' + (j.kuzatuv ? sana(j.kuzatuv) : 'endi') + ' dan kuzatilmoqda. Tavsiyalar 3 kundan keyin chiqadi, aniqroq — 2 haftada.'
      : 'Sotuv ' + Math.floor(kuzKun) + ' kundan beri kuzatilmoqda — tavsiyalar taxminiy, 2 haftada aniqlashadi.'));
  }
  if (B.filial && !j.qatorlar.some((x) => (x.f || x.fn) === B.filial)) B.filial = '';
  const fm = firmaHolat === 'bor';
  const barchasi = j.qatorlar.filter((x) => !B.filial || (x.f || x.fn) === B.filial);
  const sonlar = { tugagan: 0, tez: 0, keyin: 0 };
  barchasi.forEach((x) => { sonlar[buyTuri(x)]++; });
  if (B.tur && !sonlar[B.tur]) B.tur = '';
  const jp = pulJami(barchasi, fm);
  // (1) Xulosa: nechta dori, taxminan qancha pul; tur kartochkalari (bosilsa — faqat o'sha); zaxira va yetkazish — «O'zgartirish».
  m.append(h('section', { class: 'card buy-xulosa', 'aria-label': 'Buyurtma xulosasi' },
    h('div', { class: 'buy-x-bosh' }, h('b', { class: 'buy-x-son' }, barchasi.length ? barchasi.length + ' ta dori olish kerak' : 'Buyurtma kerak emas'),
      jp.jami ? h('span', { class: 'muted' }, 'Taxminan ' + H.som(jp.jami) + (jp.narxsiz ? ' (' + jp.narxsiz + ' tasida narx yo\'q)' : '')) : null),
    barchasi.length ? h('div', { class: 'buy-tur', role: 'group', 'aria-label': 'Qachon tugaydi' }, ...TURLAR.map((t) => h('button', {
      type: 'button', class: 'buy-tur-t tur-' + t, 'aria-pressed': String(B.tur === t), disabled: sonlar[t] ? null : '',
      onclick: () => { B.tur = B.tur === t ? '' : t; chiz(); } }, h('b', {}, String(sonlar[t])), h('span', {}, TUR_TILE[t])))) : null,
    h('button', { type: 'button', class: 'buy-soz-q', onclick: () => sozlashOyna(j, chiz) },
      h('span', {}, h('b', {}, B.zaxira + ' kunlik zaxira'), h('span', { class: 'muted' }, ' · firma ' + B.yetkazish + ' kunda keladi')),
      h('span', { class: 'buy-soz-o' }, 'O\'zgartirish', ikon('oldinga')))));
  const fp = filialPills(j.qatorlar, fil, B.filial, (v) => { B.filial = v; B.ochiq = {}; chiz(); });
  if (fp) m.append(fp);
  if (!barchasi.length) {
    m.append(h('div', { class: 'card muted' }, kuzKun < 3 ? 'Hali yetarli sotuv ma\'lumoti yo\'q.' : '✓ Hozir buyurtma kerak dori yo\'q — hammasi ' + (B.yetkazish + B.zaxira) + ' kunga yetadi.'));
  } else {
    if (firmaHolat === 'yuklanmoqda') m.append(h('div', { class: 'muted', role: 'status' }, 'Firma narxlari yuklanmoqda…'));
    if (firmaHolat === 'yoq') m.append(h('div', { class: 'msg info' }, 'Firma prayslari yuklanmagan — eng arzon firma ko\'rsatilmaydi. Bo\'limlar → Firma prayslari.'));
    // (2) Bo'limlar: eng shoshilinchidan.
    for (const t of TURLAR) {
      if (B.tur && B.tur !== t) continue;
      const r = barchasi.filter((x) => buyTuri(x) === t);
      if (!r.length) continue;
      const kor = B.ochiq[t] ? r : r.slice(0, 30);
      const k = h('div', { class: 'card list buy-royxat' });
      kor.forEach((x) => k.append(bQator(ctx, x, fil, chiz, j, fm)));
      if (r.length > 30) {
        k.append(h('button', { type: 'button', class: 'oq-yana', onclick: () => { B.ochiq[t] = !B.ochiq[t]; chiz(); } },
          B.ochiq[t] ? 'Yig\'ish ▴' : 'Yana ' + (r.length - kor.length) + ' ta ▾'));
      }
      m.append(h('section', { class: 'buy-bolim', 'aria-label': TUR_SAR[t] }, h('h2', { class: 'buy-bolim-sar tur-' + t }, TUR_SAR[t]), k));
    }
  }
  if (Array.isArray(j.yashirilgan) && j.yashirilgan.length) {
    m.append(ochiladi('Yashirilganlar (' + j.yashirilgan.length + ')', () => j.yashirilgan.map((y) => h('div', { class: 'line buy-yashir' },
      h('span', {}, asl(y.nom), h('span', { class: 'muted' }, ' · ' + (y.f ? fil(y.f) + ', ' : '') + sana(y.gacha) + ' gacha')),
      ctx.amalFon ? h('button', { type: 'button', class: 's', onclick: async (e) => {
        const b = e.currentTarget; b.disabled = true;
        const r = await ctx.amalFon('buyurtmaYashir', y.b, y.p, 0);
        if (r != null) { ctx.toast('Ro\'yxatga qaytarildi ✓'); bYukla(ctx, chiz, true); } else b.disabled = false;
      } }, 'Qaytarish') : null)), { k: 'buy-yashir', izoh: 'vaqti tugaguncha ro\'yxatda chiqmaydi' }));
  }
  m.append(h('div', { class: 'muted' }, 'Qatorga bosing — nega shuncha quti ekanini ko\'rasiz. Chiziq — dori necha kunga yetishi (to\'la chiziq = zaxira + yetkazish kunlari). '
    + 'Sotuv — Oson qoldig\'i kamaygani; muddati yaqin va «Muzlagan pul»dagi dorilarni ko\'p olmang.'));
  // (3) Pastki panel: savatdagi dorilar (hamma filial) — «Buyurtma tayyorlash».
  const tan = j.qatorlar.filter(tanlanganmi);
  const tp = pulJami(tan, fm);
  m.append(h('div', { class: 'buy-bar' },
    h('div', { class: 'buy-bar-m' }, h('b', {}, tan.length + ' ta dori tanlandi' + (B.filial || B.tur ? ' (hamma bo\'limdan)' : '')), tp.jami ? h('span', { class: 'muted' }, H.som(tp.jami)) : null),
    h('button', { type: 'button', class: 'p', disabled: tan.length ? null : '', onclick: () => savatOyna(ctx, j, fil, chiz) }, 'Buyurtma tayyorlash')));
}

// Ro'yxat qatori: belgi (savatga) · nom, holat, chiziq, ogohlantirish, kunlik va firma · necha quti, summa.
function bQator(ctx, x, fil, chiz, j, fm) {
  const on = tanlanganmi(x), t = buyTuri(x), soni = qSoni(x), f = qFirma(x, fm), n = qutiNarx(x, f), yoq = t === 'tugagan' ? 0 : buyYoqKun(x);
  const chiziq = h('span', { class: 'buy-chiziq tur-' + t, 'aria-hidden': 'true' }, h('span', {}));
  // Kenglik — CSSOM orqali (style atributi CSP'da yopiq bo'lishi mumkin).
  chiziq.firstChild.style.width = (t === 'tugagan' ? 0 : Math.max(4, Math.min(100, (Number(x.yetadi) || 0) / jamiKun(x) * 100))) + '%';
  const meta = h('span', { class: 'buy-meta' }, Number(x.kunlik) > 0 ? 'Kuniga ' + kasr(x.kunlik) + ' quti' : 'Defekturada so\'ralgan');
  if (f.firma) meta.append(' · ', asl(f.firma));
  return h('div', { class: 'buy-qator' + (on ? '' : ' olinmaydi'), 'data-rk': qKey(x) },
    h('button', { type: 'button', class: 'buy-tick', 'aria-pressed': String(on), 'aria-label': 'Savatda: ' + x.nom,
      onclick: () => { qQoy(x, { o: on ? 1 : undefined }); chiz(); } }, on ? ikon('check') : null),
    h('button', { type: 'button', class: 'buy-q-asosiy', 'aria-label': x.nom + ' — tafsilot', onclick: () => doriOyna(ctx, x, fil, chiz) },
      h('span', { class: 'buy-nom', 'data-asl': '' }, x.nom),
      h('span', { class: 'buy-holat tur-' + t }, asl(filNom(fil, x)), ' · ' + buyHolat(x)),
      chiziq,
      yoq ? h('span', { class: 'buy-ogoh' }, yoq + ' kun dori bo\'lmaydi — firma ' + yetkKun(x) + ' kunda keladi') : null,
      meta),
    h('div', { class: 'buy-son' }, h('b', {}, String(soni)), h('span', {}, 'quti'), n ? h('span', { class: 'buy-summa' }, qisqa(n * soni)) : null));
}

// Tafsilot oynasi.
function doriOyna(ctx, x, fil, chiz) {
  sheet(x.nom, (box, close) => {
    const ich = h('div', { class: 'buy-oyna' });
    box.append(ich);
    const qayta = () => { ich.textContent = ''; qur(); };
    if (ctx.server && ctx.amalFon && x.f && (x.boshqa || []).some((z) => z.f)) sorovYukla(ctx, qayta);
    function qur() {
      const fm = firmaBormi();
      const t = buyTuri(x), yk = yetkKun(x), jk = jamiKun(x), kunlik = Number(x.kunlik) || 0;
      const soni = qSoni(x), on = tanlanganmi(x), f = qFirma(x, fm), n = qutiNarx(x, f);
      ich.append(h('div', { class: 'muted' }, asl(filNom(fil, x)), ' · ' + (t === 'tugagan' ? 'hozir tugagan' : 'hozir ' + qoldiqMatn(x.qoldiq, x.dona) + ' bor')));
      ich.append(h('div', { class: 'buy-javob' }, h('b', {}, 'Bugun ' + x.kerak + ' quti buyurtma bering'),
        h('span', {}, kunlik > 0 ? 'Firma ' + yk + ' kunda olib keladi, bu qutilar keyingi ' + Math.max(1, jk - yk) + ' kunga yetadi.'
          : 'Xodimlar defekturada so\'ragan — sotuv hali ko\'rinmadi.')));
      const ke = kunlarEl(ctx, x, fil, t, yk, jk, qayta);
      if (ke) ich.append(ke);
      const jadval = buyHisobQator(x);
      const nega = h('section', { class: 'card list buy-nega' }, h('h3', {}, 'Nega ' + x.kerak + ' quti?'));
      if (jadval) jadval.forEach(([a, b], i) => nega.append(h('div', { class: 'line' + (i === jadval.length - 1 ? ' jami' : '') }, h('span', {}, a), h('b', {}, b))));
      else nega.append(h('div', { class: 'muted' }, kunlik > 0 ? 'Kuniga ' + kasr(kunlik) + ' quti sotiladi — ' + jk + ' kunga hisoblandi.' : 'Defekturada so\'ralgan.'));
      const fakt = buyFaktlar(x);
      if (fakt.length) nega.append(h('div', { class: 'muted buy-fakt' }, fakt.join(' ')));
      ich.append(nega);
      ich.append(firmaTanlov(x, fm, f, () => { chiz(); qayta(); }));
      const yangiSon = (v) => { qQoy(x, { s: v === Math.round(Number(x.kerak)) ? undefined : v }); chiz(); qayta(); };
      ich.append(h('div', { class: 'buy-son-q' },
        h('div', { class: 'buy-stepper', role: 'group', 'aria-label': 'Necha quti' },
          h('button', { type: 'button', 'aria-label': 'Kamaytirish', disabled: soni <= 1 ? '' : null, onclick: () => yangiSon(soni - 1) }, '−'),
          h('span', { 'aria-live': 'polite' }, soni + ' quti'),
          h('button', { type: 'button', 'aria-label': 'Ko\'paytirish', disabled: soni >= 9999 ? '' : null, onclick: () => yangiSon(soni + 1) }, '+')),
        h('div', { class: 'buy-son-pul' }, n ? h('b', {}, H.som(n * soni)) : h('span', { class: 'muted' }, 'narx noma\'lum'),
          n ? h('span', { class: 'muted' }, soni + ' × ' + H.som(n)) : null)));
      const tug = h('div', { class: 'row buy-oyna-t' });
      if (ctx.server && ctx.amalFon) {
        const yb = h('button', { type: 'button', class: 's', onclick: async () => {
          yb.disabled = true;
          const r = await ctx.amalFon('buyurtmaYashir', x.b, x.p, 7);
          if (r != null) { ctx.toast('7 kunga yashirildi — pastdagi «Yashirilganlar»dan qaytarasiz'); close(); bYukla(ctx, chiz, true); } else yb.disabled = false;
        } }, '7 kunga yashirish');
        tug.append(yb);
      }
      tug.append(h('button', { type: 'button', class: 'p', onclick: () => { if (!on) { qQoy(x, { o: undefined }); chiz(); } close(); } }, on ? 'Saqlash' : 'Savatga qo\'shish'));
      ich.append(tug);
    }
    qur();
  }, { fokus: false });
}

// Kunlar chizig'i: javondagi qoldiq necha kunga yetadi → firma kelguncha dori yo'q kunlar → yangi qutilar.
function kunlarEl(ctx, x, fil, t, yk, jk, qayta) {
  const kunlik = Number(x.kunlik) || 0;
  const k = h('section', { class: 'card buy-kunlar' });
  const boshqa = (x.boshqa || []).filter((z) => Number(z.qoldiq) >= 1);
  const bNom = (z) => (z.f ? fil(z.f) : z.fn || 'Boshqa filial');
  if (kunlik > 0) {
    const bor = t === 'tugagan' ? 0 : Math.min(Number(x.yetadi) || 0, jk);
    const yoq = Math.max(0, Math.min(yk, jk) - bor);
    const yangi = Math.max(0, jk - Math.max(bor, yk));
    const qism = (v, cls) => { if (!(v > 0)) return null; const e = h('span', { class: 'buy-k-' + cls }); e.style.flexGrow = String(v); return e; };
    const tavsif = [bor > 0 ? 'javondagi qoldiq — ' + kasr(bor) + ' kun' : null, yoq > 0 ? 'dori yo\'q — ' + kasr(yoq) + ' kun' : null,
      yangi > 0 ? 'yangi qutilar — ' + kasr(yangi) + ' kun' : null].filter(Boolean);
    k.append(h('h3', {}, 'Keyingi ' + jk + ' kun'),
      h('div', { class: 'buy-kun-chiziq', role: 'img', 'aria-label': tavsif.join(', ') }, qism(bor, 'bor'), qism(yoq, 'yoq'), qism(yangi, 'yangi')),
      h('div', { class: 'buy-kun-izoh' },
        bor > 0 ? h('span', { class: 'bor' }, h('b', {}, 'Javonda'), ' ' + qoldiqMatn(x.qoldiq, x.dona) + ' — ' + kasr(bor) + ' kun') : null,
        yoq > 0 ? h('span', { class: 'yoq' }, h('b', {}, 'Dori yo\'q'), ' ' + kasr(yoq) + ' kun') : null,
        yangi > 0 ? h('span', { class: 'yangi' }, h('b', {}, 'Yangi ' + x.kerak + ' quti'), ' ' + kasr(yangi) + ' kun') : null));
    const yoqKun = buyYoqKun(x);
    if (yoqKun) {
      const q = h('div', { class: 'buy-yoq-q' }, h('div', {}, h('b', {}, (t === 'tugagan' ? 'Firma kelguncha ' : '') + yoqKun + ' kun dori bo\'lmaydi.'),
        boshqa.length ? ' ' + bNom(boshqa[0]) + 'da ' + qoldiqMatn(boshqa[0].qoldiq, x.dona) + ' bor — kelguncha o\'shandan oling.' : ''));
      const sor = boshqa.find((z) => z.f && z.f !== x.f);
      if (sor && x.f && ctx.server && ctx.amalFon) q.append(sorovEl(ctx, x, sor, bNom(sor), Math.max(1, Math.min(Math.floor(Number(sor.qoldiq)), Math.ceil(kunlik * yk))), qayta));
      k.append(q);
    }
  }
  if (boshqa.length) k.append(h('div', { class: 'muted' }, 'Boshqa filiallarda: ' + boshqa.slice(0, 4).map((z) => bNom(z) + ' — ' + qoldiqMatn(z.qoldiq, x.dona)).join(', ') + '.'));
  return k.childNodes.length ? k : null;
}
// «2-filialdan N quti so'rash» — filiallararo so'rov (o'zi shu filial uchun; so'rov bor bo'lsa — holati).
function sorovEl(ctx, x, sor, nom, n, qayta) {
  if (sorovYuklanganmi()) {
    const s = sorovHolati(x.nom, x.f, sor.f);
    if (s && ['yangi', 'tayyor', 'olindi'].includes(s.holat)) return h('span', { class: 'belgi ok' }, s.holat === 'yangi' ? '✓ So\'rov yuborilgan' : s.holat === 'tayyor' ? '✓ Tayyor — olib keting' : '✓ Olib ketilgan');
  }
  let band = false;
  const b = h('button', { type: 'button', class: 's', onclick: async () => {
    if (band) return;
    band = true; b.disabled = true;
    try {
      const r = await ctx.amalFon('doriSorovYoz', x.f, x.nom, n, 'quti', 'Aqlli buyurtma: firma kelguncha', sor.f);
      if (r) { ctx.toast('So\'rov yuborildi ✓ — ' + nom + 'ga xabar ketdi'); await sorovYukla(ctx, () => {}, true); qayta(); }
    } finally { band = false; if (b.isConnected) b.disabled = false; }
  } }, nom + 'dan ' + n + ' quti so\'rash');
  return b;
}
export function buyFaktlar(x) {
  const f = [];
  if (Number(x.yoqKun) >= 1) f.push(sonM(x.yoqKun) + ' kun dori tugab turgan — o\'sha kunlar hisobga olinmadi (aks holda sotuv kam ko\'rinardi).');
  if (Number(x.xavf) > 0) f.push((x.abc === 'A' ? 'Ko\'p' : 'Yaxshi') + ' pul keltiradigan dori — zaxiraga +' + x.xavf + ' kun qo\'shildi.');
  if (TUR_NOMI[x.tur]) f.push('Har kuni sotilmaydi — biroz kamroq olindi.');
  const km = kutilganMatn(x);
  if (km) f.push('Kutilgan qoldiq: ' + km + ' (yo\'lda — buyurtma berilgan, hali kelmagan; bron — mijozlar bron qilgan).');
  if (x.firmaN >= 3 && x.firmaKun != null) f.push((x.firma || 'Firma') + ' odatda ' + sonM(x.firmaKun) + ' kunda olib keladi — shu hisobga olindi.');
  return f;
}
// Firma tanlash: firma prayslaridagi 4 ta eng arzon (aniq moslik avval).
function firmaTanlov(x, fm, tanlangan, yangila) {
  const k = h('section', { class: 'card list buy-firmalar' }, h('h3', {}, 'Qaysi firmadan?'));
  const r = fm ? narxlar(x.nom).slice(0, 4) : [];
  if (!r.length) {
    k.append(h('div', { class: 'muted' }, fm ? 'Firma prayslarida bu dori topilmadi.' : 'Firma prayslari yuklanmagan — Bo\'limlar → Firma prayslari.'));
    if (tanlangan.firma) k.append(h('div', {}, 'Oson\'da oxirgi kelgan: ', asl(tanlangan.firma)));
    return k;
  }
  const eng = Number(r[0].yuz) || 0;
  const guruh = 'buy-firma-' + qKey(x);
  r.forEach((e) => {
    const inp = h('input', { type: 'radio', name: guruh, checked: e.firma === tanlangan.firma ? '' : null });
    inp.addEventListener('change', () => { qQoy(x, { fi: e.firma === r[0].firma ? undefined : e.firma }); yangila(); });
    k.append(h('label', { class: 'buy-firma-q' }, inp,
      h('span', { class: 'buy-firma-m' }, h('b', { 'data-asl': '' }, e.firma),
        h('span', { class: 'muted' }, (Number(e.yuz) <= eng ? 'Eng arzon' : '+' + H.som(Number(e.yuz) - eng)) + (e.aniq ? '' : ' · nomi taxminan mos'))),
      h('b', {}, H.som(e.yuz))));
  });
  return k;
}

// Savat: tanlangan dorilar firma bo'yicha.
function savatOyna(ctx, j, fil, chiz) {
  sheet('Buyurtma', (box, close) => {
    const ich = h('div', { class: 'buy-oyna' });
    box.append(ich);
    const qayta = () => { ich.textContent = ''; qur(); };
    function qur() {
      const fm = firmaBormi();
      const tan = j.qatorlar.filter(tanlanganmi);
      if (!tan.length) { ich.append(h('div', { class: 'card muted' }, 'Savat bo\'sh — ro\'yxatda dorilarni belgilang.')); return; }
      const g = new Map();
      for (const x of tan) { const f = qFirma(x, fm); const k = f.firma || ''; if (!g.has(k)) g.set(k, []); g.get(k).push({ x, f }); }
      const gs = [...g.entries()].sort((a, b) => (!a[0]) - (!b[0]) || b[1].length - a[1].length || a[0].localeCompare(b[0]));
      const jp = pulJami(tan, fm);
      ich.append(h('div', { class: 'muted' }, tan.length + ' dori · ' + gs.filter(([f]) => f).length + ' firma' + (jp.jami ? ' · ' + H.som(jp.jami) : '')));
      for (const [firma, qs] of gs) ich.append(firmaKarta(ctx, j, fil, chiz, firma, qs, qayta, close));
      ich.append(h('div', { class: 'muted' }, '«Buyurtma berdim» dan keyin dorilar defekturada «Buyurtma berilgan» bo\'ladi va kelguncha qayta tavsiya qilinmaydi. '
        + 'Oson\'da kirim bo\'lganda o\'zi «Keldi» bo\'ladi.'));
    }
    qur();
  }, { fokus: false });
}
const BERDIM_BOLAK = 30;
function firmaKarta(ctx, j, fil, chiz, firma, qs, qayta, close) {
  const s = savat();
  const yub = firma ? s.yub[firma] : null;
  const jami = qs.reduce((a, { x, f }) => a + (qutiNarx(x, f) || 0) * qSoni(x), 0);
  const fy = firma && Array.isArray(j.firmalar) ? j.firmalar.find((z) => z.n >= 3 && firmaTeng(z.firma, firma)) : null;
  const k = h('section', { class: 'card list buy-firma-k', 'aria-label': firma || 'Firma tanlanmagan' },
    h('div', { class: 'buy-firma-bosh' },
      h('div', {}, h('h3', { 'data-asl': '' }, firma || 'Firma tanlanmagan'),
        h('div', { class: 'muted' }, firma ? (fy ? 'Odatda ' + sonM(fy.kun) + ' kunda olib keladi' : '') : 'Dori oynasida firmani tanlang yoki ro\'yxatni o\'zingiz yuboring')),
      jami ? h('b', {}, H.som(jami)) : null));
  for (const { x } of qs) {
    const soni = qSoni(x);
    const qoy = (v) => { qQoy(x, { s: v === Math.round(Number(x.kerak)) ? undefined : v }); qayta(); chiz(); };
    k.append(h('div', { class: 'line buy-s-q' },
      h('span', { class: 'buy-s-nom' }, h('span', { 'data-asl': '' }, x.nom), h('span', { class: 'muted' }, filNom(fil, x))),
      h('div', { class: 'buy-stepper kichik', role: 'group', 'aria-label': x.nom + ' — necha quti' },
        h('button', { type: 'button', 'aria-label': 'Kamaytirish', disabled: soni <= 1 ? '' : null, onclick: () => qoy(soni - 1) }, '−'),
        h('span', {}, String(soni)),
        h('button', { type: 'button', 'aria-label': 'Ko\'paytirish', disabled: soni >= 9999 ? '' : null, onclick: () => qoy(soni + 1) }, '+'))));
  }
  const matn = buyurtmaMatn(firma, qs.map(({ x, f }) => ({ ...x, kerak: qSoni(x), eng: f.nom ? f : null })), fil);
  const belgila = () => { if (firma) { savat().yub[firma] = Date.now(); savatSaqla(); } qayta(); };
  const berdim = (cls, matnT) => {
    const b = h('button', { type: 'button', class: cls, onclick: async () => {
      if (B.berdimBand) return;
      // Audit: band — tasdiq oynasidan oldin (ikki marta bosilsa ikki tasdiq va ikki yozuv bo'lmasin).
      B.berdimBand = true;
      try {
        if (cls.includes('link') && !(await tasdiqlash(qs.length + ' ta dori «Buyurtma berildi» deb belgilansinmi? Ular defekturada «Buyurtma berilgan» bo\'ladi.'))) return;
        b.disabled = true; b.textContent = 'Saqlanmoqda…';
        // Audit: katta savat — bo'laklab (server bir so'rovda 100 tagacha, Edge JSON 12 000 belgigacha qabul qiladi).
        const ket = new Set();
        for (let i = 0; i < qs.length; i += BERDIM_BOLAK) {
          const bolak = qs.slice(i, i + BERDIM_BOLAK);
          const r = await ctx.amal('buyurtmaBerdim', bolak.map(({ x }) => ({ b: x.b, p: x.p, s: qSoni(x), fi: firma.slice(0, 200) })));
          if (r == null) break;
          bolak.forEach(({ x }) => ket.add(qKey(x)));
        }
        if (!ket.size) return;
        const sv = savat();   // audit: yarim tundan keyin bosilsa ham joriy savat
        ket.forEach((k) => { delete sv.q[k]; });
        if (firma && ket.size === qs.length) delete sv.yub[firma];
        savatSaqla();
        ctx.toast(ket.size + ' ta dori buyurtma qilindi ✓ — defekturada «Buyurtma berilgan»' + (ket.size < qs.length ? '. ' + (qs.length - ket.size) + ' tasi saqlanmadi — qayta bosing' : ''));
        // Darhol ro'yxatdan chiqsin (server hisobi yangilanguncha).
        j.qatorlar = j.qatorlar.filter((z) => !ket.has(qKey(z)));
        bYukla(ctx, chiz, true);
        chiz();
        if (!j.qatorlar.some(tanlanganmi)) close(); else qayta();
      } finally { B.berdimBand = false; if (b.isConnected) { b.disabled = false; b.textContent = matnT; } }
    } }, matnT);
    return b;
  };
  if (yub) {
    k.append(h('div', { class: 'buy-yub' }, h('span', { class: 'belgi ok' }, '✓ Yuborildi, ' + vaqt(yub)),
      h('button', { type: 'button', class: 'link', onclick: () => { delete savat().yub[firma]; savatSaqla(); qayta(); } }, 'Qayta yuborish')));
    k.append(h('div', { class: 'buy-berdim' }, h('div', {}, 'Firma buyurtmani qabul qildimi? Belgilasangiz, ' + qs.length + ' ta dori «Yo\'lda» bo\'ladi va kelguncha qayta tavsiya qilinmaydi.'),
      berdim('p', 'Buyurtma berdim')));
  } else {
    k.append(h('div', { class: 'row buy-firma-t' },
      h('button', { type: 'button', class: 's', onclick: () => { nusxaOl(matn, ctx.toast, 'Ro\'yxat nusxalandi — firmaga yuboring ✓'); belgila(); } }, 'Nusxalash'),
      ctx.tg && ctx.tg.openTelegramLink ? h('button', { type: 'button', class: 'p', onclick: () => {
        ctx.tg.openTelegramLink('https://t.me/share/url?url=' + encodeURIComponent(matn.slice(0, 3500))); belgila();
      } }, 'Telegram\'da yuborish') : null));
    k.append(berdim('link buy-telefon', 'Telefonda buyurtma berdim'));
  }
  return k;
}

// Sozlash: zaxira va yetkazish kunlari (shu telefonda), firmalar haqiqiy yetkazish vaqti.
const ZAXIRA_IZOH = {
  3: '3 kun — tez-tez buyurtma, javonda kam pul turadi. Firma kechiksa, dori tugab qolishi mumkin.',
  7: '7 kun — haftasiga bir buyurtma. Ko\'p aptekalar uchun o\'rtacha tanlov.',
  14: '14 kun — ikki haftada bir buyurtma. Buyurtma kam, lekin ko\'proq pul javonda turadi.',
  30: '30 kun — oyiga bir buyurtma. Ko\'p pul muzlaydi, muddati yaqin dori yig\'ilishi mumkin.'
};
function sozlashOyna(j, chiz) {
  let z = B.zaxira, y = B.yetkazish;
  sheet('Sozlash', (box, close) => {
    const ich = h('div', { class: 'buy-oyna' });
    box.append(ich);
    const qur = () => {
      ich.textContent = '';
      ich.append(h('h3', {}, 'Necha kunlik zaxira?'), pills(ZAXIRALAR.map((n) => [n, n + ' kun']), z, (v) => { z = v; qur(); }, 'Zaxira'),
        h('div', { class: 'muted' }, ZAXIRA_IZOH[z]),
        h('h3', {}, 'Firma necha kunda olib keladi?'), pills(YETKAZISHLAR.map((n) => [n, n + ' kun']), y, (v) => { y = v; qur(); }, 'Yetkazish'),
        h('div', { class: 'muted' }, 'Firma 3 va undan ko\'p marta olib kelgan bo\'lsa — uning haqiqiy vaqti olinadi'
          + (Array.isArray(j.firmalar) && j.firmalar.length ? ' (pastda).' : '.')));
      if (Array.isArray(j.firmalar) && j.firmalar.length) ich.append(firmalarKarta(j.firmalar));
      ich.append(yordam('Har dori uchun oxirgi 30 kunda kuniga necha quti sotilgani olinadi; dori tugab turgan kunlar hisobga olinmaydi. '
        + 'Olish = zaxira va yetkazish kunlarida sotiladigan qutilar + xodimlar defekturada so\'ragan − javonda bor − yo\'ldagi (buyurtma berilgan, hali kelmagan) '
        + '+ mijozlar bron qilgani. Ko\'p pul keltiradigan dorilarga 1–3 kun qo\'shimcha zaxira qo\'shiladi, har kuni sotilmaydigan dorilar biroz kamroq olinadi.',
        'Qanday hisoblanadi?'));
      ich.append(h('button', { type: 'button', class: 'p katta', onclick: () => {
        if (z !== B.zaxira || y !== B.yetkazish) { B.zaxira = z; B.yetkazish = y; B.ochiq = {}; lsQoy(SOZ_K, { zaxira: z, yetkazish: y }); chiz(); }
        close();
      } }, 'Saqlash'));
    };
    qur();
  });
}

// 08.11 (foydalanuvchi: "1 quti yashilda — nima u? Tushunarliroq qilib ber"): «Nega N quti» — server formulasi
// (kerak = ⌈kunlik × jamiKun − kutilgan + talab⌉, 20261107260000) raqamlari bilan. Formula aynan shu sonni bermasa (eski server,
// yaxlitlash) — hisob ko'rsatilmaydi.
const kasr = (n) => String(Math.round(Number(n) * 10) / 10).replace('.', ',');
// Audit 08.11: server kunlikni 2 xonagacha yaxlitlab beradi, kerak'ni esa aniq qiymatdan hisoblaydi — tekshiruvda ±0,005 × jamiKun
// joiz; kutilgan manfiy bo'lsa (bron qoldiqdan ko'p) — «+ bron qilingan»; yo'lda yoki bron bo'lsa — «kutilgan qoldiq» (javondagi emas).
export function buyHisob(x) {
  if (x.jamiKun == null || x.kunlik == null) return null;
  const sotuv = Number(x.kunlik) * Number(x.jamiKun), bor = Number(x.kutilgan != null ? x.kutilgan : x.qoldiq) || 0, talab = Number(x.talab) || 0;
  const tol = 0.005 * Number(x.jamiKun) + 1e-9;
  const k = Number(x.kerak);
  if (!(k >= Math.ceil(sotuv - tol - bor + talab - 1e-9) && k <= Math.ceil(sotuv + tol - bor + talab - 1e-9))) return null;
  const kutilganmi = x.kutilgan != null && (Number(x.yolda) > 0 || Number(x.bron) > 0);
  const q = [];
  if (sotuv > 0) q.push(x.jamiKun + ' kunlik sotuv ' + kasr(sotuv));
  if (talab > 0) q.push((q.length ? '+ ' : '') + 'xodimlar so\'ragan ' + talab);
  if (bor > 0) q.push('− ' + (kutilganmi ? 'kutilgan qoldiq ' : 'hozir bor ') + kasr(bor));
  if (bor < 0) q.push((q.length ? '+ ' : '') + 'bron qilingan ' + kasr(-bor));
  if (!q.length) return null;
  return 'Nega ' + x.kerak + ' quti: ' + q.join(' ') + (sotuv > 0 ? '' : ' (sotuv ko\'rinmadi)');
}
// 09.11 kech: hisob — jadval (har qator alohida: sotuv, so'ralgan, bor, = olish). Formula tekshiruvi buyHisob bilan bir xil.
// 10.11 kech: sotuv qatorida «kuniga N × K kun» (maket).
export function buyHisobQator(x) {
  if (!buyHisob(x)) return null;
  const sotuv = Number(x.kunlik) * Number(x.jamiKun), bor = Number(x.kutilgan != null ? x.kutilgan : x.qoldiq) || 0, talab = Number(x.talab) || 0;
  const kutilganmi = x.kutilgan != null && (Number(x.yolda) > 0 || Number(x.bron) > 0);
  const r = [];
  if (sotuv > 0) r.push([x.jamiKun + ' kunda sotiladi (kuniga ' + kasr(x.kunlik) + ')', kasr(sotuv) + ' quti']);
  if (talab > 0) r.push(['Xodimlar defekturada so\'ragan', '+ ' + talab + ' quti']);
  if (bor > 0) r.push([kutilganmi ? 'Bor + yo\'lda (kutilgan)' : 'Javonda bor', '− ' + kasr(bor) + ' quti']);
  if (bor < 0) r.push(['Bron qilingan', '+ ' + kasr(-bor) + ' quti']);
  r.push(['Olish kerak', x.kerak + ' quti']);
  return r;
}
export function buyHolat(x) {
  const yet = x.yetadi != null ? kasr(x.yetadi) : null;
  if (x.tugadi || !(Number(x.qoldiq) > 0)) return 'tugagan';
  return qoldiqMatn(x.qoldiq, x.dona) + ' qoldi' + (yet != null && Number(x.kunlik) > 0 ? ' — ' + yet + ' kunga yetadi' : '');
}

// Kutilgan qoldiq (07.11 tun, server 20261107260000): «Bor 3 · yo'lda 10 · bron 1 → kutilgan 12» — yo'lda (defekturada «Buyurtma
// berdim», hali kelmagan) yoki bron bo'lsa. Soni — quti (kasr — ochilgan quti). Eski server (maydonlar yo'q) — hech narsa.
const qutiM = (n) => String(Math.round(Number(n) * 100) / 100).replace('.', ',').replace('-', '−');
export function kutilganMatn(x) {
  if (!x || x.kutilgan == null || !(Number(x.yolda) > 0 || Number(x.bron) > 0)) return null;
  return ['Bor ' + qutiM(x.qoldiq), Number(x.yolda) > 0 ? 'yo\'lda ' + qutiM(x.yolda) : null, Number(x.bron) > 0 ? 'bron ' + qutiM(x.bron) : null]
    .filter(Boolean).join(' · ') + ' → kutilgan ' + qutiM(x.kutilgan);
}

// Aqlli buyurtma 2 belgilari (server 20261107200000): ABC, sotuv turi, tugagan kunlar, kutayotgan mijozlar, firma yetkazish vaqti.
// 10.11 kech: ro'yxatda endi chiqmaydi — tafsilotda oddiy jumlalar (buyFaktlar); funksiya eski ilova/testlar uchun qoldi.
const TUR_NOMI = { uzuq: 'uzuq-uzuq sotiladi', notekis: 'sotuvi notekis', bolak: 'kamdan-kam, har xil hajmda' };
const sonM = (n) => String(Math.round(Number(n) * 10) / 10).replace('.', ',');
export function buyBelgilar(x) {
  const b = [];
  const ABC_NOM = { A: 'Ko\'p pul keltiradi', B: 'O\'rtacha pul keltiradi' };
  if (ABC_NOM[x.abc]) b.push(h('span', { class: 'buy-b abc-' + x.abc, title: 'ABC — 30 kunlik tushum ulushi' }, ABC_NOM[x.abc] + (x.xavf ? ' · +' + x.xavf + ' kun zaxira' : '')));
  if (TUR_NOMI[x.tur]) b.push(h('span', { class: 'buy-b' }, TUR_NOMI[x.tur]));
  if (Number(x.yoqKun) >= 1) b.push(h('span', { class: 'buy-b' }, sonM(x.yoqKun) + ' kun tugab turgan — o\'sha kunlar sotuvga qo\'shilmadi'));
  if (x.talab > 0 && !buyHisob(x)) b.push(h('span', { class: 'buy-b ogoh' }, '+' + x.talab + ' quti: defekturada kutishmoqda'));
  if (x.firmaN >= 3 && x.firmaKun != null) {
    b.push(h('span', { class: 'buy-b' }, h('span', { 'data-asl': '' }, x.firma || 'Firma'), ' odatda ' + sonM(x.firmaKun) + ' kunda olib keladi'));
  }
  return b.length ? h('div', { class: 'buy-belgilar' }, ...b) : null;
}
function firmalarKarta(firmalar) {
  const k = h('div', { class: 'card list' }, kartaSarlavha('Firmalar qancha kunda olib keladi'),
    h('div', { class: 'muted' }, '«Buyurtma berdim» → Oson\'da «Keldi» (oxirgi 180 kun). 3 va undan ko\'p yetkazishda — buyurtma kunlari shu bo\'yicha.'));
  firmalar.forEach((f) => k.append(h('div', { class: 'line' }, h('span', { 'data-asl': '' }, f.firma),
    h('span', {}, f.n >= 3 ? h('b', {}, 'odatda ' + sonM(f.kun) + ' kunda') : 'hali ' + f.n + ' marta ko\'rildi', ' · ' + f.n + ' marta'))));
  return k;
}

// ---------- Filiallar orasida ko'chirish (07.11; foydalanuvchi: "2. Qo'shamiz") ----------
// Server (oson_kochirish_hisob): sekin sotilayotgan yoki muddati yaqin dori — tez sotadigan filialga. Faqat tavsiya:
// ko'chirishni Oson'da xodim qiladi; ko'chirilgach qoldiq o'zgaradi va taklif o'zi yo'qoladi.
const KB = () => ({ j: null, vaqt: 0, yuklanmoqda: null, xato: null, ochiq: {} });
const K = KB();
export function kochirishUnut() { Object.assign(K, KB()); }
function kYukla(ctx, chiz, majbur = false) {
  if (K.yuklanmoqda) return;
  if (!majbur && (K.j || K.xato) && Date.now() - K.vaqt < 60000) return;
  K.yuklanmoqda = ctx.oqi('osonKochirish')
    .then((j) => { if (!j || !Array.isArray(j.qatorlar)) throw new Error('Server javobi tushunarsiz'); K.j = j; K.xato = null; })
      .catch((e) => { K.xato = (e && e.message) || 'Ma\'lumot olinmadi'; })
    .finally(() => { K.vaqt = Date.now(); K.yuklanmoqda = null; chiz(); });
}
const tomon = (fil, t) => (t.f ? fil(t.f) : t.fn || '');
// 07.11 kech (foydalanuvchi: "funksiyalarni bir-biriga bog'la"): ko'chirish taklifi → filiallararo so'rov (kim uchun — oluvchi «ga»,
// kimdan — beruvchi «dan»). Miqdor: butun quti; 1 qutidan kam bo'lsa — dona. Holat (so'rov bormi) — filial-sorov ro'yxatidan.
function taklifMiqdor(x) {
  const s = Number(x.soni) || 0;
  if (s >= 1) return { n: Math.min(9999, Math.floor(s)), b: 'quti' };
  if (x.dona > 1 && s > 0) return { n: Math.min(9999, Math.max(1, Math.round(s * x.dona))), b: 'dona' };
  return { n: 1, b: 'quti' };
}
const taklifIzoh = (x) => 'Ko\'chirish: ' + (x.sabab === 'muddat' ? 'muddati yaqin (' + kunMatn(x.muddat) + ')' : 'ortiqcha qoldiq');
// jim — bir yo'la so'rashda har biriga alohida xabar chiqmasin (oxirida bitta xulosa).
async function taklifSora(ctx, x, jim = false) {
  const m = taklifMiqdor(x);
  const r = await ctx.amalFon('doriSorovYoz', x.ga.f, x.nom, m.n, m.b, taklifIzoh(x), x.dan.f);
  if (r && !jim) ctx.toast('So\'rov yuborildi ✓ — ' + (r.manba || '') + 'ga xabar ketdi');
  return r;
}
// So'ralgan deb hisoblanadi: ochiq yoki olib ketilgan (Oson'da hali ko'chirilmagan bo'lishi mumkin) — tugma ham, «Hammasini so'rash» ham
// bir xil qoida (audit 07.11 kech). «Yo'q» / bekor — qayta so'rash mumkin.
const soralganmi = (x) => { const s = sorovHolati(x.nom, x.ga.f, x.dan.f); return !!s && ['yangi', 'tayyor', 'olindi'].includes(s.holat); };
function taklifHolati(ctx, x, chiz) {
  if (!ctx.server || !x.dan.f || !x.ga.f || !ctx.amalFon) return null;
  if (!sorovYuklanganmi()) return h('span', { class: 'muted', style: 'font-size:13px' }, 'So\'rovlar yuklanmoqda…');
  const s = sorovHolati(x.nom, x.ga.f, x.dan.f);
  if (!s && !ozFilialmi(ctx, x.ga.f)) return null;   // so'rash — faqat o'z filiali uchun (direktor — hammasi)
  if (s && ['yangi', 'tayyor'].includes(s.holat)) return h('span', { class: 'belgi ok' }, s.holat === 'tayyor' ? '✓ So\'rov: tayyor — olib ketish kerak' : '✓ So\'rov yuborilgan — tayyorlanmoqda');
  if (s && s.holat === 'olindi') return h('span', { class: 'belgi ok' }, '✓ Olib ketilgan — Oson\'da ko\'chiring');
  let band = false;
  const b = h('button', { type: 'button', class: 's', onclick: async () => {
    if (band) return;
    band = true; b.disabled = true;
    try { if (await taklifSora(ctx, x)) await sorovYukla(ctx, chiz, true); } finally { band = false; b.disabled = false; chiz(); }
  } }, '📦 So\'rov qilish (' + taklifMiqdor(x).n + ' ' + taklifMiqdor(x).b + ')');
  return b;
}
let ommaviyBand = false;
const kunlikMatn = (n) => String(n == null ? 0 : n).replace('.', ',');
export function kochirishMatn(dan, ga, qatorlar) {
  return dan + ' → ' + ga + ' — ko\'chirish\n' + qatorlar.map((x, i) => (i + 1) + '. ' + x.nom + ' — ' + x.soni + ' quti'
    + (x.sabab === 'muddat' && x.muddat ? ' (muddati ' + kunMatn(x.muddat) + ')' : '')).join('\n');
}
export function kochirishView(m, ctx, fil) {
  const chiz = () => ctx.rerender();
  kYukla(ctx, chiz);
  if (ctx.server && ctx.amalFon) sorovYukla(ctx, chiz);   // har taklif ostida — so'rov bormi
  m.append(h('div', { class: 'muted' }, 'Oxirgi 30 kun sotuvi bo\'yicha: bir filialda sekin sotilayotgan yoki muddatigacha sotib ulgurilmaydigan dori — '
    + 'uni tez sotadigan filialga. Bu faqat tavsiya: ko\'chirishni Oson\'da o\'zingiz qilasiz, keyin dori ro\'yxatdan o\'zi chiqadi.'));
  if (!K.j) {
    m.append(K.xato ? h('div', { class: 'card' }, h('div', { class: 'muted' }, K.xato), h('button', { class: 's', onclick: () => { K.xato = null; kYukla(ctx, chiz, true); chiz(); } }, 'Qayta urinish'))
      : h('div', { class: 'card muted', role: 'status' }, 'Hisoblanmoqda…'));
    return;
  }
  const j = K.j;
  m.append(h('div', { class: 'line', style: 'border:0;padding:0' }, j.vaqt ? osonVaqtEl(j.vaqt) : h('span', {}),
    h('button', { class: 's', onclick: () => { kYukla(ctx, chiz, true); chiz(); } }, K.yuklanmoqda ? 'Yangilanmoqda…' : 'Yangilash')));
  if (K.xato) m.append(yangilanmadiEl(K.xato, () => { K.xato = null; kYukla(ctx, chiz, true); chiz(); }));
  // Filiallar: sotuv tarixi necha kunlik, Oson'da sotuv ko'rinadimi (ko'rinmasa — u filial hisobga olinmaydi).
  const fl = (j.filiallar || []).filter((f) => f.qator < 20 || f.kun < 7);
  if (fl.length) {
    m.append(h('div', { class: 'msg info' }, fl.map((f) => (f.f ? fil(f.f) : f.fn) + ': ' + (f.qator < 20
      ? 'Oson\'da sotuv deyarli ko\'rinmaydi — bu filial hisobga olinmadi (sotuv Oson orqali o\'tyaptimi — tekshiring)'
      : 'sotuv ' + String(f.kun).replace('.', ',') + ' kundan beri kuzatilmoqda (kamida 7 kun kerak)')).join('. ') + '.'));
  }
  if (!j.qatorlar.length) {
    m.append(h('div', { class: 'card muted' }, '✓ Hozir ko\'chirish kerak emas. Muddat bo\'yicha taklif — sotuv 7 kun kuzatilgach, ortiqcha qoldiq bo\'yicha — 30 kundan keyin chiqadi.'));
    return;
  }
  m.append(h('div', { class: 'card' }, h('div', { class: 'line', style: 'border:0;padding:0' }, h('b', {}, j.soni + ' ta taklif'), h('b', { class: 'pul-jami' }, '~' + H.som(j.jami))),
    h('div', { class: 'muted' }, 'Pul — tannarxda' + (j.tannarxsiz ? ' (' + j.tannarxsiz + ' tasida kirim narxi yo\'q — sotuv narxida)' : '') + '. Ko\'chirilsa — muddati o\'tib yo\'qolmaydi va muzlab turmaydi.')));
  // Yo'nalish bo'yicha guruh: «Osnovnoy → 2-filial».
  const g = new Map();
  for (const x of j.qatorlar) {
    const k = (x.dan.f || x.dan.fn) + '→' + (x.ga.f || x.ga.fn);
    if (!g.has(k)) g.set(k, { kalit: k, dan: tomon(fil, x.dan), ga: tomon(fil, x.ga), qatorlar: [], jami: 0 });
    const o = g.get(k); o.qatorlar.push(x); o.jami += Number(x.summa) || 0;
  }
  for (const o of [...g.values()].sort((a, b) => b.jami - a.jami)) {
    const kor = K.ochiq[o.kalit] ? o.qatorlar : o.qatorlar.slice(0, 15);
    const k = h('div', { class: 'card list' }, h('div', { class: 'line', style: 'border:0;padding:0' },
      h('b', {}, asl(o.dan), ' → ', asl(o.ga)), h('b', {}, o.qatorlar.length + ' xil · ' + qisqa(o.jami))));
    kor.forEach((x) => k.append(h('div', { class: 'item' },
      h('div', { class: 'line', style: 'border:0;padding:0' }, h('span', { 'data-asl': '' }, x.nom), h('b', { class: 'pul-kerak' }, x.soni + ' quti')),
      x.astatka ? h('div', { class: 'oson-otgan' }, 'Boshlang\'ich qoldiq (astatka) — ko\'chirishdan oldin sanab tekshiring') : null,
      izohEl([x.sabab === 'muddat' ? 'muddati ' + kunMatn(x.muddat) + ' — bu yerda sotib ulgurilmaydi' : '90 kunlik sotuvdan ko\'p qoldiq',
        'bu yerda kuniga ' + kunlikMatn(x.dan.kunlik) + ' quti, qoldiq ' + qoldiqMatn(x.dan.qoldiq, x.dona),
        'u yerda kuniga ' + kunlikMatn(x.ga.kunlik) + ' quti, qoldiq ' + qoldiqMatn(x.ga.qoldiq, x.dona)], x.sabab === 'muddat' ? 'oson-otgan' : 'muted'),
      taklifHolati(ctx, x, chiz))));
    if (o.qatorlar.length > 15) {
      k.append(h('button', { type: 'button', class: 'oq-yana', onclick: () => { K.ochiq[o.kalit] = !K.ochiq[o.kalit]; chiz(); } },
        K.ochiq[o.kalit] ? 'Yig\'ish ▴' : 'Yana ' + (o.qatorlar.length - kor.length) + ' ta ▾'));
    }
    const matn = kochirishMatn(o.dan, o.ga, o.qatorlar);
    // Yo'nalishning hali so'ralmagan takliflari — bir yo'la so'rov (tasdiq bilan, birin-ketin).
    const soralmagan = ctx.server && ctx.amalFon && sorovYuklanganmi() ? o.qatorlar.filter((x) => x.dan.f && x.ga.f && ozFilialmi(ctx, x.ga.f) && !soralganmi(x)) : [];
    if (soralmagan.length > 1) {
      k.append(h('button', { class: 'p', disabled: ommaviyBand ? '' : null, onclick: async (e) => {
        if (ommaviyBand) return;
        ommaviyBand = true;   // tasdiq oynasidan oldin — ikki marta bosilsa ikki to'plam ketmasin
        e.target.disabled = true;
        let n = 0;
        try {
          if (!(await tasdiqlash(o.dan + ' → ' + o.ga + ': ' + soralmagan.length + ' ta dori so\'rovi yuborilsinmi? ' + o.dan + ' xodimlariga xabar boradi.'))) return;
          for (const x of soralmagan) { if (await taklifSora(ctx, x, true)) n++; }
          const qolgan = soralmagan.length - n;
          ctx.toast(n ? n + ' ta so\'rov yuborildi ✓' + (qolgan ? ', ' + qolgan + ' tasi yuborilmadi' : '') : 'So\'rov yuborilmadi', n ? undefined : 'xato');
          await sorovYukla(ctx, () => {}, true);
        } finally { ommaviyBand = false; chiz(); }
      } }, '📦 Hammasini so\'rash (' + soralmagan.length + ')'));
    }
    k.append(h('div', { class: 'row' },
      h('button', { class: 's', onclick: () => nusxaOl(matn, ctx.toast, 'Ro\'yxat nusxalandi — xodimga yuboring ✓') }, 'Nusxalash'),
      ctx.tg && ctx.tg.openTelegramLink ? h('button', { class: 's', onclick: () => ctx.tg.openTelegramLink('https://t.me/share/url?url=' + encodeURIComponent(matn.slice(0, 3500))) }, 'Telegram\'da yuborish') : null));
    m.append(k);
  }
  m.append(h('div', { class: 'muted' }, 'Sotuv — Oson qoldig\'i kamaygani bo\'yicha (taxminiy). Ko\'chirishdan oldin javondagi muddatni tekshiring.'));
}

// ---------- Ertalabki hisobot (07.11; foydalanuvchi: "7 qo'shamiz") — «Kechki xulosa» sahifasida sozlama va ko'rinishi ----------
const EB = () => ({ j: null, vaqt: 0, yuklanmoqda: null, xato: null });
const E = EB();
export function ertalabUnut() { Object.assign(E, EB()); }
function eYukla(ctx, chiz, majbur = false) {
  if (E.yuklanmoqda) return;
  if (!majbur && (E.j || E.xato) && Date.now() - E.vaqt < 60000) return;
  E.yuklanmoqda = ctx.oqi('ertalab')
    .then((j) => { if (!j || typeof j !== 'object') throw new Error('Server javobi tushunarsiz'); E.j = j; E.xato = null; })
      .catch((e) => { E.xato = (e && e.message) || 'Ma\'lumot olinmadi'; })
    .finally(() => { E.vaqt = Date.now(); E.yuklanmoqda = null; chiz(); });
}
export function ertalabKarta(ctx) {
  const chiz = () => ctx.rerender();
  eYukla(ctx, chiz);
  const k = h('div', { class: 'card' }, kartaSarlavha('☀️ Ertalabki hisobot'));
  if (!E.j) {
    k.append(E.xato ? h('div', {}, h('div', { class: 'muted' }, E.xato), h('button', { class: 's', onclick: () => { E.xato = null; eYukla(ctx, chiz, true); chiz(); } }, 'Qayta urinish'))
      : h('div', { class: 'muted', role: 'status' }, 'Yuklanmoqda…'));
    return k;
  }
  k.append(h('div', { class: 'muted' }, 'Har kuni ertalab bot sizga kechagi savdo (Oson bo\'yicha), eng ko\'p sotilganlar, tugayotganlar, ko\'chirish takliflari va muddati yaqinlarni yuboradi.'));
  const vaqtlar = [['', 'O\'chiq'], ['07:30', '07:30'], ['08:00', '08:00'], ['08:30', '08:30'], ['09:00', '09:00'], ['09:30', '09:30']];
  if (E.j.vaqt && !vaqtlar.some(([v]) => v === E.j.vaqt)) vaqtlar.push([E.j.vaqt, E.j.vaqt]);
  k.append(pills(vaqtlar, E.j.vaqt || '', (v) => ctx.amal('ertalabVaqti', v).then((r) => {
    if (r == null) { chiz(); return; }   // saqlanmadi — tanlov oldingi holatiga
    E.j = { ...E.j, vaqt: v || null };
    ctx.toast(v ? 'Har kuni ' + v + ' da yuboriladi ✓' : 'Ertalabki hisobot o\'chirildi');
    chiz();
  }), 'Ertalabki hisobot vaqti'));
  k.append(E.j.matn ? h('div', { style: 'white-space:pre-line;font-size:14px;margin-top:10px' }, E.j.matn)
    : h('div', { class: 'muted', style: 'margin-top:10px' }, 'Oson ma\'lumoti hali kelmagan — aptekadagi kompyuterda kengaytma va Oson ochilgach hisobot chiqadi.'));
  return k;
}
