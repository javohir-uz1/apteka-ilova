// Funksiyalarni yoqish/o'chirish (07.11; foydalanuvchi: "direktor panelida mijoz va xodimlarning funksiyalarini yoqib o'chirib
// qo'yadigan"). Server: 20261107240000_funksiyalar (ilova.funksiya_saqla, holatda sozlama.funksiyalar) va 20261107250000_funksiya_mijoz
// (bot ham to'xtaydi). Xodim amali Edge'da ham rad etiladi (api.mjs FUNKSIYA_KALIT) — bu sahifa faqat boshqaruv.
// Ro'yxat = SQL ilova.funksiya_royxati() (tests/miniapp-funksiya.test.mjs bir xilligini tekshiradi). Yo'q kalit — yoqiq.
import { h, kartaSarlavha, qaytaOchOldin, tasdiqlash } from './ui.mjs';

export const FUNKSIYALAR = [
  { k: 'x_qidiruv', guruh: 'xodim', nom: 'Dori qidirish', izoh: 'Narxi va qaysi filialda borligi' },
  { k: 'x_qarz', guruh: 'xodim', nom: 'Qarz yozish', izoh: 'Mijozga qarzga dori berish' },
  { k: 'x_defektura', guruh: 'xodim', nom: 'Kam qolgan (defektura)', izoh: 'Kerak dorini yozish' },
  { k: 'x_inventar', guruh: 'xodim', nom: 'Inventarizatsiya', izoh: 'Telefon bilan sanash' },
  { k: 'x_retsept', guruh: 'xodim', nom: 'Retseptlar', izoh: 'Reimbursatsiya ro\'yxatlari, o\'rash' },
  { k: 'x_bron', guruh: 'xodim', nom: 'Bronlar', izoh: 'Mijozlar bron qilgan dorilar' },
  { k: 'x_narx', guruh: 'xodim', nom: 'Narxni tuzatish', izoh: 'Direktor tanlagan narx, narx yorliqlari' },
  { k: 'x_oyin', guruh: 'xodim', nom: 'Bilimdon o\'yini', izoh: 'Test o\'yini va mashqlar' },
  { k: 'm_qidiruv', guruh: 'mijoz', nom: 'Dori qidirish (botda)', izoh: 'Mijoz dori bor-yo\'qligi va narxini ko\'radi' },
  { k: 'm_bron', guruh: 'mijoz', nom: 'Bron qilish (botda)', izoh: 'Mijoz dorini 3 soatga band qiladi' },
  { k: 'm_eslatma', guruh: 'mijoz', nom: 'Dori tugash eslatmasi (botda)', izoh: 'Doimiy dori tugashidan oldin xabar' }
];

export const yoqiqmi = (S, k) => (((S && S.sozlama) || {}).funksiyalar || {})[k] !== false;

// Nechta o'chiq (Xodimlar bo'limidagi qator izohi uchun).
export const ochiqSoni = (S) => FUNKSIYALAR.filter((f) => !yoqiqmi(S, f.k)).length;

// ctx: { S, amal(nom, ...args) → Promise, server }
export function funksiyalarView(m, ctx) {
  const S = ctx.S;
  m.append(h('div', { class: 'muted' }, 'O\'chirilgan imkoniyat xodimlarda ko\'rinmaydi va server ham bajarmaydi. Sizga (direktorga) hammasi ochiq qoladi. '
    + 'Qayta yoqsangiz — darhol ishlaydi, ma\'lumot o\'chmaydi.'));
  if (!ctx.server) m.append(h('div', { class: 'msg warn', role: 'status' }, 'Sinov rejimida saqlanmaydi — Telegram ilovasida ishlaydi.'));
  // 10.11 (Edge YANGI_KIRISH): funksiya_saqla — yangi kirish kerak; ilova uzoq ochiq bo'lsa — bosishdan oldin ogohlantirish.
  else { const q = qaytaOchOldin(); if (q) m.append(q); }
  const guruh = (g, sarlavha, izoh) => {
    const c = h('section', { class: 'card list' }, kartaSarlavha(sarlavha), h('div', { class: 'muted' }, izoh));
    for (const f of FUNKSIYALAR.filter((z) => z.guruh === g)) {
      const on = yoqiqmi(S, f.k);
      c.append(h('button', { type: 'button', class: 'yk-almash fk-q', role: 'switch', 'aria-checked': String(on), 'data-k': f.k,
        onclick: async (e) => {
          const b = e.currentTarget;
          if (b.disabled) return;
          if (on && !(await tasdiqlash('«' + f.nom + '» o\'chirilsinmi? ' + (g === 'mijoz' ? 'Botda mijozlar bu imkoniyatni ko\'rmaydi.' : 'Xodimlar bu imkoniyatni ko\'rmaydi.')))) return;
          b.disabled = true;
          const r = await ctx.amal('funksiyaSaqla', f.k, !on);
          if (r == null) b.disabled = false;   // xato — xabar ko'rsatildi; holat o'zgarmadi
        } },
      h('span', { class: 'yk-almash-m' }, h('b', {}, f.nom), h('span', { class: 'muted' }, (on ? 'Yoqilgan · ' : 'O\'chirilgan · ') + f.izoh)),
      h('span', { class: 'yk-tumbler', 'aria-hidden': 'true' }, h('i', {}))));
    }
    return c;
  };
  m.append(guruh('xodim', 'Xodimlar uchun', 'Xodim panelidagi tugmalar va bo\'limlar.'),
    guruh('mijoz', 'Mijozlar uchun (Telegram bot)', 'Bot dori qidirish, bron va eslatmani shu yerdagi tanlovga qarab beradi.'));
}
