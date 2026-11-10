// Kassa naqd nazorati (10.11 tun, server 20261110230000_kassa_nazorat; egasi: "karta va naqd ajralib tursin — men naqd pulni nazorat
// qilishim kerak, terminal puli to'g'ri bankka tushadi"; "o'tkazmani xodimlar direktorga jo'natadi — summa tushdimi deb, u pul shu kungi
// shu filial naqd savdosiga qo'shilib boradi; xodimlar asosiy ekranida so'rov, tasdiq — direktor asosiy ekranida").
// 1) otkazmaKarta — xodim: «Kartaga o'tkazma tushdimi?» so'rovi va bugungi so'rovlari; direktor: javob kutayotganlar (Tushdi / Tushmadi).
// 2) kassaNazoratView — direktor: har smena bo'yicha naqd farqi (yozilgan = kassadan + o'tkazma + qarz, − Oson naqd), to'plangan
//    qoldiq (filial + xodim), yopish, chegaralar. Karta — «Kassa ↔ Oson»da kun bo'yicha (10.11 kech).
// 3) naqdFarqSoz / kartaFarqSoz — ikkala oynada bir xil so'z va daraja (10.11 kech, audit: "bir xil pul har xil ko'rinardi").
import * as H from './hisob.mjs';
import { h, input, kartaSarlavha, pills, sana, sheet, tasdiqlash, vaqt, yordam } from './ui.mjs';

const YANGILASH = 30000;
const SS = () => ({ j: null, xato: null, vaqt: 0, yuklanmoqda: null, imzo: '', taymer: 0, xatoChizildi: false });
const S = SS();
const KF = { j: null, xato: null, kun: 14, yuklanmoqda: null, vaqt: 0 };
// Sinov uchun (tests): modul holatini tozalash.
export function kassaUnut() { clearTimeout(S.taymer); Object.assign(S, SS()); Object.assign(KF, { j: null, xato: null, kun: 14, yuklanmoqda: null, vaqt: 0 }); KK.clear(); }
// Audit 1: o'tkazmaga javob, savdo kiritish yoki yopishdan keyin — «Savdo kiritish» va «Kassa nazorati» keshi eskirgan (qayta so'raladi).
export function kassaYangila() { KK.clear(); KF.vaqt = 0; }

export const TURI = { payme: 'Payme', click: 'Click', boshqa: 'Boshqa' };
const asl = (t) => h('span', { 'data-asl': '' }, t || '');
const qachon = (ts) => (ts ? (sana(ts) === sana(Date.now()) ? vaqt(ts) : sana(ts) + ' ' + vaqt(ts)) : '');
const HOLAT = { kutilmoqda: ['Javob kutilmoqda', 'ogoh'], tushdi: ['✓ Tushdi', 'ok'], tushmadi: ['✗ Tushmadi', 'yoq'], bekor: ['Bekor qilindi', 'muted'] };

function yukla(ctx, chiz, majbur = false) {
  if (S.yuklanmoqda) return majbur ? S.yuklanmoqda.then(() => yukla(ctx, chiz, true)) : S.yuklanmoqda;
  if (!majbur && (S.j || S.xato) && Date.now() - S.vaqt < YANGILASH) return null;
  S.yuklanmoqda = Promise.resolve().then(() => ctx.oqi('otkazmaRoyxat'))
    .then((j) => {
      if (!j || typeof j !== 'object' || !Array.isArray(j.qatorlar)) throw new Error('Server javobi tushunarsiz');
      const imzo = JSON.stringify(j), ozgardi = imzo !== S.imzo || !!S.xato;
      S.j = j; S.imzo = imzo; S.xato = null;
      return ozgardi;
    })
    .catch((e) => { S.xato = (e && e.message) || 'Ro\'yxat olinmadi'; return 'xato'; })
    .then((ozgardi) => {
      S.vaqt = Date.now(); S.yuklanmoqda = null;
      if ((ozgardi === true || (ozgardi === 'xato' && !S.j && !S.xatoChizildi)) && chiz) { if (ozgardi === 'xato') S.xatoChizildi = true; chiz(); }
      return ozgardi;
    });
  return S.yuklanmoqda;
}
function kuzat(ctx, chiz) {
  if (S.taymer || typeof setTimeout !== 'function') return;
  S.taymer = setTimeout(() => {
    S.taymer = 0;
    if (typeof document === 'undefined' || !document.querySelector('[data-otkazma-karta]')) return;
    if (!document.hidden) yukla(ctx, chiz, true);
    kuzat(ctx, chiz);
  }, YANGILASH);
  if (S.taymer && typeof S.taymer.unref === 'function') S.taymer.unref();
}

// ---------- Asosiy ekran kartasi ----------
export function otkazmaKarta(ctx, chiz) {
  if (!ctx.server) return null;
  yukla(ctx, chiz);
  kuzat(ctx, chiz);
  const dir = !!(ctx.x && ctx.x.rol === 'direktor');
  const rows = S.j ? S.j.qatorlar : [];
  if (dir) {
    const kut = rows.filter((o) => o.holat === 'kutilmoqda');
    // Javob kutayotgan so'rov yo'q — karta ko'rinmaydi (kuzatuv davom etadi).
    if (!kut.length) return h('div', { 'data-otkazma-karta': '', hidden: true });
    const k = h('section', { class: 'card list otkazma-karta muhim', 'data-otkazma-karta': '' },
      kartaSarlavha('💳 Kartaga tushdimi? (' + kut.length + ')'),
      h('div', { class: 'muted' }, 'Mijoz Payme/Click bilan kartaga o\'tkazgan. Kartangizdagi SMS yoki ilovaga qarang. «Tushdi» — shu kungi naqd savdoga qo\'shiladi.'));
    kut.forEach((o) => k.append(javobQator(ctx, chiz, o)));
    return k;
  }
  const k = h('section', { class: 'card list otkazma-karta', 'data-otkazma-karta': '' }, kartaSarlavha('💳 Kartaga o\'tkazma'));
  if (!S.j) {
    k.append(h('div', { class: 'muted' }, S.xato ? 'Ro\'yxat olinmadi: ' + S.xato : 'Yuklanmoqda…'));
    return k;
  }
  const bugun = H.kunKey(Date.now());
  const meniki = rows.filter((o) => H.kunKey(o.vaqt) === bugun || o.holat === 'kutilmoqda');
  if (!meniki.length) k.append(h('div', { class: 'muted' }, 'Mijoz Payme yoki Click bilan pul o\'tkazsa — summani direktorga yuboring. Direktor «tushdi» desa, dorini bering.'));
  meniki.slice(0, 6).forEach((o) => k.append(xodimQator(ctx, chiz, o)));
  k.append(h('button', { type: 'button', class: 's katta', onclick: () => sorashOyna(ctx, chiz) }, '+ Direktordan so\'rash'));
  return k;
}

function holatEl(o) {
  const [t, c] = HOLAT[o.holat] || [o.holat, 'muted'];
  return h('span', { class: 'belgi ' + c }, t);
}

function xodimQator(ctx, chiz, o) {
  return h('div', { class: 'otk-q' },
    h('div', { class: 'otk-s' }, h('b', {}, H.som(o.summa)), h('span', { class: 'muted' }, ' · ' + (TURI[o.turi] || o.turi) + ' · ' + qachon(o.vaqt)
      + (o.ism && ctx.x && o.xodimId !== ctx.x.id ? ' · ' : '')), o.ism && ctx.x && o.xodimId !== ctx.x.id ? asl(o.ism) : null),
    h('div', { class: 'otk-h' }, holatEl(o),
      o.holat === 'kutilmoqda' && ctx.x && o.xodimId === ctx.x.id
        ? h('button', { type: 'button', class: 'link', onclick: async (e) => {
          const t = e.currentTarget;
          if (t.disabled || !(await tasdiqlash(H.som(o.summa) + ' so\'rovi bekor qilinsinmi?'))) return;
          t.disabled = true;
          const r = await ctx.amalFon('otkazmaBekor', o.id);
          t.disabled = false;
          if (r !== null) { ctx.toast('So\'rov bekor qilindi'); yukla(ctx, chiz, true); }
        } }, 'Bekor qilish') : null));
}

function javobQator(ctx, chiz, o) {
  let band = false;
  const javob = async (tushdi, tugma) => {
    if (band) return;
    if (!(await tasdiqlash(H.som(o.summa) + ' (' + (TURI[o.turi] || o.turi) + ') — «' + (o.fn || '') + '», «' + (o.ism || '') + '»\n'
      + (tushdi ? 'Kartaga TUSHDI deb belgilaysizmi? Shu kungi naqd savdoga qo\'shiladi.' : 'Kartaga TUSHMADI deb belgilaysizmi? Xodimga xabar boradi.')))) return;
    band = true; tugma.disabled = true;
    // Audit 1: amalFon eski ro'yxatdan qayta chizadi — qator shu zahoti «javob berilgan» bo'lsin (ikkinchi bosish yo'q); xatoda qaytadi.
    o.holat = tushdi ? 'tushdi' : 'tushmadi';
    const r = await ctx.amalFon('otkazmaJavob', o.id, tushdi);
    band = false; tugma.disabled = false;
    if (r === null) { o.holat = 'kutilmoqda'; S.imzo = ''; if (chiz) chiz(); return; }
    kassaYangila();
    if (r && r.takror) { yukla(ctx, chiz, true); return; }   // audit 2: takror — ilova o'zi xabar beradi
    ctx.toast(tushdi ? (r.qoshildi ? 'Tushdi ✓ — ' + H.som(r.qoshildi) + ' savdoga qo\'shildi' : 'Tushdi ✓ — savdo kiritilganda qo\'shiladi') : 'Tushmadi — xodimga xabar yuborildi');
    yukla(ctx, chiz, true);
  };
  const ha = h('button', { type: 'button', class: 'p', onclick: (e) => javob(true, e.currentTarget) }, '✓ Tushdi');
  const yoq = h('button', { type: 'button', class: 's', onclick: (e) => javob(false, e.currentTarget) }, 'Tushmadi');
  return h('div', { class: 'otk-q otk-javob' },
    h('div', { class: 'otk-s' }, h('b', { class: 'otk-summa' }, H.som(o.summa)), h('span', { class: 'muted' }, ' · ' + (TURI[o.turi] || o.turi))),
    h('div', { class: 'muted' }, asl(o.fn), ' · ', asl(o.ism), ' · ' + qachon(o.vaqt), o.izoh ? [' · ', asl(o.izoh)] : null),
    h('div', { class: 'row' }, ha, yoq));
}

function sorashOyna(ctx, chiz) {
  sheet('Kartaga tushdimi?', (box, close) => {
    // Audit 2: ikkinchi ish joyida ishlayotgan xodim — qaysi filialda sotildi (o'tkazma o'sha filial savdosiga qo'shiladi).
    const men = (ctx.S && ctx.S.men) || {};
    const uy = ctx.x && ctx.x.filialId, qf = (ctx.x && ctx.x.qoshimchaFilial) || men.qoshimchaFilial;
    const fn = (id) => (((ctx.S && ctx.S.filiallar) || []).find((z) => z.id === id) || {}).nom || id;
    const f = { turi: 'payme', filial: uy || '' };
    const filJoy = h('div', {});
    const filChiz = () => filJoy.replaceChildren(pills([[uy, fn(uy)], [qf, fn(qf)]], f.filial, (v) => { f.filial = v; filChiz(); }, 'Filial'));
    if (uy && qf && qf !== uy) filChiz();
    const sum = input('Summa, so\'m', { placeholder: '0', autofocus: true });
    const tur = h('div', {});
    const turChiz = () => tur.replaceChildren(pills(Object.entries(TURI), f.turi, (v) => { f.turi = v; turChiz(); }, 'Qayerdan'));
    turChiz();
    const iz = input('Izoh (ixtiyoriy)', { inputmode: 'text', maxlength: 200, placeholder: 'Masalan: Trombopol uchun (mijoz ismi/telefoni kerak emas)' });
    let band = false;
    const yubor = h('button', { type: 'button', class: 'p katta', onclick: async () => {
      if (band) return;
      const n = H.pul(String(sum.i.value).trim());
      if (!n || n <= 0) { sum.xato('Summani yozing'); sum.i.focus(); return; }
      if (n > 100000000) { sum.xato('Summa juda katta (100 mln so\'mgacha)'); sum.i.focus(); return; }
      band = true; yubor.disabled = true;
      const r = await ctx.amalFon('otkazmaYoz', { summa: n, turi: f.turi, izoh: iz.i.value.trim(), filial: filJoy.childNodes.length ? f.filial : '' });
      band = false; yubor.disabled = false;
      if (r === null) return;
      close();
      ctx.toast('So\'rov yuborildi — direktor javobini kuting');
      yukla(ctx, chiz, true);
    } }, 'Direktorga yuborish');
    box.append(h('div', { class: 'muted' }, 'Mijoz pulni Payme, Click yoki karta raqamiga o\'tkazdi. Direktor kartasiga qarab «Tushdi» deydi — keyin dorini bering.'),
      sum.el, h('span', { class: 'muted' }, 'Qayerdan o\'tkazdi?'), tur, filJoy.childNodes.length ? h('span', { class: 'muted' }, 'Qaysi filialda sotildi?') : null, filJoy, iz.el, yubor,
      yordam('Oson\'da chekni odatdagidek NAQD qilib urasiz. Tushgan o\'tkazma shu kungi naqd savdoga qo\'shiladi, kassada esa bu pul bo\'lmaydi — '
        + 'shuning uchun har o\'tkazmani albatta shu yerdan so\'rang.', 'Nega so\'rash kerak?'));
  });
}

// ---------- «Savdo kiritish» oynasi uchun: shu kunning o'tkazma va qarzlari ----------
const KK = new Map();   // kun → {j, vaqt, yuk, xato}
export function kassaKun(ctx, oqi, kun, chiz) {
  const z = KK.get(kun);
  if (!z || (!z.yuk && Date.now() - z.vaqt > 30000)) {
    const yuk = Promise.resolve().then(() => oqi('kassaKun', kun))
      .then((j) => { if (!j || !Array.isArray(j.joylar)) throw new Error('Server javobi tushunarsiz'); return { j, vaqt: Date.now() }; })
      .catch((e) => ({ j: z && z.j, vaqt: Date.now(), xato: (e && e.message) || 'olinmadi' }))
      .then((yangi) => {
        const eski = KK.get(kun);
        if (!eski || eski.yuk !== yuk) return;   // kesh tozalangan (kassaYangila) — eski javob yozilmaydi
        KK.set(kun, yangi);
        if (eski.chiz) eski.chiz();
      });
    KK.set(kun, { j: z && z.j, vaqt: z ? z.vaqt : 0, yuk, xato: z && z.xato, chiz });
  } else if (z.yuk) z.chiz = chiz;   // Audit 1: oyna qayta ochildi — tugagach shu (yangi) oyna chiziladi
  const zz = KK.get(kun) || {};
  return zz.j || null;
}
export function kassaKunXato(kun) { const z = KK.get(kun); return z && !z.yuk && !z.j ? z.xato || null : null; }
// Filial + savdo smenasi (kunlik — ikkala tur) bo'yicha yig'indi.
export function kassaKunJami(j, filial, smena) {
  const r = { tushdi: 0, kutilmoqda: 0, qarz: 0 };
  if (!j || !Array.isArray(j.joylar)) return r;
  j.joylar.filter((x) => x.f === filial && (smena === 'kunlik' || x.tur === smena)).forEach((x) => {
    r.tushdi += Number(x.tushdi) || 0; r.kutilmoqda += Number(x.kutilmoqda) || 0; r.qarz += Number(x.qarz) || 0;
  });
  return r;
}

// ---------- Kassa nazorati (direktor) ----------
function kfYukla(ctx, majbur = false) {
  if (KF.yuklanmoqda) return majbur ? KF.yuklanmoqda.then(() => kfYukla(ctx, true)) : KF.yuklanmoqda;
  // Xato ham «yangi» hisoblanadi (20 s) — aks holda har chizishda qayta so'rab, cheksiz aylanardi.
  if (!majbur && (KF.j || KF.xato) && Date.now() - KF.vaqt < 20000) return null;
  const kun = KF.kun;
  KF.yuklanmoqda = Promise.resolve().then(() => ctx.oqi('kassaFarq', kun))
    .then((j) => { if (!j || !Array.isArray(j.qatorlar)) throw new Error('Server javobi tushunarsiz'); if (KF.kun === kun) { KF.j = j; KF.xato = null; } },
      (e) => { if (KF.kun === kun) KF.xato = (e && e.message) || 'Ma\'lumot olinmadi'; })
    .finally(() => {
      KF.yuklanmoqda = null;
      // Audit 1: yuklanayotganda davr almashgan — eski javob yozilmadi, yangi davr so'raladi.
      if (KF.kun !== kun) { kfYukla(ctx, true); return; }
      KF.vaqt = Date.now(); if (ctx.rerender) ctx.rerender();
    });
  return KF.yuklanmoqda;
}

const farqMatn = (n) => (n == null ? '—' : n === 0 ? '0' : (n < 0 ? 'kam ' : 'ortiqcha ') + H.som(Math.abs(n)));
// ---------- Ikkala oyna uchun bir xil farq so'zlari (Kassa nazorati va «Kassa ↔ Oson») ----------
// Farq = yozilgan − Oson sotgan. 1 000 so'mgacha — mos. Daraja: 'mos' | 'kam' (naqd chegaradan katta kam — qizil, «⚠» bilan,
// rangsiz ham farqlansin) | 'ogoh' (kichik kam, ortiqcha, karta — sariq) | 'yoq' (ma'lumot yo'q).
export const KASSA_MOS = 1000;
// Pul: raqam ichida bo'linmaydigan bo'sh joy («7 151 / 323» bo'lib qolmasin), «so'm» oldida — bo'linadi.
export const pulNb = (n) => H.som(n).replace(/(\d) (?=\d)/g, '$1\u00a0');
export function naqdFarqSoz(f, cheg) {
  if (f == null || Number.isNaN(f)) return ['—', 'yoq'];
  if (Math.abs(f) <= KASSA_MOS) return ['✓ mos', 'mos'];
  if (f < 0) return -f > cheg ? ['⚠ kam ' + pulNb(-f), 'kam'] : ['kam ' + pulNb(-f), 'ogoh'];
  return ['ortiqcha ' + pulNb(f), 'ogoh'];
}
// Karta bankka o'zi tushadi — «kam» (o'g'irlikdek o'qiladi) emas: yozilmagan / kam yozilgan / ko'p yozilgan, hammasi sariq.
export function kartaFarqSoz(kir, oson, f) {
  if (f == null || Number.isNaN(f)) return ['—', 'yoq'];
  if (Math.abs(f) <= KASSA_MOS) return ['✓ mos', 'mos'];
  if (!kir) return oson > KASSA_MOS ? ['yozilmagan ' + pulNb(oson), 'ogoh'] : ['—', 'yoq'];
  return f < 0 ? ['kam yozilgan ' + pulNb(-f), 'ogoh'] : ['ko\'p yozilgan ' + pulNb(f), 'ogoh'];
}
const BELGI = { kam: 'yoq', ogoh: 'ogoh', mos: 'ok', yoq: 'muted' };
const HAFTA = ['Yak', 'Dush', 'Sesh', 'Chor', 'Pay', 'Jum', 'Shan'];
const kunNomi = (k) => HAFTA[new Date(k + 'T12:00:00+05:00').getUTCDay()] + ', ' + k.slice(8, 10) + '.' + k.slice(5, 7);
const SMENA = { kunlik: 'butun kun', kunduzgi: 'kunduzgi', tungi: 'tungi' };

export function kassaNazoratView(m, ctx) {
  if (!ctx.server) { m.append(h('div', { class: 'card muted' }, 'Kassa nazorati faqat Telegram ilovasida (serverda) ishlaydi.')); return; }
  kfYukla(ctx);
  const j = KF.j;
  m.append(h('div', { class: 'muted' }, 'Har smenada xodim topshirgan naqd pul Oson\'dagi naqd savdo bilan solishtiriladi. Karta farqi — «Kassa ↔ Oson»da.'));
  if (!j) {
    m.append(h('div', { class: 'card muted', role: 'status' }, KF.xato ? 'Ma\'lumot olinmadi: ' + KF.xato : 'Yuklanmoqda…'),
      KF.xato ? h('button', { type: 'button', class: 's', onclick: () => kfYukla(ctx, true) }, 'Qayta urinish') : null);
    return;
  }
  if (KF.xato) m.append(h('div', { class: 'msg warn' }, 'Yangilanmadi: ' + KF.xato));
  const eski = !j.osonVaqt || Date.now() - j.osonVaqt > 60 * 60000;
  if (eski) m.append(h('div', { class: 'msg warn' }, j.osonVaqt ? 'Oson kassasi ma\'lumoti ' + qachon(j.osonVaqt) + ' da kelgan — eski bo\'lishi mumkin.'
    : 'Oson kassasi ma\'lumoti hali kelmagan (kengaytma 0.9.20).'));

  // (1) To'plangan qoldiq.
  const q = h('section', { class: 'card list' }, kartaSarlavha('Xodimlar bo\'yicha yig\'ilgan farq' + (j.boshi ? ' (' + sana(Date.parse(j.boshi + 'T12:00:00+05:00')) + ' dan beri)' : '')));
  const qoldiqlar = (j.qoldiqlar || []).filter((x) => x.qoldiq !== 0);
  if (!qoldiqlar.length) q.append(h('div', { class: 'muted' }, (j.qoldiqlar || []).length ? '✓ Farq yo\'q — hammasi joyida.' : 'Hali solishtirilgan savdo yo\'q.'));
  qoldiqlar.forEach((x) => q.append(h('div', { class: 'line kassa-qoldiq' },
    h('span', {}, asl(x.fn), x.ism ? [' · ', asl(x.ism)] : null, h('small', { class: 'muted' }, ' · ' + x.soni + ' ta smena')),
    h('span', { class: 'kassa-o' }, ((t, d) => h('b', { class: 'belgi ' + BELGI[d] }, t))(...naqdFarqSoz(x.qoldiq, j.jamiChegara)),
      h('button', { type: 'button', class: 's', onclick: () => yopOyna(ctx, x) }, 'Yopish')))));
  q.append(h('div', { class: 'muted' }, 'Chegara: bitta smenada ' + H.som(j.chegara) + ', xodimda jami ' + H.som(j.jamiChegara) + ' — oshsa, Telegram\'ga xabar keladi. ',
    h('button', { type: 'button', class: 'link', onclick: () => chegaraOyna(ctx, j) }, 'O\'zgartirish')));
  m.append(q);

  // (2) Davr.
  m.append(pills([[7, '7 kun'], [14, '14 kun'], [30, '30 kun']], KF.kun, (v) => { KF.kun = v; KF.j = null; kfYukla(ctx, true); ctx.rerender(); }, 'Davr'));

  // (3) Smenalar — kun bo'yicha guruhlab (10.11 kech: egasi "tushunarli tartibli"), faqat naqd.
  const r = h('section', { class: 'card list' }, kartaSarlavha('Smenalar bo\'yicha — naqd'));
  if (!j.qatorlar.length) r.append(h('div', { class: 'muted' }, 'Bu davrda kiritilgan savdo yo\'q.'));
  let oldingi = null;
  j.qatorlar.forEach((x) => {
    if (x.kun !== oldingi) { oldingi = x.kun; r.append(h('h3', { class: 'kassa-kun-b' }, kunNomi(x.kun))); }
    r.append(savdoQator(x, j));
  });
  m.append(r);

  // (3b) Oxirgi «tushdi» o'tkazmalar — xato bo'lsa qaytarish (audit 1: teskari yozuv bilan).
  yukla(ctx, ctx.rerender);
  const tushganlar = S.j ? S.j.qatorlar.filter((o) => o.holat === 'tushdi') : [];
  if (tushganlar.length) {
    const t = h('section', { class: 'card list' }, kartaSarlavha('Tushgan o\'tkazmalar'));
    tushganlar.slice(0, 20).forEach((o) => t.append(h('div', { class: 'line' },
      h('span', {}, h('b', {}, H.som(o.summa)), ' · ', asl(TURI[o.turi] || o.turi), ' · ', asl(o.fn), ' · ', asl(o.ism), h('small', { class: 'muted' }, ' · ' + qachon(o.vaqt))),
      h('button', { type: 'button', class: 'link', onclick: () => qaytarOyna(ctx, o) }, 'Tushmadi deb tuzatish'))));
    m.append(t);
  }

  // (4) Yopilganlar tarixi.
  if ((j.yopishlar || []).length) {
    const y = h('section', { class: 'card list' }, kartaSarlavha('Yopilgan qoldiqlar'));
    j.yopishlar.forEach((x) => y.append(h('div', { class: 'line' },
      h('span', {}, asl(x.fn), x.ism ? [' · ', asl(x.ism)] : null, h('small', { class: 'muted' }, ' · ' + qachon(x.vaqt) + ' · ', asl(x.izoh), ' (', asl(x.kim), ')')),
      h('b', {}, farqMatn(x.summa)))));
    m.append(y);
  }
  m.append(yordam('Yozilgan = kassadan topshirilgan naqd + kartaga tushgan o\'tkazma + shu smenada qarzga berilgan. Farq = yozilgan − Oson sotgan naqd: «kam» — pul yetmaydi, '
    + '«ortiqcha» — ko\'p. 1 000 so\'mgacha — mos; «⚠» — chegaradan katta. 20 soatdan uzun ochiq qolgan Oson smenasi kunduzgi/tungi smena bilan solishtirilmaydi. '
    + 'Kichik farqlar ham yo\'qolmaydi: xodim bo\'yicha qo\'shilib boradi. Xodim bilan hisob-kitob qilgach «Yopish» — qoldiq noldan boshlanadi (tarix saqlanadi). '
    + 'Javob kutayotgan o\'tkazmalar farqqa kirmaydi — avval bosh sahifada javob bering.', 'Qanday hisoblanadi?'));
}

function savdoQator(x, j) {
  const topshirildi = (x.naqd || 0) - (x.otkazma || 0);
  const otk = (x.otkazma || 0) + (x.boglanmagan || 0);
  const yozilgan = topshirildi + otk + (x.qarz || 0);
  const eski = !x.qoldiqda && x.osonSoni && !x.osonOchiq;   // nazorat boshlanishidan oldingi — hisobga kirmaydi
  let belgi;
  if (x.osonSoni && !x.osonOchiq) {
    const [t, d] = naqdFarqSoz(x.farq, eski ? Infinity : j.chegara);
    belgi = h('b', { class: 'belgi ' + (eski ? 'muted' : BELGI[d]) }, t + (eski ? ' · hisobga kirmaydi' : ''));
  } else if (x.osonSoni) {
    belgi = h('b', { class: 'belgi muted' }, 'taxminan ' + naqdFarqSoz(x.farq, Infinity)[0] + ' · smena ochiq');
  } else {
    belgi = h('b', { class: 'belgi muted' }, x.osonOchiq ? 'Oson smenasi ochiq' : 'Oson smenasi yo\'q');
  }
  const kim = h('span', { class: 'kassa-kim' }, asl(x.fn), ' · ' + (SMENA[x.smena] || x.smena), x.ism ? [' · ', asl(x.ism)] : null);
  // Audit: qo'shimchalar «Yozilgan» yonida — qaysi raqamga qo'shilgani aniq (Oson'ga emas).
  const tarkib = otk || x.qarz ? ' = kassadan ' + pulNb(topshirildi) + (otk ? ' + kartaga ' + pulNb(otk) : '') + (x.qarz ? ' + qarzga ' + pulNb(x.qarz) : '') : '';
  const izoh = [];
  if (x.osonOchiq) izoh.push(h('div', { class: 'muted kassa-iz' }, 'Oson smenasi hali yopilmagan — ochiq, hisobga kirmaydi.'));
  else if (!x.osonSoni) izoh.push(h('div', { class: 'muted kassa-iz' }, 'Bu smenaga to\'g\'ri keladigan Oson smenasi topilmadi (yoki u 20 soatdan uzun ochiq qolgan) — kun bo\'yicha «Kassa ↔ Oson»da qarang.'));
  if (x.kutilmoqda) izoh.push(h('div', { class: 'msg warn' }, 'Javob kutayotgan o\'tkazma: ' + H.som(x.kutilmoqda) + ' — bosh sahifada «Tushdi/Tushmadi» deb javob bering.'));
  return h('div', { class: 'item kassa-q' }, h('div', { class: 'kassa-q-b' }, kim, belgi),
    h('div', { class: 'kassa-n' }, 'Yozilgan ', h('b', {}, pulNb(yozilgan)), tarkib ? h('span', { class: 'muted' }, tarkib) : null),
    x.osonSoni ? h('div', { class: 'kassa-n' }, 'Oson sotdi ', h('b', {}, pulNb(x.osonNaqd))) : null,
    ...izoh);
}

function yopOyna(ctx, x) {
  sheet('Qoldiqni yopish', (box, close) => {
    const iz = input('Izoh', { inputmode: 'text', maxlength: 300, placeholder: 'Masalan: xodimdan undirildi' });
    let band = false;
    const tug = h('button', { type: 'button', class: 'p', onclick: async () => {
      if (band) return;
      if (iz.i.value.trim().length < 2) { iz.xato('Nima qilinganini yozing'); iz.i.focus(); return; }
      band = true; tug.disabled = true;
      if (!(await tasdiqlash('«' + (x.fn || '') + '»' + (x.ism ? ', «' + x.ism + '»' : '') + ' — ' + farqMatn(x.qoldiq) + ' yopilsinmi?\nQoldiq noldan boshlanadi.'))) {
        band = false; tug.disabled = false; return;
      }
      const r = await ctx.amalFon('kassaYop', x.f, x.xodimId || '', iz.i.value.trim(), x.qoldiq);
      band = false; tug.disabled = false;
      if (r === null) return;
      close();
      ctx.toast(r && r.takror ? 'Yopilgan ✓' : 'Yopildi: ' + farqMatn(Number(r)));
      // Audit 1: yangilanguncha yopilgan qoldiq ko'rinmasin (ikkinchi «Yopish» bo'lmasin).
      if (KF.j) KF.j = Object.assign({}, KF.j, { qoldiqlar: (KF.j.qoldiqlar || []).filter((z) => !(z.f === x.f && (z.xodimId || '') === (x.xodimId || ''))) });
      kassaYangila(); kfYukla(ctx, true);
    } }, 'Yopish');
    box.append(h('div', {}, asl(x.fn), x.ism ? [' · ', asl(x.ism)] : null, ' — ', h('b', {}, farqMatn(x.qoldiq))),
      h('div', { class: 'muted' }, 'Xodim bilan hisob-kitob qilingach yoping: qoldiq noldan boshlanadi, yozuv tarixda qoladi. Yopishda hamyonlar o\'zgarmaydi — '
        + 'xodimdan pul olgan bo\'lsangiz, uni «Pul keldi» bilan alohida yozing.'),
      h('div', { class: 'msg warn' }, 'Savdo summasi xato yozilgan bo\'lsa — yopmang, o\'sha savdoni «Savdoni tuzatish» bilan to\'g\'rilang (aks holda farq qayta chiqadi).'),
      iz.el, tug);
  });
}

function qaytarOyna(ctx, o) {
  sheet('Tushmadi deb tuzatish', (box, close) => {
    const iz = input('Sabab', { inputmode: 'text', maxlength: 200, placeholder: 'Masalan: SMS kelmagan, bank ilovasida yo\'q' });
    let band = false;
    const tug = h('button', { type: 'button', class: 'p', onclick: async () => {
      if (band) return;
      if (iz.i.value.trim().length < 2) { iz.xato('Sababini yozing'); iz.i.focus(); return; }
      band = true; tug.disabled = true;
      const r = await ctx.amalFon('otkazmaQaytar', o.id, iz.i.value.trim());
      band = false; tug.disabled = false;
      if (r === null) return;
      close();
      if (!r.takror) ctx.toast(r.ayirildi ? 'Tuzatildi — ' + H.som(r.ayirildi) + ' naqd savdodan ayirildi' : 'Tuzatildi — «tushmadi»');
      kassaYangila(); yukla(ctx, ctx.rerender, true); kfYukla(ctx, true);
    } }, 'Tushmadi deb tuzatish');
    box.append(h('div', {}, h('b', {}, H.som(o.summa)), ' · ', asl(TURI[o.turi] || o.turi), ' · ', asl(o.fn), ' · ', asl(o.ism)),
      h('div', { class: 'muted' }, '«Tushdi» deb xato belgilangan bo\'lsa: savdoga qo\'shilgan summa naqd savdodan va Uy hamyonidan teskari yozuv bilan ayiriladi, '
        + 'xodimga xabar boradi. Kassa farqi qayta hisoblanadi.'), iz.el, tug);
  });
}

function chegaraOyna(ctx, j) {
  sheet('Kassa ogohlantirishi', (box, close) => {
    const bir = input('Bitta smenadagi farq, so\'m', { value: String(j.chegara) });
    const jami = input('Xodimda to\'plangan farq, so\'m', { value: String(j.jamiChegara) });
    let band = false;
    const tug = h('button', { type: 'button', class: 'p', onclick: async () => {
      if (band) return;
      const a = H.pul(bir.i.value), b = H.pul(jami.i.value);
      if (!a || a < 1000 || a > 100000000) { bir.xato('1 000 dan 100 mln so\'mgacha'); bir.i.focus(); return; }
      if (!b || b < 1000 || b > 1000000000) { jami.xato('1 000 dan 1 mlrd so\'mgacha'); jami.i.focus(); return; }
      band = true; tug.disabled = true;
      const r = await ctx.amalFon('kassaChegara', a, b);
      band = false; tug.disabled = false;
      if (r === null) return;
      close(); ctx.toast('Saqlandi ✓'); kfYukla(ctx, true);
    } }, 'Saqlash');
    box.append(h('div', { class: 'muted' }, 'Farq shu summadan oshsa — Telegram\'ga xabar keladi. Kichik farqlar ham qoldiqda qo\'shilib boradi.'), bir.el, jami.el, tug);
  });
}
