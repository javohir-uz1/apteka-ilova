// Mijoz bronlari (07.11 kech, 20261107220000_mijoz_boti): mijoz botda dorini 3 soatga bron qiladi — filial xodimi Bosh sahifada
// «📌 Bronlar (N)» kartasini ko'radi va oynada: «Tayyorladim» (mijozga «Tayyor — olib ketishingiz mumkin» boradi), «Olib ketdi»,
// «Bekor» (tasdiq bilan; mijozga xabar boradi). Bot xabaridagi tugmalar ham xuddi shu amal (api.mjs TUGMA_AMAL b/o/r).
// Faqat serverda (server: bron_royxat — OQISH, bron_holat — YENGIL). Bosh sahifa ochiq turganda har daqiqada yangilanadi;
// ro'yxat o'zgarsagina qayta chiziladi. Faol bron bo'lmasa — yashirin belgi (joy egallamaydi, yangilanish davom etadi).
import { h, kartaSarlavha, royxatHarakat, sheet, tasdiqlash, vaqt, faolmi, faolQaytganda } from './ui.mjs';

const YANGILASH = 60000;
const FAOL = new Set(['yangi', 'tayyor']);
const BB = () => ({ j: null, imzo: '', vaqt: 0, yuklanmoqda: null, xato: null, band: '', taymer: 0, oyna: null });
const B = BB();
// Sinov uchun (tests): modul holatini tozalash.
export function bronUnut() { clearTimeout(B.taymer); Object.assign(B, BB()); }

// Holat yozuvi va rangi (style.css tokenlari; alohida CSS yo'q).
const HOLAT = {
  yangi: ['Yangi — tayyorlang', 'var(--warn)'], tayyor: ['✓ Tayyor', 'var(--kirim)'], olindi: ['Olib ketildi', 'var(--muted)'],
  bekor: ['Bekor qilindi', 'var(--muted)'], muddati_otdi: ['Muddati o\'tdi', 'var(--muted)']
};
const asl = (t) => h('span', { 'data-asl': '' }, t);

function yukla(ctx, chiz, majbur = false) {
  if (B.yuklanmoqda) return B.yuklanmoqda;
  if (!majbur && (B.j || B.xato) && Date.now() - B.vaqt < YANGILASH) return null;
  B.yuklanmoqda = Promise.resolve().then(() => ctx.oqi('bronlar'))
    .then((j) => {
      if (!Array.isArray(j)) throw new Error('Server javobi tushunarsiz');
      const imzo = JSON.stringify(j), ozgardi = imzo !== B.imzo || !!B.xato;
      B.j = j; B.imzo = imzo; B.xato = null;
      return ozgardi;
    }).catch((e) => { B.xato = (e && e.message) || 'Bronlar olinmadi'; return 'xato'; })
    .then((ozgardi) => {
      B.vaqt = Date.now(); B.yuklanmoqda = null;
      // Xatoda Bosh sahifa qayta chizilmaydi (eski ro'yxat qoladi); ochiq oyna «Yangilanmadi» ni ko'rsatadi.
      if (ozgardi === true) chiz();
      if (ozgardi && B.oyna) B.oyna();
    });
  return B.yuklanmoqda;
}

// Bosh sahifa ochiq turganda (karta yoki yashirin belgisi DOM'da) — har daqiqa; sahifa yopilsa to'xtaydi, qayta chizilganda boshlanadi.
let kuzatOxirgi = null;   // audit 11.11: jimlikdan qaytganda — darhol yangilash
faolQaytganda(() => { if (kuzatOxirgi && !document.hidden && document.querySelector('[data-bron-karta]')) yukla(kuzatOxirgi[0], kuzatOxirgi[1], true); });
function kuzat(ctx, chiz) {
  kuzatOxirgi = [ctx, chiz];
  if (B.taymer || typeof setTimeout !== 'function') return;
  B.taymer = setTimeout(() => {
    B.taymer = 0;
    if (typeof document === 'undefined' || !document.querySelector('[data-bron-karta]')) return;
    if (!document.hidden && faolmi()) yukla(ctx, chiz, true);   // audit 10.11: jim telefon so'rov yubormaydi
    kuzat(ctx, chiz);
  }, YANGILASH);
  if (B.taymer && typeof B.taymer.unref === 'function') B.taymer.unref();   // Node (testlar) jarayonni ushlab turmasin
}

const izoh = (b, fil) => '№' + b.raqam + ' · ' + fil(b.f || '') + ' · ' + vaqt(b.gacha) + ' gacha' + (b.soni > 1 ? ' · ' + b.soni + ' ta' : '');

// Holatni o'zgartirish: bekor — tasdiq bilan. Natija kelgach ro'yxat qayta olinadi.
async function holatQoy(ctx, chiz, b, holat) {
  if (B.band) return;
  if (holat === 'bekor' && !(await tasdiqlash('Bron №' + b.raqam + ' (' + b.nom + ') bekor qilinsinmi? Mijozga «bekor qilindi» xabari boradi.'))) return;
  B.band = b.id;
  if (B.oyna) B.oyna();
  try {
    const r = await ctx.amalFon('bronHolat', b.id, holat);
    if (r != null) {
      b.holat = holat;   // darhol (ro'yxat kelguncha)
      ctx.toast(holat === 'tayyor' ? 'Tayyor ✓ — mijozga xabar ketdi' : holat === 'olindi' ? 'Olib ketildi ✓' : 'Bron bekor qilindi — mijozga aytildi');
    }
  } finally {
    B.band = '';
    await yukla(ctx, chiz, true);
    if (B.oyna) B.oyna();
  }
}

function tugmalar(ctx, chiz, b) {
  if (!FAOL.has(b.holat) && b.holat !== 'muddati_otdi') return null;
  const band = B.band ? '' : null;
  const t = (matn, holat, cls) => h('button', { type: 'button', class: cls, disabled: band, style: cls === 'link' ? 'color:var(--red)' : null, onclick: () => holatQoy(ctx, chiz, b, holat) },
    B.band === b.id && cls === 'p' ? 'Saqlanmoqda…' : matn);
  if (b.holat === 'muddati_otdi') return h('div', { class: 'row bron-t' }, t('Olib ketdi (kechikib keldi)', 'olindi', 's'));
  return h('div', { class: 'row bron-t' },
    b.holat === 'yangi' ? t('Tayyorladim', 'tayyor', 'p') : t('Olib ketdi', 'olindi', 'p'),
    b.holat === 'yangi' ? t('Olib ketdi', 'olindi', 's') : null,
    t('Bekor', 'bekor', 'link'));
}

function qator(b, fil, ctx, chiz, bilanTugma) {
  const [hm, rang] = HOLAT[b.holat] || [b.holat, 'var(--muted)'];
  return h('div', { class: 'item bron-q', 'data-bron': b.id, 'data-rk': b.id },
    h('div', { class: 'line', style: 'border:0;padding:0' }, h('b', { 'data-asl': '' }, b.nom),
      h('span', { class: 'bron-h', style: 'font-weight:600;white-space:nowrap;color:' + rang }, hm)),
    h('div', { class: 'muted' }, izoh(b, fil), b.ism ? [' · ', asl(b.ism)] : null),
    b.kim && !FAOL.has(b.holat) ? h('div', { class: 'muted', style: 'font-size:13px' }, 'Belgiladi: ', asl(b.kim)) : null,
    bilanTugma ? tugmalar(ctx, chiz, b) : null);
}

// Ro'yxat oynasi: faollari (tugmalar bilan), pastda — oxirgi 24 soatda yopilganlar.
function royxatOyna(ctx, fil, chiz) {
  sheet('📌 Bronlar', (box) => {
    const ich = h('div', {});
    box.append(ich);
    const ciz = () => {
      ich.textContent = '';
      const j = B.j || [];
      const faol = j.filter((b) => FAOL.has(b.holat)), boshqa = j.filter((b) => !FAOL.has(b.holat));
      ich.append(h('div', { class: 'muted' }, 'Mijoz bron raqamini aytadi. Dorini tayyorlab «Tayyorladim» ni bosing — mijozga xabar boradi. '
        + 'Olib ketgach — «Olib ketdi». Bron 3 soat turadi.'));
      if (B.xato) ich.append(h('div', { class: 'msg warn', role: 'status' }, 'Yangilanmadi: ' + B.xato));
      const l = h('div', { class: 'card list', style: 'margin-top:10px' });
      if (!faol.length) l.append(h('div', { class: 'muted' }, 'Hozir faol bron yo\'q.'));
      faol.forEach((b) => l.append(qator(b, fil, ctx, chiz, true)));
      ich.append(l);
      royxatHarakat(l, 'bron:oyna');   // 07.11 tun: «Olib ketdi» — qator yumshoq yo'qoladi
      if (boshqa.length) {
        const y = h('details', { class: 'ochil' }, h('summary', {}, 'Yopilganlar (24 soat) · ' + boshqa.length));
        const yl = h('div', { class: 'card list' });
        boshqa.forEach((b) => yl.append(qator(b, fil, ctx, chiz, b.holat === 'muddati_otdi')));
        y.append(yl);
        ich.append(y);
      }
    };
    B.oyna = ciz;
    ciz();
    return () => { if (B.oyna === ciz) B.oyna = null; };
  }, { fokus: false });
}

// Bosh sahifadagi karta (xodim): faol bronlar bo'lsa — «📌 Bronlar (N)», 3 tasi va oyna tugmasi; bo'lmasa — yashirin belgi.
// fil(id) — filial nomi; chiz() — Bosh sahifani qayta chizish (app.mjs). Server rejimida chaqiriladi.
export function bronKarta(ctx, fil, chiz) {
  yukla(ctx, chiz);
  kuzat(ctx, chiz);
  const faol = (B.j || []).filter((b) => FAOL.has(b.holat));
  if (!faol.length) return h('div', { 'data-bron-karta': '', hidden: true });
  const k = h('section', { class: 'card list bron-karta', 'data-bron-karta': '' }, kartaSarlavha('📌 Bronlar (' + faol.length + ')'));
  const yangi = faol.filter((b) => b.holat === 'yangi').length;
  k.append(h('div', { class: yangi ? 'msg warn' : 'muted' }, yangi
    ? yangi + ' ta yangi bron — mijoz 3 soat ichida keladi. Dorini tayyorlab qo\'ying.'
    : 'Hammasi tayyor — mijoz kelishini kuting.'));
  faol.slice(0, 3).forEach((b) => k.append(qator(b, fil, ctx, chiz, false)));
  royxatHarakat(k, 'bron:karta');
  k.append(h('button', { type: 'button', class: 'p', onclick: () => royxatOyna(ctx, fil, chiz) },
    faol.length > 3 ? 'Hammasi (' + faol.length + ') — tayyorlash' : 'Ochish — tayyorlash'));
  return k;
}
