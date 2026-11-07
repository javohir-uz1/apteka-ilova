// Filiallararo dori so'rovlari (07.11; 20261107280000_filial_sorov, 20261107300000_filial_sorov2).
//   «Osnovnoy'dan dori olish» — filial xodimi (1-Filial, 4-filial) Osnovnoy'dan so'raydi (foydalanuvchi: "xodim asosiy ekranida,
//   Osnovnoy xodimlariga va direktorga ko'rinsin"). 07.11 kech: «Filiallardan dori olish» — Osnovnoy ham istalgan filialdan so'raydi
//   ("filiallar Osnovnoy'dan dori so'ragani kabi"). Har so'rovda: f — kim uchun (so'ragan filial), m — kimdan (manba).
//   Manba filial xodimi / direktor: «Tayyorladim» (qancha berildi) yoki «Yo'q»; so'ragan filial: «Olib ketdik», «Bekor» (tasdiq bilan).
//   Faqat serverda (dori_sorov_royxat — OQISH, yoz/holat — YENGIL). Bosh sahifa ochiq turganda har daqiqada yangilanadi.
import { h, input, kartaSarlavha, nusxaOl, pills, sheet, tasdiqlash, vaqt, sana } from './ui.mjs';

const YANGILASH = 60000;
const OCHIQ = new Set(['yangi', 'tayyor']);
const SS = () => ({ j: null, imzo: '', vaqt: 0, yuklanmoqda: null, xato: null, band: '', taymer: 0, oyna: null, filtr: '' });
const S = SS();
// Sinov uchun (tests): modul holatini tozalash.
export function sorovUnut() { clearTimeout(S.taymer); Object.assign(S, SS()); }

const asl = (t) => h('span', { 'data-asl': '' }, t);
const royxat = () => (S.j && Array.isArray(S.j.royxat) ? S.j.royxat : []);
// Bugun (Toshkent kuni — sana() Toshkent vaqtida) — faqat soat, boshqa kun — sana bilan.
const kun = (ts) => (ts ? (sana(ts) === sana(Date.now()) ? vaqt(ts) : sana(ts) + ' ' + vaqt(ts)) : '');
// Eski server javobida manba yo'q — Osnovnoy.
const manbaNom = (s) => s.manba || (S.j && S.j.asosiy) || 'Osnovnoy';
const holatMatn = (s) => ({
  yangi: ['Tayyorlanmagan', 'var(--warn)'], tayyor: ['✓ Tayyor — olib keting', 'var(--kirim)'], olindi: ['Olib ketildi', 'var(--muted)'],
  yoq: [manbaNom(s) + '\'da yo\'q', 'var(--red)'], bekor: ['Bekor qilindi', 'var(--muted)']
})[s.holat] || [s.holat, 'var(--muted)'];

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

// Kim nima qila oladi (server ham shuni tekshiradi). meniki — xodimning filiallari (direktor — null: hammasi).
const direktormi = (ctx) => !!(ctx.x && ctx.x.rol === 'direktor');
const meniki = () => {
  if (S.j && Array.isArray(S.j.meniki)) return new Set(S.j.meniki);
  return new Set(((S.j && S.j.filiallar) || []).map((f) => f.id));   // eski server: so'ray oladigan filiallar
};
// Beruvchi: manba filial xodimi (eski server — Osnovnoy xodimi, osn).
const berishmi = (ctx, s) => direktormi(ctx) || (s.m ? meniki().has(s.m) : !!(S.j && S.j.osn));
// So'ragan: so'ragan filial xodimi.
const sorovchimi = (ctx, s) => direktormi(ctx) || meniki().has(s.f);
const sorashFiliallar = () => ((S.j && S.j.filiallar) || []).filter((f) => !Array.isArray(f.manbalar) || f.manbalar.length);

async function holatQoy(ctx, chiz, s, holat, berildi = null, javob = null) {
  if (S.band) return false;
  if (holat === 'bekor' && !(await tasdiqlash('«' + s.nom + '» so\'rovi bekor qilinsinmi?'
    + (s.holat === 'tayyor' ? ' ' + manbaNom(s) + ' tayyorlab qo\'ygan — ularga xabar boradi.' : '')))) return false;
  if (holat === 'olindi' && !(await tasdiqlash('«' + s.nom + '» — ' + (s.berildi || s.soni) + ' ' + s.birlik + ' olib ketildimi? Keyin o\'zgartirib bo\'lmaydi.'))) return false;
  S.band = s.id;
  if (S.oyna) S.oyna();
  let ok = false;
  try {
    const r = await ctx.amalFon('doriSorovHolat', s.id, holat, berildi, javob);
    if (r != null) {
      ok = true;
      s.holat = holat;
      ctx.toast(holat === 'tayyor' ? 'Tayyor ✓ — ' + s.filial + 'ga xabar ketdi' : holat === 'yoq' ? 'Belgilandi: ' + manbaNom(s) + '\'da yo\'q — ' + s.filial + 'ga xabar ketdi'
        : holat === 'olindi' ? 'Olib ketildi ✓' : 'So\'rov bekor qilindi');
    }
  } finally {
    S.band = '';
    await yukla(ctx, chiz, true);
    if (S.oyna) S.oyna();
  }
  return ok;
}

// Beruvchi filial: «Tayyorladim» — qancha berildi (so'ralgani yoki avval yozilgani) va izoh; «Yo'q» — izoh bilan.
function javobOyna(ctx, chiz, s, holat) {
  sheet(holat === 'tayyor' ? 'Tayyorladim' : manbaNom(s) + '\'da yo\'q', (box, close) => {
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
    } }, holat === 'tayyor' ? 'Tayyor — ' + s.filial + 'ga xabar berish' : 'Yo\'q deb belgilash');
    box.append(tugma);
  });
}

function tugmalar(ctx, chiz, s) {
  if (!OCHIQ.has(s.holat)) return null;
  const band = S.band ? '' : null;
  const t = (matn, cls, fn) => h('button', { type: 'button', class: cls, disabled: band, style: cls === 'link' ? 'color:var(--red)' : null, onclick: fn },
    S.band === s.id && cls === 'p' ? 'Saqlanmoqda…' : matn);
  const ber = berishmi(ctx, s), ozi = sorovchimi(ctx, s);
  const q = [];
  if (ber && s.holat === 'yangi') q.push(t('Tayyorladim', 'p', () => javobOyna(ctx, chiz, s, 'tayyor')), t('Yo\'q', 's', () => javobOyna(ctx, chiz, s, 'yoq')));
  if (s.holat === 'tayyor' && (ozi || ber)) q.push(t(ozi ? 'Olib ketdik' : 'Olib ketildi', 'p', () => holatQoy(ctx, chiz, s, 'olindi')));
  if (ber && s.holat === 'tayyor') q.push(t('Miqdorni o\'zgartirish', 's', () => javobOyna(ctx, chiz, s, 'tayyor')));
  if (ozi) q.push(t('Bekor', 'link', () => holatQoy(ctx, chiz, s, 'bekor')));
  return q.length ? h('div', { class: 'row sorov-t' }, ...q) : null;
}

function qator(ctx, chiz, s, bilanTugma) {
  const [hm, rang] = holatMatn(s);
  const miqdor = s.holat === 'tayyor' || (s.holat === 'olindi' && s.berildi)
    ? (s.berildi || s.soni) + ' ' + s.birlik + (s.berildi && s.berildi !== s.soni ? ' (so\'ralgan ' + s.soni + ')' : '')
    : s.soni + ' ' + s.birlik;
  const ber = s.ber !== undefined ? s.ber : s.osn;
  const qoldiq = [ber != null ? manbaNom(s) + '\'da: ' + ber : null, s.ozi != null ? s.filial + 'da: ' + s.ozi : null].filter(Boolean).join(' · ');
  return h('div', { class: 'item sorov-q', 'data-sorov': s.id },
    h('div', { class: 'line', style: 'border:0;padding:0' }, h('b', { 'data-asl': '' }, s.nom),
      h('span', { style: 'font-weight:600;white-space:nowrap;color:' + rang }, hm)),
    h('div', { class: 'muted' }, h('b', { style: 'color:var(--ink)' }, miqdor), ' · ', s.filial + ' → ' + manbaNom(s) + '\'dan', ' · ', kun(s.vaqt), s.kim ? [' · ', asl(s.kim)] : null),
    s.izoh ? h('div', { class: 'muted' }, 'Izoh: ', asl(s.izoh)) : null,
    s.javob ? h('div', { class: 'muted' }, manbaNom(s) + ': ', asl(s.javob)) : null,
    qoldiq ? h('div', { class: 'muted', style: 'font-size:13px' }, qoldiq) : null,
    s.holatKim && !OCHIQ.has(s.holat) ? h('div', { class: 'muted', style: 'font-size:13px' }, 'Belgiladi: ', asl(s.holatKim), ' · ', kun(s.holatVaqt)) : null,
    bilanTugma ? tugmalar(ctx, chiz, s) : null);
}

// Tayyorlash ro'yxati (beruvchi: tayyorlanmaganlar, so'ragan filial bo'yicha) — nusxa olib qog'ozga/chatga.
function yigishMatni(list) {
  const g = new Map();
  list.forEach((s) => { const k = s.filial + ' (' + manbaNom(s) + '\'dan)'; if (!g.has(k)) g.set(k, []); g.get(k).push(s); });
  return [...g.entries()].map(([f, l]) => f + ':\n' + l.map((s, i) => (i + 1) + '. ' + s.nom + ' — ' + s.soni + ' ' + s.birlik + (s.izoh ? ' (' + s.izoh + ')' : '')).join('\n')).join('\n\n');
}
// Men tayyorlashim kerak bo'lganlar: beruvchi va o'zim so'ramagan. Ikki joyda ishlaydigan xodim (masalan 1-Filial + Osnovnoy tungi)
// hamkasbi so'raganini tayyorlaydi, o'zi so'raganini — yo'q (server menSoradim; eski server — filial bo'yicha, audit 07.11 kech).
const ozimSoradim = (ctx, s) => (typeof s.menSoradim === 'boolean' ? s.menSoradim : meniki().has(s.f));
const tayyorlash = (ctx, l) => l.filter((s) => s.holat === 'yangi' && berishmi(ctx, s) && (direktormi(ctx) || !ozimSoradim(ctx, s)));
const menSoragan = (ctx, l) => {
  if (direktormi(ctx)) return [];
  const ty = new Set(tayyorlash(ctx, l).map((s) => s.id));
  return l.filter((s) => meniki().has(s.f) && !ty.has(s.id));
};

// Karta va oyna sarlavhasi: kim ekaniga qarab.
function nomi(ctx) {
  if (direktormi(ctx)) return '📦 Filiallararo dori so\'rovlari';
  // osn — Osnovnoy xodimi; filialXodimi — Osnovnoy'dan boshqa filial uchun ham so'raydi (ikki joyda ishlaydigan xodim).
  const osn = !!(S.j && S.j.osn), filialXodimi = sorashFiliallar().some((f) => f.nom !== (S.j && S.j.asosiy));
  if (osn && filialXodimi) return '📦 Dori so\'rovlari';
  return osn ? '📦 Filiallardan dori olish' : '📦 Osnovnoy\'dan dori olish';
}

// So'rash oynasi: kim uchun (bir nechta bo'lsa), kimdan (Osnovnoy — filiallardan tanlaydi), dori nomi (Oson takliflari — tanlangan
// filialdagi qoldig'i bilan), miqdor, izoh. Yuborilgach forma tozalanadi — keyingi dorini darhol yozish mumkin.
export function sorashOyna(ctx, chiz) {
  const fl = sorashFiliallar();
  if (!fl.length) { ctx.toast('So\'rash uchun filial yo\'q', 'xato'); return; }
  sheet('📦 Dori so\'rash', (box, close) => {
    const f = { filial: fl.length === 1 ? fl[0].id : (fl.find((z) => ctx.x && z.id === ctx.x.filialId) || {}).id || '', manba: '', birlik: 'quti' };
    const manbalar = () => { const z = fl.find((x) => x.id === f.filial); return z && Array.isArray(z.manbalar) ? z.manbalar : null; };
    const yuborilgan = h('div', { class: 'list' });
    const manbaJoy = h('div', { style: 'display:flex;flex-direction:column;gap:6px' });
    const manbaChiz = () => {
      const ml = manbalar();
      if (ml && !ml.some((m) => m.id === f.manba)) f.manba = ml.length === 1 ? ml[0].id : '';
      manbaJoy.replaceChildren();
      if (ml && ml.length > 1) manbaJoy.append(h('span', { class: 'muted' }, 'Qaysi filialdan so\'raysiz'), pills(ml.map((m) => [m.id, m.nom]), f.manba, (v) => { f.manba = v; qidir(); }, 'Kimdan'));
      else if (ml && ml.length === 1) manbaJoy.append(h('div', { class: 'muted' }, 'Kimdan: ', h('b', {}, ml[0].nom)));
    };
    if (fl.length > 1) {
      box.append(h('span', { class: 'muted' }, 'Kim uchun'), pills(fl.map((z) => [z.id, z.nom]), f.filial, (v) => { f.filial = v; manbaChiz(); qidir(); }, 'Filial'));
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
        const mId = f.manba || ((ctx.S && ctx.S.filiallar) || []).find((z) => z.asosiy)?.id;
        const mNom = ((manbalar() || []).find((m) => m.id === mId) || {}).nom || (S.j && S.j.asosiy) || 'Osnovnoy';
        r.slice(0, 6).forEach((d) => {
          const fs = Array.isArray(d.filiallar) ? d.filiallar : [];
          const bor = fs.filter((z) => z.f === mId).reduce((a, z) => a + (Number(z.soni) || 0), 0);
          taklif.append(h('button', { type: 'button', class: 'item', style: 'text-align:left;width:100%', onclick: () => {
            nom.qiymat(d.nom); taklif.textContent = ''; qidN++; son.i.focus();
          } }, h('b', { 'data-asl': '' }, d.nom),
          h('div', { class: 'muted', style: 'font-size:13px' }, f.manba || manbalar()?.length === 1 || !manbalar()
            ? (bor > 0 ? mNom + '\'da bor' : mNom + '\'da yo\'q (Oson bo\'yicha)') : 'Avval «Kimdan»ni tanlang', d.ishlab ? [' · ', asl(d.ishlab)] : null)));
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
      if (fl.length > 1 && !f.filial) { ctx.toast('Kim uchun — filialni tanlang', 'xato'); return; }
      const ml = manbalar();
      if (ml && ml.length > 1 && !f.manba) { ctx.toast('Qaysi filialdan so\'rashni tanlang', 'xato'); return; }
      if (nm.length < 2) { nom.xato('Dori nomini yozing'); nom.i.focus(); return; }
      if (!/^\d{1,4}$/.test(v) || Number(v) < 1) { son.xato('1 dan 9999 gacha butun son'); son.i.focus(); return; }
      yubor.disabled = true;
      try {
        const r = await ctx.amalFon('doriSorovYoz', f.filial || null, nm, Number(v), f.birlik, iz.i.value.trim() || null, f.manba || null);
        if (r) {
          const kimdan = r.manba || (S.j && S.j.asosiy) || 'Osnovnoy';
          yuborilgan.prepend(h('div', { class: 'item' }, '✓ ', asl(r.nom), ' — ' + r.soni + ' ' + r.birlik + ' · ' + kimdan + '\'dan so\'raldi'));
          nom.qiymat(''); son.qiymat('1'); iz.qiymat(''); taklif.textContent = '';
          ctx.toast('So\'raldi ✓ — ' + kimdan + 'ga xabar ketdi');
          yukla(ctx, chiz, true);
          nom.i.focus();
        }
      } finally { yubor.disabled = false; }
    } }, 'So\'rash');
    manbaChiz();
    box.append(manbaJoy, nom.el, taklif, son.el, birlik, iz.el, yubor,
      h('div', { class: 'muted', style: 'font-size:13px' }, 'Bir nechta dori bo\'lsa — birin-ketin yozing, har biri alohida so\'rov bo\'ladi.'),
      yuborilgan, h('button', { type: 'button', class: 's', onclick: async () => {
        // Yozilgan, lekin yuborilmagan dori bo'lsa — so'raladi (jim yo'qolmasin).
        if (nom.i.value.trim() && !(await tasdiqlash('«' + nom.i.value.trim() + '» hali so\'ralmadi. Oyna yopilsinmi?'))) return;
        close();
      } }, 'Yopish'));
  });
}

// Ro'yxat oynasi: ochiqlari (tugmalar bilan), filial bo'yicha tanlov, tayyorlash ro'yxati, yopilganlar (3 kun).
export function sorovOyna(ctx, chiz) {
  sheet(nomi(ctx), (box) => {
    const ich = h('div', {});
    box.append(ich);
    const ciz = () => {
      ich.textContent = '';
      const all = royxat();
      const fl = [...new Set(all.flatMap((s) => [s.filial, manbaNom(s)]))];
      if (S.filtr && !fl.includes(S.filtr)) S.filtr = '';
      const list = S.filtr ? all.filter((s) => s.filial === S.filtr || manbaNom(s) === S.filtr) : all;
      const ochiq = list.filter((s) => OCHIQ.has(s.holat)), yopiq = list.filter((s) => !OCHIQ.has(s.holat));
      const ty = tayyorlash(ctx, ochiq);
      ich.append(h('div', { class: 'muted' }, 'Sizdan so\'ralgan dorini tayyorlab «Tayyorladim» ni bosing (berilgan miqdor bilan) — so\'ragan filialga xabar boradi, '
        + 'bo\'lmasa — «Yo\'q». Siz so\'ragan dori tayyor bo\'lsa xabar keladi, olib ketgach — «Olib ketdik». Dorini Oson\'da ko\'chirishni unutmang.'));
      if (S.xato) ich.append(h('div', { class: 'msg warn', role: 'status' }, 'Yangilanmadi: ' + S.xato));
      if (sorashFiliallar().length) ich.append(h('button', { type: 'button', class: 'p', style: 'margin-top:10px', onclick: () => sorashOyna(ctx, chiz) }, '+ Dori so\'rash'));
      if (fl.length > 2) ich.append(h('div', { style: 'margin-top:10px' }, pills([['', 'Hammasi'], ...fl.map((f) => [f, f])], S.filtr, (v) => { S.filtr = v; ciz(); }, 'Filial')));
      const l = h('div', { class: 'card list', style: 'margin-top:10px' });
      if (!ochiq.length) l.append(h('div', { class: 'muted' }, 'Hozir ochiq so\'rov yo\'q.'));
      ochiq.forEach((s) => l.append(qator(ctx, chiz, s, true)));
      ich.append(l);
      if (ty.length) ich.append(h('button', { type: 'button', class: 's', onclick: () => nusxaOl(yigishMatni(ty), ctx.toast) }, 'Tayyorlash ro\'yxatini nusxalash'));
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
  const k = h('section', { class: 'card list sorov-karta', 'data-sorov-karta': '' }, kartaSarlavha((S.j ? nomi(ctx) : '📦 Dori so\'rovlari') + (ochiq.length ? ' (' + ochiq.length + ')' : '')));
  if (!S.j) {
    k.append(h('div', { class: 'muted' }, S.xato ? 'Ro\'yxat olinmadi: ' + S.xato : 'Yuklanmoqda…'));
    return k;
  }
  const fl = sorashFiliallar();
  const ty = tayyorlash(ctx, ochiq), meni = menSoragan(ctx, ochiq);
  const myTayyor = meni.filter((s) => s.holat === 'tayyor'), myYangi = meni.filter((s) => s.holat === 'yangi');
  if (myTayyor.length) k.append(h('div', { class: 'msg ok' }, '✓ ' + myTayyor.length + ' ta dori tayyor — '
    + [...new Set(myTayyor.map(manbaNom))].join(', ') + '\'dan olib keting.'));
  if (ty.length) {
    const fs = new Map();
    ty.forEach((s) => fs.set(s.filial, (fs.get(s.filial) || 0) + 1));
    k.append(h('div', { class: 'msg warn' }, 'Tayyorlash kerak: ' + ty.length + ' ta dori — ' + [...fs.entries()].map(([f, n]) => f + ' ' + n + ' ta').join(', ')));
  }
  if (myYangi.length) k.append(h('div', { class: 'muted' }, myYangi.length + ' ta dori so\'ralgan — tayyorlashini kuting.'));
  if (!myTayyor.length && !ty.length && !myYangi.length) {
    const kimdan = [...new Set(fl.flatMap((f) => (Array.isArray(f.manbalar) ? f.manbalar.map((m) => m.nom) : [(S.j && S.j.asosiy) || 'Osnovnoy'])))];
    k.append(h('div', { class: 'muted' }, ochiq.length ? 'Hammasi tayyorlangan — olib ketilishini kuting.'
      : kimdan.length ? 'Tugagan yoki kam qolgan dorini ' + kimdan.join(', ') + '\'dan so\'rang: nomi va miqdori.' : 'Hozir so\'rov yo\'q.'));
  }
  [...ty, ...myTayyor, ...myYangi].slice(0, 3).forEach((s) => k.append(qator(ctx, chiz, s, false)));
  const row = h('div', { class: 'row' });
  const sor = fl.length > 0 && !o.direktor;
  if (sor) row.append(h('button', { type: 'button', class: 'p', onclick: () => sorashOyna(ctx, chiz) }, '+ Dori so\'rash'));
  row.append(h('button', { type: 'button', class: sor ? 's' : 'p', onclick: () => sorovOyna(ctx, chiz) },
    ochiq.length ? 'Hammasi (' + ochiq.length + ')' : 'Ro\'yxat'));
  k.append(row);
  return k;
}
