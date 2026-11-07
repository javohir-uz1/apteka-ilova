// Direktor paneli: bosh, daftar, smenalar, ta'minot, bo'limlar (qarzlar, oyliklar, statistika, xulosa, sozlamalar).
// So'zlar (audit 24.10): "Seyf" — direktor qabul qilgan pul (ichki nomi 'kassa'); "Kassa" — faqat smena qutisi.
// Formalar (audit 25.10 §7): xato maydon tagida chiqadi — avval shu yerda tekshiriladi, server xatosi ham eng mos maydonga qo'yiladi.
import * as H from './hisob.mjs';
import { asosiyTugma, ekranTugmasi, guruhlar, guruhXato, h, input, ishQator, kartaSarlavha, kunNomi, nav, nusxaOl, ochiladi, ochiqQoy, orqagaQoy, oyKey, pills, pulSon, royxatHarakat, sahifaOtish, sana, sheet, tasdiqlash, tezTugmalar, vaqt, xatoJoyla, yordam, yozuvTugma } from './ui.mjs';
import { bolimlar, bolimNav, dumaloqlar, eskiKorinishmi, korinishOyna, korinishQolla, kvadrat, orqagaTugma, qator, sonKartalar, sozlamaTugmasi } from './qobiq.mjs';
import { ikon } from './ikon.mjs';
import { oddiyRejimmi, rejimQoy, renderOddiy } from './oddiy.mjs';
import { yozuvKirillmi, yozuvQoy } from './kirill.mjs';
import { doira, RANGLAR } from './diagramma.mjs';
import { BOT_USERNAME, UY_PULI } from './config.mjs';
import { DEF_HOLAT, keldiTasdiq, kelganKarta, praysQidiruv, yozganEl, yozganlar } from './bolimlar.mjs';
import { shtrixDirektor } from './shtrix.mjs';
import { punktlarView, retseptBosh, retseptIchida, retseptView } from './retsept.mjs';
import { sanashXabari } from './xabar.mjs';
import { oyinBanner, oyinView } from './oyin.mjs';
import { davomatBugun, davomatView } from './davomat.mjs';
import { defFirmaKarta, defNarxQator, firmaOchiq, firmaPrayslarView } from './firma.mjs';
import { osonKarta, osonQidiruv, osonQidiruvQoy, osonRejimQoy, osonSonlar } from './oson-qoldiq.mjs';
import { globalQidiruvOyna } from './qidiruv.mjs';
import { tanishuvAvto, tanishuvOch } from './tanishuv.mjs';
import { mijozBelgi } from './mijoz.mjs';
import { buyurtmaView, ertalabKarta, kochirishView, pulKirish, pulView } from './pul.mjs';
import { inventarOrqaga, inventarView } from './inventar.mjs';
import { chiqarishView } from './chiqarish.mjs';
import { kassaView, narxFarqSoni, narxView } from './nazorat.mjs';
import { funksiyalarView, ochiqSoni } from './funksiya.mjs';
import { auditView } from './audit.mjs';

// Sahifalar nomi (sarlavha va global qidiruv — 07.11 tun, `globalQidir`).
export const SAHIFA_NOM = { bosh: 'Direktor paneli', daftar: 'Kunlik daftar', smena: 'Savdo', tamin: 'Ta\'minotchilar', more: 'Bo\'limlar',
  qarz: 'Mijozlar qarzi', oylik: 'Oyliklar', stat: 'Statistika', oqim: 'Kirim va chiqim', xulosa: 'Kechki xulosa', sozlama: 'Sozlamalar', xabar: 'Bot xabarlari',
  uy: 'Uy puli', defektura: 'Defektura', prays: 'Prays-list', shtrix: 'Shtrix-kodlar', retsept: 'Retseptlar', punktlar: 'Punktlar', oyin: 'Bilimdon o\'yini', davomat: 'Davomat', firmalar: 'Firma prayslari', qoldiq: 'Oson qoldig\'i', pul: 'Pul nazorati', buyurtma: 'Aqlli buyurtma', kochirish: 'Ko\'chirish', inventar: 'Inventar', narx: 'Narx farqi', kassa: 'Kassa ↔ Oson',
  hamyon: 'Hamyonlar', funksiyalar: 'Funksiyalar', chiqarish: 'Hisobdan chiqarilganlar', audit: 'O\'zgarishlar tarixi' };

let tab = 'bosh';
// Yangi ko'rinish (07.11, variant A): pastki menyuda 4 bo'lim; ichki sahifalar — eski ekranlar (tab/sub), menyusiz, «orqaga» bilan.
// Bosh joy — tab 'bosh' va sub yo'q: yTab bo'limi chiziladi. yol — qaysi sahifalardan kelindi (orqaga — shu tartibda).
let yTab = 'bugun';
let yol = [];
let sub = null;      // Bo'limlar ichidagi sahifa yoki ta'minotchi id
let qaytish = null;  // ‹ qayerga: Smenalar/Ta'minot (Bo'limlar ichida) qaysi bo'limdan ochilgani (audit 29.10)
let qTab = 'ochiq';
let statTur = 'oy';      // Hisobot: hafta (7 kun) | oy | yil
let statKalit = {};      // har tur uchun tanlangan davr kaliti
let statSol = {};        // har tur uchun solishtiriladigan davr kaliti (yo'q — oldingi davr)
let statFilial = 'hammasi';
let oqimDavr = 'oy';  // Kirim va chiqim: bugun | hafta | oy | otgan
let daftarSoni = 30;   // Daftarda nechta yozuv ko'rinadi ("Yana ko'rsatish" ko'paytiradi)
let daftarKun = null;  // Daftarda ko'rilayotgan kun ('YYYY-MM-DD'; null — bugun)
let ochXodim = null;   // 07.11 tun: global qidiruvdan tanlangan xodim — Sozlamalar chizilgach uning oynasi ochiladi

const HAM = { kassa: 'Seyf', uy: 'Uy', bank: 'Bank' };
const NAQD = [['kassa', 'Seyf'], ['uy', 'Uy']];
const SMENA_NOMI = { kunduzgi: 'kunduzgi', tungi: 'tungi', kunlik: 'kunlik' };
// Belgi rangi: kirim — yashil, chiqim (xarajat, to'lov) — qizil (27.10); ko'chirish va karta — neytral.
const TUR = { xarajat: ['Xarajat', 'chiqim'], kirim: ['Kirim', 'kirim'], kochirish: ['Ko\'chirish', ''], tolov: ['To\'lov', 'chiqim'], qabul: ['Qabul', 'kirim'],
  filialdanPul: ['Filialdan', 'kirim'], olindi: ['Qutidan olindi', 'ok'], pos: ['Karta → bank', ''], tuzatish: ['Bekor qilish', ''] };
const TEG_RANG = { chiqim: 'background:var(--chiqim-bg);color:var(--chiqim)', kirim: 'background:var(--kirim-bg);color:var(--kirim)',
  ok: 'background:var(--soft);color:var(--accent)', warn: 'background:var(--warn-bg);color:var(--warn)' };
// Bekor qilinganda nima bo'ladi — direktor oldindan bilsin.
const BEKOR_IZOH = {
  qabul: 'Pul yana "qabul kutilmoqda" bo\'ladi — keyin to\'g\'ri hamyonga qabul qiling.',
  filialdanPul: 'Pul yana "qabul kutilmoqda" bo\'ladi — keyin to\'g\'ri hamyonga qabul qiling.',
  olindi: 'Smena hisobi qayta hisoblanadi.',
  tolov: 'To\'lov bekor bo\'ladi — ta\'minotchi qarzi va hamyon qaytadi.'
};
// Bekor qilib bo'lmaydiganlar: teskari yozuvning o'zi, karta savdo (smena bilan birga).
const BEKOR_YOQ = new Set(['tuzatish', 'pos']);

// Hamyon qoldig'i faqat hisob.mjs orqali (C3: boshlang'ich + 400 kundan eski yozuvlar (hisobBoshi) + ko'rinib turgan yozuvlar).
const qoldiq = (S, k) => H.qoldiq(S, k);
const yetmaydi = (S, d) => H.yetmaydi(S, d);

// Pul maydoni: bo'sh → boshXabar; noto'g'ri → namuna bilan xabar; to'g'ri → null.
function pulXato(f, boshXabar) {
  const v = String(f.i.value).trim();
  if (!v) return boshXabar;
  return H.pul(v) == null ? 'Raqam noto\'g\'ri — masalan: 1 250 000' : null;
}
// Xatolarni maydon tagiga qo'yadi; birinchi xatoli maydonga fokus. Xato bo'lsa — true.
function xatolar(juftlar) {
  let birinchi = null;
  juftlar.forEach(([f, m]) => { f.xato(m || ''); if (m && !birinchi) birinchi = f; });
  if (birinchi) birinchi.i.focus();
  return !!birinchi;
}
const matnBormi = (f, min = 1) => String(f.i.value).trim().length >= min;

export function renderDirektor(root, ctx) {
  const { S, x } = ctx;
  // 07.11: yangi ko'rinish standart; «Eski ko'rinish» (shu telefonda) — avvalgi panel o'zgarishsiz.
  const yangi = !eskiKorinishmi();
  // Ko'rinish oynasi: Telegram ⋮ → Sozlamalar (SettingsButton) va Xodimlar → «Ko'rinish». Almashganda — bosh sahifaga.
  const korinishOch = (sozlamalar) => korinishOyna({ rerender: ctx.rerender, almashdi: () => { tab = 'bosh'; sub = null; yol = []; qaytish = null; yTab = 'bugun'; }, sozlamalar,
    tanishuv: oddiyRejimmi(x.id) ? null : () => tanishuvOch('direktor') });
  // Oddiy rejim (shu telefonda tanlangan): 4 ta katta tugma. Qaytish — pastdagi "To'liq rejimga o'tish".
  // 29.10: savdoni direktor kiritadi — oddiy rejimda ham (to'liq rejimdagi oyna).
  if (oddiyRejimmi(x.id)) {
    sozlamaTugmasi(() => korinishOch(null));
    korinishQolla(false);
    return renderOddiy(root, { ...ctx, ekranTugmasi, savdoKirit: (o) => savdoSheet(ctx, o), kechaSavdo: (fl, kun) => kechaSavdoSheet(ctx, fl, kun) });
  }
  korinishQolla(yangi);
  const fil = (id) => (S.filiallar.find((f) => f.id === id) || {}).nom || id;
  const ism = (id) => (S.xodimlar.find((z) => z.id === id) || {}).ism || '?';
  const go = (t, s) => {
    // Yangi ko'rinish: har o'tish — yo'lga (orqaga shu tartibda qaytadi); 'bosh' — bo'limning bosh sahifasi (yo'l tozalanadi).
    if (yangi) {
      if (t === 'bosh' && !s) yol = [];
      else if (tab !== t || sub !== (s || null)) yol.push({ tab, sub });
      tab = t; sub = s || null;
      sahifaOtish(() => ctx.rerender(true));   // 07.11 tun: View Transition (qo'llamasa — oddiy chizish)
      return;
    }
    // Smenalar va Ta'minot ro'yxati — qayerdan ochilgan bo'lsa ‹ o'sha yerga (Bosh, Bo'limlar); ichki sahifadan — o'z bo'limiga.
    if ((t === 'smena' || t === 'tamin') && !s && tab !== t) qaytish = sub ? 'more' : tab;
    else if (t !== 'smena' && t !== 'tamin') qaytish = null;
    if (s && tab !== t) qaytish = tab;
    tab = t; sub = s || null; ctx.rerender(true);
  };
  const kassa = qoldiq(S, 'kassa');
  const uy = qoldiq(S, 'uy');
  const bugun = H.kunKey(Date.now());

  const TITLES = SAHIFA_NOM;
  const tObj = tab === 'tamin' && sub ? S.taminotchilar.find((t) => t.id === sub) : null;
  // Yangi ko'rinish: bosh joy (tab 'bosh', sub yo'q) — pastki menyudagi bo'lim; qolgani — ichki sahifa (menyusiz, orqaga bilan).
  const ildiz = yangi && tab === 'bosh' && !sub;
  const korinish = () => korinishOch(() => go('more', 'sozlama'));
  sozlamaTugmasi(korinish);
  const title = ildiz ? Y_NOM[yTab] : tObj ? tObj.nom : TITLES[sub] || TITLES[tab];

  if (ctx.logout) root.append(h('div', { class: 'demo' }, 'Sinov rejimi · ', h('button', { class: 's', onclick: ctx.logout }, 'boshqa xodim')));
  // Yangi ko'rinish: orqaga — kelgan yo'l bo'yicha (retsept punkti / inventar ichida — avval o'sha ichki sahifa yopiladi).
  const yOrqaga = () => {
    if (tab === 'qoldiq' && sub === 'inventar' && inventarOrqaga()) { ctx.rerender(true); return; }
    if (tab === 'retsept' && !sub && retseptIchida()) { retseptBosh(); ctx.rerender(true); return; }
    const p = yol.pop();
    tab = p ? p.tab : 'bosh'; sub = p ? p.sub : null;
    sahifaOtish(() => ctx.rerender(true));
  };
  // Orqaga: ichki sahifadan — o'z bo'limiga; Smenalar va Ta'minot (endi Bo'limlar ichida) — Bo'limlarga.
  const orqaga = yangi ? (ildiz ? null : yOrqaga) : sub ? () => { if (tab === 'qoldiq' && sub === 'inventar' && inventarOrqaga()) { ctx.rerender(true); return; } const q = qaytish; if (tab === 'tamin' || !q) go(tab); else { tab = q; sub = null; qaytish = null; ctx.rerender(true); } }
    : tab === 'smena' || tab === 'tamin' ? () => { const q = qaytish && qaytish !== tab ? qaytish : 'more'; qaytish = null; tab = q; sub = null; ctx.rerender(true); } : null;
  // Audit 06.11: Telegram «orqaga» (Android tugmasi) ham shu — ilova yopilmasin; asosiy bo'limlardan — Bosh'ga.
  if (yangi) orqagaQoy(orqaga || (yTab !== 'bugun' ? () => { yTab = 'bugun'; sahifaOtish(() => ctx.rerender(true)); } : null));
  else {
    orqagaQoy(orqaga || (tab === 'retsept' && retseptIchida() ? () => { retseptBosh(); ctx.rerender(true); }   // qayta audit: punkt ichidan — Retseptlar
      : tab !== 'bosh' ? () => go('bosh') : null));
  }
  // Retsept punkti ichida o'zining «‹ Retseptlar» tugmasi bor — ikkita qaytish chiqmasin (audit 05.11 qoidasi).
  const back = !orqaga ? null : yangi ? (tab === 'retsept' && retseptIchida() ? null : orqagaTugma(orqaga))
    : h('button', { class: 's', 'aria-label': 'Orqaga', style: 'width:44px;flex:none;padding:0;font-size:22px', onclick: orqaga }, '‹');
  // 07.11 tun: yangi ko'rinishda sarlavhada 🔍 — bo'lim, xodim, ta'minotchi yoki dori nomi bilan qidirish (globalQidiruvOyna).
  const qidirTugma = yangi ? h('button', { type: 'button', class: 'yh-qidir', 'aria-label': 'Qidirish: bo\'lim, xodim, ta\'minotchi, dori',
    onclick: () => {
      const bolim = (k) => { tab = 'bosh'; sub = null; yol = []; yTab = k; sahifaOtish(() => ctx.rerender(true)); };
      globalQidiruvOyna(S, {
        sahifalar: sahifaKatalog(ctx, go, bolim),
        xodim: (z) => { ochXodim = z.id; ochiqQoy('soz-Xodimlar'); go('more', 'sozlama'); },
        taminotchi: (t) => go('tamin', t.id),
        dori: (soz) => { if (!ctx.server) { go('more', 'prays'); return; } osonQidiruvQoy(soz); bolim('ombor'); }
      });
    } }, ikon('qidir')) : null;
  root.append(h('header', { class: 'top' + (yangi ? ' yh' : '') }, back || h('span', { class: 'avatar', 'aria-hidden': 'true' }, 'D'),
    h('div', { class: 't' }, h('h1', {}, title), h('span', {}, kunNomi() + ' · Direktor')),
    qidirTugma, yozuvTugma(ctx.rerender, x.id)));
  const m = h('main', { class: yangi ? (ildiz ? 'y-ildiz' : 'y-ichki') : null });
  root.append(m);

  // ---------- Umumiy bloklar ----------
  const qabulKartalari = () => S.smenalar.filter((z) => z.qabul && z.qabul.holat === 'kutilmoqda' && !z.bekor).map((z) => {
    const f = H.farq(z);
    return h('div', { class: 'card warn' },
      kartaSarlavha(ism(z.xodimId) + ' (' + fil(z.filialId) + ') ' + H.som(z.qabul.summa) + ' topshirdi'),
      h('div', {}, 'Smena ' + sana(z.yopildi) + ' ' + vaqt(z.yopildi) + ' da yopilgan · ' + (f === 0 ? 'kassa mos ✓' : (f < 0 ? 'kamomad ' : 'ortiqcha ') + H.som(Math.abs(f)))),
      z.tasdiq ? null : h('div', {}, 'Savdo: naqd ' + H.som(z.naqd) + ', karta ' + H.som(z.karta) + ' — pulni olsangiz, savdo ham tasdiqlanadi'),
      h('button', { class: 'p s', style: 'align-self:flex-start', onclick: () => qabulSheet(ctx, z, ism(z.xodimId)) }, 'Qabul qilish'),
      UY_PULI ? yordam('Savdo puli doim seyfga tushadi. Uyga olib ketsangiz — Daftar → "+ Yozuv qo\'shish" → "Pul ko\'chirish" (Seyf → Uy). Xato bosilsa — Daftarda shu yozuvni bosib bekor qilasiz.', 'Uyga olib ketsam-chi?')
        : h('div', { class: 'muted', style: 'font-size:13px' }, 'Pul seyfga qo\'shiladi. Xato bosilsa — Daftarda shu yozuvni bosib bekor qilasiz.'));
  });
  const tasdiqKartalari = () => S.smenalar.filter((z) => H.tasdiqKutadi(z) && !(z.qabul && z.qabul.holat === 'kutilmoqda')).map((z) => {
    const f = H.farq(z);
    const jami = (z.naqd || 0) + (z.karta || 0);
    const nomi = fil(z.filialId) + ' · ' + ism(z.xodimId) + ' (' + (SMENA_NOMI[z.nom] || z.nom) + ')';
    return h('div', { class: 'card warn' },
      kartaSarlavha(nomi + ' savdosi — tasdiqlang'),
      h('div', {}, 'Naqd ' + H.som(z.naqd) + ' · karta ' + H.som(z.karta) + ' · jami ', h('b', {}, H.som(jami))),
      h('div', { class: 'muted' }, sana(z.yopildi) + ' ' + vaqt(z.yopildi) + ' da yopilgan · ' + (f === 0 ? 'kassa mos ✓' : (f < 0 ? 'kamomad ' : 'ortiqcha ') + H.som(Math.abs(f)))),
      h('button', { class: 'p s', style: 'align-self:flex-start', onclick: () => tasdiqlash(nomi + ' savdosi: naqd ' + H.som(z.naqd) + ', karta ' + H.som(z.karta) + ' — jami ' + H.som(jami) + '. Savdoga yozilsinmi?')
        .then((ha) => ha && ctx.amal('savdoTasdiq', z.id).then((ok) => ok && ctx.toast('Savdoga yozildi ✓'))) }, 'Tasdiqlash'));
  });
  const ruxsatKartalari = () => S.qarzlar.filter((q) => q.holat === 'ruxsat').map((q) => h('div', { class: 'card warn' },
    kartaSarlavha(ism(q.xodimId) + ' qarz bermoqchi — ruxsatingiz kerak'),
    h('div', {}, h('span', { 'data-asl': '' }, q.ism), ' · ' + q.tel + ' · ' + q.muddatKun + ' kunga'),
    h('div', {}, 'So\'ralgan: ', h('b', {}, H.som(q.summa)), ' (limit: bitta mijozga ' + H.som(S.sozlama.limitMijoz) + ')'),
    h('div', { class: 'row' }, h('button', { class: 'p s', onclick: () => ctx.amal('qarzRuxsat', q.id, true).then((ok) => ok && ctx.toast('Ruxsat berildi ✓')) }, 'Ruxsat berish'),
      h('button', { class: 's', onclick: () => tasdiqlash(q.ism + ' ga ' + H.som(q.summa) + ' qarz rad etilsinmi?').then((ha) => ha && ctx.amal('qarzRuxsat', q.id, false)) }, 'Rad etish'))));
  // ---------- Bosh (eski ko'rinish) ----------
  // 07.11: bo'laklar modul darajasiga ajratildi (yangi ko'rinish ham ishlatadi) — tartib, hisob va matn o'zgarmagan.
  if (tab === 'bosh' && !yangi) {
    const bl = boshlashKarta(ctx, go);
    if (bl) m.append(bl);
    const ko = kalitOgoh(S);
    if (ko) m.append(ko);
    // «Bilimdon» o'yini ketayotgan bo'lsa — kuzatishga qaytish kartasi.
    if (ctx.server) { const ob = oyinBanner(ctx.retseptCtx(), () => go('more', 'oyin')); if (ob) m.prepend(ob); }
    // Dizayn A (29.10, foydalanuvchi tanladi): seyf — katta raqam; ostida 4 ta tez tugma; «Bajarish kerak» — har ish bitta
    // qatorda, o'z tugmasi bilan; bugun kirdi/chiqdi — ikki plitka (bosilsa ro'yxati). Hisob o'zgarmagan (H.kunSeyf).
    m.append(seyfHero(ctx, go, bugun));
    // 29.10: xodimlar smena ochmaydi va pul topshirmaydi — «Pul qabuli» o'rniga «Davomat» (eski kutayotgan qabul «Bajarish kerak»da).
    m.append(tezTugmalar([
      ['odam', 'Davomat', 'info', () => go('more', 'davomat')],
      ['qosh', 'Savdo', '', () => savdoSheet(ctx)],
      ['chiqim', 'Pul chiqdi', 'chiqim', () => (UY_PULI ? yozuvSheet(ctx, { soha: 'apteka' }) : pulChiqdiSheet(ctx))],
      ['tamin', 'Ta\'minot', '', () => go('tamin')]]));
    // Bajarish kerak: pul qabuli, savdo tasdig'i, qarz ruxsati, ta'minotchi yozuvi, buyurtma kutayotgan dori.
    const ishlar = boshIshlar(ctx, go, bugun).map((i) => ishQator(i));
    m.append(h('div', { class: 'bolim-bosh' }, h('h2', {}, 'Bajarish kerak'), h('span', { class: 'muted' }, ishlar.length ? ishlar.length + ' ta' : '')));
    m.append(ishlar.length ? h('div', { class: 'card ishlar' }, ...ishlar) : h('div', { class: 'card muted' }, '✓ Hozircha bajariladigan ish yo\'q'));
    m.append(seyfPlitkalar(ctx, go, bugun));
    m.append(taKarta(ctx, go));
    m.append(savdoKarta(ctx, go, bugun));
    const by = bugungiYozuvlar(ctx, bugun);
    if (by) m.append(by);
    m.append(qarzKarta(ctx, go));
  }

  // ---------- Yangi ko'rinish: pastki menyudagi 4 bo'lim (07.11, variant A) ----------
  if (ildiz) {
    if (yTab === 'bugun') bugunView(m, ctx, go, bugun);
    if (yTab === 'pul') pulBolim(m, ctx, go, bugun);
    if (yTab === 'ombor') omborBolim(m, ctx, go, fil);
    if (yTab === 'xodimlar') xodimlarBolim(m, ctx, go, korinish);
  }
  if (sub === 'hamyon') hamyonView(m, ctx, go, bugun);

  // ---------- Daftar ----------
  if (tab === 'daftar') {
    // Kun daftari (26.10, "B" ko'rinish — qog'oz daftari kabi): kirim — har smena savdosi (kim, naqd, karta),
    // chiqim — har biri alohida (bankka, ta'minotchi, oylik, xarajat). Hisob — H.kunDaftari. ‹ › bilan oldingi kunlar.
    const kun = daftarKun && daftarKun < bugun ? daftarKun : bugun;
    const kunSilji = (n) => { const k = H.kunQosh(kun, n); daftarKun = k < bugun ? k : null; ctx.rerender(); };
    const D = H.kunDaftari(S, kun);
    m.append(h('div', { class: 'kun-nav' },
      h('button', { class: 's', 'aria-label': 'Oldingi kun', onclick: () => kunSilji(-1) }, '‹'),
      h('b', {}, kun === bugun ? 'Bugun' : kunNomi(new Date(Date.parse(kun) + 6 * 3600e3))),
      h('button', { class: 's', 'aria-label': 'Keyingi kun', style: kun === bugun ? 'visibility:hidden' : '', onclick: () => kunSilji(1) }, '›')));
    const SMENA_QISQA = { kunduzgi: ' kun', tungi: ' tun' };
    const dq = (chap, ong, past) => h('div', { class: 'dq' }, h('div', { class: 'dq-q' }, h('span', {}, chap), h('b', {}, ong)),
      past ? h('div', { class: 'dq-past' }, past) : null);
    const kirimK = h('div', { class: 'card daftar-k kirim' }, h('h3', { class: 'dk-kirim' }, '▲ Kirim · savdo'));
    D.kirim.forEach((q) => kirimK.append(dq(q.filial + (SMENA_QISQA[q.smena] || '') + (q.xodim ? ' · ' + q.xodim : ''), H.som(q.naqd),
      [q.karta ? 'karta ' + H.som(q.karta) : null, q.tasdiq ? null : 'tasdiqlanmagan — jamiga kirmagan'].filter(Boolean).join(' · ') || null)));
    D.boshqaKirim.forEach((q) => kirimK.append(dq(q.nom, H.som(q.summa), 'savdodan tashqari')));
    if (!D.kirim.length && !D.boshqaKirim.length) kirimK.append(h('div', { class: 'muted' }, 'Bu kunda savdo yozilmagan'));
    const chiqimK = h('div', { class: 'card daftar-k chiqim' }, h('h3', { class: 'dk-chiqim' }, '▼ Chiqim'));
    D.chiqim.forEach((q) => chiqimK.append(dq(q.nom, H.som(q.summa))));
    if (!D.chiqim.length) chiqimK.append(h('div', { class: 'muted' }, 'Chiqim yo\'q'));
    m.append(kirimK, chiqimK,
      h('div', { class: 'dk-jami' },
        h('div', { class: 'dk-j kirim' }, h('span', {}, 'Naqd kirim'), h('b', {}, H.som(D.naqd + D.boshqaKirimJami))),
        h('div', { class: 'dk-j chiqim' }, h('span', {}, 'Chiqim'), h('b', {}, H.som(D.chiqimJami)))),
      h('div', { class: 'muted', style: 'text-align:center' }, [D.karta ? 'Karta savdo: ' + H.som(D.karta) : null,
        kun === bugun ? 'Seyfda hozir: ' + H.som(kassa) : null].filter(Boolean).join(' · ')));
    if (UY_PULI) m.append(h('button', { class: 'p', onclick: () => yozuvSheet(ctx, { soha: 'apteka' }) }, '+ Yozuv qo\'shish'));
    else {
      // Pul chiqishi — faqat 4 tur (oylik, ta'minotchi, bank, uy); kirim — alohida, kichik tugma.
      m.append(h('button', { class: 'p', onclick: () => pulChiqdiSheet(ctx) }, '− Seyfdan pul chiqdi'));
      m.append(h('button', { onclick: () => yozuvSheet(ctx, { soha: 'apteka', tur: 'kirim' }) }, '+ Kirim (savdodan tashqari)'));
    }
    m.append(UY_PULI
      ? h('button', { onclick: () => sheet('Pulni sanash', (box, close) => box.append(
        h('div', { class: 'muted' }, 'Qaysi pulni sanadingiz? Haqiqiy summani yozasiz — farqni dastur o\'zi daftarga yozadi.'),
        h('button', { class: 'p', onclick: () => { close(); sanashSheet(ctx, 'kassa'); } }, 'Seyfdagi pul'),
        h('button', { onclick: () => { close(); sanashSheet(ctx, 'uy'); } }, 'Uydagi pul'))) }, 'Pulni sanash')
      : h('button', { onclick: () => sanashSheet(ctx, 'kassa') }, 'Seyfdagi pulni sanash'));
    m.append(yordam((UY_PULI ? '"+ Yozuv qo\'shish" — xarajat, kirim yoki pul ko\'chirish (masalan Seyf → Uy). '
      : '"Seyfdan pul chiqdi" — oylik, ta\'minotchiga to\'lov, bankka topshirish yoki uyga olib ketish (uyda qancha pul borligi hisoblanmaydi). '
        + 'Mayda xarajat (suv, paket) — «Pul chiqdi» → «Xarajat». ') + 'Savdo bu yerga yozilmaydi: har kunlik savdoni '
      + 'Bosh → «Savdo» (yoki Bo\'limlar → Savdo → «+ Savdo kiritish») bilan kiritasiz. Xato yozuvni bosing va "Bekor qilish" ni tanlang: o\'chirilmaydi, tarix saqlanadi. '
      + 'Daftarda oxirgi 13 oy ko\'rinadi; eskilari seyf va uy qoldig\'ida turibdi.'));
    // Yozuvlar kun bo'yicha; qatorni bosganda tafsilot va "Bekor qilish". Faqat apteka yozuvlari (uy — Bo'limlar → Uy puli).
    const list = h('div', { class: 'card list' }, kartaSarlavha('Yozuvlar'));
    const hammasi = S.harakatlar.filter((r) => !H.uyYozuvi(r, S)).reverse();
    const rec = hammasi.slice(0, daftarSoni);
    if (!rec.length) list.append(h('div', { class: 'muted' }, 'Hozircha yozuv yo\'q'));
    const kunNom = (ts) => { const k = H.kunKey(ts); return k === bugun ? 'Bugun' : k === H.kunKey(Date.now() - 864e5) ? 'Kecha' : sana(ts); };
    let oldingiKun = null;
    rec.forEach((r) => {
      const kn = kunNom(r.ts);
      if (kn !== oldingiKun) { list.append(h('div', { class: 'kun-s' }, kn)); oldingiKun = kn; }
      // Uy puli yashirin bo'lsa: ko'chirish nomi — "Uyga" / "Bankka", summada uy tomoni ko'rsatilmaydi.
      const [lbl, cls] = !UY_PULI && r.tur === 'kochirish' && r.d ? (r.d.uy > 0 ? ['Uyga olib ketildi', ''] : r.d.bank > 0 ? ['Bankka', ''] : TUR.kochirish) : TUR[r.tur] || [r.tur, ''];
      const amt = Object.entries(r.d || {}).filter(([k, v]) => v && (UY_PULI || k !== 'uy')).map(([k, v]) => HAM[k] + ' ' + (v > 0 ? '+' : '') + H.som(v)).join(', ') || (r.summa ? H.som(r.summa) + ' (smena kassasidan)' : '');
      list.append(h('button', { type: 'button', class: 'yozuv', onclick: () => yozuvTafsilot(ctx, r, lbl, amt) },
        h('div', { class: 'line', style: 'border:0;padding:0' }, h('span', { style: r.bekor ? 'text-decoration:line-through' : '' }, r.izoh || lbl),
          h('span', { class: 'muted' }, vaqt(r.ts))),
        h('div', { class: 'line', style: 'border:0;padding:0' }, h('span', { class: 'tag', style: r.bekor ? '' : TEG_RANG[cls] || '' }, r.bekor ? 'Bekor qilingan' : lbl),
          amt ? h('b', { style: 'font-size:14px' }, amt) : null)));
    });
    if (hammasi.length > rec.length) list.append(h('button', { class: 's', onclick: () => { daftarSoni += 40; ctx.rerender(); } }, 'Yana ko\'rsatish (' + (hammasi.length - rec.length) + ' ta)'));
    m.append(list);
  }

  // ---------- Smenalar ----------
  if (tab === 'smena') {
    m.append(h('button', { class: 'p', onclick: () => savdoSheet(ctx) }, '+ Savdo kiritish'));
    const ishlar = [...qabulKartalari(), ...tasdiqKartalari()];
    if (ishlar.length) m.append(h('h2', { class: 'bolim-s' }, 'Kutayotganlar', h('span', { class: 'son-belgi' }, String(ishlar.length))), ...ishlar);
    m.append(yordam('Har kunlik savdoni o\'zingiz kiritasiz: filial, kun, naqd va karta (29.10 dan xodimlar smena ochmaydi). Eski smena yozuvlari ham shu yerda. '
      + 'Har smenaning raqamlari va "Savdoni tuzatish" — "Batafsil" ichida.'));
    if (S.smenalar.length) m.append(h('h2', { class: 'bolim-s' }, 'Oxirgi smenalar'));
    S.smenalar.slice().sort((a, b) => b.ochildi - a.ochildi).slice(0, 30).forEach((z) => {
      const nomi = fil(z.filialId) + ' · ' + ism(z.xodimId) + ' · ' + (SMENA_NOMI[z.nom] || z.nom);
      const c = h('div', { class: 'card' }, h('div', { class: 'line', style: 'border:0;padding:0;align-items:center' }, kartaSarlavha(nomi), smenaTeg(z)),
        h('div', { class: 'muted' }, sana(z.ochildi) + ' ' + vaqt(z.ochildi) + (z.yopildi ? ' – ' + sana(z.yopildi) + ' ' + vaqt(z.yopildi) : ' — hali ochiq')
          + (z.yopildi ? ' · savdo ' + H.som((z.naqd || 0) + (z.karta || 0)) : '')));
      // Raqamlar va amallar "Batafsil" ichiga yig'iladi (ochiq smenadagi "Kassadan pul olish" — tashqarida).
      const ich = [];
      const d = { append: (...x) => { ich.push(...x); } };
      if (!z.yopildi) c.append(h('button', { class: 's', style: 'align-self:flex-start', onclick: () => sheet('Kassadan pul olish · ' + fil(z.filialId), (box, close) => {
        const sm2 = input('Summa, so\'m');
        box.append(h('div', { class: 'msg info' }, 'Xodim kamomadga chiqmaydi: olgan pulingiz smena hisobidan ayiriladi va seyfga qo\'shiladi.'), sm2.el,
          h('button', { class: 'p', onclick: () => {
            if (xatolar([[sm2, pulXato(sm2, 'Summani yozing')]])) return;
            ctx.amalX(xatoJoyla([[sm2, /summa/i]]), 'smenadanOlish', z.id, sm2.i.value, 'kassa').then((ok) => ok && close());
          } }, 'Saqlash'));
      }) }, 'Kassadan pul olish'));
      if (z.qolda) {
        d.append(h('div', { class: 'grid2' }, h('div', {}, 'Naqd', h('b', {}, H.som(z.naqd))), h('div', {}, 'Karta', h('b', {}, H.som(z.karta)))));
        d.append(h('div', { class: 'muted' }, z.bekor ? 'Bekor qilindi: ' + (z.bekorSabab || '') : z.qabul && z.qabul.holat === 'qabul' ? 'Naqd pul — ' + HAM[z.qabul.hamyon] : 'Pul hamyonga qo\'shilmagan (hisobda bor edi)'));
      } else if (z.yopildi) {
        if (!z.tasdiq && !z.bekor) c.append(h('div', { style: 'color:var(--warn);font-weight:600' }, 'Savdo tasdiqlanmagan — tepadagi "Tasdiqlash" ni bosing'));
        d.append(h('div', { class: 'grid2' }, h('div', {}, 'Boshida', h('b', {}, H.som(z.ochilishPul))), h('div', {}, 'Naqd savdo', h('b', {}, H.som(z.naqd))),
          h('div', {}, 'Karta', h('b', {}, H.som(z.karta))), h('div', {}, 'Xarajat' + (H.olinganJami(z) ? ' / siz olgan' : ''), h('b', {}, H.som(H.xarajatJami(z)) + (H.olinganJami(z) ? ' / ' + H.som(H.olinganJami(z)) : ''))),
          h('div', {}, 'Bo\'lishi kerak', h('b', {}, H.som(H.kutilgan(z)))), h('div', {}, 'Sanalgan', h('b', {}, H.som(z.sanalgan)))));
        d.append(h('div', { class: 'muted' }, 'Kassada qoldi ' + H.som(z.qoldirildi) + (z.qabul && z.qabul.holat !== 'yoq' ? ' · topshirildi ' + H.som(z.qabul.summa) + (z.qabul.holat === 'qabul' ? ' — olindi (' + HAM[z.qabul.hamyon] + ')' : ' — qabul kutilmoqda') : '')));
        if (z.sanalganXodim != null && z.sanalganXodim !== z.sanalgan) {
          d.append(h('div', { style: 'color:var(--warn);font-weight:600' }, 'Xodim ' + H.som(z.sanalganXodim) + ' deb yozgan, qabulda ' + H.som(z.sanalgan) + ' chiqdi (farq ' + H.som(z.sanalgan - z.sanalganXodim) + ')'));
        }
      }
      // Savdo tuzatishlari tarixi (server smena_json → tuzatishlar): kim, qachon, nima uchun.
      (Array.isArray(z.tuzatishlar) ? z.tuzatishlar : []).forEach((t) => d.append(h('div', { class: 'muted' },
        'Tuzatildi ' + (t.ts ? sana(t.ts) + ' ' + vaqt(t.ts) : '') + (t.kim ? ' (' + ism(t.kim) + ')' : '') + ': naqd ' + H.som(t.eskiNaqd) + ' → ' + H.som(t.naqd)
        + ', karta ' + H.som(t.eskiKarta) + ' → ' + H.som(t.karta) + (t.sabab ? ' · ' + t.sabab : ''))));
      if (z.yopildi && !z.bekor) {
        d.append(h('div', { class: 'row' },
          h('button', { class: 's', onclick: () => savdoTuzatishSheet(ctx, z, nomi) }, 'Savdoni tuzatish'),
          // 28.10: xodim yopgan smena ham bekor qilinadi (xato yopilgan bo'lsa — keyin «+ Savdo kiritish» bilan to'g'risi).
          h('button', { class: 's', onclick: () => savdoBekorSheet(ctx, z, nomi) }, 'Bekor qilish')));
      }
      if (ich.length) c.append(ochiladi('Batafsil', ich, { k: 'smena-' + z.id }));
      m.append(c);
    });
    if (!S.smenalar.length) m.append(h('div', { class: 'card muted' }, 'Hali savdo yozuvi yo\'q. «+ Savdo kiritish» bilan kiritganingizda shu yerda ko\'rinadi.'));
  }

  // ---------- Ta'minot ----------
  if (tab === 'tamin' && !tObj) {
    const kutT = S.taminotchilar.reduce((a, t) => a + t.amallar.filter((z) => z.holat === 'ular' && !z.bekor).length, 0);
    m.append(h('div', { class: 'card hero' }, h('span', { class: 'muted' }, 'Biz qarzdormiz, jami'), h('b', { class: 'big' }, H.som(S.taminotchilar.reduce((a, t) => a + H.bizBoyicha(t), 0))),
      h('span', { class: 'muted' }, S.taminotchilar.length + ' ta ta\'minotchi' + (kutT ? ' · ' + kutT + ' ta yozuv tasdiq kutmoqda' : ''))));
    if (!S.taminotchilar.length) m.append(h('div', { class: 'card muted' }, 'Hali ta\'minotchi yo\'q. "+ Ta\'minotchi qo\'shish" bilan qo\'shing va hozirgi qarzimizni yozing.'));
    S.taminotchilar.forEach((t) => {
      // 04.11: sizdan kutilayotgan (ta'minotchi yozgan), e'tirozlar va ta'minotchidan kutilayotgan — alohida.
      const siz = t.amallar.filter((a) => a.holat === 'ular' && !a.bekor).length, et = H.taEtirozlar(t).length;
      const unda = t.amallar.filter((a) => a.holat === 'kutish' && !a.bekor && !a.etiroz).length;
      const qism = [siz ? siz + ' ta tasdiqlang' : '', et ? et + ' ta e\'tiroz' : '', unda ? unda + ' ta uning tasdig\'ida' : ''].filter(Boolean).join(' · ');
      m.append(h('button', { class: 'card', style: 'height:auto;flex-direction:row;align-items:center', onclick: () => go('tamin', t.id) },
        h('span', { class: 'avatar', 'aria-hidden': 'true' }, t.nom[0]),
        h('span', { style: 'flex:1;display:flex;flex-direction:column' }, h('b', { 'data-asl': '' }, t.nom), h('span', { class: 'muted' }, (t.yuridik ? 'Yuridik shaxs' : 'Jismoniy shaxs') + (t.ulangan ? ' · botda' : '') + (qism ? ' · ' + qism : ''))),
        h('b', { style: 'font-variant-numeric:tabular-nums' }, H.som(H.bizBoyicha(t)))));
    });
    m.append(h('button', { onclick: () => sheet('Yangi ta\'minotchi', (box, close) => {
      const nom = input('Nomi', { inputmode: 'text', placeholder: 'Masalan: Bobur aka yoki Meros Pharm' }), q = input('Hozir unga qarzimiz, so\'m (bo\'lmasa — bo\'sh)');
      let yur = false;
      box.append(nom.el, q.el, pills([[false, 'Jismoniy shaxs'], [true, 'Yuridik (bank orqali)']], false, (v) => { yur = v; }, 'Turi'),
        h('button', { class: 'p', onclick: () => {
          if (xatolar([[nom, matnBormi(nom, 2) ? null : 'Ta\'minotchi nomini yozing'], [q, String(q.i.value).trim() ? pulXato(q, null) : null]])) return;
          ctx.amalX(xatoJoyla([[nom, /nom|bunday/i], [q, /qarz|summa/i]]), 'taminotchiQosh', { nom: nom.i.value, boshlangichQarz: q.i.value, yuridik: yur }).then((ok) => ok && close());
        } }, 'Qo\'shish'));
    }) }, '+ Ta\'minotchi qo\'shish'));
  }
  if (tab === 'tamin' && tObj) {
    const t = tObj, f = H.bizBoyicha(t) - H.ularBoyicha(t);
    m.append(t.ulangan
      ? h('div', { class: 'card' }, h('div', { class: 'msg ok' }, 'Botga ulangan: har xarid va to\'lovni ko\'radi va tasdiqlaydi. Pul qaysi hamyondan berilganini ko\'rmaydi.'),
        h('div', { class: 'grid2' }, h('div', {}, 'Biz bo\'yicha', h('b', {}, H.som(H.bizBoyicha(t)))), h('div', {}, 'Ta\'minotchi bo\'yicha', h('b', {}, H.som(H.ularBoyicha(t))))),
        h('div', { class: 'msg ' + (f ? 'warn' : 'ok') }, f ? 'Farq: ' + H.som(Math.abs(f)) : 'Hisob mos ✓'),
        h('div', { class: 'row' }, h('button', { class: 's', onclick: () => taklifSheet(ctx, t, 'taTaklifYarat') }, 'Yangi havola (telefon almashsa)'),
          h('button', { class: 's', onclick: () => tasdiqlash(t.nom + ' ilovadan uzilsinmi? U hisobini ko\'ra olmaydi va tasdiqlay olmaydi, eski havolalar ishlamaydi. Tarix qoladi.')
            .then((ha) => ha && ctx.amal('taminotchiUzish', t.id).then((r) => r !== null && ctx.toast(t.nom + ' ilovadan uzildi'))) }, 'Ilovadan uzish')))
      : h('div', { class: 'card' }, h('span', { class: 'muted' }, 'Qarzimiz'), h('b', { class: 'big' }, H.som(H.bizBoyicha(t))),
        h('div', { class: 'muted' }, 'Ta\'minotchi ham ilovaga ulansa — har xarid va to\'lovni ko\'radi va tasdiqlaydi, o\'zi ham xarid yozadi. Pul qaysi hamyondan berilganini ko\'rmaydi.'),
        h('button', { class: 's', style: 'align-self:flex-start', onclick: () => taklifSheet(ctx, t, 'taTaklifYarat') }, 'Ilovaga ulash (havola)')));
    m.append(h('div', { class: 'row' }, h('button', { onclick: () => xaridSheet(ctx, t) }, '+ Xarid (dori oldik)'),
      h('button', { class: 'p', onclick: () => tolovSheet(ctx, t) }, '+ To\'lov (pul berdik)')));
    const list = h('div', { class: 'card list' }, kartaSarlavha('Tarix'));
    if (t.boshlangichQarz) list.append(h('div', { class: 'item' }, h('div', { class: 'line', style: 'border:0;padding:0' }, h('span', {}, 'Boshlang\'ich qarz'), h('b', {}, H.som(t.boshlangichQarz)))));
    // Har yozuv — bitta qator; bosilsa dori ro'yxati va "Bekor qilish" oynada. Tasdiq kutayotgani — qator tagida tugma.
    // 04.11: e'tiroz yozuv ostida; ta'minotchi yozgan xarid — «Rad etish» (qarzimizga hali kirmagan); bekor — chizilgan, xira emas.
    const etirozQator = (a) => h('div', { class: 'msg warn' }, 'E\'tiroz' + (a.etirozTs ? ' (' + sana(a.etirozTs) + ')' : '') + ': «', h('span', { 'data-asl': '' }, a.etiroz),
      '». Xato bo\'lsa — yozuvni bekor qiling va to\'g\'risini yozing; ta\'minotchi o\'zi ham «To\'g\'ri»ni bosishi mumkin.');
    t.amallar.slice().reverse().forEach((a) => {
      const nima = (a.tur === 'xarid' ? 'Xarid' : 'To\'lov') + (a.qatorlar && a.qatorlar.length ? ' · ' + a.qatorlar.length + ' xil dori' : '');
      const st = t.ulangan || a.holat !== 'ok' || a.etiroz ? H.taHolatDir(a) : null, rad = a.holat === 'ular';
      list.append(h('button', { type: 'button', class: 'yozuv', onclick: () => sheet(nima, (box, close) => {
        box.append(h('div', { class: 'line', style: 'border:0;padding:0' }, h('span', { 'data-asl': '' }, a.izoh), h('b', {}, H.som(a.summa))), h('div', { class: 'muted' }, sana(a.ts)),
          ...(a.qatorlar || []).map((q, i) => h('div', { class: 'line', style: 'font-size:14px' },
            h('span', {}, (i + 1) + '. ', h('span', { 'data-asl': '' }, q.dori)), h('span', { style: 'white-space:nowrap' }, q.soni + ' × ' + H.som(q.narx) + ' = ' + H.som(q.summa)))));
        if (a.bekor) { box.append(h('div', { class: 'msg info' }, 'Bekor qilingan' + (a.bekorSabab ? ': ' + a.bekorSabab : ''))); return; }
        if (a.etiroz) box.append(etirozQator(a));
        if (rad) box.append(h('button', { class: 'p', onclick: () => tasdiqlash(t.nom + ': xarid ' + H.som(a.summa) + ' — to\'g\'rimi? Qarzimizga qo\'shiladi.')
          .then((ha) => ha && ctx.amal('amalTasdiq', t.id, a.id).then((r) => { close(); if (r !== null) ctx.toast('Tasdiqlandi ✓'); })) }, 'To\'g\'ri — tasdiqlash'));
        const sb = input(rad ? 'Rad etish sababi' : 'Bekor qilish sababi', { inputmode: 'text', placeholder: rad ? 'Masalan: bunday dori olmaganmiz' : 'Masalan: ikki marta yozilgan' });
        box.append(h('div', { class: 'msg info' }, (rad ? 'Bu xaridni ta\'minotchi yozgan, hali qarzimizga kirmagan — rad etilsa qarz o\'zgarmaydi.'
          : a.tur === 'tolov' ? BEKOR_IZOH.tolov : 'Xarid bekor bo\'ladi — ta\'minotchiga qarzimiz kamayadi.')
          + (t.ulangan ? ' Ta\'minotchiga «bekor qilindi» xabari boradi, sababi ko\'rinmaydi.' : '')), sb.el,
          h('button', { class: 'ogoh', onclick: () => {
            if (xatolar([[sb, matnBormi(sb) ? null : 'Sababini yozing']])) return;
            ctx.amalX(xatoJoyla([[sb, /sabab/i]]), 'amalBekor', t.id, a.id, sb.i.value).then((r) => r !== null && close());
          } }, rad ? 'Rad etish' : 'Bekor qilish'));
      }, { fokus: false }) },
      h('div', { class: 'line', style: 'border:0;padding:0' }, h('span', { style: a.bekor ? 'text-decoration:line-through' : '' }, (a.tur === 'xarid' ? 'Xarid · ' : 'To\'lov · '), h('span', { 'data-asl': '' }, a.izoh)),
        h('b', { style: a.bekor ? 'text-decoration:line-through' : '' }, (a.tur === 'xarid' ? '+' : '−') + H.som(a.summa))),
      h('div', { class: 'muted' }, sana(a.ts), a.bekor ? ' · bekor qilingan' : st ? [' · ', h('span', { style: 'color:' + st[1] + ';font-weight:600' }, st[0])] : null,
        a.qatorlar && a.qatorlar.length ? ' · ' + a.qatorlar.length + ' xil dori' : null)));
      if (a.etiroz && !a.bekor && a.holat === 'kutish') list.append(etirozQator(a));
      if (!a.bekor && rad) list.append(h('button', { class: 'p s', style: 'align-self:flex-start;margin-bottom:8px', onclick: () => tasdiqlash(t.nom + ': xarid ' + H.som(a.summa) + ' — to\'g\'rimi? Qarzimizga qo\'shiladi.')
        .then((ha) => ha && ctx.amal('amalTasdiq', t.id, a.id).then((r) => r !== null && ctx.toast('Tasdiqlandi ✓'))) }, 'To\'g\'ri — tasdiqlash'));
    });
    if (!t.amallar.length && !t.boshlangichQarz) list.append(h('div', { class: 'muted' }, 'Hali yozuv yo\'q. Dori olganda — "+ Xarid", pul berganda — "+ To\'lov".'));
    m.append(list);
  }

  // ---------- Bo'limlar ----------
  if (tab === 'more' && !sub) {
    const ochiqQ = S.qarzlar.filter((q) => q.holat === 'ochiq'), otgan = ochiqQ.filter((q) => H.muddatiOtgan(q)).length;
    const defG = H.defekturaGuruh(S.defektura || []);
    const defOchiq = defG.filter((g) => g.holat === 'yangi').length, defBuyurtma = defG.filter((g) => g.holat === 'buyurtma').length;
    // Guruhlangan ro'yxat: har guruhda 3 tadan ko'p emas; diqqat talab qilgani sariq izoh bilan.
    const q = (k, l, n, diqqat) => ({ l, n, diqqat, onclick: () => go('more', k) });
    m.append(...guruhlar([
      { nom: 'Xodimlar', qatorlar: [{ l: 'Davomat', n: 'Keldi / kelmadi — har kuni', onclick: () => go('more', 'davomat') },
        { l: 'Funksiyalar', n: ochiqSoni(S) ? ochiqSoni(S) + ' ta o\'chirilgan' : 'Xodim va mijoz imkoniyatlari', onclick: () => go('more', 'funksiyalar') },
        { l: 'O\'zgarishlar tarixi', n: 'Kim, qachon, nimani o\'zgartirdi', onclick: () => go('more', 'audit') }] },
      { nom: 'Pul', qatorlar: [{ l: 'Savdo', n: 'Har kunlik savdoni kiritish, tarix', onclick: () => go('smena') },
        { l: 'Ta\'minotchilar', n: H.som(S.taminotchilar.reduce((a, t) => a + H.bizBoyicha(t), 0)) + ' qarzimiz', onclick: () => go('tamin') },
        UY_PULI ? q('uy', 'Uy puli', H.som(uy)) : null, q('qarz', 'Mijozlar qarzi', otgan ? otgan + ' tasi muddati o\'tgan' : H.som(ochiqQ.reduce((a, z) => a + H.qarzQoldiq(z), 0)), otgan > 0),
        q('oylik', 'Oyliklar', 'Avans, oy oxiri')] },
      // 03.11 (foydalanuvchi: "buyurtma berilganlar va kerak — 2 ta bo'lim"): Defektura ichidagi ikki bo'limga to'g'ridan-to'g'ri.
      { nom: 'Dorilar', qatorlar: [{ l: 'Defektura — Kerak', n: defOchiq ? defOchiq + ' ta dori kerak' : 'Kam qolgan dorilar', diqqat: defOchiq > 0,
        onclick: () => { DEF_TAB.v = 'kerak'; go('more', 'defektura'); } },
        { l: 'Buyurtma berilganlar', n: defBuyurtma ? defBuyurtma + ' ta dori kelishi kutilmoqda' : 'Hozir yo\'q', onclick: () => { DEF_TAB.v = 'buyurtma'; go('more', 'defektura'); } },
        q('prays', 'Prays-list', S.prays && S.prays.soni ? S.prays.soni + ' ta dori' : 'Narxlarni qidirish'),
        ctx.server ? q('firmalar', 'Firma prayslari', 'Qaysi firmada arzon — defektura uchun') : null,
        ctx.server ? { l: 'Hisobdan chiqarilganlar', n: 'Muddati o\'tgan, singan, firmaga qaytarilgan', onclick: () => go('qoldiq', 'chiqarish') } : null,
        q('shtrix', 'Shtrix-kodlar', (S.shtrixlar || []).length ? (S.shtrixlar || []).length + ' ta · shprits, sistema…' : 'Shprits, sistema — xodimlar skanerga tutadi')] },
      // Reimbursatsiya alohida guruh: punktlarni qo'shish/ulash va ular yuborgan retseptlar.
      { nom: 'Reimbursatsiya', qatorlar: [q('punktlar', 'Punktlar', 'Qo\'shish, botga ulash havolasi'), { l: 'Retseptlar', n: 'Punktlar yuborgan ro\'yxatlar, qadoqlash', onclick: () => { retseptBosh(); go('retsept'); } }] },
      { nom: 'Hisobot', qatorlar: [q('oqim', 'Kirim va chiqim', 'Doira diagramma: savdo va chiqimlar'), q('stat', 'Statistika', 'Oyma-oy, filiallar'), q('xulosa', 'Kechki xulosa va ertalabki hisobot', S.sozlama.xulosaVaqti + ' da Telegram\'ga' + (ctx.server ? ' · ertalab — kechagi savdo' : '')),
        q('xabar', 'Bot xabarlari', S.xabarlar.length + ' ta')] },
      // «Bilimdon» o'yini (29.10): direktor ochadi va kuzatadi, xodimlar o'z panelida javob beradi.
      { nom: 'O\'yin', qatorlar: [{ l: '🎮 Bilimdon', n: 'Jonli test o\'yini, reyting', onclick: () => go('more', 'oyin') }] },
      { nom: 'Boshqa', qatorlar: [q('sozlama', 'Sozlamalar', 'Filiallar, xodimlar, limitlar'),
        { l: 'Oddiy rejim', n: '4 ta katta tugma, kam narsa', onclick: () => { rejimQoy(x.id, true); ctx.rerender(true); } },
        // 07.11: eski ko'rinishdan yangisiga qaytish (Telegram ⋮ → Sozlamalar ham shu oynani ochadi).
        { l: 'Ko\'rinish', n: 'Yangi ko\'rinishga qaytish, harf o\'lchami', onclick: korinish }] }
    ], { plitka: true }));
  }

  if (sub === 'qarz') {
    const qol = (q) => H.qarzQoldiq(q);
    const ochiq = S.qarzlar.filter((q) => q.holat === 'ochiq');
    m.append(h('div', { class: 'grid2' }, h('div', { class: 'card' }, h('span', { class: 'muted' }, 'Ochiq qarz'), h('b', {}, H.som(ochiq.reduce((a, q) => a + qol(q), 0)))),
      h('div', { class: 'card warn' }, h('span', {}, 'Muddati o\'tgan'), h('b', {}, H.som(ochiq.filter((q) => H.muddatiOtgan(q)).reduce((a, q) => a + qol(q), 0))))));
    ruxsatKartalari().forEach((c) => m.append(c));
    const w = h('div', { class: 'card list' }, kartaSarlavha('Xodimlar bo\'yicha (bitta xodimga limit ' + H.som(S.sozlama.limitXodim) + ')'));
    S.xodimlar.filter((z) => z.rol === 'sotuvchi' && z.faol !== false).forEach((z) => {
      const r = S.qarzlar.filter((q) => q.xodimId === z.id && (q.holat === 'ochiq' || q.holat === 'undirildi'));
      const qo = r.filter((q) => q.holat === 'ochiq').reduce((a, q) => a + qol(q), 0), ot = r.filter((q) => q.holat === 'ochiq' && H.muddatiOtgan(q)).length;
      const pct = S.sozlama.limitXodim > 0 ? Math.min(100, Math.round(qo / S.sozlama.limitXodim * 100)) : 0;
      w.append(h('div', { class: 'item' }, h('div', { class: 'line', style: 'border:0;padding:0' }, h('b', {}, z.ism), h('span', {}, H.som(qo) + ' qoldi')),
        h('div', { class: 'muted' }, 'Berdi ' + H.som(r.reduce((a, q) => a + q.summa, 0)) + ' · undirildi ' + H.som(r.reduce((a, q) => a + q.summa - qol(q), 0)) + ' · ' + (ot ? ot + ' tasi muddati o\'tgan' : 'muddati o\'tgan yo\'q')),
        h('div', { class: 'bar' + (pct > 80 ? ' over' : ''), role: 'progressbar', 'aria-valuenow': String(pct), 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-label': z.ism + ': limitdan foydalanish' }, h('i', { style: 'width:' + pct + '%' }))));
    });
    m.append(w);
    m.append(pills([['ochiq', 'Ochiq · ' + ochiq.length], ['undirildi', 'Yopilgan · ' + S.qarzlar.filter((q) => q.holat === 'undirildi').length]], qTab,
      (v) => { qTab = v; ctx.rerender(); }, 'Qaysi qarzlar'));
    const l = h('div', { class: 'card list' });
    S.qarzlar.filter((q) => q.holat === qTab).forEach((q) => {
      const otgan = q.holat === 'ochiq' && H.muddatiOtgan(q), kun = Math.ceil((H.muddatKuni(q) - Date.now()) / 864e5);
      const it = h('div', { class: 'item' }, h('div', { class: 'line', style: 'border:0;padding:0' }, h('b', { 'data-asl': '' }, q.ism), h('b', {}, H.som(q.holat === 'ochiq' ? qol(q) : q.summa))),
        h('div', { class: 'muted' }, q.tel + ' · ' + ism(q.xodimId) + ' · ' + fil(q.filialId)),
        h('div', { class: 'muted', style: otgan ? 'color:var(--warn);font-weight:600' : '' }, q.holat === 'undirildi' ? 'To\'liq qaytarildi ✓' : otgan ? 'Muddati ' + Math.abs(kun) + ' kun o\'tdi' : 'Qaytarishga ' + kun + ' kun'));
      if (q.tolovlar.length) it.append(h('div', { class: 'muted' }, 'To\'lovlar: ' + q.tolovlar.map((t) => H.som(t.summa) + ' (' + sana(t.ts) + ', ' + HAM[t.hamyon] + ')').join(', ')));
      if (q.holat === 'ochiq') it.append(h('button', { class: 'p s', style: 'align-self:flex-start', onclick: () => sheet('Pul qaytdi: ' + q.ism, (box, close) => {
        const s = input('Qancha olib keldi (qoldiq ' + H.som(qol(q)) + ')', { value: String(qol(q)) });
        let ham = UY_PULI ? 'uy' : 'kassa';
        const hamG = pills([['uy', 'Uy'], ['kassa', 'Seyf']], ham, (v) => { ham = v; }, 'Hamyon');
        const hamX = guruhXato(hamG);
        box.append(s.el, UY_PULI ? h('b', {}, 'Pulni qayerga qo\'yasiz?') : h('div', { class: 'muted' }, 'Pul seyfga qo\'shiladi.'), UY_PULI ? hamG : null, hamX.el,
          h('div', { class: 'msg info' }, ism(q.xodimId) + ' olib keldi. Kamroq yozsangiz — qisman, qolgani ochiq qoladi.'),
          h('button', { class: 'p', onclick: () => {
            const v = H.pul(s.i.value);
            if (xatolar([[s, pulXato(s, 'Summani yozing') || (v <= 0 ? 'Summani yozing' : v > qol(q) ? 'Qoldiq ' + H.som(qol(q)) + ' — undan ko\'p yozib bo\'lmaydi' : null)]])) return;
            ctx.amalX(xatoJoyla([[s, /summa|qoldiq/i], [hamX, /hamyon/i]]), 'qarzUndirish', q.id, s.i.value, ham).then((ok) => ok && close());
          } }, 'Saqlash'));
      }) }, 'Pul qaytdi…'));
      l.append(it);
    });
    if (!l.children.length) l.append(h('div', { class: 'muted' }, qTab === 'ochiq' ? 'Ochiq qarz yo\'q' : 'Hali yopilgan qarz yo\'q'));
    m.append(l);
  }

  if (sub === 'oylik') {
    const oy = oyKey();
    m.append(h('div', { class: 'muted' }, 'Qoldiq oy oxirida beriladi. Oylikni o\'zgartirish: Sozlamalar → Xodimlar.'));
    S.xodimlar.filter((z) => z.oylik && z.faol !== false).forEach((z) => {
      const av = (z.avanslar || []).filter((a) => a.oy === oy && !a.bekor);
      m.append(h('div', { class: 'card' }, h('div', { class: 'line', style: 'border:0;padding:0;align-items:center' }, kartaSarlavha(z.ism + ' · ' + fil(z.filialId)),
        h('button', { class: 's', style: 'flex:none', onclick: () => sheet('Avans: ' + z.ism, (box, close) => {
          const s = input('Summa, so\'m'); let ham = 'kassa';
          const hamG = pills(NAQD, ham, (v) => { ham = v; }, 'Hamyon');
          const hamX = guruhXato(hamG);
          // Qaysi oy uchun (pul auditi 28.10: oy boshida o'tgan oyning qoldig'i beriladi — "Seyfdan pul chiqdi" bilan bir xil standart).
          const otgan = H.oyQosh(oy, -1);
          let avOy = Number(H.kunKey(Date.now()).slice(8, 10)) <= 10 ? otgan : oy;
          const qoldiqMatn = h('div', { class: 'muted' });
          const yangila = () => { qoldiqMatn.textContent = avOy.split('-').reverse().join('.') + ' uchun berish mumkin: ' + H.som(H.oyOxiri(z, avOy)) + (UY_PULI ? '' : ' · pul seyfdan'); };
          const oyG = pills([[otgan, 'O\'tgan oy (' + otgan.split('-').reverse().join('.') + ')'], [oy, 'Shu oy (' + oy.split('-').reverse().join('.') + ')']], avOy, (v) => { avOy = v; yangila(); }, 'Qaysi oy uchun');
          yangila();
          box.append(h('b', {}, 'Qaysi oy uchun?'), oyG, s.el, qoldiqMatn, UY_PULI ? h('b', {}, 'Pul qayerdan?') : null, UY_PULI ? hamG : null, hamX.el,
            h('button', { class: 'p', onclick: () => {
              const v = H.pul(s.i.value);
              const qolgan = H.oyOxiri(z, avOy);
              if (xatolar([[s, pulXato(s, 'Summani yozing') || (v <= 0 ? 'Summani yozing' : v > qolgan ? 'Avans oylik qoldig\'idan (' + H.som(qolgan) + ') oshmasin' : null)]])) return;
              yetarlimi(ctx.S, { [ham]: -v }).then((ha) => ha && ctx.amalX(xatoJoyla([[s, /summa|avans|oylik/i], [hamX, /hamyon/i]]), 'avansBerish', z.id, s.i.value, ham, avOy).then((ok) => ok && close()));
            } }, 'Saqlash'));
        }) }, '+ Avans')),
        h('div', { class: 'grid2' }, h('div', {}, 'Oylik', h('b', {}, H.som(z.oylik))), h('div', {}, 'Oy oxirida', h('b', {}, H.som(H.oyOxiri(z, oy))))),
        h('div', { class: 'muted' }, av.length ? 'Avanslar: ' + av.map((a) => H.som(a.summa) + ' (' + sana(a.ts) + ')').join(', ') : 'Bu oy avans olinmagan')));
    });
  }

  if (sub === 'stat') statView(m, ctx, fil);

  if (sub === 'xulosa') {
    m.append(h('div', { class: 'muted' }, 'Har kuni ' + S.sozlama.xulosaVaqti + ' da (5 daqiqagacha kechikib) bot sizga shunday xabar yuboradi. Vaqtni Sozlamalarda o\'zgartirasiz.'));
    m.append(h('div', { class: 'card', style: 'white-space:pre-line;font-size:14px' }, H.kunXulosa(S, bugun)));
    // 07.11: ertalabki hisobot (Oson bo'yicha kechagi savdo) — vaqti va hozirgi ko'rinishi.
    if (ctx.server) m.append(ertalabKarta({ ...ctx.retseptCtx(), rerender: ctx.rerender }));
  }

  // 07.11: xodim va mijoz imkoniyatlarini yoqish/o'chirish (funksiya.mjs); o'zgarishlar jurnali (audit.mjs, faqat serverda).
  if (sub === 'funksiyalar') funksiyalarView(m, { S, amal: ctx.amal, server: ctx.server });
  if (sub === 'audit') {
    if (ctx.server) auditView(m, { oqi: ctx.retseptCtx().oqi, rerender: ctx.rerender });
    else m.append(h('div', { class: 'card muted' }, 'O\'zgarishlar tarixi faqat Telegram ilovasida (serverda) ko\'rinadi.'));
  }

  if (sub === 'xabar') {
    m.append(h('div', { class: 'muted' }, 'Bot sizga Telegram\'da yuborgan xabarlar shu yerda ham saqlanadi.'));
    const xb = h('div', { class: 'card list' });
    if (!S.xabarlar.length) xb.append(h('div', { class: 'muted' }, 'Hozircha xabar yo\'q'));
    const BELGI = { ogoh: ['Diqqat', 'var(--warn)'], sorov: ['So\'rov', 'var(--info)'] };
    S.xabarlar.slice().reverse().slice(0, 50).forEach((z) => xb.append(h('div', { class: 'item' },
      BELGI[z.tur] ? h('span', { style: 'font-size:13px;font-weight:700;color:' + BELGI[z.tur][1] }, BELGI[z.tur][0]) : null,
      h('div', { style: 'white-space:pre-line' }, z.matn), h('div', { class: 'muted' }, sana(z.ts) + ' ' + vaqt(z.ts)))));
    m.append(xb);
  }

  if (sub === 'uy' && UY_PULI) uyView(m, ctx, uy);
  if (sub === 'retsept' || (tab === 'retsept' && !sub)) retseptView(m, ctx.retseptCtx());
  // Oson qoldig'i (02.11, foydalanuvchi: "pastdagi bo'limlar qatoriga qo'shib ber; xodimlar defekturasi joyida turaversin") —
  // pastki menyuda alohida bo'lim; «+ Defekturaga» bosilgani Defekturaning «Kerak» ro'yxatiga tushadi.
  if (tab === 'qoldiq' && !sub) {
    // 06.11: tepada «Pul nazorati» va «Aqlli buyurtma» (faqat serverda).
    if (ctx.server) m.append(pulKirish((s) => go('qoldiq', s)));
    const ok = osonKarta(ctx.retseptCtx(), fil, () => ctx.rerender(), { sahifa: true });
    m.append(ok || h('div', { class: 'card muted' }, 'Oson qoldig\'i faqat Telegram ilovasida (serverda) ishlaydi.'));
  }
  if (tab === 'qoldiq' && sub === 'pul') pulView(m, { ...ctx.retseptCtx(), rerender: ctx.rerender }, fil);
  if (tab === 'qoldiq' && sub === 'buyurtma') buyurtmaView(m, { ...ctx.retseptCtx(), rerender: ctx.rerender, firma: ctx.firma }, fil);
  // 07.11: filiallar orasida ko'chirish va inventarizatsiya (faqat serverda).
  if (tab === 'qoldiq' && sub === 'kochirish') kochirishView(m, { ...ctx.retseptCtx(), rerender: ctx.rerender }, fil);
  if (tab === 'qoldiq' && sub === 'inventar') inventarView(m, { ...ctx.retseptCtx(), rerender: ctx.rerender }, fil);
  if (tab === 'qoldiq' && sub === 'narx') narxView(m, { ...ctx.retseptCtx(), rerender: ctx.rerender }, fil);
  if (tab === 'qoldiq' && sub === 'kassa') kassaView(m, { ...ctx.retseptCtx(), rerender: ctx.rerender });
  // 07.11 tun: hisobdan chiqarilganlar va firmaga qaytarilganlar (20261107260000_hisobdan_chiqarish).
  if (tab === 'qoldiq' && sub === 'chiqarish') chiqarishView(m, { ...ctx.retseptCtx(), rerender: ctx.rerender }, fil);
  if (sub === 'punktlar') punktlarView(m, ctx.retseptCtx());
  if (sub === 'defektura') defekturaDirektor(m, ctx, fil, () => go('more', 'firmalar'));
  if (sub === 'firmalar') firmaPrayslarView(m, { ...ctx.retseptCtx(), rerender: ctx.rerender, firma: ctx.firma });
  if (sub === 'prays') m.append(praysQidiruv(ctx));
  if (sub === 'shtrix') shtrixDirektor(m, ctx);
  if (sub === 'sozlama') sozlamaView(m, ctx, x, fil);
  if (sub === 'oqim') oqimView(m, ctx, fil);
  if (sub === 'oyin') oyinView(m, { ...ctx.retseptCtx(), rerender: ctx.rerender });
  if (sub === 'davomat') davomatView(m, ctx.retseptCtx(), S);

  // Yangi ko'rinish (07.11): menyu faqat bo'limlarning bosh sahifasida; ichki sahifada — yo'q (Telegram «orqaga» va ‹).
  if (yangi) {
    if (ildiz) root.append(bolimNav(Y_MENYU, yTab, (k) => { yTab = k; yol = []; sahifaOtish(() => ctx.rerender(true)); }));
    // 07.11 tun: birinchi ochilishda — 3 ta qisqa tanishtiruv ekrani (shu Telegram akkaunti uchun bir marta; Xodimlar → «Qanday ishlatiladi?»).
    tanishuvAvto('direktor');
    return;
  }
  // Dizayn A (29.10): pastda 4 bo'lim (02.11 dan + «Qoldiq» — Oson qoldig'i). Smenalar va Ta'minot — Bo'limlar ichida (va Bosh'dagi tez tugmalarda).
  root.append(nav([['bosh', 'Bosh'], ['daftar', 'Daftar'], ['retsept', 'Retsept'], ['qoldiq', 'Qoldiq'], ['more', 'Bo\'limlar']], tab === 'smena' || tab === 'tamin' ? (qaytish === 'bosh' ? 'bosh' : 'more') : tab, (k) => { if (k === 'retsept') retseptBosh(); go(k); }));
}

// ===================== Bosh sahifa bo'laklari (eski va yangi ko'rinish uchun umumiy) =====================
// 07.11: renderDirektor ichidan ajratildi — hisob, matn va tartib o'zgarmagan (eski ko'rinish aynan avvalgidek).
const rq = (n) => H.som(n).replace(' so\'m', '');
const filNomi = (S, id) => (S.filiallar.find((f) => f.id === id) || {}).nom || id;
const xodimIsmi = (S, id) => (S.xodimlar.find((z) => z.id === id) || {}).ism || '?';

function smenaTeg(z) {
  if (z.bekor) return h('span', { class: 'tag' }, 'Bekor qilingan');
  if (z.qolda) return h('span', { class: 'tag', style: 'background:var(--soft);color:var(--accent)' }, 'Siz kiritdingiz');
  if (!z.yopildi) return h('span', { class: 'tag', style: 'background:var(--info-bg);color:var(--info)' }, 'Ochiq · ' + vaqt(z.ochildi) + (H.ochiqSoat(z) > H.UZOQ_SMENA_SOAT ? ' · uzoq' : ''));
  const f = H.farq(z);
  return h('span', { class: 'tag', style: f < 0 ? 'background:var(--warn-bg);color:var(--warn)' : f > 0 ? 'background:var(--info-bg);color:var(--info)' : 'background:var(--soft);color:var(--accent)' },
    f === 0 ? 'Mos ✓' : (f < 0 ? 'Kamomad ' : 'Ortiqcha ') + H.som(Math.abs(f)));
}

// Ishga tushirish ro'yxati: bajarilgani ✓; hammasi bajarilgach karta yo'qoladi (null).
function boshlashKarta(ctx, go) {
  const { S } = ctx;
  const qadamlar = [
    [!!(S.sozlama.boshlangich.kassa || (UY_PULI && S.sozlama.boshlangich.uy)), UY_PULI ? 'Seyf va uydagi hozirgi pulni kiriting' : 'Seyfdagi hozirgi pulni kiriting', 'more', 'sozlama'],
    [S.xodimlar.some((z) => z.rol === 'sotuvchi' && z.ulangan), 'Xodimlarni qo\'shing va har biriga taklif havolasini yuboring', 'more', 'sozlama'],
    [S.taminotchilar.length > 0, 'Ta\'minotchilarni va ularga qarzimizni kiriting', 'tamin', null]];
  if (!qadamlar.some(([ok]) => !ok)) return null;
  return h('div', { class: 'card' }, h('h2', { class: 'big' }, 'Boshlash'),
    h('div', { class: 'muted' }, 'Tizimni ishga tushirish uchun bir martalik ishlar:'),
    ...qadamlar.map(([ok, matn, t, s], i) => h('button', { class: 'link', style: 'color:var(--ink);text-decoration:none;justify-content:flex-start;gap:8px;text-align:left', onclick: () => go(t, s) },
      h('span', { class: 'qadam' }, h('b', {}, ok ? '✓' : String(i + 1)), h('span', { style: ok ? 'text-decoration:line-through' : 'text-decoration:underline' }, matn)))));
}

// Audit 28.10 №1: kengaytma kaliti olinmaguncha nakladnoy kaliti (kompyuterda faylda) bemorlar ro'yxatini ham ochadi.
const kalitOlinmagan = (S) => { const p = S.prays || {}; return !!(p.kalit && !p.kengaytmaKalit); };
function kalitOgoh(S) {
  if (!kalitOlinmagan(S)) return null;
  return h('div', { class: 'msg warn', role: 'note' }, 'Xavfsizlik: DMED kengaytmasi uchun alohida kalit hali olinmagan. Bo\'limlar → Sozlamalar → '
    + '«Aptekadagi kompyuter» → «Kengaytma kaliti olish», keyin aptekadagi kompyuterda kengaytmaning «Partiyalar» sahifasiga qo\'ying.');
}

// «Seyfda hozir» — katta raqam va bugungi hisob qatori (H.kunSeyf).
// roll (07.11 tun, faqat yangi ko'rinish): summa o'zgarsa eski qiymatdan yangisiga sanaladi (ui.pulSon; oxirgi matn — H.som).
function seyfHero(ctx, go, bugun, roll) {
  const { S } = ctx;
  const sf = H.kunSeyf(S, bugun);
  return h('div', { class: 'card hero' }, h('h2', { class: 'muted', style: 'font-size:15px;font-weight:600' }, 'Seyfda hozir'),
    roll ? pulSon('seyf', qoldiq(S, 'kassa'), { class: 'big' }) : h('b', { class: 'big' }, H.som(qoldiq(S, 'kassa'))),
    h('div', { class: 'seyf-formula' }, sf.kirdi.length || sf.chiqdi.length
      ? rq(sf.boshi) + ' (kecha) + ' + rq(sf.kirdiJami) + ' − ' + rq(sf.chiqdiJami)
      : 'Bugun seyfga pul kirmadi ham, chiqmadi ham'),
    UY_PULI ? h('button', { class: 'hero-qator', onclick: () => go('more', 'uy') }, h('span', {}, 'Uy puli'), h('b', {}, H.som(qoldiq(S, 'uy')) + ' ›')) : null);
}

// «Bajarish kerak» ishlari — ma'lumot (ishQator qabul qiladi): tur — yangi ko'rinishda guruhlash uchun, son — qatordagi son.
// Tartib avvalgidek: davomat va ochiq smenalar tepada, keyin pul qabuli, savdo tasdig'i, qarz ruxsati, ta'minotchi, kechagi savdo, defektura.
function boshIshlar(ctx, go, bugun) {
  const { S } = ctx;
  const fil = (id) => filNomi(S, id), ism = (id) => xodimIsmi(S, id);
  const qabullar = S.smenalar.filter((z) => z.qabul && z.qabul.holat === 'kutilmoqda' && !z.bekor);
  const ishlar = [
    ...qabullar.map((z) => {
      const f = H.farq(z);
      return { tur: 'qabul', icon: 'kirim', rang: 'kirim', sarlavha: ism(z.xodimId) + ' pul topshirdi',
        izoh: fil(z.filialId) + ' · ' + H.som(z.qabul.summa) + ' · ' + (f === 0 ? 'kassa mos ✓' : (f < 0 ? 'kamomad ' : 'ortiqcha ') + H.som(Math.abs(f)))
          + (z.tasdiq ? '' : ' · savdo: naqd ' + H.som(z.naqd) + ', karta ' + H.som(z.karta) + ' — qabul qilsangiz, savdo ham tasdiqlanadi'),
        tugma: ['Qabul', () => qabulSheet(ctx, z, ism(z.xodimId))] };
    }),
    ...S.smenalar.filter((z) => H.tasdiqKutadi(z) && !(z.qabul && z.qabul.holat === 'kutilmoqda')).map((z) => {
      const nomi = fil(z.filialId) + ' · ' + ism(z.xodimId) + ' (' + (SMENA_NOMI[z.nom] || z.nom) + ')';
      const jami = (z.naqd || 0) + (z.karta || 0);
      const f = H.farq(z);
      return { tur: 'tasdiq', icon: 'smena', rang: 'warn', sarlavha: nomi + ' savdosi', izoh: 'naqd ' + H.som(z.naqd) + ' · karta ' + H.som(z.karta) + ' · '
        + sana(z.yopildi) + ' ' + vaqt(z.yopildi) + ' da yopilgan · ' + (f === 0 ? 'kassa mos ✓' : (f < 0 ? 'kamomad ' : 'ortiqcha ') + H.som(Math.abs(f))),
      tugma: ['Tasdiqlash', () => tasdiqlash(nomi + ' savdosi: naqd ' + H.som(z.naqd) + ', karta ' + H.som(z.karta) + ' — jami ' + H.som(jami) + '. Savdoga yozilsinmi?')
        .then((ha) => ha && ctx.amal('savdoTasdiq', z.id).then((ok) => ok && ctx.toast('Savdoga yozildi ✓')))] };
    }),
    ...S.qarzlar.filter((q) => q.holat === 'ruxsat').map((q) => ({ tur: 'ruxsat', icon: 'odam', rang: 'warn', sarlavha: ism(q.xodimId) + ' qarz bermoqchi',
      izoh: q.ism + ' · ' + H.som(q.summa) + ' — ruxsatingiz kerak', tugma: ['Ko\'rish', () => go('more', 'qarz')], asosiy: false })),
    ...S.taminotchilar.map((t) => [t, t.amallar.filter((a) => a.holat === 'ular' && !a.bekor).length]).filter(([, n]) => n)
      .map(([t, n]) => ({ tur: 'taYozdi', icon: 'tamin', rang: 'warn', sarlavha: t.nom + ' yozuv yozdi', izoh: n + ' ta yozuv tasdiqlashingizni kutmoqda', son: n, onclick: () => go('tamin', t.id) })),
    // 04.11: ta'minotchi «Noto'g'ri» degan yozuvlar — ko'rib, xato bo'lsa bekor qilib to'g'risini yozish.
    ...S.taminotchilar.map((t) => [t, H.taEtirozlar(t)]).filter(([, l]) => l.length)
      .map(([t, l]) => ({ tur: 'taEtiroz', icon: 'tamin', rang: 'warn', sarlavha: t.nom + ' e\'tiroz bildirdi', izoh: (l.length > 1 ? l.length + ' ta yozuv · ' : '') + '«' + l[l.length - 1].etiroz + '»', onclick: () => go('tamin', t.id) }))];
  const defYangi = H.defekturaGuruh(S.defektura || []).filter((g) => g.holat === 'yangi').length;
  // 29.10: savdoni direktor kiritadi — kecha savdosi kiritilmagan filial eslatiladi (oxirgi 30 kunda savdosi bo'lgan filiallar).
  // 30.10: filial yopiq bo'lgan bo'lsa — «Savdo bo'lmadi» (kechaSavdoSheet), eslatma yo'qoladi.
  const kecha = H.kunQosh(bugun, -1);
  for (const fl of H.kechaSavdosiz(S, bugun)) {
    ishlar.push({ tur: 'kecha', icon: 'smena', rang: 'warn', sarlavha: 'Kecha ' + fl.nom + ' savdosi kiritilmagan', izoh: 'Bosing — savdoni kiriting yoki «Savdo bo\'lmadi»',
      onclick: () => kechaSavdoSheet(ctx, fl, kecha) });
  }
  const dv = davomatBugun(ctx.retseptCtx());
  // 29.10: eski ilovada ochilgan smena qolgan bo'lsa — uni direktor yopadi (aks holda o'sha filialga savdo kiritib bo'lmaydi).
  S.smenalar.filter((z) => !z.yopildi && !z.qolda).forEach((z) => ishlar.unshift({ tur: 'smenaOchiq', icon: 'smena', rang: 'warn',
    sarlavha: fil(z.filialId) + ' · ' + ism(z.xodimId) + ' smenasi ochiq qolgan', izoh: 'Endi smena kerak emas — yoping, savdoni keyin kiritasiz',
    tugma: ['Yopish', () => ochiqSmenaYop(ctx, z, fil(z.filialId) + ' · ' + ism(z.xodimId))] }));
  if (dv && dv.belgilanmagan) ishlar.unshift({ tur: 'davomat', icon: 'odam', rang: 'info', sarlavha: 'Davomat', izoh: dv.belgilanmagan + ' ta xodim bugun belgilanmagan', son: dv.belgilanmagan, onclick: () => go('more', 'davomat') });
  if (defYangi) ishlar.push({ tur: 'defektura', icon: 'defektura', rang: 'info', sarlavha: 'Defektura', izoh: defYangi + ' ta dori buyurtma kutmoqda', onclick: () => { DEF_TAB.v = 'kerak'; go('more', 'defektura'); } });
  return ishlar;
}

// Bugun kirdi / chiqdi — ikki plitka; bosilsa — shu kungi har pul alohida (oynada).
function seyfPlitkalar(ctx, go, bugun) {
  const { S } = ctx;
  const sf = H.kunSeyf(S, bugun);
  const pq = (q) => h('div', { class: 'pq' + (q.tur === 'xarajat' ? ' xarajat' : '') },
    h('span', {}, q.tur === 'xarajat' ? [h('b', {}, 'Xarajat'), ' · ' + q.nom] : q.nom, q.tur === 'kochirish' ? h('span', { class: 'yorliq' }, 'ko\'chirish') : null),
    h('b', {}, rq(q.summa)));
  const sv = H.kunSavdo(S.smenalar, bugun);
  const chiqdi = [...sf.chiqdi.filter((q) => q.tur === 'xarajat'), ...sf.chiqdi.filter((q) => q.tur !== 'xarajat')];
  const kirdiOyna = () => sheet('▲ Bugun seyfga kirdi', (box, close) => box.append(h('section', { class: 'card pul-karta kirim', 'aria-label': 'Bugun seyfga kirdi' },
    h('div', { class: 'pul-bosh' }, h('h2', {}, 'Jami'), h('b', {}, '+' + rq(sf.kirdiJami))),
    ...(sf.kirdi.length ? sf.kirdi.map(pq) : [h('div', { class: 'muted' }, 'Bugun seyfga pul kirmadi')]),
    sv.karta ? h('div', { class: 'pul-izoh' }, 'Karta savdo ' + H.som(sv.karta) + ' — bankka tushdi (seyfga emas)') : null),
  h('button', { class: 'link', onclick: () => { close(); go('daftar'); } }, 'Daftarda ochish ›')), { fokus: false });
  const chiqdiOyna = () => sheet('▼ Bugun seyfdan chiqdi', (box, close) => box.append(h('section', { class: 'card pul-karta chiqim', 'aria-label': 'Bugun seyfdan chiqdi' },
    h('div', { class: 'pul-bosh' }, h('h2', {}, 'Jami'), h('b', {}, '−' + rq(sf.chiqdiJami))),
    ...(chiqdi.length ? chiqdi.map(pq) : [h('div', { class: 'muted' }, 'Bugun seyfdan pul chiqmadi')]),
    sf.smenaXarajat.length ? h('div', { class: 'pul-ichki' },
      h('div', { class: 'pul-izoh' }, 'Smena kassasidan xarajat — seyfga tegmaydi, smena pulidan ayrilgan:'),
      ...sf.smenaXarajat.map((q) => pq({ ...q, tur: 'xarajat' }))) : null),
  h('button', { class: 'link', onclick: () => { close(); go('more', 'oqim'); } }, 'Kirim va chiqim — diagramma ›')), { fokus: false });
  return h('div', { class: 'grid2' },
    h('button', { type: 'button', class: 'kp-tile kirim', 'aria-label': 'Bugun kirdi ' + rq(sf.kirdiJami) + ' so\'m — ro\'yxat', onclick: kirdiOyna }, h('span', {}, '▲ Bugun kirdi'), h('b', {}, rq(sf.kirdiJami))),
    h('button', { type: 'button', class: 'kp-tile chiqim', 'aria-label': 'Bugun chiqdi ' + rq(sf.chiqdiJami) + ' so\'m — ro\'yxat', onclick: chiqdiOyna }, h('span', {}, '▼ Bugun chiqdi'), h('b', {}, rq(sf.chiqdiJami))));
}

// Ta'minotchilar — bitta karta (04.11, foydalanuvchi: "bosh ekranda karta turadi, bossa kirishi kerak"): qarzimiz va kutayotgan ishlar.
const taIshlar = (S) => {
  const taTasdiq = S.taminotchilar.reduce((a, t) => a + t.amallar.filter((z) => z.holat === 'ular' && !z.bekor).length, 0);
  const taEt = S.taminotchilar.reduce((a, t) => a + H.taEtirozlar(t).length, 0);
  return [taTasdiq ? taTasdiq + ' ta yozuv tasdiqlang' : '', taEt ? taEt + ' ta e\'tiroz' : ''].filter(Boolean).join(' · ');
};
function taKarta(ctx, go) {
  const { S } = ctx;
  const taQarz = S.taminotchilar.reduce((a, t) => a + H.bizBoyicha(t), 0);
  const taIsh = taIshlar(S);
  return h('button', { type: 'button', class: 'card ta-karta' + (taIsh ? ' diqqat' : ''), 'aria-label': 'Ta\'minotchilar — qarzimiz ' + H.som(taQarz) + (taIsh ? ', ' + taIsh : ''), onclick: () => go('tamin') },
    h('span', { class: 'ta-k-nom' }, h('b', {}, 'Ta\'minotchilar'), h('span', { class: 'muted' }, S.taminotchilar.length ? S.taminotchilar.length + ' ta · qarzimiz' : 'Hali qo\'shilmagan')),
    h('span', { class: 'ta-k-son' }, S.taminotchilar.length ? h('b', {}, H.som(taQarz)) : null, h('span', { 'aria-hidden': 'true' }, '›')),
    taIsh ? h('span', { class: 'ta-k-ish' }, taIsh) : null);
}

// Bugungi savdo — o'z kartasida: jami, naqd (seyfga) va karta (bankka) yonma-yon, har filial — bosilsa shu filial savdolari.
function savdoKarta(ctx, go, bugun) {
  const { S } = ctx;
  const sv = H.kunSavdo(S.smenalar, bugun);
  const kut = S.smenalar.filter((z) => H.tasdiqKutadi(z) && H.savdoKuni(z) === bugun).reduce((a, z) => a + (z.naqd || 0) + (z.karta || 0), 0);
  return h('section', { class: 'card savdo-karta' },
    h('div', { class: 'bugun-bosh' }, kartaSarlavha('Bugungi savdo'), h('b', { class: 'bugun-jami' }, H.som(sv.jami))),
    h('div', { class: 'naqd-karta' },
      h('div', { class: 'nk naqd' }, h('span', {}, 'Naqd'), h('b', {}, H.som(sv.naqd)), h('small', {}, '→ seyfga')),
      h('div', { class: 'nk karta' }, h('span', {}, 'Karta'), h('b', {}, H.som(sv.karta)), h('small', {}, '→ bankka'))),
    kut ? h('div', { class: 'msg warn' }, 'Yana ' + H.som(kut) + ' savdo tasdiqlashingizni kutmoqda') : null,
    h('div', { class: 'filial-royxat' }, h('div', { class: 'filial-sarlavha' }, 'Filiallar bo\'yicha'),
      ...S.filiallar.map((f) => {
        const v = sv.filiallar[f.id] || { naqd: 0, karta: 0 };
        // Bosilsa — shu filialning shu kungi savdolari (har smena alohida, tuzatish/bekor qilish shu yerda; 27.10).
        return h('button', { class: 'filial-qator', type: 'button', 'aria-label': f.nom + ' — bugungi savdolari', onclick: () => filialSavdoSheet(ctx, f.id, bugun) },
          h('div', { class: 'fq-nom' }, h('span', {}, f.nom), h('small', {}, 'naqd ' + H.som(v.naqd) + ' · karta ' + H.som(v.karta))),
          h('b', {}, H.som(v.naqd + v.karta) + ' ›'));
      })),
    h('div', { class: 'row' }, h('button', { class: 's', onclick: () => savdoSheet(ctx) }, '+ Savdo kiritish'),
      h('button', { class: 's', onclick: () => go('more', 'stat') }, 'Hisobot ›')));
}

// Bugungi savdo yozuvlari (yoki eski ochiq smena) — bo'lmasa null.
function bugungiYozuvlar(ctx, bugun) {
  const { S } = ctx;
  const bugungi = S.smenalar.filter((z) => !z.yopildi || H.savdoKuni(z) === bugun);
  if (!bugungi.length) return null;
  const sc = h('div', { class: 'card list' }, kartaSarlavha('Bugungi savdo yozuvlari'));
  bugungi.forEach((z) => sc.append(h('div', { class: 'item' }, h('div', { class: 'line', style: 'border:0;padding:0' }, h('span', {}, filNomi(S, z.filialId) + ' · ' + xodimIsmi(S, z.xodimId)), smenaTeg(z)))));
  return sc;
}

// Mijozlar qarzi — qisqa karta.
function qarzKarta(ctx, go) {
  const { S } = ctx;
  const ochiqQ = S.qarzlar.filter((q) => q.holat === 'ochiq'), otgan = ochiqQ.filter((q) => H.muddatiOtgan(q));
  return h('button', { class: 'card' + (otgan.length ? ' diqqat' : ''), style: 'height:auto;align-items:flex-start;gap:4px', onclick: () => go('more', 'qarz') },
    h('span', { class: 'muted' }, 'Mijozlar qarzi'), h('b', { style: 'font-size:18px;font-variant-numeric:tabular-nums' }, H.som(ochiqQ.reduce((a, q) => a + H.qarzQoldiq(q), 0))),
    h('span', { class: 'muted', style: otgan.length ? 'color:var(--warn);font-weight:600' : '' }, otgan.length ? otgan.length + ' tasi muddati o\'tgan' : 'muddati o\'tgan yo\'q'));
}

// ===================== Yangi ko'rinish (07.11, variant A) =====================
// Foydalanuvchi: "panelda narsa ko'p, ishlatish qiyin — oddiy va keksa odam ham ishlata olsin"; dadasi (direktor) faqat
// Defektura bilan ishlaydi — «Bugun» sahifasida Defektura birinchi. Pastda 4 bo'lim; ichki sahifalar — avvalgi ekranlar.
const Y_NOM = { bugun: 'Bugun', pul: 'Pul', ombor: 'Ombor', xodimlar: 'Xodimlar' };
const Y_MENYU = [['bugun', 'Bugun', 'bugun'], ['pul', 'Pul', 'pul'], ['ombor', 'Ombor', 'ombor'], ['xodimlar', 'Xodimlar', 'xodimlar']];

// Global qidiruv katalogi (07.11 tun, qidiruv.mjs): pastki menyu bo'limlari va hamma ichki sahifa (nomi — SAHIFA_NOM),
// izoh — qaysi bo'limda, soz — boshqa so'zlar bilan ham topilsin («nasiya» → Mijozlar qarzi). Serverdagi sahifalar — faqat serverda.
// [kalit, qayerga ([tab, sub] | bo'lim), ikonka, izoh, sinonimlar, faqat serverda]
const KATALOG = [
  ['bugun', 'b', 'bugun', 'Defektura, bugungi savdo, diqqat qiling', 'bosh sahifa'],
  ['pul', 'b', 'pul', 'Daftar, savdo, hamyonlar, qarzlar, hisobot', 'pul'],
  ['ombor', 'b', 'ombor', 'Qoldiq, buyurtma, narxlar, retseptlar', 'dori sklad'],
  ['xodimlar', 'b', 'xodimlar', 'Davomat, xodimlar, xabarlar, sozlamalar', 'hodim'],
  ['daftar', ['daftar'], 'daftar', 'Pul', 'kirim chiqim xarajat yozuv'],
  ['smena', ['smena'], 'savdo', 'Pul · savdo va smenalar', 'savdo kiritish smena'],
  ['tamin', ['tamin'], 'tamin', 'Pul · qarzlar', 'yetkazib beruvchi firma xarid'],
  ['qarz', ['more', 'qarz'], 'mijoz', 'Pul · qarzlar', 'nasiya mijoz'],
  ['oylik', ['more', 'oylik'], 'oylik', 'Pul · qarzlar', 'avans maosh ish haqi'],
  ['hamyon', ['more', 'hamyon'], 'hamyon', 'Pul', 'seyf bank kassa'],
  ['oqim', ['more', 'oqim'], 'diagramma', 'Pul · hisobot', 'diagramma'],
  ['stat', ['more', 'stat'], 'stat', 'Pul · hisobot', 'hisobot oyma oy'],
  ['pul', ['qoldiq', 'pul'], 'nazorat', 'Pul · hisobot', 'muzlagan kam foyda muddat', true],
  ['kassa', ['qoldiq', 'kassa'], 'kassa', 'Pul · hisobot', 'oson sotuv solishtirish', true],
  ['defektura', ['more', 'defektura'], 'defektura', 'Ombor', 'kam qolgan buyurtma kerak'],
  ['qoldiq', ['qoldiq'], 'ombor', 'Ombor', 'tugadi kam qoldi tugayapti', true],
  ['buyurtma', ['qoldiq', 'buyurtma'], 'aqlli', 'Ombor', 'nima olish kerak', true],
  ['kochirish', ['qoldiq', 'kochirish'], 'kochirish', 'Ombor', 'filiallar orasida', true],
  ['inventar', ['qoldiq', 'inventar'], 'inventar', 'Ombor', 'inventarizatsiya sanash', true],
  ['narx', ['qoldiq', 'narx'], 'narx', 'Ombor · nazorat', 'yorliq', true],
  ['firmalar', ['more', 'firmalar'], 'firma', 'Ombor · nazorat', 'prays agent arzon', true],
  ['prays', ['more', 'prays'], 'prays', 'Ombor · nazorat', 'narxlar'],
  ['shtrix', ['more', 'shtrix'], 'shtrix', 'Ombor · nazorat', 'shprits sistema barkod'],
  ['retsept', ['retsept'], 'retsept', 'Ombor · reimbursatsiya', 'punkt dmed qadoqlash partiya oson'],
  ['punktlar', ['more', 'punktlar'], 'punkt', 'Ombor · reimbursatsiya', 'punkt havola'],
  ['davomat', ['more', 'davomat'], 'davomat', 'Xodimlar', 'keldi kelmadi'],
  ['oyin', ['more', 'oyin'], 'oyin', 'Xodimlar', 'bilimdon test oyin'],
  ['funksiyalar', ['more', 'funksiyalar'], 'sozlama', 'Xodimlar', 'yoqish ochirish imkoniyat'],
  ['audit', ['more', 'audit'], 'daftar', 'Xodimlar', 'tarix jurnal kim ozgartirdi'],
  ['xulosa', ['more', 'xulosa'], 'xulosa', 'Xodimlar · xabarlar', 'ertalabki hisobot kechki'],
  ['xabar', ['more', 'xabar'], 'xabar', 'Xodimlar · xabarlar', 'bot telegram'],
  ['sozlama', ['more', 'sozlama'], 'sozlama', 'Xodimlar · ilova', 'filial limit kalit zaxira'],
  ['uy', ['more', 'uy'], 'bugun', 'Pul', 'uy puli']];
export function sahifaKatalog(ctx, go, bolim) {
  return KATALOG.filter(([k, , , , , sv]) => (!sv || ctx.server) && (k !== 'uy' || UY_PULI)).map(([k, yol, ik, izoh, soz]) => ({
    k, ikon: ik, izoh, soz,
    nom: yol === 'b' ? Y_NOM[k] : SAHIFA_NOM[yol[1] || yol[0]] || k,
    och: yol === 'b' ? () => bolim(k) : () => { if (yol[0] === 'retsept') retseptBosh(); if (yol[1] === 'defektura') DEF_TAB.v = 'kerak'; go(yol[0], yol[1]); }
  }));
}

// «Diqqat qiling» guruhlari: [ikonka, rang, bir nechta bo'lsa sarlavha].
const DIQQAT = {
  davomat: ['davomat', 'kok', 'Davomat belgilanmagan'],
  smenaOchiq: ['soat', 'sariq', 'Ochiq qolgan smenalar'],
  qabul: ['hamyon', 'yashil', 'Pul qabul qilish'],
  tasdiq: ['savdo', 'sariq', 'Savdoni tasdiqlash'],
  ruxsat: ['mijoz', 'sariq', 'Qarzga ruxsat so\'ralmoqda'],
  taYozdi: ['tamin', 'sariq', 'Ta\'minotchilar yozuv yozdi'],
  taEtiroz: ['tamin', 'qizil', 'Ta\'minotchilar e\'tiroz bildirdi'],
  kecha: ['savdo', 'sariq', 'Kiritilmagan savdolar'],
  qarzOtgan: ['qarz', 'qizil', 'Muddati o\'tgan qarzlar'],
  kalit: ['ogoh', 'qizil', 'Kengaytma kaliti olinmagan']
};
// Bir xil turdagi ishlar — bitta qator (son bilan); bittasi bo'lsa — o'sha ishning o'zi (bosilsa darhol), ko'p bo'lsa — oynada ro'yxat.
export function diqqatQatorlari(ctx, go, bugun) {
  const { S } = ctx;
  const ishlar = boshIshlar(ctx, go, bugun).filter((i) => i.tur !== 'defektura');   // Defektura — sahifaning o'zida, birinchi
  const otgan = S.qarzlar.filter((q) => q.holat === 'ochiq' && H.muddatiOtgan(q));
  if (otgan.length) {
    ishlar.push({ tur: 'qarzOtgan', icon: 'qarz', rang: 'warn', sarlavha: 'Muddati o\'tgan qarzlar', son: otgan.length,
      izoh: otgan.length + ' ta mijoz · ' + H.som(otgan.reduce((a, q) => a + H.qarzQoldiq(q), 0)), onclick: () => go('more', 'qarz') });
  }
  if (kalitOlinmagan(S)) {
    ishlar.push({ tur: 'kalit', icon: 'xato', rang: 'warn', sarlavha: 'Kengaytma kaliti olinmagan', izoh: 'Xavfsizlik: Sozlamalar → «Aptekadagi kompyuter» → «Kengaytma kaliti olish»',
      onclick: () => { ochiqQoy('soz-Aptekadagi kompyuter'); go('more', 'sozlama'); } });
  }
  const gs = new Map();
  ishlar.forEach((i) => { if (!gs.has(i.tur)) gs.set(i.tur, []); gs.get(i.tur).push(i); });
  return [...gs.entries()].map(([tur, l]) => {
    const [ik, rang, nom] = DIQQAT[tur] || ['ogoh', 'sariq', l[0].sarlavha];
    if (l.length === 1) {
      const i = l[0];
      return { ikon: ik, rang, l: i.sarlavha, izoh: i.izoh, son: i.son, diqqat: rang === 'qizil', onclick: i.onclick || (i.tugma && i.tugma[1]) };
    }
    return { ikon: ik, rang, l: nom, izoh: 'Bosing — bittalab ko\'rib chiqasiz', son: l.length, diqqat: rang === 'qizil', onclick: () => ishlarOyna(nom, l) };
  });
}
// Bir turdagi ishlar ro'yxati (oynada): har ish — eski «Bajarish kerak» qatori (tugmasi bilan); bosilsa oyna yopilib, ish ochiladi.
function ishlarOyna(nom, l) {
  sheet(nom, (box, close) => {
    box.append(h('div', { class: 'card ishlar' }, ...l.map((i) => ishQator({ ...i,
      onclick: i.onclick ? () => { close(); i.onclick(); } : undefined,
      tugma: i.tugma ? [i.tugma[0], () => { close(); i.tugma[1](); }] : undefined }))));
  }, { fokus: false });
}

// Defektura bloki (Bugun sahifasining boshi): sonlar, oxirgi «kerak» dorilar, ikki katta tugma.
const DEF_KORINADI = 4;   // «kerak» dorilardan eng yangilari (spec: 3–5)
function defekturaBlok(ctx, go) {
  const { S } = ctx;
  const g = H.defekturaGuruh(S.defektura || []);
  const kerak = g.filter((d) => d.holat === 'yangi'), berilgan = g.filter((d) => d.holat === 'buyurtma');
  const och = (v) => { DEF_TAB.v = v; go('more', 'defektura'); };
  const k = h('section', { class: 'card yd', 'aria-labelledby': 'yd-sarlavha' },
    h('div', { class: 'yd-bosh' }, kvadrat('defektura', 'sariq'),
      h('span', { class: 'yd-bosh-m' }, h('h2', { id: 'yd-sarlavha' }, 'Defektura'),
        h('span', { class: 'yd-son' }, h('span', {}, 'Kerak: ', h('b', {}, String(kerak.length))), ' · ',
          h('span', {}, 'Buyurtma berilgan: ', h('b', {}, String(berilgan.length)))))));
  if (!kerak.length) k.append(h('div', { class: 'yd-bosh-holat' }, ikon('check'), h('span', {}, berilgan.length ? 'Hammasiga buyurtma berilgan' : 'Hozir kerak dori yo\'q')));
  else {
    k.append(royxatHarakat(h('div', { class: 'yd-r' }, ...kerak.slice(0, DEF_KORINADI).map((d) => h('button', { type: 'button', class: 'yd-q', 'data-rk': d.nom, onclick: () => och('kerak') },
      h('span', { class: 'yd-q-m' }, h('b', { 'data-asl': '' }, d.nom),
        h('span', { class: 'muted' }, d.filiallar.map((id) => filNomi(S, id)).join(', ') + (d.soni > 1 ? ' · ' + d.soni + ' marta' : '') + ' · ' + sana(d.ts))),
      ikon('oldinga')))), 'yd'));
    if (kerak.length > DEF_KORINADI) k.append(h('div', { class: 'muted yd-yana' }, 'Yana ' + (kerak.length - DEF_KORINADI) + ' ta — «Defekturani ochish»'));
  }
  k.append(h('div', { class: 'yd-tugmalar' },
    h('button', { type: 'button', class: 'p katta', onclick: () => och('kerak') }, 'Defekturani ochish'),
    h('button', { type: 'button', class: 'katta', onclick: () => (ctx.server ? go('qoldiq', 'buyurtma') : ctx.toast('Aqlli buyurtma faqat Telegram ilovasida (serverda) ishlaydi', 'xato')) },
      ikon('aqlli'), 'Aqlli buyurtma')));
  return k;
}

// Bugungi savdo — katta raqam; bosilsa — filiallar bo'yicha (eski «Bugungi savdo» kartasi) va bugungi yozuvlar.
function savdoHero(ctx, go, bugun) {
  const { S } = ctx;
  const sv = H.kunSavdo(S.smenalar, bugun);
  const kut = S.smenalar.filter((z) => H.tasdiqKutadi(z) && H.savdoKuni(z) === bugun).reduce((a, z) => a + (z.naqd || 0) + (z.karta || 0), 0);
  const oyna = () => sheet('Bugungi savdo', (box, close) => {
    box.append(savdoKarta(ctx, (t, s) => { close(); go(t, s); }, bugun));
    const by = bugungiYozuvlar(ctx, bugun);
    if (by) box.append(by);
  }, { fokus: false });
  return h('button', { type: 'button', class: 'card hero ysh', 'aria-label': 'Bugungi savdo ' + H.som(sv.jami) + ' — filiallar bo\'yicha', onclick: oyna },
    h('span', { class: 'ysh-l' }, 'Bugungi savdo'),
    pulSon('savdo:' + bugun, sv.jami, { class: 'big' }),
    h('span', { class: 'ysh-q' }, 'Naqd ' + H.som(sv.naqd) + ' · karta ' + H.som(sv.karta)),
    kut ? h('span', { class: 'ysh-kut' }, 'Yana ' + H.som(kut) + ' tasdiq kutmoqda') : null,
    h('span', { class: 'ysh-b' }, 'Filiallar bo\'yicha', ikon('oldinga')));
}

// «Bugun» — tartib: Defektura → bugungi savdo → 4 ta dumaloq tugma → «Diqqat qiling».
function bugunView(m, ctx, go, bugun) {
  m.append(defekturaBlok(ctx, go));
  m.append(savdoHero(ctx, go, bugun));
  m.append(dumaloqlar([
    ['savdo', 'Savdo', 'yashil', () => savdoSheet(ctx)],
    ['xarajat', 'Xarajat', 'qizil', () => (UY_PULI ? yozuvSheet(ctx, { soha: 'apteka' }) : pulChiqdiSheet(ctx, 'xarajat'))],
    ['qarz', 'Qarz', 'sariq', () => go('more', 'qarz')],
    ['buyurtma', 'Buyurtma', 'kok', () => { DEF_TAB.v = 'buyurtma'; go('more', 'defektura'); }]]));
  const dq = diqqatQatorlari(ctx, go, bugun);
  m.append(h('section', { class: 'yb', 'aria-label': 'Diqqat qiling' }, h('h2', { class: 'yb-s' }, 'Diqqat qiling'),
    dq.length ? h('div', { class: 'card yb-r' }, ...dq.map(qator))
      : h('div', { class: 'card yb-bosh' }, ikon('check'), h('span', {}, 'Hammasi joyida — hozir bajariladigan ish yo\'q'))));
  const bl = boshlashKarta(ctx, go);
  if (bl) m.append(bl);
  // «Bilimdon» o'yini ketayotgan bo'lsa — kuzatishga qaytish kartasi (Defekturadan keyin: Defektura doim birinchi).
  if (ctx.server) { const ob = oyinBanner(ctx.retseptCtx(), () => go('more', 'oyin')); if (ob) m.insertBefore(ob, m.children[1] || null); }
}

// «Pul» — Telegram sozlamalari kabi guruhlar: har qatorda o'ngda asosiy raqam.
function pulBolim(m, ctx, go, bugun) {
  const { S } = ctx;
  const sv = H.kunSavdo(S.smenalar, bugun);
  const ochiqQ = S.qarzlar.filter((q) => q.holat === 'ochiq'), otgan = ochiqQ.filter((q) => H.muddatiOtgan(q)).length;
  const taIsh = taIshlar(S);
  m.append(...bolimlar([
    { nom: 'Har kuni', qatorlar: [
      { ikon: 'daftar', rang: 'yashil', l: 'Kunlik daftar', izoh: 'Kirim, chiqim, yozuvlar', onclick: () => go('daftar') },
      { ikon: 'savdo', rang: 'yashil', l: 'Savdo va smenalar', izoh: 'Bugun ' + H.som(sv.jami), onclick: () => go('smena') },
      { ikon: 'hamyon', rang: 'kok', l: 'Hamyonlar', izoh: 'Seyf, bank' + (UY_PULI ? ', uy' : '') + ' · bugun kirdi / chiqdi', qiymat: H.som(qoldiq(S, 'kassa')), onclick: () => go('more', 'hamyon') }] },
    { nom: 'Qarzlar', qatorlar: [
      { ikon: 'tamin', rang: 'sariq', l: 'Ta\'minotchilar', izoh: taIsh || (S.taminotchilar.length + ' ta · qarzimiz'), diqqat: !!taIsh,
        qiymat: H.som(S.taminotchilar.reduce((a, t) => a + H.bizBoyicha(t), 0)), onclick: () => go('tamin') },
      { ikon: 'mijoz', rang: 'sariq', l: 'Mijozlar qarzi', izoh: otgan ? otgan + ' tasi muddati o\'tgan' : 'Muddati o\'tgan yo\'q', diqqat: otgan > 0,
        qiymat: H.som(ochiqQ.reduce((a, q) => a + H.qarzQoldiq(q), 0)), onclick: () => go('more', 'qarz') },
      { ikon: 'oylik', rang: 'binafsha', l: 'Oyliklar', izoh: 'Avans, oy oxiri', onclick: () => go('more', 'oylik') }] },
    { nom: 'Hisobot', qatorlar: [
      { ikon: 'diagramma', rang: 'kok', l: 'Kirim va chiqim', izoh: 'Doira diagramma', onclick: () => go('more', 'oqim') },
      { ikon: 'stat', rang: 'kok', l: 'Statistika', izoh: 'Oyma-oy, filiallar', onclick: () => go('more', 'stat') },
      ctx.server ? { ikon: 'nazorat', rang: 'binafsha', l: 'Pul nazorati', izoh: 'Muddat, muzlagan pul, kam foyda', onclick: () => go('qoldiq', 'pul') } : null,
      ctx.server ? { ikon: 'kassa', rang: 'binafsha', l: 'Kassa ↔ Oson', izoh: 'Kiritilgan savdo va Oson sotuvi', onclick: () => go('qoldiq', 'kassa') } : null] }]));
}

// Hamyonlar (ichki sahifa): seyf, bugun kirdi / chiqdi, amallar (eski Bosh sahifadagi pul bloklari).
function hamyonView(m, ctx, go, bugun) {
  const { S } = ctx;
  m.append(seyfHero(ctx, go, bugun, true), seyfPlitkalar(ctx, go, bugun));
  m.append(...bolimlar([{ nom: 'Amallar', qatorlar: [
    { ikon: 'xarajat', rang: 'qizil', l: 'Seyfdan pul chiqdi', izoh: 'Bankka, uyga, ta\'minotchi, oylik, xarajat', onclick: () => (UY_PULI ? yozuvSheet(ctx, { soha: 'apteka' }) : pulChiqdiSheet(ctx)) },
    { ikon: 'savdo', rang: 'yashil', l: 'Kirim (savdodan tashqari)', izoh: 'Vozvrat, sherik qo\'shgan pul', onclick: () => yozuvSheet(ctx, { soha: 'apteka', tur: 'kirim' }) },
    { ikon: 'hamyon', rang: 'kok', l: 'Seyfdagi pulni sanash', izoh: 'Haqiqiy summani yozasiz — farqni dastur yozadi', onclick: () => sanashSheet(ctx, 'kassa') },
    UY_PULI ? { ikon: 'bugun', rang: 'kul', l: 'Uy puli', qiymat: H.som(qoldiq(S, 'uy')), onclick: () => go('more', 'uy') } : null,
    { ikon: 'bank', rang: 'kul', l: 'Bank', izoh: 'Karta savdo va topshirilgan pul — Kunlik daftarda', onclick: () => go('daftar') }] }]));
}

// «Ombor» — qidiruv (Oson: qaysi filialda bor) va skaner, uchta son kartasi, guruhlar.
function omborBolim(m, ctx, go, fil) {
  const { S } = ctx;
  const rc = ctx.retseptCtx();
  const chiz = () => ctx.rerender();
  if (ctx.server) m.append(h('section', { class: 'card yo-qidir', 'aria-label': 'Dori qidirish' }, osonQidiruv(rc, fil, { ichida: true, ixcham: true })));
  else m.append(praysQidiruv(ctx));
  if (ctx.server) {
    const s = osonSonlar({ ...rc, server: true }, chiz) || {};
    const nf = narxFarqSoni({ ...rc, server: true, rerender: ctx.rerender }, chiz);
    m.append(sonKartalar([
      { son: s.tugayapti, l: 'Tugayapti', rang: 'qizil', onclick: () => { osonRejimQoy('tugadi'); go('qoldiq'); } },
      { son: s.muddat, l: 'Muddati yaqin', rang: 'sariq', onclick: () => { osonRejimQoy('muddat'); go('qoldiq'); } },
      { son: nf, l: 'Narx farqi', rang: 'kok', onclick: () => go('qoldiq', 'narx') }]));
  }
  const def = H.defekturaGuruh(S.defektura || []).filter((d) => d.holat === 'yangi').length;
  const sv = ctx.server;
  m.append(...bolimlar([
    { nom: 'Har kungi ish', qatorlar: [
      sv ? { ikon: 'ombor', rang: 'yashil', l: 'Oson qoldig\'i', izoh: 'Tugadi, kam qoldi, ko\'chirsa — hamma filial', onclick: () => go('qoldiq') } : null,
      sv ? { ikon: 'aqlli', rang: 'binafsha', l: 'Aqlli buyurtma', izoh: 'Nima va qancha olish kerak', onclick: () => go('qoldiq', 'buyurtma') } : null,
      { ikon: 'defektura', rang: 'sariq', l: 'Defektura', izoh: def ? def + ' ta dori kerak' : 'Kam qolgan dorilar', diqqat: def > 0, onclick: () => { DEF_TAB.v = 'kerak'; go('more', 'defektura'); } },
      sv ? { ikon: 'kochirish', rang: 'kok', l: 'Ko\'chirish', izoh: 'Filiallar orasida — muddat, ortiqcha', onclick: () => go('qoldiq', 'kochirish') } : null,
      sv ? { ikon: 'inventar', rang: 'kok', l: 'Inventarizatsiya', izoh: 'Telefon bilan sanash', onclick: () => go('qoldiq', 'inventar') } : null] },
    { nom: 'Nazorat', qatorlar: [
      sv ? { ikon: 'narx', rang: 'sariq', l: 'Narx farqi', izoh: 'Filiallarda har xil narx, yorliqlar', onclick: () => go('qoldiq', 'narx') } : null,
      sv ? { ikon: 'inventar', rang: 'qizil', l: 'Hisobdan chiqarilganlar', izoh: 'Muddati o\'tgan, singan, firmaga qaytarilgan — sabab bilan', onclick: () => go('qoldiq', 'chiqarish') } : null,
      sv ? { ikon: 'firma', rang: 'kok', l: 'Firma prayslari', izoh: 'Qaysi firmada arzon', onclick: () => go('more', 'firmalar') } : null,
      { ikon: 'prays', rang: 'yashil', l: 'Prays-list', izoh: S.prays && S.prays.soni ? S.prays.soni + ' ta dori' : 'Narxlarni qidirish', onclick: () => go('more', 'prays') },
      { ikon: 'shtrix', rang: 'kul', l: 'Shtrix-kodlar', izoh: (S.shtrixlar || []).length ? (S.shtrixlar || []).length + ' ta · shprits, sistema…' : 'Shprits, sistema — xodimlar skanerga tutadi', onclick: () => go('more', 'shtrix') }] },
    { nom: 'Reimbursatsiya', qatorlar: [
      { ikon: 'retsept', rang: 'yashil', l: 'Retseptlar va partiyalar', izoh: 'Punkt ro\'yxatlari, qadoqlash, Oson', onclick: () => { retseptBosh(); go('retsept'); } },
      { ikon: 'punkt', rang: 'kok', l: 'Punktlar', izoh: 'Qo\'shish, botga ulash havolasi', onclick: () => go('more', 'punktlar') }] }]));
}

// «Xodimlar» — davomat, ro'yxat, o'yin, xabarlar, sozlamalar va ko'rinish.
function xodimlarBolim(m, ctx, go, korinish) {
  const { S, x } = ctx;
  const dv = davomatBugun(ctx.retseptCtx());
  const faol = S.xodimlar.filter((z) => z.faol !== false);
  m.append(...bolimlar([
    { nom: 'Xodimlar', qatorlar: [
      { ikon: 'davomat', rang: 'yashil', l: 'Davomat', izoh: dv && dv.belgilanmagan ? dv.belgilanmagan + ' ta xodim bugun belgilanmagan' : 'Keldi / kelmadi — har kuni',
        diqqat: !!(dv && dv.belgilanmagan), onclick: () => go('more', 'davomat') },
      { ikon: 'xodimlar', rang: 'kok', l: 'Xodimlar ro\'yxati', izoh: faol.length + ' ta · havola, oylik, filial', onclick: () => { ochiqQoy('soz-Xodimlar'); go('more', 'sozlama'); } },
      { ikon: 'oyin', rang: 'binafsha', l: 'Bilimdon', izoh: 'Jonli test o\'yini, reyting', onclick: () => go('more', 'oyin') },
      { ikon: 'sozlama', rang: 'sariq', l: 'Funksiyalar', izoh: ochiqSoni(S) ? ochiqSoni(S) + ' ta o\'chirilgan · xodim va mijoz' : 'Xodim va mijoz (bot) imkoniyatlarini yoqish / o\'chirish',
        onclick: () => go('more', 'funksiyalar') },
      { ikon: 'daftar', rang: 'kul', l: 'O\'zgarishlar tarixi', izoh: 'Kim, qachon, nimani o\'zgartirdi', onclick: () => go('more', 'audit') }] },
    { nom: 'Xabarlar', qatorlar: [
      { ikon: 'xulosa', rang: 'kok', l: 'Kechki xulosa va ertalabki hisobot', izoh: S.sozlama.xulosaVaqti + ' da Telegram\'ga', onclick: () => go('more', 'xulosa') },
      { ikon: 'xabar', rang: 'yashil', l: 'Bot xabarlari', qiymat: String((S.xabarlar || []).length), onclick: () => go('more', 'xabar') }] },
    { nom: 'Ilova', qatorlar: [
      { ikon: 'sozlama', rang: 'kul', l: 'Sozlamalar', izoh: 'Filiallar, limitlar, kalitlar, zaxira', onclick: () => go('more', 'sozlama') },
      { ikon: 'korinish', rang: 'kul', l: 'Ko\'rinish', izoh: 'Eski ko\'rinish, harf o\'lchami', onclick: korinish },
      { ikon: 'xabar', rang: 'yashil', l: 'Qanday ishlatiladi?', izoh: '3 ta qisqa ekran — asosiy joylar', onclick: () => tanishuvOch('direktor') },
      { ikon: 'oddiy', rang: 'kul', l: 'Oddiy rejim', izoh: '4 ta katta tugma, kam narsa', onclick: () => { rejimQoy(x.id, true); ctx.rerender(true); } }] }]));
}

// Boshlang'ich pul o'zgarsa — daftarda yozuv bo'lsa butun balans siljiydi: shuning uchun tasdiq so'raladi
// (server eski → yangi tarixini yozadi va sherikka ogohlantirish yuboradi). Eski yozuvlar hisobBoshi'da.
const tarixBor = (S) => (S.harakatlar || []).length > 0 || Object.values((S.sozlama || {}).hisobBoshi || {}).some(Boolean);

// ---------- Hisobot (26.10): 7 kun / oy / yil; naqd va karta; filiallar kesimida; boshqa davr bilan solishtirish ----------
// Hisob — H.davrSavdo / H.davrChegara / H.oldingiDavr (sof funksiyalar, test). Faqat tasdiqlangan savdo, smena yopilgan kunga.
const OY_NOMI = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'];
function statView(m, ctx, fil) {
  const { S } = ctx;
  const bugun = H.kunKey(Date.now());
  const kun = (k) => k.slice(8) + '.' + k.slice(5, 7);
  const STANDART = { hafta: bugun, oy: bugun.slice(0, 7), yil: bugun.slice(0, 4) };
  const kalit = statKalit[statTur] || STANDART[statTur];
  const nomi = (tur, k) => {
    if (tur === 'hafta') { const c = H.davrChegara('hafta', k); return kun(c.dan) + ' — ' + kun(c.gacha) + '.' + c.gacha.slice(0, 4); }
    if (tur === 'oy') return OY_NOMI[Number(k.slice(5, 7)) - 1] + ' ' + k.slice(0, 4);
    return k + '-yil';
  };
  // Keyingi davr: oldingiDavr ning teskarisi (kelajak tanlanmaydi).
  const keyingi = (tur, k) => {
    if (tur === 'hafta') return H.kunQosh(k, 7);
    if (tur === 'yil') return String(Number(k) + 1);
    return H.oyQosh(k, 1);
  };
  const tanla = (k) => { statKalit = { ...statKalit, [statTur]: k }; statSol = { ...statSol, [statTur]: null }; ctx.rerender(); };
  // Ilova so'nggi 400 kunning savdosini oladi (server C3): butunlay undan eski davr tanlanmaydi.
  const chegara400 = H.kunKey(Date.now() - 400 * 864e5);
  const ichida = (tur, k) => H.davrChegara(tur, k, bugun).gacha >= chegara400;
  const old = H.oldingiDavr(statTur, kalit), oldBor = ichida(statTur, old);
  const kel = keyingi(statTur, kalit), kelBor = kel <= STANDART[statTur];

  m.append(pills([['hafta', '7 kun'], ['oy', 'Oy'], ['yil', 'Yil']], statTur, (v) => { statTur = v; ctx.rerender(); }, 'Hisobot davri'));
  m.append(h('div', { class: 'davr-nav' },
    h('button', { class: 's', type: 'button', 'aria-label': 'Oldingi davr', disabled: !oldBor, onclick: () => oldBor && tanla(old) }, '‹'),
    h('b', { 'aria-live': 'polite' }, nomi(statTur, kalit)),
    h('button', { class: 's', type: 'button', 'aria-label': 'Keyingi davr', disabled: !kelBor, onclick: () => kelBor && tanla(kel) }, '›')));

  // Solishtirish: standart — oldingi davr; oyda istalgan oy (so'nggi 24 oy), haftada va yilda — oldingi yoki o'tgan yilning shu davri.
  const oldingi = H.oldingiDavr(statTur, kalit);
  const otganYil = statTur === 'yil' ? null : statTur === 'oy' ? (Number(kalit.slice(0, 4)) - 1) + kalit.slice(4)
    : (Number(kalit.slice(0, 4)) - 1) + kalit.slice(4);
  const solKalit = statSol[statTur] || oldingi;
  let variantlar;
  if (statTur === 'oy') {
    variantlar = [];
    for (let i = 1; i <= 24; i++) { const k = H.oyQosh(kalit, -i); variantlar.push([k, nomi('oy', k)]); }
  } else variantlar = [[oldingi, (statTur === 'yil' ? 'Oldingi yil: ' : 'Oldingi 7 kun: ') + nomi(statTur, oldingi)], ...(otganYil ? [[otganYil, 'O\'tgan yil: ' + nomi(statTur, otganYil)]] : [])];
  variantlar = variantlar.filter(([k]) => ichida(statTur, k));
  if (!variantlar.length) variantlar = [[oldingi, nomi(statTur, oldingi)]];
  const sel = h('select', { 'aria-label': 'Qaysi davr bilan solishtirish' }, ...variantlar.map(([k, l]) => h('option', { value: k, selected: k === solKalit }, l)));
  sel.addEventListener('change', () => { statSol = { ...statSol, [statTur]: sel.value }; ctx.rerender(); });
  m.append(h('label', { class: 'sol-tanlov' }, h('span', { class: 'muted' }, 'Solishtirish'), sel));

  // Filial: hammasi yoki bittasi (Osnovnoy ham alohida).
  m.append(pills([['hammasi', 'Hammasi'], ...S.filiallar.map((f) => [f.id, f.nom])], S.filiallar.some((f) => f.id === statFilial) ? statFilial : 'hammasi',
    (v) => { statFilial = v; ctx.rerender(); }, 'Filial'));
  const bitta = S.filiallar.some((f) => f.id === statFilial) ? statFilial : null;
  const smenalar = bitta ? S.smenalar.filter((z) => z.filialId === bitta) : S.smenalar;
  const ch = H.davrChegara(statTur, kalit, bugun);
  // Davr hali tugamagan bo'lsa (oyning 5-kuni) — solishtiriladigan davrning ham shuncha kuni olinadi, aks holda doim "tushdi".
  const toliqKun = H.davrChegara(statTur, kalit, '9999-12-31').kunlar, qisman = ch.kunlar < toliqKun;
  const chS = qisman ? H.davrBoshi(H.davrChegara(statTur, solKalit, bugun), ch.kunlar) : H.davrChegara(statTur, solKalit, bugun);
  const solNomi = nomi(statTur, solKalit) + (qisman ? ' (birinchi ' + ch.kunlar + ' kuni)' : '');
  const cur = H.davrSavdo(smenalar, ch.dan, ch.gacha), sol = H.davrSavdo(smenalar, chS.dan, chS.gacha);
  const farqEl = (a, b) => {
    const p = H.ozgarish(a, b);
    if (p === null) return h('span', { class: 'ozg' }, b === 0 && a > 0 ? 'oldin savdo yo\'q' : '—');
    return h('span', { class: 'ozg ' + (p >= 0 ? 'usdi' : 'tushdi') }, (p >= 0 ? '▲ +' : '▼ ') + String(p).replace('.', ',') + '%');
  };
  const ulush = (v) => (cur.jami ? Math.round(v / cur.jami * 100) : 0) + '%';

  // Asosiy karta: jami, o'zgarish, naqd va karta (ulushi bilan), solishtirilgan davr summasi.
  m.append(h('section', { class: 'card hisobot-asosiy' },
    h('div', { class: 'bugun-bosh' }, kartaSarlavha(bitta ? fil(bitta) + ' · savdo' : 'Jami savdo'), h('b', { class: 'bugun-jami' }, H.som(cur.jami))),
    h('div', { class: 'line', style: 'border:0;padding:0' }, h('span', { class: 'muted' }, solNomi + ': ' + H.som(sol.jami)), farqEl(cur.jami, sol.jami)),
    h('div', { class: 'naqd-karta' },
      h('div', { class: 'nk naqd' }, h('span', {}, 'Naqd · ' + ulush(cur.naqd)), h('b', {}, H.som(cur.naqd)), h('small', {}, 'oldin ' + H.som(sol.naqd))),
      h('div', { class: 'nk karta' }, h('span', {}, 'Karta · ' + ulush(cur.karta)), h('b', {}, H.som(cur.karta)), h('small', {}, 'oldin ' + H.som(sol.karta)))),
    h('div', { class: 'grid2' }, h('div', {}, 'Kunlik o\'rtacha', h('b', {}, H.som(ch.kunlar ? cur.jami / ch.kunlar : 0))),
      h('div', {}, 'Smenalar', h('b', {}, String(cur.smenaSoni))))));

  // Filiallar kesimida (Hammasi tanlanganda): har filial jami, naqd, karta, ulushi va solishtirish.
  if (!bitta) {
    const jc = H.davrSavdo(S.smenalar, ch.dan, ch.gacha), js = H.davrSavdo(S.smenalar, chS.dan, chS.gacha);
    const ids = [...S.filiallar.map((f) => f.id), ...Object.keys(jc.filiallar).filter((id) => !S.filiallar.some((f) => f.id === id))];
    m.append(h('section', { class: 'card' }, kartaSarlavha('Filiallar kesimida'),
      ...ids.map((id) => {
        const v = jc.filiallar[id] || { jami: 0, naqd: 0, karta: 0 }, o = js.filiallar[id] || { jami: 0 };
        return h('button', { type: 'button', class: 'filial-qator bosiladi', onclick: () => { statFilial = id; ctx.rerender(); } },
          h('div', { class: 'fq-nom' }, h('span', {}, fil(id) + ' · ' + ulush(v.jami)), h('small', {}, 'naqd ' + H.som(v.naqd) + ' · karta ' + H.som(v.karta)),
            h('small', {}, 'oldin ' + H.som(o.jami))),
          h('div', { class: 'fq-ong' }, h('b', {}, H.som(v.jami)), farqEl(v.jami, o.jami)));
      })));
  }

  // Grafik: 7 kun va oyda — kunlar, yilda — oylar. Ustunni bossangiz — tepada o'sha kun/oy summasi.
  const ustunlar = [];
  if (statTur === 'yil') for (let i = 1; i <= 12; i++) { const k = kalit + '-' + String(i).padStart(2, '0'); ustunlar.push([OY_NOMI[i - 1].slice(0, 3), cur.oylar[k] || 0, OY_NOMI[i - 1]]); }
  else {
    for (let i = 0; ; i++) {
      const k = H.kunQosh(ch.dan, i);
      if (k > ch.gacha) break;
      ustunlar.push([statTur === 'oy' ? (i % 5 === 0 ? String(i + 1) : '') : kun(k), cur.kunlar[k] || 0, kun(k)]);
    }
  }
  const mx = Math.max(1, ...ustunlar.map((u) => u[1]));
  const izoh = h('div', { class: 'muted', 'aria-live': 'polite' }, 'Ustunni bosing — summasi shu yerda chiqadi');
  const bars = h('div', { class: 'chart' + (ustunlar.length > 12 ? ' zich' : ''), role: 'img',
    'aria-label': (statTur === 'yil' ? 'Oyma-oy' : 'Kunma-kun') + ' savdo: ' + ustunlar.filter((u) => u[1]).map((u) => u[2] + ' ' + H.som(u[1])).join(', ') });
  ustunlar.forEach(([lbl, v, toliq]) => {
    const ust = h('div', { class: 'ustun', style: 'height:' + Math.max(2, Math.round(v / mx * 120)) + 'px', title: toliq + ': ' + H.som(v) });
    const kol = h('div', {}, ust, h('span', {}, lbl));
    kol.addEventListener('click', () => { bars.querySelectorAll('.ustun.tanlangan').forEach((e) => e.classList.remove('tanlangan')); ust.classList.add('tanlangan'); izoh.textContent = toliq + ': ' + H.som(v); });
    bars.append(kol);
  });
  m.append(h('section', { class: 'card' }, kartaSarlavha(statTur === 'yil' ? 'Oyma-oy savdo' : 'Kunma-kun savdo'), izoh, bars));
  const eskiChegara = H.kunKey(Date.now() - 400 * 864e5);
  if (chS.dan < eskiChegara || ch.dan < eskiChegara) m.append(h('div', { class: 'muted' }, 'Ilova so\'nggi 400 kunning savdosini ko\'radi — undan eski davrda summa to\'liq bo\'lmasligi mumkin.'));

  // Kassa farqlari (xodimlar) — tanlangan davrda.
  const kam = h('section', { class: 'card list' }, kartaSarlavha('Kassa farqlari · xodimlar'));
  S.xodimlar.filter((z) => z.rol === 'sotuvchi').forEach((z) => {
    const ff = S.smenalar.filter((x) => x.xodimId === z.id && x.yopildi && !x.bekor && H.savdoKuni(x) >= ch.dan && H.savdoKuni(x) <= ch.gacha && (!bitta || x.filialId === bitta)).map(H.farq).filter((v) => v);
    const sum = ff.reduce((a, v) => a + v, 0);
    kam.append(h('div', { class: 'line' }, h('span', {}, z.ism), h('b', { style: sum < 0 ? 'color:var(--warn)' : '' }, ff.length ? H.som(sum) + ' (' + ff.length + ' marta)' : 'farq yo\'q')));
  });
  m.append(kam);
}

// Kirim va chiqim (26.10): ikkita doira — kirim (filiallar savdosi) tepada, chiqim (ta'minotchilar har biri alohida, oylik,
// bank, uyga, boshqa) tagida. Davr — Bugun / 7 kun / Shu oy / O'tgan oy. Hisob — H.davrKirim, H.davrChiqim (sof funksiyalar, test).
function oqimView(m, ctx, fil) {
  const { S } = ctx;
  const bugun = H.kunKey(Date.now()), oy = bugun.slice(0, 7), otganOy = H.oyQosh(oy, -1);
  const DAVR = {
    bugun: [bugun, bugun],
    hafta: [H.kunQosh(bugun, -6), bugun],
    oy: [oy + '-01', bugun],
    otgan: [otganOy + '-01', H.oyOxirgiKun(otganOy)]
  };
  const [dan, gacha] = DAVR[oqimDavr] || DAVR.oy;
  m.append(pills([['bugun', 'Bugun'], ['hafta', '7 kun'], ['oy', 'Shu oy'], ['otgan', 'O\'tgan oy']], oqimDavr, (v) => { oqimDavr = v; ctx.rerender(); }, 'Davr'));
  const kun = (k) => k.split('-').reverse().join('.');
  m.append(h('div', { class: 'muted' }, dan === gacha ? kun(dan) : kun(dan) + ' — ' + kun(gacha)));
  const ki = H.davrKirim(S, dan, gacha), ch = H.davrChiqim(S, dan, gacha);
  // Filial rangi — filiallar ro'yxatidagi o'rni bo'yicha (doim bir xil); ro'yxatda yo'q filial — oxirida.
  const fIds = [...S.filiallar.map((f) => f.id), ...Object.keys(ki.filiallar).filter((id) => !S.filiallar.some((f) => f.id === id))];
  m.append(doira({ tur: 'kirim', sarlavha: '▲ Kirim — savdo', jamiNom: 'Jami kirim', bosh: 'Bu davrda tasdiqlangan savdo yo\'q.',
    bolaklar: fIds.map((id, i) => ({ nom: fil(id), qiymat: ki.filiallar[id] || 0, rang: RANGLAR[i % RANGLAR.length] })) }));
  const taNom = (id) => (S.taminotchilar.find((t) => t.id === id) || {}).nom || 'Ta\'minotchi';
  const ichki = Object.entries(ch.taminotchilar).sort((a, b) => b[1] - a[1]).map(([id, v]) => ({ nom: taNom(id), qiymat: v }));
  m.append(doira({ tur: 'chiqim', sarlavha: '▼ Chiqim', jamiNom: 'Jami chiqim', bosh: 'Bu davrda seyfdan pul chiqmagan.',
    bolaklar: [
      { nom: 'Ta\'minotchilar', qiymat: ch.taJami, rang: RANGLAR[0], ichki },
      { nom: 'Oylik', qiymat: ch.oylik, rang: RANGLAR[1] },
      { nom: 'Bankka', qiymat: ch.bank, rang: RANGLAR[2] },
      { nom: 'Uyga olib ketildi', qiymat: ch.uy, rang: RANGLAR[3] },
      { nom: 'Boshqa xarajatlar', qiymat: ch.boshqa, rang: RANGLAR[4] }] }));
  const farq = ki.jami - ch.jami;
  m.append(h('div', { class: 'card' }, h('div', { class: 'line', style: 'border:0;padding:0' }, h('span', {}, 'Kirim − chiqim'),
    h('b', { style: 'font-variant-numeric:tabular-nums;color:' + (farq < 0 ? 'var(--chiqim)' : 'var(--kirim)') }, (farq > 0 ? '+' : '') + H.som(farq)))));
  m.append(yordam('Kirim — siz kiritgan savdo (naqd + karta; eski smenalar — tasdiqlangani), o\'sha kunga. Chiqim — seyfdan chiqqan pul: '
    + 'ta\'minotchilarga to\'lov, oylik va avanslar, bankka topshirilgan, uyga olib ketilgan, boshqa xarajatlar (smena va daftar). '
    + 'Bankka topshirilgan pul xarajat emas — bankda turadi. Bo\'lakni yoki qatorni bossangiz, markazda uning summasi va ulushi chiqadi.', 'Qanday hisoblanadi?'));
}

function sozlamaView(m, ctx, x, fil) {
  const { S } = ctx;
  // Yozuv — shu telefonda, hamma panel uchun (sarlavhadagi tugma bilan bir xil). Tanlov o'z yozuvida qoladi (data-asl).
  const yozuv = pills([['lotin', 'Lotin'], ['kirill', 'Кирилл']], yozuvKirillmi(x.id) ? 'kirill' : 'lotin', (v) => { yozuvQoy(v === 'kirill'); ctx.rerender(); }, 'Yozuv / Ёзув');
  yozuv.setAttribute('data-asl', '');
  m.append(h('div', { class: 'card' }, kartaSarlavha('Yozuv'), h('div', { class: 'muted' }, 'Ilova lotin yoki kirill harfida — shu telefonda. Har bir xodim o\'z telefonida sarlavhadagi tugma bilan tanlaydi.'), yozuv));
  const ek = ekranTugmasi();
  if (ek) m.append(h('div', { class: 'card' }, kartaSarlavha('Telefon ekrani'), h('div', { class: 'muted' }, 'Ikonka qo\'yilsa — ilova botsiz, bir bosishda ochiladi.'), ek));
  // Pul
  const b0 = S.sozlama.boshlangich || {};
  // Birinchi marta — bo'sh (o'zi yozsin); keyin — saqlangan summa (0 ham).
  const birinchi = !b0.kassa && !b0.uy && !tarixBor(S);
  const bk = input('Seyfda hozir qancha pul bor?', { value: birinchi ? '' : String(b0.kassa || 0), k: 'bosh-kassa' }),
    bu = input('Uyda hozir qancha pul bor?', { value: birinchi ? '' : String(b0.uy || 0), k: 'bosh-uy' });
  if (!UY_PULI) { bu.i.value = String(b0.uy || 0); bu.el.hidden = true; }   // uy puli yashirin — o'zgarmaydi
  m.append(h('div', { class: 'card' }, kartaSarlavha('Boshlang\'ich pul'), h('div', { class: 'muted' }, 'Tizimni ishga tushirgan kundagi pul — bir marta yoziladi. Bank kerak emas.'), bk.el, bu.el,
    h('button', { class: 'p', onclick: () => {
      if (xatolar([[bk, pulXato(bk, 'Yozing (seyfda pul bo\'lmasa — 0)')], [bu, pulXato(bu, 'Yozing (uyda pul bo\'lmasa — 0)')]])) return;
      const k = H.pul(bk.i.value), u = H.pul(bu.i.value);
      if (k === (b0.kassa || 0) && u === (b0.uy || 0)) { ctx.toast('O\'zgarish yo\'q — saqlangan summa shu'); return; }
      (tarixBor(S) ? tasdiqlash('Bu butun balansni o\'zgartiradi: seyf ' + H.som(b0.kassa || 0) + ' → ' + H.som(k) + (UY_PULI ? ', uy ' + H.som(b0.uy || 0) + ' → ' + H.som(u) : '')
        + '. Eski va yangi summa tarixga yoziladi, sherigingizga xabar boradi. Davom etilsinmi?') : Promise.resolve(true))
        .then((ha) => ha && ctx.amalX(xatoJoyla([[bk, /seyf|kassa/i], [bu, /uy/i], [bk]]), 'boshlangichSaqla', { kassa: bk.i.value, uy: bu.i.value }).then((ok) => ok && ctx.toast('Saqlandi ✓')));
    } }, 'Saqlash')));

  // Apteka nomi — ta'minotchi va punkt panellarida, bot xabarlarida shunday ko'rinadi
  const an = input('Aptekamiz nomi', { inputmode: 'text', value: S.sozlama.aptekaNomi || '', k: 'apteka-nomi' });
  m.append(h('div', { class: 'card' }, kartaSarlavha('Apteka nomi'), h('div', { class: 'muted' }, 'Ta\'minotchilar va punktlar sizni shu nom bilan ko\'radi.'), an.el,
    h('button', { class: 'p', onclick: () => {
      const n = String(an.i.value).trim();
      if (xatolar([[an, n.length < 2 || n.length > 60 ? 'Apteka nomini yozing (2–60 harf)' : null]])) return;
      ctx.amalX(xatoJoyla([[an]]), 'aptekaNomla', an.i.value).then((ok) => ok && ctx.toast('Saqlandi ✓'));
    } }, 'Saqlash')));

  // Filiallar — nomini direktor o'zi beradi (hisob va tarix o'zgarmaydi)
  const fl = h('div', { class: 'card list' }, kartaSarlavha('Filiallar'),
    h('div', { class: 'muted' }, 'Nomini o\'zgartirsangiz — savdo, smena va tarix shu filialda qoladi, faqat nomi yangilanadi.'));
  const nomSheet = (sarlavha, eski, saqla) => sheet(sarlavha, (box, close) => {
    const n = input('Filial nomi', { inputmode: 'text', value: eski || '' });
    box.append(n.el, h('button', { class: 'p', onclick: () => {
      const v = String(n.i.value).trim();
      if (xatolar([[n, v.length < 2 || v.length > 40 ? 'Filial nomini yozing (2–40 harf)' : null]])) return;
      saqla(xatoJoyla([[n]]), n.i.value).then((ok) => ok && (close(), ctx.toast('Saqlandi ✓')));
    } }, 'Saqlash'));
  });
  S.filiallar.forEach((z) => fl.append(h('div', { class: 'line', style: 'align-items:center' }, h('span', {}, z.nom + (z.asosiy || z.id === 'osnovnoy' ? ' · asosiy' : '')),
    h('button', { class: 's', style: 'flex:none', onclick: () => nomSheet('Filial nomi', z.nom, (j, v) => ctx.amalX(j, 'filialNomla', z.id, v)) }, 'Nomini o\'zgartirish'))));
  fl.append(h('button', { onclick: () => nomSheet('Yangi filial', '', (j, v) => ctx.amalX(j, 'filialQosh', v)) }, '+ Filial qo\'shish'));
  m.append(fl);

  // Xodimlar
  const xl = h('div', { class: 'card list' }, kartaSarlavha('Xodimlar'));
  S.xodimlar.slice().sort((a, b) => (b.faol !== false) - (a.faol !== false)).forEach((z) => {
    const men = z.id === x.id, faol = z.faol !== false;
    // Amallar ro'yxatda ko'rinmaydi — xodim qatori bosilganda oynada (bitta qatorda 5 ta tugma bo'lmasin).
    const tugmalar = [];
    if (!men && faol) tugmalar.push(h('button', { class: z.ulangan ? 's' : 'p', onclick: () => taklifSheet(ctx, z) }, z.ulangan ? 'Yangi havola (telefon almashsa)' : 'Havola yuborish'));
    if (faol && z.rol === 'sotuvchi') tugmalar.push(h('button', { class: 's', onclick: () => sheet('Oylik: ' + z.ism, (box, close) => {
      const o = input('Oylik, so\'m', { value: String(z.oylik || '') });
      box.append(o.el, h('button', { class: 'p', onclick: () => {
        if (xatolar([[o, pulXato(o, 'Oylikni yozing')]])) return;
        ctx.amalX(xatoJoyla([[o]]), 'xodimOylik', z.id, o.i.value).then((ok) => ok && close());
      } }, 'Saqlash'));
    }) }, 'Oylik'));
    if (faol && z.rol === 'sotuvchi') {
      tugmalar.push(h('button', { class: 's', onclick: () => qoshimchaSheet(ctx, z, fil) }, z.qoshimchaFilial ? 'Ikkinchi ish joyini o\'zgartirish' : 'Ikkinchi ish joyi (2 smena)'));
      tugmalar.push(h('button', { class: 's', onclick: () => vaqtinchaSheet(ctx, z, fil) }, z.vaqtinchaFilial ? 'Filialini o\'zgartirish' : 'Vaqtincha boshqa filialga'));
      tugmalar.push(h('button', { class: 's', onclick: () => tasdiqlash(z.daraja === 2
        ? z.ism + ' oddiy xodim qilinsinmi? (Qadoqlash va defektura buyurtmasi yopiladi)'
        : z.ism + ' 2-darajali xodim qilinsinmi?\nRuxsat: reimbursatsiya va qadoqlash, defektura buyurtmasi. Pulga ruxsat yo\'q.')
        .then((ha) => ha && ctx.amal('xodimDaraja', z.id, z.daraja === 2 ? 1 : 2)) }, z.daraja === 2 ? 'Oddiy xodim qilish' : '2-daraja berish'));
    }
    if (!men && faol) tugmalar.push(h('button', { class: 's', onclick: () => tasdiqlash(z.ism + ' ishdan bo\'shatilsinmi? U ilovaga kira olmaydi (tarix saqlanadi).').then((ha) => ha && ctx.amal('xodimFaol', z.id, false)) }, 'Bo\'shatish'));
    if (!faol) tugmalar.push(h('button', { class: 's', onclick: () => ctx.amal('xodimFaol', z.id, true) }, 'Qaytarish'));
    const sarlavha = z.ism + ' · ' + fil(z.filialId) + (z.smena ? ' · ' + z.smena : '') + (z.daraja === 2 ? ' · 2-daraja' : '');
    const qoshimchaMatn = z.qoshimchaFilial ? 'Ikkinchi ish joyi: ' + fil(z.qoshimchaFilial) + ' · ' + z.qoshimchaSmena : null;
    const vaqtinchaMatn = z.vaqtinchaFilial ? 'Hozir vaqtincha: ' + fil(z.vaqtinchaFilial) + (z.vaqtinchaGacha ? ' (' + z.vaqtinchaGacha.slice(8) + '.' + z.vaqtinchaGacha.slice(5, 7) + ' gacha)' : ' (muddatsiz)') : null;
    const holat = men ? null : !faol ? 'Ishdan bo\'shatilgan' : z.ulangan ? 'Ilovaga ulangan ✓' : 'Hali ulanmagan — bosing va havola yuboring';
    const ichi = [h('div', { class: 'line', style: 'border:0;padding:0' }, h('span', { style: 'font-weight:600' }, sarlavha),
      h('span', { class: 'tag' }, z.rol === 'direktor' ? 'Direktor' : H.som(z.oylik || 0))),
    vaqtinchaMatn ? h('div', { style: 'color:var(--info);font-weight:600' }, vaqtinchaMatn) : null,
    qoshimchaMatn ? h('div', { style: 'color:var(--info);font-weight:600' }, qoshimchaMatn) : null,
    holat ? h('div', { class: 'muted', style: !z.ulangan && faol ? 'color:var(--warn);font-weight:600' : '' }, holat) : null];
    xl.append(tugmalar.length
      ? h('button', { type: 'button', class: 'yozuv', style: faol ? '' : 'opacity:.7', 'data-xodim': z.id, onclick: () => sheet(z.ism, (box, close) => {
        box.append(...[h('div', { class: 'muted' }, sarlavha), vaqtinchaMatn ? h('div', { style: 'color:var(--info);font-weight:600' }, vaqtinchaMatn) : null,
          qoshimchaMatn ? h('div', { style: 'color:var(--info);font-weight:600' }, qoshimchaMatn) : null,
          z.telefon ? h('div', { class: 'muted', 'data-asl': '' }, 'Telefon: ' + z.telefon) : null,
          holat ? h('div', { class: 'muted' }, z.ulangan || !faol ? holat : 'Hali ulanmagan — havolani unga Telegram\'da yuboring') : null,
          // Har tugma avval shu oynani yopadi, keyin o'z oynasini ochadi.
          ...tugmalar.map((b) => { b.addEventListener('click', close, { once: true }); return b; })].filter(Boolean));
      }) }, ...ichi)
      : h('div', { class: 'item' }, ...ichi));
  });
  xl.append(h('button', { onclick: () => xodimSheet(ctx) }, '+ Xodim qo\'shish'));
  m.append(xl);
  // 07.11 tun: global qidiruvda xodim tanlangan — Sozlamalar → Xodimlar ochilgach, o'sha xodimning oynasi (chizish tugagach).
  if (ochXodim) {
    const id = ochXodim;
    ochXodim = null;
    setTimeout(() => { const b = [...document.querySelectorAll('#app button[data-xodim]')].find((e) => e.dataset.xodim === id); if (b) { b.scrollIntoView({ block: 'center' }); b.click(); } }, 60);
  }

  // Limitlar va xulosa vaqti
  const lm = input('Bitta mijozga ko\'pi bilan qancha qarz?', { value: String(S.sozlama.limitMijoz), k: 'limit-mijoz' }),
    lx = input('Bitta xodim jami qancha qarz bera oladi?', { value: String(S.sozlama.limitXodim), k: 'limit-xodim' });
  const VAQTLAR = ['20:00', '21:00', '22:00'];
  const f = { vaqt: S.sozlama.xulosaVaqti };
  const boshqa = input('Boshqa vaqt (masalan 21:30)', { inputmode: 'text', value: VAQTLAR.includes(f.vaqt) ? '' : f.vaqt, k: 'limit-vaqt' });
  boshqa.el.hidden = VAQTLAR.includes(f.vaqt);
  const vaqtG = pills([...VAQTLAR.map((v) => [v, v]), ['boshqa', 'Boshqa']], VAQTLAR.includes(f.vaqt) ? f.vaqt : 'boshqa', (v) => { f.vaqt = v; boshqa.el.hidden = v !== 'boshqa'; }, 'Xulosa vaqti');
  m.append(h('div', { class: 'card' }, kartaSarlavha('Qarz limitlari va kechki xulosa'), h('div', { class: 'muted' }, 'Limitdan oshsa — xodim qarz yozolmaydi, sizdan ruxsat so\'raladi.'), lm.el, lx.el,
    h('b', {}, 'Kechki xulosa soat nechada kelsin?'), vaqtG, boshqa.el,
    h('button', { class: 'p', onclick: () => {
      const vq = f.vaqt === 'boshqa' ? boshqa.i.value.trim() : f.vaqt;
      const vaqtXato = f.vaqt !== 'boshqa' ? null : !/^([01]\d|2[0-3]):[0-5]\d$/.test(vq) ? 'Vaqtni HH:MM ko\'rinishida yozing (masalan 21:30)' : vq > '23:55' ? '23:55 dan kech bo\'lmasin' : null;
      if (xatolar([[lm, pulXato(lm, 'Limitni yozing')], [lx, pulXato(lx, 'Limitni yozing')], [boshqa, vaqtXato]])) return;
      ctx.amalX(xatoJoyla([[boshqa, /vaqt|HH/i], [lm, /mijoz|limit/i], [lx, /xodim/i]]), 'sozlamaSaqla', { limitMijoz: lm.i.value, limitXodim: lx.i.value, xulosaVaqti: vq })
        .then((ok) => ok && ctx.toast('Saqlandi ✓'));
    } }, 'Saqlash')));

  // Zaxira nusxa: hamma ma'lumot Excel fayl bo'lib Telegram'ga (har yakshanba o'zi ham keladi)
  m.append(zaxiraKarta(ctx));

  // Aptekadagi kompyuter: ikki kalit (27.10) — nakladnoy dasturi (prays, botdan fakturalar) va DMED kengaytmasi (bemorlar navbati,
  // partiyalar). Kengaytma kaliti olinmaguncha kengaytma nakladnoy kaliti bilan ishlaydi (20261027170000_kalit_ikki.sql).
  const pr = S.prays || {};
  const kalitOyna = (nom, joy) => (kod) => {
    if (typeof kod !== 'string' || !kod) return;   // kalit matni kelmadi (xato yoki takror)
    sheet(nom, (box) => box.append(h('div', { class: 'msg info', style: 'white-space:pre-line' }, joy + '\nKalitni boshqa hech kimga bermang.'),
      h('div', { class: 'calc', 'data-asl': '', style: 'word-break:break-all;font-size:13px' }, kod),
      h('button', { class: 'p', onclick: () => nusxaOl(kod, ctx.toast) }, 'Nusxa olish')));
  };
  m.append(h('div', { class: 'card' }, kartaSarlavha('Aptekadagi kompyuter'),
    h('div', { class: 'muted' }, 'Kompyuterdagi ikki dasturning har biri o\'z kaliti bilan ishlaydi. '
      + 'Prays: ' + (pr.soni ? pr.soni + ' ta dori' + (pr.yangilandi ? ', ' + sana(pr.yangilandi) + ' ' + vaqt(pr.yangilandi) : '') : 'hali yuklanmagan') + '.'),
    h('b', {}, 'Nakladnoy dasturi'),
    h('div', { class: 'muted' }, pr.kalit ? 'Kalit bor.' + (pr.kengaytmaKalit ? '' : ' Kengaytma kaliti olinmaguncha DMED kengaytmasi ham shu kalit bilan ishlaydi.') : 'Kalit olinmagan.'),
    h('button', { onclick: () => (pr.kalit ? tasdiqlash('Yangi nakladnoy kaliti olinsa, eskisi ishlamay qoladi — nakladnoy dasturiga yangisini qo\'yasiz'
      + (pr.kengaytmaKalit ? '' : ' (kengaytma kaliti hali olinmagan — kengaytmaga ham)') + '. Davom etilsinmi?') : Promise.resolve(true))
      .then((ha) => ha && ctx.amal('praysKalitYarat').then(kalitOyna('Nakladnoy kaliti', 'Aptekadagi kompyuterda: nakladnoy dasturi → pastdagi "Ilova kaliti".'
        + (pr.kengaytmaKalit ? '' : '\nKengaytma kaliti olinmaguncha — Chrome → DMED kengaytmasi → "Partiyalar" sahifasi → "Server kaliti" ga ham.')))) },
      pr.kalit ? 'Yangi nakladnoy kaliti' : 'Nakladnoy kaliti olish'),
    h('b', {}, 'DMED kengaytmasi (reimbursatsiya)'),
    h('div', { class: 'muted' }, pr.kengaytmaKalit ? 'Alohida kalit bor.' : 'Alohida kalit hali olinmagan — xavfsizlik uchun oling: nakladnoy kaliti bilan bemorlar ro\'yxatini olib bo\'lmaydigan bo\'ladi.'),
    h('button', { onclick: () => tasdiqlash(pr.kengaytmaKalit
      ? 'Yangi kengaytma kaliti olinsa, eskisi darhol ishlamay qoladi — har kompyuterdagi kengaytmaga yangisini qo\'yasiz. Davom etilsinmi?'
      : 'Kengaytma kaliti olingach, kengaytma eski kalit bilan ishlamaydi — darhol har kompyuterdagi kengaytmaga yangisini qo\'yasiz. Davom etilsinmi?')
      .then((ha) => ha && ctx.amal('kengaytmaKalitYarat').then(kalitOyna('Kengaytma kaliti',
        'Aptekadagi HAR kompyuterda: Chrome → DMED kengaytmasi → "Partiyalar" sahifasi → "Server kaliti" → yangi kalitni qo\'ying → Saqlash.\nNakladnoy dasturiga tegmang — u o\'z kaliti bilan ishlayveradi.'))) },
      pr.kengaytmaKalit ? 'Yangi kengaytma kaliti' : 'Kengaytma kaliti olish')));

  // Bot
  m.append(h('div', { class: 'card' }, kartaSarlavha('Telegram bot'),
    h('div', { class: 'muted' }, 'Bot sizga kamomad, qarz so\'rovi va kechki xulosani yozadi. Bot javob bermay qolsa — shu tugmani bosing.'),
    h('button', { onclick: () => ctx.amal('botUlash').then((ok) => ok && ctx.toast('Bot ulandi ✓')) }, 'Botni qayta ulash')));

  // Har bo'lim — yopiq qator (sarlavha + qisqa holat); bosilsa ochiladi, qayta chizilganda ochiqligi saqlanadi.
  const faolX = S.xodimlar.filter((z) => z.faol !== false);
  const IZOH = {
    'Telefon ekrani': 'Ilovani ekranga qo\'yish',
    'Boshlang\'ich pul': birinchi ? 'Hali kiritilmagan' : 'Seyf ' + H.som(b0.kassa || 0) + (UY_PULI ? ' · uy ' + H.som(b0.uy || 0) : ''),
    'Apteka nomi': S.sozlama.aptekaNomi || 'Kiritilmagan',
    Filiallar: S.filiallar.map((z) => z.nom).join(', '),
    Xodimlar: faolX.length + ' ta' + (faolX.some((z) => z.rol === 'sotuvchi' && !z.ulangan) ? ' · ulanmaganlar bor' : ''),
    'Qarz limitlari va kechki xulosa': 'Mijozga ' + H.som(S.sozlama.limitMijoz) + ' · xulosa ' + S.sozlama.xulosaVaqti,
    'Zaxira nusxa': 'Excel fayl Telegram\'ga',
    'Aptekadagi kompyuter': (pr.kalit ? 'Nakladnoy kaliti bor' : 'Kalit olinmagan') + (pr.kengaytmaKalit ? ' · kengaytma kaliti bor' : '') + (pr.soni ? ' · prays ' + pr.soni + ' ta' : ''),
    'Telegram bot': 'Javob bermasa — qayta ulash'
  };
  [...m.children].forEach((c) => {
    const s = c.classList.contains('card') && c.querySelector(':scope > h2.ct');
    if (!s) return;
    const nom = s.textContent;
    s.remove();
    c.replaceWith(ochiladi(nom, [...c.childNodes], { k: 'soz-' + nom, izoh: IZOH[nom] || null, cls: 'karta' + (c.classList.contains('list') ? ' list' : '') }));
  });
}

// Daftar yozuvi bosildi: tafsilot; bekor qilish mumkin bo'lsa — sababi bilan (yozuv o'chirilmaydi, teskari yozuv qo'shiladi).
function yozuvTafsilot(ctx, r, lbl, amt) {
  sheet(lbl, (box, close) => {
    box.append(h('div', { class: 'line', style: 'border:0;padding:0' }, h('span', {}, r.izoh || lbl), h('span', { class: 'muted' }, sana(r.ts) + ' ' + vaqt(r.ts))));
    if (amt) box.append(h('b', {}, amt));
    if (r.bekor) { box.append(h('div', { class: 'msg info' }, 'Bu yozuv bekor qilingan' + (r.bekorSabab ? ': ' + r.bekorSabab : '') + '.')); return; }
    if (BEKOR_YOQ.has(r.tur)) {
      box.append(h('div', { class: 'msg info' }, r.tur === 'pos' ? 'Karta savdo smena bilan birga — tuzatish uchun Smenalar → "Savdoni tuzatish".' : 'Bu teskari yozuv — uni bekor qilib bo\'lmaydi.'));
      return;
    }
    const sb = input('Bekor qilish sababi', { inputmode: 'text', placeholder: 'Masalan: summa xato yozilgan' });
    box.append(h('div', { class: 'msg info' }, 'Yozuv o\'chirilmaydi — teskari yozuv qo\'shiladi, tarix saqlanadi. ' + (BEKOR_IZOH[r.tur] || (r.qarzId ? 'Qarz yana ochiq bo\'ladi.' : r.smenaId ? 'Smena hisobi qayta hisoblanadi.' : r.taminotchiId ? BEKOR_IZOH.tolov : ''))), sb.el,
      h('button', { class: 'ogoh', onclick: () => {
        if (xatolar([[sb, matnBormi(sb) ? null : 'Sababini yozing']])) return;
        ctx.amalX(xatoJoyla([[sb, /sabab/i]]), 'yozuvBekor', r.id, sb.i.value).then((ok) => ok && close());
      } }, 'Bekor qilish'));
  }, { fokus: false });   // ko'rish oynasi — bekor sababi maydoniga fokus berilmaydi (klaviatura o'zi chiqmasin)
}

// Direktor savdoni o'zi kiritadi: xodim ulanmagan kunlar yoki eski kunlar uchun. Darhol tasdiqlangan.
// Bitta filialning bitta kungi savdolari (27.10, foydalanuvchi: "Osnovnoy ustiga bossa shundagi savdolar ko'rinsin, tushunarli").
// Har smena — alohida karta: kim, naqd, karta, holati (savdoga yozilgan / tasdiq kutmoqda / ochiq) va amallar. Bekor qilinganlar —
// pastda yopiq bo'limda (chalkashtirmasin). Bir smenaga ikki yozuv bo'lsa — ogohlantirish. ‹ › bilan boshqa kun.
// Amal tugmasi bosilsa bu oyna yopiladi (ilova qayta chiziladi, raqamlar yangilanadi).
const SMENA_TARTIB = { kunduzgi: 1, tungi: 2, kunlik: 3 };
const SMENA_SARLAVHA = { kunduzgi: 'Kunduzgi smena', tungi: 'Tungi smena', kunlik: 'Butun kun' };
// 30.10: «Kecha <filial> savdosi kiritilmagan» bosilganda — ikki yo'l: savdoni kiritish yoki «Savdo bo'lmadi» (filial yopiq edi).
// «Savdo bo'lmadi» hisobga hech narsa yozmaydi — faqat eslatma chiqmaydi; olib tashlash — filial savdolari oynasida.
export function kechaSavdoSheet(ctx, fl, kun) {
  const sanaMatn = kunNomi(new Date(Date.parse(kun) + 6 * 3600e3));
  sheet(fl.nom + ' · ' + sanaMatn, (box, close) => {
    box.append(
      h('p', { class: 'muted', style: 'margin:0' }, 'Bu kunga ' + fl.nom + ' savdosi kiritilmagan.'),
      h('button', { class: 'p', type: 'button', onclick: () => { close(); savdoSheet(ctx, { filialId: fl.id, kun }); } }, '+ Savdoni kiritish'),
      h('button', { class: 's', type: 'button', onclick: () => tasdiqlash(fl.nom + ' ' + sanaMatn + ' savdo qilmagan (yopiq edi)?\nHisobga hech narsa yozilmaydi — faqat eslatma chiqmaydi.')
        .then((ha) => { if (!ha) return; close(); ctx.amal('savdoYoq', fl.id, kun, true).then((ok) => ok && ctx.toast(fl.nom + ': savdo bo\'lmadi ✓')); }) },
        'Savdo bo\'lmadi — filial yopiq edi'));
  }, { fokus: false });
}

function filialSavdoSheet(ctx, filialId, kun0) {
  const { S } = ctx;
  const fl = S.filiallar.find((z) => z.id === filialId) || { nom: filialId };
  const ism = (id) => (S.xodimlar.find((z) => z.id === id) || {}).ism || 'Direktor';
  const bugun = H.kunKey(Date.now());
  let kun = kun0 || bugun;
  sheet(fl.nom + ' · savdolar', (box, close) => {
    const joy = h('div', { style: 'display:flex;flex-direction:column;gap:12px' });   // oyna sarlavhasi qolsin — faqat shu qism qayta chiziladi
    box.append(joy);
    const chiz = () => {
      const hammasi = S.smenalar.filter((z) => z.filialId === filialId && (z.yopildi ? H.savdoKuni(z) === kun : H.kunKey(z.ochildi) === kun));
      const faol = hammasi.filter((z) => !z.bekor).sort((a, b) => (SMENA_TARTIB[a.nom] || 9) - (SMENA_TARTIB[b.nom] || 9) || (a.ochildi || 0) - (b.ochildi || 0));
      const bekorlar = hammasi.filter((z) => z.bekor);
      const yozilgan = faol.filter(H.hisobda);
      const naqd = yozilgan.reduce((a, z) => a + (z.naqd || 0), 0), karta = yozilgan.reduce((a, z) => a + (z.karta || 0), 0);
      const sanaMatn = kun === bugun ? 'Bugun' : kunNomi(new Date(Date.parse(kun) + 6 * 3600e3));
      const ich = [
        h('div', { class: 'row', style: 'align-items:center;justify-content:space-between' },
          h('button', { class: 's', type: 'button', 'aria-label': 'Oldingi kun', onclick: () => { kun = H.kunQosh(kun, -1); chiz(); } }, '‹'),
          h('b', {}, sanaMatn),
          h('button', { class: 's', type: 'button', 'aria-label': 'Keyingi kun', disabled: kun >= bugun, onclick: () => { kun = H.kunQosh(kun, 1); chiz(); } }, '›')),
        h('div', { class: 'card' }, h('div', { class: 'line', style: 'border:0;padding:0' }, h('span', {}, 'Savdoga yozilgan'), h('b', {}, H.som(naqd + karta))),
          h('div', { class: 'muted' }, 'naqd ' + H.som(naqd) + ' · karta ' + H.som(karta)))
      ];
      // Bir smenaga ikki faol yozuv (masalan o'zingiz kiritgan + xodim yopgan) — savdo ikki marta sanaladi.
      const takror = Object.entries(faol.filter((z) => z.yopildi).reduce((a, z) => { a[z.nom] = (a[z.nom] || 0) + 1; return a; }, {})).filter(([, n]) => n > 1);
      takror.forEach(([nom]) => ich.push(h('div', { class: 'msg warn' }, (SMENA_SARLAVHA[nom] || nom) + 'ga ikkita yozuv bor — savdo ikki marta sanalyapti. Keraksizini «Bekor qilish» bilan olib tashlang.')));
      if (!faol.length) ich.push(h('div', { class: 'card muted' }, 'Bu kunda ' + fl.nom + ' savdosi yo\'q.'));
      // 30.10: «Savdo bo'lmadi» belgisi — ko'rinadi va olib tashlanadi; savdo yo'q o'tgan kunga — qo'yiladi.
      if (H.savdoYoqmi(S, filialId, kun)) {
        ich.push(h('div', { class: 'card' }, h('b', {}, 'Savdo bo\'lmadi deb belgilangan'), h('div', { class: 'muted' }, 'Filial yopiq bo\'lgan — eslatma chiqmaydi.'),
          h('div', { class: 'row', style: 'margin-top:8px' }, h('button', { class: 's', type: 'button',
            onclick: () => { close(); ctx.amal('savdoYoq', filialId, kun, false).then((ok) => ok && ctx.toast('Belgi olib tashlandi')); } }, 'Belgini olib tashlash'))));
      } else if (!faol.length && kun < bugun) {
        ich.push(h('button', { class: 's', type: 'button', onclick: () => tasdiqlash(fl.nom + ' bu kuni savdo qilmagan (yopiq edi)?')
          .then((ha) => { if (!ha) return; close(); ctx.amal('savdoYoq', filialId, kun, true).then((ok) => ok && ctx.toast('Savdo bo\'lmadi ✓')); }) }, 'Savdo bo\'lmadi — filial yopiq edi'));
      }
      faol.forEach((z) => {
        const nomi = fl.nom + ' · ' + ism(z.xodimId) + ' · ' + (SMENA_SARLAVHA[z.nom] || z.nom);
        const holat = !z.yopildi ? ['Ochiq qolgan (' + vaqt(z.ochildi) + ' dan) — yoping, savdoni kiriting', 'background:var(--warn-bg);color:var(--warn)']
          : H.hisobda(z) ? ['✓ Savdoga yozilgan', 'background:var(--soft);color:var(--accent)']
            : ['Tasdiqlashingizni kutmoqda', 'background:var(--warn-bg);color:var(--warn)'];
        const amallar = [];
        if (H.tasdiqKutadi(z)) amallar.push(h('button', { class: 'p s', type: 'button', onclick: () => { close(); ctx.amal('savdoTasdiq', z.id).then((ok) => ok && ctx.toast('Savdoga yozildi ✓')); } }, 'Tasdiqlash'));
        if (!z.yopildi && !z.qolda) amallar.push(h('button', { class: 'p s', type: 'button', onclick: () => { close(); ochiqSmenaYop(ctx, z, nomi); } }, 'Smenani yopish'));
        if (z.yopildi) amallar.push(h('button', { class: 's', type: 'button', onclick: () => { close(); savdoTuzatishSheet(ctx, z, nomi); } }, 'Summani tuzatish'));
        if (z.yopildi) amallar.push(h('button', { class: 's', type: 'button', onclick: () => { close(); savdoBekorSheet(ctx, z, nomi); } }, 'Bekor qilish'));
        ich.push(h('div', { class: 'card' },
          h('div', { class: 'line', style: 'border:0;padding:0;align-items:center' }, kartaSarlavha(SMENA_SARLAVHA[z.nom] || z.nom), h('b', {}, H.som((z.naqd || 0) + (z.karta || 0)))),
          h('div', { class: 'muted' }, (z.qolda ? 'Siz kiritdingiz' : ism(z.xodimId)) + (z.yopildi ? ' · ' + sana(z.yopildi) + ' ' + vaqt(z.yopildi) : '')),
          z.yopildi ? h('div', {}, 'Naqd ' + H.som(z.naqd) + ' · karta ' + H.som(z.karta)) : null,
          h('span', { class: 'tag', style: 'align-self:flex-start;' + holat[1] }, holat[0]),
          amallar.length ? h('div', { class: 'row' }, ...amallar) : null));
      });
      if (bekorlar.length) {
        ich.push(ochiladi('Bekor qilinganlar', bekorlar.map((z) => h('div', { class: 'line muted' },
          h('span', {}, (SMENA_SARLAVHA[z.nom] || z.nom) + (z.bekorSabab ? ' · ' + z.bekorSabab : '')),
          h('s', {}, H.som((z.naqd || 0) + (z.karta || 0))))), { izoh: bekorlar.length + ' ta — hisobga kirmaydi' }));
      }
      ich.push(h('button', { class: 'p', type: 'button', onclick: () => { close(); savdoSheet(ctx, { filialId, kun }); } }, '+ ' + fl.nom + 'ga savdo kiritish'));
      joy.replaceChildren(...ich);
    };
    chiz();
  });
}

// Yopilgan savdoni bekor qilish (Smenalar va filial savdolari oynasida bir xil). 28.10: xodim yopgan smena ham.
function savdoBekorSheet(ctx, z, nomi) {
  sheet('Savdoni bekor qilish', (box, close) => {
    const sb = input('Sababi', { inputmode: 'text', placeholder: 'Masalan: tungi savdo kunduzgiga kiritilgan' });
    box.append(h('div', { class: 'muted' }, nomi + ' · naqd ' + H.som(z.naqd) + ' · karta ' + H.som(z.karta)),
      h('div', { class: 'msg info' }, 'Savdo hisobdan chiqadi, seyf va bankdagi yozuvlari qaytariladi. Keyin to\'g\'risini «+ Savdo kiritish» bilan qayta kiriting'
        + (z.qolda ? '.' : ' — naqd pul seyfga qo\'shiladi. Smenada boshlang\'ich pul, kassada qoldirilgan pul yoki xarajat bo\'lsa — bekor qilinmaydi, «Savdoni tuzatish»dan foydalaning.')), sb.el,
      h('button', { class: 'p', onclick: () => {
        if (xatolar([[sb, matnBormi(sb) ? null : 'Sababini yozing']])) return;
        ctx.amalX(xatoJoyla([[sb, /sabab/i]]), 'savdoBekor', z.id, sb.i.value).then((ok) => ok && (close(), ctx.toast('Savdo bekor qilindi')));
      } }, 'Bekor qilish'));
  });
}

// o.filialId, o.kun ('YYYY-MM-DD') — oldindan tanlangan (filial savdolari oynasidan ochilganda).
// «Savdo kiritish» (29.10, foydalanuvchi: "oson, qulay, tushunarli bo'lsin"): 4 ta raqamli qadam — kun, filial, smena va kim,
// summa (naqd → seyfga, karta → bankka); pastda jonli xulosa va summali tugma. Shu kun + filial + smenaga yozuv bo'lsa —
// oldindan ogohlantiradi (server baribir rad etadi). Amal va tekshiruvlar o'zgarmagan (savdoKiritish).
// 29.10: eski ochiq smenani yopish — savdosiz, farqsiz, bekor qilingan (ilova.smena_direktor_yop); savdo «+ Savdo kiritish» bilan.
function ochiqSmenaYop(ctx, z, nomi) {
  return tasdiqlash(nomi + ' smenasi yopilsinmi?\nSavdosi yozilmaydi — keyin «+ Savdo kiritish» bilan kiritasiz. Kassadagi pul o\'zgarmaydi.')
    .then((ha) => ha && ctx.amal('smenaDirektorYop', z.id).then((ok) => ok && ctx.toast('Smena yopildi ✓ — endi savdoni kiriting')));
}

function savdoSheet(ctx, o = {}) {
  const { S, x } = ctx;
  const asosiymi = (id) => { const f = S.filiallar.find((z) => z.id === id); return !!f && (f.asosiy || f.id === 'osnovnoy'); };
  const bugun = H.kunKey(Date.now()), kecha = H.kunKey(Date.now() - 864e5);
  const tanKun = o.kun && o.kun !== bugun ? (o.kun === kecha ? 'kecha' : 'boshqa') : 'bugun';
  const f = { filialId: S.filiallar.some((z) => z.id === o.filialId) ? o.filialId : S.filiallar[0] && S.filiallar[0].id, smena: null, xodimId: null, kunTanlov: tanKun };
  const qadam = (n, matn) => h('div', { class: 'qadam-s' }, h('span', { class: 'qs-n', 'aria-hidden': 'true' }, String(n)), h('b', {}, matn));
  sheet('Savdo kiritish', (box, close) => {
    const smenaJoy = h('div', { class: 'qadam-b' });
    const xodimJoy = h('div', { class: 'qadam-b' });
    const smenaX = guruhXato(null), xodimX = guruhXato(null);
    const boshqa = input('Sana', { type: 'date', inputmode: 'text', max: bugun, value: tanKun === 'boshqa' ? o.kun : kecha });
    const naqd = input('Naqd savdo, so\'m — seyfga tushadi', { placeholder: '0' }), karta = input('Karta savdo (terminal), so\'m — bankka tushadi', { placeholder: '0' });
    const xulosa = h('div', { class: 'savdo-xulosa', 'aria-live': 'polite' });
    const saqla = h('button', { class: 'p', style: 'min-height:58px;font-size:17px' }, 'Saqlash');
    // 07.11 tun: uzun forma — «Saqlash — N so'm» Telegram asosiy tugmasida ham (doim ko'rinadi, klaviatura ustida); eski Telegram
    // va brauzerda — sahifadagi tugma. Oyna yopilganda tozalanadi (build qaytargan funksiya — sheet chaqiradi).
    let band = false;
    // Audit 07.11: eski ko'rinish va oddiy rejimda — avvalgidek sahifadagi katta tugma.
    const asosiy = !eskiKorinishmi() && !oddiyRejimmi(ctx.x.id) ? asosiyTugma({ matn: 'Saqlash', tugma: saqla, oyna: box, bosildi: () => saqlaBos() }) : null;
    const kunOl = () => (f.kunTanlov === 'kecha' ? kecha : f.kunTanlov === 'boshqa' ? boshqa.i.value : bugun);
    const SMN = { kunduzgi: 'kunduzgi', tungi: 'tungi', kunlik: 'butun kun' };
    const upd = () => {
      const kun = kunOl();
      const n = H.pul(String(naqd.i.value).trim() || '0'), k = H.pul(String(karta.i.value).trim() || '0');
      const fil = (S.filiallar.find((z) => z.id === f.filialId) || {}).nom || '';
      const kim = f.xodimId ? (S.xodimlar.find((z) => z.id === f.xodimId) || {}).ism : x.ism;
      const bor = /^\d{4}-\d{2}-\d{2}$/.test(kun) ? S.smenalar.find((z) => !z.bekor && z.filialId === f.filialId && z.nom === f.smena && z.yopildi && H.savdoKuni(z) === kun) : null;
      xulosa.replaceChildren(
        h('div', {}, (kun === bugun ? 'Bugun' : kun === kecha ? 'Kecha' : kun.split('-').reverse().join('.')) + ' · ' + fil + ' · ' + (SMN[f.smena] || f.smena) + ' · ' + kim),
        n != null && k != null && (n || k) ? h('div', {}, h('span', { style: 'color:var(--kirim);font-weight:700' }, 'Naqd ' + H.som(n) + ' → seyf'), ' · ',
          h('span', { style: 'font-weight:700' }, 'karta ' + H.som(k) + ' → bank')) : h('div', { class: 'muted' }, 'Summani yozing'),
        bor ? h('div', { class: 'msg warn' }, 'Bu kun, filial va smenaga savdo allaqachon yozilgan (' + H.som((bor.naqd || 0) + (bor.karta || 0))
          + '). Xato bo\'lsa — Bo\'limlar → Savdo\'da o\'sha yozuvni «Savdoni tuzatish» bilan to\'g\'rilang.') : null);
      saqla.textContent = n != null && k != null && (n || k) ? 'Saqlash — ' + H.som(n + k) : 'Saqlash';
      if (asosiy) asosiy.yangila({ matn: saqla.textContent });
    };
    const chiz = () => {
      const SM = asosiymi(f.filialId) ? [['kunduzgi', 'Kunduzgi'], ['tungi', 'Tungi'], ['kunlik', 'Butun kun']] : [['kunlik', 'Kunlik']];
      if (!SM.some(([v]) => v === f.smena)) f.smena = SM[0][0];
      const smG = pills(SM, f.smena, (v) => { f.smena = v; smenaX.xato(''); upd(); }, 'Smena');
      smenaX.i.focus = () => { const b = smG.querySelector('[aria-pressed="true"]'); if (b) b.focus(); };
      smenaJoy.replaceChildren(h('span', { class: 'muted' }, 'Smena'), smG, smenaX.el);
      const XL = S.xodimlar.filter((z) => z.rol === 'sotuvchi' && z.faol !== false && (z.filialId === f.filialId || z.qoshimchaFilial === f.filialId)).map((z) => [z.id, z.ism]);
      if (!XL.some(([v]) => v === f.xodimId)) f.xodimId = null;
      const xG = pills([...XL, ['', x.ism + ' (o\'zim)']], f.xodimId || '', (v) => { f.xodimId = v || null; xodimX.xato(''); upd(); }, 'Xodim');
      xodimX.i.focus = () => { const b = xG.querySelector('[aria-pressed="true"]'); if (b) b.focus(); };
      xodimJoy.replaceChildren(h('span', { class: 'muted' }, 'Kim ishlagan?'), xG, xodimX.el);
      upd();
    };
    boshqa.el.hidden = f.kunTanlov !== 'boshqa';
    const kunG = pills([['bugun', 'Bugun'], ['kecha', 'Kecha'], ['boshqa', 'Boshqa kun']], f.kunTanlov, (v) => { f.kunTanlov = v; boshqa.el.hidden = v !== 'boshqa'; upd(); }, 'Kun');
    const kunX = guruhXato(kunG);
    [naqd, karta, boshqa].forEach((z) => z.i.addEventListener('input', upd));
    const saqlaBos = () => {
      if (band) return;
      const kun = kunOl();
      const nV = String(naqd.i.value).trim() || '0', kV = String(karta.i.value).trim() || '0';
      const bosh = H.pul(nV) === 0 && H.pul(kV) === 0 ? 'Naqd yoki karta savdo summasini yozing' : null;
      if (xatolar([[naqd, String(naqd.i.value).trim() ? pulXato(naqd, null) : bosh], [karta, String(karta.i.value).trim() ? pulXato(karta, null) : null],
        [boshqa, f.kunTanlov === 'boshqa' && !/^\d{4}-\d{2}-\d{2}$/.test(kun) ? 'Sanani tanlang' : f.kunTanlov === 'boshqa' && kun > bugun ? 'Kelajakdagi kunga savdo yozib bo\'lmaydi' : null]])) return;
      const joyla = xatoJoyla([[naqd, /naqd|summa/i], [karta, /karta/i], [f.kunTanlov === 'boshqa' ? boshqa : kunX, /kun|sana|kelajak/i],
        [smenaX, /smena|allaqachon|ochiq/i], [xodimX, /xodim/i]]);
      band = true; if (asosiy) asosiy.yangila({ band: true });
      const tugadi = () => { band = false; if (asosiy) asosiy.yangila({ band: false }); };
      Promise.resolve(ctx.amalX(joyla, 'savdoKiritish', { filialId: f.filialId, smena: f.smena, xodimId: f.xodimId, kun, naqd: nV, karta: kV, hamyon: 'kassa' }))
        .then((ok) => { tugadi(); if (ok) { close(); ctx.toast('Savdo yozildi ✓'); } }, tugadi);
    };
    saqla.addEventListener('click', saqlaBos);
    box.append(
      qadam(1, 'Qaysi kun?'), kunG, kunX.el, boshqa.el,
      qadam(2, 'Qaysi filial?'), pills(S.filiallar.map((z) => [z.id, z.nom]), f.filialId, (v) => { f.filialId = v; chiz(); }, 'Filial'),
      qadam(3, 'Smena va kim ishlagan'), smenaJoy, xodimJoy,
      qadam(4, 'Savdo summasi'), naqd.el, karta.el,
      xulosa, saqla);
    chiz();
    return asosiy;
  });
}

// Yopilgan smena savdosini tuzatish (C2 savdo_tuzatish): xodim yoki siz naqd/karta summani xato yozgan bo'lsa.
// Hisob teskari va yangi yozuv bilan to'g'rilanadi, kim va nima uchun tuzatgani yoziladi, sherigingizga xabar boradi.
function savdoTuzatishSheet(ctx, z, nomi) {
  sheet('Savdoni tuzatish', (box, close) => {
    const naqd = input('Naqd savdo, so\'m', { value: String(z.naqd || 0) }), karta = input('Karta savdo (POS), so\'m', { value: String(z.karta || 0) });
    const sabab = input('Nima uchun tuzatyapsiz?', { inputmode: 'text', placeholder: 'Masalan: POS hisobotida 2 120 000 edi' });
    const farq = h('div', { class: 'calc', 'aria-live': 'polite' });
    const upd = () => {
      const n = H.pul(naqd.i.value), k = H.pul(karta.i.value);
      const eski = 'Hozir: naqd ' + H.som(z.naqd) + ', karta ' + H.som(z.karta);
      if (n == null || k == null) { farq.textContent = eski; return; }
      const d = n + k - (z.naqd || 0) - (z.karta || 0);
      farq.textContent = eski + '. Yangi: naqd ' + H.som(n) + ', karta ' + H.som(k) + '. Jami savdo ' + (d === 0 ? 'o\'zgarmaydi' : (d > 0 ? 'ko\'payadi: +' : 'kamayadi: ') + H.som(d));
    };
    [naqd, karta].forEach((f) => f.i.addEventListener('input', upd));
    box.append(h('div', { class: 'muted' }, nomi + ' · ' + sana(z.yopildi) + ' ' + vaqt(z.yopildi)), naqd.el, karta.el, farq, sabab.el,
      h('div', { class: 'msg info' }, (z.qolda
        ? 'Seyf va bankdagi yozuvlari teskari va yangi yozuv bilan to\'g\'rilanadi.'
        : 'Karta o\'zgarsa — bankdagi POS yozuvi to\'g\'rilanadi. Naqd o\'zgarsa — smena hisobi (kamomad yoki ortiqcha) qayta hisoblanadi.')
        + ' Kim va nima uchun tuzatgani yoziladi, sherigingizga xabar boradi.'),
      h('button', { class: 'p', onclick: () => {
        const n = H.pul(naqd.i.value), k = H.pul(karta.i.value);
        const ozgarmadi = n != null && k != null && n === (z.naqd || 0) && k === (z.karta || 0) ? 'Summalar o\'zgarmagan — tuzatish kerak emas' : null;
        const nol = z.qolda && n === 0 && k === 0 ? 'Savdo 0 bo\'lsa — «Bekor qilish» ni ishlating' : null;
        if (xatolar([[naqd, pulXato(naqd, 'Yozing (naqd bo\'lmasa — 0)') || ozgarmadi || nol], [karta, pulXato(karta, 'Yozing (karta bo\'lmasa — 0)')],
          [sabab, matnBormi(sabab, 2) ? null : 'Sababini yozing']])) return;
        ctx.amalX(xatoJoyla([[karta, /karta|pos/i], [sabab, /sabab/i], [naqd, /naqd|summa|o'zgarma|savdo 0|hamyon/i]]), 'savdoTuzatish', z.id, naqd.i.value, karta.i.value, sabab.i.value)
          .then((ok) => ok && (close(), ctx.toast('Savdo tuzatildi ✓')));
      } }, 'Tuzatishni saqlash'));
    upd();
  });
}

// Xodimni vaqtincha boshqa filialga (masalan, o'sha filial xodimi ta'tilda). Muddat o'tsa — o'zi qaytadi.
// Ikkinchi ish joyi: xodim ikki joyda smena ochadi (masalan kunduzi filialda, tunda Osnovnoyda). Smena ochishda xodim tanlaydi.
function qoshimchaSheet(ctx, z, fil) {
  const { S } = ctx;
  sheet(z.ism + ' — ikkinchi ish joyi', (box, close) => {
    let filial = z.qoshimchaFilial || null, smena = z.qoshimchaSmena && z.qoshimchaSmena !== 'kunlik' ? z.qoshimchaSmena : 'tungi';
    const smJoy = h('div', {});
    const smChiz = () => {
      const f = S.filiallar.find((x) => x.id === filial);
      smJoy.replaceChildren(...(f && f.asosiy ? [h('b', {}, 'Qaysi smena?'), pills([['kunduzgi', 'Kunduzgi'], ['tungi', 'Tungi']], smena, (v) => { smena = v; }, 'Smena')]
        : f ? [h('div', { class: 'muted' }, 'Filialda smena — kunlik.')] : []));
    };
    const filG = pills(S.filiallar.map((f) => [f.id, f.nom]), filial, (v) => { filial = v; filX.xato(''); smChiz(); }, 'Filial');
    const filX = guruhXato(filG);
    smChiz();
    box.append(...[h('div', { class: 'muted' }, 'Asosiy ish joyi: ' + fil(z.filialId) + ' · ' + (z.smena || '') + '. Ikkinchi joy belgilansa, '
        + z.ism + ' ikkinchi joy uchun ham «+ Savdo kiritish»da tanlanadi.'),
      h('b', {}, 'Ikkinchi ish joyi — qaysi filial?'), filG, filX.el, smJoy,
      h('button', { class: 'p', onclick: () => {
        if (xatolar([[filX, filial ? null : 'Filialni tanlang']])) return;
        const f = S.filiallar.find((x) => x.id === filial);
        ctx.amalX(xatoJoyla([[filX, /filial|smena|asosiy/i]]), 'xodimQoshimcha', z.id, filial, f && f.asosiy ? smena : 'kunlik').then((ok) => ok && (close(), ctx.toast('Saqlandi ✓')));
      } }, 'Saqlash'),
      z.qoshimchaFilial ? h('button', { onclick: () => ctx.amal('xodimQoshimcha', z.id, '', '').then((ok) => ok && (close(), ctx.toast('Ikkinchi ish joyi olib tashlandi'))) }, 'Olib tashlash') : null].filter(Boolean));
  });
}

function vaqtinchaSheet(ctx, z, fil) {
  const { S } = ctx;
  sheet(z.ism + ' — vaqtincha filial', (box, close) => {
    let filial = z.vaqtinchaFilial || null;
    const gacha = input('Qaysi kungacha? (bo\'sh — o\'zingiz qaytarguningizcha)', { type: 'date', inputmode: 'text', value: z.vaqtinchaGacha || '' });
    const filG = pills(S.filiallar.filter((f) => f.id !== z.filialId).map((f) => [f.id, f.nom]), filial, (v) => { filial = v; filX.xato(''); }, 'Filial');
    const filX = guruhXato(filG);
    box.append(...[h('div', { class: 'muted' }, 'Asosiy filiali: ' + fil(z.filialId) + '. Shu muddatda u tanlangan filialda smena ochadi, qarz va defektura yozadi.'),
      h('b', {}, 'Qaysi filialga?'), filG, filX.el,
      gacha.el,
      h('button', { class: 'p', onclick: () => {
        if (xatolar([[filX, filial ? null : 'Filialni tanlang'], [gacha, gacha.i.value && gacha.i.value < H.kunKey(Date.now()) ? 'Sana o\'tib ketgan' : null]])) return;
        ctx.amalX(xatoJoyla([[gacha, /sana|kun/i], [filX, /filial|smena/i]]), 'xodimVaqtincha', z.id, filial, gacha.i.value).then((ok) => ok && (close(), ctx.toast('Biriktirildi ✓')));
      } }, 'Saqlash'),
      z.vaqtinchaFilial ? h('button', { onclick: () => ctx.amal('xodimVaqtincha', z.id, '', '').then((ok) => ok && (close(), ctx.toast('O\'z filialiga qaytdi ✓'))) }, 'O\'z filialiga qaytarish') : null].filter(Boolean));
  });
}

const ROL = [['sotuvchi', 'Sotuvchi'], ['direktor', 'Direktor']];
const SMENA = [['kunduzgi', 'Kunduzgi'], ['tungi', 'Tungi'], ['kunlik', 'Kunlik (filial)']];

function xodimSheet(ctx) {
  const { S } = ctx;
  sheet('Yangi xodim', (box, close) => {
    const f = { filialId: S.filiallar[0] && S.filiallar[0].id, rol: 'sotuvchi', smena: 'kunduzgi' };
    const ism = input('Ism-sharifi', { inputmode: 'text' }), oylik = input('Oyligi, so\'m (bo\'lmasa — bo\'sh)');
    const smG = pills(SMENA, f.smena, (v) => { f.smena = v; }, 'Smena');
    const smX = guruhXato(smG);
    const smenaQator = h('div', { style: 'display:flex;flex-direction:column;gap:8px' }, h('b', {}, 'Qaysi smenada ishlaydi?'), smG, smX.el);
    const filG = pills(S.filiallar.map((z) => [z.id, z.nom]), f.filialId, (v) => { f.filialId = v; }, 'Filial');
    const filX = guruhXato(filG);
    const rolG = pills(ROL, f.rol, (v) => { f.rol = v; smenaQator.hidden = v !== 'sotuvchi'; }, 'Roli');
    const rolX = guruhXato(rolG);
    box.append(ism.el, h('b', {}, 'Filial'), filG, filX.el,
      h('b', {}, 'Roli'), rolG, rolX.el,
      smenaQator, oylik.el,
      h('div', { class: 'msg info' }, 'Saqlangach — ro\'yxatda "Havola yuborish" ni bosib, havolani shu xodimga Telegram\'da yuboring. U bosganda ilova ochiladi va u ulanadi.'),
      h('button', { class: 'p', onclick: () => {
        if (xatolar([[ism, matnBormi(ism, 2) ? null : 'Ismini yozing'], [oylik, String(oylik.i.value).trim() ? pulXato(oylik, null) : null]])) return;
        ctx.amalX(xatoJoyla([[ism, /ism/i], [filX, /filial/i], [rolX, /rol/i], [smX, /smena/i], [oylik, /oylik/i]]), 'xodimQosh', { ...f, ism: ism.i.value, oylik: oylik.i.value })
          .then((ok) => ok && close());
      } }, 'Saqlash'));
  });
}

// Bir martalik havola: xodim bosadi → Telegram ilovani ochadi → server uni shu xodimga bog'laydi.
// Xodim va ta'minotchi havolasi (27.10 dan ta'minotchi ham) — avval telefon raqami: havola faqat shu raqamli Telegram'da ochiladi.
function taklifSheet(ctx, z, amal = 'taklifYarat') {
  const ta = amal === 'taTaklifYarat';
  if (!ta && amal !== 'taklifYarat') return havolaSheet(ctx, z, amal);
  sheet('Havola: ' + (z.ism || z.nom), (box, close) => {
    const tel = input('Telefon raqami (Telegram\'dagi)', { type: 'tel', inputmode: 'tel', value: z.telefon || '' });
    box.append(h('div', { class: 'msg info' }, 'Havola faqat shu raqamli Telegram\'da ochiladi — boshqa odamga borib qolsa, u ocha olmaydi.'), tel.el,
      h('button', { class: 'p', onclick: () => {
        if (xatolar([[tel, H.normTel(tel.i.value) ? null : 'Telefon raqami noto\'g\'ri (+998 XX XXX XX XX)']])) return;
        ctx.amalX(xatoJoyla([[tel, /telefon|raqam/i]]), ta ? 'taminotchiTelefon' : 'xodimTelefon', z.id, tel.i.value)
          .then((t) => { if (!t) return; close(); havolaSheet(ctx, z, amal, typeof t === 'string' ? t : H.normTel(tel.i.value)); });
      } }, 'Havola yaratish'));
  });
}

function havolaSheet(ctx, z, amal, telefon = null) {
  const ism = z.ism || z.nom;
  ctx.amal(amal, z.id).then((kod) => {
    if (typeof kod !== 'string' || !kod) return;   // havola/kalit matni kelmadi (xato yoki takror)
    const link = 'https://t.me/' + BOT_USERNAME + '?startapp=' + kod;
    const tgApp = window.Telegram && window.Telegram.WebApp;
    sheet('Taklif: ' + ism, (box) => {
      box.append(...[h('div', { class: 'msg info' }, 'Havolani faqat ' + ism + ' ga yuboring. 48 soat amal qiladi va bir marta ishlaydi'
          + (telefon ? ' — faqat ' + telefon + ' raqamli Telegram\'da ochiladi.' : '.')),
        ctx.server && tgApp && tgApp.openTelegramLink
          ? h('button', { class: 'p', onclick: () => tgApp.openTelegramLink('https://t.me/share/url?url=' + encodeURIComponent(link)) }, 'Telegram orqali yuborish') : null,
        h('button', { onclick: () => nusxaOl(link, ctx.toast) }, 'Havoladan nusxa olish'),
        h('div', { class: 'calc', 'data-asl': '', style: 'word-break:break-all;font-size:13px' }, link),
        ctx.server ? null : h('div', { class: 'muted' }, 'Sinov rejimida havola ishlamaydi — faqat ko\'rinishi.')].filter(Boolean));
    });
  });
}

// Xarid: qaysi dori, nechta, dona narxi — daftardagidek. Jami o'zi hisoblanadi.
// Ro'yxatsiz yozish ham mumkin ("faqat jami summa") — lekin sukut bo'yicha ro'yxat.
// saqla(summa, izoh, qatorlar, xatoQoy) → Promise; berilmasa — direktor xaridi. Ta'minotchi ekrani ham shu oynani ishlatadi.
export function xaridSheet(ctx, t, saqla = null, sarlavha = t.nom + ' — xarid') {
  const dirYozadi = !saqla;   // direktor yozadi (ta'minotchi o'z saqla funksiyasi bilan chaqiradi)
  if (!saqla) saqla = (s, iz, rows, j) => ctx.amalX(j, 'xarid', t.id, s, iz, rows);
  const esl = H.xaridEslatma(t);   // shu ta'minotchining oldingi xaridlaridagi dori nomlari («Shumi?»)
  sheet(sarlavha, (box, close) => {
    const rows = [];
    let royxatsiz = false;
    const list = h('div', { style: 'display:flex;flex-direction:column;gap:8px' });
    const jami = h('div', { class: 'calc', 'aria-live': 'polite' });
    const jamiX = guruhXato(null);
    const s = input('Jami summa, so\'m'), iz = input('Izoh yoki faktura raqami (ixtiyoriy' + (dirYozadi && t.ulangan ? ', ta\'minotchi ko\'radi)' : ')'), { inputmode: 'text' });
    const qiymat = () => (royxatsiz ? [] : rows.filter((q) => q.el.isConnected).map((q) => ({ dori: q.d.i.value, soni: q.n.i.value, narx: q.p.i.value })));
    const upd = () => {
      list.hidden = royxatsiz; qoshBtn.hidden = royxatsiz; s.el.hidden = !royxatsiz;
      rejim.textContent = royxatsiz ? 'Dori ro\'yxati bilan yozish' : 'Ro\'yxatsiz — faqat jami summa';
      jamiX.xato('');
      if (royxatsiz) { jami.hidden = true; return; }
      jami.hidden = false;
      const r = H.xaridQatorlar(qiymat());
      jami.textContent = r.xato || (r.qatorlar.length ? 'Jami: ' + H.som(r.jami) + ' · ' + r.qatorlar.length + ' xil dori' : 'Dori nomi, sonini va bir donasining narxini yozing');
    };
    const qosh = () => {
      const q = { d: input('Dori nomi', { inputmode: 'text', placeholder: 'Masalan: Trombopol 150 mg №60' }), n: input('Soni'), p: input('Narxi (1 dona)') };
      [q.d, q.n, q.p].forEach((f) => f.i.addEventListener('input', upd));
      // «Shumi?» — shu ta'minotchining oldingi xaridlaridagi nomlar (04.11): bosilsa nom va oxirgi narx yoziladi.
      const tk = h('div', { class: 'shumi', 'aria-live': 'polite' });
      const taklif = () => {
        tk.textContent = '';
        const l = H.doriTaklif(esl, q.d.i.value);
        if (!l.length) return;
        tk.append(h('span', { class: 'muted' }, 'Shumi?'), ...l.map((e) => h('button', { type: 'button', class: 'shumi-t', 'data-klav': 'qoldir', onclick: () => {
          q.d.i.value = e.dori;
          if (!String(q.p.i.value).trim() && e.narx) q.p.i.value = String(e.narx);
          tk.textContent = ''; upd(); q.n.i.focus();
        } }, h('span', { 'data-asl': '' }, e.dori), e.narx ? h('small', {}, 'oxirgi narx ' + H.som(e.narx)) : null)));
      };
      q.d.i.addEventListener('input', taklif);
      const ochir = h('button', { type: 'button', class: 's', style: 'flex:none;width:44px;padding:0', 'aria-label': 'Qatorni o\'chirish', onclick: () => { q.el.remove(); upd(); qoshBtn.focus(); } }, '✕');
      q.el = h('div', { class: 'card', style: 'gap:6px;padding:12px;box-shadow:inset 0 0 0 1px var(--sep)' }, h('div', { class: 'row', style: 'align-items:center' }, h('b', {}, 'Dori'), rows.length ? ochir : null), q.d.el, tk, h('div', { class: 'row' }, q.n.el, q.p.el));
      rows.push(q);
      list.append(q.el);
      upd();
      return q;
    };
    const qoshBtn = h('button', { type: 'button', onclick: () => qosh().d.i.focus() }, '+ Yana dori');
    const rejim = h('button', { type: 'button', class: 'link', onclick: () => { royxatsiz = !royxatsiz; upd(); } });
    qosh();
    box.append(list, qoshBtn, jami, jamiX.el, s.el, rejim, iz.el,
      h('button', { class: 'p', onclick: () => {
        if (royxatsiz) { if (xatolar([[s, pulXato(s, 'Xarid summasini yozing')]])) return; }
        else {
          const r = H.xaridQatorlar(qiymat());
          const birinchi = rows.find((q) => q.el.isConnected);
          jamiX.i.focus = () => birinchi && birinchi.d.i.focus();
          if (xatolar([[jamiX, r.xato || (r.qatorlar.length ? null : 'Kamida bitta dori yozing yoki "Ro\'yxatsiz" ni tanlang')]])) return;
        }
        // Oldingi nomdan bir-ikki harf bilan farq qilsa — «Avval «…» deb yozilgan. Shumi?» (bitta dori ikki nom bilan yozilmasin).
        const tekshir = royxatsiz ? [] : rows.filter((q) => q.el.isConnected).map((q) => [q, H.doriOxshash(esl, q.d.i.value)]).filter(([, e]) => e);
        tekshir.reduce((p, [q, e]) => p.then(() => tasdiqlash('«' + q.d.i.value.trim() + '» deb yozdingiz. Avval «' + e.dori + '» deb yozilgan — shumi?')
          .then((ha) => { if (ha) q.d.i.value = e.dori; })), Promise.resolve())
          .then(() => saqla(royxatsiz ? s.i.value : '', iz.i.value, qiymat(), xatoJoyla(royxatsiz ? [[s, /summa/i]] : [[jamiX, /qator|summa|dori/i]])))
          .then((ok) => ok && close());
      } }, 'Saqlash'));
    upd();
  });
}

// Hamyonda pul yetmasa — direktordan tasdiq (boshlang'ich qoldiq kiritilmagan bo'lishi mumkin). Promise<boolean>.
function yetarlimi(S, d) {
  const y = yetmaydi(S, d);
  if (!y.length) return Promise.resolve(true);
  return tasdiqlash(y.map((z) => HAM[z.hamyon] + 'da ' + H.som(z.qoldiq) + ' bor').join(', ') + '. Baribir yozilsinmi?');
}

// Seyfdan pul chiqdi (26.10, foydalanuvchi qarori: "apteka xarajatlari faqat oylik, ta'minotchi, bankka topshirish; uyga olib
// ketish ham — lekin uydagi pul hisoblanmaydi"). Har tur — mavjud amal: avans (oylik), ta'minotchiga to'lov (seyfdan),
// Seyf → Bank va Seyf → Uy ko'chirishi. Uy qoldig'i hech qayerda ko'rsatilmaydi (UY_PULI = false).
// Tartib (29.10, foydalanuvchi): 1 Bank, 2 Uy, 3 Ta'minotchi, 4 Oylik; standart — Bank.
// 29.10: «Xarajat» — kassadan mayda xarajat (suv, paket, kommunal…): xodimlar endi o'zi yozmaydi.
const CHIQISH = [['bank', 'Bankka'], ['uy', 'Uyga'], ['tamin', 'Ta\'minotchi'], ['oylik', 'Oylik'], ['xarajat', 'Xarajat']];
function pulChiqdiSheet(ctx, bosh = 'bank') {
  const { S } = ctx;
  // Oylik qaysi oy uchun (audit 27.10): oy boshida (1–10-kunlar) odatda o'tgan oyning oyligi beriladi — standart shu.
  const shuOy = oyKey(), otganOy = H.oyQosh(shuOy, -1);
  let oy = Number(H.kunKey(Date.now()).slice(8, 10)) <= 10 ? otganOy : shuOy;
  const OY_NOM = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
  const oyNomi = (k) => OY_NOM[Number(k.slice(5, 7)) - 1];
  const XOD = S.xodimlar.filter((z) => z.oylik && z.faol !== false);
  const f = { tur: bosh, xodim: XOD.length === 1 ? XOD[0].id : null, tamin: S.taminotchilar.length === 1 ? S.taminotchilar[0].id : null, toifa: null };
  sheet('Seyfdan pul chiqdi', (box, close) => {
    const dyn = h('div', { style: 'display:flex;flex-direction:column;gap:10px' });
    const tanlovX = guruhXato(null);
    const summa = input('Summa, so\'m'), izoh = input('Izoh (ixtiyoriy)', { inputmode: 'text' });
    const draw = () => {
      dyn.textContent = '';
      tanlovX.xato('');
      if (f.tur === 'oylik') {
        if (!XOD.length) dyn.append(h('div', { class: 'msg info' }, 'Oyligi belgilangan xodim yo\'q — Sozlamalar → Xodimlar'));
        else {
          dyn.append(h('b', {}, 'Kimga?'), pills(XOD.map((z) => [z.id, z.ism]), f.xodim, (v) => { f.xodim = v; draw(); }, 'Xodim'));
          const z = XOD.find((x) => x.id === f.xodim);
          dyn.append(h('b', {}, 'Qaysi oy uchun?'), pills([[otganOy, 'O\'tgan oy (' + oyNomi(otganOy) + ')'], [shuOy, 'Shu oy (' + oyNomi(shuOy) + ')']], oy, (v) => { oy = v; draw(); }, 'Oy'));
          if (z) dyn.append(h('div', { class: 'muted' }, 'Oylik ' + H.som(z.oylik) + ' · ' + oyNomi(oy) + ' uchun yana berish mumkin: ' + H.som(H.oyOxiri(z, oy))));
        }
      } else if (f.tur === 'tamin') {
        if (!S.taminotchilar.length) dyn.append(h('div', { class: 'msg info' }, 'Ta\'minotchi qo\'shilmagan — Ta\'minot bo\'limida qo\'shing'));
        else {
          dyn.append(h('b', {}, 'Qaysi ta\'minotchi?'), pills(S.taminotchilar.map((t) => [t.id, t.nom]), f.tamin, (v) => { f.tamin = v; draw(); }, 'Ta\'minotchi'));
          const t = S.taminotchilar.find((x) => x.id === f.tamin);
          if (t) dyn.append(h('div', { class: 'muted' }, 'Qarzimiz: ' + H.som(H.bizBoyicha(t)) + (t.ulangan ? ' · ta\'minotchi telefonida tasdiqlaydi' : '')));
        }
      } else if (f.tur === 'xarajat') {
        dyn.append(h('b', {}, 'Nimaga?'), pills(['Xo\'jalik', ...APTEKA_TOIFA.filter((t) => t !== 'Xo\'jalik')].map((t) => [t, t]), f.toifa, (v) => { f.toifa = v; tanlovX.xato(''); }, 'Xarajat turi'),
          h('div', { class: 'muted' }, 'Seyfdan chiqadi va apteka xarajatiga yoziladi. Masalan: suv, paket, kommunal.'));
      } else if (f.tur === 'bank') {
        dyn.append(h('div', { class: 'muted' }, 'Seyfdagi pul bankka topshirildi. Bu xarajat emas — pul seyfdan bankka o\'tadi.'));
      } else {
        dyn.append(h('div', { class: 'muted' }, 'Seyfdan chiqadi va «Uyga olib ketildi» deb yoziladi. Uyda qancha pul borligi hisoblanmaydi.'));
      }
      dyn.append(tanlovX.el);
    };
    box.append(h('div', { class: 'muted' }, 'Seyfda hozir: ' + H.som(qoldiq(S, 'kassa'))),
      pills(CHIQISH, f.tur, (v) => { f.tur = v; draw(); }, 'Nimaga?'), dyn, summa.el, izoh.el,
      h('button', { class: 'p', onclick: () => {
        const v = H.pul(summa.i.value);
        if (xatolar([[summa, pulXato(summa, 'Summani yozing') || (v === 0 ? 'Summani yozing' : null)]])) return;
        if (f.tur === 'oylik' && !f.xodim) { tanlovX.xato('Xodimni tanlang'); return; }
        if (f.tur === 'tamin' && !f.tamin) { tanlovX.xato('Ta\'minotchini tanlang'); return; }
        if (f.tur === 'xarajat' && !f.toifa && !String(izoh.i.value).trim()) { tanlovX.xato('Turini tanlang yoki izohga nimaga ketganini yozing'); return; }
        const joyla = xatoJoyla([[summa, /summa|avans|oylik|kamida/i], [tanlovX, /xodim|ta'minotchi/i]]);
        let ish;
        if (f.tur === 'oylik') {
          const z = XOD.find((x) => x.id === f.xodim), qol = H.oyOxiri(z, oy);
          if (v > qol) { xatolar([[summa, oyNomi(oy) + ' oyi uchun ' + z.ism + 'ga ' + H.som(qol) + ' dan ko\'p berib bo\'lmaydi']]); return; }
          ish = () => ctx.amalX(joyla, 'avansBerish', z.id, summa.i.value, 'kassa', oy);
        } else if (f.tur === 'tamin') {
          ish = () => ctx.amalX(joyla, 'tolov', f.tamin, { kassa: summa.i.value }, izoh.i.value);
        } else if (f.tur === 'xarajat') {
          const iz = String(izoh.i.value).trim();
          ish = () => ctx.amalX(joyla, 'yozuv', { tur: 'xarajat', soha: 'apteka', hamyon: 'kassa', summa: summa.i.value,
            izoh: f.toifa ? f.toifa + (iz ? ' — ' + iz : '') : iz });
        } else {
          ish = () => ctx.amalX(joyla, 'yozuv', { tur: 'kochirish', soha: 'apteka', dan: 'kassa', ga: f.tur === 'bank' ? 'bank' : 'uy', summa: summa.i.value,
            izoh: String(izoh.i.value).trim() || (f.tur === 'bank' ? 'Bankka topshirildi' : 'Uyga olib ketildi') });
        }
        yetarlimi(S, { kassa: -v }).then((ha) => ha && ish().then((ok) => ok && (close(), ctx.toast(H.som(v) + ' — yozildi ✓'))));
      } }, 'Saqlash'));
    draw();
  });
}

// Xarajat turlari — uy pulini oyma-oy ko'rish uchun (izoh boshiga yoziladi: "Oila — ...").
const TOIFA = ['Oila', 'Ro\'zg\'or', 'Transport', 'Kommunal', 'Ijara', 'Qurilish', 'Boshqa'];
const APTEKA_TOIFA = ['Kommunal', 'Ijara', 'Soliq', 'Xo\'jalik', 'Transport', 'Boshqa'];
export const toifasi = (izoh) => { const t = String(izoh || '').split(' — ')[0]; return TOIFA.includes(t) ? t : 'Boshqa'; };

function yozuvSheet(ctx, bosh = {}) {
  const { S } = ctx;
  sheet('Yangi yozuv', (box, close) => {
    const f = { tur: 'xarajat', hamyon: 'kassa', dan: 'kassa', ga: UY_PULI ? 'uy' : 'bank', toifa: null, ...bosh };
    const summa = input('Summa, so\'m'), izoh = input('Izoh', { inputmode: 'text', placeholder: 'Nima uchun / qayerdan' });
    const dyn = h('div', { style: 'display:flex;flex-direction:column;gap:8px' });
    const dynX = guruhXato(dyn);
    const note = h('div', { class: 'msg info' });
    const draw = () => {
      dyn.textContent = '';
      dynX.xato('');
      if (f.tur === 'kochirish' && !UY_PULI) {
        // Uy puli yashirin: ko'chirish faqat Seyf → Bank (bankka topshirish).
        f.dan = 'kassa'; f.ga = 'bank';
        dyn.append(h('b', {}, 'Seyf → Bank'));
        note.textContent = 'Seyfdagi pulni bankka topshirdingiz — xarajat ham, kirim ham emas.';
      } else if (f.tur === 'kochirish') {
        dyn.append(h('b', {}, 'Qayerdan'), pills(NAQD, f.dan, (v) => { f.dan = v; }, 'Qayerdan'),
          h('b', {}, 'Qayerga'), pills([['uy', 'Uy'], ['kassa', 'Seyf'], ['bank', 'Bank']], f.ga, (v) => { f.ga = v; }, 'Qayerga'));
        note.textContent = 'Pul bir joydan boshqasiga o\'tadi — xarajat ham, kirim ham emas. Masalan: seyfdan uyga olib ketdingiz.';
      } else {
        // Apteka yozuvi — faqat seyf; uy yozuvi — faqat uy (Uy puli sahifasidan). Aralashmaydi.
        if (f.soha === 'apteka') { f.hamyon = 'kassa'; dyn.append(h('div', { class: 'muted' }, f.tur === 'kirim' ? 'Pul seyfga tushadi.' : 'Pul seyfdan chiqadi.' + (UY_PULI ? ' Uy xarajati — Bo\'limlar → Uy puli.' : ''))); }
        else if (f.soha === 'uy') { f.hamyon = 'uy'; dyn.append(h('div', { class: 'muted' }, f.tur === 'kirim' ? 'Pul uyga tushadi.' : 'Uydan to\'langan xarajat — aptekaning hisobiga kirmaydi.')); }
        else if (UY_PULI) dyn.append(h('b', {}, f.tur === 'kirim' ? 'Pul qayerga tushdi?' : 'Pul qayerdan chiqdi?'), pills(NAQD, f.hamyon, (v) => { f.hamyon = v; }, 'Hamyon'));
        else f.hamyon = 'kassa';
        const tf = f.hamyon === 'uy' || f.soha === 'uy' ? TOIFA : APTEKA_TOIFA;
        if (f.tur === 'xarajat') dyn.append(h('b', {}, 'Nimaga?'), pills(tf.map((t) => [t, t]), f.toifa, (v) => { f.toifa = v; izoh.xato(''); }, 'Xarajat turi'));
        note.textContent = f.tur === 'kirim' ? 'Savdodan tashqari tushum: vozvrat, sherik qo\'shgan pul. Qarz qaytishi — Mijozlar qarzi bo\'limidan.' : 'Smena kassasidan to\'langan xarajatni xodim o\'zi yozadi.';
      }
    };
    // Uy puli yashirin: bu oyna faqat kirim uchun ochiladi (pul chiqishi — "Seyfdan pul chiqdi" oynasida).
    box.append(!UY_PULI && bosh.tur === 'kirim' ? h('div', { class: 'muted' }, 'Savdodan tashqari tushum: vozvrat, sherik qo\'shgan pul. Pul seyfga tushadi.')
      : pills([['xarajat', 'Xarajat'], ['kirim', 'Kirim'], ['kochirish', 'Pul ko\'chirish']], f.tur, (v) => { f.tur = v; draw(); }, 'Yozuv turi'),
      dyn, dynX.el, summa.el, izoh.el, note,
      h('button', { class: 'p', onclick: () => {
        const izohXato = f.tur === 'kirim' && !matnBormi(izoh) ? 'Qayerdan kelganini yozing'
          : f.tur === 'xarajat' && !f.toifa && !matnBormi(izoh) ? 'Nimaga ketganini yozing yoki turini tanlang' : null;
        if (xatolar([[summa, pulXato(summa, 'Summani yozing') || (H.pul(summa.i.value) === 0 ? 'Summani yozing' : null)], [izoh, izohXato]])) return;
        const v = H.pul(summa.i.value) || 0;
        const d = f.tur === 'kochirish' ? { [f.dan]: -v } : f.tur === 'xarajat' ? { [f.hamyon]: -v } : {};
        const iz = f.tur === 'xarajat' && f.toifa ? f.toifa + (izoh.i.value.trim() ? ' — ' + izoh.i.value.trim() : '') : izoh.i.value;
        yetarlimi(S, d).then((ha) => ha && ctx.amalX(xatoJoyla([[summa, /summa/i], [izoh, /nima|qayerdan|izoh/i], [dynX, /yo'nalish|hamyon|tanlang/i]]), 'yozuv', { ...f, summa: summa.i.value, izoh: iz })
          .then((ok) => ok && close()));
      } }, 'Saqlash'));
    draw();
  });
}

// Topshirilgan pulni qabul qilish: sanab, haqiqatda kelgan summani yozasiz. Kam chiqsa — xodimga kamomad, sizga xabar.
function qabulSheet(ctx, z, xodimIsm) {
  const top = z.qabul.summa;
  sheet('Pulni qabul qilish', (box, close) => {
    const s = input('Sanab chiqing — qancha keldi?', { value: String(top) });
    const izoh = h('div', { class: 'calc', 'aria-live': 'polite' });
    const upd = () => {
      const v = H.pul(s.i.value);
      if (v == null) { izoh.textContent = 'Summani yozing'; izoh.style.color = ''; return; }
      const f = v - top;
      izoh.textContent = f === 0 ? 'Mos ✓ — ' + H.som(v) + ' seyfga qo\'shiladi' : (f < 0 ? 'Kam: ' : 'Ortiqcha: ') + H.som(Math.abs(f)) + ' — ' + xodimIsm + ' smenasiga ' + (f < 0 ? 'kamomad' : 'ortiqcha') + ' bo\'lib yoziladi';
      izoh.style.color = f < 0 ? 'var(--warn)' : '';
    };
    s.i.addEventListener('input', upd);
    box.append(h('div', {}, xodimIsm + ' ' + H.som(top) + ' topshirdi deb yozgan.'),
      z.tasdiq ? null : h('div', { class: 'msg info' }, 'Savdo: naqd ' + H.som(z.naqd) + ', karta ' + H.som(z.karta) + ' — pulni qabul qilsangiz, savdo ham tasdiqlanadi.'),
      s.el, izoh,
      h('button', { class: 'p', onclick: () => {
        const v = H.pul(s.i.value);
        if (xatolar([[s, pulXato(s, 'Summani yozing') || (v <= 0 ? 'Summani yozing' : null)]])) return;
        ctx.amalX(xatoJoyla([[s, /summa/i]]), 'smenaQabul', z.id, 'kassa', s.i.value).then((ok) => ok && (close(), ctx.toast(H.som(v) + ' seyfga qo\'shildi ✓')));
      } }, 'Qabul qildim'));
    upd();
  });
}

// Defektura qatori (direktor): nom, holat, filiallar, sana; narx — faqat Defekturada, firma narxlari ochiq bo'lsa.
function defQator(ctx, fil, d, narx) {
  const [l, c] = DEF_HOLAT[d.holat];
  return h('div', { class: 'item', 'data-rk': d.nom },   // data-rk — ro'yxat harakati kaliti (ui.royxatHarakat)
    h('div', { class: 'line', style: 'border:0;padding:0' }, h('b', { 'data-asl': '' }, d.nom), h('span', { style: 'color:' + c + ';white-space:nowrap;font-weight:600' }, l)),
    h('div', { class: 'muted' }, d.filiallar.map(fil).join(', ') + (d.soni > 1 ? ' · ' + d.soni + ' marta yozilgan' : '') + ' · '
      + (d.holat === 'buyurtma' && d.holatTs ? 'buyurtma ' + sana(d.holatTs) : sana(d.ts)) + (d.izohlar.length ? ' · ' + d.izohlar.join('; ') : '')),
    yozganEl(ctx.S, d),   // 06.11: kim yozgan
    narx && ctx.server && firmaOchiq() ? defNarxQator(d.nom) : null,
    ctx.server ? mijozBelgi(d) : null,   // 06.11 kech: direktorda faqat «N mijoz kutmoqda» (tugma — xodimlarda)
    h('div', { class: 'row' },
      d.holat === 'yangi' ? h('button', { class: 'p s', onclick: () => ctx.amal('defekturaHolat', d.nom, 'buyurtma') }, 'Buyurtma berdim') : null,
      h('button', { class: d.holat === 'buyurtma' ? 'p s' : 's', onclick: () => keldiTasdiq(d).then((ha) => ha && ctx.amal('defekturaHolat', d.nom, 'keldi')) }, 'Keldi'),
      h('button', { class: 's', onclick: () => tasdiqlash(d.nom + ' ro\'yxatdan olib tashlansinmi?').then((ha) => ha && ctx.amal('defekturaHolat', d.nom, 'bekor')) }, 'Kerak emas')));
}

// Defektura: hamma filiallar ro'yxati birlashgan ("2 marta yozilgan"). Ota buyurtma beradi → "Buyurtma berdim" → kelganda "Keldi".
// 03.11 (foydalanuvchi: "buyurtma berilganlar va kerak — 2 ta bo'lim"): tepada ikki bo'lim — «Kerak» (hali buyurtma berilmaganlar,
// firma narxlari bilan) va «Buyurtma berilganlar» (faqat ular, oxirgi buyurtma tepada). Bo'limlar menyusidan ikkalasiga ham kiriladi.
const DEF_TAB = { v: 'kerak' };
function defekturaDirektor(m, ctx, fil, ochFirmalar) {
  const { S } = ctx;
  const g = H.defekturaGuruh(S.defektura || []);
  const kerak = g.filter((d) => d.holat === 'yangi'), keldi = g.filter((d) => d.holat === 'keldi');
  const berilgan = g.filter((d) => d.holat === 'buyurtma').sort((a, b) => b.holatTs - a.holatTs);
  // 05.11 (foydalanuvchi: "kelgan dorilar birinchi ko'rinyapti — defektura ichida alohida bo'limda turishi kerak"): uchinchi bo'lim «Keldi».
  m.append(pills([['kerak', 'Kerak · ' + kerak.length], ['buyurtma', 'Buyurtma · ' + berilgan.length], ['keldi', 'Keldi · ' + keldi.length]], DEF_TAB.v,
    (v) => { DEF_TAB.v = v; ctx.rerender(); }, 'Defektura bo\'limi'));
  if (DEF_TAB.v === 'keldi') {
    m.append(h('div', { class: 'muted' }, 'Dori Oson\'ga kirim qilinganda, faktura Excel\'ga yozilganda yoki xaridda kelsa — o\'zi «Keldi» bo\'ladi va yozgan xodimga Telegram xabari boradi.'));
    const kl = h('div', { class: 'card list' }, kartaSarlavha('Keldi (oxirgi 14 kun)'));
    if (!keldi.length) kl.append(h('div', { class: 'muted' }, 'Oxirgi 14 kunda kelgan defektura dorisi yo\'q.'));
    keldi.sort((a, b) => b.holatTs - a.holatTs).forEach((d) => kl.append(h('div', { class: 'line' }, h('span', { 'data-asl': '' }, d.nom),
      h('span', { class: 'muted', style: 'text-align:right' }, d.filiallar.map(fil).join(', ') + (d.holatTs ? ' · ' + sana(d.holatTs) : '')
        + (yozganlar(S, d) ? ' · ' + yozganlar(S, d) : '')))));   // 06.11: kim yozgan
    m.append(kl, kelganKarta(S, { defsiz: true }));
    return;
  }
  if (DEF_TAB.v === 'buyurtma') {
    m.append(h('div', { class: 'muted' }, 'Kelganda «Keldi» bosing — fakturada yoki xaridda kelsa o\'zi o\'tadi.'));
    const list = h('div', { class: 'card list' }, kartaSarlavha('Buyurtma berilganlar (' + berilgan.length + ')'));
    if (!berilgan.length) list.append(h('div', { class: 'muted' }, 'Hozir buyurtma berilgan dori yo\'q. «Kerak» bo\'limida «Buyurtma berdim» bosilgan dorilar shu yerga o\'tadi.'));
    berilgan.forEach((d) => list.append(defQator(ctx, fil, d, false)));
    m.append(list);
    royxatHarakat(list, 'def:buyurtma');
    return;
  }
  m.append(h('div', { class: 'muted' }, 'Xodimlar kam qolgan dorini yozadi. «Buyurtma berdim» bosilsa — dori «Buyurtmada» bo\'limiga o\'tadi. Oson\'ga kirim qilinsa, faktura yoki xaridda kelsa — o\'zi «Keldi» bo\'limiga o\'tadi.'));
  const nusxa = kerak.map((d, i) => (i + 1) + '. ' + d.nom).join('\n');
  if (nusxa) m.append(h('button', { class: 's', onclick: () => nusxaOl(nusxa, ctx.toast, 'Ro\'yxat nusxalandi — Telegram\'da otangizga yuboring ✓') }, 'Buyurtma ro\'yxatini nusxalash'));
  // Firmalar narxi (30.10; 03.11 — yopiq, «Firmani tanlash» bilan ochiladi): ochiq bo'lsa — har dori ostida eng arzon firma.
  const fk = defFirmaKarta({ ...ctx.retseptCtx(), rerender: ctx.rerender, firma: ctx.firma }, kerak, () => ctx.rerender(), ochFirmalar);
  if (fk) m.append(fk);
  const list = h('div', { class: 'card list' }, kartaSarlavha('Kerak (' + kerak.length + ')'));
  if (!kerak.length) list.append(h('div', { class: 'muted' }, berilgan.length ? 'Hammasiga buyurtma berilgan ✓' : 'Hozircha hech narsa yozilmagan'));
  kerak.forEach((d) => list.append(defQator(ctx, fil, d, true)));
  m.append(list);
  // 07.11 tun: «Buyurtma berdim» / «Kerak emas» — qator yumshoq yo'qoladi, qolganlari joyiga suriladi (faqat yangi ko'rinishda).
  royxatHarakat(list, 'def:kerak');
  if (keldi.length) m.append(h('button', { type: 'button', class: 'link', onclick: () => { DEF_TAB.v = 'keldi'; ctx.rerender(); } }, 'Keldi bo\'limi: ' + keldi.length + ' ta dori ›'));
}

// Uy puli: qoldiq, oy bo'yicha qayerdan kirdi / nimaga ketdi, oxirgi sanash.
function uyView(m, ctx, uy) {
  const { S } = ctx;
  const oy = oyKey();
  const aslIzoh = (r) => (r.tur === 'tuzatish' ? (S.harakatlar.find((z) => z.id === r.asl) || {}).izoh : r.izoh) || '';
  const turi = (r) => (r.tur === 'tuzatish' ? r.aslTur : r.tur);
  const uyli = S.harakatlar.filter((r) => r.d && r.d.uy && H.kunKey(r.ts).startsWith(oy));
  const nomi = (r) => {
    const t = turi(r), iz = aslIzoh(r);
    if (t === 'xarajat') return /^Avans/i.test(iz) ? 'Avans' : toifasi(iz);
    return { kochirish: 'Ko\'chirish', tolov: 'Ta\'minotchilarga', qabul: 'Smena puli', filialdanPul: 'Filialdan', kirim: 'Kirim', olindi: 'Qutidan olindi' }[t] || t;
  };
  const kirdi = {}, ketdi = {};
  // Bekor qilish yozuvi (tuzatish) o'z asl guruhidan ayiriladi.
  uyli.forEach((r) => { const k = nomi(r), v = r.d.uy, asl = r.tur === 'tuzatish' ? -v : v; if (asl > 0) kirdi[k] = (kirdi[k] || 0) + v; else ketdi[k] = (ketdi[k] || 0) - v; });
  const jami = (o) => Object.values(o).reduce((a, b) => a + b, 0);
  const sanash = S.harakatlar.filter((r) => /sanashda/i.test(r.izoh || '') && r.d && r.d.uy).at(-1);
  m.append(h('div', { class: 'card hero' }, h('div', { class: 'line', style: 'border:0' }, h('h2', { class: 'muted', style: 'font-size:15px;font-weight:600' }, 'Uyda (hisob bo\'yicha)'), h('b', { class: 'big' }, H.som(uy))),
    h('div', { class: 'muted' }, sanash ? 'Oxirgi sanash: ' + sana(sanash.ts) : 'Hali sanalmagan — haftada bir marta sanang'),
    h('div', { class: 'row' }, h('button', { class: 's', onclick: () => sanashSheet(ctx, 'uy') }, 'Uyni sanash'),
      h('button', { class: 's', onclick: () => yozuvSheet(ctx, { tur: 'xarajat', hamyon: 'uy', soha: 'uy' }) }, '+ Uy xarajati'))));
  m.append(h('div', { class: 'muted' }, 'Uydan har xarajatni darhol yozing ("+ Uy xarajati" → turini tanlang). Haftada bir marta uydagi pulni sanang: kam chiqsa — yozilmay qolgan xarajat bor, ilova uni ko\'rsatadi.'));
  const blok = (sarlavha, o) => h('div', { class: 'card list' }, h('div', { class: 'line', style: 'border:0;padding:0' }, kartaSarlavha(sarlavha), h('b', {}, H.som(jami(o)))),
    ...(Object.keys(o).length ? Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, v]) => h('div', { class: 'line' }, h('span', {}, k), h('span', {}, H.som(v))))
      : [h('div', { class: 'muted' }, 'Bu oy yo\'q')]));
  m.append(blok('Bu oy uyga kirdi', kirdi), blok('Bu oy uydan ketdi', ketdi));
  const list = h('div', { class: 'card list' }, kartaSarlavha('Oxirgi yozuvlar'));
  const oxirgi = S.harakatlar.filter((r) => r.d && r.d.uy).slice(-30).reverse();
  if (!oxirgi.length) list.append(h('div', { class: 'muted' }, 'Hali yozuv yo\'q'));
  oxirgi.forEach((r) => list.append(h('div', { class: 'item' }, h('div', { class: 'line', style: 'border:0;padding:0' }, h('span', { style: r.bekor ? 'text-decoration:line-through' : '' }, r.izoh),
    h('b', { style: r.d.uy > 0 ? 'color:var(--accent)' : '' }, (r.d.uy > 0 ? '+' : '−') + H.som(Math.abs(r.d.uy)))), h('div', { class: 'muted' }, sana(r.ts) + ' ' + vaqt(r.ts)))));
  m.append(list);
}

// Sanash (C2 sanash): seyf yoki uydagi haqiqiy pulni yozasiz — farqni server yozish paytida o'zi hisoblaydi
// (shu orada sherigingiz yozgan xarajat ham hisobga kiradi). Farq bo'lsa — daftarga yoziladi.
function sanashSheet(ctx, hamyon) {
  const { S } = ctx;
  const hisob = qoldiq(S, hamyon);   // faqat ko'rsatish uchun — telefondagi holat bo'yicha
  sheet((hamyon === 'uy' ? 'Uydagi' : 'Seyfdagi') + ' pulni sanash', (box, close) => {
    const bor = input('Hozir aslida qancha bor? Sanab yozing');
    const izoh = input('Farq nimadan? (bilsangiz)', { inputmode: 'text', placeholder: 'Masalan: bozorlik, yozish esdan chiqqan' });
    const natija = h('div', { class: 'calc', 'aria-live': 'polite' });
    const upd = () => {
      const v = H.pul(bor.i.value);
      if (v == null) { natija.textContent = 'Hisob bo\'yicha: ' + H.som(hisob); return; }
      const fq = v - hisob;
      natija.textContent = fq === 0 ? 'Mos ✓ — hisob to\'g\'ri' : (fq < 0 ? 'Taxminan kam: ' : 'Taxminan ortiqcha: ') + H.som(Math.abs(fq)) + ' (hisobda ' + H.som(hisob) + ')';
    };
    bor.i.addEventListener('input', upd);
    // Pul auditi 28.10: qabul qilinmagan topshirish bor — pul seyfga qo'yilgan bo'lsa, sanash uni "ortiqcha" deb yozadi, keyin
    // «Qabul qilish» yana qo'shadi (ikki marta sanaladi). Avval qabul qilish so'raladi.
    const kutil = hamyon === 'kassa' ? S.smenalar.filter((z) => z.qabul && z.qabul.holat === 'kutilmoqda' && !z.bekor) : [];
    const kutilJami = kutil.reduce((a, z) => a + (z.qabul.summa || 0), 0);
    box.append(kutil.length ? h('div', { class: 'msg warn' }, 'Qabul qilinmagan topshirish bor: ' + kutil.length + ' ta, jami ' + H.som(kutilJami)
      + '. Avval Bosh sahifada «Qabul qilish»ni bosing — aks holda shu pul ikki marta sanaladi.') : null,
      h('div', { class: 'msg info' }, 'Har hafta sanab turing. Kam chiqsa — demak yozilmagan xarajat bor: u "Boshqa" xarajat bo\'lib daftarga yoziladi va hisob to\'g\'rilanadi. Aniq farq saqlanganda hisoblanadi — shu orada yozilgan xarajatlar ham kiradi.'),
      bor.el, natija, izoh.el,
      h('button', { class: 'p', onclick: async () => {
        if (xatolar([[bor, pulXato(bor, 'Sanab chiqqan summani yozing')]])) return;
        if (kutil.length && !(await tasdiqlash(H.som(kutilJami) + ' topshirish hali qabul qilinmagan. Shu pul seyfda bo\'lsa — avval qabul qiling. Baribir sanash saqlansinmi?'))) return;
        const v = H.pul(bor.i.value);
        ctx.amalX(xatoJoyla([[bor, /summa|haqiqiy|pul/i], [izoh, /izoh/i]]), 'sanash', hamyon, bor.i.value, izoh.i.value.trim()).then((fq) => {
          if (fq === null) return;
          close();
          ctx.toast(sanashXabari(fq, hamyon, v));   // farq raqam yoki matn ("-50000", bigint) bo'lib kelishi mumkin
        });
      } }, 'Saqlash'));
    upd();
  });
}

function tolovSheet(ctx, t) {
  const { S } = ctx;
  sheet(t.nom + ' — to\'lov', (box, close) => {
    // Uy puli hisoblanmasa ham (UY_PULI = false) ta'minotchiga uydan berilgan pul yoziladi — qarz kamayadi, seyf o'zgarmaydi
    // (28.10: "Bobomurodga 10 000 000 uydan berildi — qayerdan kiritaman?").
    const u = input(UY_PULI ? 'Uydan' : 'Uydan (seyfga ta\'sir qilmaydi)'), k = input('Seyfdan'), b = input('Bankdan'), iz = input('Izoh yoki to\'lov topshiriqnomasi № (ixtiyoriy' + (t.ulangan ? ', ta\'minotchi ko\'radi — hamyonni yozmang)' : ')'), { inputmode: 'text' });
    const jami = h('div', { class: 'calc', 'aria-live': 'polite' });
    const upd = () => { const r = H.tolovTekshir({ uy: u.i.value, kassa: k.i.value, bank: b.i.value }); jami.textContent = 'Jami: ' + (r.jami ? H.som(r.jami) : '—'); };
    [u, k, b].forEach((f) => f.i.addEventListener('input', upd));
    box.append(h('div', { class: 'muted' }, 'Qaysi joydan qancha berdingiz? Keraksizini bo\'sh qoldiring.'), ...(UY_PULI ? [u.el, k.el, b.el] : [k.el, b.el, u.el]), jami, iz.el,
      h('div', { class: 'msg info' }, 'Har bir joydagi pul shuncha kamayadi. Ta\'minotchi faqat jami summani ko\'radi.'),
      h('button', { class: 'p', onclick: () => {
        const ixt = (f) => (String(f.i.value).trim() ? pulXato(f, null) : null);
        if (xatolar([[u, ixt(u)], [k, ixt(k)], [b, ixt(b)]])) return;
        const r = H.tolovTekshir({ uy: u.i.value, kassa: k.i.value, bank: b.i.value });
        if (r.xato) { xatolar([[UY_PULI ? u : k, 'Kamida bitta joydan summa yozing']]); return; }
        const d = Object.fromEntries(Object.entries(r.manbalar).filter(([kk]) => UY_PULI || kk !== 'uy').map(([kk, vv]) => [kk, -vv]));
        yetarlimi(S, d).then((ha) => ha && ctx.amalX(xatoJoyla([[UY_PULI ? u : k, /summa|kamida/i]]), 'tolov', t.id, { uy: u.i.value, kassa: k.i.value, bank: b.i.value }, iz.i.value).then((ok) => ok && close()));
      } }, 'Saqlash'));
    upd();
  });
}

// Zaxira nusxa (07.11, 20261107230000_audit_jurnal): «Zaxira fayli menga kelsin» — tanlagan direktorga har kecha jim fayl
// (hech kim tanlamagan bo'lsa — avvalgidek har yakshanba hamma direktorga). Holat serverdan (zaxira_holat), 1 daqiqa eslab qolinadi.
const ZX = { j: null, vaqt: 0, yuk: null, xato: null };
function zaxiraKarta(ctx) {
  const c = h('div', { class: 'card' }, kartaSarlavha('Zaxira nusxa'));
  const yukla = (majbur) => {
    if (!ctx.server || ZX.yuk || (!majbur && Date.now() - ZX.vaqt < 60000)) return;
    ZX.yuk = Promise.resolve().then(() => ctx.retseptCtx().oqi('zaxiraHolat'))
      .then((j) => { ZX.j = j || {}; ZX.xato = null; }, (e) => { ZX.xato = (e && e.message) || 'Holat olinmadi'; })
      .finally(() => { ZX.vaqt = Date.now(); ZX.yuk = null; ctx.rerender(); });
  };
  yukla(false);
  const j = ZX.j || {};
  const menga = j.menga === true;
  const boshqa = Array.isArray(j.oluvchilar) ? j.oluvchilar.filter((n) => n && n !== (ctx.x || {}).ism) : [];
  c.append(h('div', { class: 'muted' }, 'Smenalar, daftar, qarzlar, ta\'minotchilar, oyliklar — bitta Excel faylda Telegram\'ingizga keladi.'));
  if (ctx.server) {
    c.append(h('button', { type: 'button', class: 'yk-almash', role: 'switch', 'aria-checked': String(menga), disabled: !ZX.j,
      onclick: async (e) => {
        e.currentTarget.disabled = true;
        const r = await ctx.amal('zaxiraMenga', !menga);
        if (r && typeof r === 'object') { ZX.j = r; ZX.vaqt = Date.now(); } else if (r != null) { ZX.vaqt = 0; yukla(true); }
        ctx.rerender();
      } },
    h('span', { class: 'yk-almash-m' }, h('b', {}, 'Zaxira fayli menga kelsin'),
      h('span', { class: 'muted' }, !ZX.j ? (ZX.xato ? 'Holat olinmadi — keyinroq' : 'Yuklanmoqda…')
        : menga ? 'Har kecha (03:00 dan keyin) jim xabar bilan sizga keladi' : 'Yoqsangiz — har kecha sizga keladi')),
    h('span', { class: 'yk-tumbler', 'aria-hidden': 'true' }, h('i', {}))));
    if (ZX.j && !menga && !boshqa.length) c.append(h('div', { class: 'muted' }, 'Hech kim tanlamagan — har yakshanba kechki xulosadan keyin hamma direktorga yuboriladi.'));
    if (boshqa.length) c.append(h('div', { class: 'muted' }, 'Yana oladi: ', h('span', { 'data-asl': '' }, boshqa.join(', '))));
  }
  c.append(h('button', { onclick: () => ctx.amal('zaxira').then((ok) => ok && ctx.toast('Zaxira Telegram\'ingizga yuborildi ✓')) }, 'Hozir yuborish'));
  return c;
}
