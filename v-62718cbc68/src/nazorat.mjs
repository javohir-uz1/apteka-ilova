// Narx farqi va narx yorliqlari, Kassa ↔ Oson (07.11; foydalanuvchi: "1 2 3 qo'sh"). Ma'lumot — Oson qoldig'i va sotuvi
// (kengaytma har 30 daqiqada yuboradi; ilova Oson'ga hech narsa yozmaydi). Server: 20261107180000_narx_kassa_partiya.
// Direktor: Qoldiq → «🏷 Narx farqi» (filiallarda har xil narx, to'g'ri narxni tanlash, yorliqlar) va «💵 Kassa ↔ Oson».
// Xodim: Bosh → «Narxni tuzating» (direktor tanlagan narx, o'z filiali) va yangi narx yorliqlari.
import * as H from './hisob.mjs';
import { h, input, kartaSarlavha, pills, sana, sheet, tasdiqlash } from './ui.mjs';
import { osonVaqtEl, qoldiqMatn, yanaRoyxat } from './oson-qoldiq.mjs';

// c — davlat reyestri narx chegarasi (20261107210000_dori_reyestr; eski serverda yo'q — bo'lim ko'rinmaydi).
const NB = () => ({ j: null, y: null, c: null, vaqt: 0, yuklanmoqda: null, xato: null, saralash: 'hammasi', ochiq: false, yuborilmoqda: '',
  chOchiq: false, moslanmoqda: false });
// Kassa: j — jKalit davri uchun; xato — xatoKalit davri uchun (audit 07.11: xatoda eski davr yangisi ostida ko'rinardi).
const KB = () => ({ j: null, jKalit: 0, kunlar: 7, vaqt: 0, yuklanmoqda: null, xato: null, xatoKalit: 0, ochiq: {} });
const XB = () => ({ j: null, vaqt: 0, yuklanmoqda: null, xato: null, yuborilmoqda: '' });
const N = NB(), K = KB(), X = XB();
// Sinov uchun (tests): modul holatini tozalash.
export function nazoratUnut() { Object.assign(N, NB()); Object.assign(K, KB()); Object.assign(X, XB()); }
const KORINADI = 40;

const asl = (t) => h('span', { 'data-asl': '' }, t);
const filNom = (fil, x) => (x.f ? fil(x.f) : x.fn || x.b || '');
const kunMatn = (d) => (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}/.test(d) ? d.slice(8, 10) + '.' + d.slice(5, 7) : '');
const HAFTA = ['Yak', 'Dush', 'Sesh', 'Chor', 'Pay', 'Jum', 'Shan'];
const haftaKuni = (d) => HAFTA[new Date(d + 'T12:00:00+05:00').getUTCDay()];
const xatoKarta = (xato, qayta) => h('div', { class: 'card' }, h('div', { class: 'muted' }, xato), h('button', { class: 's', onclick: qayta }, 'Qayta urinish'));
const yuklanmoqda = (matn = 'Yuklanmoqda…') => h('div', { class: 'card muted', role: 'status' }, matn);

// Yorliq o'lchami (07.11 tun; InvenTree/JsBarcode g'oyasi): haqiqiy mm — yorliq printeri (har yorliq alohida sahifa) yoki A4 varaq.
// Tanlov shu telefonda eslab qolinadi; server HTML'ni shu o'lchamda yasaydi (api.mjs YORLIQ_OLCHAM — kalitlar bir xil), faylning
// o'zida ham almashtirsa bo'ladi. Shtrix-kod (Oson'dagi qutidagi kod) — narx ostida, server qo'yadi.
export const YORLIQ_OLCHAMLAR = [['a4', 'A4 varaq'], ['58x40', '58×40'], ['40x30', '40×30'], ['30x20', '30×20']];
const OLCHAM_KALIT = 'apteka-yorliq-olcham';
export function yorliqOlcham() {
  let v = null;
  try { v = localStorage.getItem(OLCHAM_KALIT); } catch (e) { v = null; }
  return YORLIQ_OLCHAMLAR.some(([k]) => k === v) ? v : 'a4';
}
const olchamQoy = (v) => { try { localStorage.setItem(OLCHAM_KALIT, v); } catch (e) { /* yopiq rejim — shu safar */ } };
const olchamTanlov = () => h('div', {}, pills(YORLIQ_OLCHAMLAR, yorliqOlcham(), olchamQoy, 'Yorliq o\'lchami, mm'),
  h('div', { class: 'muted', style: 'font-size:13px' }, 'Yorliq printeri bo\'lsa — uning yorlig\'i o\'lchami; oddiy printer — A4. Narx ostida shtrix-kod (Oson\'da bo\'lsa).'));

// Yorliqlarni Telegram'ga yuborish (direktor ham, xodim ham): server HTML fayl qilib so'raganning o'ziga yuboradi.
async function yorliqYubor(ctx, holat, b, keyin) {
  if (holat.yuborilmoqda) return;
  holat.yuborilmoqda = b; ctx.rerender();
  try {
    const r = await ctx.amalFon('narxYorliq', b, yorliqOlcham());
    if (r != null) ctx.toast('Yorliqlar Telegram\'ga yuborildi ✓ — kompyuterda oching va chop eting');
  } finally { holat.yuborilmoqda = ''; keyin(); }
}
function yorliqQatorlari(ctx, fil, yorliq, holat, keyin) {
  return [olchamTanlov(), ...yorliq.map((y) => h('div', { class: 'line' }, h('span', {}, asl(filNom(fil, y)), ': ' + y.soni + ' ta yangi narx'),
    h('button', { class: 's', disabled: holat.yuborilmoqda ? '' : null, onclick: () => yorliqYubor(ctx, holat, y.b, keyin) },
      holat.yuborilmoqda === y.b ? 'Yuborilmoqda…' : 'Telegram\'ga yuborish')))];
}

// ---------- Narx farqi (direktor) ----------
function nYukla(ctx, chiz, majbur = false) {
  if (N.yuklanmoqda) return;
  if (!majbur && (N.j || N.xato) && Date.now() - N.vaqt < 60000) return;
  N.yuklanmoqda = Promise.all([ctx.oqi('narxFarq'), ctx.oqi('narxXodim').catch(() => null), ctx.oqi('narxChegara').catch(() => null)])
    .then(([j, y, c]) => { if (!j || !Array.isArray(j.qatorlar)) throw new Error('Server javobi tushunarsiz'); N.j = j; N.y = y; N.c = c; N.xato = null; })
      .catch((e) => { N.xato = (e && e.message) || 'Ma\'lumot olinmadi'; })
    .finally(() => { N.vaqt = Date.now(); N.yuklanmoqda = null; chiz(); });
}

// To'g'ri narxni tanlash: filiallardagi narxlardan biri yoki boshqa summa; tanlov olib tashlanishi mumkin.
// chegara (davlat reyestri, «Narx chegarasidan oshgan» dan) — undan yuqori narx tavsiya qilinmaydi, yozilsa so'raladi.
function narxOyna(ctx, x, fil, keyin, chegara = null) {
  sheet('To\'g\'ri narx', (box, close) => {
    const hamma = [...new Set(x.filiallar.map((f) => Number(f.narx)))].sort((a, b) => b - a);
    const narxlar = chegara ? hamma.filter((n) => n <= chegara) : hamma;
    // Chegaraga eng yaqin «yumaloq» narx (100 so'mga pastga) — chegaradan oshmaydi.
    const tavsiya = chegara ? (chegara >= 1000 ? Math.floor(chegara / 100) * 100 : Math.floor(chegara)) : null;
    if (tavsiya && !narxlar.includes(tavsiya)) narxlar.unshift(tavsiya);
    const f = input('Narx, so\'m (1 quti)', { placeholder: H.som(narxlar[0] || hamma[0] || 0), enterkeyhint: 'done' });
    if (x.qaror) { f.qiymat(String(x.qaror)); f.i.defaultValue = f.i.value; }
    let band = false;
    // Yozilgan matn: bo'sh yoki noto'g'ri — xato (null — faqat «Tanlovni olib tashlash»dan; noto'g'ri yozuv tanlovni o'chirmasin).
    // Filiallardagi narxdan 2 baravar ko'p yoki yarmidan kam — so'raladi (ortiqcha nol: 130 000 o'rniga 13 000).
    const yozilgan = async () => {
      const n = H.pul(f.i.value);
      if (!(n > 0)) { f.xato('Narxni yozing — masalan: 25 000'); return; }
      if (chegara && n > chegara
        && !(await tasdiqlash(H.som(n) + ' — davlat chegarasidan (' + H.som(chegara) + ') yuqori. Baribir shu narxmi?'))) return;
      if ((n > 2 * hamma[0] || n < 0.5 * hamma[hamma.length - 1])
        && !(await tasdiqlash(H.som(n) + ' — filiallardagi narxdan ancha farq qiladi (' + hamma.map(H.som).join(', ') + '). To\'g\'rimi?'))) return;
      saqla(n);
    };
    const saqla = async (narx) => {
      if (band) return;
      band = true;
      try {
        const r = await ctx.amalFon('narxBelgila', x.g, narx == null ? null : String(narx));
        if (r != null) {
          ctx.toast(narx == null ? 'Tanlov olib tashlandi' : 'Saqlandi ✓ — farqli filiallarda xodimga «Narxni tuzating» chiqadi');
          close(); keyin();
        }
      } catch (e) { f.xato((e && e.message) || 'Saqlanmadi'); } finally { band = false; }
    };
    box.append(h('div', {}, h('b', { 'data-asl': '' }, x.nom), x.ishlab ? h('div', { class: 'muted', 'data-asl': '' }, x.ishlab) : null),
      h('div', { class: 'card list', style: 'margin:10px 0' }, ...x.filiallar.map((b) => h('div', { class: 'line' },
        h('span', {}, asl(filNom(fil, b)), h('span', { class: 'muted' }, ' · ' + qoldiqMatn(b.soni, b.dona))), h('b', {}, H.som(b.narx))))),
      chegara ? h('div', { class: 'msg warn' }, '⚖️ Davlat chegarasi: ' + H.som(chegara) + ' (1 quti) — narx shundan oshmasin.') : null,
      h('div', { class: 'muted' }, chegara ? 'Narxni tanlang:' : 'Filiallardagi narxlardan birini tanlang:'),
      h('div', { class: 'row', style: 'flex-wrap:wrap' }, ...narxlar.map((n) => h('button', { class: x.qaror === n ? 'p' : 's', onclick: () => saqla(n) }, H.som(n)))),
      h('div', { class: 'muted', style: 'margin-top:10px' }, 'yoki boshqa narx yozing:'), f.el,
      h('button', { class: 'p', onclick: yozilgan }, 'Saqlash'),
      x.qaror ? h('button', { class: 'link', onclick: () => saqla(null) }, 'Tanlovni olib tashlash') : null,
      h('div', { class: 'muted', style: 'font-size:13px;margin-top:8px' }, 'Narxni Oson\'da filial xodimi o\'zgartiradi — ilova Oson\'ga yozmaydi. Oson\'da tuzatilgach dori ro\'yxatdan o\'zi chiqadi va yangi narx yorlig\'i tayyor bo\'ladi.'));
    f.i.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); yozilgan(); } });
  }, { fokus: false });
}

// ---------- Narx chegarasi — davlat reyestri (20261107210000_dori_reyestr) ----------
const sanaDMY = (d) => (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}/.test(d) ? d.slice(8, 10) + '.' + d.slice(5, 7) + '.' + d.slice(0, 4) : '');
const foizMatn = (f) => String(Number(f) >= 10 ? Math.round(Number(f)) : Number(f)).replace('.', ',');
async function reyestrMosla(ctx, chiz) {
  if (N.moslanmoqda) return;
  N.moslanmoqda = true; chiz();
  try {
    const r = await ctx.amalFon('reyestrMosla');
    if (r != null) ctx.toast('Moslandi ✓ — ' + (r.yuqori || 0) + ' ta dori aniq' + (r.orta ? ', ' + r.orta + ' tasi taxminiy' : ''));
  } finally { N.moslanmoqda = false; nYukla(ctx, chiz, true); chiz(); }
}
function chegaraKarta(m, ctx, fil, chiz) {
  const c = N.c;
  if (!c || !Array.isArray(c.qatorlar)) return;   // eski server yoki xato — bo'lim ko'rinmaydi
  const r = c.reyestr || {};
  const k = h('div', { class: 'card list chegara-karta' }, kartaSarlavha('⚖️ Narx chegarasidan oshgan'),
    h('div', { class: 'muted', style: 'font-size:13px' }, 'Davlat reyestri (' + (r.manba || 'mpa.uz') + (r.sana ? ', ' + sanaDMY(r.sana) : '')
      + ') — retsept dorilarining eng yuqori chakana narxi. Reyestrga aniq moslangan: ' + (c.moslangan || 0) + ' xil dori.'));
  if (!c.qatorlar.length) {
    k.append(h('div', { class: 'muted' }, c.moslangan ? '✓ Moslangan dorilarning hammasi chegaradan oshmagan' : 'Hali hech bir dori reyestrga moslanmagan.'));
  }
  const kor = N.chOchiq ? c.qatorlar : c.qatorlar.slice(0, 10);
  kor.forEach((x) => {
    const ry = x.reyestr || {};
    k.append(h('div', { class: 'item' },
      h('div', { class: 'line', style: 'border:0;padding:0' }, h('b', { 'data-asl': '' }, x.nom), h('b', { class: 'pul-zarar' }, '+' + foizMatn(x.foiz) + '%')),
      h('div', { class: 'muted', style: 'font-size:13px' }, 'Chegara: ', h('b', {}, H.som(x.chegara)), ' (1 quti' + (x.dona ? ' №' + x.dona : '') + ')'
        + (ry.qadoq && x.dona && ry.qadoq !== x.dona ? ' · reyestrda №' + ry.qadoq + ' — ' + H.som(ry.narx) : '')),
      ry.nom ? h('div', { class: 'muted', style: 'font-size:13px', 'data-asl': '' }, 'Reyestr: ' + ry.nom + (ry.ishlab ? ' · ' + ry.ishlab : '')) : null,
      h('div', { class: 'oq-qf-royxat' }, ...(x.filiallar || []).map((b) => h('div', { class: 'oq-qf' }, h('span', { class: 'oq-fil', 'data-asl': '' }, filNom(fil, b)),
        h('b', { class: b.oshgan ? 'yoq' : 'bor' }, H.som(b.narx))))),
      x.qaror != null ? h('div', { class: 'muted' }, 'Tanlangan: ' + H.som(x.qaror) + ' — Oson\'da hali tuzatilmagan') : null,
      h('div', { class: 'row chegara-amal' },
        h('button', { class: 'link', onclick: () => narxOyna(ctx, x, fil, () => nYukla(ctx, chiz, true), Number(x.chegara)) }, 'Narxni tuzatish'),
        h('button', { class: 'link', onclick: async () => {
          if (!(await tasdiqlash('«' + x.nom + '» — reyestrdagi «' + (ry.nom || '') + '» bilan moslik noto\'g\'rimi? Bu dori narx chegarasida boshqa chiqmaydi.'))) return;
          const res = await ctx.amalFon('reyestrRad', x.g);
          if (res != null) { ctx.toast('Olib tashlandi'); nYukla(ctx, chiz, true); }
        } }, 'Moslik noto\'g\'ri'))));
  });
  if (c.qatorlar.length > 10) k.append(h('button', { type: 'button', class: 'oq-yana', onclick: () => { N.chOchiq = !N.chOchiq; chiz(); } }, N.chOchiq ? 'Yig\'ish ▴' : 'Yana ' + (c.qatorlar.length - kor.length) + ' ta ▾'));
  k.append(h('div', { class: 'muted', style: 'font-size:13px' }, 'Shubhali bo\'lsa — pharm.gov.uz da tekshiring. Oson\'ga yangi dori qo\'shilsa — qayta moslang.'),
    h('button', { class: 's', disabled: N.moslanmoqda ? '' : null, onclick: () => reyestrMosla(ctx, chiz) }, N.moslanmoqda ? 'Moslanmoqda…' : 'Reyestrni qayta moslash'));
  m.append(k);
}

export function narxView(m, ctx, fil) {
  const chiz = () => ctx.rerender();
  nYukla(ctx, chiz);
  m.append(h('div', { class: 'muted' }, 'Bitta dori filiallarda har xil narxda turibdi. To\'g\'ri narxni tanlang — farqli filial xodimining bosh sahifasida «🏷 Narxni tuzating» chiqadi, u Oson\'da o\'zgartiradi.'));
  if (!N.j) { m.append(N.xato ? xatoKarta(N.xato, () => { N.xato = null; nYukla(ctx, chiz, true); chiz(); }) : yuklanmoqda()); return; }
  const j = N.j;
  // Audit 10.11 kech: Oson vaqti — 45 daqiqadan eski bo'lsa sariq ogohlantirish (osonVaqtEl; avval faqat vaqt).
  m.append(h('div', { class: 'line', style: 'border:0;padding:0' }, j.vaqt ? osonVaqtEl(j.vaqt) : h('span', {}),
    h('button', { class: 's', onclick: () => { N.xato = null; nYukla(ctx, chiz, true); chiz(); } }, N.yuklanmoqda ? 'Yangilanmoqda…' : 'Yangilash')));
  if (N.xato) m.append(h('div', { class: 'msg warn', role: 'status' }, 'Yangilanmadi: ' + N.xato + ' — ko\'rinib turgani avvalgi ma\'lumot.'));
  if (!j.vaqt) { m.append(h('div', { class: 'card muted' }, 'Oson ma\'lumoti hali kelmagan — aptekadagi kompyuterda kengaytma va Oson ochilgach chiqadi.')); return; }
  // Narx yorliqlari — har filialda narxi o'zgargan, hali chop etilmagan dorilar.
  const y = (N.y && N.y.yorliq) || [];
  m.append(h('div', { class: 'card list' }, kartaSarlavha('🏷 Narx yorliqlari'),
    ...(y.length ? yorliqQatorlari(ctx, fil, y, N, () => nYukla(ctx, chiz, true))
      : [h('div', { class: 'muted' }, 'Hozir yangi yorliq kerak emas. Oson\'da narx o\'zgarsa — shu yerda yig\'iladi va bir tugma bilan chop etish uchun fayl qilib Telegram\'ga yuboriladi.')])));
  chegaraKarta(m, ctx, fil, chiz);   // 07.11: davlat reyestri
  m.append(h('div', { class: 'card' }, h('div', { class: 'line', style: 'border:0;padding:0' }, h('b', {}, j.soni + ' xil dori'), j.katta ? h('b', { class: 'pul-kam' }, j.katta + ' tasida 20%+') : null),
    h('div', { class: 'muted' }, j.soni ? 'filiallarda har xil narxda' + (j.tuzat ? ' · ' + j.tuzat + ' tasida siz tanlagan narx hali Oson\'da qo\'yilmagan' : '')
      : '✓ Hamma dori filiallarda bir xil narxda')));
  if (!j.soni) return;
  m.append(pills([['hammasi', 'Hammasi'], ['katta', '20% dan ko\'p'], ['tanlangan', 'Tanlanganlar']], N.saralash, (v) => { N.saralash = v; N.ochiq = false; chiz(); }, 'Saralash'));
  const rows = j.qatorlar.filter((x) => N.saralash === 'katta' ? x.foiz >= 20 : N.saralash === 'tanlangan' ? x.qaror != null : true);
  const list = h('div', { class: 'card list' });
  if (!rows.length) list.append(h('div', { class: 'muted' }, N.saralash === 'tanlangan' ? 'Hali narx tanlanmagan.' : 'Bunday dori yo\'q.'));
  // Audit 10.11 kech: «Yana» — keyingi 50 tasi shu joyga qo'shiladi (avval qolgani bir yo'la, butun sahifa qayta chizilardi).
  const qatorEl = (x) => {
    const farqli = x.qaror != null ? x.filiallar.filter((b) => Number(b.narx) !== x.qaror) : [];
    return h('div', { class: 'item' },
      h('div', { class: 'line', style: 'border:0;padding:0' }, h('b', { 'data-asl': '' }, x.nom), h('b', { class: x.foiz >= 20 ? 'pul-zarar' : 'pul-kam', style: 'white-space:nowrap' }, '+' + x.foiz + '%')),
      x.ishlab ? h('div', { class: 'muted', style: 'font-size:13px', 'data-asl': '' }, x.ishlab) : null,
      h('div', { class: 'oq-qf-royxat' }, ...x.filiallar.map((b) => h('div', { class: 'oq-qf' }, h('span', { class: 'oq-fil', 'data-asl': '' }, filNom(fil, b)),
        h('b', { class: x.qaror != null && Number(b.narx) !== x.qaror ? 'yoq' : 'bor' }, H.som(b.narx))))),
      x.qaror != null ? h('div', { class: farqli.length ? 'oson-otgan' : 'muted' }, 'Tanlangan: ' + H.som(x.qaror)
        + (farqli.length ? ' · Oson\'da hali tuzatilmagan: ' + farqli.map((b) => filNom(fil, b)).join(', ') : '')) : null,
      h('button', { class: 'link', onclick: () => narxOyna(ctx, x, fil, () => nYukla(ctx, chiz, true)) }, x.qaror != null ? 'Narxni o\'zgartirish' : 'To\'g\'ri narxni tanlash'));
  };
  yanaRoyxat(list, rows, Number(N.ochiq) || KORINADI, qatorEl, (n) => { N.ochiq = n; }, { boshi: KORINADI, yig: chiz });
  m.append(list);
  m.append(h('div', { class: 'muted' }, 'Narx — 1 quti, Oson\'dagi sotuv narxi; faqat qoldig\'i bor filiallar solishtiriladi.'));
}

// ---------- Kassa ↔ Oson (direktor) ----------
function kYukla(ctx, chiz, majbur = false) {
  if (K.yuklanmoqda) return;
  if (!majbur && ((K.jKalit === K.kunlar && K.j) || K.xatoKalit === K.kunlar) && Date.now() - K.vaqt < 60000) return;
  const n = K.kunlar;
  K.yuklanmoqda = ctx.oqi('kassaOson', n)
    .then((j) => { if (!j || !Array.isArray(j.filiallar)) throw new Error('Server javobi tushunarsiz'); K.j = j; K.jKalit = n; K.xato = null; K.xatoKalit = 0; })
      .catch((e) => { K.xato = (e && e.message) || 'Ma\'lumot olinmadi'; K.xatoKalit = n; })
    .finally(() => { K.vaqt = Date.now(); K.yuklanmoqda = null; chiz(); });
}
const HOLAT = {
  kop: ['Oson bo\'yicha ko\'p', 'nz-holat kop'], kiritilmagan: ['Savdo kiritilmagan', 'nz-holat kir'], toliqmas: ['Oson to\'liq o\'qilmagan', 'nz-holat tm'],
  yopiq: ['Savdo bo\'lmadi', 'nz-holat tm'], yopiqda_sotuv: ['«Savdo bo\'lmadi», lekin Oson\'da sotuv bor', 'nz-holat kop'],
  chala: ['Bitta smena kiritilgan', 'nz-holat kir'], yaxshi: ['✓ Mos', 'nz-holat ok']
};
const farqMatn = (o, k) => [(o >= k ? '+' : '−') + H.som(Math.abs(o - k)),
  k > 0 ? h('span', { class: 'nz-foiz' }, (o >= k ? '+' : '−') + Math.round(Math.abs(o - k) / k * 100) + '%') : null];

export function kassaView(m, ctx) {
  const chiz = () => ctx.rerender();
  kYukla(ctx, chiz);
  m.append(h('div', { class: 'muted' }, 'Siz kiritgan kunlik savdo (naqd + karta) va Oson\'da sotilgan dorilar (qoldiq kamayishi × narx) solishtiriladi. '
    + 'Oson odatda kamroq ko\'rsatadi — Oson bo\'yicha KO\'P sotilgan kun tekshirilsin: savdo to\'liq kiritilganmi, kassada kamomad yo\'qmi.'));
  m.append(pills([[7, '7 kun'], [14, '14 kun'], [30, '30 kun']], K.kunlar, (v) => { K.kunlar = Number(v); kYukla(ctx, chiz, true); chiz(); }, 'Davr'));
  if (!K.j || K.jKalit !== K.kunlar) {
    m.append(K.xatoKalit === K.kunlar ? xatoKarta(K.xato, () => { K.xato = null; K.xatoKalit = 0; kYukla(ctx, chiz, true); chiz(); }) : yuklanmoqda('Hisoblanmoqda…'));
    return;
  }
  const j = K.j;
  m.append(h('div', { class: 'line', style: 'border:0;padding:0' }, j.vaqt ? osonVaqtEl(j.vaqt) : h('span', {}),
    h('button', { class: 's', onclick: () => { K.xatoKalit = 0; kYukla(ctx, chiz, true); chiz(); } }, K.yuklanmoqda ? 'Yangilanmoqda…' : 'Yangilash')));
  if (K.xatoKalit === K.kunlar) m.append(h('div', { class: 'msg warn', role: 'status' }, 'Yangilanmadi: ' + K.xato + ' — ko\'rinib turgani avvalgi ma\'lumot.'));
  if (!j.filiallar.length) { m.append(h('div', { class: 'card muted' }, 'Oson filiallari ilovadagi filiallarga bog\'lanmagan — Qoldiq → «Sozlash».')); return; }
  for (const f of j.filiallar) {
    const k = h('div', { class: 'card list' }, h('div', { class: 'line', style: 'border:0;padding:0' }, kartaSarlavha(f.nom, { 'data-asl': '' }),
      f.ogoh ? h('b', { class: 'pul-zarar' }, f.ogoh + ' kun tekshirilsin') : null));
    if (!f.korinadi) {
      k.append(h('div', { class: 'msg warn' }, 'Bu filialda Oson\'da sotuv deyarli ko\'rinmaydi — solishtirib bo\'lmaydi. Sotuv Oson orqali o\'tyaptimi — aptekada tekshiring.'));
    } else if (f.jami.kun > 0) {
      const o = Number(f.jami.oson), kir = Number(f.jami.kiritilgan);
      k.append(h('div', { class: 'nz-jami' }, h('div', {}, h('span', { class: 'muted' }, 'Kiritilgan'), h('b', {}, H.som(kir))),
        h('div', {}, h('span', { class: 'muted' }, 'Oson (~)'), h('b', {}, H.som(o))),
        h('div', {}, h('span', { class: 'muted' }, 'Farq'), h('b', { class: o > kir * 1.1 ? 'nz-farq kop' : 'nz-farq' }, farqMatn(o, kir)))),
        h('div', { class: 'muted', style: 'font-size:13px' }, 'To\'liq ' + f.jami.kun + ' kun bo\'yicha (Oson o\'qilgan va savdo to\'liq kiritilgan kunlar).'
          + (Number(f.jami.reimb) > 0 ? ' Reimbursatsiya dorilari (~' + H.som(f.jami.reimb) + ') bemorlarga Oson\'dan chiqariladi — savdo emas, hisobga olinmadi.' : '')));
    } else {
      k.append(h('div', { class: 'muted' }, 'Hali solishtiradigan kun yo\'q: kun to\'liq bo\'lishi uchun Oson ertasi kuni ham o\'qilishi va savdo kiritilishi kerak'
        + (f.kuzatildi ? ' (Oson sotuvi ' + sana(f.kuzatildi) + ' dan kuzatilmoqda)' : '') + '.'));
    }
    const kunlar = K.ochiq[f.f] ? f.kunlar : f.kunlar.slice(0, 7);
    if (f.korinadi) {
      // Har kun — ikki qator (tor ekranda summa bo'linmasin): sana va holat; kiritilgan va Oson.
      kunlar.forEach((d) => {
        // Savdo kiritilmagan, Oson sotuvi kichik — «✓» emas, «kiritilmagan» (kulrang).
        const [matn, cls] = d.holat === 'yaxshi' && d.kiritilgan == null ? ['Savdo kiritilmagan', 'nz-holat tm'] : HOLAT[d.holat] || ['', 'nz-holat'];
        const ogoh = d.holat === 'kop' || d.holat === 'kiritilmagan' || d.holat === 'yopiqda_sotuv';
        k.append(h('div', { class: 'nz-kun' + (ogoh ? ' nz-ogoh' : '') },
          h('div', { class: 'nz-kun-b' }, h('b', {}, haftaKuni(d.kun) + ', ' + kunMatn(d.kun)),
            h('span', { class: cls }, d.holat === 'kop' ? 'Oson bo\'yicha +' + H.som(d.oson - d.kiritilgan) : matn)),
          h('div', { class: 'nz-kun-s' }, h('span', {}, 'Kiritilgan: ', h('b', {}, d.kiritilgan == null ? '—' : H.som(d.kiritilgan))),
            h('span', {}, 'Oson: ', h('b', {}, d.toliq || d.oson ? '~' + H.som(d.oson) : '—')))));
      });
      if (f.kunlar.length > 7) k.append(h('button', { type: 'button', class: 'oq-yana', onclick: () => { K.ochiq[f.f] = !K.ochiq[f.f]; chiz(); } }, K.ochiq[f.f] ? 'Yig\'ish ▴' : 'Yana ' + (f.kunlar.length - 7) + ' kun ▾'));
    }
    m.append(k);
  }
  m.append(h('div', { class: 'muted' }, 'Oson sotuvi taxminiy: hozirgi narxda; kirim va sotuv bir vaqtda bo\'lsa — kamroq; firmaga qaytarish yoki hisobdan chiqarish — sotuv bo\'lib ko\'rinishi mumkin. '
    + 'Kun Oson ertasi kuni o\'qilgandan keyin to\'liq bo\'ladi. Tungi smena savdosi yopilgan kunga yozilgani uchun kunlar orasida farq bo\'lishi mumkin — jami aniqroq.'));
}

// ---------- Xodim: Bosh sahifadagi karta ----------
function xYukla(ctx, chiz, majbur = false) {
  if (X.yuklanmoqda) return;
  if (!majbur && (X.j || X.xato) && Date.now() - X.vaqt < 120000) return;
  X.yuklanmoqda = ctx.oqi('narxXodim')
    .then((j) => { if (!j || !Array.isArray(j.tuzat)) throw new Error('Server javobi tushunarsiz'); X.j = j; X.xato = null; })
      .catch((e) => { X.xato = (e && e.message) || 'Olinmadi'; })
    .finally(() => { X.vaqt = Date.now(); X.yuklanmoqda = null; chiz(); });
}
// Hech narsa bo'lmasa — null (Bosh sahifada joy egallamaydi).
export function narxXodimKarta(ctx, fil, chiz) {
  xYukla(ctx, chiz);
  const j = X.j;
  if (!j || (!j.tuzat.length && !j.yorliq.length)) return null;
  const k = h('section', { class: 'card list' }, kartaSarlavha(j.tuzat.length ? '🏷 Narxni tuzating' : '🏷 Narx yorliqlari'));
  if (j.tuzat.length) {
    k.append(h('div', { class: 'msg warn' }, 'Direktor narxni o\'zgartirdi — Oson\'da yangilang (' + j.tuzat.length + ' ta). Oson\'da tuzatilgach ro\'yxatdan o\'zi chiqadi.'));
    // Audit 10.11 kech: «hozir» narx — oxirgi Oson ro'yxatidan; eski bo'lsa (server 'vaqt' bersa) — Oson'da allaqachon tuzatilgan bo'lishi mumkin.
    const ve = osonVaqtEl(j.vaqt, { faqatEski: true, izoh: 'Oson\'da allaqachon tuzatgan bo\'lsangiz — ro\'yxat yangilanishini kuting' });
    if (ve) k.append(ve);
    j.tuzat.slice(0, 30).forEach((x) => k.append(h('div', { class: 'item' }, h('b', { 'data-asl': '' }, x.nom),
      h('div', { class: 'line', style: 'border:0;padding:0' }, h('span', { class: 'muted' }, asl(filNom(fil, x)), ' · hozir ' + H.som(x.hozir)), h('b', { class: 'pul-kerak' }, '→ ' + H.som(x.kerak))))));
    if (j.tuzat.length > 30) k.append(h('div', { class: 'muted' }, 'Yana ' + (j.tuzat.length - 30) + ' ta — avval shularni tuzating.'));
  }
  if (j.yorliq.length) {
    k.append(h('div', { class: 'muted' }, 'Narxi o\'zgargan dorilarga yangi yorliq kerak. Fayl Telegram\'ingizga keladi — kompyuterda ochib chop eting.'));
    yorliqQatorlari(ctx, fil, j.yorliq, X, () => xYukla(ctx, chiz, true)).forEach((e) => k.append(e));
  }
  return k;
}

// 07.11 (yangi ko'rinish — Ombor bo'limi): «Narx farqi» kartasidagi son (keshdan; yuklanmagan bo'lsa — fonda). Hali yo'q — null.
// Audit 10.11 kech: xatoda karta abadiy «…» qolardi — holat: true bo'lsa { son, xato, qayta } (kartada «—», bosilsa qayta urinadi).
export function narxFarqSoni(ctx, chiz, holat = false) {
  if (!ctx.server) return null;
  if (!N.j && !N.xato) nYukla(ctx, chiz);
  const son = N.j && Array.isArray(N.j.qatorlar) ? N.j.qatorlar.length : null;
  if (!holat) return son;
  return { son, xato: son == null && !!N.xato && !N.yuklanmoqda, qayta: () => { N.xato = null; nYukla(ctx, chiz, true); chiz(); } };
}
