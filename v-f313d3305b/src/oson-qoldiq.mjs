// Defektura → «Oson qoldig'i» (02.11; foydalanuvchi: "analgin 1 ta qolgan bo'lsa, sotib tugatsak Oson'da yo'qolib
// qoladi — nima tugaganini bilmay qolyapmiz"; "Mini App'da ko'rinishi kerak"; keyin "qo'sh tavsiyangni"). Ma'lumotni aptekadagi
// kompyuterdagi kengaytma Oson admin'dan oladi (har 30 daqiqada, Oson ochiq bo'lsa). Uch ko'rinish:
// - «Tugayapti»: server oldingi ro'yxatlar bilan solishtiradi — ketma-ket 2 ro'yxatda yo'q bo'lsa «Tugadi», oz qolgani «Kam qoldi»
//   (Oson minimumi yoki direktor chegarasi); boshqa filialda bo'lsa — «ko'chirsa bo'ladi»; «+ Defekturaga», «Kerak emas» (direktor);
// - «Muddati yaqin»: 1 / 3 / 6 oy ichida muddati tugaydigan (yoki o'tgan) dorilar, eng yaqin partiya soni bilan;
// - «Qaysi filialda bor?»: nom bo'yicha qidiruv — har filialdagi soni va Oson'dagi sotuv narxi (xodim Narxlar'ida ham).
// Shubhali ro'yxatni server qabul qilmaydi — sababi shu yerda, direktor «Baribir qabul qilish» bilan o'tkazadi. Faqat serverda.
// Audit 02.11: fondagi yangilanish faqat ma'lumot o'zgarsa va qidiruv ochiq bo'lmasa qayta chizadi (klaviatura yopilmasin);
// majburiy yangilash ketayotgan so'rovdan keyin yana bir bor; nomlar (dori, firma, ishlab chiqaruvchi, filial) Кирилл'ga o'tmaydi.
import * as H from './hisob.mjs';
import { h, input, kartaSarlavha, pills, royxatHarakat, sheet, sana, tasdiqlash, vaqt } from './ui.mjs';
import { defNarxQator, firmalarOl } from './firma.mjs';
import { skanerTugma } from './shtrix-skan.mjs';
// 07.11 tun: hisobdan chiqarish / firmaga qaytarish (chiqarish.mjs bu fayldan qoldiqMatn oladi — aylanma import faqat chaqiruvda ishlatiladi).
import { chiqarishOyna, chiqarishRuxsat, chiqarishTugma } from './chiqarish.mjs';
import { ozFilialmi, sorashOch } from './filial-sorov.mjs';

const BOSH = () => ({ j: null, vaqt: 0, yuklanmoqda: null, keyin: false, xato: null, filial: '', ochiq: {}, tartib: {}, rejim: 'tugadi', defda: new Map(),
  muddat: { oy: 3, j: null, vaqt: 0, yuklanmoqda: null, xato: null }, otgan: { j: null, vaqt: 0, yuklanmoqda: null, ochiq: false }, qidir: { soz: '', jSoz: null, j: null, xato: null, taymer: 0, avlod: 0, chiz: null } });
const O = BOSH();
const KORINADI = 12;   // har bo'limda boshida nechta qator (qolgani «Yana N ta»)

// ---------- Eskirgan Oson belgisi (audit 10.11 kech) ----------
// Kengaytma har 30 daqiqada yuboradi — 45 daqiqadan eski ro'yxat «eski» (avval ekranlarda har xil edi: 2 soat, 26 soat, umuman yo'q).
// Hamma Oson ekranlari shu yordamchidan foydalanadi; server (oson_muddati_otgan 'eski') ham 45 daqiqa.
export const OSON_ESKI_MS = 45 * 60000;
const ESKI_MS = OSON_ESKI_MS;   // ro'yxat yoki filial — ogohlantirish
const vaqtMs = (v) => (typeof v === 'number' ? v : typeof v === 'string' && v ? (/^\d+$/.test(v) ? Number(v) : Date.parse(v)) : NaN);
// true — vaqt yo'q (ma'lumot kelmagan) yoki 45 daqiqadan eski.
export function osonEskimi(v) { const t = vaqtMs(v); return !(t > 0) || Date.now() - t > OSON_ESKI_MS; }
export const oldinMatn = (ms) => {
  const d = Math.max(1, Math.round(ms / 60000));
  if (d < 60) return d + ' daqiqa';
  const s = Math.floor(d / 60);
  return s < 48 ? s + ' soat' : Math.floor(s / 24) + ' kun';
};
// Oson vaqti: yangi — «Oson · 10.11 14:30» (kulrang); eski — sariq «⚠ Oson 2 soat oldin yangilangan (…) — kompyuterda Oson admin'ni
// oching»; vaqt null — «hali kelmagan». v === undefined (server bu ekranga vaqt bermaydi) — null.
// o.faqatEski — yangi bo'lsa hech narsa; o.qoshimcha — vaqt yonida (masalan kompyuter nomi); o.izoh — eski bo'lsa o'rniga boshqa maslahat.
export function osonVaqtEl(v, o = {}) {
  if (v === undefined) return null;
  const t = vaqtMs(v);
  const maslahat = o.izoh != null ? o.izoh : 'aptekadagi kompyuterda Oson admin\'ni oching';
  if (!(t > 0)) return h('div', { class: 'oson-vaqt eski', role: 'status' }, '⚠ Oson ma\'lumoti hali kelmagan' + (maslahat ? ' — ' + maslahat : ''));
  const eski = Date.now() - t > OSON_ESKI_MS;
  if (!eski && o.faqatEski) return null;
  const vq = sana(t) + ' ' + vaqt(t);
  const el = eski
    ? h('div', { class: 'oson-vaqt eski', role: 'status' }, '⚠ Oson ' + oldinMatn(Date.now() - t) + ' oldin yangilangan (' + vq + ')' + (maslahat ? ' — ' + maslahat : ''))
    : h('div', { class: 'oson-vaqt muted' }, 'Oson · ' + vq);
  if (o.qoshimcha) el.append(' · ', o.qoshimcha);
  return el;
}
const KOL = typeof Intl !== 'undefined' && Intl.Collator ? new Intl.Collator('ru', { sensitivity: 'base', numeric: true }) : null;
const nomSol = (a, b) => (KOL ? KOL.compare(a, b) : a.localeCompare(b, 'ru', { sensitivity: 'base', numeric: true }));
// Saralangan ro'yxatlar keshi (audit 10.11 kech: har chizishda 3 500 qatorni filtr + localeCompare qilardi). O.j almashsa — tozalanadi;
// O.j.qatorlar joyida o'zgartirilsa (Kerak emas) — keshUnut().
const KESH = { j: null, m: new Map() };
function kesh(kalit, fn) {
  if (KESH.j !== O.j) { KESH.j = O.j; KESH.m = new Map(); }
  if (!KESH.m.has(kalit)) KESH.m.set(kalit, fn());
  return KESH.m.get(kalit);
}
const keshUnut = () => { KESH.j = null; };
// «Yana N ta» bosqichma-bosqich (audit 10.11 kech: qolganini bir yo'la chizardi): ro — konteyner, list — hamma qatorlar, n0 — hozir
// ko'rsatiladigani, qatorEl(x) — qator; bosilsa keyingi 50 tasi shu joyga qo'shiladi (ekran qayta chizilmaydi), saqla(n) — holatga.
// Hammasi ochilgach — «Yig'ish ▴» (o.yig — qayta chizish).
export function yanaRoyxat(ro, list, n0, qatorEl, saqla, o = {}) {
  const qadam = o.qadam || 50, boshi = o.boshi || n0;
  let n = Math.min(Math.max(n0, boshi), list.length);
  list.slice(0, n).forEach((x) => ro.append(qatorEl(x)));
  if (list.length <= boshi) return null;
  const t = h('button', { type: 'button', class: o.cls || 'oq-yana' });
  const yoz = () => {
    const q = list.length - n;
    t.textContent = q > 0 ? 'Yana ' + Math.min(qadam, q) + ' ta ▾' + (q > qadam ? ' (qoldi ' + q + ')' : '') : 'Yig\'ish ▴';
  };
  t.addEventListener('click', () => {
    if (n >= list.length) { saqla(boshi); if (o.yig) o.yig(); return; }
    const frag = document.createDocumentFragment();
    list.slice(n, n + qadam).forEach((x) => frag.append(qatorEl(x)));
    t.before(frag);
    n = Math.min(list.length, n + qadam);
    saqla(n);
    yoz();
  });
  yoz();
  ro.append(t);
  return t;
}

// Asosiy ro'yxat (1 daqiqa eslab qolinadi). majbur — amal qilingandan keyin: ketayotgan so'rov tugagach yana bir bor olinadi.
function yukla(ctx, majbur = false) {
  if (O.yuklanmoqda) { if (majbur) O.keyin = true; return O.yuklanmoqda; }
  if (!majbur && O.j && Date.now() - O.vaqt < 60000) return Promise.resolve(O.j);
  O.yuklanmoqda = ctx.oqi('osonTugayapti')
    .then((j) => { if (!j || !Array.isArray(j.qatorlar)) throw new Error('Server javobi tushunarsiz'); O.j = j; O.xato = null; return j; },
      (e) => { O.xato = (e && e.message) || 'Ro\'yxat olinmadi'; })
    .catch((e) => { O.xato = (e && e.message) || 'Ro\'yxat olinmadi'; })
    .finally(() => { O.vaqt = Date.now(); O.yuklanmoqda = null; });
  return O.yuklanmoqda.then((r) => { if (O.keyin) { O.keyin = false; return yukla(ctx, true); } return r; });
}
function muddatYukla(ctx, majbur = false) {
  const M = O.muddat;
  if (M.yuklanmoqda && M.yuklanmoqdaOy === M.oy) return M.yuklanmoqda;
  if (!majbur && M.j && M.j.oy === M.oy && Date.now() - M.vaqt < 60000) return Promise.resolve(M.j);
  // Natija va xato faqat hozir tanlangan oy uchun yoziladi (audit 03.11: 1 oy so'rovi xatosi 3 oyda ko'rinardi).
  const oy = M.oy;
  const p = ctx.oqi('osonMuddat', oy)
    .then((q) => { if (!Array.isArray(q)) throw new Error('Server javobi tushunarsiz'); if (M.oy === oy) { M.j = { oy, q }; M.xato = null; } })
    .catch((e) => { if (M.oy === oy) M.xato = (e && e.message) || 'Ro\'yxat olinmadi'; })
    .finally(() => { if (M.yuklanmoqda === p) { M.vaqt = Date.now(); M.yuklanmoqda = null; } });
  M.yuklanmoqda = p; M.yuklanmoqdaOy = oy;
  return p;
}

// Quti soni: 1 / 0,5 (dona sotilgan) — ortiqcha nolsiz.
const soniMatn = (s) => String(Math.round(Number(s) * 100) / 100).replace('.', ',');
// Qoldiq quti va dona bilan (02.11, foydalanuvchi: "0.05 qoldi degani nima u"): Oson qutini beradi, dona sotilsa — kasr.
// Qutidagi dona soni ma'lum bo'lsa: 0,05 × 60 → «3 dona», 2,5 × 20 → «2 quti 10 dona»; noma'lum yoki butun chiqmasa — «0,05 quti».
// Server ilova.oson_qoldiq_matn bilan bir xil (defektura izohi). Oson sonni yaxlitlasa ham (0,02 × 60 = 1,2) — dona × 0,5% xato joiz.
export function qoldiqMatn(soni, dona) {
  const s = Number(soni);
  if (!(s > 0)) return '0 quti';
  if (dona > 1) {
    const jami = s * dona, butun = Math.round(jami);
    if (butun > 0 && Math.abs(jami - butun) <= Math.max(0.15, dona * 0.0051)) {
      const q = Math.floor(butun / dona), d = butun - q * dona;
      return [q ? q + ' quti' : '', d ? d + ' dona' : ''].filter(Boolean).join(' ');
    }
  }
  if (Math.round(s * 100) === 0) return '0,01 qutidan kam';
  return soniMatn(s) + ' quti';
}
// Ochilgan quti: butun quti qolmagan (faqat donalari) — aslida tugash arafasida. «1 quti» deb yaxlitlanadigani — butun hisoblanadi.
const ochilgan = (q) => {
  if (q.tugadi || !(q.soni > 0)) return false;
  const m = qoldiqMatn(q.soni, q.dona);
  return / dona$/.test(m) && !/quti/.test(m) ? true : !/ dona/.test(m) && q.soni < 0.995;
};
// 'YYYY-MM-DD' → 'DD.MM.YYYY'.
const kunMatn = (d) => (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}/.test(d) ? d.slice(8, 10) + '.' + d.slice(5, 7) + '.' + d.slice(0, 4) : '');
const asl = (t) => h('span', { 'data-asl': '' }, t);   // nom — Кирилл'ga o'tkazilmaydi
// Oson filiali → bizdagi nom. Ikki Oson filiali bitta filialga bog'langan bo'lsa — Oson nomi ham (adashmasin).
function filNomi(fil) {
  const fl = (O.j && O.j.filiallar) || [];
  const soni = new Map();
  fl.forEach((f) => { if (f.filial) soni.set(f.filial, (soni.get(f.filial) || 0) + 1); });
  const m = new Map(fl.map((f) => [f.id, f.filial ? fil(f.filial) + (soni.get(f.filial) > 1 ? ' (' + f.nom + ')' : '') : f.nom]));
  return (id) => m.get(id) || id;
}
// Bir nechta qismdan iborat izoh: matn qismlari oddiy, nomlar — asl().
const izohEl = (qismlar, cls = 'muted') => {
  const el = h('div', { class: cls });
  qismlar.filter(Boolean).forEach((q, i) => { if (i) el.append(' · '); el.append(q); });
  return el;
};
// Har filialning o'z rangi (02.11, foydalanuvchi: "qaysi filial ekanligi ajralib ko'rinishi kerak — barcha bo'limda, ko'chirishda
// ham"). Holat ranglari (qizil — tugadi, sariq — kam, yashil — bor) bilan adashmasin — boshqa ranglar; tartib — Oson filiallari
// ro'yxati bo'yicha (server filial id'si bilan tartiblaydi — rang o'zgarmaydi). Filtr tanlangan bo'lsa ham belgi chiqadi.
const FIL_RANG = 5;
const filRang = (id) => { const i = ((O.j && O.j.filiallar) || []).findIndex((f) => f.id === id); return 'f' + ((i < 0 ? 0 : i) % FIL_RANG); };
const bizFilial = (b) => (((O.j && O.j.filiallar) || []).find((f) => f.id === b) || {}).filial || null;   // Oson filiali → bizdagi
const filBelgi = (fNom, id) => h('span', { class: 'oq-fil ' + filRang(id), 'data-asl': '' }, fNom(id));
// B ko'rinishi (03.11, foydalanuvchi maketlardan B ni tanladi): filial, tartib va muddat — «▾» tugma, bosilsa pastdan oyna
// (katta tugmalar; tanlangani ✓). Tugmada tanlangan qiymat doim yozilgan turadi.
function tanlovTugma(nom, qiymat, variantlar, joriy, tanla, belgi) {
  return h('button', { type: 'button', class: 'oq-tanlov', 'aria-label': nom + ': ' + qiymat + ' — o\'zgartirish',
    onclick: () => sheet(nom, (box, close) => {
      box.append(h('div', { class: 'oq-tanlov-royxat' }, ...variantlar.map(([v, l]) => h('button', { type: 'button', class: 'oq-tanlov-v', 'aria-pressed': String(v === joriy),
        onclick: () => { close(); tanla(v); } }, belgi && v ? belgi(v) : null, h('span', { 'data-asl': '' }, l), v === joriy ? h('b', { 'aria-hidden': 'true' }, '✓') : null))));
    }, { fokus: false }) },
  h('span', { class: 'oq-tanlov-m' }, h('small', {}, nom), h('b', { 'data-asl': '' }, qiymat)), h('span', { 'aria-hidden': 'true' }, '▾'));
}
function filialTugma(fNom, chiz) {
  const j = O.j;
  if (j.filiallar.length < 2) return null;
  const v = [['', 'Hammasi'], ...j.filiallar.map((f) => [f.id, fNom(f.id)])];
  return tanlovTugma('Filial', O.filial ? fNom(O.filial) : 'Hammasi', v, O.filial || '', (x) => { O.filial = x; chiz(); },
    (id) => h('span', { class: 'oq-nuqta ' + filRang(id), 'aria-hidden': 'true' }));
}
// Qidiruv maydonida yozilayotgan bo'lsa — fondagi yangilanish ekranni qayta chizmaydi (klaviatura yopilmasin).
// Audit 06.11: ilovadagi istalgan yozish maydoni (defektura nomi, izoh…) — avval faqat «Qaysi filialda bor?» edi; boshqa maydonda
// yozayotganda fondagi yangilanish ekranni qayta chizib, takliflar ro'yxatini o'chirardi.
const yozyapti = () => { const e = document.activeElement; return !!(e && e.closest && e.closest('#app') && e.matches && e.matches('input, textarea')); };
// Yozib bo'lgach chizadi (har soniyada tekshiradi).
let keyinTaymer = 0;   // qayta audit: har chizishda yangi zanjir qo'shilmasin — bittasi, eng so'nggi chiz bilan
const keyinChiz = (chiz) => { clearTimeout(keyinTaymer); if (!yozyapti()) chiz(); else keyinTaymer = setTimeout(() => keyinChiz(chiz), 1000); };

// o.sahifa — pastki menyudagi alohida bo'lim (sarlavha sahifaning o'zida, kartada takrorlanmaydi).
export function osonKarta(ctx, fil, chiz, o = {}) {
  if (!ctx.server) return null;
  const k = h('section', { class: 'card list oson-karta' }, o.sahifa ? null : kartaSarlavha('Oson qoldig\'i'));
  if (!O.j && !O.xato) {
    k.append(h('div', { class: 'muted', role: 'status' }, 'Yuklanmoqda…'));
    yukla(ctx).then(() => keyinChiz(chiz), () => keyinChiz(chiz));
    return k;
  }
  if (!O.j) {
    k.append(h('div', { class: 'muted' }, O.xato), h('button', { class: 's', onclick: () => { O.xato = null; yukla(ctx, true).then(chiz, chiz); chiz(); } }, 'Qayta urinish'));
    return k;
  }
  // Eskirgan — fonda yangilanadi; qayta chizish faqat ma'lumot o'zgarsa va qidiruv ochiq bo'lmasa (yozayotganda klaviatura yopilmasin).
  if (Date.now() - O.vaqt > 60000 && !O.yuklanmoqda) {
    // Audit 08.11: «defekturada» belgisi va «hech qayerda» ham o'zgarishi mumkin (qator soni o'zgarmasa ham) — imzoga kiradi.
    const imzo = () => O.j.vaqt + ':' + O.j.qatorlar.length + ':' + O.j.rad + ':' + O.j.qatorlar.map((q) => (q.def ? 1 : 0) + (q.hammada ? 2 : 0)).join('')
      + ':' + ((O.j.kerakEmas || []).length);
    const oldin = imzo(), boshi = Date.now();
    yukla(ctx).then(() => {
      // So'rovdan oldin qo'yilgan lokal ✓ (10 daqiqalik) — server javobi endi o'zi aytadi.
      O.defda.forEach((t, k2) => { if (t !== true && t < boshi) O.defda.delete(k2); });
      if (!yozyapti() && O.j && imzo() !== oldin) chiz();
    });
  }
  const j = O.j, fNom = filNomi(fil);
  if (!j.vaqt) {
    k.append(h('div', { class: 'muted' }, 'Hali ma\'lumot kelmagan. Aptekadagi kompyuterda Chrome\'da Oson admin\'ni oching (kengaytma 0.9.4 yoki yangisi) — qoldiq o\'zi yuboriladi, keyin shu yerda kam qolgan va tugagan dorilar chiqadi.'));
    return k;
  }
  // B ko'rinishi (03.11, foydalanuvchi maketlardan B ni tanladi; avval A — plitkalar va chiplar, bitta ekranda 6 qator tugma):
  // tepada vaqt va ⚙︎, doim ko'rinadigan qidiruv («Qaysi filialda bor?»), 4 ta tab (Tugadi / Kam qoldi / Ko'chirsa / Muddati yaqin —
  // soni bilan), ikkita «▾» tanlov (Filial; Tartib yoki Muddat), keyin ro'yxat.
  // Kengaytma har 30 daqiqada yuboradi (03.11) — 45 daqiqa kelmasa (audit 10.11 kech; avval 2 soat), kompyuterda nimadir to'xtagan
  // (Oson yopiq, kompyuter uxlagan).
  k.append(h('div', { class: 'oq-top' },
    osonVaqtEl(j.vaqt, { qoshimcha: j.kompyuter ? asl(j.kompyuter) : null }),
    j.direktor ? h('button', { class: 'oq-ikon', 'aria-label': 'Sozlash: chegara va filiallar', onclick: () => sozlaSheet(ctx, fil, chiz) }, '⚙︎') : null));
  // Ro'yxatga kelmay qolgan filial (Oson uni bermadi) — eski ma'lumot.
  j.filiallar.filter((f) => f.korildi && j.vaqt - f.korildi > ESKI_MS)
    .forEach((f) => k.append(h('div', { class: 'oson-otgan' }, '⚠ ', filBelgi(fNom, f.id), ' ' + sana(f.korildi) + ' dan beri Oson\'dan ma\'lumot kelmadi')));
  if (j.rad) radKarta(k, ctx, chiz);
  kutishKarta(k, j, chiz);
  if (!ctx.qidiruvYoq) k.append(osonQidiruv(ctx, fil, { ichida: true, ixcham: true }));   // 07.11: direktor «Dori qidirish»ni o'chirgan (xodim)
  if (!['tugadi', 'hammada', 'kam', 'kochir', 'muddat'].includes(O.rejim)) O.rejim = 'tugadi';
  const san = (j.sanoq && j.sanoq[O.filial || '']) || { t: 0, k: 0 };
  const kochir = kesh('kochir:' + (O.filial || ''), () => j.qatorlar.filter((q) => (!O.filial || q.b === O.filial) && boshqaBor(q).length).length);
  const M = O.muddat;
  const muddatSoni = M.j && M.j.oy === M.oy ? M.j.q.filter((q) => !O.filial || q.b === O.filial).length : null;
  // Tabdagi son uchun muddat ro'yxati fonda bir marta olinadi (xatoda — «…» qoladi, tab bosilganda qayta urinadi).
  if (muddatSoni == null && !M.yuklanmoqda && !M.xato && O.rejim !== 'muddat') muddatYukla(ctx).then(() => { if (!yozyapti()) chiz(); });
  const tab = (rejim, cls, son, nom) => h('button', { type: 'button', class: 'oq-tab ' + cls, 'aria-pressed': String(O.rejim === rejim),
    onclick: () => { O.rejim = rejim; chiz(); } }, h('b', {}, son == null ? '…' : String(son)), h('span', {}, nom));
  k.append(h('div', { class: 'oq-tablar', role: 'group', 'aria-label': 'Ro\'yxat' },
    tab('tugadi', 'qizil', san.t, 'Tugadi'), tab('hammada', 'qizil', j.hammadaJami != null ? j.hammadaJami : kesh('hammada', () => hammadaGuruh(j.qatorlar)).length, 'Hech qayerda'),
    tab('kam', 'sariq', san.k, 'Kam qoldi'), tab('kochir', 'kok', kochir, 'Ko\'chirsa'),
    tab('muddat', 'yashil', muddatSoni, 'Muddati yaqin')));
  let ikkinchi;
  if (O.rejim === 'muddat') {
    ikkinchi = tanlovTugma('Muddat', M.oy + ' oy ichida', [[1, '1 oy ichida'], [3, '3 oy ichida'], [6, '6 oy ichida']], M.oy,
      (v) => { M.oy = v; M.j = null; M.xato = null; chiz(); });
  } else {
    const variant = TARTIBLAR[O.rejim === 'tugadi' || O.rejim === 'hammada' ? 'tugadi' : 'boshqa'];
    const joriy = variant.find(([v]) => v === (O.tartib[O.rejim] || '')) || variant[0];
    ikkinchi = tanlovTugma('Tartib', joriy[1], variant, joriy[0], (v) => { O.tartib[O.rejim] = v; chiz(); });
  }
  k.append(h('div', { class: 'oq-tanlovlar' }, O.rejim === 'hammada' ? null : filialTugma(fNom, chiz), ikkinchi));
  if (O.rejim === 'muddat') muddatView(k, ctx, fil, chiz);
  else if (O.rejim === 'hammada') hammadaView(k, ctx, fil, chiz);
  else tugayaptiView(k, ctx, fil, chiz);
  return k;
}

// 08.11 (egasi: "firmamizda umuman qolmagan — 3 ta filialda ham yo'q dorini ko'rsat; tugagan dorini hech qachon unutmasin"):
// server har qatorga 'hammada' beradi (shu nomli/katalogdagi dori hech bir filialda qoldig'i yo'q). Bir dori — bitta qator
// (talaffuz kaliti bo'yicha), filiallar tanlovidan qat'i nazar; eng oxirgi tugagani tepada.
export function hammadaGuruh(qatorlar) {
  const m = new Map();
  (qatorlar || []).filter((q) => q.hammada).forEach((q) => {
    const k = q.kalit || q.nom;
    const g = m.get(k);
    if (!g) m.set(k, { k, nom: q.nom, qatorlar: [q], tugadi: q.tugadi || 0, def: !!q.def });
    else { g.qatorlar.push(q); g.tugadi = Math.max(g.tugadi, q.tugadi || 0); g.def = g.def || !!q.def; }
  });
  return [...m.values()].sort((a, b) => (b.tugadi - a.tugadi) || nomSol(a.nom, b.nom));
}
function hammadaView(k, ctx, fil, chiz) {
  const fNom = filNomi(fil), j = O.j;
  const gs = kesh('hammada:' + (O.tartib.hammada || ''), () => {
    const g = kesh('hammada', () => hammadaGuruh(j.qatorlar));
    return O.tartib.hammada === 'alif' ? g.slice().sort((a, b) => nomSol(a.nom, b.nom)) : g;
  });
  const ro = h('div', { class: 'oq-royxat' }, h('div', { class: 'oq-bolim qizil' }, h('span', {}, 'Hech bir filialda yo\'q'), h('span', {}, String(gs.length))));
  if (!gs.length) ro.append(h('div', { class: 'muted', style: 'padding:8px 0 12px' }, '✓ Hamma tugagan dori kamida bitta filialda bor (yoki shu nomli boshqa ishlab chiqaruvchiniki) — qaysi filialda ekanini «Qaysi filialda bor?» qidiruvida ko\'ring.'));
  else ro.append(h('div', { class: 'muted', style: 'padding:2px 0 8px' }, 'Bu dorilar firmamizda umuman qolmagan — faqat buyurtma bilan keladi. Oson\'da qaytib kelguncha shu yerda turadi.'));
  const ozim = ctx.x && ctx.x.filialId;
  const asosiy = ((ctx.S && ctx.S.filiallar) || []).filter((f) => f.asosiy || f.id === 'osnovnoy').map((f) => f.id)[0];
  const qatorEl = (g) => {
    // «+» (audit 08.11) — avval shu odamning filiali, keyin asosiy filial, keyin oxirgi tugagan filial qatori.
    const q = g.qatorlar.find((z) => ozim && bizFilial(z.b) === ozim) || g.qatorlar.find((z) => asosiy && bizFilial(z.b) === asosiy) || g.qatorlar[0];
    const def = g.def || g.qatorlar.some((z) => defda(z));
    // Audit 10.11 kech: xaridda keldi, Oson'ga kiritilmagan — «+ Defekturaga» emas, «N ta keldi — Oson'ga kiriting» (qayta buyurtma bo'lmasin).
    const kq = g.qatorlar.find((z) => kutishTop(j, z)) || null;
    return h('div', { class: 'oq-r', 'data-rk': 'h|' + g.k },
      h('button', { type: 'button', class: 'oq-m', 'aria-label': g.nom + ' — batafsil', onclick: () => doriSheet(ctx, kq || q, fNom, chiz, g.qatorlar) },
        h('span', { class: 'oq-n', 'data-asl': '' }, g.nom),
        izohEl([...g.qatorlar.filter((z, i, l) => l.findIndex((v) => fNom(v.b) === fNom(z.b)) === i).map((z) => filBelgi(fNom, z.b)),
          g.tugadi ? sana(g.tugadi) + ' tugagan' : null], 'oq-i'),
        kq ? kutishEl(j, kq) : null,
        def ? h('span', { class: 'oq-def' }, '✓ Defekturaga yozilgan') : null),
      h('div', { class: 'oq-q qizil' }, '0', h('small', {}, 'hammada')),
      plusEl(ctx, kq && !def ? kq : q, g.nom, chiz, def));
  };
  yanaRoyxat(ro, gs, O.ochiq.hammada || KORINADI * 2, qatorEl, (n) => { O.ochiq.hammada = n; }, { boshi: KORINADI * 2, yig: chiz });
  k.append(ro);
  if (O.j.hammadaJami != null && O.j.hammadaJami > gs.length) k.append(h('div', { class: 'muted' }, 'Ro\'yxatda ' + gs.length + ' tasi (jami ' + O.j.hammadaJami + ').'));
  royxatHarakat(ro, 'oq:hammada:' + (O.tartib.hammada || ''));
}

// «Kerak emas» deb belgilanganlar (08.11): yo'qolib ketmasin — Tugadi bo'limi pastida yig'iq ro'yxat, direktor qaytaradi.
function kerakEmasEl(ctx, fil, chiz) {
  const j = O.j, l = (j.kerakEmas || []).filter((q) => !O.filial || q.b === O.filial);
  if (!l.length) return null;
  const fNom = filNomi(fil);
  const jami = !O.filial && j.kerakEmasJami > l.length ? j.kerakEmasJami : l.length;
  const det = h('details', { class: 'oq-kerakemas' }, h('summary', {}, '«Kerak emas» deb belgilanganlar (' + jami + ')'));
  l.forEach((q) => det.append(h('div', { class: 'line' },
    h('span', {}, h('span', { 'data-asl': '' }, q.nom), h('small', { class: 'muted', style: 'display:block' }, filBelgi(fNom, q.b), q.tugadi ? ' · tugagan' : ' · ' + qoldiqMatn(q.soni, q.dona) + ' qoldi')),
    j.direktor ? h('button', { type: 'button', class: 's', onclick: () => ctx.amal('osonKerakEmas', q.b, q.p, false).then((r) => {
      if (r == null) return;
      ctx.toast('Ro\'yxatga qaytdi ✓');
      yukla(ctx, true).then(chiz, chiz);
    }) }, 'Qaytarish') : null)));
  return det;
}

// Server oxirgi ro'yxatni qabul qilmadi (birdan ko'p dori yo'qoldi) — sababi; direktor o'tkazib yuborishi mumkin.
function radKarta(k, ctx, chiz) {
  const j = O.j;
  const box = h('div', { class: 'oson-rad', role: 'note' },
    h('b', {}, 'Oxirgi ro\'yxat qabul qilinmadi' + (j.radVaqt ? ' (' + sana(j.radVaqt) + ' ' + vaqt(j.radVaqt) + ')' : '')),
    h('div', {}, j.rad));
  if (j.direktor && !j.majbur) {
    box.append(h('div', { class: 'muted' }, 'Odatda bu Oson ro\'yxati chala kelganini bildiradi — keyingi o\'qishda o\'zi to\'g\'rilanadi. Agar Oson\'da haqiqatan ko\'p dori o\'zgargan bo\'lsa (yangi katalog, tugatilgan dorilar) — qabul qiling.'),
      h('button', { class: 's', onclick: () => tasdiqlash('Keyingi Oson ro\'yxati tekshiruvsiz qabul qilinsinmi? Yo\'qolgan dorilar «tugadi» bo\'lib ko\'rinadi.')
        .then((ha) => ha && ctx.amal('osonMajbur').then((r) => { if (r != null) { ctx.toast('Keyingi ro\'yxat qabul qilinadi (20 daqiqa ichida) ✓'); yukla(ctx, true).then(chiz, chiz); } })) },
      'Baribir qabul qilish'));
  } else if (j.majbur) box.append(h('div', { class: 'muted' }, 'Keyingi ro\'yxat tekshiruvsiz qabul qilinadi.'));
  else box.append(h('div', { class: 'muted' }, 'Direktor ko\'rib chiqadi.'));
  k.append(box);
}

// «+ Defekturaga» — qatordagi «+» ham, dori oynasidagi tugma ham shu.
// 05.11 (foydalanuvchi: "+ ni bossam qotib turib keyin o'tyapti"): avval server javobi (yangi holat ~100 KB) kutilardi — shu
// orada hamma tugma xira va bosilmas edi; keyin butun Oson ro'yxati (~470 KB) qayta yuklanardi. Endi ✓ darhol chiqadi, so'rov
// fonda ketadi (boshqa tugmalar bosilaveradi), ro'yxat qayta yuklanmaydi; xato bo'lsa «+» qaytadi. Qo'shilgani 10 daqiqa
// eslab qolinadi — shu orada kelgan eski ro'yxat (so'rovdan oldin boshlangan) «+» ni qaytarib qo'ymasin.
const DEF_ESLA_MS = 10 * 60000;
const defKalit = (q) => q.b + '|' + q.p;
const defda = (q) => {
  if (q.def) return true;
  const t = O.defda.get(defKalit(q));
  return !!t && (t === true || Date.now() - t < DEF_ESLA_MS);
};
// Qator o'ngidagi belgi: ✓ (defekturada), ⏳ (keldi, Oson'ga kiritilmagan — audit 10.11 kech) yoki «+». data-dk — shu dori;
// «+» bosilganda faqat shu belgilar almashtiriladi (audit 10.11 kech: avval butun ro'yxat — 3 500 qatorgacha — qayta chizilardi).
function plusEl(ctx, q, nom, chiz, def = defda(q)) {
  const dk = defKalit(q);
  const el = def ? h('span', { class: 'oq-plus bor', role: 'img', 'aria-label': 'Defekturada bor' }, '✓')
    : kutishTop(O.j, q) ? h('span', { class: 'oq-plus kut', role: 'img', 'aria-label': 'Keldi, Oson\'ga kiritilmagan — Oson\'ga kiriting' }, '⏳')
      : h('button', { type: 'button', class: 'oq-plus', 'aria-label': 'Defekturaga qo\'shish: ' + nom, onclick: () => defekturaga(ctx, q, chiz) }, '+');
  el.setAttribute('data-dk', dk);
  PLUS_NOM.set(el, nom);
  return el;
}
const PLUS_NOM = new WeakMap();   // belgi → qatordagi nom (almashtirilganda aria-label o'sha nom bilan)
function plusYangila(ctx, q, chiz) {
  const dk = defKalit(q);
  document.querySelectorAll('[data-dk]').forEach((e) => {
    if (e.getAttribute('data-dk') === dk) e.replaceWith(plusEl(ctx, q, PLUS_NOM.get(e) || q.nom, chiz));
  });
}
function defekturaga(ctx, q, chiz) {
  const kalit = defKalit(q);
  if (defda(q)) return Promise.resolve(true);   // ikki marta tez bosildi
  O.defda.set(kalit, true);   // true — so'rov ketyapti
  plusYangila(ctx, q, chiz);
  const yubor = ctx.amalFon || ctx.amal;
  return yubor('osonDefekturaga', q.b, q.p).then((r) => {
    if (r == null) { O.defda.delete(kalit); plusYangila(ctx, q, chiz); return false; }
    O.defda.set(kalit, Date.now());
    ctx.toast('Defekturaga qo\'shildi ✓');
    return true;
  });
}
const boshqaBor = (q) => (q.boshqa || []).filter((b) => b.soni >= 1);
// Ishlab chiqaruvchining qisqa nomi: «Navbahor Sanoat (Узбекистан), Navbahor Sanoat ООО (Узбекистан)» → «Navbahor Sanoat».
export const ishlabQisqa = (s) => (typeof s === 'string' ? s.split(/\s*[(,]/)[0].replace(/\s+/g, ' ').trim().slice(0, 40) : '');
// Bir nomli dori (04.11; foydalanuvchi: "aytsin masalan Radiks'niki tugadi, Navbahor'niki bor deb"): shu filialda shu nomli boshqa
// ishlab chiqaruvchining qoldig'i bo'lsa — «Radiks'niki tugadi, Navbahor Sanoat'niki bor — 16 quti 20 dona».
export function ozidaEl(q, cls = 'oq-oz') {
  const oz = (q.ozida || []).filter((x) => x && x.soni > 0);
  if (!oz.length) return null;
  const bu = ishlabQisqa(q.ishlab), u = ishlabQisqa(oz[0].ishlab);
  // Bir ishlab chiqaruvchining ikki Oson kartasi bo'lsa — «Navbahor'niki tugadi, Navbahor'niki bor» emas (audit 04.11).
  const bir = (a, b) => { a = a.toLowerCase(); b = b.toLowerCase(); return !!a && !!b && (a.startsWith(b) || b.startsWith(a)); };
  const ikkinchi = !u ? ['boshqa ishlab chiqaruvchiniki bor — '] : bir(u, bu) ?['boshqa Oson kartasida bor — '] : [asl(u), '\'niki bor — '];
  return h('span', { class: cls },
    '✓ ', bu ? asl(bu) : null, bu ? '\'niki ' : 'Bunisi ', q.tugadi ? 'tugadi' : qoldiqMatn(q.soni, q.dona) + ' qoldi', ', ',
    ...ikkinchi, qoldiqMatn(oz[0].soni, oz[0].dona),
    oz.length > 1 ? ' (yana ' + (oz.length - 1) + ' xil)' : '');
}
// Tartib (03.11, foydalanuvchi: "Kam qoldi degan joyida filtr qo'yib ber — alfavit bo'yicha yoki quti dona soniga qarab").
// '' — tugaganlar: server tartibi (oxirgi tugagan tepada); qolganlar: eng kam qolgan tepada. soni — quti (0,5 = yarim quti).
const TARTIBLAR = {
  tugadi: [['', 'Oxirgi tugagan'], ['alif', 'Alfavit']],
  boshqa: [['', 'Kam qolgani'], ['kop', 'Ko\'p qolgani'], ['alif', 'Alfavit']]
};
const nomTartib = (a, b) => nomSol(a.nom, b.nom);
function tartibla(qatorlar, t, tugadi) {
  if (t === 'alif') return qatorlar.slice().sort(nomTartib);
  if (t === 'kop') return qatorlar.slice().sort((a, b) => (b.soni - a.soni) || nomTartib(a, b));
  return tugadi ? qatorlar : qatorlar.slice().sort((a, b) => (a.soni - b.soni) || nomTartib(a, b));
}

// 10.11 (egasi: "Ginesept 44 ta keldi, lekin Oson qoldig'ida ko'rinmayabdi"): xaridda yozilgan, Oson'ga hali kiritilmagan dorilar
// (server 'kutish', kalit — Oson nomining talaffuz kaliti). Qoldiq baribir Oson'dan; bu — «kirim qilinmay qolgan» eslatma.
// Audit 10.11 kech: xarid Oson'ga kiritilguncha (30 kungacha) shu yerda turadi; 7 kundan eskisi — qizil «N kundan beri kiritilmagan».
// Qidiruv — Map (kalit bo'yicha, har ro'yxatga bir marta); kaliti yo'q qator hech qachon mos kelmaydi (bo'sh kalit = bo'sh kalit emas).
// 10.11 kech (20261110180000_xarid_filial): xaridda filial yoziladi — 'b' shu filialning Oson filiallari, 'fil' — nomi, 'fm' — hamma
// xaridda filial yozilgan. Filialsiz (eski / ta'minotchi yozgan) xarid — 'b' shu dori Oson'da bor filiallar (qaysiga kelgani noma'lum).
const kunQisqa = (k) => String(k || '').slice(8, 10) + '.' + String(k || '').slice(5, 7);
export const KUTISH_QIZIL_KUN = 7;
const kunlarOtdi = (k) => (typeof k === 'string' && /^\d{4}-\d{2}-\d{2}/.test(k) ? Math.max(0, Math.floor((Date.now() - Date.parse(k.slice(0, 10) + 'T00:00:00+05:00')) / 864e5)) : 0);
// Eng eski kiritilmagan xariddan necha kun o'tdi (eski server — 'boshi' yo'q — oxirgi xarid kuni).
export const kutishKunlari = (z) => kunlarOtdi(z.boshi || z.kun);
export const kutishMatn = (z) => {
  const n = kutishKunlari(z);
  return z.soni + ' ta keldi (' + kunQisqa(z.kun) + ') — ' + (n > KUTISH_QIZIL_KUN ? n + ' kundan beri Oson\'ga kiritilmagan' : 'Oson\'ga kiriting');
};
const kutishMap = (j) => {
  if (!j) return new Map();
  if (!j._kutMap) Object.defineProperty(j, '_kutMap', { value: new Map((Array.isArray(j.kutish) ? j.kutish : []).filter((z) => z && z.kalit).map((z) => [z.kalit, z])) });
  return j._kutMap;
};
// Qator uchun kutish yozuvi: kalit bo'yicha; server 'kut' bergan, lekin ro'yxatda yo'q (300 dan ortiq) — umumiy belgi.
function kutishTop(j, q) {
  if (!j || !q) return null;
  const z = q.kalit ? kutishMap(j).get(q.kalit) : null;
  return z || (q.kut === true ? { soni: null } : null);
}
// bQat — qator bitta Oson filialiniki (q.b): xarid boshqa filialga kelgan bo'lsa ('b' da yo'q) — bu qatorda yozuv chiqmaydi.
export function kutishEl(j, q, bQat = false) {
  const z = kutishTop(j, q);
  if (!z) return null;
  if (bQat && z.soni != null && q.b && Array.isArray(z.b) && !z.b.includes(q.b)) return null;
  if (z.soni == null) return h('span', { class: 'kut-belgi' }, 'Keldi — Oson\'ga kiriting');
  return h('span', { class: 'kut-belgi' + (kutishKunlari(z) > KUTISH_QIZIL_KUN ? ' qizil' : '') }, kutishMatn(z));
}
function kutishKarta(k, j, chiz) {
  const hamma = Array.isArray(j.kutish) ? j.kutish : [];
  const ro = O.filial ? hamma.filter((z) => !Array.isArray(z.b) || z.b.includes(O.filial)) : hamma;
  if (!ro.length) return;
  const eski = ro.filter((z) => kutishKunlari(z) > KUTISH_QIZIL_KUN).length;
  const kor = O.kutOchiq ? ro : ro.slice(0, 3);
  k.append(h('div', { class: 'kut-karta', role: 'region', 'aria-label': 'Keldi, Oson\'ga kiritilmagan' },
    h('div', { class: 'kut-s' }, h('b', {}, 'Keldi, Oson\'ga kiritilmagan'), h('span', {}, String(ro.length))),
    eski ? h('div', { class: 'kut-eski' }, '⚠ ' + eski + ' ta dori ' + KUTISH_QIZIL_KUN + ' kundan ko\'p Oson\'ga kiritilmagan — tekshiring') : null,
    ...kor.map((z) => {
      const n = kutishKunlari(z);
      return h('div', { class: 'kut-q' }, h('span', { 'data-asl': '' }, z.nom),
        h('span', { class: 'muted' }, z.soni + ' ta · ' + kunQisqa(z.kun) + (z.fil && !O.filial ? ' · ' + z.fil : '') + (z.ta ? ' · ' : ''), z.ta ? asl(z.ta) : null),
        n > KUTISH_QIZIL_KUN ? h('span', { class: 'kut-belgi qizil' }, n + ' kundan beri kiritilmagan') : null);
    }),
    ro.length > 3 ? h('button', { type: 'button', class: 'oq-yana', onclick: () => { O.kutOchiq = !O.kutOchiq; chiz(); } },
      O.kutOchiq ? 'Yig\'ish ▴' : 'Yana ' + (ro.length - kor.length) + ' ta ▾') : null,
    h('div', { class: 'muted' }, 'Xaridda yozilgan, lekin Oson\'da hali kirim qilinmagan. Oson\'ga kirim qiling — 30 daqiqa ichida qoldiq shu yerda yangilanadi. '
      + 'Shu orada bu dorilarga «+ Defekturaga» chiqmaydi.'
      + (!O.filial ? '' : ro.every((z) => z.fm) ? ' Faqat shu filialga kelgan xaridlar ko\'rsatildi.'
        : ' Ba\'zi xaridlarda filial yozilmagan — ular shu filialda Oson\'da yozuvi bor bo\'lsa ko\'rsatildi.'))));
}

// Ro'yxat (A ko'rinishi): har dori — bitta qator: nomi, bir qator izoh, «↔ boshqa filialda bor», o'ngda rangli qoldiq va «+».
// Tafsilot va «Kerak emas» — qator bosilganda ochiladigan oynada (ro'yxat toza qoladi).
function tugayaptiView(k, ctx, fil, chiz) {
  const j = O.j, fNom = filNomi(fil);
  const variant = TARTIBLAR[O.rejim === 'tugadi' ? 'tugadi' : 'boshqa'];
  if (!variant.some(([v]) => v === (O.tartib[O.rejim] || ''))) O.tartib[O.rejim] = '';
  const rejim = O.rejim;
  const qatorlar = kesh(rejim + ':' + (O.filial || '') + ':' + (O.tartib[rejim] || ''), () => tartibla(j.qatorlar.filter((q) => (!O.filial || q.b === O.filial)
    && (rejim === 'tugadi' ? q.tugadi : rejim === 'kam' ? !q.tugadi : boshqaBor(q).length)), O.tartib[rejim], rejim === 'tugadi'));
  const SARLAVHA = { tugadi: ['qizil', 'Tugadi — buyurtma kerak'], kam: ['sariq', 'Kam qoldi'], kochir: ['kok', 'Boshqa filialda bor — ko\'chirsa bo\'ladi'] };
  const [rang, sarlavha] = SARLAVHA[O.rejim];
  const ro = h('div', { class: 'oq-royxat' }, h('div', { class: 'oq-bolim ' + rang }, h('span', {}, sarlavha), h('span', {}, String(qatorlar.length))));
  if (!qatorlar.length) {
    ro.append(h('div', { class: 'muted', style: 'padding:8px 0 12px' }, O.rejim === 'tugadi' ? '✓ Hozircha tugagan dori yo\'q. Dori Oson\'dan ketma-ket ikki o\'qishda yo\'qolsa (taxminan 1 soat) — shu yerda chiqadi.'
      : O.rejim === 'kam' ? (j.chegara === 0 ? 'Sozlashda «Faqat tugaganlar» tanlangan — kam qolganlar ko\'rsatilmaydi (⚙︎).' : '✓ Kam qolgan dori yo\'q')
        : 'Boshqa filialda butun qutisi bor dori yo\'q'));
  }
  const qatorEl = (q) => {
    const b = boshqaBor(q);
    const qoldiq = q.tugadi ? h('div', { class: 'oq-q qizil' }, '0', h('small', {}, 'tugadi'))
      : h('div', { class: 'oq-q sariq' }, qoldiqMatn(q.soni, q.dona), h('small', {}, 'qoldi'));
    return h('div', { class: 'oq-r', 'data-rk': q.b + '|' + (q.p != null ? q.p : q.nom) },
      h('button', { type: 'button', class: 'oq-m', 'aria-label': q.nom + ' — batafsil', onclick: () => doriSheet(ctx, q, fNom, chiz) },
        h('span', { class: 'oq-n', 'data-asl': '' }, q.nom),
        izohEl([filBelgi(fNom, q.b),
          q.tugadi ? sana(q.tugadi) + ' ' + vaqt(q.tugadi) + ' tugadi' : q.firma ? asl(q.firma) : null], 'oq-i'),
        ozidaEl(q),
        q.tugadi && q.hammada ? h('span', { class: 'oq-hech' }, 'Hech bir filialda yo\'q') : null,
        kutishEl(j, q, true),
        b.length ? h('span', { class: 'oq-k' }, '↔ ', filBelgi(fNom, b[0].b), ' da ' + qoldiqMatn(b[0].soni, b[0].dona) + ' bor' + (b.length > 1 ? ' (+' + (b.length - 1) + ' filial)' : '') + ' — ko\'chirsa bo\'ladi') : null),
      qoldiq,
      plusEl(ctx, q, q.nom, chiz));
  };
  yanaRoyxat(ro, qatorlar, Number(O.ochiq[rejim]) || KORINADI * 2, qatorEl, (n) => { O.ochiq[rejim] = n; }, { boshi: KORINADI * 2, yig: chiz });
  k.append(ro);
  if (O.rejim === 'tugadi' || O.rejim === 'kam') { const ke = kerakEmasEl(ctx, fil, chiz); if (ke) k.append(ke); }
  // 07.11 tun: dori tugasa/qaytsa (fondagi yangilanish) — qatorlar yumshoq suriladi; bo'lim/filial/tartib almashsa — boshqa ro'yxat.
  royxatHarakat(ro, 'oq:' + O.rejim + ':' + (O.filial || '') + ':' + (O.tartib[O.rejim] || ''));
  // ⚙︎ faqat direktorda (audit 03.11: xodimga yo'q tugmani aytmaslik).
  if (j.jami > j.qatorlar.length) k.append(h('div', { class: 'muted' }, 'Ro\'yxatda birinchi ' + j.qatorlar.length + ' tasi (jami ' + j.jami + ').'
    + (j.direktor ? ' Kamroq ko\'rish uchun ⚙︎ → chegarani kamaytiring yoki «Faqat tugaganlar».' : '')));
}

// Dori bosilganda: hamma filialdagi qoldiq, firma, narx va amallar (+ Defekturaga, Kerak emas — direktor).
function doriSheet(ctx, q, fNom, chiz, guruh = null) {
  const j = O.j;
  sheet('Dori', (box, close) => {
    const fil = [[q.b, q.tugadi ? null : q], ...boshqaBor(q).map((b) => [b.b, b])];
    // Eng arzon firma (direktor): firma narxlari hali yuklanmagan bo'lsa — shu yerda yuklanadi (audit 03.11: Qoldiq'dan to'g'ri
    // kirilganda Defektura ochilmaguncha chiqmasdi).
    const narxJoy = h('div', {});
    const narxQoy = () => { narxJoy.textContent = ''; const el = defNarxQator(q.nom); if (el) narxJoy.append(el); };
    if (j.direktor) { narxQoy(); if (!narxJoy.childNodes.length) firmalarOl(ctx).then(narxQoy, () => {}); }
    // Audit 10.11 kech: xaridda keldi, Oson'ga kiritilmagan — oynada ham (avval faqat «Tugadi/Kam» qatorida edi).
    const kz = kutishTop(j, q);
    box.append(
      h('b', { class: 'oq-sheet-nom', 'data-asl': '' }, q.nom),
      q.ishlab ? h('div', { class: 'muted', 'data-asl': '' }, q.ishlab) : null,
      kz ? h('div', { class: 'kut-oyna' + (kz.soni != null && kutishKunlari(kz) > KUTISH_QIZIL_KUN ? ' qizil' : ''), role: 'note' },
        h('b', {}, kz.soni != null ? kutishMatn(kz) : 'Keldi — Oson\'ga kiriting'),
        h('span', {}, 'Xaridda yozilgan, lekin Oson\'da hali kirim qilinmagan — qayta buyurtma qilmang. Oson\'ga kirim qilinsa, qoldiq shu yerda yangilanadi.')) : null,
      osonVaqtEl(j.vaqt, { faqatEski: true }),
      ozidaEl(q, 'oq-oz oq-oz-sheet'),
      h('div', { class: 'oq-bloklar' }, ...fil.map(([id, x]) => h('div', { class: x ? (x.soni >= 1 ? 'yashil' : 'sariq') : 'qizil' },
        filBelgi(fNom, id), h('b', {}, x ? qoldiqMatn(x.soni, x.dona) : '0'), h('span', {}, x ? (id === q.b ? 'shu filial' : 'bor') : 'tugadi')))),
      ochilgan(q) ? h('div', { class: 'belgi ogoh', style: 'align-self:flex-start' }, 'Butun quti qolmagan — faqat donalari') : null,
      izohEl([q.firma ? h('span', {}, 'Oxirgi kelgan: ', asl(q.firma), q.keldi ? ' · ' + kunMatn(q.keldi) : '') : null,
        q.narx ? 'sotuv narxi ' + H.som(q.narx) : null,
        q.minimum != null ? 'Oson minimumi ' + soniMatn(q.minimum) + ' quti' : null]),
      j.direktor ? narxJoy : null,
      // 07.11 kech: boshqa filialda bor — o'sha filialdan so'rash (filiallararo so'rov; kim uchun — shu filial, kimdan — o'sha).
      // Faqat o'z filiali uchun (direktor — hammasi): boshqa filialning dorisiga «so'rash» chiqmasin (audit 07.11 kech).
      // Bir bizdagi filialga bir nechta Oson filiali bog'langan bo'lsa — bitta tugma.
      ...(ctx.server && ctx.amalFon && bizFilial(q.b) && ozFilialmi(ctx, bizFilial(q.b))
        ? boshqaBor(q).filter((b, i, l) => bizFilial(b.b) && bizFilial(b.b) !== bizFilial(q.b)
          && l.findIndex((z) => bizFilial(z.b) === bizFilial(b.b)) === i).map((b) =>
        h('button', { type: 'button', class: 's sorov-t', onclick: () => {
          close();
          sorashOch(ctx, { nom: q.nom, filial: bizFilial(q.b), manba: bizFilial(b.b), vaqt: j.vaqt,
            qoldiq: [{ f: bizFilial(q.b), soni: q.tugadi ? 0 : q.soni, dona: q.dona }, ...boshqaBor(q).map((z) => ({ f: bizFilial(z.b), soni: z.soni, dona: z.dona }))] });
        } }, '📦 ' + fNom(b.b) + '\'dan so\'rash (' + qoldiqMatn(b.soni, b.dona) + ' bor)')) : []),
      // Kutishda — asosiy tugma emas (kelgan dori qayta buyurtma bo'lmasin); kerak bo'lsa baribir yozsa bo'ladi.
      defda(q) ? h('div', { class: 'belgi ok', style: 'align-self:flex-start' }, '✓ Defekturada bor')
        : kz ? h('button', { class: 's', onclick: () => { close(); defekturaga(ctx, q, chiz); } }, 'Baribir defekturaga yozish')
          : h('button', { class: 'p', onclick: () => { close(); defekturaga(ctx, q, chiz); } }, '+ Defekturaga'),
      // 07.11 tun: qoldig'i bor dori — hisobdan chiqarish / firmaga qaytarish (shu oyna yopilib, forma ochiladi).
      !q.tugadi && q.soni > 0 && chiqarishRuxsat(ctx, bizFilial(q.b))
        ? h('button', { type: 'button', class: 's chiq-tugma', onclick: () => { close(); chiqarishOyna(ctx, { b: q.b, p: q.p, nom: q.nom, ishlab: q.ishlab, soni: q.soni, dona: q.dona, firma: q.firma, fn: fNom(q.b) }); } },
          'Hisobdan chiqarish / Firmaga qaytarish') : null,
      j.direktor ? h('button', { class: 's', onclick: () => tasdiqlash('«' + q.nom + '» kerak emasmi?' + (guruh && guruh.length > 1 ? ' (' + guruh.length + ' ta filialda)' : '')
        + ' Dori «Kerak emas» ro\'yxatiga o\'tadi (Tugadi bo\'limi pastida) — u yerdan qaytarish mumkin.')
        .then((ha) => ha && (guruh && guruh.length ? guruh : [q]).reduce((p, z) => p.then((ok) => ok && ctx.amal('osonKerakEmas', z.b, z.p, true).then((r) => r != null)), Promise.resolve(true)).then((ok) => {
          if (!ok) { yukla(ctx, true).then(chiz, chiz); return; }
          const olindi = new Set(guruh && guruh.length ? guruh : [q]);
          j.qatorlar = j.qatorlar.filter((z) => !olindi.has(z));
          keshUnut();
          ctx.toast('Ro\'yxatdan olindi');
          close();
          chiz();
          yukla(ctx, true).then(chiz, chiz);
        })) }, 'Kerak emas') : null);
  }, { fokus: false });
}

function bolim(k, kalit, sarlavha, list, qatorEl, chiz) {
  if (!list.length) return;
  k.append(h('h3', { class: 'oson-bolim' }, sarlavha + ' (' + list.length + ')'));
  const kor = O.ochiq[kalit] ? list : list.slice(0, KORINADI);
  kor.forEach((q) => k.append(qatorEl(q)));
  if (list.length > KORINADI) {
    k.append(h('button', { class: 's', onclick: () => { O.ochiq[kalit] = !O.ochiq[kalit]; chiz(); } },
      O.ochiq[kalit] ? 'Yig\'ish' : 'Yana ' + (list.length - kor.length) + ' ta'));
  }
}

// Muddati yaqin: eng yaqin muddatli partiya (soni bilan) — oldin sotish, firmaga qaytarish yoki ko'chirish uchun.
function muddatView(k, ctx, fil, chiz) {
  const M = O.muddat, fNom = filNomi(fil);
  if (!M.j || M.j.oy !== M.oy) {
    if (M.xato) { k.append(h('div', { class: 'muted' }, M.xato), h('button', { class: 's', onclick: () => { M.xato = null; muddatYukla(ctx, true).then(chiz, chiz); chiz(); } }, 'Qayta urinish')); return; }
    k.append(h('div', { class: 'muted', role: 'status' }, 'Yuklanmoqda…'));
    muddatYukla(ctx).then(chiz, chiz);
    return;
  }
  if (Date.now() - M.vaqt > 60000 && !M.yuklanmoqda) muddatYukla(ctx);   // keyingi chizishda — yangisi
  const list = M.j.q.filter((q) => !O.filial || q.b === O.filial);
  if (!list.length) { k.append(h('div', { class: 'muted' }, '✓ ' + (O.filial ? 'Bu filialda ' : '') + M.oy + ' oy ichida muddati tugaydigan dori yo\'q')); return; }
  const kun = H.kunKey(Date.now());
  // 07.11 kech: «Javondan oling» — muddati direktor belgilagan kunlar ichida tugaydi (server har qatorga 'javon' beradi).
  const otgan = list.filter((q) => q.muddat < kun), javon = list.filter((q) => q.muddat >= kun && q.javon === true),
    yaqin = list.filter((q) => q.muddat >= kun && q.javon !== true);
  const qatorEl = (q) => h('div', { class: 'item' },
    h('b', { 'data-asl': '' }, q.nom),
    izohEl([j2(fNom, q), (q.muddat < kun ? 'muddati o\'tgan: ' : 'muddati: ') + kunMatn(q.muddat) + (q.msoni != null ? ' — ' + qoldiqMatn(q.msoni, q.dona) : ''),
      'jami ' + qoldiqMatn(q.soni, q.dona), q.firma ? asl(q.firma) : null], q.muddat < kun ? 'oson-otgan' : 'muted'),
    q.ishlab ? h('div', { class: 'muted', style: 'font-size:13px', 'data-asl': '' }, q.ishlab) : null,
    q.javon && q.muddat >= kun ? h('div', { class: 'belgilar' }, h('span', { class: 'belgi javon' }, 'Javondan oling')) : null,
    // 07.11 tun: muddati o'tgan / javondan olinadigan — hisobdan chiqarish yoki firmaga qaytarish.
    (q.muddat < kun || q.javon) && chiqarishRuxsat(ctx, bizFilial(q.b))
      ? chiqarishTugma(ctx, { b: q.b, p: q.p, nom: q.nom, ishlab: q.ishlab, soni: q.soni, dona: q.dona, firma: q.firma, otgan: q.muddat < kun, fn: fNom(q.b) }) : null);
  bolim(k, 'otgan', 'Muddati o\'tgan', otgan, qatorEl, chiz);
  bolim(k, 'javon', 'Javondan oling', javon, qatorEl, chiz);
  bolim(k, 'yaqin', 'Muddati yaqin', yaqin, qatorEl, chiz);
  k.append(h('div', { class: 'muted' }, 'Muddati yaqinlarini oldin soting, firmaga qaytaring yoki savdosi ko\'p filialga ko\'chiring.'
    + (javon.length ? ' «Javondan oling» — muddati tugashiga oz qoldi: sotmang, firmaga qaytaring yoki hisobdan chiqaring (kunlarni direktor Pul nazoratida belgilaydi).' : '')));
}
const j2 = (fNom, q) => filBelgi(fNom, q.b);

// Xodim Bosh: o'z filialida muddati o'tgan dorilar (03.11; foydalanuvchi: "har xodimning biriktirilgan filialiniki ko'rinsin,
// vaqtincha boshqa filialda bo'lsa o'sha filialniki"). Filialni server aniqlaydi (ilova.xodim_tg — vaqtincha biriktirish bilan).
// Yuklanayotganda, xatoda va Oson shu filialga bog'lanmagan bo'lsa — hech narsa chiqmaydi (Bosh sahifa shovqinsiz).
export function muddatiOtganKarta(ctx, fil, chiz) {
  if (!ctx.server) return null;
  const T = O.otgan;
  // Xatodan keyin ham 1 daqiqa kutiladi (audit 03.11: T.j bo'sh qolsa har chizishda yangi so'rov ketardi).
  if (((!T.j && !T.vaqt) || Date.now() - T.vaqt > 60000) && !T.yuklanmoqda) {
    const oldin = JSON.stringify(T.j);   // filial ham (vaqtincha biriktirilsa) — o'zgarsa qayta chiziladi
    T.yuklanmoqda = ctx.oqi('osonMuddatiOtgan')
      .then((j) => { if (j && Array.isArray(j.qatorlar)) T.j = j; }, () => {})
      .finally(() => { T.vaqt = Date.now(); T.yuklanmoqda = null; if (T.j && JSON.stringify(T.j) !== oldin) chiz(); });
  }
  const j = T.j;
  if (!j || !j.vaqt || !j.bogliq) return null;
  const fNom = fil(j.filial);
  // Audit 03.11: Oson bu filialni bermayapti — ro'yxat eski (vaqt — filialning oxirgi ko'rilgani). Audit 10.11 kech: 45 daqiqa
  // (server 'eski' ham; eski server 26 soat bersa ham — Mini App vaqtdan o'zi tekshiradi).
  const eski = j.eski || osonEskimi(j.vaqt) ? h('div', { class: 'oson-otgan', role: 'status' }, '⚠ Oson\'dan ' + sana(j.vaqt) + ' ' + vaqt(j.vaqt)
    + ' dan beri yangi ma\'lumot kelmadi — ro\'yxat eski bo\'lishi mumkin (' + oldinMatn(Date.now() - j.vaqt) + ' oldin)') : null;
  if (!j.qatorlar.length) {
    const k0 = h('div', { class: 'card' }, h('div', { class: 'muted' }, '✓ ' + fNom + ': muddati o\'tgan dori yo\'q (Oson · ' + sana(j.vaqt) + ')'), eski);
    javonQism(k0, j, T, chiz);
    return k0;
  }
  const k = h('section', { class: 'card list' }, kartaSarlavha('Muddati o\'tgan dorilar — ' + fNom + ' (' + j.qatorlar.length + ')'),
    h('div', { class: 'muted' }, 'Sotmang — javondan oling va direktorga ayting. Oson · ' + sana(j.vaqt) + ' ' + vaqt(j.vaqt)), eski);
  const KOR = 5, kor = T.ochiq ? j.qatorlar : j.qatorlar.slice(0, KOR);
  // 07.11 tun: har qatorda «Hisobdan chiqarish / Firmaga qaytarish» (server 'bid' — Oson filiali, 'p' — mahsulot bersa).
  const yoza = chiqarishRuxsat(ctx, j.filial);
  kor.forEach((q) => k.append(h('div', { class: 'item' },
    h('b', { 'data-asl': '' }, q.nom),
    izohEl(['muddati o\'tgan: ' + kunMatn(q.muddat) + ' — ' + qoldiqMatn(q.msoni != null ? q.msoni : q.soni, q.dona),
      q.b ? asl(q.b) : null, q.firma ? asl(q.firma) : null], 'oson-otgan'),   // b — filialga bir nechta Oson filiali bog'langanda
    yoza && q.bid && q.p ? chiqarishTugma(ctx, { b: q.bid, p: q.p, nom: q.nom, ishlab: q.ishlab, soni: q.soni, dona: q.dona, firma: q.firma, otgan: true, fn: fNom }) : null)));
  if (j.qatorlar.length > KOR) k.append(h('button', { class: 's', onclick: () => { T.ochiq = !T.ochiq; chiz(); } }, T.ochiq ? 'Yig\'ish' : 'Yana ' + (j.qatorlar.length - KOR) + ' ta'));
  javonQism(k, j, T, chiz);
  return k;
}

// 07.11 kech: «Javondan oling» — muddati direktor belgilagan kunlar ichida tugaydi (hali o'tmagan). Eski server — 'javon' yo'q.
function javonQism(k, j, T, chiz) {
  if (!Array.isArray(j.javon) || !j.javon.length) return;
  k.append(h('h3', { class: 'oson-bolim' }, '⏳ Javondan oling (' + j.javon.length + ')'),
    h('div', { class: 'muted' }, 'Muddati ' + (j.javonKun || '') + ' kun ichida tugaydi — sotmang: javondan olib, direktorga ayting.'));
  const KOR = 5, kor = T.javonOchiq ? j.javon : j.javon.slice(0, KOR);
  kor.forEach((q) => k.append(h('div', { class: 'item javon-q' },
    h('b', { 'data-asl': '' }, q.nom),
    izohEl(['muddati: ' + kunMatn(q.muddat) + ' — ' + qoldiqMatn(q.msoni != null ? q.msoni : q.soni, q.dona),
      q.b ? asl(q.b) : null, q.firma ? asl(q.firma) : null]))));
  if (j.javon.length > KOR) k.append(h('button', { class: 's', onclick: () => { T.javonOchiq = !T.javonOchiq; chiz(); } }, T.javonOchiq ? 'Yig\'ish' : 'Yana ' + (j.javon.length - KOR) + ' ta'));
}

// «Qaysi filialda bor?» — yozgan sari (biroz kutib) qidiradi; har filialdagi soni va Oson'dagi sotuv narxi.
// Natija qaysi so'zga tegishli ekani (jSoz) saqlanadi — ekran qayta chizilganda eski natija yangi so'zga yopishmaydi.
// 07.11 (20261107210000_dori_reyestr): davlat reyestrida retsept bo'yicha beriladigan dori — kichik belgi (server 'rx').
export const rxBelgi = (d) => (d && d.rx === true ? h('span', { class: 'rx-belgi', title: 'Davlat reyestrida — retsept bo\'yicha beriladi' }, 'Retsept bilan') : null);

export function osonQidiruv(ctx, fil, o = {}) {
  const Q = O.qidir;
  const box = h('div', { class: o.ichida ? 'oson-qidir' : 'card oson-qidir' });
  if (!o.ichida) box.append(kartaSarlavha(o.sarlavha || 'Qaysi filialda bor? — Oson'));
  const holat = h('div', { class: 'muted', role: 'status' });
  const natija = h('div', {});
  const f = input(o.ixcham ? '🔍 Qaysi filialda bor?' : 'Dori nomi (Oson qoldig\'idan)', { inputmode: 'search', placeholder: o.ixcham ? 'Dori nomi, masalan: analgin' : 'Masalan: analgin 500', k: 'oson-qidir' });
  f.i.value = Q.soz;
  // 03.11 (xodimlar uchun): server har dori uchun hamma Oson filialini beradi ('f' — bizdagi filial, 'n' — Oson nomi, yo'q bo'lsa
  // soni 0) va ma'lumot vaqtini ('vaqt') — butun «Qoldiq» ro'yxati yuklanmaydi. Xodimning o'z filiali birinchi, «siz» belgisi bilan.
  const men = ctx.x && ctx.x.rol !== 'direktor' ? ctx.x.filialId : null;
  const rang = (x) => (O.j ? filRang(x.b) : 'f' + (Math.max(0, ((ctx.S && ctx.S.filiallar) || []).findIndex((fl) => fl.id === x.f)) % FIL_RANG));
  // 09.11 (qotish): yozayotganda eski natija o'chirilmaydi — xira bo'lib turadi, javob kelganda bir yo'la almashadi (sahifa
  // har harfda yig'ilib-yoyilib sakramasin).
  const kutish = () => { holat.textContent = 'Qidirilmoqda…'; natija.style.opacity = '.55'; natija.style.pointerEvents = 'none'; };
  const chiz = () => {
    natija.textContent = '';
    natija.style.opacity = '';
    natija.style.pointerEvents = '';
    holat.textContent = '';
    holat.classList.remove('oson-eski-matn');
    if (o.ixcham && !Q.soz.trim()) return;   // B ko'rinishi: bo'sh qidiruv — shovqinsiz
    if (Q.soz.trim().length < 2) { holat.textContent = 'Kamida 2 harf yozing — lotin yoki kirill harfida. Masalan: analgin 500'; return; }
    if (Q.xato) { holat.textContent = Q.xato; natija.append(h('button', { class: 's', onclick: izla }, 'Qayta urinish')); return; }
    if (!Q.j || Q.jSoz !== Q.soz.trim()) { holat.textContent = 'Qidirilmoqda…'; return; }
    if (!Q.j.length) { holat.textContent = 'Oson qoldig\'ida topilmadi — boshqacha yozib ko\'ring (masalan faqat nomi)'; return; }
    const vq = Q.j[0].vaqt;
    holat.textContent = (Q.j[0].tax ? 'Aniq topilmadi — o\'xshashlari: ' : '') + Q.j.length + ' ta dori topildi' + (Q.j.length >= 30 ? ' (birinchi 30 tasi — aniqroq yozing)' : '')
      + (vq ? ' · Oson ' + sana(vq) + ' ' + vaqt(vq) + ' holatiga' : '') + (vq && Date.now() - vq > ESKI_MS ? ' — ⚠ ' + oldinMatn(Date.now() - vq) + ' oldingi, eski bo\'lishi mumkin' : '');
    if (vq && Date.now() - vq > ESKI_MS) holat.classList.add('oson-eski-matn');
    Q.j.forEach((d) => {
      const fl = (d.filiallar || []).slice().sort((a, b) => (b.f === men && men ? 1 : 0) - (a.f === men && men ? 1 : 0));
      // Ikki Oson filiali bitta bizdagi filialga bog'langan bo'lsa — Oson nomi ham (adashmasin; filNomi qoidasi).
      const ikki = new Set(fl.filter((x, i) => x.f && fl.findIndex((y) => y.f === x.f) !== i).map((x) => x.f));
      // 'f' yo'q (eski server javobi) — «Qoldiq» ro'yxati yuklangan bo'lsa o'sha nom, aks holda Oson nomi.
      const fNom = (x) => (x.f ? fil(x.f) + (ikki.has(x.f) && x.n ? ' (' + x.n + ')' : '') : O.j ? filNomi(fil)(x.b) : x.n || x.b);
      natija.append(h('div', { class: 'item' },
        h('div', { class: 'line', style: 'border:0;padding:0' }, h('b', { 'data-asl': '' }, d.nom), d.narx ? h('b', { style: 'white-space:nowrap' }, H.som(d.narx)) : null),
        d.ishlab ? h('div', { class: 'muted', style: 'font-size:13px', 'data-asl': '' }, d.ishlab) : null,
        rxBelgi(d),
        h('div', { class: 'oq-qf-royxat' }, ...fl.map((x) => h('div', { class: 'oq-qf' + (men && x.f === men ? ' men' : '') },
          h('span', { class: 'oq-fil ' + rang(x), 'data-asl': '' }, fNom(x)), men && x.f === men ? h('span', { class: 'muted' }, '(siz)') : null,
          h('b', { class: x.soni > 0 ? 'bor' : 'yoq' }, x.soni > 0 ? qoldiqMatn(x.soni, x.dona) : 'yo\'q')))),
        // 07.11 kech: boshqa filialda bor — o'sha yerdan so'rash (so'rash oynasida har filial qoldig'i, eng ko'pi tanlangan).
        ctx.server && ctx.amalFon && fl.some((x) => x.f && x.f !== men && x.soni > 0)
          ? h('button', { type: 'button', class: 's sorov-t', onclick: () => sorashOch(ctx, { nom: d.nom, filial: men || undefined, qoldiq: fl, vaqt: d.vaqt }) }, '📦 Boshqa filialdan so\'rash') : null,
        // 07.11: analog — o'z filialida (direktorda — hech qayerda) yo'q bo'lsa ajralib turadi.
        d.g && !ctx.qidiruvYoq ? h('button', { type: 'button', class: 's analog-t', onclick: () => analogOyna(ctx, fil, d) },
          (men ? !fl.some((x) => x.f === men && x.soni > 0) : !fl.some((x) => x.soni > 0)) ? '🔄 Yo\'q — analogini ko\'rish' : '🔄 Analog') : null));
    });
  };
  const izla = () => {
    const avlod = ++Q.avlod, soz = Q.soz.trim();
    Q.xato = null;
    if (soz.length >= 2 && natija.childNodes.length && Q.chiz === chiz) kutish(); else if (Q.chiz) Q.chiz();
    if (soz.length < 2) return;
    Q.yukSoz = soz;   // audit 06.11: shu so'z ketayotgan bo'lsa — qayta chizish yana so'ramaydi
    ctx.oqi('osonQidir', soz).then((j) => { if (avlod === Q.avlod) { Q.yukSoz = null; Q.j = Array.isArray(j) ? j : []; Q.jSoz = soz; Q.chiz && Q.chiz(); } },
      (e) => { if (avlod === Q.avlod) { Q.yukSoz = null; Q.xatoSoz = soz; Q.xato = (e && e.message) || 'Qidirib bo\'lmadi'; Q.chiz && Q.chiz(); } });
  };
  Q.chiz = chiz;   // eng oxirgi chizilgan nusxa — kutayotgan qidiruv natijani shunga chizadi
  f.i.addEventListener('input', () => { Q.chiz = chiz; Q.soz = f.i.value; clearTimeout(Q.taymer); Q.taymer = setTimeout(izla, 400);
    if (Q.soz.trim().length >= 2 && natija.childNodes.length) kutish(); else chiz(); });
  // 06.11: qutidagi shtrix-kod (kamera, qo'llab-quvvatlansa) — raqam qidiruvga yoziladi.
  box.append(h('div', { class: 'skan-maydon' }, f.el, skanerTugma((kod) => { f.i.value = kod; Q.soz = kod; clearTimeout(Q.taymer); izla(); })), holat, natija);
  // Qayta chizilganda: natija yo'q va shu so'z ketmayotgan bo'lsa so'raladi; xatodan keyin — faqat «Qayta urinish» bilan (audit 06.11:
  // har chizishda yangi so'rov ketardi).
  const sz = Q.soz.trim();
  if (sz.length >= 2 && Q.jSoz !== sz && Q.yukSoz !== sz && !(Q.xato && Q.xatoSoz === sz)) izla(); else chiz();
  return box;
}

// Direktor: «kam qoldi» chegarasi va Oson filiali → bizdagi filial (defektura shu filialga yoziladi).
function sozlaSheet(ctx, fil, chiz) {
  const j = O.j;
  sheet('Oson qoldig\'i — sozlash', (box, close) => {
    // Saqlansa — xabar va ro'yxat yangilanadi (oyna ochiq qoladi); saqlanmasa — oyna yopiladi (noto'g'ri ✓ qolmasin).
    const natija = (r) => { if (r == null) { close(); return; } ctx.toast('Saqlandi ✓'); yukla(ctx, true).then(chiz, chiz); };
    box.append(h('div', { class: 'muted' }, 'Kam qoldi — shuncha va undan kam quti qolsa ko\'rinadi (Oson\'da dorining o\'z minimumi bo\'lsa — o\'shanga qaraladi).'),
      pills([0, 1, 2, 3, 5, 10].map((n) => [n, n === 0 ? 'Faqat tugaganlar' : n + ' quti']), j.chegara,
        (v) => ctx.amal('osonChegara', v).then(natija), 'Chegara'));
    const filiallar = (ctx.S.filiallar || []);
    j.filiallar.forEach((f) => box.append(h('div', { class: 'muted', style: 'margin-top:12px' }, 'Oson\'da «', asl(f.nom), '» — bizda:'),
      pills([['', 'Tanlanmagan'], ...filiallar.map((x) => [x.id, fil(x.id)])], f.filial || '',
        (v) => ctx.amal('osonFilial', f.id, v).then(natija), 'Filial: ' + f.nom)));
  }, { fokus: false });
}

// Sinov uchun (tests): modul holatini tozalash.
export function osonUnut() { Object.assign(O, BOSH()); clearTimeout(sonTaymer); sonTaymer = 0; sonEskiChizildi = null; }

// 07.11 tun: direktor global qidiruvidan — «Qaysi filialda bor?» shu so'z bilan ochiladi (chizilganda o'zi qidiradi).
export function osonQidiruvQoy(soz) { Object.assign(O.qidir, { soz: String(soz || ''), j: null, jSoz: null, xato: null }); }

// ---------- Analog (07.11; foydalanuvchi: "3. qo'shamiz") — «Qaysi filialda bor?» natijasida «Analog» tugmasi ----------
// Server (oson_analog): bog'langan analoglar (xodim/direktor bir marta bog'lagan) va nomi bir xil (boshqa ishlab chiqaruvchi yoki
// doza). Bazada ta'sir etuvchi modda yo'q — farmatsevt tekshiradi. Bog'lash — «Qaysi filialda bor?» qidiruvi bilan dori tanlanadi.
export function analogOyna(ctx, fil, d) {
  sheet('Analoglar', (box) => {
    const ichi = h('div', {});
    let j = null, xato = null, bogla = false, soz = '', top = null, topSoz = '', avlod = 0, taymer = 0;
    const fNom = (x) => (x.f ? fil(x.f) : x.n || x.b);
    const yukla = () => {
      j = null; xato = null; chiz();
      ctx.oqi('osonAnalog', d.g).then((r) => { j = r; chiz(); }, (e) => { xato = (e && e.message) || 'Olinmadi'; chiz(); });
    };
    const qidir = (s) => {
      const a = ++avlod;
      ctx.oqi('osonQidir', s).then((r) => { if (a === avlod) { top = Array.isArray(r) ? r.filter((x) => x.g && x.g !== d.g) : []; topSoz = s; chizTop(); } },
        (e) => { if (a === avlod) { ctx.toast((e && e.message) || 'Qidirib bo\'lmadi', 'xato'); } });
    };
    const chiz = () => {
      ichi.textContent = '';
      ichi.append(h('div', {}, h('b', { 'data-asl': '' }, d.nom), d.ishlab ? h('div', { class: 'muted', 'data-asl': '' }, d.ishlab) : null),
        h('div', { class: 'msg info' }, 'Analogni farmatsevt tasdiqlaydi: ta\'sir etuvchi modda, doza va shaklini tekshiring.'));
      // Audit 10.11 kech: qoldiqlar eskirgan bo'lsa — ogohlantirish (server vaqt bermasa — qidiruv natijasining vaqti).
      if (j) { const ve = osonVaqtEl(j.vaqt !== undefined ? j.vaqt : d.vaqt, { faqatEski: true }); if (ve) ichi.append(ve); }
      if (xato) { ichi.append(h('div', { class: 'muted' }, xato), h('button', { class: 's', onclick: yukla }, 'Qayta urinish')); return; }
      if (!j) { ichi.append(h('div', { class: 'muted', role: 'status' }, 'Yuklanmoqda…')); return; }
      // Ta'sir etuvchi modda (06.11 kech, 20261107160000_dori_mnn): ilova aniqlagan. Audit (…170000_analog_kalit): direktor —
      // dorining moddasi noto'g'ri bo'lsa «rad» (qaytarsa bo'ladi), bitta juft noto'g'ri bo'lsa — faqat shu juft «analog emas».
      const direktor = ctx.x && ctx.x.rol === 'direktor';
      const amalTugma = (matn, savol, amal, ...a) => h('button', { class: 'link', onclick: async () => {
        if (savol && !(await tasdiqlash(savol))) return;
        const r = await ctx.amalFon(amal, ...a);
        if (r != null) { ctx.toast('Saqlandi'); yukla(); }
      } }, matn);
      const prolong = (m) => /\[пролонг\]/.test(m);
      if (j.mnn) {
        ichi.append(h('div', { class: 'analog-mnn' }, h('span', { class: 'muted' }, 'Ta\'sir etuvchi modda: '), h('b', { 'data-asl': '' }, j.mnn.replace(' [пролонг]', '')),
          prolong(j.mnn) ? h('span', {}, ' (uzaytirilgan ta\'sirli)') : null,
          h('div', { class: 'muted', style: 'font-size:13px' }, 'Ilova aniqlagan — tarkibini qutidan tekshiring.'),
          direktor ? amalTugma('Bu dorining moddasi noto\'g\'ri', '«' + d.nom + '» — modda noto\'g\'ri aniqlanganmi? Bu dori modda bo\'yicha analoglarda chiqmaydi (keyin qaytarsa bo\'ladi).', 'mnnRad', d.g) : null));
      } else if (direktor && j.mnn_rad) {
        ichi.append(h('div', { class: 'analog-mnn' }, h('span', { class: 'muted' }, 'Modda rad etilgan: '), h('b', { 'data-asl': '' }, j.mnn_rad.replace(' [пролонг]', '')),
          amalTugma('Qaytarish', null, 'mnnQaytar', d.g)));
      }
      const l = h('div', { class: 'list' });
      if (!j.qatorlar.length) l.append(h('div', { class: 'muted' }, 'Analog topilmadi. Bilsangiz — pastda bog\'lab qo\'ying, keyingi safar o\'zi chiqadi.'));
      j.qatorlar.forEach((x) => {
        const bor = (x.filiallar || []).filter((f) => Number(f.soni) > 0);
        l.append(h('div', { class: 'item' },
          h('div', { class: 'line', style: 'border:0;padding:0' }, h('b', { 'data-asl': '' }, x.nom), x.narx ? h('b', { style: 'white-space:nowrap' }, H.som(x.narx)) : null),
          x.ishlab ? h('div', { class: 'muted', style: 'font-size:13px', 'data-asl': '' }, x.ishlab) : null,
          rxBelgi(x),
          h('div', { class: x.tur === 'bog' || x.tur === 'mnn' ? 'muted' : 'oson-otgan' }, x.tur === 'bog' ? 'Bog\'langan analog' + (x.kim ? ' · ' + x.kim : '')
            : x.tur === 'mnn' ? '✓ Modda, shakl va doza mos' : x.tur === 'mnn2' ? 'Shu modda — doza va shaklini tekshiring' : 'Nomi o\'xshash — tarkibini tekshiring'),
          h('div', { class: 'oq-qf-royxat' }, ...(bor.length ? bor : (x.filiallar || []).slice(0, 1)).map((f) => h('div', { class: 'oq-qf' },
            h('span', { class: 'oq-fil', 'data-asl': '' }, fNom(f)), h('b', { class: Number(f.soni) > 0 ? 'bor' : 'yoq' }, Number(f.soni) > 0 ? qoldiqMatn(f.soni, f.dona) : 'yo\'q')))),
          x.tur === 'bog' && ctx.x && (ctx.x.rol === 'direktor' || x.kim === ctx.x.ism) ? h('button', { class: 'link', onclick: async () => {
            if (!(await tasdiqlash('«' + x.nom + '» analoglar ro\'yxatidan olib tashlansinmi?'))) return;
            const r = await ctx.amalFon('analogUzish', x.g);
            if (r != null) { ctx.toast('Olib tashlandi'); yukla(); }
          } }, 'Analog emas — olib tashlash') : null,
          direktor && x.tur !== 'bog' ? amalTugma('Bu analog emas — olib tashlash', '«' + x.nom + '» — «' + d.nom + '» ning analogi emasmi? Bu juft boshqa chiqmaydi.', 'analogEmas', d.g, x.g) : null));
      });
      if (j.koproq > 0) l.append(h('div', { class: 'muted', style: 'font-size:13px' }, 'Yana ' + j.koproq + ' ta dori ko\'rsatilmadi — o\'z filialingizda bori va qoldig\'i ko\'plari birinchi.'));
      ichi.append(l);
      if (!bogla) { ichi.append(h('button', { class: 's', onclick: () => { bogla = true; chiz(); setTimeout(() => { try { f.i.focus(); } catch (e) { /* bo'sh */ } }, 50); } }, '🔗 Analog bog\'lash')); return; }
      ichi.append(f.el, topEl);
      chizTop();
    };
    // Bog'lash qidiruvi: maydon bir marta yaratiladi, natija — alohida qism (yozib turganda maydon qayta yaratilmaydi).
    const f = input('Analog dorini toping (Oson qoldig\'idan)', { inputmode: 'search', placeholder: 'Masalan: panadol' });
    const topEl = h('div', {});
    f.i.addEventListener('input', () => {
      soz = f.i.value; clearTimeout(taymer);
      if (soz.trim().length < 2) { top = null; avlod++; chizTop(); return; }
      taymer = setTimeout(() => qidir(soz.trim()), 400);
    });
    const chizTop = () => {
      topEl.textContent = '';
      if (top && topSoz === soz.trim()) {
        if (!top.length) topEl.append(h('div', { class: 'muted' }, 'Topilmadi'));
        top.slice(0, 10).forEach((x) => topEl.append(h('button', { type: 'button', class: 'item inv-tanla', onclick: async () => {
          if (!(await tasdiqlash('«' + d.nom + '» va «' + x.nom + '» — analog deb bog\'lansinmi?'))) return;
          const r = await ctx.amalFon('analogBogla', d.g, x.g);
          if (r != null) { ctx.toast('Bog\'landi ✓ — endi ikkalasida ham chiqadi'); bogla = false; soz = ''; f.i.value = ''; top = null; yukla(); }
        } }, h('span', { 'data-asl': '' }, x.nom), x.ishlab ? h('span', { class: 'muted', 'data-asl': '' }, ' · ' + x.ishlab) : null)));
      }
    };
    box.append(ichi);
    yukla();
    // Audit 09.11: oyna yopilganda kutayotgan qidiruv bekor (yopilgan oynadan so'rov va xato xabari chiqmasin).
    return () => { clearTimeout(taymer); avlod++; };
  }, { fokus: false });
}

// 07.11 (yangi ko'rinish — Ombor bo'limi): kichik kartalardagi sonlar va to'g'ridan-to'g'ri bo'lim. Ma'lumot shu modul keshidan
// (1 daqiqa); yuklanmagan bo'lsa — fonda olinadi va chiz() chaqiriladi. Hali kelmagan son — null.
// Audit 10.11 kech: xatoda karta abadiy «…» qolardi — endi xato: true (tugayapti), muddatXato: true; osonSonQayta — qayta urinish.
// Audit 10.11 (A4 №3, B4 №3): Ombor kartalari — 60 s dan eski bo'lsa fonda yangilanadi (muddat ro'yxati xatodan keyin ham, 60 s
// o'tib), son yoki vaqt o'zgarsagina qayta chiziladi. Ombor ochiq turganda yengil taymer (60 s): yangilaydi va 45 daqiqalik eskirish
// chegarasi o'tganda «⚠» chiqishi uchun qayta chizadi; ekranda kartalar ([data-oson-sonlar]) bo'lmasa — taymer to'xtaydi.
function sonYangila(ctx, chiz) {
  if (!O.j && !O.xato && !O.yuklanmoqda) yukla(ctx).then(() => keyinChiz(chiz), () => keyinChiz(chiz));
  else if (O.j && !O.yuklanmoqda && Date.now() - O.vaqt > 60000) {
    const oldin = O.j.vaqt + ':' + JSON.stringify(O.j.sanoq || {});
    yukla(ctx).then(() => { if (O.j && O.j.vaqt + ':' + JSON.stringify(O.j.sanoq || {}) !== oldin) keyinChiz(chiz); });
  }
  const M = O.muddat;
  const muddatEski = !(M.j && M.j.oy === M.oy) || Date.now() - M.vaqt > 60000;
  if (O.j && !M.yuklanmoqda && muddatEski && (!M.xato || Date.now() - M.vaqt > 60000)) {
    const oldinM = M.j && M.j.oy === M.oy ? M.j.q.length : null, xatoEdi = !!M.xato;
    muddatYukla(ctx).then(() => { if (!(M.j && M.j.oy === M.oy) || M.j.q.length !== oldinM || xatoEdi !== !!M.xato) keyinChiz(chiz); });
  }
}
const SON_TAYMER_MS = 60000;
let sonTaymer = 0, sonEskiChizildi = null;
function sonKuzat(ctx, chiz) {
  if (sonTaymer || typeof setTimeout !== 'function') return;
  sonTaymer = setTimeout(() => {
    sonTaymer = 0;
    if (typeof document === 'undefined' || !document.querySelector('[data-oson-sonlar]')) return;   // Ombor yopilgan — to'xtaydi
    if (!document.hidden) {
      sonYangila(ctx, chiz);
      // Yangi ma'lumot kelmasa ham vaqt o'tib «eski» bo'lib qolishi mumkin — chegara o'tganda bir marta qayta chiziladi.
      if (O.j && osonEskimi(O.j.vaqt) !== sonEskiChizildi) keyinChiz(chiz);
    }
    sonKuzat(ctx, chiz);
  }, SON_TAYMER_MS);
  if (sonTaymer && typeof sonTaymer.unref === 'function') sonTaymer.unref();
}
export function osonSonlar(ctx, chiz) {
  if (!ctx.server) return null;
  sonYangila(ctx, chiz);
  sonKuzat(ctx, chiz);
  const M = O.muddat;
  if (O.j) sonEskiChizildi = osonEskimi(O.j.vaqt);
  const san = O.j && O.j.sanoq && O.j.sanoq[''];
  const muddat = M.j && M.j.oy === M.oy ? M.j.q.length : null;
  // vaqt / eski — Oson ro'yxati vaqti (A4 №3: kartada «⚠» va ustida ogohlantirish).
  return { tugayapti: san ? (san.t || 0) + (san.k || 0) : null, muddat, qayta: () => osonSonQayta(ctx, chiz),
    vaqt: O.j ? (O.j.vaqt == null ? null : O.j.vaqt) : undefined, eski: !!O.j && osonEskimi(O.j.vaqt),
    xato: !O.j && !!O.xato && !O.yuklanmoqda,
    // Muddat ro'yxati asosiy ro'yxatdan keyin so'raladi — u olinmasa, muddat ham «olinmadi».
    muddatXato: muddat == null && !M.yuklanmoqda && (!!M.xato || (!O.j && !!O.xato && !O.yuklanmoqda)) };
}
export function osonSonQayta(ctx, chiz) {
  if (!ctx.server) return;
  O.xato = null; O.muddat.xato = null;
  const keyin = () => keyinChiz(chiz);
  yukla(ctx, true).then(() => (O.j ? muddatYukla(ctx, true) : null)).then(keyin, keyin);
  keyinChiz(chiz);
}
// Qoldiq sahifasi shu bo'lim bilan ochilsin: 'tugadi' | 'kam' | 'kochir' | 'muddat' (filial tanlovi — hammasi).
export function osonRejimQoy(r) { O.rejim = r; O.filial = ''; }
