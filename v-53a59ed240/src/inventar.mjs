// Telefon bilan inventarizatsiya (07.11; foydalanuvchi: "4. qo'shamiz"). Server: 20261107130000_inventar.sql.
// Xodim (o'z filiali) yoki direktor: «Boshlash» → qutidagi shtrix-kodni kamera bilan o'qiydi (dori aniqlanadi va xodim sonini
// yozadi — 06.11 kech, foydalanuvchi: "shtrix kod orqali aniqlanib sonini yozishi kerak"; oldin darhol +1 quti edi)
// yoki nomini yozib tanlaydi (quti va ochilgan qutidagi dona) → «Tugatish» → natija: kam, ortiq, sanalmagan, Oson'da yo'q.
// Sanash paytida Oson'dagi soni ko'rsatilmaydi (ko'rgan sonni yozib qo'ymaslik uchun) — natijada. Oson'ga hech narsa yozilmaydi.
// Skan/qo'shish — fonda (amalFon): kalit bilan (tarmoq xatosidan keyin qayta yuborilsa ikki marta qo'shilmaydi), ekran qotmaydi.
// Audit 07.11: qidiruv natijasi va sanalganlar ro'yxati butun ekranni qayta chizmaydi (yozib turganda klaviatura yopilmasin);
// ro'yxat har 30 s yangilanadi (bir necha xodim birga sanaydi; boshqasi yopgan bo'lsa — natijaga o'tiladi); xatoda — to'xtovsiz
// so'rov emas, «Qayta urinish»; «Tugatish» — saqlanayotgan sanoqlar tugagach.
// 07.11 kech (20261107200000_ombor_aqlli): «🧮 Bugungi sanash» — har kuni 10–15 ta dori (Oson'da 0 lekin sotilgan, A toifa va
// 30 kunda sanalmagan, hech sanalmagan qimmat dorilar): filial kartasida bitta tugma → oddiy inventarizatsiya shu ro'yxat bilan
// (ro'yxat sanash ekranida — bosilsa son oynasi; «nol» — aniq son, 0 ham mumkin). «Aniqlik: N%» — yopilgan sanoqlarning necha
// foizi Oson bilan aynan. Eski server javobi (maydonlarsiz) — avvalgidek.
import * as H from './hisob.mjs';
import { h, input, kartaSarlavha, nusxaOl, ochiladi, sana, sheet, tasdiqlash, vaqt } from './ui.mjs';
import { qoldiqMatn } from './oson-qoldiq.mjs';
import { skanerTugma } from './shtrix-skan.mjs';

const IB = () => ({ holat: null, holatXato: null, holatVaqt: 0, holatYuk: null, inv: null, invNom: '', kunlik: null,
  royxat: null, royxatVaqt: 0, royxatXato: null, royxatYuk: null, hammasi: false,
  natija: null, natijaId: null, natijaXato: null, natijaYuk: null,
  soz: '', top: null, topSoz: '', topYuk: null, taymer: 0, avlod: 0, kutilmoqda: 0, skanXabar: '',
  fonda: new Map(),   // dori (p) → { n: ketayotgan so'rovlar, q: qo'shilayotgan quti } — «saqlanmoqda» va tuzatishni to'xtatish uchun
  el: {} });
const I = IB();
export function inventarUnut() { clearTimeout(I.taymer); clearTimeout(I.el.yangilaT); Object.assign(I, IB()); }
// Testlar uchun: kamera o'qigan shtrix-kodni berish (kamerasiz).
export const inventarSkan = (kod) => { if (I.el.skan) I.el.skan(kod); };
// «Orqaga» (Telegram tugmasi ham): sanash yoki natija sahifasidan — filiallar ro'yxatiga. true — shu yerda hal bo'ldi.
export function inventarOrqaga() {
  if (!I.inv && !I.natijaId) return false;
  Object.assign(I, { inv: null, natijaId: null, natija: null, natijaXato: null, royxat: null, royxatXato: null, holat: null, top: null, soz: '', hammasi: false, kunlik: null });
  return true;
}
// Bugungi sanash sabablari (server kunlik_sanash_hisob).
const SABAB = { nol: 'Oson\'da 0 — tasdiqlang', abc: 'A toifa', qimmat: 'hech sanalmagan' };
const SABAB_KOP = { nol: 'Oson\'da 0, lekin sotilgan', abc: 'A toifa, 30 kunda sanalmagan', qimmat: 'hech sanalmagan, qimmat' };
const NOL_IZOH = 'Oson\'da bu dori 0 ko\'rinadi, lekin shu hafta sotilgan. Javonda bormi? Bor bo\'lsa — sonini yozing; yo\'q bo\'lsa — 0 qoldirib «Saqlash».';

const asl = (t) => h('span', { 'data-asl': '' }, t);
const son = (n) => String(Math.round(Number(n) * 1000) / 1000).replace('.', ',');
// Farq: «−1 quti 3 dona» (qutidagi dona bo'yicha; dona yo'q — kasr quti).
const farqMatn = (f, dona) => (Number(f) > 0 ? '+' : Number(f) < 0 ? '−' : '') + qoldiqMatn(Math.abs(Number(f)), dona);
const yozyapti = () => { const a = document.activeElement; return !!(a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA')); };

function holatYukla(ctx, chiz, majbur = false) {
  if (I.holatYuk) return;
  if (!majbur && (I.holat || I.holatXato) && Date.now() - I.holatVaqt < 30000) return;
  I.holatYuk = ctx.oqi('inventarHolat')
    .then((j) => { if (!j || !Array.isArray(j.filiallar)) throw new Error('Server javobi tushunarsiz'); I.holat = j; I.holatXato = null; },
      (e) => { I.holatXato = (e && e.message) || 'Ma\'lumot olinmadi'; })
    .finally(() => { I.holatVaqt = Date.now(); I.holatYuk = null; chiz(); });
}

// Sanalganlar ro'yxati. Yopilgan bo'lsa (boshqa xodim tugatgan) — natijaga o'tiladi.
function royxatYukla(ctx, chiz) {
  if (!I.inv || I.royxatYuk) return;
  const id = I.inv;
  I.royxatYuk = ctx.oqi('inventarRoyxat', id)
    .then((j) => {
      if (I.inv !== id) return;
      if (!j || !Array.isArray(j.qatorlar)) throw new Error('Server javobi tushunarsiz');
      if (j.yopildi) {
        if (I.el.sonYop) I.el.sonYop();   // ochiq son oynasi — yopiladi (yopilgan inventarizatsiyaga yozib bo'lmaydi)
        ctx.toast('Inventarizatsiya yopilgan — natija');
        Object.assign(I, { inv: null, natijaId: id, natija: null, natijaXato: null, royxat: null });
        chiz();
        return;
      }
      I.royxat = j.qatorlar; I.royxatXato = null;
      I.kunlik = j.tur === 'kunlik' && Array.isArray(j.royxat) ? j.royxat : null;
      if (I.el.chizRoyxat && I.el.royxatEl && I.el.royxatEl.isConnected) I.el.chizRoyxat(); else chiz();
    })
    .catch((e) => { if (I.inv === id) { I.royxatXato = (e && e.message) || 'Ro\'yxat olinmadi'; chiz(); } })
    .finally(() => { I.royxatVaqt = Date.now(); I.royxatYuk = null; });
}

function natijaYukla(ctx, chiz, id) {
  if (I.natijaYuk === id) return;
  I.natijaYuk = id;
  ctx.oqi('inventarNatija', id)
    .then((j) => { if (I.natijaId === id) { I.natija = j; I.natijaXato = null; } },
      (e) => { if (I.natijaId === id) I.natijaXato = (e && e.message) || 'Natija olinmadi'; })
    .finally(() => { if (I.natijaYuk === id) I.natijaYuk = null; if (I.natijaId === id) chiz(); });
}

// Ekran: natija → sanash → filiallar ro'yxati.
export function inventarView(m, ctx, fil) {
  const chiz = () => ctx.rerender();
  if (I.natijaId) return natijaView(m, ctx, chiz);
  if (I.inv) return sanashView(m, ctx, chiz);
  holatYukla(ctx, chiz);
  m.append(h('div', { class: 'muted' }, 'Javondagi qutilarni telefon bilan sanang: shtrix-kodni kamera bilan o\'qing yoki dori nomini yozing. '
    + 'Tugatgach ilova Oson qoldig\'i bilan solishtiradi — nima kam, nima ortiq. Bir necha xodim birga sanashi mumkin.'));
  if (!I.holat) {
    m.append(I.holatXato ? h('div', { class: 'card' }, h('div', { class: 'muted' }, I.holatXato), h('button', { class: 's', onclick: () => { I.holatXato = null; holatYukla(ctx, chiz, true); chiz(); } }, 'Qayta urinish'))
      : h('div', { class: 'card muted', role: 'status' }, 'Yuklanmoqda…'));
    return;
  }
  const direktor = ctx.x && ctx.x.rol === 'direktor';
  if (!I.holat.filiallar.length) {
    m.append(h('div', { class: 'card muted' }, direktor ? 'Oson qoldig\'i hali kelmagan — aptekadagi kompyuterda kengaytma va Oson ochilgach filiallar chiqadi.'
      : 'Sizning filialingiz Oson qoldig\'iga bog\'lanmagan — direktorga ayting (Qoldiq → ⚙ Sozlash → Oson filiali).'));
    return;
  }
  for (const f of I.holat.filiallar) {
    const nom = f.f ? fil(f.f) : f.n;
    const k = h('div', { class: 'card' }, kartaSarlavha(asl(nom)));
    if (f.aniqlik && f.aniqlik.jami) k.append(aniqlikEl(f.aniqlik));
    const kunlikBor = !!(f.kunlik && f.kunlik.holat === 'yangi' && f.kunlik.soni > 0 && !f.ochiq);
    if (f.kunlik) k.append(kunlikEl(ctx, chiz, f, nom));
    if (f.ochiq) {
      k.append(h('div', { class: 'muted' }, 'Sanalmoqda: ' + f.ochiq.xil + ' xil, ' + son(f.ochiq.quti) + ' quti · boshladi ' + (f.ochiq.kim || '?') + ', '
        + sana(f.ochiq.boshlandi) + ' ' + vaqt(f.ochiq.boshlandi)),
        h('div', { class: 'row' }, h('button', { class: 'p', onclick: () => { Object.assign(I, { inv: f.ochiq.id, invNom: nom, royxat: null, royxatXato: null, soz: '', top: null, hammasi: false }); chiz(); } }, 'Davom ettirish'),
          direktor ? h('button', { class: 's', onclick: () => { Object.assign(I, { natijaId: f.ochiq.id, natija: null, natijaXato: null, invNom: nom }); chiz(); } }, 'Oraliq natija') : null));
    } else {
      // Bugungi sanash bor bo'lsa — u asosiy tugma, to'liq inventarizatsiya ikkinchi darajali.
      k.append(h('button', { class: kunlikBor ? 's' : 'p', onclick: () => ctx.amal('inventarBoshla', f.b).then((id) => {
        if (!id || typeof id !== 'string') { if (id) holatYukla(ctx, chiz, true); return; }
        Object.assign(I, { inv: id, invNom: nom, royxat: null, royxatXato: null, soz: '', top: null, holat: null, hammasi: false });
        chiz();
      }) }, 'Inventarizatsiyani boshlash'));
    }
    if (f.oxirgi && f.oxirgi.length) {
      k.append(h('div', { class: 'muted', style: 'margin-top:8px' }, 'Oldingilari:'));
      f.oxirgi.forEach((z) => k.append(h('button', { type: 'button', class: 'oq-yana', onclick: () => { Object.assign(I, { natijaId: z.id, natija: null, natijaXato: null, invNom: nom }); chiz(); } },
        sana(z.yopildi) + ' ' + vaqt(z.yopildi) + ' — natija ▸')));
    }
    m.append(k);
  }
}

// «Aniqlik: 94%» — so'nggi 90 kunda yopilgan inventarizatsiyalarda sanoqlarning necha foizi Oson bilan aynan teng.
function aniqlikEl(a) {
  return h('div', { class: 'inv-aniqlik' }, 'Aniqlik: ', h('b', {}, a.foiz + '%'),
    ' · so\'nggi ' + (a.kun || 90) + ' kunda ' + a.jami + ' ta sanoqdan ' + a.aniq + ' tasi Oson bilan aynan');
}

// Filial kartasida «🧮 Bugungi sanash — N ta dori»: boshlash, sanalmoqda, tugadi (natija) yoki band (to'liq inventarizatsiya ochiq).
function kunlikEl(ctx, chiz, f, nom) {
  const kl = f.kunlik, box = h('div', { class: 'inv-kunlik' });
  const royxat = Array.isArray(kl.royxat) ? kl.royxat : [];
  if (kl.holat === 'tugadi') {
    box.append(h('b', {}, '✓ Bugungi sanash tugadi — ' + (kl.sanaldi || 0) + '/' + kl.soni + ' ta dori sanaldi'),
      h('button', { type: 'button', class: 'oq-yana', onclick: () => { Object.assign(I, { natijaId: kl.id, natija: null, natijaXato: null, invNom: nom }); chiz(); } }, 'Natija ▸'));
    return box;
  }
  if (!kl.soni) { box.append(h('div', { class: 'muted' }, '✓ Bugun sanaladigan dori yo\'q')); return box; }
  const sabab = Object.entries(kl.sabab || {}).filter(([, n]) => n > 0).map(([s, n]) => n + ' — ' + (SABAB_KOP[s] || s)).join(' · ');
  box.append(h('b', {}, '🧮 Bugungi sanash — ' + kl.soni + ' ta dori'),
    h('div', { class: 'muted' }, 'Har kuni oz-ozdan: Oson xatolari tez topiladi, katta inventarizatsiya kamroq kerak bo\'ladi.' + (sabab ? ' ' + sabab + '.' : '')));
  if (kl.holat === 'ochiq') box.append(h('div', { class: 'muted' }, 'Sanalmoqda: ' + (kl.sanaldi || 0) + '/' + kl.soni + ' — «Davom ettirish»'));
  else if (kl.holat === 'band') box.append(h('div', { class: 'muted' }, 'To\'liq inventarizatsiya ochiq — u tugagach bugungi sanash boshlanadi.'));
  else {
    box.append(h('button', { class: 'p', onclick: () => ctx.amal('kunlikSanashBoshla', f.b).then((id) => {
      if (!id || typeof id !== 'string') { if (id) holatYukla(ctx, chiz, true); return; }
      Object.assign(I, { inv: id, invNom: nom, royxat: null, royxatXato: null, soz: '', top: null, holat: null, hammasi: false, kunlik: royxat.length ? royxat : null });
      chiz();
    }) }, 'Bugungi sanashni boshlash'));
  }
  if (royxat.length) {
    box.append(ochiladi('Qaysi dorilar?', royxat.map((x) => h('div', { class: 'line' }, h('span', { 'data-asl': '' }, x.nom),
      h('span', { class: 'inv-sabab ' + (x.sabab || '') }, SABAB[x.sabab] || ''))), { k: 'inv-kunlik:' + f.b }));
  }
  return box;
}

// Sanash ekranida bugungi ro'yxat: har dori — sanalgan bo'lsa ✓ va son (tuzatish), bo'lmasa — son oynasi.
function kunlikRoyxatChiz(ctx, chiz, el) {
  el.textContent = '';
  const r = I.kunlik;
  if (!r || !r.length) { el.hidden = true; return; }
  el.hidden = false;
  const sanaldi = (p) => { const x = (I.royxat || []).find((z) => z.p === p); return x ? Number(x.soni) : null; };
  const bitdi = r.filter((x) => sanaldi(x.p) != null).length;
  el.append(kartaSarlavha('🧮 Bugungi ro\'yxat — ' + bitdi + '/' + r.length + ' sanaldi'),
    h('div', { class: 'muted' }, bitdi === r.length ? '✓ Hammasi sanaldi — pastda «Tugatish»ni bosing.' : 'Har dorini bosing va javonda nechta borligini yozing.'));
  r.forEach((x) => {
    const s = sanaldi(x.p), d = { p: x.p, nom: x.nom, ishlab: x.ishlab, dona: x.dona, sanaldi: s };
    el.append(h('button', { type: 'button', class: 'item inv-tanla', onclick: () => {
      if (s != null) sonOyna(ctx, chiz, { ...d, soni: s }, true);
      else if (x.sabab === 'nol') sonOyna(ctx, chiz, d, true, null, NOL_IZOH);
      else sonOyna(ctx, chiz, d, false);
    } },
    h('div', { class: 'line', style: 'border:0;padding:0' }, h('span', { 'data-asl': '' }, x.nom),
      s != null ? h('b', { class: 'inv-tayyor' }, '✓ ' + qoldiqMatn(s, x.dona)) : h('b', { class: 'muted' }, 'sanash ›')),
    h('div', { class: 'belgilar' }, h('span', { class: 'inv-sabab ' + (x.sabab || '') }, SABAB[x.sabab] || ''),
      x.ishlab ? h('span', { class: 'muted', 'data-asl': '' }, x.ishlab) : null)));
  });
}

// Ekranning shu qismlarini qayta chizish (butun ekranni emas): qidiruv natijasi va sanalganlar.
function qismlarniChiz() {
  if (I.el.chizTop && I.el.natijaEl && I.el.natijaEl.isConnected) I.el.chizTop();
  if (I.el.chizRoyxat && I.el.royxatEl && I.el.royxatEl.isConnected) I.el.chizRoyxat();
}

// Bitta dori qo'shish (fonda). Natija — yangi jami (son) yoki null.
function qosh(ctx, chiz, d, quti, dona, aniq, id = I.inv) {
  const qoshildi = quti + (dona && d.dona > 1 ? dona / d.dona : 0);
  const f = I.fonda.get(d.p) || { n: 0, q: 0 };
  f.n++; if (!aniq) f.q += qoshildi;
  I.fonda.set(d.p, f);
  I.kutilmoqda++;
  return ctx.amalFon('inventarSana', id, d.p, quti, dona, aniq).finally(() => {
    I.kutilmoqda--;
    f.n--; if (!aniq) f.q -= qoshildi;
    if (f.n <= 0 && I.fonda.get(d.p) === f) I.fonda.delete(d.p);
  }).then((r) => {
    if (I.inv !== id) return null;
    if (r == null) {
      // Saqlanmadi (sababi — xabarda) yoki natijasi noma'lum: ro'yxat serverdan qayta olinadi; yozilgan son yo'qolmasin —
      // oyna o'sha son bilan qayta ochiladi (audit 06.11 kech). Qayta yuborilsa — o'sha kalit: server ikki marta qo'shmaydi.
      // Inventarizatsiya yopilgan bo'lsa — ro'yxat buni aniqlaydi va oynani yopadi.
      I.royxatVaqt = 0; royxatYukla(ctx, chiz);
      sonOyna(ctx, chiz, d, aniq, { quti, dona, xato: 'Saqlanmadi — internetni tekshirib, «' + (aniq ? 'Saqlash' : 'Qo\'shish') + '»ni qayta bosing (sonni o\'zgartirmasangiz, ikki marta qo\'shilmaydi).' });
      return null;
    }
    if (typeof r === 'object') { I.royxatVaqt = 0; royxatYukla(ctx, chiz); return null; }   // takror — ro'yxat qayta olinadi
    const jami = Number(r);
    const bor = (I.royxat || []).find((x) => x.p === d.p);
    if (bor) { bor.soni = jami; bor.vaqt = Date.now(); bor.kim = ctx.x && ctx.x.ism; I.royxat = [bor, ...I.royxat.filter((x) => x !== bor)]; }
    else I.royxat = [{ p: d.p, nom: d.nom, ishlab: d.ishlab, soni: jami, dona: d.dona, vaqt: Date.now(), kim: ctx.x && ctx.x.ism }, ...(I.royxat || [])];
    (I.top || []).forEach((x) => { if (x.p === d.p) x.sanaldi = jami; });
    ctx.toast(d.nom.slice(0, 40) + ': ' + (aniq ? '' : farqMatn(qoshildi, d.dona) + ' · ') + 'jami ' + qoldiqMatn(jami, d.dona));
    qismlarniChiz();
    return jami;
  });
}

// Quti/dona oynasi: qo'shish yoki aniq son (tuzatish). oldin — saqlanmagan son (qayta ochilganda: { quti, dona, xato }).
// Audit 06.11 kech: dori allaqachon sanalgan bo'lsa — «faqat sanalmagan qutilarni yozing» (kim, qachon) va «aniq son» tugmasi
// (ikki xodim bir javonni sanab, son ikki baravar bo'lib ketmasin); oyna ochilgan inventarizatsiyaga yoziladi (boshqasiga emas).
// izohMatn — o'z izohi (07.11 kech: bugungi sanashdagi «nol» — Oson'da 0, javonda bormi?).
function sonOyna(ctx, chiz, d, aniq, oldin = null, izohMatn = null) {
  const inv = I.inv;
  if (!inv) return;
  if (I.el.sonYop) I.el.sonYop();
  sheet(d.nom, (box, close) => {
    I.el.sonYop = close;
    const dn1 = d.dona > 1 ? d.dona : 0;
    const r = (I.royxat || []).find((x) => x.p === d.p);   // ro'yxat — har qo'shilganda yangilanadi (qidiruv natijasidan yangiroq)
    const sanaldi = Number(r ? r.soni : d.sanaldi) || 0;
    const fon = I.fonda.get(d.p);
    // Tuzatish: hozirgi son quti va donaga ajratiladi (2,333 quti = 2 quti 1 dona) — o'zgartirmay saqlansa ham yo'qolmaydi.
    const jamiDona = dn1 ? Math.round(Number(d.soni || 0) * dn1) : 0;
    // Qo'shishda son bo'sh — xodim o'zi yozadi (oldin «1» turardi: bosib yuborilsa adashib 1 quti yozilardi).
    const sonMaydon = { inputmode: 'numeric', pattern: '[0-9]*', enterkeyhint: 'done' };
    const q = input('Quti soni', { ...sonMaydon, placeholder: aniq ? null : 'Masalan: 3',
      value: oldin ? String(oldin.quti || '') : aniq ? String(dn1 ? Math.floor(jamiDona / dn1) : Math.round(Number(d.soni || 0))) : '' });
    const dn = dn1 ? input('Ochilgan qutidan dona soni (qutida ' + dn1 + ' ta)', { ...sonMaydon,
      value: oldin ? String(oldin.dona || '') : aniq && jamiDona % dn1 ? String(jamiDona % dn1) : '' }) : null;
    const izoh = izohMatn || (aniq
      ? 'Shu doridan jami nechta bor — aniq sonni yozing (oldingisi o\'rniga). Boshqa xodim ham shu dorini sanayotgan bo\'lsa — bu yerda emas: u qidiruvdan topib, o\'zi sanaganini qo\'shsin.'
      : sanaldi > 0 ? null : 'Javonda shu doridan nechta quti borligini sanab yozing.');
    const saqla = () => {
      if (I.inv !== inv) { close(); ctx.toast('Inventarizatsiya yopilgan yoki almashgan — saqlanmadi', 'xato'); return; }
      const qv = String(q.i.value).replace(/\s+/g, ''), dv = dn ? String(dn.i.value).replace(/\s+/g, '') : '';
      if (/[.,]/.test(qv)) { q.xato(dn ? 'Butun quti sonini yozing — ochilgan qutidagi donalarni pastdagi maydonga' : 'Butun son yozing'); q.i.focus(); return; }
      if (!/^\d{1,5}$/.test(qv || '0') || Number(qv || 0) > 10000) { q.xato('Butun son yozing (10000 gacha)'); q.i.focus(); return; }
      if (dv && !/^\d{1,4}$/.test(dv)) { dn.xato('Faqat butun son'); dn.i.focus(); return; }
      const quti = Number(qv || 0), dona = Number(dv || 0);
      if (!aniq && quti + dona === 0) { q.xato('Sonni kiriting'); q.i.focus(); return; }
      if (dn && dona >= dn1) { dn.xato('Dona ' + dn1 + ' tadan kam bo\'lsin (qutida ' + dn1 + ' ta)'); dn.i.focus(); return; }
      // Tuzatish qo'shish hali saqlanayotganda — ikki yo'l (zaxira yo'l) orqali tartibi almashib ketmasin.
      if (aniq && I.fonda.get(d.p)) { q.xato('Oldingi son hali saqlanmoqda — bir oz kutib, qayta bosing'); return; }
      close();
      qosh(ctx, chiz, d, quti, dona, aniq, inv);
    };
    [q.i, dn && dn.i].forEach((i) => i && i.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); saqla(); } }));
    box.append(d.ishlab ? h('div', { class: 'muted', 'data-asl': '' }, d.ishlab) : null,
      oldin && oldin.xato ? h('div', { class: 'msg xato', role: 'alert' }, oldin.xato) : null,
      !aniq && sanaldi > 0 ? h('div', { class: 'msg info' },
        h('div', {}, 'Allaqachon sanalgan: ', h('b', {}, qoldiqMatn(sanaldi, d.dona)), r && r.kim ? ' (' + r.kim + (r.vaqt ? ', ' + vaqt(r.vaqt) : '') + ')' : '', '.'),
        h('div', {}, 'Faqat hali sanalmagan qutilarni yozing — shunga qo\'shiladi.'),
        h('button', { type: 'button', class: 's', style: 'margin-top:8px', onclick: () => { close(); sonOyna(ctx, chiz, { ...d, soni: sanaldi }, true); } }, 'Hammasini qayta sanadim — aniq son')) : null,
      fon && fon.q > 0 ? h('div', { class: 'muted', role: 'status' }, 'Saqlanmoqda: ' + farqMatn(fon.q, d.dona)) : null,
      izoh ? h('div', { class: 'muted' }, izoh) : null,
      q.el, dn ? dn.el : null,
      h('button', { class: 'p', onclick: saqla }, aniq ? 'Saqlash' : 'Qo\'shish'));
    setTimeout(() => { try { q.i.focus(); q.i.select(); } catch (e) { /* bo'sh */ } }, 50);
    return () => { if (I.el.sonYop === close) I.el.sonYop = null; };
  });
}

function topIzla(ctx, chiz, soz, skan) {
  const avlod = ++I.avlod, id = I.inv;
  I.topYuk = soz;
  if (I.el.chizTop) I.el.chizTop();
  ctx.oqi('inventarTop', id, soz).then((r) => {
    if (avlod !== I.avlod || I.inv !== id) { if (I.topYuk === soz) I.topYuk = null; return; }
    I.top = Array.isArray(r) ? r : []; I.topSoz = soz; I.topYuk = null;
    // Kamera: bitta dori topilsa — son oynasi (xodim sonini yozadi); bir nechta (bitta shtrix-kod ikki kartada) — ro'yxat, tanlanadi;
    // topilmasa — maydon bo'sh qoladi (raqamni o'chirib yozish shart emas), tagida xabar. Xodim bu ekrandan ketgan bo'lsa — oyna ochilmaydi.
    const ekranda = I.el.natijaEl && I.el.natijaEl.isConnected;
    if (skan && I.top.length === 1) { const d = I.top[0]; I.soz = ''; I.top = null; if (I.el.input) I.el.input.value = ''; qismlarniChiz(); if (ekranda) sonOyna(ctx, chiz, d, false); return; }
    if (skan && !I.top.length) {
      I.soz = ''; I.top = null; if (I.el.input) I.el.input.value = '';
      I.skanXabar = 'Shtrix-kod ' + soz + ' shu filial Oson qoldig\'ida topilmadi — dori nomini yozib qidiring.';
    } else if (skan) { I.soz = soz; if (I.el.input) I.el.input.value = soz; }
    qismlarniChiz();
  }, (e) => { if (avlod === I.avlod) { I.topYuk = null; ctx.toast((e && e.message) || 'Qidirib bo\'lmadi', 'xato'); qismlarniChiz(); } else if (I.topYuk === soz) I.topYuk = null; });
}

function sanashView(m, ctx, chiz) {
  if (!I.royxat && !I.royxatXato) royxatYukla(ctx, chiz);
  else if (I.royxat && Date.now() - I.royxatVaqt > 30000) royxatYukla(ctx, chiz);   // boshqa xodimlar sanagani
  // Ekran ochiq turganda ham yangilanib turadi (har 30 s; ekran yopilsa — to'xtaydi).
  clearTimeout(I.el.yangilaT);
  I.el.yangilaT = setTimeout(function tik() {
    if (!I.inv || !I.el.royxatEl || !I.el.royxatEl.isConnected) return;
    if (!document.hidden) royxatYukla(ctx, chiz);
    I.el.yangilaT = setTimeout(tik, 30000);
  }, 30000);

  m.append(h('div', { class: 'card' }, kartaSarlavha(['📋 ', asl(I.invNom), ' — sanash']),
    h('div', { class: 'muted' }, '«📷 Kamera bilan o\'qish» — qutidagi shtrix-kodni ko\'rsating: dori aniqlanadi, sonini yozasiz. Yoki dori nomini yozib tanlang.')));
  // Bugungi sanash ro'yxati (kunlik inventarizatsiya) — sanalganlar ro'yxati bilan birga yangilanadi.
  const kunlikEl2 = h('div', { class: 'card list inv-kunlik-r', hidden: true });
  I.el.kunlikEl = kunlikEl2;
  kunlikRoyxatChiz(ctx, chiz, kunlikEl2);
  m.append(kunlikEl2);
  const f = input('Dori nomi yoki shtrix-kod', { inputmode: 'search', placeholder: 'Masalan: analgin', k: 'inv-qidir' });
  f.i.value = I.soz;
  I.el.input = f.i;
  f.i.addEventListener('input', () => {
    I.soz = f.i.value; clearTimeout(I.taymer); I.skanXabar = '';
    const s = I.soz.trim();
    if (s.length < 2) { I.top = null; I.topYuk = null; I.avlod++; I.el.chizTop(); return; }
    I.taymer = setTimeout(() => topIzla(ctx, chiz, s, false), 400);
  });
  const natijaEl = h('div', {});
  I.el.natijaEl = natijaEl;
  I.el.chizTop = () => {
    natijaEl.textContent = '';
    if (I.top && I.topSoz === I.soz.trim()) {
      if (!I.top.length) natijaEl.append(h('div', { class: 'muted' }, 'Shu filial Oson qoldig\'ida topilmadi — boshqacha yozib ko\'ring.'));
      if (I.top.length > 1 && /^\d{8,14}$/.test(I.topSoz)) natijaEl.append(h('div', { class: 'muted' }, 'Bu shtrix-kod bir nechta kartada — qaysi biri ekanini tanlang:'));
      I.top.forEach((d) => natijaEl.append(h('button', { type: 'button', class: 'item inv-tanla', onclick: () => sonOyna(ctx, chiz, d, false) },
        h('div', { class: 'line', style: 'border:0;padding:0' }, h('span', { 'data-asl': '' }, d.nom), d.sanaldi != null ? h('b', {}, qoldiqMatn(d.sanaldi, d.dona)) : h('b', { class: 'muted' }, '+')),
        d.ishlab ? h('div', { class: 'muted', 'data-asl': '' }, d.ishlab) : null)));
    } else if (I.topYuk) natijaEl.append(h('div', { class: 'muted', role: 'status' }, 'Qidirilmoqda…'));
    else if (I.skanXabar && !I.soz.trim()) natijaEl.append(h('div', { class: 'msg xato', role: 'status' }, I.skanXabar));
  };
  I.el.chizTop();
  // Kamera — asosiy yo'l (katta tugma, qidiruvdan tepada; 06.11 kech: iPhone'da tugma ko'rinmasdi). Maydon — I.el.input (ekran
  // kamera ochiq turganda qayta chizilgan bo'lsa ham ko'rinib turgani tozalanadi).
  I.el.skan = (kod) => {
    I.soz = ''; I.skanXabar = ''; if (I.el.input) I.el.input.value = '';
    topIzla(ctx, chiz, kod, true);
  };
  m.append(h('div', { class: 'card' }, h('div', { class: 'skan-maydon' }, skanerTugma((kod) => I.el.skan(kod), { katta: true }), f.el), natijaEl));

  const sarlavhaSoni = h('b', {});
  const royxatEl = h('div', {});
  I.el.royxatEl = royxatEl;
  I.el.chizRoyxat = () => {
    if (I.el.kunlikEl && I.el.kunlikEl.isConnected) kunlikRoyxatChiz(ctx, chiz, I.el.kunlikEl);
    royxatEl.textContent = '';
    const r = I.royxat;
    sarlavhaSoni.textContent = r ? r.filter((x) => Number(x.soni) > 0).length + ' xil' : '';
    if (I.royxatXato && !r) {
      royxatEl.append(h('div', { class: 'muted' }, I.royxatXato), h('button', { class: 's', onclick: () => { I.royxatXato = null; royxatYukla(ctx, chiz); I.el.chizRoyxat(); } }, 'Qayta urinish'));
      return;
    }
    if (!r) { royxatEl.append(h('div', { class: 'muted', role: 'status' }, 'Yuklanmoqda…')); return; }
    if (!r.length) { royxatEl.append(h('div', { class: 'muted' }, 'Hali hech narsa sanalmagan.')); return; }
    const kor = I.hammasi ? r : r.slice(0, 100);
    kor.forEach((x) => royxatEl.append(h('button', { type: 'button', class: 'item inv-tanla', onclick: () => sonOyna(ctx, chiz, x, true) },
      h('div', { class: 'line', style: 'border:0;padding:0' }, h('span', { 'data-asl': '' }, x.nom), h('b', {}, qoldiqMatn(x.soni, x.dona))),
      x.ishlab ? h('div', { class: 'muted', 'data-asl': '' }, x.ishlab) : null,   // bir xil nomli, boshqa ishlab chiqaruvchi kartalar ajralsin
      h('div', { class: 'muted' }, (x.kim ? x.kim + ' · ' : '') + (x.vaqt ? vaqt(x.vaqt) : '') + ' · tuzatish uchun bosing'))));
    if (r.length > kor.length) royxatEl.append(h('button', { type: 'button', class: 'oq-yana', onclick: () => { I.hammasi = true; I.el.chizRoyxat(); } }, 'Yana ' + (r.length - kor.length) + ' ta ▾'));
  };
  I.el.chizRoyxat();
  m.append(h('div', { class: 'card list' }, h('div', { class: 'line', style: 'border:0;padding:0' }, kartaSarlavha('Sanalganlar'), sarlavhaSoni), royxatEl));
  m.append(h('div', { class: 'row' },
    h('button', { class: 's', onclick: () => { inventarOrqaga(); chiz(); } }, '← Filiallar'),
    h('button', { class: 'p', onclick: async () => {
      if (!(await tasdiqlash('Inventarizatsiyani tugatasizmi? Keyin bu sanashga qo\'shib bo\'lmaydi, natija (Oson bilan farq) chiqadi.'))) return;
      // Saqlanayotgan sanoqlar (sekin internet) — avval ular tugasin (10 s gacha).
      for (let i = 0; I.kutilmoqda > 0 && i < 50; i++) await new Promise((r) => setTimeout(r, 200));
      if (I.kutilmoqda > 0) { ctx.toast('Oxirgi sanoqlar hali saqlanmoqda — bir ozdan keyin qayta bosing', 'xato'); return; }
      const id = I.inv;
      const ok = await ctx.amal('inventarYop', id);
      if (ok == null) { I.royxatVaqt = 0; royxatYukla(ctx, chiz); return; }   // boshqa xodim yopgan bo'lishi mumkin — tekshiriladi
      Object.assign(I, { inv: null, natijaId: id, natija: null, natijaXato: null, holat: null, top: null, soz: '', royxat: null });
      chiz();
    } }, 'Tugatish')));
}

export function natijaMatn(nom, n) {
  const qator = (x) => '• ' + x.nom + ': sanaldi ' + qoldiqMatn(x.sanaldi, x.dona) + ', Oson ' + qoldiqMatn(x.oson, x.dona) + ' (' + farqMatn(x.farq, x.dona) + ')';
  const pul = (s) => (s == null ? '' : ', ~' + H.som(Math.abs(Number(s))));
  return [(n.tur === 'kunlik' ? 'Bugungi sanash — ' : 'Inventarizatsiya — ') + nom +(n.yopildi ? ' · ' + sana(n.yopildi) : ' (oraliq)'),
    'Sanaldi: ' + n.sanaldi + ' xil, to\'g\'ri: ' + n.teng,
    n.kam.length ? 'Kam (' + n.kam.length + pul(n.kam_summa) + '):\n' + n.kam.map(qator).join('\n') : 'Kam: yo\'q',
    n.ortiq.length ? 'Ortiq (' + n.ortiq.length + pul(n.ortiq_summa) + '):\n' + n.ortiq.map(qator).join('\n') : 'Ortiq: yo\'q',
    n.yoq.length ? 'Oson\'da yo\'q: ' + n.yoq.map((x) => x.nom).join(', ') : null,
    n.tur === 'kunlik' && Array.isArray(n.royxat_sanalmagan) ? 'Bugungi ro\'yxatdan sanalmagan: ' + n.royxat_sanalmagan.length + ' ta'
      : 'Sanalmagan (Oson\'da bor): ' + n.sanalmagan + ' xil'].filter(Boolean).join('\n');
}

function natijaView(m, ctx, chiz) {
  const id = I.natijaId;
  if (I.natija && I.natija.id !== id) I.natija = null;   // boshqa inventarizatsiya natijasi — ko'rsatilmaydi
  if (!I.natija && !I.natijaXato) natijaYukla(ctx, chiz, id);
  m.append(h('button', { class: 's', onclick: () => { inventarOrqaga(); chiz(); } }, '← Filiallar'));
  if (!I.natija) {
    m.append(I.natijaXato ? h('div', { class: 'card' }, h('div', { class: 'muted' }, I.natijaXato), h('button', { class: 's', onclick: () => { I.natijaXato = null; natijaYukla(ctx, chiz, id); chiz(); } }, 'Qayta urinish'))
      : h('div', { class: 'card muted', role: 'status' }, 'Solishtirilmoqda…'));
    return;
  }
  const n = I.natija;
  const pul = (s) => (s == null ? '' : ' · ' + H.som(Math.abs(Number(s))));
  m.append(h('div', { class: 'card' }, kartaSarlavha(['📋 ', asl(I.invNom), n.yopildi ? ' — natija' : ' — oraliq natija']),
    h('div', { class: 'muted' }, n.yopildi ? 'Tugatilgan ' + sana(n.yopildi) + ' ' + vaqt(n.yopildi) + ' — o\'sha paytdagi Oson qoldig\'i bilan solishtirilgan.'
      : 'Hali sanalmoqda — hozirgi Oson qoldig\'i bilan solishtirildi.'),
    h('div', { class: 'inv-jami' },
      h('div', {}, h('b', {}, String(n.sanaldi)), h('span', { class: 'muted' }, 'xil sanaldi')),
      h('div', {}, h('b', {}, String(n.teng)), h('span', { class: 'muted' }, 'to\'g\'ri')),
      h('div', {}, h('b', { class: 'pul-zarar' }, String(n.kam.length)), h('span', { class: 'muted' }, 'kam' + pul(n.kam_summa))),
      h('div', {}, h('b', { class: 'pul-kam' }, String(n.ortiq.length)), h('span', { class: 'muted' }, 'ortiq' + pul(n.ortiq_summa)))),
    h('div', { class: 'muted' }, (n.kam_summa != null ? 'Pul — tannarxda (kirim narxi bo\'lmasa — sotuv narxida). ' : '')
      + 'Sanash paytida sotilgan yoki kelgan dorilar ham farq ko\'rsatishi mumkin.')));
  const ruyxat = (sar, arr, cls) => {
    if (!arr.length) return;
    const k = h('div', { class: 'card list' }, kartaSarlavha(sar + ' — ' + arr.length + ' xil'));
    arr.forEach((x) => k.append(h('div', { class: 'item' },
      h('div', { class: 'line', style: 'border:0;padding:0' }, h('span', { 'data-asl': '' }, x.nom), h('b', { class: cls }, farqMatn(x.farq, x.dona))),
      h('div', { class: 'muted' }, 'sanaldi ' + qoldiqMatn(x.sanaldi, x.dona) + ' · Oson\'da ' + qoldiqMatn(x.oson, x.dona) + (x.summa != null && Number(x.summa) ? ' · ' + H.som(Math.abs(Number(x.summa))) : '')))));
    m.append(k);
  };
  ruyxat('Kam', n.kam, 'pul-zarar');
  ruyxat('Ortiq', n.ortiq, 'pul-kam');
  if (n.yoq.length) {
    const k = h('div', { class: 'card list' }, kartaSarlavha('Oson\'da yo\'q — ' + n.yoq.length + ' xil'),
      h('div', { class: 'muted' }, 'Sanaldi, lekin Oson qoldig\'ida 0 — kirim qilinmagan yoki boshqa nom bilan turibdi.'));
    n.yoq.forEach((x) => k.append(h('div', { class: 'item' }, h('div', { class: 'line', style: 'border:0;padding:0' }, h('span', { 'data-asl': '' }, x.nom), h('b', {}, qoldiqMatn(x.sanaldi, x.dona))))));
    m.append(k);
  }
  // Bugungi sanash (07.11 kech): ro'yxatdan sanalmaganlar — nomi bilan (Oson soni ko'rsatilmaydi; ertaga yana chiqadi).
  if (n.tur === 'kunlik' && Array.isArray(n.royxat_sanalmagan)) {
    if (n.royxat_sanalmagan.length) {
      const k = h('div', { class: 'card list' }, kartaSarlavha('Ro\'yxatdan sanalmagan — ' + n.royxat_sanalmagan.length + ' ta'),
        h('div', { class: 'muted' }, 'Bugungi ro\'yxatda edi, lekin sanalmadi — keyingi kunlarda yana chiqadi.'));
      n.royxat_sanalmagan.forEach((x) => k.append(h('div', { class: 'item' }, h('div', { class: 'line', style: 'border:0;padding:0' },
        h('span', { 'data-asl': '' }, x.nom), h('span', { class: 'inv-sabab ' + (x.sabab || '') }, SABAB[x.sabab] || '')))));
      m.append(k);
    }
  } else if (n.sanalmagan) {
    const k = h('div', { class: 'card list' }, kartaSarlavha('Sanalmagan — ' + n.sanalmagan + ' xil' + pul(n.sanalmagan_summa)),
      h('div', { class: 'muted' }, 'Oson\'da bor, lekin sanalmagan (qisman inventarizatsiya bo\'lsa — normal). ' + (n.sanalmagan_summa != null ? 'Eng qimmatlari:' : 'Bir qismi:')));
    n.sanalmagan_top.slice(0, 30).forEach((x) => k.append(h('div', { class: 'item' }, h('div', { class: 'line', style: 'border:0;padding:0' },
      h('span', { 'data-asl': '' }, x.nom), h('b', {}, qoldiqMatn(x.oson, x.dona))))));
    m.append(k);
  }
  const matn = natijaMatn(I.invNom, n);
  m.append(h('div', { class: 'row' },
    h('button', { class: 's', onclick: () => nusxaOl(matn, ctx.toast, 'Natija nusxalandi ✓') }, 'Nusxalash'),
    ctx.tg && ctx.tg.openTelegramLink ? h('button', { class: 's', onclick: () => ctx.tg.openTelegramLink('https://t.me/share/url?url=' + encodeURIComponent(matn.slice(0, 3500))) }, 'Telegram\'da yuborish') : null,
    !n.yopildi ? h('button', { class: 's', onclick: () => { I.natija = null; natijaYukla(ctx, chiz, id); chiz(); } }, 'Yangilash') : null));
}
