// Excel to'g'ridan telefonga (07.11 tun; Telegram WebApp.downloadFile, Bot API 8.0+). Faqat bemor ma'lumotisiz hisobotlar
// (hozir «Berilgan dorilar» — dorilar_excel). Punkt ro'yxatlari (ism, JSHSHIR, kodlar) — faqat bot orqali, bu yerdan emas.
// Tartib: server bir martalik havola beradi (fayl_havola → { yol: 'yuklash/<token>', nom }, 2 daqiqa) → downloadFile({ url,
// file_name }) — Telegram «Yuklab olish»ni so'raydi va faylni o'zi oladi. Eski Telegram (8.0 dan past) yoki downloadFile xato
// bersa — avvalgidek bot orqali (botga() — dorilar_excel). Server: supabase/functions/api/api.mjs YUKLASH, GET /yuklash/<token>.
import { h } from './ui.mjs';

// Telegram shu telefonda faylni yuklab bera oladimi (Bot API 8.0+, metod bor).
export const telefongaMumkin = (tg) => !!tg && !!tg.initData && typeof tg.downloadFile === 'function'
  && (!tg.isVersionAtLeast || tg.isVersionAtLeast('8.0'));

// ctx: { tg, amal, toast, yuklashManzil }; tur/args — fayl_havola uchun; botga() — eski yo'l (Promise).
// Natija: 'telefon' (Telegram oynasi ochildi), 'bot' (bot orqali yuborildi), null (xato — xabar ko'rsatildi yoki bekor).
export async function telefongaYukla(ctx, tur, args, botga) {
  const zaxira = async (sabab) => {
    if (sabab) ctx.toast(sabab);
    const r = await botga();
    return r ? 'bot' : null;
  };
  if (!telefongaMumkin(ctx.tg) || typeof ctx.yuklashManzil !== 'function') return zaxira(null);
  const r = await ctx.amal('faylHavola', tur, args);
  if (!r) return null;   // xato (huquq, sana, internet) — ctx.amal o'zi aytdi
  const url = r && typeof r.yol === 'string' ? ctx.yuklashManzil(r.yol) : null;
  if (!url || !/^https:\/\//.test(url)) return zaxira('Telefonga yuklab bo\'lmadi — fayl Telegram\'ga yuboriladi');
  // downloadFile qo'llanmasa — darhol xato tashlaydi (WebAppMethodUnsupported). Javob (callback) — foydalanuvchi oynani yopganda;
  // uni kutmaymiz (ba'zi ilovalar chaqirmasligi mumkin — tugma «band» bo'lib qolmasin).
  try {
    ctx.tg.downloadFile({ url, file_name: String(r.nom || 'hisobot.xlsx') }, (qabul) => {
      if (qabul) ctx.toast('Fayl telefonga yuklanmoqda ✓ — «Загрузки» / «Fayllar»da');
    });
    return 'telefon';
  } catch (e) {
    return zaxira('Bu Telegram faylni yuklay olmadi — fayl Telegram\'ga yuboriladi');
  }
}

// Ikki tugma: «Telefonga yuklab olish» (asosiy, mumkin bo'lsa) va «Telegram'ga yuborish» (bot orqali). Mumkin bo'lmasa — faqat bot.
export function yuklashTugmalari(ctx, { tur, args, botga, botMatn = 'Excel — Telegram\'ga yuborish', yuborildi = 'Excel fayl Telegram\'ga yuborildi ✓' }) {
  const bot = () => botga().then((r) => { if (r) ctx.toast(yuborildi); return r; });
  if (!ctx.server || !telefongaMumkin(ctx.tg)) return [h('button', { class: 'p', onclick: bot }, botMatn)];
  let band = false;
  const tel = h('button', { class: 'p', onclick: async () => {
    if (band) return;
    band = true; tel.disabled = true;
    try { const n = await telefongaYukla(ctx, tur, args, botga); if (n === 'bot') ctx.toast(yuborildi); } finally { band = false; tel.disabled = false; }
  } }, '📥 Telefonga yuklab olish (Excel)');
  return [tel, h('button', { class: 's', onclick: bot }, botMatn)];
}
