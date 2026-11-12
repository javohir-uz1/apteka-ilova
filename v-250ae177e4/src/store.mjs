// Ma'lumot saqlash. Ikki rejim:
// - sinov: shu brauzerda (localStorage), amallar.mjs bajaradi;
// - server: Edge Function `api` (ADR-002), holat har amaldan keyin serverdan keladi.
import { demoHolat } from './amallar.mjs';
import { API_URL, API_YOLLAR } from './config.mjs';
import { yolchi } from './sorov.mjs';

const KEY = 'apteka-demo-v1';

export function yukla() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (s && s.versiya === 1) {
      // Keyin qo'shilgan bo'limlar eski sinov ma'lumotida bo'lmasa — bo'sh/demo bilan to'ldiramiz.
      const d = demoHolat();
      for (const k of Object.keys(d)) if (s[k] === undefined) s[k] = d[k];
      s.sozlama = { ...d.sozlama, ...s.sozlama, boshlangich: { ...d.sozlama.boshlangich, ...(s.sozlama || {}).boshlangich },
        hisobBoshi: { ...d.sozlama.hisobBoshi, ...(s.sozlama || {}).hisobBoshi } };
      return s;
    }
  } catch (e) { /* bo'sh yoki buzilgan — demo bilan boshlaymiz */ }
  return demoHolat();
}

export function saqla(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* xotira to'la yoki yopiq rejim */ }
}

export function tozala() {
  try { localStorage.removeItem(KEY); } catch (e) { /* yo'q */ }
}

// Server yo'llari (sorov.mjs yolchi): birinchisiga ulanib bo'lmasa — ikkinchisi; vaqt chegarasi ham shu yerda (osilib
// qolgan ulanish tugmani abadiy «band» qilmasin — audit 26.10 / 06.11).
const xotira = (() => { try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch (e) { return null; } })();
export const yol = yolchi(API_YOLLAR, { xotira });
// fetch xatosi (javob umuman kelmadi) yoki javob tanasi yarmida uzildi — yolchi keyingi yo'lni sinaydi.
const ulanmadi = (e) => Object.assign(e instanceof Error ? e : new Error(String(e)), { ulanmadi: true });
const yuborFetch = (url, init, signal) => fetch(url, signal ? { ...init, signal } : init).catch((e) => { throw ulanmadi(e); });
// Tanani o'qish: uzilsa (vaqt tugadi, «Load failed») — boshqa yo'l; JSON buzuq bo'lsa (Wi-Fi kirish sahifasi) — null, javob
// keldi deb hisoblanadi (serverga xabar beradi: «tushunarsiz»).
const tanaOqi = async (fn) => { try { return await fn(); } catch (e) { if (e && e.name === 'SyntaxError') return null; throw ulanmadi(e); } };
const sarlavha = (initData) => ({ 'content-type': 'application/json', 'x-telegram-init-data': initData });
// Server kalitni (C1) e'tiborsiz qoldiradigan, lekin fayl yuboradigan yoki havola yaratadigan amallar (api.mjs OQISH/KALITSIZ):
// zaxira yo'ldan qayta yuborilsa — direktorga ikkinchi fayl yoki «yangi bemor yo'q» xatosi (audit 06.11). Faqat bitta yo'l.
export const BIR_YOL = new Set(['narx_yorliq', 'dorilar_excel', 'reimb_excel', 'taminot_excel', 'ta_excel', 'fayl_havola', 'punkt_excel', 'punkt_royxat_excel', 'zaxira', 'bot_ulash', 'taklif_yarat',
  'ta_taklif_yarat', 'punkt_taklif', 'prays_kalit_yarat', 'kengaytma_kalit_yarat']);
// 07.11 tun: telefonga yuklash manzili (Telegram downloadFile) — server bergan yo'l ('yuklash/<token>') hozir birinchi turgan,
// ya'ni havola so'rovi o'tgan yo'lga (Supabase yoki Cloudflare o'tkazgichi — worker/index.js) qo'shiladi. To'liq https manzil.
export function yuklashManzil(yolMatn) {
  const b = yol.yollar()[0];
  if (!b || typeof yolMatn !== 'string' || !/^yuklash\/[0-9a-f-]{36}$/i.test(yolMatn)) return null;
  try { return new URL(b.replace(/\/+$/, '') + '/' + yolMatn, typeof location !== 'undefined' ? location.href : undefined).href; } catch (e) { return null; }
}
// Retsept rasmi (Blob). Server Telegram'dan olib beradi; ruxsat — direktor va Osnovnoy xodimlari.
export async function rasmOl(id, initData) {
  let res, blob;
  try {
    [res, blob] = await yol.yubor(async (y, signal, ulandi) => {
      const r = await yuborFetch(y + '/rasm', { method: 'POST', headers: sarlavha(initData), body: JSON.stringify({ id }) }, signal);
      ulandi();
      return [r, r.ok ? await tanaOqi(() => r.blob()) : null];
    }, { tana: 60000 });
  } catch (e) { throw new Error('Internet sekin yoki yo\'q — rasm ochilmadi'); }
  if (res.ok) return blob;
  let b = {}; try { b = await res.json(); } catch (e) { /* bo'sh */ }
  throw new Error(b.xato || 'Rasm ochilmadi');
}

// Firma praysi fayli (botga kelgan .xlsx) — baytlar (ArrayBuffer); faqat direktor (30.10).
export async function faylOl(id, initData) {
  let res, buf;
  try {
    // qayta audit: 17–20 MB prays sekin internetda — tana uchun 3 daqiqa
    [res, buf] = await yol.yubor(async (y, signal, ulandi) => {
      const r = await yuborFetch(y + '/fayl', { method: 'POST', headers: sarlavha(initData), body: JSON.stringify({ id }) }, signal);
      ulandi();
      return [r, r.ok ? await tanaOqi(() => r.arrayBuffer()) : null];
    }, { muddat: [30000], tana: 180000 });
  } catch (e) { throw Object.assign(new Error('Internet sekin yoki yo\'q — fayl olinmadi'), { tarmoq: true }); }
  if (res.ok) return buf;
  let b = {}; try { b = await res.json(); } catch (e) { /* bo'sh */ }
  throw Object.assign(new Error(b.xato || 'Fayl olinmadi'), { status: res.status });
}
// 08.11: filial surati (direktor) — { f, rasm: JPEG base64 } → true. Takror yuborilsa zarar yo'q (oxirgisi qoladi).
export async function filialSuratYukla(body, initData) {
  let res, b = {};
  try {
    [res, b] = await yol.yubor(async (y, signal, ulandi) => {
      const r = await yuborFetch(y + '/filial_surat', { method: 'POST', headers: sarlavha(initData), body: JSON.stringify(body) }, signal);
      ulandi();
      let j = {}; try { j = await r.json(); } catch (e) { /* bo'sh */ }
      return [r, j];
    }, { muddat: [90000], faqatBirinchi: true });
  } catch (e) { throw Object.assign(new Error('Internet yo\'q — surat yuklanmadi'), { tarmoq: true }); }
  if (!res.ok) throw Object.assign(new Error(b.xato || 'Surat yuklanmadi'), { status: res.status });
  return b.natija;
}
// Firma praysi: { firma, fayl, faylNom, qatorlar: [[nom, yuz, kech, muddat, ishlab]] } → saqlangan qatorlar soni.
export async function firmaPraysYukla(body, initData) {
  let res, b = {};
  try {
    // Kalitsiz yozish — boshqa yo'ldan qayta yuborilmaydi (faqat hozir birinchi turgan, ishlagan yo'l). Katta fayl
    // yuklanayotganda sarlavha kelmaydi — ulanish vaqti ham 3 daqiqa.
    [res, b] = await yol.yubor(async (y, signal, ulandi) => {
      const r = await yuborFetch(y + '/firma_prays', { method: 'POST', headers: sarlavha(initData), body: JSON.stringify(body) }, signal);
      ulandi();
      let j = {}; try { j = await r.json(); } catch (e) { /* bo'sh */ }
      return [r, j];
    }, { muddat: [180000], faqatBirinchi: true });
  } catch (e) { throw Object.assign(new Error('Internet yo\'q — prays saqlanmadi'), { tarmoq: true }); }
  if (!res.ok) throw Object.assign(new Error(b.xato || 'Prays saqlanmadi'), { status: res.status });
  return b.natija;
}

// 13.11: Reimbursatsiya puli — DMED fayli telefonda o'qilgan qatorlar { qatorlar: [{id, sana, mnn, doza, savdo, ishlab, soni, narx, summa}],
// tasdiq, ochir } → sinov (tasdiq: false — hech narsa yozilmaydi): { qoshildi, yangilandi, ochiriladi, ochiriladi_summa, … };
// tasdiq: true — { qoshildi, yangilandi, ochirildi, jami, dan, gacha }. Bemor ma'lumoti yo'q. Qayta yuborilsa zarar yo'q (server qatorni yangilaydi,
// ikki marta sanamaydi), lekin katta tana — faqat birinchi yo'l, 3 daqiqa.
export async function reimbYukla(body, initData) {
  let res, b = {};
  try {
    [res, b] = await yol.yubor(async (y, signal, ulandi) => {
      const r = await yuborFetch(y + '/reimb_yukla', { method: 'POST', headers: sarlavha(initData), body: JSON.stringify(body) }, signal);
      ulandi();
      let j = {}; try { j = await r.json(); } catch (e) { /* bo'sh */ }
      return [r, j];
    }, { muddat: [180000], faqatBirinchi: true });
  } catch (e) { throw Object.assign(new Error('Internet yo\'q — fayl saqlanmadi'), { tarmoq: true }); }
  if (!res.ok) throw Object.assign(new Error(b.xato || 'Fayl saqlanmadi'), { status: res.status });
  return b.natija;
}

// Serverga so'rov: { natija, holat, takror? } qaytaradi yoki foydalanuvchiga ko'rsatiladigan xato tashlaydi.
// Amallar va holat — sorov.mjs sorovchi() orqali (kalit, javoblar tartibi); faqat o'qish (prays, retseptlar) — to'g'ridan-to'g'ri.
// kalit (C1) — o'zgartiruvchi amal uchun UUID: server shu kalit bilan amalni ko'pi bilan bir marta bajaradi,
// takrorida 200 { natija: null, holat, takror: true } qaytaradi. Tarmoq xatosida e.status yo'q, server xatosida — bor.
export async function serverga(amal, args, initData, kalit) {
  let res, body = null;
  // Har yo'l 15 / 20 s ichida ulanmasa yoki javob tanasi uzilsa — keyingisi; hammasi bo'lmasa — tarmoq xatosi (sorov.mjs yolchi).
  // Oldingi ulanmagan urinishlar jurnali (ulanish) shu so'rov bilan ketadi: Edge va worker uni logga yozadi (amalga ta'sir yo'q).
  const ulanish = yol.jurnalOl();
  const matn = JSON.stringify({ ...(kalit ? { amal, args, kalit } : { amal, args }), ...(ulanish ? { ulanish } : {}) });
  try {
    [res, body] = await yol.yubor(async (y, signal, ulandi) => {
      const r = await yuborFetch(y, { method: 'POST', headers: sarlavha(initData), body: matn }, signal);
      ulandi();
      return [r, await tanaOqi(() => r.json())];
    }, { faqatBirinchi: BIR_YOL.has(amal) });
  } catch (e) {
    yol.jurnalQaytar(ulanish);
    // tarmoq: true — maydon xatosi emas (sorov.mjs qoidaXatosi), natijasi noma'lum (kalit saqlanadi).
    throw Object.assign(new Error('Internet yo\'q yoki server javob bermadi — qayta urinib ko\'ring'), { tarmoq: true, urinishlar: (e && e.urinishlar) || [] });
  }
  // 200, lekin bizning javob emas (Wi-Fi kirish sahifasi, proksi) — "saqlandi" deb ko'rsatilmaydi: natijasi noma'lum, kalit saqlanadi.
  if (res.ok && !(body && typeof body === 'object' && ('natija' in body || 'holat' in body))) {
    throw Object.assign(new Error('Server javobi tushunarsiz (internetni tekshiring) — qayta urinib ko\'ring'), { tarmoq: true });
  }
  body = body || {};
  if (!res.ok) {
    const e = new Error(body.xato || (res.status >= 500 ? 'Server javob bermadi — biroz kutib, qayta urinib ko\'ring' : 'Server xatosi (' + res.status + ')'));
    e.status = res.status;
    if (body && body.qaytaOch === true) e.qaytaOch = true;   // audit 11.11: «ilovani qayta oching» (yangi kirish talab)
    throw e;
  }
  return body;
}
