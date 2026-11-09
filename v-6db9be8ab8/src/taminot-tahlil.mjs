// Ta'minotchilar tahlili (08.11; egasi: "ta'minotchilar bo'limidagi yozilganlar — qaysi dorisi tez sotilyapti, qaysi kam, qaysi
// ta'minotchi ko'p foyda olib kelyapti"; "ta'minotchi ro'yxatiga kirilganda — masalan Surojning dorilari bizda qancha qolgani").
// Server: ilova.taminot_tahlil (20261108130000_taminot_tahlil.sql) — Oson'dagi jami qoldiq (hamma filial), davrdagi sotuv
// (Oson qoldig'i kamayishi), Oson sotuv narxi, ta'minotchi narxi. Sotuv — qoldiq kamayishidan (chek emas), shuning uchun taxminiy.
// Faqat direktor va faqat serverda. Hisob — sof funksiyalar (doriHisob, taHisobi), test: miniapp-taminot-tahlil.
import * as H from './hisob.mjs';
import { h, input, kartaSarlavha, pills, sana, sheet, tasdiqlash } from './ui.mjs';

const T = { kun: 30, j: null, jKun: null, vaqt: 0, xato: null, yuk: null, ta: null };
export function tahlilUnut() { Object.assign(T, { j: null, jKun: null, vaqt: 0, xato: null, yuk: null }); }
export const tahlilTa = (id) => { T.ta = id || null; };

function yukla(ctx, chiz, majbur = false) {
  if (T.yuk) return T.yuk;
  if (!majbur && T.j && T.jKun === T.kun && Date.now() - T.vaqt < 60000) return Promise.resolve();
  const kun = T.kun;
  // Audit 08.11: javob tekshiruvi xatosi ham .catch'ga tushadi (avval .then(ok, err) da — cheksiz qayta so'rov bo'lardi).
  T.yuk = Promise.resolve().then(() => ctx.oqi('taminotTahlil', kun)).then((j) => {
    if (!j || !Array.isArray(j.taminotchilar)) throw new Error(j === null ? 'Tahlil olinmadi' : 'Server javobi tushunarsiz');
    T.j = j; T.jKun = kun; T.xato = null;
  }).catch((e) => { T.xato = (e && e.message) || 'Tahlil olinmadi'; })
    .finally(() => { T.vaqt = Date.now(); T.yuk = null; if (chiz) chiz(); });
  return T.yuk;
}

const kunQisqa = (k) => String(k).slice(8, 10) + '.' + String(k).slice(5, 7);
const son = (n) => String(Math.round(Number(n || 0) * 10) / 10).replace('.', ',');
// Bir dori: kunlik sotuv, necha kunga yetadi, daromad va foyda (birlik — quti; ta'minotchi narxi Oson narxidan 2 baravar ko'p bo'lsa —
// birlik boshqa deb hisoblanadi va foyda chiqarilmaydi), holat va tavsiya.
export function doriHisob(d, davr0) {
  const davr = Number(d.davr) > 0 ? Number(d.davr) : davr0;
  const qoldiq = Number(d.qoldiq) || 0, sotuv = Number(d.sotuv) || 0, narx = Number(d.narx) || 0, taNarx = Number(d.taNarx) || 0;
  const kunlik = davr > 0 ? sotuv / davr : 0;
  const yetadi = kunlik > 0 ? qoldiq / kunlik : null;
  const birlik = narx > 0 && taNarx > 0 && taNarx < narx * 2;
  const foydaBir = birlik ? narx - taNarx : null;
  const r = { davr, qoldiq, sotuv, kunlik, yetadi, daromad: sotuv * narx, foyda: foydaBir == null ? null : sotuv * foydaBir,
    foiz: birlik ? Math.round((narx - taNarx) / taNarx * 100) : null, holat: '', rang: 'kul', tavsiya: null };
  if (!d.topildi) { r.holat = 'Oson\'da topilmadi'; r.rang = 'kul'; return r; }
  if (qoldiq <= 0) { r.holat = 'Tugagan'; r.rang = 'qizil'; }
  else if (sotuv === 0) { r.holat = davr >= 14 ? 'Sotilmayapti' : 'Hali sotilmadi'; r.rang = davr >= 14 ? 'sariq' : 'kul'; }
  else if (yetadi <= 7) { r.holat = 'Tez — tugayapti'; r.rang = 'qizil'; }
  else if (yetadi <= 45) { r.holat = 'Yaxshi sotilyapti'; r.rang = 'yashil'; }
  else { r.holat = 'Sekin sotilyapti'; r.rang = 'sariq'; }
  // Tavsiya: 14 kunlik ehtiyojdan kami — olish; sotilmayotgan va qoldig'i bor — hozircha olmaslik.
  if (kunlik > 0) {
    const kerak = Math.ceil(kunlik * 14 - qoldiq);
    if (kerak > 0) r.tavsiya = 'Keyingi xaridda ~' + kerak + ' quti oling';
  } else if (qoldiq > 0 && davr >= 14) r.tavsiya = 'Hozircha olmang — ' + son(qoldiq) + ' quti turibdi';
  // 10.11 (egasi: "Ginesept 44 ta keldi, lekin yana «oling» chiqib turibdi"; "oling tavsiyasini Oson qoldig'idan olishi kerak"):
  // xaridda yozilgan, Oson'ga hali kiritilmagan dori — qoldiq Oson'dan qoladi, lekin «oling» chiqmaydi (Oson'ga kiritilgach hisoblanadi).
  if (Number(d.kutish) > 0) {
    r.kutish = d.kutish + ' ta keldi' + (d.kutishKun ? ' (' + kunQisqa(d.kutishKun) + ')' : '') + ' — Oson\'ga hali kiritilmagan';
    if (r.tavsiya && !/olmang/.test(r.tavsiya)) r.tavsiya = null;
  }
  return r;
}
// Bir ta'minotchi bo'yicha jamlar: daromad, foyda (narxi ma'lum dorilar), sotilgan quti, tez / tugagan / sotilmayotgan soni.
export function taHisobi(ta, davr) {
  const ds = (ta.dorilar || []).map((d) => ({ d, x: doriHisob(d, davr) }));
  const r = { daromad: 0, foyda: 0, foydaBor: false, sotuv: 0, tez: 0, tugagan: 0, sotilmaydi: 0, topilmadi: 0, ds };
  ds.forEach(({ d, x }) => {
    // Bir nechta ta'minotchidan olinadigan dori: sotuv kimnikidan bo'lgani noma'lum — jamiga kirmaydi (ikki marta hisoblanmasin).
    if (!d.ulush) {
      r.daromad += x.daromad; r.sotuv += x.sotuv;
      if (x.foyda != null) { r.foyda += x.foyda; r.foydaBor = true; }
    }
    if (!d.topildi) r.topilmadi++;
    else if (x.holat === 'Tugagan') r.tugagan++;
    else if (x.holat === 'Tez — tugayapti') r.tez++;
    else if (x.holat === 'Sotilmayapti') r.sotilmaydi++;
  });
  return r;
}

const belgi = (x) => h('span', { class: 'tt-b ' + x.rang }, x.holat);
function doriQator(ctx, ta, d, x, chiz) {
  const qism = [];
  if (d.topildi) {
    qism.push(x.sotuv ? x.davr + ' kunda ' + son(x.sotuv) + ' quti sotildi' : 'sotuv ko\'rinmadi');
    if (x.yetadi != null && x.qoldiq > 0) qism.push(son(x.yetadi) + ' kunga yetadi');
    if (x.foiz != null) qism.push(x.foiz < 0 ? 'zarar ' + (-x.foiz) + '% (narxni tekshiring)' : 'foyda ' + x.foiz + '%');
  }
  const ich = [h('span', { class: 'yq-m' },
    h('b', { 'data-asl': '' }, d.nom),
    d.topildi && d.osonNom && d.osonNom !== d.nom ? h('span', { class: 'muted tt-oson' }, 'Oson: ', h('span', { 'data-asl': '' }, d.osonNom)) : null,
    qism.length ? h('span', { class: 'muted' }, qism.join(' · ')) : null,
    // 10.11 (egasi: "qaysi filialda nechta borligini ham ko'rsat"): filial — soni (tugagan — «yo'q»).
    d.topildi && Array.isArray(d.filiallar) && d.filiallar.length ? h('span', { class: 'tt-fil', 'aria-label': 'Filiallar bo\'yicha' },
      ...d.filiallar.map((f) => h('span', { class: 'tt-f' + (Number(f.soni) > 0 ? '' : ' yoq') },
        h('span', { 'data-asl': '' }, f.b), ' ', h('b', {}, Number(f.soni) > 0 ? f.matn : 'yo\'q')))) : null,
    x.kutish ? h('span', { class: 'kut-belgi' }, x.kutish) : null,
    x.tavsiya ? h('span', { class: 'tt-tavsiya' }, x.tavsiya) : null,
    d.ulush ? h('span', { class: 'muted tt-oson' }, 'Boshqa ta\'minotchidan ham olinadi — sotuv umumiy, reytingga kirmaydi') : null,
    belgi(x)),
  h('span', { class: 'tt-q ' + (d.topildi ? (x.qoldiq > 0 ? '' : 'qizil') : 'kul') },
    d.topildi ? h('b', {}, son(x.qoldiq)) : h('b', {}, '—'), h('small', {}, d.topildi ? 'quti bor' : 'Oson\'da yo\'q'))];
  // Bosilsa — Oson'dagi qaysi dori ekanini tanlash (topilmagan, qo'lda bog'langan yoki noto'g'ri topilgan).
  return h('button', { type: 'button', class: 'yq tt-r', onclick: () => boglaOyna(ctx, ta, d, chiz) }, ...ich, h('span', { class: 'yq-o' }, '›'));
}

// «Oson'dagi qaysi dori?» — o'xshash nomlar va qidiruv; tanlangani bog'lanadi (keyingi tahlillarda shu nom bilan).
function boglaOyna(ctx, ta, d, chiz) {
  sheet('Oson\'dagi qaysi dori?', (box, close) => {
    const tanla = (nom) => ctx.amal('taminotDoriOson', ta.id, d.kalit || d.nom, nom).then((r) => {
      if (r == null) return;
      close(); ctx.toast(nom ? 'Bog\'landi ✓' : 'Bog\'lash olib tashlandi'); tahlilUnut(); yukla(ctx, chiz, true);
    });
    const variant = (nom) => h('button', { type: 'button', class: 's shumi-t', onclick: () => tanla(nom) }, h('span', { 'data-asl': '' }, nom));
    box.append(h('div', { class: 'muted' }, 'Ta\'minotchi ro\'yxatida «', h('span', { 'data-asl': '' }, d.nom), '» deb yozilgan. Oson\'da u qaysi nom bilan turadi? Tanlang — tahlilda qoldiq va sotuv shu dori bo\'yicha chiqadi. Xaridlar va qarz o\'zgarmaydi.'));
    if (d.bog) box.append(h('div', { class: 'msg ok' }, 'Hozir bog\'langan: ', h('span', { 'data-asl': '' }, d.osonNom || '')));
    else if (d.topildi) box.append(h('div', { class: 'msg info' }, 'Hozir avtomatik topilgan: ', h('span', { 'data-asl': '' }, d.osonNom || d.nom), '. Noto\'g\'ri bo\'lsa — to\'g\'risini tanlang.'));
    const tk = (d.taklif || []);
    if (tk.length) box.append(h('b', {}, 'O\'xshash nomlar'), ...tk.map(variant));
    const q = input('Oson\'dagi nomini qidirish', { inputmode: 'text', placeholder: 'Masalan: Тиокбед' });
    const nat = h('div', { class: 'shumi' });
    const qidir = () => {
      const v = String(q.i.value || '').trim();
      if (v.length < 2) { q.xato('Kamida 2 harf yozing'); return; }
      nat.textContent = 'Qidirilmoqda…';
      ctx.oqi('osonQidir', v).then((j) => {
        nat.textContent = '';
        const nomlar = [...new Set((Array.isArray(j) ? j : []).map((z) => z && z.nom).filter(Boolean))].slice(0, 8);
        if (!nomlar.length) nat.append(h('div', { class: 'muted' }, 'Topilmadi — boshqacha yozib ko\'ring.'));
        nomlar.forEach((n) => nat.append(variant(n)));
      }, (e) => { nat.textContent = (e && e.message) || 'Qidirib bo\'lmadi'; });
    };
    q.i.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); qidir(); } });
    box.append(q.el, h('button', { type: 'button', onclick: qidir }, 'Qidirish'), nat);
    if (d.bog) box.append(h('button', { type: 'button', class: 'link', onclick: () => tanla('') }, 'Bog\'lashni olib tashlash'));
    // 09.11: dorini shu ta'minotchi ro'yxatidan olib tashlash (xaridlar va qarz o'zgarmaydi).
    box.append(h('button', { type: 'button', class: 'ogoh', onclick: () => {
      tasdiqlash('«' + d.nom + '» ' + ta.nom + ' ro\'yxatidan olib tashlansinmi? Xaridlar va qarz o\'zgarmaydi.')
        // Kalit bilan (bog'lashdagidek): nomdan qayta hisoblangan kalit eski yozuvnikidan farq qilishi mumkin (08.11 izohi).
        .then((ha) => (ha ? ctx.amal('taminotDori', ta.id, d.kalit || d.nom, false) : null)).then((r) => {
          if (r == null) return;
          close(); ctx.toast(r === 0 ? 'Ro\'yxatda topilmadi — yangilandi' : 'Ro\'yxatdan olindi'); tahlilUnut(); yukla(ctx, chiz, true);
        });
    } }, 'Ro\'yxatdan olib tashlash'));
  }, { fokus: false });
}

// «+ Dori qo'shish»: nomini yozasiz — Oson'dagi o'xshash dorilar chiqadi, tanlansa aynan shu nom yoziladi (qoldiq va sotuv
// o'zi bog'lanadi); Oson'da yo'q dori — yozilgan nom bilan (keyin «Oson'dagi qaysi dori?» bilan bog'lash mumkin).
function doriQoshOyna(ctx, ta, chiz) {
  sheet('Dori qo\'shish', (box, close) => {
    const qosh = (nom) => ctx.amal('taminotDori', ta.id, nom, true).then((r) => {
      if (r == null) return;
      close(); ctx.toast('Qo\'shildi ✓'); tahlilUnut(); yukla(ctx, chiz, true);
    });
    // Yozilgan nom bilan qo'shish tugmasi (nom kirill rejimida ham o'zgarmaydi — data-asl).
    const ozi = (v, old) => h('button', { type: 'button', class: 'link', onclick: () => qosh(v) }, h('span', {}, old, '«', h('span', { 'data-asl': '' }, v), '» deb qo\'shish'));
    const q = input('Dori nomi', { inputmode: 'text', placeholder: 'Masalan: Гемостим' });
    const nat = h('div', { class: 'shumi' });
    let avlod = 0, taymer = null;
    const qidir = () => {
      const v = String(q.i.value || '').replace(/\s+/g, ' ').trim();
      nat.textContent = '';
      if (v.length < 2) return;
      const men = ++avlod;
      nat.append(h('div', { class: 'muted' }, 'Oson\'dan qidirilmoqda…'));
      ctx.oqi('osonQidir', v).then((j) => {
        if (men !== avlod) return;
        nat.textContent = '';
        const nomlar = [...new Set((Array.isArray(j) ? j : []).map((z) => z && z.nom).filter(Boolean))].slice(0, 8);
        nomlar.forEach((n) => nat.append(h('button', { type: 'button', class: 's shumi-t', onclick: () => qosh(n) },
          h('span', { 'data-asl': '' }, n), h('small', {}, 'Oson\'da bor — qoldig\'i ko\'rinadi'))));
        nat.append(ozi(v, nomlar.length ? 'Hech biri emas — ' : 'Oson\'da topilmadi — '));
      }, () => { if (men === avlod) { nat.textContent = ''; nat.append(ozi(v, '')); } });
    };
    q.i.addEventListener('input', () => { clearTimeout(taymer); taymer = setTimeout(qidir, 350); });
    q.i.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); clearTimeout(taymer); qidir(); } });
    box.append(h('div', { class: 'tt-kim' }, 'Ta\'minotchi: ', h('b', { 'data-asl': '' }, ta.nom)),
      h('div', { class: 'muted' }, 'Nomini yoza boshlang — Oson\'dagi nom bilan tanlasangiz, bizda qancha qolgani va sotuvi o\'zi chiqadi. Ta\'minotchi botga ulanmagan bo\'lsa ham ishlaydi.'),
      q.el, nat);
    return () => clearTimeout(taymer);
  });
}

function holatEl(ctx, chiz) {
  if (T.j && T.jKun === T.kun) return null;
  if (T.xato && !T.yuk) return h('div', { class: 'card' }, h('div', { class: 'muted' }, T.xato), h('button', { class: 's', onclick: () => { T.xato = null; yukla(ctx, chiz, true); chiz(); } }, 'Qayta urinish'));
  yukla(ctx, chiz);
  return h('div', { class: 'card muted', role: 'status' }, 'Tahlil yuklanmoqda…');
}
function davrIzoh() {
  const j = T.j;
  if (!j.kuzatuv) return h('div', { class: 'msg warn' }, 'Oson sotuvi hali kuzatilmagan — aptekadagi kompyuterda Oson qoldig\'i yuborilgach sotuv chiqadi.');
  if (j.davr < j.kun) return h('div', { class: 'msg info' }, 'Sotuv ' + sana(new Date(j.kuzatuv + 'T12:00:00').getTime()) + ' dan beri kuzatilmoqda (' + j.davr + ' kun) — raqamlar taxminiy, 2–4 haftada aniqlashadi.');
  return null;
}

// Ta'minotchi sahifasidagi karta: uning dorilari — bizda qancha qolgan, qanchasi sotilyapti.
export function taDorilarKarta(ctx, ta, chiz, ochTahlil) {
  if (!ctx.server) return null;
  const k = h('section', { class: 'card list tt-karta', 'aria-label': 'Dorilari — bizda qancha qoldi' }, kartaSarlavha('Dorilari — bizda qancha qoldi'));
  const hol = holatEl(ctx, chiz);
  if (hol) { k.append(...hol.childNodes); return k; }
  const t = T.j.taminotchilar.find((z) => z.id === ta.id);
  // Audit 08.11: yangi xarid yoki ta'minotchi — 60 soniyalik keshda hali yo'q; bir marta (3 s dan keyin) qayta olinadi.
  if ((!t || (ta.dorilar && t.dorilar.length !== ta.dorilar.length)) && !T.yuk && Date.now() - T.vaqt > 3000) yukla(ctx, chiz, true);
  const qoshT = h('button', { type: 'button', class: 's tt-qosh', onclick: () => doriQoshOyna(ctx, ta, chiz) }, '+ Dori qo\'shish');
  if (!t || !t.dorilar.length) {
    k.append(h('div', { class: 'muted' }, 'Ro\'yxatda dori yo\'q. «+ Dori qo\'shish» bilan shu ta\'minotchi olib keladigan dorilarni yozing — bizda qancha qolgani Oson\'dan o\'zi chiqadi. Xarid yozilganda ham dorilar o\'zi qo\'shiladi.'), qoshT);
    return k;
  }
  const s = taHisobi(t, T.j.davr);
  k.append(h('div', { class: 'muted' }, 'Hamma filialdagi jami (Oson) · ' + (T.j.davr >= 1 ? 'oxirgi ' + T.j.davr + ' kun sotuvi.' : 'sotuv hali kuzatilmoqda.')));
  const ro = h('div', { class: 'tt-royxat' }, ...s.ds.map(({ d, x }) => doriQator(ctx, t, d, x, chiz)));
  k.append(ro, qoshT);
  if (ochTahlil) k.append(h('button', { type: 'button', class: 'link', onclick: () => { T.ta = ta.id; ochTahlil(); } }, 'To\'liq tahlil ›'));
  return k;
}

// To'liq sahifa: davr, ta'minotchilar reytingi (foyda bo'yicha), har birining dorilari.
export function tahlilView(m, ctx, chiz) {
  if (!ctx.server) { m.append(h('div', { class: 'card muted' }, 'Tahlil faqat Telegram ilovasida (serverda) ishlaydi.')); return; }
  m.append(pills([[7, '7 kun'], [30, '30 kun'], [90, '90 kun']], T.kun, (v) => { T.kun = v; chiz(); }, 'Davr'));
  const hol = holatEl(ctx, chiz);
  if (hol) { m.append(hol); return; }
  const j = T.j, iz = davrIzoh();
  if (iz) m.append(iz);
  const tlar = j.taminotchilar.map((t) => ({ t, s: taHisobi(t, j.davr) }))
    // Foydasi hisoblangan ta'minotchilar tepada (foyda bo'yicha), keyin — savdo bo'yicha.
    .sort((a, b) => (Number(b.s.foydaBor) - Number(a.s.foydaBor)) || (b.s.foyda - a.s.foyda) || (b.s.daromad - a.s.daromad) || a.t.nom.localeCompare(b.t.nom));
  // Reyting — bosilsa shu ta'minotchiga o'tadi (sahifada faqat u).
  const rey = h('section', { class: 'card yb-r tt-reyting', 'aria-label': 'Reyting' },
    h('div', { class: 'tt-sarlavha' }, h('b', {}, 'Qaysi ta\'minotchi ko\'p foyda keltiryapti'), h('span', { class: 'muted' }, 'oxirgi ' + j.davr + ' kun')));
  tlar.forEach(({ t, s }, i) => rey.append(h('button', { type: 'button', class: 'yq' + (T.ta === t.id ? ' tanlangan' : ''), 'aria-pressed': String(T.ta === t.id),
    onclick: () => { T.ta = T.ta === t.id ? null : t.id; chiz(); } },
  h('span', { class: 'tt-o' }, String(i + 1)),
  h('span', { class: 'yq-m' }, h('b', { 'data-asl': '' }, t.nom),
    h('span', { class: 'muted' }, [t.dorilar.length + ' ta dori', s.sotuv ? son(s.sotuv) + ' quti sotildi' : 'sotuv ko\'rinmadi',
      s.tez ? s.tez + ' ta tugayapti' : '', s.tugagan ? s.tugagan + ' ta tugagan' : '', s.sotilmaydi ? s.sotilmaydi + ' ta sotilmayapti' : ''].filter(Boolean).join(' · '))),
  h('span', { class: 'yq-v tt-v' }, s.foydaBor ? h('b', { class: s.foyda < 0 ? 'tt-zarar' : '' }, (s.foyda > 0 ? '+' : '') + H.som(Math.round(s.foyda))) : h('b', {}, H.som(Math.round(s.daromad))),
    h('small', {}, s.foydaBor ? (s.foyda < 0 ? 'zarar' : 'foyda') : 'savdo')))));
  m.append(rey);
  m.append(h('div', { class: 'muted' }, 'Foyda = (Oson sotuv narxi − ta\'minotchi narxi) × sotilgan quti; narxi yozilmagan dori foydaga kirmaydi. Sotuv — Oson qoldig\'i kamayishidan (boshqa filialga ko\'chirilgani ham sotuv bo\'lib ko\'rinishi mumkin).'));
  tlar.filter(({ t }) => !T.ta || t.id === T.ta).forEach(({ t, s }) => {
    const sec = h('section', { class: 'yb', 'aria-label': t.nom }, h('h2', { class: 'yb-s' }, h('span', { 'data-asl': '' }, t.nom), ' · xarid ' + H.som(t.xarid) + ', to\'lov ' + H.som(t.tolov)));
    const ro = h('div', { class: 'card yb-r tt-royxat' });
    if (!s.ds.length) ro.append(h('div', { class: 'muted', style: 'padding:12px 16px' }, 'Ro\'yxatda dori yo\'q.'));
    s.ds.forEach(({ d, x }) => ro.append(doriQator(ctx, t, d, x, chiz)));
    sec.append(ro);
    if (s.topilmadi) sec.append(h('div', { class: 'muted' }, s.topilmadi + ' ta dori Oson\'da topilmadi — qatorini bosib, Oson\'dagi nomini tanlang.'));
    m.append(sec);
  });
}
