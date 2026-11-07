// Server so'rovlari uchun DOM'siz yordamchilar (Node testlarida ham ishlaydi). app.mjs serverga faqat shu yerdagi
// sorovchi() orqali boradi: kalit (C1), kech kelgan javob qo'riqchisi (§7), takror javobi va oflayn navbat (07.11) bitta joyda.

// Faqat o'qiydigan amallar — kalit kerak emas (server ularni takror bajarsa ham hech narsa o'zgarmaydi).
export const OQISH = new Set(['holat', 'retseptlar', 'prays_qidir', 'qadoq_holat']);

// Takror javobi (C1): server amalni avval bajargan, natijasi bu javobda yo'q. Chaqiruvchi uchun "muvaffaqiyat",
// lekin raqam yoki matn emas — natijadan xabar tuzadigan joy buni alohida tekshiradi (r && r.takror).
export const TAKROR = Object.freeze({ takror: true });

// UUID v4. Telegram ichida crypto.randomUUID bor; juda eski brauzerda — getRandomValues bilan.
export function yangiKalit() {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  const b = new Uint8Array(16);
  if (c && c.getRandomValues) c.getRandomValues(b); else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
  const x = [...b].map((v) => v.toString(16).padStart(2, '0')).join('');
  return x.slice(0, 8) + '-' + x.slice(8, 12) + '-' + x.slice(12, 16) + '-' + x.slice(16, 20) + '-' + x.slice(20);
}

// Tarmoq yo'q yoki server 5xx — so'rov bajarilganmi, noma'lum: qayta urinishda o'sha kalit yuboriladi.
// 400 (qoida xatosi) yoki 401 — bajarilmagani aniq.
export const nomalumTugadi = (e) => !!e && (!e.status || e.status >= 500);
// Maydon tagiga qo'yiladigan xato: qoida xatosi (server 400 yoki shu telefonda tekshiruv / sinov rejimi).
// Tarmoq, 5xx va 401 — maydonga aloqasi yo'q, doim umumiy xabar (to'g'ri qiymat "xato" deb belgilanmasin).
export const qoidaXatosi = (e) => !!e && !e.tarmoq && (!e.status || e.status === 400);

// Takrorlanmaslik kaliti (C1). Server bitta kalit bilan amalni ko'pi bilan bir marta bajaradi.
// Eski kalit faqat darhol qayta urinishga: aynan shu so'rov (nom + argumentlar) tarmoq/5xx xatosidan keyin qayta yuborilsa.
// Unutiladi: shu so'rov muvaffaqiyatli yoki 400 bo'lsa; 10 daqiqa o'tsa; yoki xatodan KEYIN yuborilgan so'rovga javob kelib,
// foydalanuvchi sahifani (oynasiz) yangi holat bilan ko'rsa — korildi(). Shundan keyingi bir xil so'rov — ataylab yangi amal
// (masalan, yana suv olindi). Oyna ochiq turganda kelgan holat kalitni o'chirmaydi: oyna ichidagi "Saqlash" — hali qayta urinish.
export function kalitchi({ yarat = yangiKalit, now = () => Date.now(), muddat = 10 * 60e3, kop = 20 } = {}) {
  const kutayotgan = new Map();   // imzo → { kalit, ts, belgi }
  const imzo = (nom, args) => JSON.stringify([nom, args]);
  let yangi = 0;                  // muvaffaqiyatli javob kelgan eng keyingi so'rov raqami
  return {
    ber(nom, args) {
      const k = kutayotgan.get(imzo(nom, args));
      return k && now() - k.ts < muddat ? k.kalit : yarat();
    },
    // belgi — xato bilinganda berilgan eng katta so'rov raqami (undan keyin yuborilganlar xatodan keyingi).
    tugadi(nom, args, kalit, xato, belgi = 0) {
      const i = imzo(nom, args);
      kutayotgan.delete(i);
      if (nomalumTugadi(xato)) {
        kutayotgan.set(i, { kalit, ts: now(), belgi });
        while (kutayotgan.size > kop) kutayotgan.delete(kutayotgan.keys().next().value);
      }
    },
    // t raqamli so'rovga muvaffaqiyatli javob keldi (holat yoki amal).
    javobKeldi(t) { if (t > yangi) yangi = t; },
    // Foydalanuvchi sahifani yangi holat bilan ko'rmoqda (oyna yo'q): xatodan keyin javob kelgan bo'lsa — kalit unutiladi.
    korildi() { for (const [i, k] of kutayotgan) if (k.belgi < yangi) kutayotgan.delete(i); },
    soni: () => kutayotgan.size
  };
}

// Server band (503): bazaga ulanish olinmadi — so'rov BAJARILMAGANI aniq (server o'zi ham 3 marta urinib ko'rgan).
// Foydalanuvchi «qayta urining» xabarini ko'rmasin: o'sha kalit bilan 1, 2, 3 soniyadan keyin o'zi qayta yuboriladi (29.10:
// o'yinda «Keyingi savol» bosilganda «server xatoligi» ko'p chiqqan edi).
export const BAND_KUT = [1000, 2000, 3000];
export async function bandBolsaQayta(fn, { kut = BAND_KUT, uxla = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
  for (let i = 0; ; i++) {
    try { return await fn(); } catch (e) {
      if (!e || e.status !== 503 || i >= kut.length) throw e;
      await uxla(kut[i]);
    }
  }
}

// Server yo'llari (06.11, ikki marta «Mini appga kirmayabdi», iPhone, mobil internet). Server ishlab turgan, lekin telefon
// so'rovi yetib kelmagan: ertalab supabase.co ga (104.18.x / 172.64.x), tushdan keyin workers.dev ga (188.114.x) — ikkalasi
// Cloudflare, lekin har xil manzil guruhlari, operator ulardan biriga vaqti-vaqti bilan ulamaydi. So'rov birinchi yo'ldan
// (oldingidek to'g'ridan Supabase — config.mjs API_YOLLAR) ketadi; ULANIB BO'LMASA, ulanish vaqti tugasa yoki javob tanasi
// yarmida uzilsa — ikkinchisidan. Server javob bersa (har qanday status) — boshqa yo'l sinalmaydi. Qayta yuborish xavfsiz:
// o'zgartiruvchi amalda kalit (C1) — server uni ko'pi bilan bir marta bajaradi; server kalitni e'tiborsiz qoldiradigan
// (fayl yuboradigan, havola yaratadigan) amallar — faqatBirinchi (store.mjs BIR_YOL).
// Vaqt ikki bosqichda (audit 06.11): ulanish (sarlavhalar kelguncha) — 15 / 20 s; javob tanasi — alohida (tana, 60 s):
// sekin internetda katta holat yuklanayotganda «javob yo'q» deb uzilmasin.
// Zaxira yo'l ishlasa — 30 daqiqa eslab qolinadi (ilova qayta ochilganda ham birinchi, har ochilish 15 s kutmasin);
// keyin yana oldingidek Supabase birinchi. Oldingi yo'l yana ishlasa — eslangani o'chadi.
// Har muvaffaqiyatsiz urinish jurnalga yoziladi (vaqt, yo'l, tur, ms) — keyingi muvaffaqiyatli so'rov bilan serverga ketadi
// (Supabase Edge va Cloudflare loglarida ko'rinadi: qaysi operator, qaysi yo'l, qancha kutdi).
const JURNAL_KALIT = 'apteka-ulanish';
export const YOL_KALIT = 'apteka-yol';
export const YOL_ESLASH = 30 * 60e3;
export const yolNomi = (url) => (/supabase\.co/.test(url) ? 'S' : /workers\.dev|^\/|^https?:\/\/(localhost|127\.)/.test(url) ? 'C' : 'X');
export function yolchi(yollar, { xotira = null, now = () => Date.now(), taymer = setTimeout, toxtat = clearTimeout } = {}) {
  const asl = [...new Set(yollar.filter(Boolean))];
  let tartib = asl.slice();
  const oqi = (k) => { try { return xotira ? xotira.getItem(k) : null; } catch (e) { return null; } };
  const yoz = (k, v) => { try { if (xotira) v === null ? xotira.removeItem(k) : xotira.setItem(k, v); } catch (e) { /* yopiq rejim */ } };
  try {
    const e = JSON.parse(oqi(YOL_KALIT) || 'null');
    if (e && asl.includes(e.y) && e.y !== asl[0] && now() - e.ts >= 0 && now() - e.ts < YOL_ESLASH) tartib = [e.y, ...asl.filter((z) => z !== e.y)];
    else if (e) yoz(YOL_KALIT, null);
  } catch (e) { yoz(YOL_KALIT, null); }
  let jurnal = [];
  try { jurnal = JSON.parse(oqi(JURNAL_KALIT) || '[]'); if (!Array.isArray(jurnal)) jurnal = []; } catch (e) { jurnal = []; }
  const jurnalga = (q) => { jurnal.push(q); jurnal = jurnal.slice(-20); yoz(JURNAL_KALIT, JSON.stringify(jurnal)); };
  return {
    yollar: () => tartib.slice(),
    // urin(url, signal, ulandi) → Promise (fetch + javobni o'qish). urin sarlavhalar kelgach ulandi() ni chaqiradi: ulanish
    // taymeri to'xtaydi, tana taymeri (tana ms) boshlanadi. muddat — har yo'l uchun ulanish ms (oxirgisi qolganlarga).
    // Hammasi o'xshamasa — oxirgi xato, e.urinishlar = [{ y, tur: 'vaqt'|'ulanmadi'|'uzildi', ms }] bilan.
    async yubor(urin, { muddat = [15000, 20000], tana = 60000, faqatBirinchi = false } = {}) {
      const urinishlar = [];
      const royxat = faqatBirinchi ? tartib.slice(0, 1) : tartib.slice();
      let oxirgi;
      for (let i = 0; i < royxat.length; i++) {
        const y = royxat[i], t0 = now();
        const ac = typeof AbortController === 'function' ? new AbortController() : null;
        let vaqtTugadi = false, keldi = false, tm = 0;
        const qoy = (ms) => { if (tm) toxtat(tm); tm = ac && ms ? taymer(() => { vaqtTugadi = true; ac.abort(); }, ms) : 0; };
        qoy(muddat[Math.min(i, muddat.length - 1)]);
        try {
          const r = await urin(y, ac ? ac.signal : undefined, () => { if (!keldi) { keldi = true; qoy(tana); } });
          if (y !== tartib[0]) tartib = [y, ...tartib.filter((z) => z !== y)];
          // Shu so'rovda zaxiraga o'tildi — eslab qolinadi (30 daqiqa shu paytdan); asosiy yo'l ishladi — eslangani o'chadi.
          if (i > 0 && y !== asl[0]) yoz(YOL_KALIT, JSON.stringify({ y, ts: now() }));
          else if (y === asl[0] && oqi(YOL_KALIT)) yoz(YOL_KALIT, null);
          return r;
        } catch (e) {
          if (!e || !e.ulanmadi) throw e;   // server javob berdi (yoki javob tushunarsiz) — boshqa yo'l kerak emas
          oxirgi = e;
          const q = { t: t0, y: yolNomi(y), tur: keldi ? 'uzildi' : vaqtTugadi ? 'vaqt' : 'ulanmadi', ms: now() - t0 };
          urinishlar.push(q); jurnalga(q);
        } finally { if (tm) toxtat(tm); }
      }
      throw Object.assign(oxirgi || new Error('Yo\'l yo\'q'), { urinishlar });
    },
    // Jurnal (muvaffaqiyatli so'rov bilan serverga yuboriladi) — olinganda tozalanadi.
    jurnalOl() { if (!jurnal.length) return null; const j = jurnal; jurnal = []; yoz(JURNAL_KALIT, null); return j; },
    // Yuborilmadi (so'rov baribir yetib bormadi) — jurnal qaytariladi.
    jurnalQaytar(j) { if (j && j.length) { jurnal = [...j, ...jurnal].slice(-20); yoz(JURNAL_KALIT, JSON.stringify(jurnal)); } }
  };
}
// Ekranda ko'rsatish uchun: «C: 15 s javob yo'q · S: ulanmadi».
export const urinishMatni = (u) => (u || []).map((q) => (q.y === 'S' ? '1-yo\'l' : q.y === 'C' ? '2-yo\'l' : 'yo\'l') + ': '
  + (q.tur === 'vaqt' ? Math.round(q.ms / 1000) + ' s javob yo\'q' : (q.tur === 'uzildi' ? 'javob uzildi' : 'ulanmadi') + ' (' + (q.ms < 1000 ? q.ms + ' ms' : Math.round(q.ms / 1000) + ' s') + ')')).join(' · ');

// Holat javoblari tartibi: har so'rov yuborilganda raqam oladi; javob faqat undan keyin yuborilgan so'rov javobi
// hali qo'llanmagan bo'lsa qo'llanadi (kech kelgan eski javob yangi holat ustidan yozilmaydi).
export function navbatchi() {
  let berildi = 0, qollangan = 0;
  return {
    ol: () => ++berildi,
    qollasa(t) { if (t <= qollangan) return false; qollangan = t; return true; },
    eng: () => berildi
  };
}

// ---------- Oflayn navbat (07.11): yengil yozuv internet kelguncha telefonda kutadi ----------
// amalFon (app.mjs) bilan ketadigan yengil yozuv tarmoq xatosida (hech qaysi yo'lga ulanmadi yoki javob bizniki emas — server
// 4xx/5xx javobi EMAS) tashlanmaydi: localStorage navbatiga (NAVBAT_KALIT) yoziladi, yubor() NAVBATDA qaytaradi (chaqiruvchi ✓
// ko'rsatadi). Internet qaytganda (online, ilova ko'rindi, Telegram «activated», boshqa so'rov o'tdi, 15 s…5 daq kutib) — tartib
// bo'yicha, O'SHA kalit bilan (server ikki marta bajarmaydi; takror — yetkazildi). Ro'yxatdagi amallar hammasi:
//  - faqat amalFon orqali chaqiriladi va chaqiruvchiga server natijasi kerak emas (faqat r != null — ✓, ro'yxatni o'zi yuklaydi);
//  - kalitli (yuqoridagi OQISH, api.mjs OQISH/KALITSIZ emas) va holat o'rnatadi — kechroq bajarilsa ham natija o'sha (narx X,
//    bog'langan, rad etilgan, defekturada bor); fayl/havola yubormaydi (store.mjs BIR_YOL emas);
//  - argumentlarida shaxsiy ma'lumot yo'q (Oson/partiya id, narx) — telefon xotirasiga yozsa bo'ladi.
// Kirmaydi: inventar_sana (natija — jami son; «Tugatish» saqlanishini kutadi; yopilgan sanashga keyin yozib bo'lmaydi),
// partiya_narx_oson (natija — nechta yozildi; o'sha paytda narxsiz partiyalarga), narx_yorliq (fayl), oson_kerak_emas (amal()).
export const OFLAYN = new Set(['oson_defekturaga', 'narx_belgila', 'partiya_narx', 'analog_bogla', 'analog_uzish', 'analog_emas',
  'dori_mnn_rad', 'dori_mnn_qaytar']);
// Navbatga yozildi — "saqlandi" deb ko'rsatiladi (raqam/matn emas; r != null). Holat yo'q (keyingi yuklashda keladi).
export const NAVBATDA = Object.freeze({ navbatda: true });
export const NAVBAT_KALIT = 'apteka-navbat-oflayn';
export const NAVBAT_MAX = 50;              // to'lsa — yangisi navbatga olinmaydi (oldingidek xato chiqadi; hech biri jim yo'qolmaydi)
export const NAVBAT_MUDDAT = 24 * 3600e3;  // undan eski yozuv yuborilmaydi — tashlanadi
const NAVBAT_5XX = 10;                     // server xatosi (5xx) shuncha marta (daqiqasiga bittadan sanaladi) — tashlanadi
const NAVBAT_KUT = [15e3, 30e3, 60e3, 120e3, 300e3];   // yuborilmay qolsa — o'zi qayta urinish oralig'i

const imzosi = (api, args) => JSON.stringify([api, args]);
// Ikki so'rov bir narsaga tegadimi (umumiy argument qiymati): oradagisi tegsa — takror bosilgani birlashtirilmaydi (bog'la → uz → bog'la).
const kesishadi = (a, b) => { const s = new Set(a.filter((v) => v != null).map(String)); return b.some((v) => v != null && s.has(String(v))); };
// Kimning yozuvi (Telegram user id izi, id o'zi saqlanmaydi): bir telefonda boshqa akkaunt ochilsa — uning nomidan yuborilmaydi.
export function kimIzi(initData) {
  try {
    const u = new URLSearchParams(initData || '').get('user');
    const id = u && JSON.parse(u).id;
    if (!id) return '';
    let x = 5381;
    for (const c of String(id)) x = ((x * 33) ^ c.charCodeAt(0)) >>> 0;
    return x.toString(36);
  } catch (e) { return ''; }
}

const standartXotira = () => (typeof localStorage !== 'undefined' ? localStorage : null);
// Navbat xotirasi: { q: [{ k: kalit, api, args, t: yozilgan ms, m: kim izi, x: 5xx soni, s: oxirgi 5xx }], t: tashlanganlar }.
// localStorage yo'q yoki xato bersa (yopiq rejim, to'la) — shu ochilishda xotirada (ilova buzilmaydi). xotira — obyekt yoki funksiya.
export function chiquvchiNavbat({ xotira = standartXotira, now = () => Date.now(), max = NAVBAT_MAX, muddat = NAVBAT_MUDDAT, kalit = NAVBAT_KALIT } = {}) {
  const ol = () => { try { return typeof xotira === 'function' ? xotira() : xotira; } catch (e) { return null; } };
  let mem = { q: [], t: [] }, ishonchli = true, oxirgiSon = null;
  const kuzatuvchi = new Set();
  const tozala = (o) => ({
    q: (o && Array.isArray(o.q) ? o.q : []).filter((i) => i && typeof i.k === 'string' && i.k && i.k.length <= 80
      && OFLAYN.has(i.api) && Array.isArray(i.args) && Number.isFinite(i.t)),
    t: (o && Array.isArray(o.t) ? o.t : []).filter((i) => i && typeof i.api === 'string').slice(-10)
  });
  const oqi = () => {
    const s = ishonchli ? ol() : null;   // oxirgi yozish o'tmagan bo'lsa — xotiradagisi yangiroq
    if (s) { try { mem = tozala(JSON.parse(s.getItem(kalit) || 'null')); } catch (e) { /* yopiq rejim yoki buzilgan — xotiradagisi */ } }
    if (oxirgiSon === null) oxirgiSon = mem.q.length;
    return mem;
  };
  const xabar = () => {
    if (mem.q.length === oxirgiSon) return;
    oxirgiSon = mem.q.length;
    for (const f of [...kuzatuvchi]) { try { f(oxirgiSon); } catch (e) { /* kuzatuvchi xatosi navbatga ta'sir qilmaydi */ } }
  };
  const yoz = (o) => {
    mem = o;
    const s = ol();
    if (s) {
      try { if (o.q.length || o.t.length) s.setItem(kalit, JSON.stringify(o)); else s.removeItem(kalit); ishonchli = true; } catch (e) { ishonchli = false; }
    }
    xabar();
  };
  const tashlandi = (o, i, sabab, n) => [...o.t, { api: i.api, sabab, vaqt: n }].slice(-10);
  const yashaydi = (i, n) => n - i.t < muddat && i.t - n < 10 * 60e3;   // soat orqaga ketgan bo'lsa ham — eski
  const joriy = () => {
    const o = oqi(), n = now();
    const eski = o.q.filter((i) => !yashaydi(i, n));
    if (eski.length) yoz({ q: o.q.filter((i) => yashaydi(i, n)), t: eski.reduce((t, i) => tashlandi({ t }, i, 'eski', n), o.t) });
    return mem;
  };
  return {
    royxat: () => joriy().q.slice(),
    soni: () => joriy().q.length,
    // Navbatga qo'shish → navbatdagi kalit (o'sha so'rov oxirroqda turgan bo'lsa — uniki: qayta bosildi) yoki null (joy yo'q).
    qosh({ k, api, args, m = '' }) {
      const o = joriy(), im = imzosi(api, args);
      for (let j = o.q.length - 1; j >= 0; j--) {
        const i = o.q[j];
        if (imzosi(i.api, i.args) === im && (i.m || '') === m) return i.k;
        if (kesishadi(i.args, args)) break;
      }
      if (o.q.length >= max) return null;
      yoz({ q: [...o.q, { k, api, args, t: now(), m }], t: o.t });
      return k;
    },
    // Yetkazildi (sabab yo'q) yoki tashlandi (sabab: 'rad 400' …) — navbatdan olinadi.
    olib(k, sabab = '') {
      const o = joriy(), i = o.q.find((z) => z.k === k);
      if (i) yoz({ q: o.q.filter((z) => z !== i), t: sabab ? tashlandi(o, i, sabab, now()) : o.t });
    },
    // Server xatosi (5xx): qoladi; NAVBAT_5XX marta bo'lsa — tashlanadi (true).
    serverXato(k) {
      const o = joriy(), n = now(), i = o.q.find((z) => z.k === k);
      if (!i || n - (i.s || 0) < 60e3) return false;
      const z = { ...i, x: (i.x || 0) + 1, s: n };
      if (z.x >= NAVBAT_5XX) { yoz({ q: o.q.filter((y) => y !== i), t: tashlandi(o, i, 'server', n) }); return true; }
      yoz({ q: o.q.map((y) => (y === i ? z : y)), t: o.t });
      return false;
    },
    // Tashlanganlar (oxirgi 10): { api, sabab: 'eski' | 'server' | 'rad <status>', vaqt } — shaxsiy ma'lumotsiz.
    tashlangan: () => joriy().t.slice(),
    // Soni o'zgarganda fn(soni); qaytaradi — obunani bekor qilish.
    kuzat(fn) { kuzatuvchi.add(fn); return () => { kuzatuvchi.delete(fn); }; }
  };
}

// Ilova (app.mjs sorovchi standart sozlamada) ishlatadigan navbat — telefon localStorage'i.
let STANDART = null;
export const standartChiquvchi = () => STANDART || (STANDART = chiquvchiNavbat());
// Integrator uchun: nechta yozuv internet kutmoqda (window'siz ham ishlaydi), o'zgarishni kuzatish va ekrandagi matn.
export const kutayotganSoni = () => standartChiquvchi().soni();
export const kutayotganKuzat = (fn) => standartChiquvchi().kuzat(fn);
export const kutayotganTashlangan = () => standartChiquvchi().tashlangan();
export const kutayotganMatn = (n = kutayotganSoni()) => (n > 0 ? n + ' ta yozuv internet kutmoqda' : '');

const natijaShakl = (r, holat) => {
  const n = r.natija;
  return { holat, takror: !!r.takror, natija: r.takror ? TAKROR : n === null || n === undefined || n === '' ? true : n };
};
const navbatdaJavob = () => ({ holat: null, takror: false, natija: NAVBATDA });
const standartTaymer = (fn, ms) => { const t = setTimeout(fn, ms); if (t && typeof t.unref === 'function') t.unref(); return t; };

// Serverga yuboruvchi. serverga(api, args, initData, kalit) — store.mjs (testda — soxta).
// korinadimi() — sahifa oynasiz ko'rinib turibdimi (app.mjs: .sheet-bg yo'q); oyna yopilganda app.mjs korildi() ni chaqiradi.
//  yubor(api, args) → { holat: S | null (yo'q yoki eskirgan), natija, takror }; xato bo'lsa — tashlaydi.
//    natija: bo'sh javob → true; takror → TAKROR; 0 va boshqa qiymatlar — o'zgarmaydi.
//    OFLAYN amali tarmoq xatosida tashlamaydi — natija NAVBATDA (navbatga yozildi). Navbatda yozuv bo'lsa, OFLAYN amali navbat
//    oxiriga turadi va navbat yuboriladi: yetib borsa — server javobi, 400 — xato, internet yo'q — NAVBATDA.
//  holatOl() → { holat } | null (undan keyin yuborilgan so'rov javobi allaqachon qo'llangan — bu eskisi, xatosi ham jim).
//  navbatYubor() — navbatni hozir yuborish (bir vaqtda bitta). chiquvchi — navbat (soni, kuzat, tashlangan).
// oflayn: false — navbatsiz (oldingidek); { chiquvchi, nishon (window), hujjat (document), tg (Telegram.WebApp), taymer, toxtat }
// — testlar uchun; berilmasa — standart navbat va bor bo'lsa window/document/Telegram hodisalari.
export function sorovchi({ serverga, initData = () => '', kalitlar = kalitchi(), navbat = navbatchi(), korinadimi = () => true, band = {}, oflayn = {} }) {
  const keldi = (t) => { kalitlar.javobKeldi(t); if (korinadimi()) kalitlar.korildi(); };
  const of = oflayn && typeof oflayn === 'object' ? oflayn : {};
  const ch = oflayn ? of.chiquvchi || standartChiquvchi() : null;
  const kutuvchi = new Map();   // kalit → [{ ok, no }] — navbat orqali javobini kutayotgan yubor() lar
  const taymer = of.taymer || standartTaymer, toxtat = of.toxtat || clearTimeout;
  let aylanmoqda = null, qaytaT = 0, qaytaI = 0;
  const kutuvchiga = (k, fn) => { const ws = kutuvchi.get(k); kutuvchi.delete(k); if (ws) ws.forEach(fn); };
  // Navbatni tartib bilan yuborish. Tarmoq xatosi — to'xtaydi (qolgani keyingi safar); 400 va boshqa aniq javob — tashlanadi;
  // 5xx, 401, 408, 429 — qoladi, to'xtaydi. Boshqa akkauntning yozuvi (bir telefonda) — o'tkazib yuboriladi.
  async function aylan() {
    let qoldi = false;
    try {
      for (;;) {
        const men = kimIzi(initData());
        const it = ch.royxat().find((i) => !i.m || !men || i.m === men);
        if (!it) return;
        const t = kutuvchi.has(it.k) ? navbat.ol() : 0;   // javobni kutayotgan bo'lsa — holat tartibi (§7)
        let r, e = null;
        try { r = (await bandBolsaQayta(() => serverga(it.api, it.args, initData(), it.k), band)) || {}; } catch (x) { e = x || new Error('Noma\'lum xato'); }
        if (!e) {
          ch.olib(it.k);
          qaytaI = 0;
          const holat = t && r.holat && navbat.qollasa(t) ? r.holat : null;
          if (t) keldi(t);
          kutuvchiga(it.k, (w) => w.ok(natijaShakl(r, holat)));
          continue;
        }
        if (e.tarmoq) { qoldi = true; return; }
        if (e.status && e.status < 500 && ![401, 408, 429].includes(e.status)) {
          ch.olib(it.k, 'rad ' + e.status);   // bajarilmagani aniq (qoida xatosi) — qayta yuborilmaydi
          kutuvchiga(it.k, (w) => w.no(e));
          continue;
        }
        if ((!e.status || e.status >= 500) && ch.serverXato(it.k)) kutuvchiga(it.k, (w) => w.no(e));   // 10-marta — tashlandi
        qoldi = true;
        return;
      }
    } catch (x) { qoldi = true; /* kutilmagan xato — keyingi safar */ } finally {
      aylanmoqda = null;
      for (const k of [...kutuvchi.keys()]) kutuvchiga(k, (w) => w.ok(null));   // hali navbatda
      if (qoldi) qaytaRej();
    }
  }
  // aylan keyingi mikrotopshiriqda boshlanadi: aylanmoqda doim oldin qo'yiladi (darhol tugasa ham eskisi qolib ketmaydi);
  // aylan oxirida (bo'sh navbatni ko'rgan qadamning o'zida) aylanmoqda = null — shu orada qo'shilgan yozuv o'tkazib yuborilmaydi.
  function navbatYubor() {
    if (!ch) return Promise.resolve();
    if (!aylanmoqda) { if (qaytaT) { toxtat(qaytaT); qaytaT = 0; } aylanmoqda = Promise.resolve().then(aylan); }
    return aylanmoqda;
  }
  const turt = () => { try { if (ch && !aylanmoqda && ch.soni()) navbatYubor(); } catch (e) { /* bo'sh */ } };
  // Hodisa kelmasa ham (iPhone «online» bermaydi, operator DNS'i) — 15 s, 30 s … 5 daqiqadan keyin o'zi qayta.
  function qaytaRej() {
    try {
      if (!ch.soni()) { qaytaI = 0; return; }
      if (qaytaT) toxtat(qaytaT);
      qaytaT = taymer(() => { qaytaT = 0; turt(); }, NAVBAT_KUT[Math.min(qaytaI++, NAVBAT_KUT.length - 1)]);
    } catch (e) { /* bo'sh */ }
  }
  if (ch) {
    const nishon = 'nishon' in of ? of.nishon : typeof window !== 'undefined' ? window : null;
    const hujjat = 'hujjat' in of ? of.hujjat : typeof document !== 'undefined' ? document : null;
    const tg = 'tg' in of ? of.tg : nishon && nishon.Telegram && nishon.Telegram.WebApp;
    try { if (nishon && nishon.addEventListener) nishon.addEventListener('online', turt); } catch (e) { /* bo'sh */ }
    try {
      if (hujjat && hujjat.addEventListener) {
        hujjat.addEventListener('visibilitychange', () => { if (hujjat.visibilityState ? hujjat.visibilityState === 'visible' : !hujjat.hidden) turt(); });
      }
    } catch (e) { /* bo'sh */ }
    try { if (tg && typeof tg.onEvent === 'function') tg.onEvent('activated', turt); } catch (e) { /* bo'sh */ }
    turt();   // ilova qayta ochildi — oldingi ochilishda qolganlari
  }
  return {
    kalitlar, navbat, chiquvchi: ch, navbatYubor,
    async yubor(api, args) {
      const yengil = !!ch && OFLAYN.has(api);
      // Navbatda yozuv bor — yangisi ham oxiriga (tartib: kechikkan eski narx yangisi ustidan yozilmasin).
      if (yengil && ch.soni()) {
        const k0 = kalitlar.ber(api, args);
        const k = ch.qosh({ k: k0, api, args, m: kimIzi(initData()) });
        if (k) {
          kalitlar.tugadi(api, args, k0, null);   // kalit endi navbatniki — kalitchi uni boshqa urinishga bermaydi
          const javob = new Promise((ok, no) => kutuvchi.set(k, [...(kutuvchi.get(k) || []), { ok, no }]));
          navbatYubor();
          return (await javob) || navbatdaJavob();
        }
        // navbat to'la — oldingidek to'g'ridan-to'g'ri
      }
      const kalit = OQISH.has(api) ? null : kalitlar.ber(api, args);
      const t = navbat.ol();
      let r;
      try { r = (await bandBolsaQayta(() => serverga(api, args, initData(), kalit), band)) || {}; } catch (e) {
        if (yengil && kalit && e && e.tarmoq && ch.qosh({ k: kalit, api, args, m: kimIzi(initData()) })) {
          kalitlar.tugadi(api, args, kalit, null);   // kalit endi navbatniki
          qaytaRej();
          return navbatdaJavob();
        }
        if (kalit) kalitlar.tugadi(api, args, kalit, e, navbat.eng());
        throw e;
      }
      if (kalit) kalitlar.tugadi(api, args, kalit, null);
      const holat = r.holat && navbat.qollasa(t) ? r.holat : null;   // ba'zi amallar (retseptlar) holatni qaytarmaydi
      keldi(t);
      turt();   // internet bor — navbatda qolganlar ham ketsin
      return natijaShakl(r, holat);
    },
    async holatOl() {
      const t = navbat.ol();
      let r;
      try { r = (await bandBolsaQayta(() => serverga('holat', [], initData()), band)) || {}; } catch (e) {
        if (t !== navbat.eng()) return null;   // undan keyin yangi so'rov ketgan — o'shaniki hal qiladi
        throw e;
      }
      const qollandi = navbat.qollasa(t);
      keldi(t);
      turt();
      return qollandi ? { holat: r.holat } : null;
    },
    // Oyna yopildi — foydalanuvchi sahifani ko'rmoqda.
    korildi: () => kalitlar.korildi()
  };
}
