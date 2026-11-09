// Firmalar prayslari (30.10, foydalanuvchi: "defektura yozgan xodimlar endi — men praysni qayerga tashlay, solishtirib menga
// ko'rsatsin"; narx — 100% to'lov bilan solishtiriladi, kechiktirilgan ham ko'rinadi; prays botga yuboriladi; xodimlar harfni
// adashtirishi mumkin — moslash harf xatosi bilan ham, taxminiysi belgilanadi). Faqat direktor, faqat serverda.
// Agent Excel'ini direktor botga yuboradi → shu yerda «Botga kelgan fayldan yuklash» → fayl va firma → fayl telefonda o'qiladi
// (firma-prays.mjs) → serverga faqat nom va narxlar. Defekturada: har dori — eng arzon firma; firma tanlansa — shu firmada arzonlari.
import * as H from './hisob.mjs';
import { h, input, kartaSarlavha, nusxaOl, sheet, tasdiqlash, yordam } from './ui.mjs';
import { brendlarBolib, indeksQurBolib, mosla, praysAjrat, xlsxOqi } from './firma-prays.mjs';
import { qidiruvKalit } from './kalit.mjs';

// tanlov: null — firma narxlari yopiq (03.11, foydalanuvchi: "firma narxlari bossa ko'rinishi kerak va tanlanishi kerak"),
// '' — hamma firmalar (har dori ostida eng arzon), aks holda — tanlangan firma.
const F = { royxat: null, vaqt: 0, qatorlar: new Map(), indeks: new Map(), bilingan: null, mos: new Map(), yuklanmoqda: null, keyin: false, xato: null, tanlov: null };
export const firmaOchiq = () => F.tanlov !== null;

// Telefon xotirasi (audit 30.10): firma qatorlari — IndexedDB (localStorage 5 MB ga 2–3 firma sig'masdi va boshqa sozlamalarni
// ham buzardi). Bo'lmasa (eski WebView, maxfiy rejim) — faqat shu ochilishda xotirada, har ochilishda serverdan.
const IDB = { db: null };
const idbOch = () => {
  if (IDB.db) return IDB.db;
  IDB.db = new Promise((ok) => {
    try {
      const r = indexedDB.open('apteka-firma', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('q');
      r.onsuccess = () => ok(r.result);
      r.onerror = () => ok(null);
    } catch (e) { ok(null); }
  });
  return IDB.db;
};
const idb = async (rejim, fn) => {
  const db = await idbOch();
  if (!db) return null;
  return new Promise((ok) => {
    try {
      const t = db.transaction('q', rejim), st = t.objectStore('q');
      const r = fn(st);
      t.oncomplete = () => ok(r && 'result' in r ? r.result : true);
      t.onerror = t.onabort = () => ok(null);
    } catch (e) { ok(null); }
  });
};
// Eski versiya (localStorage) qoldiqlari — bir marta tozalanadi.
try { for (let i = localStorage.length - 1; i >= 0; i--) { const k = localStorage.key(i); if (k && k.startsWith('apteka-firma:')) localStorage.removeItem(k); } } catch (e) { /* bo'sh */ }

// Qator qidiruv kaliti (talaffuz kaliti) — bir marta, qator obyektida.
const kalitYoz = (q) => { if (q.k == null) q.k = qidiruvKalit(q.nom); };
// Ro'yxat (1 daqiqa eslab qolinadi) va har firma qatorlari (versiya o'zgarmasa — telefon xotirasidan).
// majbur — yuklash/o'chirishdan keyin: ketayotgan so'rov tugagach yana bir marta olinadi (yangi prays ko'rinmay qolmasin).
export function firmalarOl(ctx, majbur = false) {
  if (F.yuklanmoqda) { if (majbur) F.keyin = true; return F.yuklanmoqda; }
  if (!majbur && F.royxat && Date.now() - F.vaqt < 60000) return Promise.resolve(F.royxat);
  F.yuklanmoqda = (async () => {
    const royxat = await ctx.oqi('firmaRoyxat');
    const yangi = new Map();
    for (const r of royxat) {
      const bor = F.qatorlar.get(r.firma);
      if (bor && bor.versiya === r.versiya) { yangi.set(r.firma, bor); continue; }
      let k = await idb('readonly', (st) => st.get(r.firma));
      if (!k || k.versiya !== r.versiya || !Array.isArray(k.q)) {
        const j = await ctx.oqi('firmaQatorlar', r.firma);
        k = { versiya: j.versiya, q: j.qatorlar };
        await idb('readwrite', (st) => st.put(k, r.firma));
      }
      yangi.set(r.firma, { versiya: k.versiya, qatorlar: k.q.map(([nom, yuz, kech, muddat, ishlab]) => ({ nom, yuz, kech, muddat, ishlab })) });
    }
    // Hammasi olingach bir yo'la almashtiriladi (yarmida xato bo'lsa — eskisi qoladi). O'chirilgan firmalar xotiradan ham.
    const kalitlar = await idb('readonly', (st) => st.getAllKeys());
    if (Array.isArray(kalitlar)) for (const k of kalitlar) if (!yangi.has(k)) await idb('readwrite', (st) => st.delete(k));
    F.qatorlar = yangi;
    // Moslash uchun: har firmaga harf indeksi (≈20× kam nomzod — telefonda tez) va hamma firmalardagi brendlar.
    // Indeks faqat o'zgargan firmaga qayta quriladi. Audit 10.11 kech (qotish): 500 qatordan bo'lib (telefon qotmasin); shu
    // bo'laklarda har qatorga qidiruv kaliti ham bir marta yoziladi («Narx qidirish» har harfda hisoblamasin).
    const ix = new Map();
    for (const [f, v] of yangi) {
      ix.set(f, F.indeks.get(f)?.v === v ? F.indeks.get(f) : { v, ix: await indeksQurBolib(v.qatorlar, kalitYoz) });
    }
    F.indeks = ix;
    F.bilingan = await brendlarBolib([...yangi.values()].flatMap((v) => v.qatorlar));
    if (F.tanlov && !yangi.has(F.tanlov)) F.tanlov = '';
    const ozgardi = !F.royxat || F.royxat.map((r) => r.versiya).join() !== royxat.map((r) => r.versiya).join();
    F.royxat = royxat; F.vaqt = Date.now(); F.xato = null;
    if (ozgardi) F.mos = new Map();   // moslash natijalari — faqat prays o'zgarsa qayta hisoblanadi
    return royxat;
  })().catch((e) => { F.xato = e.message || 'Firma narxlari olinmadi'; F.vaqt = Date.now(); throw e; })
    .finally(() => { F.yuklanmoqda = null; if (F.keyin) { F.keyin = false; firmalarOl(ctx, true).catch(() => {}); } });
  return F.yuklanmoqda;
}
// Ekran chizilganda: 1 daqiqadan eski bo'lsa — fonda yangilanadi (boshqa telefonda yuklangan prays ham ko'rinsin); o'zgarsa — qayta chiziladi.
function eskirganBolsa(ctx, chiz) {
  if (F.yuklanmoqda || !F.royxat || Date.now() - F.vaqt < 60000) return;
  const oldin = F.royxat.map((r) => r.versiya).join();
  firmalarOl(ctx).then((r) => { if (r.map((x) => x.versiya).join() !== oldin) chiz(); }, () => {});
}

// Defektura nomi → har firmada eng mos dori: [{ firma, nom, yuz, kech, muddat, ishlab, aniq }]. Avval aniq mosliklar (arzonidan),
// keyin taxminiylari — «Eng arzon» hech qachon taxminiy bo'lmaydi, aniq moslik biror firmada bo'lsa (audit 30.10).
export function narxlar(nom) {
  if (F.mos.has(nom)) return F.mos.get(nom);
  const r = [];
  for (const [firma, { ix }] of F.indeks) { const m = mosla(nom, ix, F.bilingan); if (m) r.push({ ...m, firma }); }
  r.sort((a, b) => (b.aniq - a.aniq) || a.yuz - b.yuz);
  F.mos.set(nom, r);
  return r;
}

const narxMatn = (q) => H.som(q.yuz) + (q.kech ? ' · kechiktirilgan ' + H.som(q.kech) : '');
const taxminiy = () => h('span', { class: 'firma-tax', title: 'Nomi to\'liq mos emas — tekshiring' }, 'taxminiy');

function narxSheet(nom, r) {
  sheet(nom, (box) => {
    box.append(h('div', { class: 'muted' }, 'Har firmada topilgan dori — firmadagi aniq nomi bilan. Avval nomi to\'liq mos kelganlar (100% to\'lov narxi, arzonidan), keyin «taxminiy»lar — ularni tekshiring.'));
    const l = h('div', { class: 'card list' });
    r.forEach((q, i) => l.append(h('div', { class: 'item firma-q' + (i === 0 ? ' arzon' : '') },
      h('div', { class: 'line', style: 'border:0;padding:0' }, h('b', {}, (i === 0 ? '✓ ' : '') + q.firma), h('b', {}, H.som(q.yuz))),
      h('div', { class: 'firma-nomi', 'data-asl': '' }, q.nom + (q.ishlab ? ' · ' + q.ishlab : ''), q.aniq ? null : [' · ', taxminiy()]),
      h('div', { class: 'muted' }, (q.kech ? 'Kechiktirilgan to\'lov: ' + H.som(q.kech) : 'Kechiktirilgan narx yo\'q') + (q.muddat ? ' · yaroqli: ' + q.muddat : '')))));
    if (!r.length) l.append(h('div', { class: 'muted' }, 'Yuklangan firmalarning birortasida topilmadi. Nomini «Firma prayslari» → «Narx qidirish»da tekshiring.'));
    box.append(l);
  }, { fokus: false });
}

// Defektura qatori ostida: eng arzon firma (bosilsa — hamma firmalar).
export function defNarxQator(nom) {
  if (!F.royxat || !F.royxat.length) return null;
  const r = narxlar(nom);
  if (!r.length) return h('div', { class: 'muted firma-yoq' }, 'Firmalarda topilmadi');
  const e = r[0];
  // Firmadagi aniq nomi (foydalanuvchi 30.10: «praysdagi nomini ham qo'shib qo'y — xatoliklarning oldini olamiz»): xodim yozgani va
  // firmada topilgani yonma-yon — boshqa dori bo'lsa darhol ko'rinadi.
  return h('button', { type: 'button', class: 'firma-eng', onclick: () => narxSheet(nom, r) },
    h('span', {}, 'Eng arzon: ', h('b', {}, e.firma), ' — ', h('b', {}, H.som(e.yuz))),
    e.aniq ? null : taxminiy(),
    h('span', { class: 'firma-nomi', 'data-asl': '' }, e.firma + ': ' + e.nom + (e.ishlab ? ' · ' + e.ishlab : '')),
    h('span', { class: 'muted' }, (e.kech ? 'kechiktirilgan ' + H.som(e.kech) + ' · ' : '') + (r.length > 1 ? r.length + ' firmada bor ›' : 'faqat shu firmada ›')));
}

// Firma tanlash oynasi: «Hammasi» yoki bitta firma (har birida — defekturadagi nechta dori shu firmada eng arzon).
function firmaTanlaSheet(nomlar, chiz, ochFirmalar) {
  sheet('Firmani tanlang', (box, close) => {
    const arzon = new Map();
    nomlar.forEach((n) => { const r = narxlar(n); if (r.length) arzon.set(r[0].firma, (arzon.get(r[0].firma) || 0) + 1); });
    const tanla = (v) => { F.tanlov = v; close(); chiz(); };
    const l = h('div', { class: 'card list' });
    l.append(h('button', { type: 'button', class: 'item firma-q' + (F.tanlov === '' ? ' arzon' : ''), onclick: () => tanla('') },
      h('div', { class: 'line', style: 'border:0;padding:0' }, h('b', {}, (F.tanlov === '' ? '✓ ' : '') + 'Hammasi'), h('span', { class: 'muted' }, F.royxat.length + ' ta firma')),
      h('div', { class: 'muted' }, 'Har dori ostida — eng arzon firma')));
    F.royxat.forEach((r) => l.append(h('button', { type: 'button', class: 'item firma-q' + (F.tanlov === r.firma ? ' arzon' : ''), onclick: () => tanla(r.firma) },
      h('div', { class: 'line', style: 'border:0;padding:0' }, h('b', {}, (F.tanlov === r.firma ? '✓ ' : '') + r.firma),
        h('span', { class: 'muted' }, (arzon.get(r.firma) || 0) + ' ta arzon')),
      h('div', { class: 'muted' + (r.kun > 7 ? ' firma-eski' : '') }, r.soni + ' ta dori · yuklangan ' + r.yuklandi + (r.kun > 7 ? ' — ' + r.kun + ' kun oldin' : '')))));
    box.append(h('div', { class: 'muted' }, '«N ta arzon» — defekturadagi nechta dori shu firmada eng arzon.'), l,
      h('button', { class: 'link', onclick: () => { close(); ochFirmalar(); } }, 'Firma prayslari (yuklash, yangilash) ›'));
  }, { fokus: false });
}

// Defektura kartasi: yopiq — «Firmani tanlash» tugmasi; firma tanlansa — shu firmada eng arzon dorilar (nusxalash bilan).
export function defFirmaKarta(ctx, ochiq, chiz, ochFirmalar) {
  if (!ctx.server) return null;
  const k = h('section', { class: 'card firma-karta' }, kartaSarlavha('Firmalar narxi'));
  if (!F.royxat && !F.xato) {
    k.append(h('div', { class: 'muted' }, 'Firma narxlari yuklanmoqda…'));
    firmalarOl(ctx).then(chiz, chiz);
    return k;
  }
  if (F.xato && !F.royxat) {
    k.append(h('div', { class: 'muted' }, F.xato), h('button', { class: 's', onclick: () => { F.xato = null; firmalarOl(ctx, true).then(chiz, chiz); chiz(); } }, 'Qayta urinish'));
    return k;
  }
  if (!F.royxat.length) {
    k.append(h('div', { class: 'muted' }, 'Agent yuborgan Excel praysni botga yuboring, keyin shu yerdan yuklang — har dori qaysi firmada arzonligi shu ro\'yxatda chiqadi.'),
      h('button', { class: 'p', onclick: ochFirmalar }, 'Firma prayslari'));
    return k;
  }
  eskirganBolsa(ctx, chiz);
  const nomlar = ochiq.map((d) => d.nom);
  const tanlaTugma = (matn, cls) => h('button', { class: cls, onclick: () => firmaTanlaSheet(nomlar, chiz, ochFirmalar) }, matn);
  if (F.tanlov === null) {
    k.append(h('div', { class: 'muted' }, F.royxat.length + ' ta firma praysi yuklangan. Firmani tanlang — shu firmada arzon dorilar chiqadi.'),
      tanlaTugma('Firmani tanlash ›', 'p'));
    return k;
  }
  k.append(h('div', { class: 'firma-jami' }, h('span', { class: 'muted' }, 'Tanlangan firma'), h('b', { style: 'font-size:18px' }, F.tanlov || 'Hammasi')),
    h('div', { class: 'row' }, tanlaTugma('Boshqa firma', 's'), h('button', { class: 's', onclick: () => { F.tanlov = null; chiz(); } }, 'Yopish')));
  const topildi = nomlar.filter((n) => narxlar(n).length);
  if (!F.tanlov) {
    k.append(h('div', { class: 'muted' }, nomlar.length ? topildi.length + ' / ' + nomlar.length + ' dori firmalarda topildi. Har dori ostida — eng arzon firma.' : 'Defektura bo\'sh.'));
  } else {
    // Shu firmada eng arzon (yoki faqat shu firmada bor) dorilar. Xodimlar bir dorini har xil (xato) yozgan bo'lsa —
    // firmadagi bitta dori, bitta qator: «Defekturada: Trombopol 150 · Тромбапол 150мг №60».
    const guruh = new Map();
    nomlar.forEach((n) => {
      const r = narxlar(n);
      if (!r.length || r[0].firma !== F.tanlov) return;
      const g = guruh.get(r[0].nom) || { r, nomlar: [] };
      g.nomlar.push(n);
      guruh.set(r[0].nom, g);
    });
    const shu = [...guruh.values()];
    const jami = shu.reduce((a, { r }) => a + r[0].yuz, 0);
    k.append(h('div', { class: 'firma-jami' }, h('b', {}, shu.length + ' ta dori'), h('span', { class: 'muted' }, F.tanlov + '\'da eng arzon · har biridan 1 tadan ' + H.som(jami))));
    const l = h('div', { class: 'list' });
    shu.forEach(({ r, nomlar: ns }) => l.append(h('button', { type: 'button', class: 'item firma-q', onclick: () => narxSheet(ns[0], r) },
      h('div', { class: 'line', style: 'border:0;padding:0' }, h('b', { 'data-asl': '' }, r[0].nom), h('b', {}, H.som(r[0].yuz))),
      h('div', { class: 'muted', 'data-asl': '' }, (r[0].ishlab ? r[0].ishlab + ' · ' : '') + 'Defekturada: ' + ns.join(' · '), r[0].aniq ? null : [' · ', taxminiy()],
        r[1] ? ' · keyingisi: ' + r[1].firma + ' ' + H.som(r[1].yuz) : ''))));
    if (!shu.length) l.append(h('div', { class: 'muted' }, 'Defekturadagi birorta dori bu firmada eng arzon emas.'));
    k.append(l);
    if (shu.length) {
      const matn = F.tanlov + ' — buyurtma:\n' + shu.map(({ r }, i) => (i + 1) + '. ' + r[0].nom + ' — ' + H.som(r[0].yuz)).join('\n');
      k.append(h('button', { class: 's', onclick: () => nusxaOl(matn, ctx.toast, 'Ro\'yxat nusxalandi — agentga yuboring ✓') }, 'Agentga ro\'yxatni nusxalash'));
    }
  }
  k.append(h('button', { class: 'link', onclick: ochFirmalar }, 'Firma prayslari (yuklash, yangilash) ›'));
  return k;
}

// Botga kelgan fayl → firma → o'qish → ko'rish → saqlash.
// Amallar: ctx.amal xatoda null qaytaradi (xato xabarini o'zi ko'rsatadi) — u holda «✓» chiqmaydi va oyna yopilmaydi (audit 03.11).
function yuklashSheet(ctx, chiz, firmaOldin) {
  sheet('Botga kelgan fayldan', (box, close) => {
    box.append(h('div', { class: 'muted' }, 'Agent yuborgan Excel praysni botga yuboring (forward) — u shu ro\'yxatda chiqadi. Faylni tanlang.'));
    const l = h('div', { class: 'card list' }, h('div', { class: 'muted' }, 'Yuklanmoqda…'));
    box.append(l);
    ctx.oqi('firmaFayllar').then((fayllar) => {
      l.textContent = '';
      if (!fayllar.length) { l.append(h('div', { class: 'muted' }, 'Oxirgi 14 kunda botga Excel (.xlsx) fayl kelmagan.')); return; }
      const HOLAT = { prays: ' · firma praysi sifatida ishlatilgan', faktura: ' · nakladnoy faktura sifatida olgan' };
      fayllar.forEach((f) => {
        l.append(h('button', { type: 'button', class: 'item', onclick: () => { close(); firmaSheet(ctx, chiz, f, firmaOldin); } },
          h('div', { class: 'line', style: 'border:0;padding:0' }, h('b', { 'data-asl': '' }, f.nom), h('span', { class: 'muted' }, f.vaqt)),
          h('div', { class: 'muted' }, f.kim + (f.hajm ? ' · ' + (f.hajm / 1e6).toFixed(1).replace('.', ',') + ' MB' : '') + (HOLAT[f.holat] || ''))));
        // Adashib tanlangan haqiqiy faktura — nakladnoy navbatiga qaytariladi.
        if (f.holat === 'prays') l.append(h('button', { type: 'button', class: 'link', onclick: () => tasdiqlash(f.nom + ' — bu faktura edi? Nakladnoy dasturining «Botdan kelgan fakturalar» ro\'yxatiga qaytarilsinmi?')
          .then((ha) => ha && ctx.amal('firmaFaylQaytar', f.id).then((r) => { if (r == null) return; ctx.toast('Fakturalarga qaytarildi ✓'); close(); }, () => {})) }, 'Bu faktura edi — fakturalarga qaytarish'));
      });
    }).catch((e) => { l.textContent = ''; l.append(h('div', { class: 'muted' }, e.message || 'Fayllar olinmadi')); });
  }, { fokus: false });
}

function firmaSheet(ctx, chiz, fayl, firmaOldin) {
  sheet('Qaysi firma praysi?', (box, close) => {
    const bor = (F.royxat || []).map((r) => r.firma);
    const fn = fayl.nom.toLowerCase().replace(/[_\-.]+/g, ' ');
    const taxmin = firmaOldin || bor.find((f) => fn.includes(f.toLowerCase())) || '';
    const inp = input('Firma nomi', { value: taxmin, placeholder: 'Masalan: Grand Pharm', maxlength: '60', inputmode: 'text', pul: false });
    box.append(h('div', { class: 'muted', 'data-asl': '' }, fayl.nom), inp.el);
    if (bor.length) box.append(h('div', { class: 'muted' }, 'Yoki bori:'), h('div', { class: 'row', style: 'flex-wrap:wrap' },
      ...bor.map((f) => h('button', { type: 'button', class: 's', onclick: () => { inp.i.value = f; inp.xato(''); } }, f))));
    const holat = h('div', { class: 'muted', role: 'status' });
    const tugma = h('button', { class: 'p' }, 'Faylni o\'qish');
    box.append(holat, tugma);
    let natija = null;
    inp.i.addEventListener('input', () => { if (natija) tugma.textContent = 'Saqlash — ' + (inp.i.value.replace(/\s+/g, ' ').trim() || '…'); });
    tugma.onclick = async () => {
      const firma = inp.i.value.replace(/\s+/g, ' ').trim();
      if (firma.length < 2) { inp.xato('Firma nomini yozing'); return; }
      if (natija) return saqla(firma);
      tugma.disabled = true;
      try {
        holat.textContent = 'Fayl olinmoqda…';
        const bayt = await ctx.firma.fayl(fayl.id);
        holat.textContent = 'O\'qilmoqda…';
        natija = praysAjrat(await xlsxOqi(bayt));
        if (!natija.length) throw new Error('Faylda narxli dori topilmadi — bu firma praysimi? (Ustunlar: «Наименование» va «Цена»)');
        if (natija.length > 20000) throw new Error('Prays juda katta: ' + natija.length + ' qator (20 000 gacha)');
        if (JSON.stringify(natija.map((q) => [q.nom, q.yuz, q.kech, q.muddat, q.ishlab])).length > 3900000) throw new Error('Prays juda katta (4 MB dan ko\'p) — agentdan qisqaroq faylni so\'rang');
        const kechBor = natija.filter((q) => q.kech).length;
        holat.textContent = '';
        holat.append(h('b', {}, natija.length + ' ta dori topildi'), h('br'),
          kechBor ? '100% to\'lov va kechiktirilgan narx bor.' : 'Faqat 100% to\'lov narxi (kechiktirilgan ustuni yo\'q).',
          ...natija.slice(0, 3).map((q) => h('div', { class: 'firma-namuna', 'data-asl': '' }, q.nom + ' — ' + narxMatn(q))));
        tugma.textContent = 'Saqlash — ' + firma;
      } catch (e) {
        natija = null; holat.textContent = e.message || 'Fayl o\'qilmadi';
      } finally { tugma.disabled = false; }
    };
    const saqla = async (firma) => {
      const eski = (F.royxat || []).find((r) => r.firma.toLowerCase() === firma.toLowerCase());
      if (eski && !(await tasdiqlash(eski.firma + ' praysi almashtirilsinmi?\nHozirgi: ' + eski.soni + ' ta dori (' + eski.yuklandi + ')\nYangi: ' + natija.length + ' ta dori.\nEski prays o\'chiriladi — faqat yangisi qoladi.'))) return;
      tugma.disabled = true; holat.textContent = 'Saqlanmoqda…';
      try {
        const n = await ctx.firma.yukla({ firma, fayl: fayl.id, faylNom: fayl.nom, qatorlar: natija.map((q) => [q.nom, q.yuz, q.kech, q.muddat, q.ishlab]) });
        ctx.toast(firma + ': ' + n + ' ta dori saqlandi ✓');
        close();
        firmalarOl(ctx, true).then(chiz, chiz);
      } catch (e) { holat.textContent = e.message || 'Saqlanmadi'; tugma.disabled = false; }
    };
  }, { fokus: false });
}

// Bo'limlar → Dorilar → «Firma prayslari»: yuklangan firmalar, yangilash/o'chirish, hamma firmalar bo'yicha narx qidirish.
export function firmaPrayslarView(m, ctx) {
  const chiz = () => ctx.rerender();
  if (!ctx.server) { m.append(h('div', { class: 'card muted' }, 'Firma prayslari faqat Telegram ilovasida ishlaydi.')); return; }
  m.append(yordam('1. Agent yuborgan Excel praysni botga yuboring (forward).\n2. Shu yerda «Botga kelgan fayldan yuklash» → faylni tanlang → firma nomini yozing → «Faylni o\'qish» → «Saqlash».\n'
    + '3. Defektura bo\'limida «Firmani tanlash» → «Hammasi» — har dori ostida eng arzon firma (100% to\'lov narxi, yonida kechiktirilgan); bitta firma (masalan, Grand Pharm) — shu firmada arzon dorilar va agentga yuboriladigan ro\'yxat.\n'
    + 'Yangi prays yuklansa — o\'sha firmaning eskisi o\'rniga tushadi. Xodim nomni xato yozgan bo\'lsa ham topiladi — «taxminiy» belgisi bo\'lsa, aniq nomini tekshiring.'));
  m.append(h('button', { class: 'p', onclick: () => yuklashSheet(ctx, chiz) }, '+ Botga kelgan fayldan yuklash'));
  const k = h('section', { class: 'card list' }, kartaSarlavha('Yuklangan prayslar'));
  m.append(k);
  if (!F.royxat) {
    k.append(h('div', { class: 'muted' }, F.xato || 'Yuklanmoqda…'));
    if (!F.xato) firmalarOl(ctx).then(chiz, chiz);
    else k.append(h('button', { class: 's', onclick: () => { F.xato = null; chiz(); } }, 'Qayta urinish'));
    return;
  }
  eskirganBolsa(ctx, chiz);
  if (!F.royxat.length) k.append(h('div', { class: 'muted' }, 'Hali birorta firma praysi yuklanmagan.'));
  F.royxat.forEach((r) => k.append(h('button', { type: 'button', class: 'item', onclick: () => sheet(r.firma, (box, close) => {
    box.append(h('div', { class: 'muted' }, r.soni + ' ta dori · yuklangan ' + r.yuklandi + (r.fayl ? ' · ' + r.fayl : '')),
      h('button', { class: 'p', onclick: () => { close(); yuklashSheet(ctx, chiz, r.firma); } }, 'Yangi prays yuklash'),
      h('button', { class: 's', onclick: () => tasdiqlash(r.firma + ' praysi o\'chirilsinmi?').then((ha) => ha && ctx.amal('firmaOchir', r.firma)
        .then((x) => { if (x == null) return; close(); return firmalarOl(ctx, true).then(chiz, chiz); })) }, 'Praysni o\'chirish'));
  }, { fokus: false }) },
  h('div', { class: 'line', style: 'border:0;padding:0' }, h('b', {}, r.firma), h('span', { class: 'muted' }, r.soni + ' ta dori')),
  h('div', { class: 'muted' + (r.kun > 7 ? ' firma-eski' : '') }, 'Yuklangan: ' + r.yuklandi + (r.kun > 7 ? ' — ' + r.kun + ' kun oldin, yangilang' : '')))));
  // Narx qidirish (hamma firmalar): nom bo'yicha, arzonidan.
  if (F.royxat.length) {
    const q = input('Dori nomi', { placeholder: 'Masalan: Тромбопол 150', inputmode: 'search', enterkeyhint: 'search', pul: false });
    const natija = h('div', { class: 'list', 'aria-live': 'polite' });
    // Audit 10.11 kech (qotish): har harfda hamma firmalarning hamma qatoriga talaffuz kaliti hisoblanardi. Endi qator kaliti
    // firmalarOl'da bir marta yoziladi, so'z kaliti — bir marta, qidiruv — yozib bo'lgach 200 ms dan keyin (H.qidiruvMos bilan bir xil qoida).
    let taymer = 0;
    const izla = () => {
      clearTimeout(taymer);
      natija.textContent = '';
      const s = q.i.value.trim();
      if (s.length < 3) return;
      const w = qidiruvKalit(s).split(' ').filter(Boolean);
      if (w.join('').length < 2) return;
      const r = [];
      for (const [firma, { qatorlar }] of F.qatorlar) {
        for (const x of qatorlar) {
          if (x.k == null) kalitYoz(x);
          if (w.every((z) => x.k.includes(z))) r.push({ ...x, firma });
        }
      }
      r.sort((a, b) => a.yuz - b.yuz);
      r.slice(0, 40).forEach((x) => natija.append(h('div', { class: 'item' },
        h('div', { class: 'line', style: 'border:0;padding:0' }, h('span', { 'data-asl': '' }, x.nom), h('b', {}, H.som(x.yuz))),
        h('div', { class: 'muted' }, x.firma + (x.kech ? ' · kechiktirilgan ' + H.som(x.kech) : '') + (x.muddat ? ' · ' + x.muddat : '')))));
      if (!r.length) natija.append(h('div', { class: 'muted' }, 'Topilmadi'));
      else if (r.length > 40) natija.append(h('div', { class: 'muted' }, 'Yana ' + (r.length - 40) + ' ta — aniqroq yozing'));
    };
    q.i.addEventListener('input', () => { clearTimeout(taymer); taymer = setTimeout(izla, 200); });
    q.i.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); izla(); } });
    m.append(h('section', { class: 'card' }, kartaSarlavha('Narx qidirish'), q.el, natija));
  }
}
