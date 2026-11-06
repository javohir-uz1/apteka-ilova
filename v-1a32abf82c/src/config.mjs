// Server manzili (Supabase "Apteka" loyihasi, Edge Function `api`).
// Sinov rejimi (ma'lumot shu brauzerda, uydirma xodimlar): manzil oxiriga ?sinov qo'shing — index.html?sinov
// (globalThis.APTEKA_API_URL — faqat kompyuterdagi sinov sahifasi uchun, dev/miniapp-server.html.)
const SERVER_URL = 'https://pxhnbtkaghmtnvyimvgd.supabase.co/functions/v1/api';
const sinov = typeof location !== 'undefined' && new URLSearchParams(location.search).has('sinov');
// 06.11 (foydalanuvchi: "Mini appga kirmayabdi" — telefon supabase.co ga ulana olmadi): Cloudflare'dagi ilovaning o'zi orqali
// (/api → worker/index.js → Supabase). Boshqa joyda ochilsa (masalan fayl yoki boshqa domen) — to'g'ridan Supabase.
// 06.11 (uchinchi marta — operator DNS'i workers.dev nomini goh topmaydi): ilova GitHub Pages'da ham bor (zaxira, botdagi
// «Zaxira» tugmasi; tools/zaxira-yukla.mjs). U yerdan ochilsa — 2-yo'l shu Cloudflare o'tkazgichi (to'liq manzil, CORS bilan).
export const CF_API = 'https://apteka.javohir-abdullayev2025.workers.dev/api';
const host = typeof location !== 'undefined' ? location.hostname : '';
const ozi = /\.workers\.dev$/.test(host) ? location.origin + '/api' : /\.github\.io$/.test(host) ? CF_API : null;
export const API_URL = globalThis.APTEKA_API_URL || (sinov ? '' : SERVER_URL);
// Yo'llar (06.11, ikkinchi marta ochilmadi — sorov.mjs yolchi). Foydalanuvchi: "Oldin qanday ulanib turgan edi huddi shunday
// bo'lsin" — birinchi yo'l oldingidek to'g'ridan Supabase; unga ulanib bo'lmasa — zaxira: Cloudflare o'tkazgichi (/api).
// Ikkalasi ham Cloudflare tarmog'ida, lekin har xil manzil guruhida — operator bittasini to'sganda ikkinchisi ishlaydi.
export const API_YOLLAR = !API_URL ? [] : globalThis.APTEKA_API_URL ? [API_URL] : [SERVER_URL, ozi].filter((y, i, a) => y && a.indexOf(y) === i);

// "Uy puli" hamyoni ekranda ko'rinadimi (26.10: foydalanuvchi qarori — hozircha kerak emas, murakkab).
// false — hamma joyda faqat Seyf (va Bank); ma'lumot tuzilmasi va server o'zgarmagan, true qilinsa hammasi qaytadi.
export const UY_PULI = false;

// Taklif havolasi: https://t.me/<bot>?startapp=<kod>
export const BOT_USERNAME = 'Nexus_apteka_bot';
