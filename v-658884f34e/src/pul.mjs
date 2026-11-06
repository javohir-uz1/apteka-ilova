// Pul nazorati va Aqlli buyurtma (06.11; foydalanuvchi: "tavsiyang — avval shu 4 tasini qilamiz", "aqlli buyurtmani ham qo'sh").
// Faqat direktor, faqat serverda; ma'lumot — Oson qoldig'i (kengaytma har 30 daqiqada yuboradi).
// Pul nazorati: muddati o'tgan / 3 oyda tugaydigan dorilar puli, sekin aylanayotgan pul (90+ kun yangi partiya kelmagan va
// 30 kun sotilmagan), kam foyda yoki zarar (oxirgi partiya sotuv narxi kirim narxidan 10% dan kam yuqori). Pul — tannarxda
// (Oson kirim narxi, kengaytma 0.9.13); kirim narxi bo'lmasa — sotuv narxida (belgilanadi).
// Aqlli buyurtma: kunlik sotuv (Oson qoldig'i kamayishi, 30 kun) → necha kunga yetadi, qancha quti kerak; eng arzon firma
// (firma prayslari, telefonda moslanadi) bo'yicha guruhlanadi — har firma ro'yxatini nusxalab agentga yuborasiz.
import * as H from './hisob.mjs';
import { h, kartaSarlavha, nusxaOl, pills, sana, vaqt } from './ui.mjs';
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
    t('buyurtma', '🛒', 'Aqlli buyurtma', 'Nima va qancha olish kerak'));
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
  const sarlavha = {
    muddat: 'Muddati o\'tgan yoki ' + j.muddat.oy + ' oyda tugaydi',
    sekin: j.sekin.kun + '+ kun yangi partiya kelmagan, kuzatuvda sotilmagan',
    foyda: 'Foydasi ' + j.foyda.chegara + '% dan kam yoki zarar'
  }[P.bolim];
  list.append(h('div', { class: 'line', style: 'border:0;padding:0' }, kartaSarlavha(sarlavha),
    P.bolim === 'foyda' ? h('b', {}, rows.length + ' xil') : h('b', { class: 'pul-jami' }, H.som(Math.round(jami)))));
  if (P.bolim !== 'foyda' && rows.length) list.append(h('div', { class: 'muted' }, rows.length + ' xil dori' + (tansiz ? ' · ba\'zilari sotuv narxida (*)' : ' · tannarxda')
    + (b.soni > b.qatorlar.length ? ' · eng kattalari ' + b.qatorlar.length + ' tasi (jami ' + b.soni + ' xil)' : '')));
  if (!rows.length) list.append(h('div', { class: 'muted' }, {
    muddat: '✓ ' + j.muddat.oy + ' oy ichida muddati tugaydigan dori yo\'q',
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
        x.msoni != null ? qoldiqMatn(x.msoni, x.dona) : null], x.otgan ? 'oson-otgan' : 'muted'));
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
    x.eng ? h('div', { class: 'firma-nomi', 'data-asl': '' }, x.eng.firma + ': ' + x.eng.nom + ' — ' + H.som(x.eng.yuz) + (x.eng.aniq ? '' : ' (taxminiy)')) : null);
}
