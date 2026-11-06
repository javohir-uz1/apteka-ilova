// Narx farqi va narx yorliqlari, Kassa ↔ Oson (07.11; foydalanuvchi: "1 2 3 qo'sh"). Ma'lumot — Oson qoldig'i va sotuvi
// (kengaytma har 30 daqiqada yuboradi; ilova Oson'ga hech narsa yozmaydi). Server: 20261107180000_narx_kassa_partiya.
// Direktor: Qoldiq → «🏷 Narx farqi» (filiallarda har xil narx, to'g'ri narxni tanlash, yorliqlar) va «💵 Kassa ↔ Oson».
// Xodim: Bosh → «Narxni tuzating» (direktor tanlagan narx, o'z filiali) va yangi narx yorliqlari.
import * as H from './hisob.mjs';
import { h, input, kartaSarlavha, pills, sana, sheet, tasdiqlash, vaqt } from './ui.mjs';
import { qoldiqMatn } from './oson-qoldiq.mjs';

const NB = () => ({ j: null, y: null, vaqt: 0, yuklanmoqda: null, xato: null, saralash: 'hammasi', ochiq: false, yuborilmoqda: '' });
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

// Yorliqlarni Telegram'ga yuborish (direktor ham, xodim ham): server HTML fayl qilib so'raganning o'ziga yuboradi.
async function yorliqYubor(ctx, holat, b, keyin) {
  if (holat.yuborilmoqda) return;
  holat.yuborilmoqda = b; ctx.rerender();
  try {
    const r = await ctx.amalFon('narxYorliq', b);
    if (r != null) ctx.toast('Yorliqlar Telegram\'ga yuborildi ✓ — kompyuterda oching va chop eting');
  } finally { holat.yuborilmoqda = ''; keyin(); }
}
function yorliqQatorlari(ctx, fil, yorliq, holat, keyin) {
  return yorliq.map((y) => h('div', { class: 'line' }, h('span', {}, asl(filNom(fil, y)), ': ' + y.soni + ' ta yangi narx'),
    h('button', { class: 's', disabled: holat.yuborilmoqda ? '' : null, onclick: () => yorliqYubor(ctx, holat, y.b, keyin) },
      holat.yuborilmoqda === y.b ? 'Yuborilmoqda…' : 'Telegram\'ga yuborish')));
}

// ---------- Narx farqi (direktor) ----------
function nYukla(ctx, chiz, majbur = false) {
  if (N.yuklanmoqda) return;
  if (!majbur && (N.j || N.xato) && Date.now() - N.vaqt < 60000) return;
  N.yuklanmoqda = Promise.all([ctx.oqi('narxFarq'), ctx.oqi('narxXodim').catch(() => null)])
    .then(([j, y]) => { if (!j || !Array.isArray(j.qatorlar)) throw new Error('Server javobi tushunarsiz'); N.j = j; N.y = y; N.xato = null; },
      (e) => { N.xato = (e && e.message) || 'Ma\'lumot olinmadi'; })
    .finally(() => { N.vaqt = Date.now(); N.yuklanmoqda = null; chiz(); });
}

// To'g'ri narxni tanlash: filiallardagi narxlardan biri yoki boshqa summa; tanlov olib tashlanishi mumkin.
function narxOyna(ctx, x, fil, keyin) {
  sheet('To\'g\'ri narx', (box, close) => {
    const narxlar = [...new Set(x.filiallar.map((f) => Number(f.narx)))].sort((a, b) => b - a);
    const f = input('Narx, so\'m (1 quti)', { placeholder: H.som(narxlar[0] || 0), enterkeyhint: 'done' });
    if (x.qaror) { f.qiymat(String(x.qaror)); f.i.defaultValue = f.i.value; }
    let band = false;
    // Yozilgan matn: bo'sh yoki noto'g'ri — xato (null — faqat «Tanlovni olib tashlash»dan; noto'g'ri yozuv tanlovni o'chirmasin).
    // Filiallardagi narxdan 2 baravar ko'p yoki yarmidan kam — so'raladi (ortiqcha nol: 130 000 o'rniga 13 000).
    const yozilgan = async () => {
      const n = H.pul(f.i.value);
      if (!(n > 0)) { f.xato('Narxni yozing — masalan: 25 000'); return; }
      if ((n > 2 * narxlar[0] || n < 0.5 * narxlar[narxlar.length - 1])
        && !(await tasdiqlash(H.som(n) + ' — filiallardagi narxdan ancha farq qiladi (' + narxlar.map(H.som).join(', ') + '). To\'g\'rimi?'))) return;
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
      h('div', { class: 'muted' }, 'Filiallardagi narxlardan birini tanlang:'),
      h('div', { class: 'row', style: 'flex-wrap:wrap' }, ...narxlar.map((n) => h('button', { class: x.qaror === n ? 'p' : 's', onclick: () => saqla(n) }, H.som(n)))),
      h('div', { class: 'muted', style: 'margin-top:10px' }, 'yoki boshqa narx yozing:'), f.el,
      h('button', { class: 'p', onclick: yozilgan }, 'Saqlash'),
      x.qaror ? h('button', { class: 'link', onclick: () => saqla(null) }, 'Tanlovni olib tashlash') : null,
      h('div', { class: 'muted', style: 'font-size:13px;margin-top:8px' }, 'Narxni Oson\'da filial xodimi o\'zgartiradi — ilova Oson\'ga yozmaydi. Oson\'da tuzatilgach dori ro\'yxatdan o\'zi chiqadi va yangi narx yorlig\'i tayyor bo\'ladi.'));
    f.i.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); yozilgan(); } });
  }, { fokus: false });
}

export function narxView(m, ctx, fil) {
  const chiz = () => ctx.rerender();
  nYukla(ctx, chiz);
  m.append(h('div', { class: 'muted' }, 'Bitta dori filiallarda har xil narxda turibdi. To\'g\'ri narxni tanlang — farqli filial xodimining bosh sahifasida «🏷 Narxni tuzating» chiqadi, u Oson\'da o\'zgartiradi.'));
  if (!N.j) { m.append(N.xato ? xatoKarta(N.xato, () => { N.xato = null; nYukla(ctx, chiz, true); chiz(); }) : yuklanmoqda()); return; }
  const j = N.j;
  m.append(h('div', { class: 'line', style: 'border:0;padding:0' }, h('span', { class: 'muted' }, j.vaqt ? 'Oson · ' + sana(j.vaqt) + ' ' + vaqt(j.vaqt) : ''),
    h('button', { class: 's', onclick: () => { N.xato = null; nYukla(ctx, chiz, true); chiz(); } }, N.yuklanmoqda ? 'Yangilanmoqda…' : 'Yangilash')));
  if (N.xato) m.append(h('div', { class: 'msg warn', role: 'status' }, 'Yangilanmadi: ' + N.xato + ' — ko\'rinib turgani avvalgi ma\'lumot.'));
  if (!j.vaqt) { m.append(h('div', { class: 'card muted' }, 'Oson ma\'lumoti hali kelmagan — aptekadagi kompyuterda kengaytma va Oson ochilgach chiqadi.')); return; }
  // Narx yorliqlari — har filialda narxi o'zgargan, hali chop etilmagan dorilar.
  const y = (N.y && N.y.yorliq) || [];
  m.append(h('div', { class: 'card list' }, kartaSarlavha('🏷 Narx yorliqlari'),
    ...(y.length ? yorliqQatorlari(ctx, fil, y, N, () => nYukla(ctx, chiz, true))
      : [h('div', { class: 'muted' }, 'Hozir yangi yorliq kerak emas. Oson\'da narx o\'zgarsa — shu yerda yig\'iladi va bir tugma bilan chop etish uchun fayl qilib Telegram\'ga yuboriladi.')])));
  m.append(h('div', { class: 'card' }, h('div', { class: 'line', style: 'border:0;padding:0' }, h('b', {}, j.soni + ' xil dori'), j.katta ? h('b', { class: 'pul-kam' }, j.katta + ' tasida 20%+') : null),
    h('div', { class: 'muted' }, j.soni ? 'filiallarda har xil narxda' + (j.tuzat ? ' · ' + j.tuzat + ' tasida siz tanlagan narx hali Oson\'da qo\'yilmagan' : '')
      : '✓ Hamma dori filiallarda bir xil narxda')));
  if (!j.soni) return;
  m.append(pills([['hammasi', 'Hammasi'], ['katta', '20% dan ko\'p'], ['tanlangan', 'Tanlanganlar']], N.saralash, (v) => { N.saralash = v; N.ochiq = false; chiz(); }, 'Saralash'));
  const rows = j.qatorlar.filter((x) => N.saralash === 'katta' ? x.foiz >= 20 : N.saralash === 'tanlangan' ? x.qaror != null : true);
  const kor = N.ochiq ? rows : rows.slice(0, KORINADI);
  const list = h('div', { class: 'card list' });
  if (!rows.length) list.append(h('div', { class: 'muted' }, N.saralash === 'tanlangan' ? 'Hali narx tanlanmagan.' : 'Bunday dori yo\'q.'));
  kor.forEach((x) => {
    const farqli = x.qaror != null ? x.filiallar.filter((b) => Number(b.narx) !== x.qaror) : [];
    list.append(h('div', { class: 'item' },
      h('div', { class: 'line', style: 'border:0;padding:0' }, h('b', { 'data-asl': '' }, x.nom), h('b', { class: x.foiz >= 20 ? 'pul-zarar' : 'pul-kam', style: 'white-space:nowrap' }, '+' + x.foiz + '%')),
      x.ishlab ? h('div', { class: 'muted', style: 'font-size:13px', 'data-asl': '' }, x.ishlab) : null,
      h('div', { class: 'oq-qf-royxat' }, ...x.filiallar.map((b) => h('div', { class: 'oq-qf' }, h('span', { class: 'oq-fil', 'data-asl': '' }, filNom(fil, b)),
        h('b', { class: x.qaror != null && Number(b.narx) !== x.qaror ? 'yoq' : 'bor' }, H.som(b.narx))))),
      x.qaror != null ? h('div', { class: farqli.length ? 'oson-otgan' : 'muted' }, 'Tanlangan: ' + H.som(x.qaror)
        + (farqli.length ? ' · Oson\'da hali tuzatilmagan: ' + farqli.map((b) => filNom(fil, b)).join(', ') : '')) : null,
      h('button', { class: 'link', onclick: () => narxOyna(ctx, x, fil, () => nYukla(ctx, chiz, true)) }, x.qaror != null ? 'Narxni o\'zgartirish' : 'To\'g\'ri narxni tanlash')));
  });
  if (rows.length > KORINADI) list.append(h('button', { type: 'button', class: 'oq-yana', onclick: () => { N.ochiq = !N.ochiq; chiz(); } }, N.ochiq ? 'Yig\'ish ▴' : 'Yana ' + (rows.length - kor.length) + ' ta ▾'));
  m.append(list);
  m.append(h('div', { class: 'muted' }, 'Narx — 1 quti, Oson\'dagi sotuv narxi; faqat qoldig\'i bor filiallar solishtiriladi.'));
}

// ---------- Kassa ↔ Oson (direktor) ----------
function kYukla(ctx, chiz, majbur = false) {
  if (K.yuklanmoqda) return;
  if (!majbur && ((K.jKalit === K.kunlar && K.j) || K.xatoKalit === K.kunlar) && Date.now() - K.vaqt < 60000) return;
  const n = K.kunlar;
  K.yuklanmoqda = ctx.oqi('kassaOson', n)
    .then((j) => { if (!j || !Array.isArray(j.filiallar)) throw new Error('Server javobi tushunarsiz'); K.j = j; K.jKalit = n; K.xato = null; K.xatoKalit = 0; },
      (e) => { K.xato = (e && e.message) || 'Ma\'lumot olinmadi'; K.xatoKalit = n; })
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
  m.append(h('div', { class: 'line', style: 'border:0;padding:0' }, h('span', { class: 'muted' }, j.vaqt ? 'Oson · ' + sana(j.vaqt) + ' ' + vaqt(j.vaqt) : ''),
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
    .then((j) => { if (!j || !Array.isArray(j.tuzat)) throw new Error('Server javobi tushunarsiz'); X.j = j; X.xato = null; },
      (e) => { X.xato = (e && e.message) || 'Olinmadi'; })
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
