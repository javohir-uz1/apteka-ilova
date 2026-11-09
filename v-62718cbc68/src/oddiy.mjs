// Oddiy rejim (direktor uchun, 26.10): bitta ekran, 4 ta katta tugma — Pul, Dorilar, Ta'minotchilar, Qarzlar.
// Yozuvlar katta, har sahifada bitta asosiy amal, pastki menyu yo'q. Xodimning qarzga ruxsat so'rovi bu rejimda yo'q
// (to'liq rejimda qoladi). Rejim har telefonda, har direktor uchun alohida eslab qolinadi.
// Bosh ekranda "Bugungi ishlar": pul va ta'minotchi yozuvi shu yerning o'zida bitta tugma bilan; dori va qarz — bo'limga havola.
// Ko'rinish (shu telefonda): kirill yozuvi (kirill.mjs — chizilgandan keyin almashtiriladi) va katta harf.
import * as H from './hisob.mjs';
import { UY_PULI } from './config.mjs';
import { yozuvKirillmi, yozuvQoy } from './kirill.mjs';
import { h, input, kunNomi, orqagaQoy, pills, sheet, tasdiqlash, xatoJoyla } from './ui.mjs';
import { davomatBugun, davomatView } from './davomat.mjs';

let sahifa = 'bosh';
// Tasdiqlash oynasi Telegram'niki (DOM emas) — kirill yozuvida matni tasdiqlash() o'zi o'tkazadi.
const tasdiq = tasdiqlash;

// ---- Rejim (shu telefonda, shu direktor uchun) ----
const KALIT = (id) => 'apteka-rejim:' + id;
export function oddiyRejimmi(id) {
  try { return localStorage.getItem(KALIT(id)) === 'oddiy'; } catch (e) { return false; }
}
export function rejimQoy(id, oddiy) {
  try { if (oddiy) localStorage.setItem(KALIT(id), 'oddiy'); else localStorage.removeItem(KALIT(id)); } catch (e) { /* yopiq xotira */ }
  sahifa = 'bosh';
}
// Ko'rinish: { katta } — shu telefonda (yozuv — kirill.mjs, hamma panel uchun bitta).
const SOZ = (id) => 'apteka-oddiy:' + id;
export function oddiySozlama(id) {
  try { return { kirill: false, katta: false, ...JSON.parse(localStorage.getItem(SOZ(id)) || '{}') }; } catch (e) { return { kirill: false, katta: false }; }
}
function sozlamaQoy(id, s) {
  try { localStorage.setItem(SOZ(id), JSON.stringify({ katta: !!s.katta })); } catch (e) { /* yopiq xotira */ }
}

// ---- Hisob (sof funksiya — test qilinadi) ----
// Bosh ekran uchun: har tugmaning raqamlari va "kutayotgan ishlar" soni.
export function oddiyXulosa(S, now = Date.now()) {
  const bugun = H.kunKey(now);
  const qabul = (S.smenalar || []).filter((z) => z.qabul && z.qabul.holat === 'kutilmoqda' && !z.bekor);
  const tasdiq = (S.smenalar || []).filter((z) => H.tasdiqKutadi(z) && !(z.qabul && z.qabul.holat === 'kutilmoqda'));
  const dorilar = H.defekturaGuruh(S.defektura || []).filter((d) => d.holat !== 'keldi');
  const yangiDori = dorilar.filter((d) => d.holat === 'yangi');
  const taminotchilar = (S.taminotchilar || []).map((t) => ({ t, qarz: H.bizBoyicha(t),
    kutadi: t.amallar.filter((a) => a.holat === 'ular' && !a.bekor), etiroz: H.taEtirozlar(t) }));
  const taQarz = taminotchilar.reduce((a, x) => a + Math.max(0, x.qarz), 0);
  const taKutadi = taminotchilar.reduce((a, x) => a + x.kutadi.length + x.etiroz.length, 0);
  const ochiq = (S.qarzlar || []).filter((q) => q.holat === 'ochiq' && H.qarzQoldiq(q) > 0);
  const otgan = ochiq.filter((q) => H.muddatiOtgan(q, now));
  return {
    savdo: H.kunSavdo(S.smenalar || [], bugun),
    seyf: H.qoldiq(S, 'kassa'),
    qabul, tasdiq, dorilar, yangiDori, taminotchilar, taQarz, taKutadi, ochiq, otgan,
    pulIshi: qabul.length + tasdiq.length,
    jamiIsh: qabul.length + tasdiq.length + yangiDori.length + taKutadi + otgan.length
  };
}

// ---- Ko'rinish ----
const IKON = {
  pul: 'M3 7h15a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V7zm0 0l2-3h11M16 13.5h.01',
  dorilar: 'M10.5 20.5l10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7zM8.5 8.5l7 7',
  tamin: 'M3 6h11v10H3zM14 9h4l3 3v4h-7M7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  qarz: 'M4 5h16v14H4zM4 9h16M8 15h4',
  // Davomat — kalendar va ✓ (audit 06.11: belgi yo'q edi — path d="undefined" konsolda xato berardi).
  davomat: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4M9 15l2 2 4-4',
  orqa: 'M15 5l-7 7 7 7'
};
function ikon(d, size = 28) {
  if (!d) d = 'M12 12h.01';   // noma'lum bo'lim — nuqta (xato emas)
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  for (const [k, v] of Object.entries({ viewBox: '0 0 24 24', width: size, height: size, fill: 'none', stroke: 'currentColor', 'stroke-width': '2.2',
    'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' })) s.setAttribute(k, String(v));
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('d', d);
  s.append(p);
  return s;
}
const raqam = (n) => String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

export function renderOddiy(root, ctx) {
  const { S, x } = ctx;
  const X = oddiyXulosa(S);
  const fil = (id) => (S.filiallar.find((f) => f.id === id) || {}).nom || id;
  const ism = (id) => (S.xodimlar.find((z) => z.id === id) || {}).ism || '?';
  const bor = (s) => { sahifa = s; ctx.rerender(true); };
  orqagaQoy(sahifa && sahifa !== 'bosh' ? () => bor('bosh') : null);   // audit 06.11: Telegram «orqaga» — bosh sahifaga
  const soz = oddiySozlama(x.id);
  const html = document.documentElement.classList;
  root.classList.add('oddiy');
  html.add('oddiy-rejim');   // oynalar va xabarlar ham katta (ular body'da)
  html.toggle('oddiy-katta', soz.katta);

  if (ctx.logout) root.append(h('div', { class: 'demo' }, 'Sinov rejimi · ', h('button', { class: 's', onclick: ctx.logout }, 'boshqa xodim')));
  const SARLAVHA = { pul: 'Pul', dorilar: 'Dorilar', tamin: 'Ta\'minotchilar', qarz: 'Qarzlar', davomat: 'Davomat' };
  if (sahifa !== 'bosh' && !SARLAVHA[sahifa]) sahifa = 'bosh';
  const m = h('main', { class: 'o-main' });
  if (sahifa === 'bosh') {
    root.append(h('header', { class: 'o-top' }, h('span', { class: 'o-kichik' }, (S.sozlama && S.sozlama.aptekaNomi) || 'Apteka'),
      h('h1', {}, 'Bugun, ' + kunNomi().split(', ')[1])));
  } else {
    root.append(h('header', { class: 'o-top' },
      h('button', { class: 'o-orqa', type: 'button', onclick: () => bor('bosh') }, ikon(IKON.orqa, 24), 'Orqaga'),
      h('h1', {}, SARLAVHA[sahifa])));
  }
  root.append(m);

  // ---------- Kartalar: "Bugungi ishlar" va bo'limlarda bir xil ----------
  const qabulKarta = (z) => {
    const top = z.qabul.summa;
    return h('section', { class: 'o-karta o-diqqat' }, h('h2', { class: 'o-sarlavha-ogoh' }, 'Pulni qabul qiling'),
      h('span', { class: 'o-izoh' }, fil(z.filialId) + ' · ' + ism(z.xodimId) + ' topshirdi'),
      h('span', { class: 'o-katta' }, H.som(top)),
      // Tasdiqlash so'raladi: karta qayta chizilganda tez ikkinchi bosish keyingi smenaning pulini qabul qilib yubormasin (audit 26.10).
      h('button', { type: 'button', class: 'p o-asosiy', onclick: () => tasdiq(ism(z.xodimId) + ' topshirgan ' + H.som(top) + ' seyfga qo\'shilsinmi?')
        .then((ha) => ha && ctx.amal('smenaQabul', z.id, 'kassa', String(top)).then((ok) => ok && ctx.toast(H.som(top) + ' seyfga qo\'shildi ✓'))) }, 'Qabul qildim — seyfga'),
      h('button', { type: 'button', class: 'o-ikkinchi', onclick: () => summaSheet(ctx, 'Qancha keldi? Sanab yozing', top,
        (j, v) => ctx.amalX(j, 'smenaQabul', z.id, 'kassa', v), (v) => H.som(H.pul(v)) + ' seyfga qo\'shildi ✓') }, 'Kam yoki ko\'p chiqdi — summani yozaman'));
  };
  const tasdiqKarta = (z) => {
    const jami = (z.naqd || 0) + (z.karta || 0);
    return h('section', { class: 'o-karta o-diqqat' }, h('h2', { class: 'o-sarlavha-ogoh' }, 'Savdoni tasdiqlang'),
      h('span', { class: 'o-izoh' }, fil(z.filialId) + ' · ' + ism(z.xodimId)),
      h('span', { class: 'o-katta' }, H.som(jami)),
      h('span', { class: 'o-izoh' }, 'Naqd ' + raqam(z.naqd) + ' · karta ' + raqam(z.karta)),
      h('button', { type: 'button', class: 'p o-asosiy', onclick: () => tasdiq(fil(z.filialId) + ' savdosi ' + H.som(jami) + ' — to\'g\'rimi?')
        .then((ha) => ha && ctx.amal('savdoTasdiq', z.id).then((ok) => ok && ctx.toast('Savdo tasdiqlandi ✓'))) }, 'To\'g\'ri — tasdiqlayman'));
  };
  const taKarta = (t, a) => h('section', { class: 'o-karta o-diqqat' },
    h('h2', { class: 'o-sarlavha-ogoh' }, h('span', { 'data-asl': '' }, t.nom), ' yozdi — tasdiqlang'),
    h('span', { class: 'o-izoh' }, (a.tur === 'xarid' ? 'Dori berdim: ' : 'To\'lov oldim: '), h('span', { 'data-asl': '' }, a.izoh || '')),
    h('span', { class: 'o-katta' }, H.som(a.summa)),
    // 04.11: dori ro'yxatini ko'rmasdan tasdiqlanmasin.
    a.qatorlar && a.qatorlar.length ? h('button', { type: 'button', class: 's', onclick: () => sheet(t.nom + ' — ' + a.qatorlar.length + ' xil dori', (box) => box.append(
      ...a.qatorlar.map((q, i) => h('div', { class: 'line' }, h('span', {}, (i + 1) + '. ', h('span', { 'data-asl': '' }, q.dori)),
        h('span', { style: 'white-space:nowrap' }, q.soni + ' × ' + H.som(q.narx) + ' = ' + H.som(q.summa)))),
      h('div', { class: 'line' }, h('b', {}, 'Jami'), h('b', {}, H.som(a.summa)))), { fokus: false }) }, a.qatorlar.length + ' xil dori — ko\'rish') : null,
    h('button', { type: 'button', class: 'p o-asosiy', onclick: () => tasdiq(t.nom + ': ' + H.som(a.summa) + ' — to\'g\'rimi?')
      .then((ha) => ha && ctx.amal('amalTasdiq', t.id, a.id).then((r) => r !== null && ctx.toast('Tasdiqlandi ✓'))) }, 'To\'g\'ri — tasdiqlayman'));
  // Ta'minotchi «Noto'g'ri» degan yozuv (04.11) — ko'rib chiqish to'liq rejimda (bekor qilib, to'g'risini yozish).
  const etirozKarta = (t, a) => h('section', { class: 'o-karta o-diqqat' },
    h('h2', { class: 'o-sarlavha-ogoh' }, h('span', { 'data-asl': '' }, t.nom), ' e\'tiroz bildirdi'),
    h('span', { class: 'o-izoh' }, (a.tur === 'xarid' ? 'Xarid ' : 'To\'lov ') + H.som(a.summa) + ': «', h('span', { 'data-asl': '' }, a.etiroz), '»'),
    h('span', { class: 'o-izoh' }, 'Xato bo\'lsa — to\'liq rejimda Ta\'minot bo\'limida yozuvni bekor qiling va to\'g\'risini yozing'));
  // Ro'yxati uzun ishlar (dori, qarz) — bo'limga olib boradigan bitta qator.
  const havola = (k, nom, izoh) => h('button', { type: 'button', class: 'o-karta o-element o-bosiladi o-diqqat', onclick: () => bor(k) },
    h('span', { class: 'o-ikon' }, ikon(IKON[k], 26)),
    h('span', { class: 'o-element-matn' }, h('b', { class: 'o-nom' }, nom), h('span', { class: 'o-izoh' }, izoh)),
    ikon('M9 5l7 7-7 7', 22));
  const qisqa = (r) => r.slice(0, 3).join(', ') + (r.length > 3 ? ' va yana ' + (r.length - 3) + ' ta' : '');

  // ---------- Bosh: savdo, bugungi ishlar, 4 tugma ----------
  if (sahifa === 'bosh') {
    m.append(h('section', { class: 'o-karta' }, h('span', { class: 'o-izoh' }, 'Bugungi savdo'),
      h('span', { class: 'o-katta' }, H.som(X.savdo.jami)), h('span', { class: 'o-izoh' }, S.filiallar.length + ' filial birga'),
      ctx.savdoKirit ? h('button', { type: 'button', class: 'p o-asosiy', onclick: () => ctx.savdoKirit() }, '+ Savdo kiritish') : null));
    // 29.10: xodimlar smena ochmaydi — davomatni va kechagi savdoni direktor kiritadi; eslatma «Bugungi ishlar»da.
    const dv = ctx.retseptCtx ? davomatBugun(ctx.retseptCtx()) : null;
    const kecha = H.kunQosh(H.kunKey(Date.now()), -1);
    const kechaYoq = H.kechaSavdosiz(S, H.kunKey(Date.now()));
    const qoshIsh = (dv && dv.belgilanmagan ? 1 : 0) + kechaYoq.length;
    const ishlar = h('section', { class: 'o-ishlar', 'aria-labelledby': 'o-ishlar-s' },
      h('h2', { class: 'o-ishlar-s', id: 'o-ishlar-s' }, 'Bugungi ishlar', X.jamiIsh + qoshIsh ? h('span', { class: 'o-son' }, String(X.jamiIsh + qoshIsh)) : null));
    if (dv && dv.belgilanmagan) ishlar.append(havola('davomat', 'Davomat', dv.belgilanmagan + ' ta xodim bugun belgilanmagan'));
    kechaYoq.forEach((f) => ishlar.append(h('button', { type: 'button', class: 'o-karta o-element o-bosiladi o-diqqat',
      onclick: () => (ctx.kechaSavdo ? ctx.kechaSavdo(f, kecha) : ctx.savdoKirit && ctx.savdoKirit({ filialId: f.id, kun: kecha })) },
      h('span', { class: 'o-element-matn' }, h('b', { class: 'o-nom' }, 'Kecha ' + f.nom + ' savdosi kiritilmagan'), h('span', { class: 'o-izoh' }, 'Bosing — savdoni kiriting yoki «Savdo bo\'lmadi»')))));
    if (!X.jamiIsh && !qoshIsh) {
      ishlar.append(h('div', { class: 'o-karta o-hammasi', role: 'status' }, h('b', { class: 'o-nom' }, '✓ Hammasi joyida'),
        h('span', { class: 'o-izoh' }, 'Hozir qiladigan ish yo\'q. Yangi ish bo\'lsa, Telegram\'ga xabar keladi.')));
    }
    X.qabul.forEach((z) => ishlar.append(qabulKarta(z)));
    X.tasdiq.forEach((z) => ishlar.append(tasdiqKarta(z)));
    X.taminotchilar.forEach(({ t, kutadi }) => kutadi.forEach((a) => ishlar.append(taKarta(t, a))));
    X.taminotchilar.forEach(({ t, etiroz }) => etiroz.forEach((a) => ishlar.append(etirozKarta(t, a))));
    if (X.yangiDori.length) ishlar.append(havola('dorilar', X.yangiDori.length + ' ta dori buyurtma kutyapti', qisqa(X.yangiDori.map((d) => d.nom))));
    if (X.otgan.length) ishlar.append(havola('qarz', X.otgan.length + ' ta qarzning muddati o\'tdi', qisqa(X.otgan.map((q) => q.ism))));
    m.append(ishlar);
    const tugma = (k, nom, izoh, son) => h('button', { type: 'button', class: 'o-tugma', onclick: () => bor(k),
      'aria-label': nom + '. ' + izoh + (son ? '. ' + son + ' ta ish kutyapti' : '') },
      h('span', { class: 'o-ikon' }, ikon(IKON[k])),
      h('span', { class: 'o-tugma-matn' }, h('span', { class: 'o-tugma-nom' }, nom), h('span', { class: 'o-izoh' }, izoh)),
      son ? h('span', { class: 'o-belgi', 'aria-hidden': 'true' }, String(son)) : null);
    m.append(h('nav', { class: 'o-grid', 'aria-label': 'Asosiy bo\'limlar' },
      tugma('pul', 'Pul', 'Seyfda ' + raqam(X.seyf), X.pulIshi),
      tugma('dorilar', 'Dorilar', X.yangiDori.length ? X.yangiDori.length + ' ta kam qoldi' : X.dorilar.length ? 'Hammasiga buyurtma berilgan' : 'Hammasi bor', X.yangiDori.length),
      // yumshoq chiziqcha (­): tor tugmada "Ta'minot-/chilar" bo'lib bo'linadi
      tugma('tamin', 'Ta\'minot­chilar', 'Qarzimiz ' + raqam(X.taQarz), X.taKutadi),
      tugma('qarz', 'Qarzlar', X.ochiq.length ? 'Mijozlarda ' + raqam(X.ochiq.reduce((a, q) => a + H.qarzQoldiq(q), 0)) : 'Ochiq qarz yo\'q', X.otgan.length),
      tugma('davomat', 'Davomat', dv ? (dv.belgilanmagan ? dv.belgilanmagan + ' ta belgilanmagan' : '✓ Hammasi belgilangan') : 'Keldi / kelmadi', dv ? dv.belgilanmagan : 0)));
    // Ko'rinish: yozuv tugmalari o'z yozuvida qoladi (data-asl) — kirillni o'qiy olmagan odam ham "Lotin" ni topsin.
    const yozuv = pills([['lotin', 'Lotin'], ['kirill', 'Кирилл']], yozuvKirillmi(x.id) ? 'kirill' : 'lotin',
      (v) => { yozuvQoy(v === 'kirill'); ctx.rerender(true); }, 'Yozuv / Ёзув');
    yozuv.setAttribute('data-asl', '');
    m.append(h('section', { class: 'o-karta o-korinish' }, h('h2', { class: 'o-izoh' }, 'Ko\'rinish'), yozuv,
      pills([['oddiy', 'Oddiy harf'], ['katta', 'Katta harf']], soz.katta ? 'katta' : 'oddiy',
        (v) => { sozlamaQoy(x.id, { ...soz, katta: v === 'katta' }); ctx.rerender(true); }, 'Harf kattaligi')));
    const ekran = ctx.ekranTugmasi ? ctx.ekranTugmasi() : null;
    if (ekran) m.append(ekran);
    m.append(h('button', { type: 'button', class: 'link o-toliq', onclick: () => { rejimQoy(x.id, false); ctx.rerender(true); } }, 'To\'liq rejimga o\'tish'));
  }

  // ---------- Pul ----------
  if (sahifa === 'pul') {
    X.qabul.forEach((z) => m.append(qabulKarta(z)));
    X.tasdiq.forEach((z) => m.append(tasdiqKarta(z)));
    m.append(h('section', { class: 'o-karta o-qator' }, h('span', { class: 'o-izoh' }, 'Seyfda'), h('b', { class: 'o-orta' }, raqam(X.seyf))));
    if (ctx.savdoKirit) m.append(h('button', { type: 'button', class: 'p o-asosiy', onclick: () => ctx.savdoKirit() }, '+ Savdo kiritish'));
    // Bugun seyfga kirgan — yashil, chiqqan — qizil (27.10, to'liq rejimdagi Bosh bilan bir xil hisob: H.kunSeyf).
    const sf = H.kunSeyf(S, H.kunKey(Date.now()));
    m.append(h('div', { class: 'o-kirdi-chiqdi' },
      h('div', { class: 'o-kc kirim' }, h('span', {}, '▲ Bugun kirdi'), h('b', {}, '+' + raqam(sf.kirdiJami))),
      h('div', { class: 'o-kc chiqim' }, h('span', {}, '▼ Bugun chiqdi'), h('b', {}, '−' + raqam(sf.chiqdiJami)))));
    const sv = X.savdo;
    m.append(h('section', { class: 'o-karta o-royxat' }, h('h2', { class: 'o-izoh' }, 'Bugungi savdo'),
      ...S.filiallar.map((f) => { const v = sv.filiallar[f.id] || { naqd: 0, karta: 0 }; return h('div', { class: 'o-satr' }, h('span', {}, f.nom), h('b', {}, raqam(v.naqd + v.karta))); }),
      h('div', { class: 'o-satr o-jami' }, h('span', {}, 'Jami'), h('b', {}, raqam(sv.jami)))));
  }

  // ---------- Davomat (29.10) — to'liq rejimdagi ekran ----------
  if (sahifa === 'davomat') davomatView(m, ctx.retseptCtx(), S);

  // ---------- Dorilar (defektura) ----------
  if (sahifa === 'dorilar') {
    m.append(h('p', { class: 'o-izoh' }, 'Xodimlar yozgan kam qolgan dorilar'));
    if (!X.yangiDori.length) m.append(h('div', { class: 'o-karta o-izoh' }, X.dorilar.length ? 'Hammasiga buyurtma berilgan ✓' : 'Hozircha hech narsa kerak emas ✓'));
    const element = (d) => h('li', { class: 'o-karta o-element' },
      h('div', { class: 'o-element-matn' }, h('b', { class: 'o-nom' }, d.nom),
        h('span', { class: 'o-izoh' }, (d.soni > 1 ? d.soni + ' marta so\'ralgan · ' : '') + d.filiallar.map(fil).join(', '))),
      // Audit 10.11: «Buyurtma berdim»dan keyin 5 soniya «Bekor qilish»; buyurtma berilgani — «Kerakka qaytarish» (xato bosilsa).
      d.holat === 'yangi'
        ? h('button', { type: 'button', class: 'p o-yon', onclick: () => (ctx.defBuyurtma ? ctx.defBuyurtma(d.nom) : ctx.amal('defekturaHolat', d.nom, 'buyurtma')) }, 'Buyurtma berdim')
        : ctx.defKerakka ? h('div', { class: 'o-yon-ust' }, h('span', { class: 'o-tayyor' }, 'Buyurtma ✓'),
          h('button', { type: 'button', class: 's o-qaytar', onclick: () => ctx.defKerakka(d.nom) }, 'Kerakka qaytarish'))
          : h('span', { class: 'o-tayyor' }, 'Buyurtma ✓'));
    // 03.11: buyurtma berilganlar — alohida ro'yxat (oxirgi buyurtma tepada).
    m.append(h('ul', { class: 'o-list' }, ...X.yangiDori.map(element)));
    const berilgan = X.dorilar.filter((d) => d.holat === 'buyurtma').sort((a, b) => b.holatTs - a.holatTs);
    if (berilgan.length) {
      m.append(h('h2', { class: 'o-izoh' }, 'Buyurtma berilganlar (' + berilgan.length + ')'));
      m.append(h('ul', { class: 'o-list' }, ...berilgan.map(element)));
    }
    m.append(h('p', { class: 'o-izoh o-markaz' }, 'Dori kelganda o\'zi "Keldi" bo\'ladi va xodimga xabar boradi'));
  }

  // ---------- Ta'minotchilar ----------
  if (sahifa === 'tamin') {
    X.taminotchilar.forEach(({ t, kutadi }) => kutadi.forEach((a) => m.append(taKarta(t, a))));
    X.taminotchilar.forEach(({ t, etiroz }) => etiroz.forEach((a) => m.append(etirozKarta(t, a))));
    m.append(h('section', { class: 'o-karta' }, h('span', { class: 'o-izoh' }, 'Jami qarzimiz'), h('span', { class: 'o-katta' }, H.som(X.taQarz))));
    if (!X.taminotchilar.length) m.append(h('div', { class: 'o-karta o-izoh' }, 'Ta\'minotchi qo\'shilmagan — to\'liq rejimda qo\'shiladi'));
    else m.append(h('p', { class: 'o-izoh' }, 'To\'lov qilish uchun ismini bosing'));
    const ul = h('ul', { class: 'o-list' });
    X.taminotchilar.slice().sort((a, b) => b.qarz - a.qarz).forEach(({ t, qarz }) => ul.append(h('li', {},
      h('button', { type: 'button', class: 'o-karta o-element o-bosiladi', onclick: () => tolovSheet(ctx, t, qarz, X.seyf, H.qoldiq(S, 'uy')) },
        h('b', { class: 'o-nom', style: 'flex:1;text-align:left' }, t.nom), h('b', { class: 'o-orta' }, raqam(qarz)), ikon('M9 5l7 7-7 7', 22)))));
    m.append(ul);
  }

  // ---------- Qarzlar (mijozlar) ----------
  if (sahifa === 'qarz') {
    const tartib = X.ochiq.slice().sort((a, b) => H.muddatKuni(a) - H.muddatKuni(b));
    if (!tartib.length) m.append(h('div', { class: 'o-karta o-izoh' }, 'Ochiq qarz yo\'q ✓'));
    const ul = h('ul', { class: 'o-list' });
    tartib.forEach((q) => {
      const kun = Math.ceil((H.muddatKuni(q) - Date.now()) / 864e5), otgan = H.muddatiOtgan(q), qol = H.qarzQoldiq(q);
      ul.append(h('li', { class: 'o-karta o-element' + (otgan ? ' o-diqqat' : '') },
        h('div', { class: 'o-element-matn' }, h('b', { class: 'o-nom' }, q.ism),
          h('span', { class: 'o-izoh' }, ism(q.xodimId) + ' yozgan · ' + (otgan ? Math.abs(kun) + ' kun o\'tdi' : kun + ' kun qoldi')),
          h('b', { class: 'o-orta' }, H.som(qol))),
        h('button', { type: 'button', class: 'o-yon o-chegarali', onclick: () => qaytdiSheet(ctx, q, qol) }, 'Pul qaytdi')));
    });
    m.append(ul);
    m.append(h('p', { class: 'o-izoh o-markaz' }, 'Qarzni xodim yozadi — siz qaytgan pulni belgilaysiz'));
  }
}

// Bitta summa maydoni + saqlash (qabulda kam/ko'p chiqsa). saqla(joyla, qiymat) → Promise.
function summaSheet(ctx, yorliq, bosh, saqla, xabar) {
  sheet('Summani yozing', (box, close) => {
    const s = input(yorliq, { value: String(bosh) });
    box.append(s.el, h('button', { class: 'p o-asosiy', onclick: () => {
      const v = H.pul(s.i.value);
      if (!v) { s.xato('Summani yozing — masalan: 2 300 000'); s.i.focus(); return; }
      const yoz = () => saqla(xatoJoyla([[s, /summa/i]]), s.i.value).then((ok) => ok && (close(), ctx.toast(xabar(s.i.value))));
      // Kutilgandan 100 000 dan ko'p farq (ortiqcha nol) — qayta so'raladi (audit 27.10).
      if (Math.abs(v - (H.pul(String(bosh)) || 0)) >= 100000) {
        tasdiq('Kutilgan ' + H.som(H.pul(String(bosh)) || 0) + ', siz ' + H.som(v) + ' yozdingiz (farq ' + H.som(Math.abs(v - (H.pul(String(bosh)) || 0))) + '). To\'g\'rimi?')
          .then((ha) => { if (ha) yoz(); else s.i.focus(); });
        return;
      }
      yoz();
    } }, 'Saqlash'));
  });
}

// Ta'minotchiga to'lov: bitta summa, Seyfdan yoki Uydan.
function tolovSheet(ctx, t, qarz, seyf, uy) {
  sheet(t.nom + ' — to\'lov', (box, close) => {
    let ham = 'kassa';
    const s = input('Qancha berdingiz?', { k: 'o-tolov-' + t.id });
    const hamG = pills([['kassa', 'Seyfdan · ' + raqam(seyf)], ['uy', 'Uydan · ' + raqam(uy)]], ham, (v) => { ham = v; }, 'Qaysi puldan');
    box.append(h('div', { class: 'o-izoh' }, 'Qarzimiz: ' + H.som(qarz) + (UY_PULI ? '' : ' · pul seyfdan')), s.el, UY_PULI ? h('b', { class: 'o-izoh' }, 'Qaysi puldan?') : null, UY_PULI ? hamG : null,
      h('button', { class: 'p o-asosiy', onclick: () => {
        const v = H.pul(s.i.value);
        if (!v) { s.xato('Summani yozing — masalan: 2 000 000'); s.i.focus(); return; }
        const qol = ham === 'kassa' ? seyf : uy;
        (v > qol ? tasdiq((ham === 'kassa' ? 'Seyfda' : 'Uyda') + ' ' + H.som(qol) + ' bor. Baribir yozilsinmi?') : Promise.resolve(true))
          .then((ha) => ha && ctx.amalX(xatoJoyla([[s, /summa|kamida/i]]), 'tolov', t.id, { [ham]: s.i.value }, '')
            .then((ok) => ok && (close(), ctx.toast(t.nom + 'ga ' + H.som(v) + ' to\'lov yozildi ✓'))));
      } }, 'To\'lovni yozish'),
      h('div', { class: 'o-izoh' }, t.ulangan ? 'Qarzimiz darhol kamayadi; ' + t.nom + ' hisobida — u telefonida tasdiqlagach' : 'Qarz darhol kamayadi'));
  });
}

// Mijoz qarzi qaytdi: summa (qoldiq oldindan yozilgan), Seyfga yoki Uyga.
function qaytdiSheet(ctx, q, qol) {
  sheet('Pul qaytdi: ' + q.ism, (box, close) => {
    let ham = 'kassa';
    const s = input('Qancha olib keldi?', { value: String(qol) });
    const hamG = pills([['kassa', 'Seyfga'], ['uy', 'Uyga']], ham, (v) => { ham = v; }, 'Pulni qayerga qo\'yasiz');
    box.append(s.el, UY_PULI ? h('b', { class: 'o-izoh' }, 'Pulni qayerga qo\'yasiz?') : h('div', { class: 'o-izoh' }, 'Pul seyfga qo\'shiladi.'), UY_PULI ? hamG : null,
      h('div', { class: 'o-izoh' }, 'Kamroq yozsangiz — qolgani ochiq qoladi.'),
      h('button', { class: 'p o-asosiy', onclick: () => {
        const v = H.pul(s.i.value);
        if (!v) { s.xato('Summani yozing'); s.i.focus(); return; }
        if (v > qol) { s.xato('Qoldiq ' + H.som(qol) + ' — undan ko\'p yozib bo\'lmaydi'); s.i.focus(); return; }
        ctx.amalX(xatoJoyla([[s, /summa|qoldiq/i]]), 'qarzUndirish', q.id, s.i.value, ham).then((ok) => ok && (close(), ctx.toast(H.som(v) + ' qabul qilindi ✓')));
      } }, 'Saqlash'));
  });
}
