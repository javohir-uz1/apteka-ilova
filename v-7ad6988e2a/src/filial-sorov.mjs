// «Osnovnoy'dan dori olish» (07.11, 20261107280000_filial_sorov; foydalanuvchi: "1-filial va 4-filial Osnovnoy'dan dori olib
// ketishadi — 4-filial Osnovnoy'dan dori so'rashi kerak: dori nomi, miqdori; xodim asosiy ekranida, Osnovnoy xodimlariga va
// direktorga ko'rinsin").
//   Filial xodimi: «+ Dori so'rash» (nom — Oson ro'yxatidan tanlanadi yoki qo'lda, miqdor quti/dona, izoh) → Osnovnoy'ga xabar.
//   Osnovnoy xodimi / direktor: «Tayyorladim» (qancha berildi) yoki «Yo'q»; tayyorlanganini filial «Olib ketdik» qiladi.
//   So'ragan filial — «Bekor» (tasdiq bilan). Faqat serverda (dori_sorov_royxat — OQISH, yoz/holat — YENGIL).
// Bosh sahifa ochiq turganda har daqiqada yangilanadi; ro'yxat o'zgarsagina qayta chiziladi.
import { h, input, kartaSarlavha, nusxaOl, pills, sheet, tasdiqlash, vaqt, sana } from './ui.mjs';

const YANGILASH = 60000;
const OCHIQ = new Set(['yangi', 'tayyor']);
const SS = () => ({ j: null, imzo: '', vaqt: 0, yuklanmoqda: null, xato: null, band: '', taymer: 0, oyna: null, filtr: '' });
const S = SS();
// Sinov uchun (tests): modul holatini tozalash.
export function sorovUnut() { clearTimeout(S.taymer); Object.assign(S, SS()); }

const HOLAT = {
  yangi: ['Tayyorlanmagan', 'var(--warn)'], tayyor: ['✓ Tayyor — olib keting', 'var(--kirim)'], olindi: ['Olib ketildi', 'var(--muted)'],
  yoq: ['Osnovnoy\'da yo\'q', 'var(--red)'], bekor: ['Bekor qilindi', 'var(--muted)']
};
const asl = (t) => h('span', { 'data-asl': '' }, t);
const royxat = () => (S.j && Array.isArray(S.j.royxat) ? S.j.royxat : []);
// Bugun (Toshkent kuni — sana() Toshkent vaqtida) — faqat soat, boshqa kun — sana bilan.
const kun = (ts) => (ts ? (sana(ts) === sana(Date.now()) ? vaqt(ts) : sana(ts) + ' ' + vaqt(ts)) : '');

function yukla(ctx, chiz, majbur = false) {
  // Amaldan keyingi majburiy yangilash: shu payt eski so'rov ketayotgan bo'lsa (amaldan oldin boshlangan) — u tugagach yana
  // bir marta olinadi, aks holda amaldan oldingi ro'yxat ekranda qolardi.
  if (S.yuklanmoqda) return majbur ? S.yuklanmoqda.then(() => yukla(ctx, chiz, true)) : S.yuklanmoqda;
  if (!majbur && (S.j || S.xato) && Date.now() - S.vaqt < YANGILASH) return null;
  S.yuklanmoqda = Promise.resolve().then(() => ctx.oqi('doriSorovRoyxat'))
    .then((j) => {
      if (!j || typeof j !== 'object' || !Array.isArray(j.royxat)) throw new Error('Server javobi tushunarsiz');
      const imzo = JSON.stringify(j), ozgardi = imzo !== S.imzo || !!S.xato;
      S.j = j; S.imzo = imzo; S.xato = null;
      return ozgardi;
    })
    // .catch — oldingi qadamdagi xato ham (javob shakli noto'g'ri) shu yerda ushlanadi, ishlov berilmagan rad bo'lib qolmaydi.
    .catch((e) => { S.xato = (e && e.message) || 'Ro\'yxat olinmadi'; return 'xato'; })
    .then((ozgardi) => {
      S.vaqt = Date.now(); S.yuklanmoqda = null;
      if (ozgardi === true && chiz) chiz();
      if (ozgardi && S.oyna) S.oyna();
    });
  return S.yuklanmoqda;
}

function kuzat(ctx, chiz) {
  if (S.taymer || typeof setTimeout !== 'function') return;
  S.taymer = setTimeout(() => {
    S.taymer = 0;
    if (typeof document === 'undefined' || !document.querySelector('[data-sorov-karta]')) return;
    if (!document.hidden) yukla(ctx, chiz, true);
    kuzat(ctx, chiz);
  }, YANGILASH);
  if (S.taymer && typeof S.taymer.unref === 'function') S.taymer.unref();
}

// Kim nima qila oladi (server ham shuni tekshiradi): osn — Osnovnoy xodimi yoki direktor; ozi — so'ragan filial (yoki direktor).
const osnmi = () => !!(S.j && S.j.osn);
const ozimi = (ctx, s) => (ctx.x && ctx.x.rol === 'direktor') || ((S.j && S.j.filiallar) || []).some((f) => f.id === s.f);

async function holatQoy(ctx, chiz, s, holat, berildi = null, javob = null) {
  if (S.band) return false;
  if (holat === 'bekor' && !(await tasdiqlash('«' + s.nom + '» so\'rovi bekor qilinsinmi?'
    + (s.holat === 'tayyor' ? ' Osnovnoy tayyorlab qo\'ygan — ularga xabar boradi.' : '')))) return false;
  if (holat === 'olindi' && !(await tasdiqlash('«' + s.nom + '» — ' + (s.berildi || s.soni) + ' ' + s.birlik + ' olib ketildimi? Keyin o\'zgartirib bo\'lmaydi.'))) return false;
  S.band = s.id;
  if (S.oyna) S.oyna();
  let ok = false;
  try {
    const r = await ctx.amalFon('doriSorovHolat', s.id, holat, berildi, javob);
    if (r != null) {
      ok = true;
      s.holat = holat;
      ctx.toast(holat === 'tayyor' ? 'Tayyor ✓ — filialga xabar ketdi' : holat === 'yoq' ? 'Belgilandi: Osnovnoy\'da yo\'q — filialga xabar ketdi'
        : holat === 'olindi' ? 'Olib ketildi ✓' : 'So\'rov bekor qilindi');
    }
  } finally {
    S.band = '';
    await yukla(ctx, chiz, true);
    if (S.oyna) S.oyna();
  }
  return ok;
}

// Osnovnoy: «Tayyorladim» — qancha berildi (so'ralgani oldindan yozilgan) va izoh; «Yo'q» — izoh bilan.
function javobOyna(ctx, chiz, s, holat) {
  sheet(holat === 'tayyor' ? 'Tayyorladim' : 'Osnovnoy\'da yo\'q', (box, close) => {
    box.append(h('div', { class: 'msg info' }, asl(s.nom), ' — ', s.filial, ' so\'radi: ', h('b', {}, s.soni + ' ' + s.birlik)));
    const son = holat === 'tayyor' ? input('Qancha berasiz (' + s.birlik + ' soni)', { inputmode: 'numeric', value: String(s.berildi || s.soni), pul: false }) : null;
    const iz = input('Izoh (ixtiyoriy)', { inputmode: 'text', placeholder: holat === 'tayyor' ? 'Masalan: 2 tasi bor edi' : 'Masalan: ertaga keladi' });
    if (son) box.append(son.el);
    box.append(iz.el);
    const tugma = h('button', { type: 'button', class: holat === 'tayyor' ? 'p' : 's', onclick: async () => {
      let n = null;
      if (son) {
        const v = String(son.i.value).replace(/\s/g, '');
        if (!/^\d{1,4}$/.test(v) || Number(v) < 1) { son.xato('1 dan 9999 gacha butun son yozing'); son.i.focus(); return; }
        n = Number(v);
      }
      tugma.disabled = true;
      const ok = await holatQoy(ctx, chiz, s, holat, n, iz.i.value.trim() || null);
      if (ok) close(); else tugma.disabled = false;
    } }, holat === 'tayyor' ? 'Tayyor — filialga xabar berish' : 'Yo\'q deb belgilash');
    box.append(tugma);
  });
}

function tugmalar(ctx, chiz, s) {
  if (!OCHIQ.has(s.holat)) return null;
  const band = S.band ? '' : null;
  const t = (matn, cls, fn) => h('button', { type: 'button', class: cls, disabled: band, style: cls === 'link' ? 'color:var(--red)' : null, onclick: fn },
    S.band === s.id && cls === 'p' ? 'Saqlanmoqda…' : matn);
  const osn = osnmi(), ozi = ozimi(ctx, s);
  const q = [];
  if (osn && s.holat === 'yangi') q.push(t('Tayyorladim', 'p', () => javobOyna(ctx, chiz, s, 'tayyor')), t('Yo\'q', 's', () => javobOyna(ctx, chiz, s, 'yoq')));
  if (s.holat === 'tayyor' && (ozi || osn)) q.push(t(ozi ? 'Olib ketdik' : 'Olib ketildi', 'p', () => holatQoy(ctx, chiz, s, 'olindi')));
  if (osn && s.holat === 'tayyor') q.push(t('Miqdorni o\'zgartirish', 's', () => javobOyna(ctx, chiz, s, 'tayyor')));
  if (ozi) q.push(t('Bekor', 'link', () => holatQoy(ctx, chiz, s, 'bekor')));
  return q.length ? h('div', { class: 'row sorov-t' }, ...q) : null;
}

function qator(ctx, chiz, s, bilanTugma) {
  const [hm, rang] = HOLAT[s.holat] || [s.holat, 'var(--muted)'];
  const miqdor = s.holat === 'tayyor' || (s.holat === 'olindi' && s.berildi)
    ? (s.berildi || s.soni) + ' ' + s.birlik + (s.berildi && s.berildi !== s.soni ? ' (so\'ralgan ' + s.soni + ')' : '')
    : s.soni + ' ' + s.birlik;
  const qoldiq = [s.osn != null ? 'Osnovnoy\'da: ' + s.osn : null, s.ozi != null ? s.filial + 'da: ' + s.ozi : null].filter(Boolean).join(' · ');
  return h('div', { class: 'item sorov-q', 'data-sorov': s.id },
    h('div', { class: 'line', style: 'border:0;padding:0' }, h('b', { 'data-asl': '' }, s.nom),
      h('span', { style: 'font-weight:600;white-space:nowrap;color:' + rang }, hm)),
    h('div', { class: 'muted' }, h('b', { style: 'color:var(--ink)' }, miqdor), ' · ', s.filial, ' · ', kun(s.vaqt), s.kim ? [' · ', asl(s.kim)] : null),
    s.izoh ? h('div', { class: 'muted' }, 'Izoh: ', asl(s.izoh)) : null,
    s.javob ? h('div', { class: 'muted' }, 'Osnovnoy: ', asl(s.javob)) : null,
    qoldiq ? h('div', { class: 'muted', style: 'font-size:13px' }, qoldiq) : null,
    s.holatKim && !OCHIQ.has(s.holat) ? h('div', { class: 'muted', style: 'font-size:13px' }, 'Belgiladi: ', asl(s.holatKim), ' · ', kun(s.holatVaqt)) : null,
    bilanTugma ? tugmalar(ctx, chiz, s) : null);
}

// Osnovnoy uchun yig'ish ro'yxati (tayyorlanmaganlar, filial bo'yicha) — nusxa olib qog'ozga/chatga.
function yigishMatni(list) {
  const g = new Map();
  list.filter((s) => s.holat === 'yangi').forEach((s) => { if (!g.has(s.filial)) g.set(s.filial, []); g.get(s.filial).push(s); });
  return [...g.entries()].map(([f, l]) => f + ':\n' + l.map((s, i) => (i + 1) + '. ' + s.nom + ' — ' + s.soni + ' ' + s.birlik + (s.izoh ? ' (' + s.izoh + ')' : '')).join('\n')).join('\n\n');
}

// So'rash oynasi: filial (bir nechta bo'lsa), dori nomi (Oson ro'yxatidan takliflar — Osnovnoy'dagi qoldig'i bilan), miqdor, izoh.
// Yuborilgach forma tozalanadi — keyingi dorini darhol yozish mumkin.
export function sorashOyna(ctx, chiz) {
  const fl = (S.j && S.j.filiallar) || [];
  if (!fl.length) { ctx.toast('So\'rash uchun filial yo\'q — Osnovnoy xodimi so\'ramaydi', 'xato'); return; }
  const asosiyId = ((ctx.S && ctx.S.filiallar) || []).find((f) => f.asosiy)?.id;
  sheet('📦 Osnovnoy\'dan dori so\'rash', (box, close) => {
    const f = { filial: fl.length === 1 ? fl[0].id : (fl.find((z) => ctx.x && z.id === ctx.x.filialId) || {}).id || '', birlik: 'quti', soni: 1 };
    const yuborilgan = h('div', { class: 'list' });
    if (fl.length > 1) {
      box.append(h('span', { class: 'muted' }, 'Qaysi filial uchun'), pills(fl.map((z) => [z.id, z.nom]), f.filial, (v) => { f.filial = v; }, 'Filial'));
    }
    const nom = input('Dori nomi', { inputmode: 'text', placeholder: 'Masalan: Анальгин', autocomplete: 'off' });
    const taklif = h('div', { class: 'list sorov-taklif' });
    let qidT = 0, qidN = 0;
    const qidir = () => {
      clearTimeout(qidT);
      const soz = nom.i.value.trim();
      if (soz.length < 2) { taklif.textContent = ''; return; }
      qidT = setTimeout(async () => {
        const n = ++qidN;
        let r = [];
        try { r = await ctx.oqi('osonQidir', soz); } catch (e) { r = []; }
        if (n !== qidN || !Array.isArray(r)) return;
        taklif.textContent = '';
        r.slice(0, 6).forEach((d) => {
          const fs = Array.isArray(d.filiallar) ? d.filiallar : [];
          const osn = fs.filter((z) => z.f === asosiyId).reduce((a, z) => a + (Number(z.soni) || 0), 0);
          taklif.append(h('button', { type: 'button', class: 'item', style: 'text-align:left;width:100%', onclick: () => {
            nom.qiymat(d.nom); taklif.textContent = ''; qidN++; son.i.focus();
          } }, h('b', { 'data-asl': '' }, d.nom),
          h('div', { class: 'muted', style: 'font-size:13px' }, osn > 0 ? 'Osnovnoy\'da bor' : 'Osnovnoy\'da yo\'q (Oson bo\'yicha)', d.ishlab ? [' · ', asl(d.ishlab)] : null)));
        });
      }, 350);
    };
    nom.i.addEventListener('input', qidir);
    const son = input('Miqdori', { inputmode: 'numeric', value: '1', pul: false });
    const birlik = pills([['quti', 'Quti'], ['dona', 'Dona']], f.birlik, (v) => { f.birlik = v; }, 'Birlik');
    const iz = input('Izoh (ixtiyoriy)', { inputmode: 'text', placeholder: 'Masalan: mijoz kutyapti' });
    const yubor = h('button', { type: 'button', class: 'p', onclick: async () => {
      const nm = nom.i.value.trim();
      const v = String(son.i.value).replace(/\s/g, '');
      if (fl.length > 1 && !f.filial) { ctx.toast('Filialni tanlang', 'xato'); return; }
      if (nm.length < 2) { nom.xato('Dori nomini yozing'); nom.i.focus(); return; }
      if (!/^\d{1,4}$/.test(v) || Number(v) < 1) { son.xato('1 dan 9999 gacha butun son'); son.i.focus(); return; }
      yubor.disabled = true;
      try {
        const r = await ctx.amalFon('doriSorovYoz', f.filial || null, nm, Number(v), f.birlik, iz.i.value.trim() || null);
        if (r) {
          yuborilgan.prepend(h('div', { class: 'item' }, '✓ ', asl(r.nom), ' — ' + r.soni + ' ' + r.birlik + ' so\'raldi'));
          nom.qiymat(''); son.qiymat('1'); iz.qiymat(''); taklif.textContent = '';
          ctx.toast('So\'raldi ✓ — Osnovnoy\'ga xabar ketdi');
          yukla(ctx, chiz, true);
          nom.i.focus();
        }
      } finally { yubor.disabled = false; }
    } }, 'So\'rash');
    box.append(nom.el, taklif, son.el, birlik, iz.el, yubor,
      h('div', { class: 'muted', style: 'font-size:13px' }, 'Bir nechta dori bo\'lsa — birin-ketin yozing, har biri alohida so\'rov bo\'ladi.'),
      yuborilgan, h('button', { type: 'button', class: 's', onclick: async () => {
        // Yozilgan, lekin yuborilmagan dori bo'lsa — so'raladi (jim yo'qolmasin).
        if (nom.i.value.trim() && !(await tasdiqlash('«' + nom.i.value.trim() + '» hali so\'ralmadi. Oyna yopilsinmi?'))) return;
        close();
      } }, 'Yopish'));
  });
}

// Ro'yxat oynasi: ochiqlari (tugmalar bilan), filial tanlovi (Osnovnoy ko'rinishida), yig'ish ro'yxati, yopilganlar (3 kun).
export function sorovOyna(ctx, chiz) {
  sheet('📦 Osnovnoy\'dan dori olish', (box) => {
    const ich = h('div', {});
    box.append(ich);
    const ciz = () => {
      ich.textContent = '';
      const all = royxat();
      const osn = osnmi();
      const fl = [...new Set(all.map((s) => s.filial))];
      if (S.filtr && !fl.includes(S.filtr)) S.filtr = '';
      const list = S.filtr ? all.filter((s) => s.filial === S.filtr) : all;
      const ochiq = list.filter((s) => OCHIQ.has(s.holat)), yopiq = list.filter((s) => !OCHIQ.has(s.holat));
      ich.append(h('div', { class: 'muted' }, osn
        ? 'Filiallar so\'ragan dorilar. Tayyorlab «Tayyorladim» ni bosing (berilgan miqdor bilan) — filialga xabar boradi. Bo\'lmasa — «Yo\'q». '
          + 'Dorini Oson\'da filialga ko\'chirishni unutmang.'
        : 'Osnovnoy tayyorlagach xabar keladi. Olib ketgach — «Olib ketdik».'));
      if (S.xato) ich.append(h('div', { class: 'msg warn', role: 'status' }, 'Yangilanmadi: ' + S.xato));
      if ((S.j && S.j.filiallar || []).length) ich.append(h('button', { type: 'button', class: 'p', style: 'margin-top:10px', onclick: () => sorashOyna(ctx, chiz) }, '+ Dori so\'rash'));
      if (osn && fl.length > 1) ich.append(h('div', { style: 'margin-top:10px' }, pills([['', 'Hammasi'], ...fl.map((f) => [f, f])], S.filtr, (v) => { S.filtr = v; ciz(); }, 'Filial')));
      const l = h('div', { class: 'card list', style: 'margin-top:10px' });
      if (!ochiq.length) l.append(h('div', { class: 'muted' }, 'Hozir ochiq so\'rov yo\'q.'));
      ochiq.forEach((s) => l.append(qator(ctx, chiz, s, true)));
      ich.append(l);
      if (osn && ochiq.some((s) => s.holat === 'yangi')) {
        ich.append(h('button', { type: 'button', class: 's', onclick: () => nusxaOl(yigishMatni(ochiq), ctx.toast) }, 'Yig\'ish ro\'yxatini nusxalash'));
      }
      if (yopiq.length) {
        const y = h('details', { class: 'ochil' }, h('summary', {}, 'Yopilganlar (3 kun) · ' + yopiq.length));
        const yl = h('div', { class: 'card list' });
        yopiq.forEach((s) => yl.append(qator(ctx, chiz, s, false)));
        y.append(yl);
        ich.append(y);
      }
    };
    S.oyna = ciz;
    yukla(ctx, chiz, true);
    ciz();
    return () => { if (S.oyna === ciz) S.oyna = null; };
  }, { fokus: false });
}

// Bosh sahifadagi karta (xodim va direktor). Ro'yxat hali kelmagan bo'lsa — kichik «yuklanmoqda» kartasi.
// Direktor (direktor: true): ochiq so'rov bo'lmasa — yashirin belgi (Bosh to'lib ketmasin); xodimda doim ko'rinadi.
export function sorovKarta(ctx, chiz, o = {}) {
  yukla(ctx, chiz);
  kuzat(ctx, chiz);
  const all = royxat();
  const ochiq = all.filter((s) => OCHIQ.has(s.holat));
  if (o.direktor && !ochiq.length) return h('div', { 'data-sorov-karta': '', hidden: true });
  if (!S.j && !S.xato && o.direktor) return h('div', { 'data-sorov-karta': '', hidden: true });
  const k = h('section', { class: 'card list sorov-karta', 'data-sorov-karta': '' }, kartaSarlavha('📦 Osnovnoy\'dan dori olish' + (ochiq.length ? ' (' + ochiq.length + ')' : '')));
  if (!S.j) {
    k.append(h('div', { class: 'muted' }, S.xato ? 'Ro\'yxat olinmadi: ' + S.xato : 'Yuklanmoqda…'));
    return k;
  }
  const osn = osnmi(), meniki = (S.j.filiallar || []).length > 0;
  // Ikki joyda ishlaydigan xodim (asosiy filiali + Osnovnoy): o'z filiali tayyorlari alohida ko'rinadi, «tayyorlash kerak»dan
  // o'z filiali so'rovlari chiqariladi (o'zi so'ragan dorini o'zi tayyorlamaydi). Direktor — Osnovnoy ko'rinishi.
  const ikki = osn && meniki && !o.direktor && !(ctx.x && ctx.x.rol === 'direktor');
  const meniFil = new Set((S.j.filiallar || []).map((f) => f.id));
  const yangi = ochiq.filter((s) => s.holat === 'yangi' && !(ikki && meniFil.has(s.f))), tayyor = ochiq.filter((s) => s.holat === 'tayyor');
  if (ikki) {
    const ozTayyor = tayyor.filter((s) => meniFil.has(s.f)).length;
    if (ozTayyor) k.append(h('div', { class: 'msg ok' }, '✓ ' + ozTayyor + ' ta dori tayyor — Osnovnoy\'dan olib keting.'));
  }
  if (osn) {
    if (yangi.length) {
      const fs = new Map();
      yangi.forEach((s) => fs.set(s.filial, (fs.get(s.filial) || 0) + 1));
      k.append(h('div', { class: 'msg warn' }, 'Tayyorlash kerak: ' + yangi.length + ' ta dori — ' + [...fs.entries()].map(([f, n]) => f + ' ' + n + ' ta').join(', ')));
    } else k.append(h('div', { class: 'muted' }, tayyor.length ? 'Hammasi tayyorlangan — filial olib ketishini kuting.' : 'Hozir filiallardan so\'rov yo\'q.'));
  } else if (meniki) {
    if (tayyor.length) k.append(h('div', { class: 'msg ok' }, '✓ ' + tayyor.length + ' ta dori tayyor — Osnovnoy\'dan olib keting.'));
    else if (yangi.length) k.append(h('div', { class: 'muted' }, yangi.length + ' ta dori so\'ralgan — Osnovnoy tayyorlashini kuting.'));
    else k.append(h('div', { class: 'muted' }, 'Filialda tugagan yoki kam qolgan dorini Osnovnoy\'dan so\'rang: nomi va miqdori.'));
  }
  (osn ? yangi : [...tayyor, ...yangi]).slice(0, 3).forEach((s) => k.append(qator(ctx, chiz, s, false)));
  const row = h('div', { class: 'row' });
  if (meniki && !o.direktor) row.append(h('button', { type: 'button', class: 'p', onclick: () => sorashOyna(ctx, chiz) }, '+ Dori so\'rash'));
  row.append(h('button', { type: 'button', class: meniki && !o.direktor ? 's' : 'p', onclick: () => sorovOyna(ctx, chiz) },
    ochiq.length ? 'Hammasi (' + ochiq.length + ')' : 'Ro\'yxat'));
  k.append(row);
  return k;
}
