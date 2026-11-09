// Tanishtiruv — 3 ta qisqa ekran (07.11 tun; GitHub hisobotidagi onboarding g'oyasi): yangi ko'rinishda birinchi ochilganda,
// har rol uchun (direktor, xodim). Telegram akkaunti bo'yicha bir marta: localStorage 'apteka-tanishuv:<tg id>' = '1'
// (faqat belgi — ism, telefon yoki boshqa shaxsiy ma'lumot yozilmaydi). «O'tkazib yuborish» bor; qayta ochish —
// Xodimlar / Men → «Qanday ishlatiladi?» va Telegram ⋮ → Sozlamalar (Ko'rinish oynasi). Brauzerda (sinov rejimi) o'zi chiqmaydi.
// Matn — oddiy, qisqa jumlalar (keksa odam ham tushunsin); kirill yozuvida oyna o'zi o'tkaziladi (kirill.mjs kuzatuvchisi).
import { h, sheet } from './ui.mjs';
import { ikon } from './ikon.mjs';

export const TANISHUV = {
  direktor: [
    { ikon: 'bugun', sarlavha: 'Bugun', matn: ['Ilova ochilganda «Bugun» sahifasi chiqadi.', 'Eng tepada — Defektura: qaysi dori kerak.',
      'Ostida — bugungi savdo va «Diqqat qiling»: bugun bajariladigan ishlar.'] },
    { ikon: 'pul', sarlavha: 'Pastdagi 4 ta bo\'lim', matn: ['Pul — daftar, savdo, hamyonlar va qarzlar.', 'Ombor — qoldiq, buyurtma, narxlar, retseptlar.',
      'Xodimlar — davomat va sozlamalar.', 'Tepadagi 🔍 — kerakli bo\'limni, xodimni yoki dorini nomi bilan topadi.'] },
    { ikon: 'sozlama', sarlavha: 'Funksiyalar va eski ko\'rinish', matn: ['Xodimlar → «Funksiyalar»: xodimlar nimani ishlatishini yoqasiz yoki o\'chirasiz.',
      'Yangi ko\'rinish tushunarsiz bo\'lsa: Xodimlar → «Ko\'rinish» → «Eski ko\'rinish».', 'Bu yo\'riqnoma o\'sha yerda: «Qanday ishlatiladi?».'] }],
  xodim: [
    { ikon: 'qidir', sarlavha: 'Dori qidirish', matn: ['Eng tepadagi katta tugma — dori qidirish.', 'Narxi va qaysi filialda borligini ko\'rasiz.',
      'Yonidagi tugma qutidagi shtrix-kodni kamera bilan o\'qiydi.'] },
    { ikon: 'qarzYoz', sarlavha: '4 ta katta tugma', matn: ['Qarz yozish — mijoz pulsiz olsa.', 'Kam qolgan — tugayotgan dorini yozing, direktor buyurtma beradi.',
      'Retseptlar va Inventar — direktor ruxsat bergan bo\'lsa.'] },
    { ikon: 'men', sarlavha: 'Men', matn: ['Bosh sahifaning pastida — «Men».', 'U yerda qarzlaringiz, oyligingiz, davomat va Bilimdon o\'yini.',
      'Bu yo\'riqnomani yana ko\'rish: Men → «Qanday ishlatiladi?».'] }]
};

const KALIT = 'apteka-tanishuv:';
export const tanishuvKalit = (id) => KALIT + String(id);
export function tgFoydalanuvchi() {
  const w = typeof window !== 'undefined' ? window : null;
  const t = w && w.Telegram && w.Telegram.WebApp;
  const u = t && t.initData && t.initDataUnsafe && t.initDataUnsafe.user;
  return u && u.id != null ? String(u.id) : null;
}
export function tanishuvKorildimi(id) {
  if (id == null) return true;
  try { return localStorage.getItem(tanishuvKalit(id)) === '1'; } catch (e) { return true; }   // xotira yopiq — so'ramaymiz
}
export function tanishuvBelgila(id) {
  if (id == null) return;
  try { localStorage.setItem(tanishuvKalit(id), '1'); } catch (e) { /* yopiq xotira */ }
}

// Oyna: o.id — yopilganda (o'tkazib yuborilsa ham, oxirigacha ko'rilsa ham) shu akkaunt uchun «ko'rildi» belgisi.
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
          ...e.matn.map((m) => h('p', {}, m))),
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
export function tanishuvAvto(rol) {
  if (avtoBoldi) return false;
  const id = tgFoydalanuvchi();
  if (!id || tanishuvKorildimi(id)) return false;
  avtoBoldi = true;
  setTimeout(() => {
    if (document.querySelector('.sheet-bg:not(.yopilmoqda)')) { avtoBoldi = false; return; }   // boshqa oyna ochiq — keyingi chizishda
    tanishuvOch(rol, { id });
  }, 500);
  return true;
}
