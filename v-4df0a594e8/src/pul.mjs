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
import { h, kartaSarlavha, nusxaOl, pills, sana, sheet, vaqt, yordam } from './ui.mjs';
import { qoldiqMatn } from './oson-qoldiq.mjs';
import { firmalarOl, narxlar } from './firma.mjs';

const PB = () => ({ j: null, vaqt: 0, yuklanmoqda: null, xato: null, bolim: 'muddat', filial: '', ochiq: false });
const BB = () => ({ j: null, kalit: '', vaqt: 0, yuklanmoqda: null, xato: null, xatoKalit: '', zaxira: 7, yetkazish: 2, filial: '', ochiq: {}, firmaBor: false, firmaXato: 0, firmaSoni: 0 });
const P = PB(), B = BB();
// Sinov uchun (tests): modul holatini tozalash.
export function pulUnut() { Object.assign(P, PB()); Object.assign(B, BB()); }
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
    .then((j) => { if (!j || !j.muddat) throw new Error('Server javobi tushunarsiz'); P.j = j; P.xato = null; },
      (e) => { P.xato = (e && e.message) || 'Ma\'lumot olinmadi'; })
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
  m.append(h('div', { class: 'muted' }, 'Oson · ' + (j.vaqt ? sana(j.vaqt) + ' ' + vaqt(j.vaqt) : 'ma\'lumot yo\'q')));
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
function bYukla(ctx, chiz, majbur = false) {
  const kalit = B.zaxira + ':' + B.yetkazish;
  if (B.yuklanmoqda) return;
  if (!majbur && ((B.j && B.kalit === kalit) || (B.xato && B.xatoKalit === kalit)) && Date.now() - B.vaqt < 60000) return;
  B.yuklanmoqda = ctx.oqi('osonBuyurtma', B.zaxira, B.yetkazish)
    .then((j) => { if (!j || !Array.isArray(j.qatorlar)) throw new Error('Server javobi tushunarsiz'); if (kalit === B.zaxira + ':' + B.yetkazish) { B.j = j; B.kalit = kalit; B.xato = null; } },
      (e) => { B.xato = (e && e.message) || 'Ma\'lumot olinmadi'; B.xatoKalit = kalit; })
    .finally(() => { B.vaqt = Date.now(); B.yuklanmoqda = null; chiz(); });
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
  m.append(h('div', { class: 'muted' }, 'Har dori har filialda oxirgi 30 kunda qancha sotilgani (Oson qoldig\'i kamayishi) bo\'yicha: kuniga necha quti, qoldiq necha kunga yetadi va '
    + B.yetkazish + ' kun yetkazish + ' + B.zaxira + ' kun zaxiraga qancha quti kerak.'));
  m.append(h('b', {}, 'Necha kunlik zaxira?'), pills([[3, '3 kun'], [7, '7 kun'], [14, '14 kun'], [30, '30 kun']], B.zaxira, (v) => { B.zaxira = v; B.ochiq = {}; chiz(); }, 'Zaxira'),
    h('b', {}, 'Firma necha kunda olib keladi?'), pills([[1, '1 kun'], [2, '2 kun'], [3, '3 kun']], B.yetkazish, (v) => { B.yetkazish = v; B.ochiq = {}; chiz(); }, 'Yetkazish'));
  const j = B.j && B.kalit === B.zaxira + ':' + B.yetkazish ? B.j : null;
  if (!j) {
    m.append(B.xato ? h('div', { class: 'card' }, h('div', { class: 'muted' }, B.xato), h('button', { class: 's', onclick: () => { B.xato = null; bYukla(ctx, chiz, true); chiz(); } }, 'Qayta urinish'))
      : h('div', { class: 'card muted', role: 'status' }, 'Hisoblanmoqda…'));
    return;
  }
  const kuzKun = j.kuzatuv ? (Date.now() - j.kuzatuv) / 864e5 : 0;
  if (kuzKun < 14) {
    m.append(h('div', { class: kuzKun < 3 ? 'msg warn' : 'msg info' }, kuzKun < 3
      ? 'Sotuv tezligi hisoblanmoqda: Oson qoldig\'i ' + (j.kuzatuv ? sana(j.kuzatuv) : 'endi') + ' dan kuzatilmoqda. Tavsiyalar 3 kundan keyin chiqadi, aniqroq — 2 haftada.'
      : 'Sotuv ' + Math.floor(kuzKun) + ' kundan beri kuzatilmoqda — tavsiyalar taxminiy, 2 haftada aniqlashadi.'));
  }
  if (j.versiya >= 2) {
    m.append(yordam('Kunlik sotuv — oxirgi 30 kun, lekin dori tugab turgan kunlar hisobga olinmaydi (javonda yo\'q kuni sotuv bo\'lmagani — talab yo\'q degani emas). '
      + 'Har kuni emas, uzuq-uzuq sotiladigan dori («uzuq-uzuq», «notekis», «bo\'lak») — Syntetos–Boylan usuli: o\'rtacha 5% kamroq olinadi (ortiqcha zaxira yig\'ilmasin). '
      + 'A / B / C — 30 kunlik tushum: A — tushumning 80% ini beradigan dorilar (+3 kun zaxira), B — keyingi 15% (+1 kun), C — qolgani (qo\'shimchasiz). '
      + 'Defekturada so\'ralgan va kutayotgan mijozlar — qo\'shimcha quti. Firma «Buyurtma berdim» dan Oson\'da «Keldi» gacha odatda necha kunda olib kelgani '
      + 'kamida 3 marta ko\'rilgan bo\'lsa — yuqoridagi yetkazish kunlari o\'rniga shu olinadi. '
      + 'Kutilgan qoldiq = Oson\'dagi qoldiq + yo\'ldagi (defekturada «Buyurtma berdim», hali kelmagan — har yozuv kamida 1 quti) − mijozlar bron qilgan qutilar: '
      + 'buyurtma berilgan dori qayta tavsiya qilinmaydi, bron qilingani sotilgan deb olinadi.', 'Qanday hisoblanadi?'));
    if (Array.isArray(j.firmalar) && j.firmalar.length) m.append(firmalarKarta(j.firmalar));
  }
  if (B.filial && !j.qatorlar.some((x) => (x.f || x.fn) === B.filial)) B.filial = '';
  const fp = filialPills(j.qatorlar, fil, B.filial, (v) => { B.filial = v; B.ochiq = {}; chiz(); });
  if (fp) m.append(fp);
  const rows = j.qatorlar.filter((x) => !B.filial || (x.f || x.fn) === B.filial);
  if (!rows.length) {
    m.append(h('div', { class: 'card muted' }, kuzKun < 3 ? 'Hali yetarli sotuv ma\'lumoti yo\'q.' : '✓ Hozir buyurtma kerak dori yo\'q — hammasi ' + (B.yetkazish + B.zaxira) + ' kunga yetadi.'));
    return;
  }
  if (firmaHolat === 'yuklanmoqda') m.append(h('div', { class: 'muted', role: 'status' }, 'Firma narxlari yuklanmoqda…'));
  if (firmaHolat === 'yoq') m.append(h('div', { class: 'msg info' }, 'Firma prayslari yuklanmagan — eng arzon firma ko\'rsatilmaydi. Bo\'limlar → Firma prayslari.'));
  const guruhlar = firmagaBol(rows, firmaHolat === 'bor' ? narxlar : null);
  m.append(h('div', { class: 'muted' }, rows.length + ' xil dori · ' + (firmaHolat === 'bor' ? 'eng arzon firma bo\'yicha guruhlangan' : 'firmasiz')));
  for (const g of guruhlar) {
    const kalit = g.firma || '-';
    const kor = B.ochiq[kalit] ? g.qatorlar : g.qatorlar.slice(0, 15);
    const k = h('div', { class: 'card list' }, h('div', { class: 'line', style: 'border:0;padding:0' },
      kartaSarlavha(g.firma ? g.firma : firmaHolat === 'bor' ? 'Firmalarda topilmadi' : 'Buyurtma kerak'),
      h('b', {}, g.qatorlar.length + ' xil' + (g.jami ? ' · ' + qisqa(g.jami) : ''))));
    kor.forEach((x) => k.append(bQator(x, fil)));
    if (g.qatorlar.length > kor.length || B.ochiq[kalit]) {
      k.append(h('button', { type: 'button', class: 'oq-yana', onclick: () => { B.ochiq[kalit] = !B.ochiq[kalit]; chiz(); } },
        B.ochiq[kalit] ? 'Yig\'ish ▴' : 'Yana ' + (g.qatorlar.length - kor.length) + ' ta ▾'));
    }
    const matn = buyurtmaMatn(g.firma, g.qatorlar, fil);
    k.append(h('div', { class: 'row' },
      h('button', { class: 's', onclick: () => nusxaOl(matn, ctx.toast, 'Ro\'yxat nusxalandi — agentga yuboring ✓') }, 'Nusxalash'),
      ctx.tg && ctx.tg.openTelegramLink ? h('button', { class: 's', onclick: () => ctx.tg.openTelegramLink('https://t.me/share/url?url=' + encodeURIComponent(matn.slice(0, 3500))) }, 'Telegram\'da yuborish') : null));
    m.append(k);
  }
  m.append(h('div', { class: 'muted' }, 'Sotuv — Oson qoldig\'i kamaygani (30 daqiqalik o\'qishlar orasida). Shu oraliqda dori kelgan bo\'lsa, sotuv biroz kam ko\'rinadi. Muddati yaqin va «Muzlagan pul»dagi dorilarni ko\'p olmang.'));
}

function bQator(x, fil) {
  const kam = x.yetadi != null && x.yetadi < 3;
  const kunlik = String(x.kunlik).replace('.', ',');
  return h('div', { class: 'item' }, h('div', { class: 'line', style: 'border:0;padding:0' }, h('span', { 'data-asl': '' }, x.nom), h('b', { class: 'pul-kerak' }, x.kerak + ' quti')),
    izohEl([asl(filNom(fil, x)), x.tugadi ? 'tugagan' : 'qoldiq ' + qoldiqMatn(x.qoldiq, x.dona), 'kuniga ' + kunlik + ' quti',
      x.yetadi != null ? String(x.yetadi).replace('.', ',') + ' kunga yetadi' : null, x.def ? 'defekturada bor' : null], kam || x.tugadi ? 'oson-otgan' : 'muted'),
    kutilganEl(x),
    buyBelgilar(x),
    x.eng ? h('div', { class: 'firma-nomi', 'data-asl': '' }, x.eng.firma + ': ' + x.eng.nom + ' — ' + H.som(x.eng.yuz) + (x.eng.aniq ? '' : ' (taxminiy)')) : null);
}

// Kutilgan qoldiq (07.11 tun, server 20261107260000): «Bor 3 · yo'lda 10 · bron 1 → kutilgan 12» — yo'lda (defekturada «Buyurtma
// berdim», hali kelmagan) yoki bron bo'lsa. Soni — quti (kasr — ochilgan quti). Eski server (maydonlar yo'q) — hech narsa.
const qutiM = (n) => String(Math.round(Number(n) * 100) / 100).replace('.', ',').replace('-', '−');
export function kutilganMatn(x) {
  if (!x || x.kutilgan == null || !(Number(x.yolda) > 0 || Number(x.bron) > 0)) return null;
  return ['Bor ' + qutiM(x.qoldiq), Number(x.yolda) > 0 ? 'yo\'lda ' + qutiM(x.yolda) : null, Number(x.bron) > 0 ? 'bron ' + qutiM(x.bron) : null]
    .filter(Boolean).join(' · ') + ' → kutilgan ' + qutiM(x.kutilgan);
}
function kutilganEl(x) {
  const t = kutilganMatn(x);
  return t ? h('div', { class: 'buy-kutilgan', title: 'Yo\'lda — «Buyurtma berdim» qilingan, hali kelmagan (har yozuv kamida 1 quti); bron — mijozlar bron qilgan qutilar' }, t) : null;
}

// Aqlli buyurtma 2 belgilari (server 20261107200000): ABC, sotuv turi, tugagan kunlar, kutayotgan mijozlar, firma yetkazish vaqti.
// Eski javobda (maydonlar yo'q) — hech narsa.
const TUR_NOMI = { uzuq: 'uzuq-uzuq sotiladi', notekis: 'sotuvi notekis', bolak: 'kamdan-kam, har xil hajmda' };
const sonM = (n) => String(Math.round(Number(n) * 10) / 10).replace('.', ',');
export function buyBelgilar(x) {
  const b = [];
  if (x.abc) b.push(h('span', { class: 'buy-b abc-' + x.abc, title: 'ABC — 30 kunlik tushum ulushi' }, x.abc + (x.xavf ? ' · +' + x.xavf + ' kun zaxira' : '')));
  if (TUR_NOMI[x.tur]) b.push(h('span', { class: 'buy-b' }, TUR_NOMI[x.tur]));
  if (Number(x.yoqKun) >= 1) b.push(h('span', { class: 'buy-b ogoh' }, sonM(x.yoqKun) + ' kun tugagan edi — hisobga olinmadi'));
  if (x.talab > 0) b.push(h('span', { class: 'buy-b ogoh' }, '+' + x.talab + ' quti: defekturada kutishmoqda'));
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
    .then((j) => { if (!j || !Array.isArray(j.qatorlar)) throw new Error('Server javobi tushunarsiz'); K.j = j; K.xato = null; },
      (e) => { K.xato = (e && e.message) || 'Ma\'lumot olinmadi'; })
    .finally(() => { K.vaqt = Date.now(); K.yuklanmoqda = null; chiz(); });
}
const tomon = (fil, t) => (t.f ? fil(t.f) : t.fn || '');
const kunlikMatn = (n) => String(n == null ? 0 : n).replace('.', ',');
export function kochirishMatn(dan, ga, qatorlar) {
  return dan + ' → ' + ga + ' — ko\'chirish\n' + qatorlar.map((x, i) => (i + 1) + '. ' + x.nom + ' — ' + x.soni + ' quti'
    + (x.sabab === 'muddat' && x.muddat ? ' (muddati ' + kunMatn(x.muddat) + ')' : '')).join('\n');
}
export function kochirishView(m, ctx, fil) {
  const chiz = () => ctx.rerender();
  kYukla(ctx, chiz);
  m.append(h('div', { class: 'muted' }, 'Oxirgi 30 kun sotuvi bo\'yicha: bir filialda sekin sotilayotgan yoki muddatigacha sotib ulgurilmaydigan dori — '
    + 'uni tez sotadigan filialga. Bu faqat tavsiya: ko\'chirishni Oson\'da o\'zingiz qilasiz, keyin dori ro\'yxatdan o\'zi chiqadi.'));
  if (!K.j) {
    m.append(K.xato ? h('div', { class: 'card' }, h('div', { class: 'muted' }, K.xato), h('button', { class: 's', onclick: () => { K.xato = null; kYukla(ctx, chiz, true); chiz(); } }, 'Qayta urinish'))
      : h('div', { class: 'card muted', role: 'status' }, 'Hisoblanmoqda…'));
    return;
  }
  const j = K.j;
  m.append(h('div', { class: 'line', style: 'border:0;padding:0' }, h('span', { class: 'muted' }, j.vaqt ? 'Oson · ' + sana(j.vaqt) + ' ' + vaqt(j.vaqt) : ''),
    h('button', { class: 's', onclick: () => { kYukla(ctx, chiz, true); chiz(); } }, K.yuklanmoqda ? 'Yangilanmoqda…' : 'Yangilash')));
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
        'u yerda kuniga ' + kunlikMatn(x.ga.kunlik) + ' quti, qoldiq ' + qoldiqMatn(x.ga.qoldiq, x.dona)], x.sabab === 'muddat' ? 'oson-otgan' : 'muted'))));
    if (o.qatorlar.length > 15) {
      k.append(h('button', { type: 'button', class: 'oq-yana', onclick: () => { K.ochiq[o.kalit] = !K.ochiq[o.kalit]; chiz(); } },
        K.ochiq[o.kalit] ? 'Yig\'ish ▴' : 'Yana ' + (o.qatorlar.length - kor.length) + ' ta ▾'));
    }
    const matn = kochirishMatn(o.dan, o.ga, o.qatorlar);
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
    .then((j) => { if (!j || typeof j !== 'object') throw new Error('Server javobi tushunarsiz'); E.j = j; E.xato = null; },
      (e) => { E.xato = (e && e.message) || 'Ma\'lumot olinmadi'; })
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
