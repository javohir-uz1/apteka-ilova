// Server so'rovlari uchun DOM'siz yordamchilar (Node testlarida ham ishlaydi). app.mjs serverga faqat shu yerdagi
// sorovchi() orqali boradi: kalit (C1), kech kelgan javob qo'riqchisi (§7) va takror javobi bitta joyda.

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

// Serverga yuboruvchi. serverga(api, args, initData, kalit) — store.mjs (testda — soxta).
// korinadimi() — sahifa oynasiz ko'rinib turibdimi (app.mjs: .sheet-bg yo'q); oyna yopilganda app.mjs korildi() ni chaqiradi.
//  yubor(api, args) → { holat: S | null (yo'q yoki eskirgan), natija, takror }; xato bo'lsa — tashlaydi.
//    natija: bo'sh javob → true; takror → TAKROR; 0 va boshqa qiymatlar — o'zgarmaydi.
//  holatOl() → { holat } | null (undan keyin yuborilgan so'rov javobi allaqachon qo'llangan — bu eskisi, xatosi ham jim).
export function sorovchi({ serverga, initData = () => '', kalitlar = kalitchi(), navbat = navbatchi(), korinadimi = () => true, band = {} }) {
  const keldi = (t) => { kalitlar.javobKeldi(t); if (korinadimi()) kalitlar.korildi(); };
  return {
    kalitlar, navbat,
    async yubor(api, args) {
      const kalit = OQISH.has(api) ? null : kalitlar.ber(api, args);
      const t = navbat.ol();
      let r;
      try { r = (await bandBolsaQayta(() => serverga(api, args, initData(), kalit), band)) || {}; } catch (e) {
        if (kalit) kalitlar.tugadi(api, args, kalit, e, navbat.eng());
        throw e;
      }
      if (kalit) kalitlar.tugadi(api, args, kalit, null);
      const holat = r.holat && navbat.qollasa(t) ? r.holat : null;   // ba'zi amallar (retseptlar) holatni qaytarmaydi
      keldi(t);
      const n = r.natija;
      return { holat, takror: !!r.takror, natija: r.takror ? TAKROR : n === null || n === undefined || n === '' ? true : n };
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
      return qollandi ? { holat: r.holat } : null;
    },
    // Oyna yopildi — foydalanuvchi sahifani ko'rmoqda.
    korildi: () => kalitlar.korildi()
  };
}
