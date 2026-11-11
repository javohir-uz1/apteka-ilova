// Narx farqi va narx yorliqlari, Kassa ↔ Oson (07.11; foydalanuvchi: "1 2 3 qo'sh"). Ma'lumot — Oson qoldig'i va sotuvi
// (kengaytma har 30 daqiqada yuboradi; ilova Oson'ga hech narsa yozmaydi). Server: 20261107180000_narx_kassa_partiya.
// Direktor: Qoldiq → «🏷 Narx farqi» (filiallarda har xil narx, to'g'ri narxni tanlash, yorliqlar) va «💵 Kassa ↔ Oson».
// Xodim: Bosh → «Narxni tuzating» (direktor tanlagan narx, o'z filiali) va yangi narx yorliqlari.
import * as H from './hisob.mjs';
import { h, input, kartaSarlavha, pills, sana, sheet, tasdiqlash, yordam } from './ui.mjs';
import { kartaFarqSoz, naqdFarqSoz, pulNb } from './kassa.mjs';
import { osonEskimi, osonVaqtEl, qoldiqMatn, yanaRoyxat } from './oson-qoldiq.mjs';

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
// 10.11 kech qayta tuzildi (egasi: "farqni karta yoki naqd ham ajratib ko'rinishi kerak"; "shu ikkala oynani ham tushunarli tartibli
// qilib ber"). Asosiy — Oson KASSA smenalari bo'yicha aniq NAQD va KARTA farqi, kun bo'yicha (20261110234000, 20261110235000):
// filial kartasida ikki katta ko'rsatkich (to'liq kunlar), ostida kunlar (har qatorda «Naqd …» va «Karta …»), kunni bosganda —
// tafsilot (yozilgan savdolar, Oson smenalari, o'tkazma, qarz). Oson qoldig'i bo'yicha taxminiy hisob — faqat Oson kassasi yo'q kunda.
// So'zlar va darajalar «Kassa nazorati» bilan bir xil (kassa.mjs naqdFarqSoz / kartaFarqSoz): «Yozilgan» − «Oson sotdi».
function kYukla(ctx, chiz, majbur = false) {
  if (K.yuklanmoqda) return;
  if (!majbur && ((K.jKalit === K.kunlar && K.j) || K.xatoKalit === K.kunlar) && Date.now() - K.vaqt < 60000) return;
  const n = K.kunlar;
  K.yuklanmoqda = ctx.oqi('kassaOson', n)
    .then((j) => { if (!j || !Array.isArray(j.filiallar)) throw new Error('Server javobi tushunarsiz'); K.j = j; K.jKalit = n; K.xato = null; K.xatoKalit = 0; })
      .catch((e) => { K.xato = (e && e.message) || 'Ma\'lumot olinmadi'; K.xatoKalit = n; })
    .finally(() => { K.vaqt = Date.now(); K.yuklanmoqda = null; chiz(); });
}
// Daraja → klass; to'liq bo'lmagan kunda — kulrang (yakuniy emas, qizil/sariq chalg'itmasin).
const FCLS = { mos: 'nz-f-mos', kam: 'nz-f-kam', ogoh: 'nz-f-ogoh', yoq: 'nz-f-yoq' };
const sozEl = ([t, d], tag = 'b', toliq = true) => h(tag, { class: 'nz-f ' + (toliq ? FCLS[d] : 'nz-f-yoq') }, t);
const naqdEl = (x, cheg, tag, toliq) => sozEl(naqdFarqSoz(x.naqdFarq, cheg), tag, toliq);
const kartaEl = (x, tag, toliq) => sozEl(kartaFarqSoz(x.kKarta, x.oKarta, x.kartaFarq), tag, toliq);
// Kun to'liqmi (jamiga va ajratishga kiradi): Oson smenalari yopilgan, o'qish shu kundan oldin boshlangan, savdo kiritilgan, bitta smena emas.
const kunToliq = (d) => !!d.kassa && d.kassa.ochiq === 0 && !d.kassa.boshi && d.kassa.kiritildi && !d.chala;
const kunSabab = (d) => {
  const x = d.kassa;
  if (!x) return null;
  if (!x.kiritildi) return d.yoq ? '«savdo bo\'lmadi» deb belgilangan' : 'savdo kiritilmagan';
  if (x.ochiq > 0) return 'Oson smenasi hali ochiq';
  if (x.boshi) return 'Oson kassasi shu kundan o\'qilgan';
  if (d.chala) return 'bitta smena kiritilgan';
  return null;
};
// Kun darajasi: 'kam' (qizil — naqd chegaradan katta kam, javob kutayotgan o'tkazma bilan ham), 'ogoh' (sariq — boshqa katta farq,
// Oson'da sotuv bor-u savdo yozilmagan), null — ajratilmaydi.
function kunDaraja(f, d, cheg) {
  const x = d.kassa;
  if (x) {
    if (x.ochiq > 0 || x.boshi) return null;
    // Audit: savdo yozilmagan (yoki «savdo bo'lmadi»), lekin Oson kassasida sotuv bor — ajratiladi (avval jim o'tardi).
    if (!x.kiritildi) return (Number(x.oNaqd) || 0) + (Number(x.oKarta) || 0) >= cheg ? 'ogoh' : null;
    if (d.chala) return null;
    const nf = Number(x.naqdFarq) || 0, kut = Number(x.kutilmoqda) || 0;
    const naqdKatta = Math.abs(nf) > cheg && Math.abs(nf + kut) > cheg;
    if (naqdKatta && nf < 0) return 'kam';
    if (naqdKatta || Math.abs(Number(x.kartaFarq) || 0) > cheg) return 'ogoh';
    return null;
  }
  // Oson kassasi yo'q kun — qoldiq bo'yicha taxminiy holat.
  return f.korinadi && ['kop', 'kiritilmagan', 'yopiqda_sotuv'].includes(d.holat) ? 'ogoh' : null;
}
const kunNomi = (d) => haftaKuni(d.kun) + ', ' + kunMatn(d.kun);
const ikki = (n) => String(n).padStart(2, '0');
// Toshkent vaqti (UTC+5): «09.11 17:08».
const soat = (ms) => { if (!ms) return '…'; const t = new Date(Number(ms) + 5 * 3600000); return ikki(t.getUTCDate()) + '.' + ikki(t.getUTCMonth() + 1) + ' ' + ikki(t.getUTCHours()) + ':' + ikki(t.getUTCMinutes()); };
// Jadval katakchasi — «so'm»siz (sarlavhada bir marta), raqam bo'linmaydi.
const son = (n) => pulNb(n).replace(/\s*so'm$/, '');

export function kassaView(m, ctx) {
  const chiz = () => ctx.rerender();
  kYukla(ctx, chiz);
  m.append(h('div', { class: 'muted' }, 'Har kun siz yozgan savdo Oson kassasi bilan solishtiriladi — NAQD va KARTA alohida. Kunni bosing — tafsilot.'));
  m.append(pills([[7, '7 kun'], [14, '14 kun'], [30, '30 kun']], K.kunlar, (v) => { K.kunlar = Number(v); kYukla(ctx, chiz, true); chiz(); }, 'Davr'));
  if (!K.j || K.jKalit !== K.kunlar) {
    m.append(K.xatoKalit === K.kunlar ? xatoKarta(K.xato, () => { K.xato = null; K.xatoKalit = 0; kYukla(ctx, chiz, true); chiz(); }) : yuklanmoqda('Hisoblanmoqda…'));
    return;
  }
  const j = K.j;
  m.append(h('div', { class: 'nz-yangi' }, (j.vaqt !== undefined && osonVaqtEl(j.vaqt)) || h('span', {}),
    h('button', { type: 'button', class: 's', onclick: () => { K.xatoKalit = 0; kYukla(ctx, chiz, true); chiz(); } }, K.yuklanmoqda ? 'Yangilanmoqda…' : 'Yangilash')));
  if (K.xatoKalit === K.kunlar) m.append(h('div', { class: 'msg warn', role: 'status' }, 'Yangilanmadi: ' + K.xato + ' — ko\'rinib turgani avvalgi ma\'lumot.'));
  if (!j.filiallar.length) { m.append(h('div', { class: 'card muted' }, 'Oson filiallari ilovadagi filiallarga bog\'lanmagan — Qoldiq → «Sozlash».')); return; }
  for (const f of j.filiallar) m.append(filialKarta(ctx, chiz, f, Number(j.jamiChegara) || 0));
  m.append(yordam('Kun — shu kuni yopilgan Oson kassa smenalari va shu kunga yozilgan savdo. Yozilgan naqdga kartaga tushgan o\'tkazma va qarzga berilgan '
    + 'dori ham qo\'shiladi («Kassa nazorati» kabi). «Kam» — Oson sotganidan kam yozilgan (pul yetmasligi mumkin), «ortiqcha» — ko\'p; 1 000 so\'mgacha — mos; '
    + '«⚠» — chegaradan katta. Karta bankka o\'zi tushadi: «yozilmagan» — karta summasi kiritilmagan. Oson smenasi kechasi yopilsa (17:00 → ertasi 09:00), '
    + 'savdo kunlar orasida siljiydi — bir kunlik farq keyingi kunda qaytishi mumkin, shuning uchun yuqoridagi jami aniqroq. To\'liq bo\'lmagan kunlar '
    + '(smena ochiq, savdo kiritilmagan, bitta smena) hisobga kirmaydi. Oson kassasi o\'qilmagan kunlar uchun — Oson qoldig\'i bo\'yicha taxminiy savdo (~).',
  'Qanday hisoblanadi?'));
}

function filialKarta(ctx, chiz, f, jamiCheg) {
  const cheg = Number(f.chegara) || 100000;
  const darajalar = f.kunlar.map((d) => kunDaraja(f, d, cheg));
  const soni = darajalar.filter(Boolean).length;
  const k = h('section', { class: 'card list nz-filial' },
    h('div', { class: 'nz-filial-b' }, kartaSarlavha(f.nom, { 'data-asl': '' }),
      // Qizil va sariq rangsiz ham farqlansin: qizilda «⚠».
      soni ? h('span', { class: 'nz-f ' + (darajalar.includes('kam') ? 'nz-f-kam' : 'nz-f-ogoh') }, (darajalar.includes('kam') ? '⚠ ' : '') + soni + ' kun tekshirilsin') : null));
  const kj = f.kassaJami;
  if (kj && kj.kun > 0) {
    // Jami uchun chegara — sozlamadagi jami chegara (Kassa nazorati bilan bir xil); eski server — 3 × kunlik.
    const tile = (nom, el, kir, oson) => h('div', { class: 'nz-tile' }, h('span', { class: 'nz-tile-n' }, nom), el,
      h('span', { class: 'nz-tile-s' }, 'Yozilgan ' + pulNb(Number(kir))), h('span', { class: 'nz-tile-s' }, 'Oson sotdi ' + pulNb(Number(oson))));
    k.append(h('div', { class: 'nz-tiles' },
      tile('Naqd', sozEl(naqdFarqSoz(Number(kj.naqdFarq), jamiCheg || cheg * 3)), kj.kNaqd, kj.oNaqd),
      tile('Karta', sozEl(kartaFarqSoz(Number(kj.kKarta), Number(kj.oKarta), Number(kj.kartaFarq))), kj.kKarta, kj.oKarta)),
    h('div', { class: 'muted nz-izoh' }, 'Oxirgi ' + kj.kun + ' to\'liq kun. «Kam» — Oson sotganidan kam yozilgan (pul yetmasligi mumkin), «ortiqcha» — ko\'p yozilgan.'));
  } else if (f.kunlar.some((d) => d.kassa)) {
    k.append(h('div', { class: 'muted nz-izoh' }, 'To\'liq kun hali yo\'q (smena ochiq, savdo kiritilmagan yoki bitta smena) — kunlarga qarang.'));
  } else {
    k.append(h('div', { class: 'muted nz-izoh' }, 'Bu davrda Oson kassasi ma\'lumoti yo\'q — faqat qoldiq bo\'yicha taxminiy (~).'));
  }
  const korsat = f.kunlar.map((d, i) => [d, darajalar[i]]).filter(([d]) => d.kassa || f.korinadi);
  const kunlar = K.ochiq[f.f] ? korsat : korsat.slice(0, 7);
  kunlar.forEach(([d, dar]) => k.append(kunQator(f, d, cheg, dar)));
  if (korsat.length > 7) k.append(h('button', { type: 'button', class: 'oq-yana', onclick: () => { K.ochiq[f.f] = !K.ochiq[f.f]; chiz(); } }, K.ochiq[f.f] ? 'Yig\'ish ▴' : 'Yana ' + (korsat.length - 7) + ' kun ▾'));
  if (!korsat.length) k.append(h('div', { class: 'msg warn' }, 'Bu filialda Oson qoldig\'idan sotuv deyarli ko\'rinmaydi va Oson kassasi o\'qilmagan — solishtirib bo\'lmaydi.'));
  return k;
}

const TAXMIN = { kop: 'Oson bo\'yicha ko\'p', kiritilmagan: 'savdo kiritilmagan', toliqmas: 'Oson to\'liq o\'qilmagan', yopiq: 'savdo bo\'lmadi',
  yopiqda_sotuv: '«savdo bo\'lmadi», lekin Oson\'da sotuv bor', chala: 'bitta smena kiritilgan', yaxshi: 'mos' };

// O'tkazma javob kutyapti va u «tushdi» bo'lsa naqd farq chegaradan kichik — qizil emas (kunDaraja ham ajratmaydi).
const kutKechirim = (x, cheg) => !!x && x.kutilmoqda > 0 && Math.abs((Number(x.naqdFarq) || 0) + Number(x.kutilmoqda)) <= cheg;

function kunQator(f, d, cheg, dar) {
  const x = d.kassa;
  const toliq = kunToliq(d);
  const satr = [];
  const kut = kutKechirim(x, cheg);
  if (x && x.kiritildi) {
    satr.push(h('span', { class: 'nz-kq' }, h('span', { class: 'nz-kq-n' }, 'Naqd'), naqdEl(x, kut ? Infinity : cheg, 'b', toliq)),
      h('span', { class: 'nz-kq' }, h('span', { class: 'nz-kq-n' }, 'Karta'), kartaEl(x, 'b', toliq)));
  } else if (x) {
    satr.push(h('span', { class: 'nz-kq' }, 'Oson sotdi: naqd ' + pulNb(x.oNaqd) + ', karta ' + pulNb(x.oKarta)));
  } else {
    // Oson kassasi yo'q kun — taxminiy (qoldiq kamayishi × narx).
    satr.push(h('span', { class: 'nz-kq nz-taxmin' }, 'Yozilgan ' + (d.kiritilgan == null ? '—' : pulNb(d.kiritilgan)) + ' · Oson ~'
      + (d.toliq || d.oson ? pulNb(d.oson) : '—')));
  }
  const sabab = x ? (kunSabab(d) || (kut ? (Number(x.ruxsatQarz) >= Number(x.kutilmoqda) ? 'ruxsat kutayotgan qarz bor' : 'javob kutayotgan o\'tkazma bor') : null)) : (TAXMIN[d.holat] ? 'taxminiy: ' + (d.holat === 'kop' ? 'Oson\'da +' + pulNb(d.oson - (d.kiritilgan || 0)) : TAXMIN[d.holat]) : null);
  return h('button', { type: 'button', class: 'nz-kun2' + (dar ? ' nz-' + dar : ''), onclick: () => kunOyna(f, d, cheg) },
    h('span', { class: 'nz-kun2-b' }, h('b', {}, kunNomi(d)), sabab ? h('span', { class: 'nz-sabab' }, sabab) : null,
      dar ? h('span', { class: 'nz-teg nz-teg-' + dar }, dar === 'kam' ? '⚠ naqd kam' : 'tekshiring') : null),
    h('span', { class: 'nz-kun2-s' }, ...satr), h('span', { class: 'yashirin' }, ' — tafsilot'), h('span', { class: 'nz-chev', 'aria-hidden': 'true' }, '›'));
}

const SMENA_NOM = { kunlik: 'butun kun', kunduzgi: 'kunduzgi', tungi: 'tungi' };
// a — matn yoki tugunlar massivi (bir daraja; h() ichma-ich massivni yoymaydi).
const qator3 = (a, b, c, cls = '') => h('div', { class: 'nz-t3 ' + cls }, h('span', {}, ...(Array.isArray(a) ? a : [a])), h('span', {}, b), h('span', {}, c));

function kunOyna(f, d, cheg) {
  sheet(kunNomi(d), (box) => {
    const x = d.kassa;
    box.append(h('div', { class: 'nz-oyna-f' }, asl(f.nom)));
    if (x) {
      const sabab = kunSabab(d);
      const toliq = kunToliq(d);
      if (sabab) box.append(h('div', { class: 'msg warn' }, 'To\'liq emas: ' + sabab + ' — hisobga kirmaydi.'));
      box.append(h('div', { class: 'nz-t3 nz-t3-b' }, h('span', {}), h('span', {}, 'Naqd, so\'m'), h('span', {}, 'Karta, so\'m')),
        qator3('Yozilgan', x.kiritildi ? son(x.kNaqd + x.otkazma + x.qarz) : '—', x.kiritildi ? son(x.kKarta) : '—'),
        qator3('Oson sotdi', son(x.oNaqd), son(x.oKarta)),
        h('div', { class: 'nz-t3 nz-t3-f' }, h('span', {}, 'Farq'), naqdEl(x, kutKechirim(x, cheg) ? Infinity : cheg, 'span', toliq), kartaEl(x, 'span', toliq)));
      // B6 №4: Yozilgan naqd = kassadan + kartaga (savdoga bog'langan o'tkazma ham — u kNaqd ichida edi) + qarzga.
      // Server bog'langan o'tkazma summasini bersa (otkazmaBogli) — ajratiladi; eski server — avvalgidek faqat qo'shilganlar.
      const bogli = Number(x.otkazmaBogli ?? 0) || 0;
      const kartaga = (Number(x.otkazma) || 0) + bogli, qarzga = Number(x.qarz) || 0;
      if (x.kiritildi && x.otkazmaBogli !== undefined && (kartaga > 0 || qarzga > 0)) {
        box.append(h('div', { class: 'muted nz-tarkib' }, 'Yozilgan naqd = kassadan ' + pulNb((Number(x.kNaqd) || 0) - bogli)
          + (kartaga > 0 ? ' + kartaga ' + pulNb(kartaga) : '') + (qarzga > 0 ? ' + qarzga ' + pulNb(qarzga) : '') + '.'));
      } else {
        const qosh = [];
        if (x.otkazma > 0) qosh.push('kartaga tushgan o\'tkazma ' + pulNb(x.otkazma));
        if (x.qarz > 0) qosh.push('qarzga berilgan ' + pulNb(x.qarz));
        if (qosh.length) box.append(h('div', { class: 'muted' }, 'Yozilgan naqdga qo\'shildi: ' + qosh.join(', ') + '.'));
      }
      // Audit 11.11: kutilmoqda = javob kutayotgan o'tkazma + ruxsat kutayotgan qarz (server ruxsatQarz) — alohida yoziladi.
      const rq = Math.max(0, Number(x.ruxsatQarz) || 0), ko = Math.max(0, (Number(x.kutilmoqda) || 0) - rq);
      if (ko > 0) box.append(h('div', { class: 'msg warn' }, 'Javob kutayotgan o\'tkazma ' + pulNb(ko) + ' — bosh sahifada «Tushdi» bo\'lsa naqdga qo\'shiladi.'));
      if (rq > 0) box.append(h('div', { class: 'msg warn' }, 'Ruxsat kutayotgan qarz ' + pulNb(rq) + ' — direktor ruxsat bersa, «qarzga» qo\'shiladi.'));
      box.append(h('h3', { class: 'nz-h3' }, 'Yozilgan savdo'));
      const sm = Array.isArray(x.smenalar) ? x.smenalar : null;
      // Audit: ro'yxat kelmagan (eski server) — «kiritilmagan» deb yolg'on aytilmaydi.
      if (!x.kiritildi) box.append(h('div', { class: 'muted' }, 'Bu kunga savdo kiritilmagan.'));
      else if (sm) sm.forEach((s) => box.append(qator3([SMENA_NOM[s.nom] || s.nom, ...(s.ism ? [' · ', asl(s.ism)] : [])], son(s.naqd), son(s.karta))));
      const os = Array.isArray(x.osonSmenalar) ? x.osonSmenalar : [];
      if (os.length) {
        box.append(h('h3', { class: 'nz-h3' }, 'Oson kassa smenalari'));
        os.forEach((o) => box.append(qator3(soat(o.och) + ' → ' + (o.yop ? soat(o.yop) : 'ochiq — hisobga kirmaydi'), son(o.naqd), son(o.karta),
          o.yop ? '' : 'nz-t3-ochiq')));
      }
    } else {
      box.append(h('div', { class: 'msg warn' }, 'Bu kun uchun Oson kassasi ma\'lumoti yo\'q (kassa 06.11 dan o\'qilmoqda).'));
    }
    if (d.kiritilgan != null || d.oson) {
      box.append(h('div', { class: 'muted nz-izoh' }, 'Taxminiy (Oson qoldig\'i bo\'yicha): yozilgan ' + (d.kiritilgan == null ? '—' : pulNb(d.kiritilgan))
        + ', Oson ~' + pulNb(d.oson) + (d.reimb ? ' (reimbursatsiya ~' + pulNb(d.reimb) + ' hisobga olinmadi)' : '') + '.'));
    }
  });
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
  // Audit 10.11 (A4 №3): 60 s dan eski bo'lsa ham fonda yangilanadi (nYukla o'zi 60 s ichida qayta so'ramaydi; xatodan keyin ham).
  if (!N.j && !N.xato) nYukla(ctx, chiz);
  else if (N.j && !N.yuklanmoqda && Date.now() - N.vaqt > 60000) nYukla(ctx, chiz);
  const son = N.j && Array.isArray(N.j.qatorlar) ? N.j.qatorlar.length : null;
  if (!holat) return son;
  return { son, eski: !!N.j && N.j.vaqt !== undefined && osonEskimi(N.j.vaqt), xato: son == null && !!N.xato && !N.yuklanmoqda, qayta: () => { N.xato = null; nYukla(ctx, chiz, true); chiz(); } };
}
