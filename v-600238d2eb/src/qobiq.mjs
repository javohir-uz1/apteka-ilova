// Yangi ko'rinish (07.11, egasi maketlardan «variant A» ni tanladi; foydalanuvchi: "panelda narsa ko'p, ishlatish qiyin —
// oddiy va keksa odam ham ishlata oladigan qil"). Direktor va xodim paneli uchun umumiy qobiq:
// - ko'rinish tanlovi (shu telefonda): «Eski ko'rinish» (bir hafta — adashgan odam eskisiga qaytsin) va harf o'lchami A / A+;
// - Telegram: Sozlamalar tugmasi (⋮ menyu, SettingsButton), tebranish (HapticFeedback) — eski Telegram'da va brauzerda jim;
// - pastki menyu (4 bo'lim, yozuvli), Telegram sozlamalari kabi guruhlangan ro'yxat, «Diqqat qiling» qatori, dumaloq tugmalar,
//   kichik son kartalari.
// Qoidalar (CLAUDE.md, UX): doim yorug' «Yalpiz», kontrast ≥ 4,5:1, teginish ≥ 48 px, asosiy matn ≥ 17 px; harakat faqat CSS.
import { h, pills, sheet, tgKechikmi, tgQollashga } from './ui.mjs';
import { ikon } from './ikon.mjs';

// ---- Ko'rinish (shu telefonda, localStorage) ----
// Standart — yangi ko'rinish. «Eski ko'rinish» — 07.11 dan bir hafta (14.11 gacha) turadi; keyin bu tanlov olib tashlanadi.
const KOR = 'apteka-korinish';   // 'eski' — eski ko'rinish
const MATN = 'apteka-matn';      // 'katta' — A+
const ol = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const qoy = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* yopiq xotira */ } };
export const eskiKorinishmi = () => ol(KOR) === 'eski';
export const eskiKorinishQoy = (eski) => qoy(KOR, eski ? 'eski' : null);
export const kattaMatnmi = () => ol(MATN) === 'katta';
export const kattaMatnQoy = (katta) => qoy(MATN, katta ? 'katta' : null);

// <html> belgilari: matn-katta (A+), yangi-qobiq (yangi ko'rinishdagi panel chizilgan — CSS faqat shunga tegadi).
export function korinishQolla(yangi) {
  const r = document.documentElement;
  r.classList.toggle('matn-katta', kattaMatnmi());
  r.classList.toggle('yangi-qobiq', !!yangi);
}

// ---- Telegram ----
const tgOl = () => { const w = typeof window !== 'undefined' ? window : null; const t = w && w.Telegram && w.Telegram.WebApp; return t && t.initData ? t : null; };
const versiya = (tg, v) => !tg.isVersionAtLeast || tg.isVersionAtLeast(v);
// Tebranish: 'tanlov' — bo'lim almashdi; 'ok' — saqlandi; 'xato' — saqlanmadi; 'bos' — yengil bosish.
export function haptik(tur) {
  const tg = tgOl();
  const hf = tg && tg.HapticFeedback;
  if (!hf || !versiya(tg, '6.1')) return;
  try {
    if (tur === 'tanlov') hf.selectionChanged();
    else if (tur === 'ok') hf.notificationOccurred('success');
    else if (tur === 'xato') hf.notificationOccurred('error');
    else hf.impactOccurred('light');
  } catch (e) { /* eski Telegram */ }
}
// Telegram ⋮ menyusidagi «Sozlamalar» (SettingsButton, Telegram 6.10+): har panel o'z oynasini beradi; null — yashiriladi.
// Audit 09.11: chizish davomida (ui.mjs tgKechiktir) faqat o'zgaruvchiga yoziladi — oxirida bir marta; Telegram'ga faqat
// ko'rinishi o'zgarganda yuboriladi (har chizishda hide → show bo'lmasin).
let sozFn = null, sozUlandi = false, sozKor = null;
function sozQolla() {
  const tg = tgOl();
  if (!tg || !tg.SettingsButton || !versiya(tg, '6.10')) return;
  try {
    if (!sozUlandi) { sozUlandi = true; tg.SettingsButton.onClick(() => { if (sozFn) sozFn(); }); }
    const kor = !!sozFn;
    if (kor !== sozKor) { sozKor = kor; if (kor) tg.SettingsButton.show(); else tg.SettingsButton.hide(); }
  } catch (e) { /* eski Telegram */ }
}
tgQollashga(sozQolla);
export function sozlamaTugmasi(fn) {
  sozFn = typeof fn === 'function' ? fn : null;
  if (!tgKechikmi()) sozQolla();
}

// ---- Ko'rinish oynasi (Telegram ⋮ → Sozlamalar; ilovada — Xodimlar / Men → «Ko'rinish») ----
// o.rerender(true) — ekran qayta chiziladi; o.almashdi() — ko'rinish almashganda panel bosh sahifaga qaytadi;
// o.sozlamalar — «Barcha sozlamalar» (direktor; xodimda yo'q).
export function korinishOyna(o = {}) {
  sheet('Ko\'rinish', (box, close) => {
    const eski = eskiKorinishmi();
    const almash = h('button', { type: 'button', class: 'yk-almash', role: 'switch', 'aria-checked': String(eski),
      onclick: () => {
        eskiKorinishQoy(!eski); haptik('tanlov'); close();
        if (o.almashdi) o.almashdi();
        if (o.rerender) o.rerender(true);
      } },
    h('span', { class: 'yk-almash-m' }, h('b', {}, 'Eski ko\'rinish'),
      h('span', { class: 'muted' }, eski ? 'Yoqilgan — yangi ko\'rinishga qaytish uchun bosing' : 'Yangi ko\'rinish tushunarsiz bo\'lsa — yoqing')),
    h('span', { class: 'yk-tumbler', 'aria-hidden': 'true' }, h('i', {})));
    const harf = pills([['oddiy', 'A — oddiy'], ['katta', 'A+ — katta']], kattaMatnmi() ? 'katta' : 'oddiy', (v) => {
      kattaMatnQoy(v === 'katta'); haptik('tanlov');
      korinishQolla(document.documentElement.classList.contains('yangi-qobiq'));
    }, 'Harf o\'lchami');
    box.append(almash,
      h('div', { class: 'muted' }, 'Tanlov shu telefonda eslab qolinadi. Eski ko\'rinish bir hafta turadi.'),
      h('b', { class: 'yk-s' }, 'Harf o\'lchami'), harf,
      // 07.11 tun: tanishtiruv (3 ekran) — faqat yangi ko'rinishda (u yangi panelni tushuntiradi).
      o.tanishuv && !eski ? h('button', { type: 'button', class: 'yq yk-havola', onclick: () => { close(); o.tanishuv(); } },
        kvadrat('xabar', 'yashil'), h('span', { class: 'yq-m' }, h('b', {}, 'Qanday ishlatiladi?'), h('span', { class: 'muted' }, '3 ta qisqa ekran — asosiy joylar')),
        ikon('oldinga')) : null,
      o.sozlamalar ? h('button', { type: 'button', class: 'yq yk-havola', onclick: () => { close(); o.sozlamalar(); } },
        kvadrat('sozlama', 'kul'), h('span', { class: 'yq-m' }, h('b', {}, 'Barcha sozlamalar'), h('span', { class: 'muted' }, 'Filiallar, xodimlar, limitlar, kalitlar')),
        ikon('oldinga')) : null);
  }, { fokus: false });
}

// ---- Bo'laklar ----
// Rangli kvadrat ichida ikonka. rang: yashil | kok | sariq | qizil | binafsha | kul.
export const kvadrat = (nom, rang = 'yashil') => h('span', { class: 'yq-d ' + rang, 'aria-hidden': 'true' }, ikon(nom));

// Pastki menyu: [[kalit, nom, ikonka]] — 4 bo'lim, yozuvli; tanlangan — to'ldirilgan ikonka va urg'u rangi.
export function bolimNav(items, joriy, och) {
  const n = h('nav', { class: 'yn-nav', 'aria-label': 'Bo\'limlar' });
  items.forEach(([k, l, ik]) => n.append(h('button', { type: 'button', 'aria-current': joriy === k ? 'page' : null,
    onclick: () => { if (joriy !== k) haptik('tanlov'); och(k); } }, ikon(ik, { tol: joriy === k }), h('span', {}, l))));
  return n;
}

// Bitta qator (Telegram sozlamalari kabi): rangli kvadrat, nom, izoh, o'ngda qiymat, «›».
// { ikon, rang, l, izoh, qiymat, son, onclick, diqqat }
export function qator(q) {
  return h('button', { type: 'button', class: 'yq' + (q.diqqat ? ' diqqat' : ''), onclick: q.onclick },
    kvadrat(q.ikon || 'oldinga', q.rang),
    h('span', { class: 'yq-m' }, h('b', {}, q.l), q.izoh ? h('span', { class: 'muted' }, q.izoh) : null),
    q.son != null ? h('span', { class: 'yq-son' + (q.diqqat ? ' diqqat' : '') }, String(q.son)) : null,
    q.qiymat != null ? h('span', { class: 'yq-v' }, q.qiymat) : null,
    h('span', { class: 'yq-o' }, ikon('oldinga')));
}

// Guruhlangan ro'yxat: [{ nom, qatorlar: [qator…] }] (null qatorlar tashlanadi, bo'sh guruh chiqmaydi).
export function bolimlar(gs) {
  return gs.map((g) => ({ ...g, qatorlar: (g.qatorlar || []).filter(Boolean) })).filter((g) => g.qatorlar.length)
    .map((g) => h('section', { class: 'yb', 'aria-label': g.nom }, h('h2', { class: 'yb-s' }, g.nom),
      h('div', { class: 'card yb-r' }, ...g.qatorlar.map(qator))));
}

// Dumaloq tez tugmalar: [[ikonka, nom, rang, onclick]] — bir qatorda 4 tagacha.
export function dumaloqlar(items) {
  const q = items.filter(Boolean);
  return h('div', { class: 'yt' + (q.length === 5 ? ' yt-5' : '') }, ...q.map(([ik, nom, rang, onclick]) => h('button', { type: 'button', class: 'yt-t', onclick },
    h('span', { class: 'yt-d ' + (rang || 'yashil') }, ikon(ik)), h('span', { class: 'yt-n' }, nom))));
}

// Kichik son kartalari: [{ son, l, rang, onclick }] — son yo'q (yuklanmoqda) bo'lsa «…».
export function sonKartalar(items) {
  return h('div', { class: 'ys' }, ...items.filter(Boolean).map((k) => h('button', { type: 'button', class: 'ys-k ' + (k.rang || ''), onclick: k.onclick,
    'aria-label': k.l + ': ' + (k.son == null ? 'yuklanmoqda' : k.son) },
  h('b', {}, k.son == null ? '…' : String(k.son)), h('span', {}, k.l))));
}

// Sarlavha ostidagi orqaga tugmasi (Telegram «orqaga» tugmasi bo'lmasa ham — brauzerda, eski Telegram'da — ko'rinadi).
export const orqagaTugma = (fn) => h('button', { type: 'button', class: 'yh-orqa', 'aria-label': 'Orqaga', onclick: fn }, ikon('orqaga'));
