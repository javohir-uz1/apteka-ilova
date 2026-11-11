// Tanishtiruv — 3 ta qisqa ekran (07.11 tun; GitHub hisobotidagi onboarding g'oyasi): yangi ko'rinishda birinchi ochilganda,
// har rol uchun (direktor, xodim). Telegram akkaunti bo'yicha bir marta: localStorage 'apteka-tanishuv:<tg id izi>' = '1'
// (faqat belgi — ism, telefon yoki boshqa shaxsiy ma'lumot yozilmaydi). «O'tkazib yuborish» bor; qayta ochish —
// Xodimlar / Men → «Qanday ishlatiladi?» va Telegram ⋮ → Sozlamalar (Ko'rinish oynasi). Brauzerda (sinov rejimi) o'zi chiqmaydi.
// Matn — oddiy, qisqa jumlalar (keksa odam ham tushunsin); kirill yozuvida oyna o'zi o'tkaziladi (kirill.mjs kuzatuvchisi).
import { h, sheet } from './ui.mjs';
import { ikon } from './ikon.mjs';
import { idIzi } from './sorov.mjs';

export const TANISHUV = {
  direktor: [
    { ikon: 'bugun', sarlavha: 'Bugun', matn: ['Ilova ochilganda «Bugun» sahifasi chiqadi.', 'Eng tepada — Defektura: qaysi dori kerak.',
      'Ostida — bugungi savdo va «Diqqat qiling»: bugun bajariladigan ishlar.'] },
    { ikon: 'pul', sarlavha: 'Pastdagi 4 ta bo\'lim', matn: ['Pul — daftar, savdo, hamyonlar va qarzlar.', 'Ombor — qoldiq, buyurtma, narxlar, retseptlar.',
      'Xodimlar — davomat va sozlamalar.', 'Tepadagi 🔍 — kerakli bo\'limni, xodimni yoki dorini nomi bilan topadi.'] },
    { ikon: 'sozlama', sarlavha: 'Funksiyalar va eski ko\'rinish', matn: ['Xodimlar → «Funksiyalar»: xodimlar nimani ishlatishini yoqasiz yoki o\'chirasiz.',
      'Yangi ko\'rinish tushunarsiz bo\'lsa: Xodimlar → «Ko\'rinish» → «Eski ko\'rinish».', 'Bu yo\'riqnoma o\'sha yerda: «Qanday ishlatiladi?».'] }],
  // 11.11: sodda Bosh — 3 ta katta tugma, «Tez» qatori, kartalar, «Boshqa bo'limlar» (app.mjs xBosh).
  // Satr: matn | [funksiya kaliti, matn] (o'chiq bo'lsa — ko'rsatilmaydi) | (fy) => matn | null. R12: o'chirilgan tugma tilga olinmaydi.
  xodim: [
    { ikon: 'dori', sarlavha: 'Katta tugmalar', matn: ['Eng tepada — katta tugmalar:',
      ['x_defektura', 'Defekturaga yozish — kam qolgan yoki tugagan dorini yozing, direktor buyurtma beradi.'],
      ['x_qidiruv', 'Dori qidirish — narxi va qaysi filialda bor. Ichida shtrix-kodni kamera bilan o\'qish ham bor.'],
      ['x_qidiruv', 'Bugun nima keldi — Oson\'ga bugun kirgan dorilar.']] },
    { ikon: 'shtrix', sarlavha: 'Kichik tugmalar va kartalar', matn: ['Katta tugmalar ostida — kichik tugmalar (masalan, Kartaga o\'tkazma).',
      'Ish chiqsa — karta paydo bo\'ladi (masalan, kelgan dorilarni sanash). Ish bo\'lmasa — karta yo\'q.', 'Pastroqda — boshqa filialdan dori so\'rash.'] },
    { ikon: 'men', sarlavha: 'Boshqa bo\'limlar', matn: ['Eng pastda — «Boshqa bo\'limlar».',
      (fy) => 'U yerda: ' + [fy('x_qarz') ? 'qarz yozish' : null, 'qarzlarim', 'oylik', fy('x_oyin') ? 'Bilimdon' : null, 'sozlamalar'].filter(Boolean).join(', ') + '.',
      'Bu yo\'riqnomani yana ko\'rish: Boshqa bo\'limlar → Men va sozlamalar → «Qanday ishlatiladi?».'] }]
};

// Audit 09.11: kalitda Telegram id ochiq turmasin — uning izi (sorov.mjs idIzi, oflayn navbatdagi kimIzi bilan bir xil).
// Eski kalit ('apteka-tanishuv:<id>') bir marta yangisiga ko'chiriladi va o'chiriladi.
const KALIT = 'apteka-tanishuv:';
export const tanishuvKalit = (id) => KALIT + idIzi(id);
export function tgFoydalanuvchi() {
  const w = typeof window !== 'undefined' ? window : null;
  const t = w && w.Telegram && w.Telegram.WebApp;
  const u = t && t.initData && t.initDataUnsafe && t.initDataUnsafe.user;
  return u && u.id != null ? String(u.id) : null;
}
function eskiKochir(id) {
  const eski = KALIT + String(id);
  if (eski === tanishuvKalit(id)) return;
  if (localStorage.getItem(eski) === '1') localStorage.setItem(tanishuvKalit(id), '1');
  localStorage.removeItem(eski);
}
export function tanishuvKorildimi(id) {
  if (id == null) return true;
  try { eskiKochir(id); return localStorage.getItem(tanishuvKalit(id)) === '1'; } catch (e) { return true; }   // xotira yopiq — so'ramaymiz
}
export function tanishuvBelgila(id) {
  if (id == null) return;
  try { localStorage.setItem(tanishuvKalit(id), '1'); } catch (e) { /* yopiq xotira */ }
}

// Oyna: o.id — yopilganda (o'tkazib yuborilsa ham, oxirigacha ko'rilsa ham) shu akkaunt uchun «ko'rildi» belgisi.
// Satrlar Funksiyalar bo'yicha (o.fy — app.mjs fy; berilmasa — hammasi yoqiq).
export const satrlar = (matn, fy) => { const y = typeof fy === 'function' ? fy : () => true;
  return matn.map((m) => (typeof m === 'function' ? m(y) : Array.isArray(m) ? (y(m[0]) ? m[1] : null) : m)).filter(Boolean); };
export function tanishuvOch(rol, o = {}) {
  const ekranlar = TANISHUV[rol] || TANISHUV.xodim;
  let i = 0, chizish = null;
  sheet('Qanday ishlatiladi?', (box, close) => {
    const ichi = h('div', { class: 'tn' });
    box.append(ichi);
    const chiz = () => {
      const e = ekranlar[i], oxirgi = i === ekranlar.length - 1;
      ichi.textContent = '';
      ichi.append(
        h('div', { class: 'tn-nuqtalar', role: 'img', 'aria-label': (i + 1) + '-ekran, jami ' + ekranlar.length + ' ta' },
          ...ekranlar.map((x, n) => h('i', { class: n === i ? 'shu' : n < i ? 'otdi' : '' }))),
        h('div', { class: 'tn-ekran' },
          h('span', { class: 'tn-ikon', 'aria-hidden': 'true' }, ikon(e.ikon)),
          h('h3', { class: 'tn-s', tabindex: '-1' }, e.sarlavha),
          ...satrlar(e.matn, o.fy).map((m) => h('p', {}, m))),
        h('div', { class: 'tn-tugmalar' },
          h('button', { type: 'button', class: 'p katta tn-keyingi', onclick: () => { if (oxirgi) close(); else { i += 1; chiz(); } } }, oxirgi ? 'Tushunarli — boshlash' : 'Keyingisi ›'),
          oxirgi ? null : h('button', { type: 'button', class: 'katta tn-otkaz', onclick: close }, 'O\'tkazib yuborish')));
      if (box.isConnected) { const s = ichi.querySelector('.tn-s'); if (s) s.focus({ preventScroll: true }); }
    };
    chizish = chiz;
    chiz();
    return () => { if (o.id != null) tanishuvBelgila(o.id); if (o.yopildi) o.yopildi(); };
  }, { fokus: false, orqaga: () => { if (i > 0 && chizish) { i -= 1; chizish(); return true; } return false; } });   // Telegram «orqaga» — oldingi ekran
}

// Birinchi ochilish: Telegram ichida, shu akkaunt hali ko'rmagan bo'lsa — panel chizilgandan keyin bir marta (shu ochilishda).
let avtoBoldi = false;
export function tanishuvAvto(rol, o = {}) {
  if (avtoBoldi) return false;
  const id = tgFoydalanuvchi();
  if (!id || tanishuvKorildimi(id)) return false;
  avtoBoldi = true;
  setTimeout(() => {
    if (document.querySelector('.sheet-bg:not(.yopilmoqda)')) { avtoBoldi = false; return; }   // boshqa oyna ochiq — keyingi chizishda
    tanishuvOch(rol, { ...o, id });
  }, 500);
  return true;
}
