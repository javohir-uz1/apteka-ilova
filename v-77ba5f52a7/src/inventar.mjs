// Telefon bilan inventarizatsiya (07.11; foydalanuvchi: "4. qo'shamiz"). Server: 20261107130000_inventar.sql.
// Xodim (o'z filiali) yoki direktor: «Boshlash» → qutidagi shtrix-kodni kamera bilan o'qiydi (bitta dori topilsa — darhol +1 quti)
// yoki nomini yozib tanlaydi (quti va ochilgan qutidagi dona) → «Tugatish» → natija: kam, ortiq, sanalmagan, Oson'da yo'q.
// Sanash paytida Oson'dagi soni ko'rsatilmaydi (ko'rgan sonni yozib qo'ymaslik uchun) — natijada. Oson'ga hech narsa yozilmaydi.
// Skan/qo'shish — fonda (amalFon): kalit bilan (tarmoq xatosidan keyin qayta yuborilsa ikki marta qo'shilmaydi), ekran qotmaydi.
// Audit 07.11: qidiruv natijasi va sanalganlar ro'yxati butun ekranni qayta chizmaydi (yozib turganda klaviatura yopilmasin);
// ro'yxat har 30 s yangilanadi (bir necha xodim birga sanaydi; boshqasi yopgan bo'lsa — natijaga o'tiladi); xatoda — to'xtovsiz
// so'rov emas, «Qayta urinish»; «Tugatish» — saqlanayotgan sanoqlar tugagach.
import * as H from './hisob.mjs';
import { h, input, kartaSarlavha, nusxaOl, sana, sheet, tasdiqlash, vaqt } from './ui.mjs';
import { qoldiqMatn } from './oson-qoldiq.mjs';
import { skanerTugma } from './shtrix-skan.mjs';

const IB = () => ({ holat: null, holatXato: null, holatVaqt: 0, holatYuk: null, inv: null, invNom: '',
  royxat: null, royxatVaqt: 0, royxatXato: null, royxatYuk: null, hammasi: false,
  natija: null, natijaId: null, natijaXato: null, natijaYuk: null,
  soz: '', top: null, topSoz: '', topYuk: null, taymer: 0, avlod: 0, kutilmoqda: 0, el: {} });
const I = IB();
export function inventarUnut() { clearTimeout(I.taymer); Object.assign(I, IB()); }
// «Orqaga» (Telegram tugmasi ham): sanash yoki natija sahifasidan — filiallar ro'yxatiga. true — shu yerda hal bo'ldi.
export function inventarOrqaga() {
  if (!I.inv && !I.natijaId) return false;
  Object.assign(I, { inv: null, natijaId: null, natija: null, natijaXato: null, royxat: null, royxatXato: null, holat: null, top: null, soz: '', hammasi: false });
  return true;
}

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
        ctx.toast('Inventarizatsiya yopilgan — natija');
        Object.assign(I, { inv: null, natijaId: id, natija: null, natijaXato: null, royxat: null });
        chiz();
        return;
      }
      I.royxat = j.qatorlar; I.royxatXato = null;
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
    if (f.ochiq) {
      k.append(h('div', { class: 'muted' }, 'Sanalmoqda: ' + f.ochiq.xil + ' xil, ' + son(f.ochiq.quti) + ' quti · boshladi ' + (f.ochiq.kim || '?') + ', '
        + sana(f.ochiq.boshlandi) + ' ' + vaqt(f.ochiq.boshlandi)),
        h('div', { class: 'row' }, h('button', { class: 'p', onclick: () => { Object.assign(I, { inv: f.ochiq.id, invNom: nom, royxat: null, royxatXato: null, soz: '', top: null, hammasi: false }); chiz(); } }, 'Davom ettirish'),
          direktor ? h('button', { class: 's', onclick: () => { Object.assign(I, { natijaId: f.ochiq.id, natija: null, natijaXato: null, invNom: nom }); chiz(); } }, 'Oraliq natija') : null));
    } else {
      k.append(h('button', { class: 'p', onclick: () => ctx.amal('inventarBoshla', f.b).then((id) => {
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

// Ekranning shu qismlarini qayta chizish (butun ekranni emas): qidiruv natijasi va sanalganlar.
function qismlarniChiz() {
  if (I.el.chizTop && I.el.natijaEl && I.el.natijaEl.isConnected) I.el.chizTop();
  if (I.el.chizRoyxat && I.el.royxatEl && I.el.royxatEl.isConnected) I.el.chizRoyxat();
}

// Bitta dori qo'shish (fonda). Natija — yangi jami (son) yoki null.
function qosh(ctx, chiz, d, quti, dona, aniq) {
  const id = I.inv;
  I.kutilmoqda++;
  return ctx.amalFon('inventarSana', id, d.p, quti, dona, aniq).then((r) => {
    if (I.inv !== id) return null;
    if (r == null) {
      // Saqlanmadi (yoki natijasi noma'lum, yoki boshqa xodim yopgan) — ro'yxat serverdan qayta olinadi.
      ctx.toast(d.nom.slice(0, 40) + ' — saqlanmadi, ro\'yxat yangilanmoqda', 'xato');
      I.royxatVaqt = 0; royxatYukla(ctx, chiz);
      return null;
    }
    if (typeof r === 'object') { I.royxatVaqt = 0; royxatYukla(ctx, chiz); return null; }   // takror — ro'yxat qayta olinadi
    const jami = Number(r);
    const bor = (I.royxat || []).find((x) => x.p === d.p);
    if (bor) { bor.soni = jami; bor.vaqt = Date.now(); bor.kim = ctx.x && ctx.x.ism; I.royxat = [bor, ...I.royxat.filter((x) => x !== bor)]; }
    else I.royxat = [{ p: d.p, nom: d.nom, soni: jami, dona: d.dona, vaqt: Date.now(), kim: ctx.x && ctx.x.ism }, ...(I.royxat || [])];
    (I.top || []).forEach((x) => { if (x.p === d.p) x.sanaldi = jami; });
    ctx.toast(d.nom.slice(0, 40) + ': ' + (aniq ? '' : '+' + son(quti + (dona && d.dona ? dona / d.dona : 0)) + ' · ') + 'jami ' + qoldiqMatn(jami, d.dona));
    qismlarniChiz();
    return jami;
  }).finally(() => { I.kutilmoqda--; });
}

// Quti/dona oynasi: qo'shish yoki aniq son (tuzatish).
function sonOyna(ctx, chiz, d, aniq) {
  sheet(d.nom, (box, close) => {
    const dn1 = d.dona > 1 ? d.dona : 0;
    // Tuzatish: hozirgi son quti va donaga ajratiladi (2,333 quti = 2 quti 1 dona) — o'zgartirmay saqlansa ham yo'qolmaydi.
    const jamiDona = dn1 ? Math.round(Number(d.soni || 0) * dn1) : 0;
    const q = input('Quti soni', { inputmode: 'numeric', value: aniq ? String(dn1 ? Math.floor(jamiDona / dn1) : Math.round(Number(d.soni || 0))) : '1' });
    const dn = dn1 ? input('Ochilgan qutidan dona soni (' + dn1 + ' tadan)', { inputmode: 'numeric', value: aniq && jamiDona % dn1 ? String(jamiDona % dn1) : '' }) : null;
    box.append(h('div', { class: 'muted' }, aniq ? 'Shu doridan jami nechta bor — aniq sonni yozing (oldingisi o\'rniga). Boshqa xodim ham shu dorini sanayotgan bo\'lsa — «Qo\'shish» ishlating.'
      : 'Topgan qutilaringizni qo\'shing (oldingi sanalganga qo\'shiladi).'),
      q.el, dn ? dn.el : null,
      h('button', { class: 'p', onclick: () => {
        const qv = String(q.i.value).trim(), dv = dn ? String(dn.i.value).trim() : '';
        if (!/^\d{1,5}$/.test(qv || '0') || Number(qv || 0) > 10000) { q.xato('Butun son, 10 000 gacha'); return; }
        if (dv && !/^\d{1,4}$/.test(dv)) { dn.xato('Faqat butun son'); return; }
        const quti = Number(qv || 0), dona = Number(dv || 0);
        if (!aniq && quti + dona === 0) { q.xato('Sonni kiriting'); return; }
        if (dn && dona >= dn1) { dn.xato('Dona ' + dn1 + ' tadan kam bo\'lsin'); return; }
        close();
        qosh(ctx, chiz, d, quti, dona, aniq);
      } }, aniq ? 'Saqlash' : 'Qo\'shish'));
    setTimeout(() => { try { q.i.focus(); q.i.select(); } catch (e) { /* bo'sh */ } }, 50);
  });
}

function topIzla(ctx, chiz, soz, skan) {
  const avlod = ++I.avlod, id = I.inv;
  I.topYuk = soz;
  if (I.el.chizTop) I.el.chizTop();
  ctx.oqi('inventarTop', id, soz).then((r) => {
    if (avlod !== I.avlod || I.inv !== id) { if (I.topYuk === soz) I.topYuk = null; return; }
    I.top = Array.isArray(r) ? r : []; I.topSoz = soz; I.topYuk = null;
    // Kamera: bitta dori topilsa — darhol +1 quti; bir nechta (bitta shtrix-kod ikki kartada) — ro'yxat, tanlanadi.
    if (skan && I.top.length === 1) { const d = I.top[0]; I.soz = ''; I.top = null; if (I.el.input) I.el.input.value = ''; qismlarniChiz(); qosh(ctx, chiz, d, 1, 0, false); return; }
    if (skan) { I.soz = soz; if (I.el.input) I.el.input.value = soz; }
    if (skan && !I.top.length) ctx.toast('Bu shtrix-kod shu filial Oson qoldig\'ida yo\'q — dori nomini yozib qidiring', 'xato');
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
    h('div', { class: 'muted' }, 'Kamera: qutining shtrix-kodini ko\'rsating — topilsa +1 quti. Yoki nomini yozing va tanlang.')));
  const f = input('Dori nomi yoki shtrix-kod', { inputmode: 'search', placeholder: 'Masalan: analgin', k: 'inv-qidir' });
  f.i.value = I.soz;
  I.el.input = f.i;
  f.i.addEventListener('input', () => {
    I.soz = f.i.value; clearTimeout(I.taymer);
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
  };
  I.el.chizTop();
  m.append(h('div', { class: 'card' }, h('div', { class: 'skan-maydon' }, f.el, skanerTugma((kod) => { I.soz = ''; f.i.value = ''; topIzla(ctx, chiz, kod, true); })), natijaEl));

  const sarlavhaSoni = h('b', {});
  const royxatEl = h('div', {});
  I.el.royxatEl = royxatEl;
  I.el.chizRoyxat = () => {
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
  return ['Inventarizatsiya — ' + nom + (n.yopildi ? ' · ' + sana(n.yopildi) : ' (oraliq)'),
    'Sanaldi: ' + n.sanaldi + ' xil, to\'g\'ri: ' + n.teng,
    n.kam.length ? 'Kam (' + n.kam.length + pul(n.kam_summa) + '):\n' + n.kam.map(qator).join('\n') : 'Kam: yo\'q',
    n.ortiq.length ? 'Ortiq (' + n.ortiq.length + pul(n.ortiq_summa) + '):\n' + n.ortiq.map(qator).join('\n') : 'Ortiq: yo\'q',
    n.yoq.length ? 'Oson\'da yo\'q: ' + n.yoq.map((x) => x.nom).join(', ') : null,
    'Sanalmagan (Oson\'da bor): ' + n.sanalmagan + ' xil'].filter(Boolean).join('\n');
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
  if (n.sanalmagan) {
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
