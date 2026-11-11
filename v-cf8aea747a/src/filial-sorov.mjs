// Filiallararo dori so'rovlari (07.11; 20261107280000_filial_sorov, 20261107300000_filial_sorov2).
//   «Osnovnoy'dan dori olish» — filial xodimi (1-Filial, 4-filial) Osnovnoy'dan so'raydi (foydalanuvchi: "xodim asosiy ekranida,
//   Osnovnoy xodimlariga va direktorga ko'rinsin"). 07.11 kech: «Filiallardan dori olish» — Osnovnoy ham istalgan filialdan so'raydi
//   ("filiallar Osnovnoy'dan dori so'ragani kabi"). Har so'rovda: f — kim uchun (so'ragan filial), m — kimdan (manba).
//   Manba filial xodimi / direktor: «Tayyorladim» (qancha berildi) yoki «Yo'q»; so'ragan filial: «Olib ketdik», «Bekor» (tasdiq bilan).
//   Faqat serverda (dori_sorov_royxat — OQISH, yoz/holat — YENGIL). Bosh sahifa ochiq turganda har daqiqada yangilanadi.
//   07.11 kech (20261107310000_sorov_boglash): har filial o'zi uchun istalgan boshqa filialdan; so'rash oynasida har filialdagi qoldiq;
//   Ko'chirish takliflari, Oson qoldig'i (dori oynasi) va «Qaysi filialda bor?» qidiruvidan bir bosishda so'rov (sorashOch);
//   direktorga keldi-ketdi va «Oson'da ko'chirildi» (harakatOyna); Bosh sahifada karta ajralib turadi.
import { h, input, kartaSarlavha, nusxaOl, pills, sheet, tasdiqlash, vaqt, sana, faolmi, faolQaytganda } from './ui.mjs';
import { oldinMatn, osonEskimi, osonVaqtEl, qoldiqMatn, yanaRoyxat } from './oson-qoldiq.mjs';
import { qidiruvKalit } from './kalit.mjs';

const YANGILASH = 60000;
const OCHIQ = new Set(['yangi', 'tayyor']);
const ROYXAT_KOR = 50;   // audit 10.11 kech: oynada ochiq va yopilganlar — 50 tadan
const SS = () => ({ j: null, imzo: '', vaqt: 0, yuklanmoqda: null, xato: null, band: '', taymer: 0, oyna: null, filtr: '', ochiqN: 0, yopiqN: 0, yopiqOchiq: false });
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
      // Birinchi yuklanish xato bo'lsa ham karta qayta chiziladi («Yuklanmoqda…»da qolib ketmasin; audit 07.11 kech).
      if ((ozgardi === true || (ozgardi === 'xato' && !S.j && !S.xatoChizildi)) && chiz) { if (ozgardi === 'xato') S.xatoChizildi = true; chiz(); }
      if (ozgardi && S.oyna) S.oyna();
    });
  return S.yuklanmoqda;
}

let kuzatOxirgi = null;   // audit 11.11: jimlikdan qaytganda — darhol yangilash
faolQaytganda(() => { if (kuzatOxirgi && !document.hidden && document.querySelector('[data-sorov-karta]')) yukla(kuzatOxirgi[0], kuzatOxirgi[1], true); });
function kuzat(ctx, chiz) {
  kuzatOxirgi = [ctx, chiz];
  if (S.taymer || typeof setTimeout !== 'function') return;
  S.taymer = setTimeout(() => {
    S.taymer = 0;
    if (typeof document === 'undefined' || !document.querySelector('[data-sorov-karta]')) return;
    if (!document.hidden && faolmi()) yukla(ctx, chiz, true);   // audit 10.11: jim telefon so'rov yubormaydi
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
  // Audit 10.11 kech: qoldiq Oson'dan — server ro'yxat vaqtini ('osonVaqt') bersa va u 45 daqiqadan eski bo'lsa, shu yerda aytiladi.
  const ov = S.j && S.j.osonVaqt;
  const qoldiq = [ber != null ? manbaNom(s) + '\'da: ' + ber : null, s.ozi != null ? s.filial + 'da: ' + s.ozi : null].filter(Boolean).join(' · ')
    + ((ber != null || s.ozi != null) && ov !== undefined && osonEskimi(ov) ? ' · ⚠ Oson ' + (ov ? oldinMatn(Date.now() - ov) + ' oldingi' : 'ma\'lumoti yo\'q') : '');
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

// Karta va oyna sarlavhasi. 07.11 kech: har filial o'zi uchun istalgan boshqa filialdan so'raydi — xodimda nom bir xil.
function nomi() {
  return '📦 Filiallararo dori so\'rovlari';
}

// So'rash oynasi: kim uchun (faqat o'z filiali; bir nechta bo'lsa tanlanadi), kimdan (boshqa filiallar — har birida shu dorining
// qoldig'i bilan; eng ko'p qolgani o'zi tanlanadi), dori nomi (Oson takliflari), miqdor, izoh. pre — boshqa bo'limdan ochilganda
// oldindan to'ldiriladi: { nom, filial, manba, soni, izoh, qoldiq: [{ f, soni, dona }] }. Yuborilgach forma tozalanadi.
export function sorashOyna(ctx, chiz, pre = {}) {
  const fl = sorashFiliallar();
  if (!fl.length) { ctx.toast('So\'rash uchun filial yo\'q', 'xato'); return; }
  sheet('📦 Dori so\'rash', (box, close) => {
    const birinchi = (pre.filial && fl.find((z) => z.id === pre.filial)) || (fl.length === 1 ? fl[0] : fl.find((z) => ctx.x && z.id === ctx.x.filialId));
    // vaqt — qoldiqlar qaysi Oson ro'yxatidan (audit 10.11 kech: eski bo'lsa ogohlantirish).
    const f = { filial: birinchi ? birinchi.id : '', manba: '', birlik: 'quti', qoldiq: new Map(), qolda: false, vaqt: pre.vaqt };
    const qoldiqQoy = (arr) => {
      f.qoldiq = new Map();
      (Array.isArray(arr) ? arr : []).forEach((z) => { if (!z || !z.f) return; const e = f.qoldiq.get(z.f) || { soni: 0, dona: z.dona }; e.soni += Number(z.soni) || 0; f.qoldiq.set(z.f, e); });
    };
    qoldiqQoy(pre.qoldiq);
    const manbalar = () => { const z = fl.find((x) => x.id === f.filial); return z && Array.isArray(z.manbalar) ? z.manbalar : null; };
    const qMatn = (id) => { const e = f.qoldiq.get(id); return !e ? '' : e.soni > 0 ? qoldiqMatn(e.soni, e.dona) : 'yo\'q'; };
    // Kimdan: foydalanuvchi o'zi tanlamagan bo'lsa — qoldig'i eng ko'p filial (Oson bo'yicha), bitta bo'lsa — o'sha.
    const ozi = () => {
      const ml = manbalar();
      if (!ml) return;
      if (pre.manba && ml.some((m) => m.id === pre.manba) && !f.qolda && !f.manba) { f.manba = pre.manba; f.qolda = true; return; }   // boshqa bo'limdan tanlangan — o'zgarmaydi
      if (f.manba && ml.some((m) => m.id === f.manba) && f.qolda) return;
      if (ml.length === 1) { f.manba = ml[0].id; return; }
      const eng = ml.map((m) => [m.id, (f.qoldiq.get(m.id) || {}).soni || 0]).sort((a, b) => b[1] - a[1])[0];
      if (!f.qolda) f.manba = eng && eng[1] > 0 ? eng[0] : (ml.some((m) => m.id === f.manba) ? f.manba : '');
    };
    const yuborilgan = h('div', { class: 'list' });
    const manbaJoy = h('div', { style: 'display:flex;flex-direction:column;gap:6px' });
    const manbaChiz = () => {
      ozi();
      const ml = manbalar();
      manbaJoy.replaceChildren();
      if (ml && ml.length > 1) {
        manbaJoy.append(h('span', { class: 'muted' }, 'Qaysi filialdan so\'raysiz' + (f.qoldiq.size ? ' (Oson qoldig\'i)' : '')),
          pills(ml.map((m) => [m.id, m.nom + (qMatn(m.id) ? ' · ' + qMatn(m.id) : '')]), f.manba, (v) => { f.manba = v; f.qolda = true; qidir(); }, 'Kimdan'));
      } else if (ml && ml.length === 1) manbaJoy.append(h('div', { class: 'muted' }, 'Kimdan: ', h('b', {}, ml[0].nom), qMatn(ml[0].id) ? ' · ' + qMatn(ml[0].id) : ''));
      if (f.qoldiq.size && f.vaqt !== undefined) { const ve = osonVaqtEl(f.vaqt, { faqatEski: true, izoh: 'qoldiq eski bo\'lishi mumkin' }); if (ve) manbaJoy.append(ve); }
    };
    if (fl.length > 1) {
      box.append(h('span', { class: 'muted' }, 'Kim uchun'), pills(fl.map((z) => [z.id, z.nom]), f.filial, (v) => { f.filial = v; f.qolda = false; manbaChiz(); qidir(); }, 'Filial'));
    }
    const nom = input('Dori nomi', { inputmode: 'text', placeholder: 'Masalan: Анальгин', autocomplete: 'off' });
    if (pre.nom) nom.qiymat(String(pre.nom));
    const taklif = h('div', { class: 'list sorov-taklif' });
    // Audit 10.11 kech: qidiruv holati ko'rinadi (avval xato jim yutilardi, «Qidirilmoqda…» yo'q edi).
    const qHolat = h('div', { class: 'muted sorov-qholat', role: 'status', 'aria-live': 'polite' });
    let qidT = 0, qidN = 0;
    const qidir = () => {
      clearTimeout(qidT);
      const soz = nom.i.value.trim();
      if (soz.length < 2) { taklif.textContent = ''; qHolat.textContent = ''; qidN++; return; }
      qHolat.textContent = 'Qidirilmoqda…';
      qidT = setTimeout(async () => {
        const n = ++qidN;
        let r;
        try { r = await ctx.oqi('osonQidir', soz); } catch (e) {
          if (n !== qidN) return;
          qHolat.textContent = '';
          taklif.textContent = '';
          taklif.append(h('div', { class: 'msg warn' }, 'Qidirib bo\'lmadi' + (e && e.message ? ': ' + e.message : '') + '. Nomini o\'zingiz yozib so\'rashingiz ham mumkin.'),
            h('button', { type: 'button', class: 's', onclick: qidir }, 'Qayta urinish'));
          return;
        }
        if (n !== qidN) return;
        if (!Array.isArray(r)) r = [];
        qHolat.textContent = r.length ? '' : 'Oson qoldig\'ida topilmadi — nomini to\'liq yozib so\'rang';
        taklif.textContent = '';
        r.slice(0, 6).forEach((d) => {
          const fs = Array.isArray(d.filiallar) ? d.filiallar : [];
          const ml = manbalar() || [];
          // Har «kimdan» filialidagi qoldiq — qisqa («4-filial 12 quti · 1-Filial yo'q»).
          const qisq = ml.map((m) => { const s = fs.filter((z) => z.f === m.id).reduce((a, z) => a + (Number(z.soni) || 0), 0);
            const dn = (fs.find((z) => z.f === m.id) || {}).dona; return m.nom + ' ' + (s > 0 ? qoldiqMatn(s, dn) : 'yo\'q'); }).join(' · ');
          taklif.append(h('button', { type: 'button', class: 'item', style: 'text-align:left;width:100%', onclick: () => {
            nom.qiymat(d.nom); taklif.textContent = ''; qHolat.textContent = ''; qidN++;
            f.vaqt = d.vaqt;
            qoldiqQoy(fs); manbaChiz();
            son.i.focus();
          } }, h('b', { 'data-asl': '' }, d.nom),
          h('div', { class: 'muted', style: 'font-size:13px' }, qisq || 'Oson qoldig\'i yo\'q', d.ishlab ? [' · ', asl(d.ishlab)] : null)));
        });
      }, 350);
    };
    // Yangi nom yozilsa — oldingi dorining qoldig'i va o'zi tanlangan «kimdan» o'chadi (audit 07.11 kech).
    nom.i.addEventListener('input', () => {
      f.qoldiq = new Map(); f.vaqt = undefined;
      if (!f.qolda) f.manba = '';
      manbaChiz();
      qidir();
    });
    const son = input('Miqdori', { inputmode: 'numeric', value: String(pre.soni && pre.soni >= 1 ? Math.min(9999, Math.round(pre.soni)) : 1), pul: false });
    const birlik = pills([['quti', 'Quti'], ['dona', 'Dona']], f.birlik, (v) => { f.birlik = v; }, 'Birlik');
    const iz = input('Izoh (ixtiyoriy)', { inputmode: 'text', placeholder: 'Masalan: mijoz kutyapti' });
    if (pre.izoh) iz.qiymat(String(pre.izoh));
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
          f.qoldiq = new Map(); f.qolda = false; f.vaqt = undefined; pre = {}; qHolat.textContent = ''; manbaChiz();
          ctx.toast('So\'raldi ✓ — ' + kimdan + 'ga xabar ketdi');
          yukla(ctx, chiz, true);
          nom.i.focus();
        }
      } finally { yubor.disabled = false; }
    } }, 'So\'rash');
    manbaChiz();
    box.append(manbaJoy, nom.el, qHolat, taklif, son.el, birlik, iz.el, yubor,
      h('div', { class: 'muted', style: 'font-size:13px' }, 'Bir nechta dori bo\'lsa — birin-ketin yozing, har biri alohida so\'rov bo\'ladi.'),
      yuborilgan, h('button', { type: 'button', class: 's', onclick: async () => {
        // Yozilgan, lekin yuborilmagan dori bo'lsa — so'raladi (jim yo'qolmasin).
        if (nom.i.value.trim() && !(await tasdiqlash('«' + nom.i.value.trim() + '» hali so\'ralmadi. Oyna yopilsinmi?'))) return;
        close();
      } }, 'Yopish'));
  });
}

// Boshqa bo'limlardan (Ko'chirish, Oson qoldig'i, «Qaysi filialda bor?»): ro'yxat hali olinmagan bo'lsa — avval olinadi.
let ochilmoqda = false;
export async function sorashOch(ctx, pre = {}, chiz = () => {}) {
  if (ochilmoqda) return;   // ikki marta bosilsa — ikkita oyna ochilmasin
  ochilmoqda = true;
  try {
    if (!S.j) { ctx.toast('Ochilmoqda…'); await yukla(ctx, chiz, true); }
    if (!S.j) { ctx.toast(S.xato || 'So\'rovlar ro\'yxati olinmadi', 'xato'); return; }
    sorashOyna(ctx, chiz, pre);
  } finally { ochilmoqda = false; }
}
export const sorovYukla = (ctx, chiz, majbur = false) => yukla(ctx, chiz, majbur);
export const sorovYuklanganmi = () => !!S.j;
// Bu filial shu foydalanuvchinikimi (so'rash tugmalari faqat o'z filiali uchun): direktor — hammasi.
export function ozFilialmi(ctx, f) {
  if (direktormi(ctx)) return true;
  if (S.j && Array.isArray(S.j.meniki)) return S.j.meniki.includes(f);
  return !!ctx.x && (ctx.x.filialId === f || ctx.x.qoshimchaFilial === f);
}
// Ko'chirish taklifi uchun: shu yo'nalishda (kim uchun f, kimdan m) shu nomli so'rov bormi — ochig'i birinchi.
// Server takrorni talaffuz kaliti bilan tekshiradi (dori_sorovlar.kalit) — bu yerda ham shunday (kirill/lotin, katta-kichik harf).
// Audit 10.11 kech (qotish): Ko'chirish va Aqlli buyurtma har taklifga 2 marta chaqiradi — avval har safar 1 000+ so'rov filtrlanib,
// har qatorga talaffuz kaliti hisoblanardi. Endi ro'yxat almashganda bir marta Map (kim uchun | kimdan | kalit) quriladi — O(1).
const KALIT = new Map();
const kalitOl = (nom) => {
  let k = KALIT.get(nom);
  if (k === undefined) { if (KALIT.size > 20000) KALIT.clear(); k = qidiruvKalit(nom); KALIT.set(nom, k); }
  return k;
};
const IX = { j: undefined, m: new Map() };
function sorovIndeks() {
  if (IX.j === S.j) return IX.m;
  const m = new Map();
  for (const s of royxat()) {
    const k = s.f + '|' + (s.m || '') + '|' + kalitOl(s.nom);
    const l = m.get(k);
    if (l) l.push(s); else m.set(k, [s]);
  }
  IX.j = S.j; IX.m = m;
  return m;
}
export function sorovHolati(nom, f, m) {
  const l = sorovIndeks().get(f + '|' + (m || '') + '|' + kalitOl(nom));
  return l ? (l.find((s) => OCHIQ.has(s.holat)) || l[0]) : null;
}

// Direktor: keldi-ketdi — olib ketilgan dorilar yo'nalish bo'yicha («1-Filial → Osnovnoy»), Oson'da ko'chirilmaganlari tepada;
// har qatorda «Ko'chirildi ✓» (bosilsa — belgilanadi / olib tashlanadi), yo'nalishga «Hammasi ko'chirildi» va nusxa (Oson uchun).
const HR = { kun: 7, j: null, xato: null, n: 0 };
export function harakatOyna(ctx, chizTash = () => {}) {
  sheet('🔁 Filiallararo keldi-ketdi', (box) => {
    const ich = h('div', { style: 'display:flex;flex-direction:column;gap:10px' });
    box.append(ich);
    let tirik = true, band = false;   // band — shu oynaniki (yopib qayta ochilsa — yangi oyna bloklanmaydi)
    // Davr tez almashtirilsa — faqat oxirgi so'rov javobi chiziladi (audit 07.11 kech).
    const ol = async () => {
      const n = ++HR.n, kun = HR.kun;
      HR.xato = null;
      let j = null, xato = null;
      try { j = await ctx.oqi('doriHarakat', kun); } catch (e) { xato = (e && e.message) || 'Olinmadi'; }
      if (n !== HR.n) return;
      HR.j = j; HR.xato = xato;
      if (tirik) ciz();
    };
    const belgila = async (idlar, belgi, matn) => {
      if (band) return;
      if (matn && !(await tasdiqlash(matn))) return;
      band = true; ciz();
      try {
        // Server bir so'rovda 300 tagacha oladi — 250 talik bo'laklar (ko'p yig'ilib qolgan yo'nalish ham bir bosishda).
        let n = 0, ok = true;
        for (let i = 0; i < idlar.length; i += 250) {
          const r = await ctx.amalFon('doriSorovOson', idlar.slice(i, i + 250), belgi);
          if (r == null) { ok = false; break; }
          n += Number(r) || 0;
        }
        if (ok || n) ctx.toast(n > 0 ? (belgi ? 'Oson\'da ko\'chirildi ✓' + (idlar.length > 1 ? ' — ' + n + ' ta' : '') : 'Belgi olib tashlandi')
          : 'Allaqachon belgilangan — boshqa telefonda bosilgan bo\'lishi mumkin');
      } finally { band = false; await ol(); yukla(ctx, chizTash, true); }
    };
    const ciz = () => {
      ich.textContent = '';
      ich.append(h('div', { class: 'muted' }, 'Olib ketilgan dorilar — qaysi filialdan qaysi filialga. Oson Apteka\'da ham shu filialdan shu filialga '
        + 'ko\'chiring, keyin «Oson\'da ko\'chirdim ✓» ni bosing. Ko\'chirilmaganlari doim tepada turadi.'),
        pills([[7, '7 kun'], [30, '30 kun'], [90, '90 kun']], HR.kun, (v) => { HR.kun = v; HR.j = null; ciz(); ol(); }, 'Davr'));
      if (HR.xato) { ich.append(h('div', { class: 'msg warn' }, 'Olinmadi: ' + HR.xato), h('button', { type: 'button', class: 's', onclick: ol }, 'Qayta urinish')); return; }
      if (!HR.j) { ich.append(h('div', { class: 'muted', role: 'status' }, 'Yuklanmoqda…')); return; }
      const q = Array.isArray(HR.j.qatorlar) ? HR.j.qatorlar : [];
      const kut = q.filter((s) => !s.oson);
      ich.append(h('div', { class: kut.length ? 'msg warn' : 'msg ok' }, kut.length ? 'Oson\'da ko\'chirish kerak: ' + kut.length + ' ta dori' : '✓ Hammasi Oson\'da ko\'chirilgan'));
      if (!q.length) { ich.append(h('div', { class: 'muted' }, 'Bu davrda olib ketilgan dori yo\'q.')); return; }
      const g = new Map();
      q.forEach((s) => { const k = s.manba + ' → ' + s.filial; if (!g.has(k)) g.set(k, []); g.get(k).push(s); });
      for (const [yon, l] of [...g.entries()].sort((a, b) => b[1].filter((s) => !s.oson).length - a[1].filter((s) => !s.oson).length)) {
        const kl = l.filter((s) => !s.oson);
        const k = h('section', { class: 'card list' }, h('div', { class: 'line', style: 'border:0;padding:0' }, h('b', {}, yon),
          h('span', { class: kl.length ? 'pul-kerak' : 'muted' }, kl.length ? kl.length + ' ta ko\'chirilmagan' : '✓')));
        l.forEach((s) => k.append(h('div', { class: 'item' },
          h('div', { class: 'line', style: 'border:0;padding:0' }, h('b', { 'data-asl': '' }, s.nom), h('b', { style: 'white-space:nowrap' }, s.soni + ' ' + s.birlik)),
          h('div', { class: 'muted', style: 'font-size:13px' }, 'Olib ketildi: ' + kun(s.vaqt), s.olib ? [' · ', asl(s.olib)] : null, s.kim ? [' · so\'ragan: ', asl(s.kim)] : null),
          h('div', { class: 'row' }, s.oson
            ? [h('span', { class: 'belgi ok' }, '✓ Oson\'da ko\'chirildi · ' + kun(s.oson), s.osonKim ? [' · ', asl(s.osonKim)] : null),
              h('button', { type: 'button', class: 'link', disabled: band ? '' : null,
                onclick: () => belgila([s.id], false, '«' + s.nom + '»: «Oson\'da ko\'chirildi» belgisi olib tashlansinmi?') }, 'Belgini olib tashlash')]
            : h('button', { type: 'button', class: 'p', disabled: band ? '' : null, onclick: () => belgila([s.id], true) }, 'Oson\'da ko\'chirdim ✓')))));
        if (kl.length) {
          const matn = yon + ' (Oson\'da ko\'chirish):\n' + kl.map((s, i) => (i + 1) + '. ' + s.nom + ' — ' + s.soni + ' ' + s.birlik).join('\n');
          k.append(h('div', { class: 'row' },
            h('button', { type: 'button', class: 's', onclick: () => nusxaOl(matn, ctx.toast) }, 'Nusxalash'),
            kl.length > 1 ? h('button', { type: 'button', class: 's', disabled: band ? '' : null,
              onclick: () => belgila(kl.map((s) => s.id), true, yon + ': ' + kl.length + ' ta dori Oson\'da ko\'chirildimi?') }, 'Hammasi ko\'chirildi') : null));
        }
        ich.append(k);
      }
    };
    ciz();
    ol();
    return () => { tirik = false; };
  }, { fokus: false });
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
      // Audit 10.11 kech (qotish): ochiqlari 50 tadan («Yana 50 ta» shu joyga qo'shadi); yopilganlar faqat ochilganda quriladi
      // (avval har daqiqalik yangilanishda 1 000+ qator to'liq chizilardi).
      const l = h('div', { class: 'card list', style: 'margin-top:10px' });
      if (!ochiq.length) l.append(h('div', { class: 'muted' }, 'Hozir ochiq so\'rov yo\'q.'));
      yanaRoyxat(l, ochiq, S.ochiqN || ROYXAT_KOR, (s) => qator(ctx, chiz, s, true), (n) => { S.ochiqN = n; }, { boshi: ROYXAT_KOR, yig: ciz });
      ich.append(l);
      if (ty.length) ich.append(h('button', { type: 'button', class: 's', onclick: () => nusxaOl(yigishMatni(ty), ctx.toast) }, 'Tayyorlash ro\'yxatini nusxalash'));
      if (yopiq.length) {
        const y = h('details', { class: 'ochil' }, h('summary', {}, 'Yopilganlar (3 kun) · ' + yopiq.length));
        const yl = h('div', { class: 'card list' });
        const quril = () => {
          if (yl.childNodes.length) return;
          yanaRoyxat(yl, yopiq, S.yopiqN || ROYXAT_KOR, (s) => qator(ctx, chiz, s, false), (n) => { S.yopiqN = n; }, { boshi: ROYXAT_KOR, yig: ciz });
        };
        const holat = () => { S.yopiqOchiq = y.open; if (y.open) quril(); };
        y.addEventListener('toggle', holat);
        y.querySelector('summary').addEventListener('click', () => setTimeout(holat, 0));
        if (S.yopiqOchiq) { y.open = true; quril(); }
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
  // 07.11 kech: direktorda ham doim ko'rinadi (so'rash, keldi-ketdi); faqat birinchi yuklanish paytida — yashirin.
  if (!S.j && !S.xato && o.direktor) return h('div', { 'data-sorov-karta': '', hidden: true });
  const k = h('section', { class: 'card list sorov-karta muhim', 'data-sorov-karta': '' }, kartaSarlavha((S.j ? nomi(ctx) : '📦 Dori so\'rovlari') + (ochiq.length ? ' (' + ochiq.length + ')' : '')));
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
      : direktormi(ctx) ? 'Hozir ochiq so\'rov yo\'q.'
        : kimdan.length ? 'Tugagan yoki kam qolgan dorini boshqa filialdan so\'rang (' + kimdan.join(', ') + '): nomi va miqdori.' : 'Hozir so\'rov yo\'q.'));
  }
  [...ty, ...myTayyor, ...myYangi].slice(0, 3).forEach((s) => k.append(qator(ctx, chiz, s, false)));
  // Direktor: olib ketilgan, Oson'da hali ko'chirilmagan dorilar — keldi-ketdi oynasiga.
  if (direktormi(ctx) && S.j.osonKut > 0) {
    k.append(h('button', { type: 'button', class: 'sorov-oson', onclick: () => harakatOyna(ctx, chiz) }, '🔁 Oson\'da ko\'chirish kerak: ' + S.j.osonKut + ' ta dori ›'));
  }
  const row = h('div', { class: 'row' });
  const sor = fl.length > 0;
  if (sor) row.append(h('button', { type: 'button', class: 'p', onclick: () => sorashOyna(ctx, chiz) }, '+ Dori so\'rash'));
  row.append(h('button', { type: 'button', class: sor ? 's' : 'p', onclick: () => sorovOyna(ctx, chiz) },
    ochiq.length ? 'Hammasi (' + ochiq.length + ')' : 'Ro\'yxat'));
  k.append(row);
  if (direktormi(ctx)) k.append(h('button', { type: 'button', class: 'link', style: 'align-self:flex-start', onclick: () => harakatOyna(ctx, chiz) }, '🔁 Keldi-ketdi — qaysi filialdan nima ketdi'));
  return k;
}
