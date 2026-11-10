// Pul hisob-kitobi: smena, hamyonlar, mijozlar qarzi. DOM'siz — Node testlarida ham ishlaydi.
// Pul — so'mda butun son.
import { qidiruvKalit } from './kalit.mjs';

// Hisob qoidalari (CLAUDE.md "C qismi") — hammasi foydalanuvchi tomonidan tasdiqlangan (24.10).
// Smena savdosi doim yopilgan kunga yoziladi (tasdiqlangan 24.10) — savdoKuni() ga qarang.
export const FARAZLAR = {
  // tasdiqlangan: "Kassa" — direktor qabul qilgan pul (Osnovnoydagi seyf). Smena qutilari hamyon emas, faqat smena orqali hisoblanadi.
  kassa: 'direktor',
  mijozLimit: 'jami',         // tasdiqlangan: bitta mijozga limit — uning hamma ochiq (va ruxsat kutayotgan) qarzlari yig'indisiga
  qarzQaytishiHamyon: 'tanlanadi', // tasdiqlangan: direktor har safar Kassa yoki Uy ni tanlaydi
  bank: 'harakatlar'          // tasdiqlangan: bank harakatlari (POS, topshirish, o'tkazma) yoziladi, qoldiq ko'rsatilmaydi
};

export const ASOSIY_FILIAL = 'osnovnoy';
export const UZOQ_SMENA_SOAT = 16;
export const NAQD_HAMYON = ['kassa', 'uy'];
// Ruxsat etilgan pul ko'chirishlari (CLAUDE.md "Hamyonlar").
export const KOCHIRISH = [['kassa', 'uy'], ['uy', 'kassa'], ['kassa', 'bank'], ['uy', 'bank']];

// Audit 06.11: avval yaxlitlanadi (−0,4 → «0», «−0» emas); son bo'lmasa — 0 («NaN so'm» emas).
export const som = (n) => { const v = Math.round(Number.isFinite(Number(n)) ? Number(n) : 0); return (v < 0 ? '−' : '') + String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + " so'm"; };

// "1 250 000", "1250000", "1.250.000", "1,250,000" → 1250000. Tiyin yo'q: "1,5" yoki "12,50" — xato (null).
// Bo'sh yoki noto'g'ri → null (0 esa haqiqiy qiymat).
export function pul(v) {
  const s = String(v == null ? '' : v).trim().replace(/[\u00a0\u2009\u202f]/g, ' ');
  if (!/^\d+$/.test(s) && !/^\d{1,3}(?:[ .,]\d{3})+$/.test(s)) return null;
  const n = Number(s.replace(/[ .,]/g, ''));
  // Audit 29.10: 100 mlrd so'mdan katta summa — xato (ortiqcha nol); server ham qabul qilmaydi (api.mjs PUL_MAX).
  return Number.isSafeInteger(n) && n <= 1e11 ? n : null;
}

// ---- Punkt formasi ----
// Faqat raqamlar: "3010 1000 0000 11" → "30101000000011". Himoya kodi ko'rinishi: "123456" → "123-456".
export const raqamlar = (v) => String(v == null ? '' : v).replace(/\D/g, '');
export const kodKorinish = (v) => { const d = raqamlar(v).slice(0, 6); return d.length > 3 ? d.slice(0, 3) + '-' + d.slice(3) : d; };
// JSHSHIR: 14 raqam, 1-raqam 3–6, 2–7-raqamlar DDMMYY haqiqiy sana (SQL jshshir_xato, core.js checkJshshir bilan bir xil).
export function jshshirXato(j) {
  if (!/^\d{14}$/.test(j || '')) return 'JSHSHIR 14 raqam bo\'lishi kerak';
  if (!/^[3-6]/.test(j)) return 'JSHSHIR 3, 4, 5 yoki 6 bilan boshlanadi';
  const y = (j[0] < '5' ? 1900 : 2000) + Number(j.slice(5, 7)), m = Number(j.slice(3, 5)), d = Number(j.slice(1, 3));
  const t = new Date(Date.UTC(y, m - 1, d));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== m - 1 || t.getUTCDate() !== d) return 'JSHSHIR ichidagi tug\'ilgan sana noto\'g\'ri';
  return '';
}
// Forma → server bilan bir xil tekshiruv. Xato bo'lsa {maydon: matn}, aks holda null.
export function punktBemorXato(f) {
  const x = {};
  const ism = String(f.ism || '').trim();
  if (!/\p{L}.*\p{L}/u.test(ism) || ism.length > 100) x.ism = 'Bemorning ism-familiyasini yozing';
  const je = jshshirXato(raqamlar(f.jshshir));
  if (je) x.jshshir = je;
  const kodlar = (f.kodlar || []).map(raqamlar);
  if (!kodlar.some(Boolean)) x.kod0 = 'Himoya kodini yozing';
  kodlar.forEach((k, i) => { if (k && k.length !== 6) x['kod' + i] = 'Himoya kodi 6 raqam (masalan 123-456)'; });
  return Object.keys(x).length ? x : null;
}

// ---- Smena ----
// Kutilgan quti = ochilishdagi + naqd savdo − xarajat − direktor smena davomida olgan pul.
export const xarajatJami = (sm) => (sm.xarajatlar || []).reduce((a, x) => a + x.summa, 0);
export const olinganJami = (sm) => (sm.olindi || []).reduce((a, x) => a + x.summa, 0);
export const kutilgan = (sm) => (sm.ochilishPul || 0) + (sm.naqd || 0) - xarajatJami(sm) - olinganJami(sm);
export const farq = (sm) => (sm.sanalgan || 0) - kutilgan(sm);
export const topshiriladi = (sm) => Math.max(0, (sm.sanalgan || 0) - (sm.qoldirildi || 0));

export function ochiqSoat(sm, now = Date.now()) {
  return sm && sm.ochildi && !sm.yopildi ? (now - sm.ochildi) / 36e5 : 0;
}

// Qaysi "kimga" variantlari mumkin: kunduzgi Osnovnoy → tungiga (hammasi qutida) yoki direktorga; qolganlar — direktorga.
export const kimgaVariantlar = (sm) => (sm.filialId === ASOSIY_FILIAL && sm.nom === 'kunduzgi' ? ['tungi', 'direktor'] : ['direktor']);

// Yopish formasi: naqd 0 bo'lishi mumkin (faqat karta bilan sotilgan smena), bo'sh esa — yo'q.
export function yopishTekshir(f, sm) {
  const x = [];
  const naqd = pul(f.naqd), karta = pul(f.karta), san = pul(f.sanalgan), qol = pul(f.qoldirildi);
  if (naqd == null) x.push('Naqd savdoni kiriting (savdo bo\'lmasa — 0)');
  if (karta == null) x.push('Karta savdoni kiriting (bo\'lmasa — 0)');
  if (san == null) x.push('Kassada sanalgan pulni kiriting');
  if (qol == null) x.push('Kassada qoldiriladigan summani kiriting');
  if (san != null && qol != null && qol > san) x.push('Qoldiriladigan summa sanalgan puldan ko\'p bo\'lishi mumkin emas');
  if (!f.kimga) x.push('Pulni kimga topshirishni tanlang');
  else if (sm && !kimgaVariantlar(sm).includes(f.kimga)) x.push('Bu smenadan pul faqat direktorga topshiriladi');
  if (f.kimga === 'tungi' && san != null && qol !== san) x.push('Tungi smenaga topshirilganda hamma pul kassada qoladi');
  // 28.10 (server smena_yopish bilan bir xil): kassada pul bo'lishi kerak, lekin 0 yozilgan — deyarli doim xato.
  const kut = sm && naqd != null ? kutilgan({ ...sm, naqd }) : 0;
  if (san === 0 && kut > 0) x.push('Kassadagi pulni sanab yozing — kassada ' + som(kut) + ' bo\'lishi kerak, 0 yozildi');
  return { xatolar: x, qiymat: { naqd, karta, sanalgan: san, qoldirildi: qol, kimga: f.kimga } };
}

// Smena yopilganda hamyonlarga ta'sir: faqat karta savdo — bankka (POS). Naqd qutida qoladi va direktor qabul qilganda Kassa/Uyga o'tadi.
export function yopishHarakatlari(sm) {
  return sm.karta ? [{ tur: 'pos', izoh: 'POS (karta savdo)', d: { bank: sm.karta } }] : [];
}

// Topshirilgan pulni direktor qabul qiladi: Kassaga (seyf) yoki Uyga. Filial puli ham shunday — kirim emas.
export function qabulHarakatlari(sm, hamyon, filialNom = '') {
  const s = topshiriladi(sm);
  if (!s) return [];
  return [{ tur: sm.filialId === ASOSIY_FILIAL ? 'qabul' : 'filialdanPul', izoh: sm.filialId === ASOSIY_FILIAL ? 'Smena puli qabul qilindi' : 'Filialdan pul (' + filialNom + ')', d: { [hamyon]: s } }];
}

// Smena davomidagi xarajat qutidan to'lanadi — hamyonga ta'sir qilmaydi, daftarda xarajat bo'lib ko'rinadi.
export const xarajatHarakati = (sm, summa, izoh) => ({ tur: 'xarajat', izoh: izoh || 'Xarajat', summa, d: {}, filialId: sm.filialId });

// Hamyon qoldig'i = boshlang'ich + sozlama.hisobBoshi (server ro'yxatga qo'shmagan, 400 kundan eski yozuvlar yig'indisi)
// + ro'yxatdagi harakatlar. Ilova qoldiqni o'zi yig'masin — qoldiq(S, 'kassa') dan foydalansin (SQL hamyonlar() bilan bir xil).
const yigindi = (harakatlar, hamyon) => (harakatlar || []).reduce((a, h) => a + ((h.d && h.d[hamyon]) || 0), 0);
export function qoldiq(S, hamyon) {
  const so = (S && S.sozlama) || {};
  return ((so.boshlangich || {})[hamyon] || 0) + ((so.hisobBoshi || {})[hamyon] || 0) + yigindi(S && S.harakatlar, hamyon);
}
// Eski ko'rinish: hamyonQoldiq(harakatlar, hamyon, boshlangich) — hisobBoshi'siz. Birinchi argument S bo'lsa — qoldiq(S, hamyon).
export function hamyonQoldiq(harakatlar, hamyon, boshlangich = 0) {
  if (harakatlar && !Array.isArray(harakatlar)) return qoldiq(harakatlar, hamyon);
  return boshlangich + yigindi(harakatlar, hamyon);
}

// Kun kaliti — Toshkent vaqti (UTC+5, yozgi vaqt yo'q), telefon qaysi mintaqada bo'lishidan qat'i nazar: server (ilova.kun)
// bilan bir xil. Aks holda boshqa mintaqadagi telefonda tungi bemor/smena boshqa kunga tushardi (audit 26.10).
const TOSHKENT = 5 * 3600e3;
export function kunKey(ts) {
  const t = new Date(ts).getTime();
  return Number.isFinite(t) ? new Date(t + TOSHKENT).toISOString().slice(0, 10) : '';
}
// Kalitlar ustida sana hisobi (mintaqaga bog'liq emas): kunga n kun qo'shish, oyga n oy qo'shish, oyning oxirgi kuni.
export const kunQosh = (k, n) => { const [y, m, d] = k.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
export const oyQosh = (oy, n) => { const [y, m] = oy.split('-').map(Number); return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7); };
export const oyOxirgiKun = (oy) => { const [y, m] = oy.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); };

// Savdo qaysi kunga yoziladi: yopilgan kunga (tungi smena ham). Ochiq smena — ochilgan kuni.
export const savdoKuni = (sm) => kunKey(sm.yopildi || sm.ochildi);
// «Bajarish kerak»: kecha savdosi kiritilmagan filiallar — oxirgi 30 kunda savdosi bo'lganlar, «Savdo bo'lmadi» deb belgilanmaganlar
// (S.savdoYoq, 20261030130000_savdo_yoq.sql). Direktor Bosh va Oddiy rejim shu bilan.
export function kechaSavdosiz(S, bugun) {
  const kecha = kunQosh(bugun, -1), oy30 = kunQosh(bugun, -30);
  const yop = S.smenalar.filter((z) => !z.bekor && z.yopildi);
  const yoq = new Set((S.savdoYoq || []).map((y) => y.filialId + '|' + y.kun));
  return S.filiallar.filter((f) => !yop.some((z) => z.filialId === f.id && savdoKuni(z) === kecha) && !yoq.has(f.id + '|' + kecha)
    && yop.some((z) => z.filialId === f.id && savdoKuni(z) >= oy30));
}
export const savdoYoqmi = (S, filialId, kun) => (S.savdoYoq || []).some((y) => y.filialId === filialId && y.kun === kun);
// Savdoga kiradi: yopilgan, direktor tasdiqlagan (yoki o'zi kiritgan), bekor qilinmagan.
export const hisobda = (sm) => !!(sm.yopildi && sm.tasdiq && !sm.bekor);
export const tasdiqKutadi = (sm) => !!(sm.yopildi && !sm.tasdiq && !sm.bekor);

// ---- Mijozlar qarzi ----
export function normTel(t) {
  let d = String(t || '').replace(/\D/g, '');
  if (d.length === 9) d = '998' + d;
  return d.length === 12 && d.startsWith('998') ? '+' + d : null;
}

// 09.11: qoldiq — qabul qilingan to'lovlar (tolovlar) va xodimdagi to'lovlar (pullar, holat «xodimda») ayriladi (SQL qarz_qoldiq).
export const qarzQoldiq = (q) => q.summa - (q.tolovlar || []).reduce((a, t) => a + t.summa, 0)
  - (q.pullar || []).filter((p) => p.holat === 'xodimda').reduce((a, p) => a + p.summa, 0);
// Bo'lib to'lashda yangi muddat (q.muddat); bo'lmasa — berilgan kun + muddat kunlari.
export const muddatKuni = (q) => (q.muddat ? q.muddat : q.berildi + q.muddatKun * 864e5);
// Xodim olgan, direktor hali qabul qilmagan qarz pullari: [{ qarz, pul }], yangisi oxirida.
export const xodimdagiPullar = (qarzlar, xodimId) => (qarzlar || []).flatMap((q) => (q.pullar || [])
  .filter((p) => p.holat === 'xodimda' && (!xodimId || p.xodimId === xodimId)).map((p) => ({ qarz: q, pul: p }))).sort((a, b) => a.pul.ts - b.pul.ts);
export const muddatiOtgan = (q, now = Date.now()) => qarzQoldiq(q) > 0 && now > muddatKuni(q);
export const mijozOchiq = (qarzlar, tel) => qarzlar.filter((q) => q.tel === tel).reduce((a, q) => a + Math.max(0, qarzQoldiq(q)), 0);
export const xodimOchiq = (qarzlar, xodimId) => qarzlar.filter((q) => q.xodimId === xodimId).reduce((a, q) => a + Math.max(0, qarzQoldiq(q)), 0);

// Yangi qarz: limitlar (bitta mijozga — jami ochiq qarzi bilan, xodimga — uning ochiq qarzlari jami) va muddati o'tgan qarz.
export function qarzTekshir(f, qarzlar, xodimId, sozlama, now = Date.now()) {
  const xatolar = [], ogohlantirish = [];
  const summa = pul(f.summa), tel = normTel(f.tel), ism = String(f.ism || '').trim();
  if (ism.length < 3) xatolar.push('Mijozning ism-sharifini kiriting');
  if (!tel) xatolar.push('Telefon raqami noto\'g\'ri (+998 XX XXX XX XX)');
  if (!summa || summa <= 0) xatolar.push('Summani kiriting');
  if (![3, 7, 14, 30].includes(Number(f.muddatKun))) xatolar.push('Qaytarish muddatini tanlang');
  let limit = null;
  if (tel && summa > 0) {
    const mijoz = mijozOchiq(qarzlar, tel);
    if (mijoz + summa > sozlama.limitMijoz) limit = 'Bitta mijozga limit ' + som(sozlama.limitMijoz) + ' (hozir ochiq: ' + som(mijoz) + '). Direktor ruxsati kerak.';
    const xodim = xodimOchiq(qarzlar, xodimId);
    if (!limit && xodim + summa > sozlama.limitXodim) limit = 'Sizning ochiq qarzlaringiz limiti ' + som(sozlama.limitXodim) + ' (hozir: ' + som(xodim) + '). Direktor ruxsati kerak.';
    const otgan = qarzlar.filter((q) => q.tel === tel && muddatiOtgan(q, now));
    if (otgan.length) ogohlantirish.push('Bu mijozning muddati o\'tgan qarzi bor: ' + som(otgan.reduce((a, q) => a + qarzQoldiq(q), 0)) + '. Direktorga xabar boradi.');
  }
  return { xatolar, limit, ogohlantirish, qiymat: { ism, tel, summa, muddatKun: Number(f.muddatKun) } };
}

// Direktor "Undirildi": qisman bo'lishi mumkin, qoldiqdan ko'p bo'lishi mumkin emas.
export function undirishTekshir(q, summaStr) {
  const s = pul(summaStr), qol = qarzQoldiq(q);
  if (!s || s <= 0) return { xato: 'Summani kiriting' };
  if (s > qol) return { xato: 'Qoldiq ' + som(qol) + ' — undan ko\'p yozib bo\'lmaydi' };
  return { summa: s, toliq: s === qol };
}

// ---- Oylik ----
export const avansJami = (x, oy) => (x.avanslar || []).filter((a) => a.oy === oy && !a.bekor).reduce((s, a) => s + a.summa, 0);
export const oyOxiri = (x, oy) => (x.oylik || 0) - avansJami(x, oy);

// ---- Ta'minotchilar ----
// Amal holati: 'ok' — ikkala tomon tasdiqlagan (yoki ta'minotchi botga ulanmagan);
// 'kutish' — biz yozdik, ta'minotchi tasdig'i kutilmoqda; 'ular' — ta'minotchi yozdi, biz tasdiqlamadik.
const ishora = (a) => (a.tur === 'xarid' ? a.summa : -a.summa);
export const bizBoyicha = (t) => (t.boshlangichQarz || 0) + t.amallar.filter((a) => a.holat !== 'ular' && !a.bekor).reduce((s, a) => s + ishora(a), 0);
export const ularBoyicha = (t) => (t.boshlangichQarz || 0) + t.amallar.filter((a) => a.holat !== 'kutish' && !a.bekor).reduce((s, a) => s + ishora(a), 0);
// 07.11 (maket C, foydalanuvchi tanladi): «Qarz qanday chiqdi» — boshlang'ich + dorilar − pullar = qarz. rol 'dir' — bizBoyicha
// (ta'minotchi yozib hali tasdiqlanmagani kirmaydi), 'ta' — ularBoyicha (apteka yozib u hali tasdiqlamagani kirmaydi). Natija qarz
// har doim bizBoyicha / ularBoyicha bilan teng (test tekshiradi). Yozuvlar sanasi — a.sana (olib kelingan kun) yoki yozilgan kun.
export function taSana(a) { return (a && /^\d{4}-\d{2}-\d{2}$/.test(a.sana || '') ? a.sana : kunKey(a && a.ts)); }
export function taHisob(t, rol) {
  const kirmaydi = rol === 'ta' ? 'kutish' : 'ular';
  const hisobda = (a) => !a.bekor && a.holat !== kirmaydi;
  const yoz = ((t && t.amallar) || []).map((a) => ({ a, sana: taSana(a), hisobda: hisobda(a) }))
    .sort((x, y) => (x.sana < y.sana ? -1 : x.sana > y.sana ? 1 : (x.a.ts || 0) - (y.a.ts || 0)));
  const dori = yoz.filter((y) => y.a.tur === 'xarid'), pul = yoz.filter((y) => y.a.tur !== 'xarid');
  const jamiD = dori.filter((y) => y.hisobda).reduce((s, y) => s + (y.a.summa || 0), 0);
  const jamiP = pul.filter((y) => y.hisobda).reduce((s, y) => s + (y.a.summa || 0), 0);
  // Boshqa tomon hali tasdiqlamagan (hisobga kirmagan, bekor emas) — alohida ko'rsatiladi.
  const kutish = yoz.filter((y) => !y.a.bekor && !y.hisobda);
  return { bosh: (t && t.boshlangichQarz) || 0, dori, pul, jamiD, jamiP, nD: dori.filter((y) => y.hisobda).length, nP: pul.filter((y) => y.hisobda).length,
    qarz: ((t && t.boshlangichQarz) || 0) + jamiD - jamiP, kutish, kutishSumma: kutish.reduce((s, y) => s + ishora(y.a), 0) };
}
// Ta'minotchi «Noto'g'ri» degan, hali hal qilinmagan yozuvlar (04.11): bekor qilinmagan va u hali tasdiqlamagan.
export const taEtirozlar = (t) => (t.amallar || []).filter((a) => a.etiroz && !a.bekor && a.holat === 'kutish');
// Direktor ko'radigan holat matni: ulanmagan paytda yozilgan (avto) — alohida.
export function taHolatDir(a) {
  if (a.bekor) return null;
  if (a.holat === 'ular') return ['Ta\'minotchi yozdi — tasdiqlang', 'var(--info)'];
  if (a.holat === 'kutish') return a.etiroz ? ['Ta\'minotchi e\'tiroz bildirdi', 'var(--red)'] : ['Ta\'minotchi tasdig\'i kutilmoqda', 'var(--warn)'];
  if (a.avto) return ['Ta\'minotchi ulanmagan paytda yozilgan', 'var(--muted)'];
  return ['Ikkala tomon tasdiqlagan', 'var(--accent)'];
}

// ---- Xarid formasida «Shumi?» (04.11; foydalanuvchi: "ta'minotchi bir dorini kiritganida eslab qolsin, keyingi safar shumi deb so'rasin") ----
// Shu ta'minotchining oldingi xaridlaridagi dori nomlari (bekor qilinmagan), har nom bir marta — oxirgi yozilgani (narx, soni bilan).
export function xaridEslatma(t) {
  const m = new Map();
  for (const a of (t && t.amallar) || []) {
    if (a.tur !== 'xarid' || a.bekor) continue;
    for (const q of a.qatorlar || []) {
      const k = qidiruvKalit(q.dori);
      if (!k) continue;
      const eski = m.get(k);
      if (!eski || (a.ts || 0) >= eski.ts) m.set(k, { dori: String(q.dori).trim(), narx: q.narx, soni: q.soni, ts: a.ts || 0, k, marta: (eski ? eski.marta : 0) + 1 });
      else eski.marta += 1;
    }
  }
  return [...m.values()].sort((x, y) => y.ts - x.ts);
}
// 07.11: xarid oynasi uchun — ta'minotchi dorilari ro'yxati (server t.dorilar: direktor kiritgan + xaridlardan) va oldingi
// xaridlardagi nomlar birga (bir dori bir marta — talaffuz kaliti bo'yicha; oldingi xariddagi oxirgi narx ustun).
export function taDoriEslatma(t) {
  const esl = xaridEslatma(t), bor = new Set(esl.map((e) => e.k));
  for (const d of (t && t.dorilar) || []) {
    const k = qidiruvKalit(d.nom);
    if (!k || bor.has(k)) { const e = esl.find((x) => x.k === k); if (e && d.n > e.marta) e.marta = d.n; continue; }
    bor.add(k);
    esl.push({ dori: String(d.nom).trim(), narx: d.narx || null, soni: null, ts: 0, k, marta: d.n || 0 });
  }
  return esl;
}
// Yozilayotgan matnga mos oldingi nomlar (eng ko'pi n ta): har so'z biror so'z boshida bo'lsin; boshi mos — oldin, keyin ko'p yozilgani.
export function doriTaklif(esl, matn, n = 3) {
  const q = qidiruvKalit(matn);
  if (q.length < 2) return [];
  const sozlar = q.split(' ');
  // So'z boshi mos; 4+ harfda bitta harf xatosi ham («трамб» → Trombopol).
  const mos = (w, s) => w.startsWith(s) || (s.length >= 4 && w.length >= s.length && tahrirMasofa(w.slice(0, s.length), s) <= 1);
  return esl.filter((e) => e.k !== q && sozlar.every((s) => e.k.split(' ').some((w) => mos(w, s))))
    .sort((a, b) => (b.k.startsWith(q) - a.k.startsWith(q)) || (b.marta - a.marta) || (b.ts - a.ts)).slice(0, n);
}
// Yozilgan nom oldingi nomdan bir-ikki harf bilan farq qilsa (yoki faqat yozuvi boshqa: kirill/lotin, katta harf) — o'sha nom.
// Aynan bir xil bo'lsa yoki o'xshashi yo'q bo'lsa — null. Raqamlar (doza, №) farq qilsa — boshqa dori.
export function doriOxshash(esl, matn) {
  const s = String(matn || '').trim(), q = qidiruvKalit(s);
  if (q.length < 3 || esl.some((e) => e.dori === s)) return null;
  const raqam = (k) => (k.match(/\d+/g) || []).join(' ');
  let eng = null, engM = Infinity;
  for (const e of esl) {
    if (raqam(e.k) !== raqam(q)) continue;
    const d = e.k === q ? 0 : tahrirMasofa(e.k, q);
    const chek = q.length >= 10 ? 2 : q.length >= 5 ? 1 : 0;
    if (d <= chek && d < engM) { eng = e; engM = d; }
  }
  return eng;
}
function tahrirMasofa(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 3;
  let old = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(old[j] + 1, cur[j - 1] + 1, old[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    old = cur;
  }
  return old[b.length];
}

// Xarid dori ro'yxati (forma qatorlari matn): bo'sh qatorlar tashlanadi; summa = soni × dona narxi.
export function xaridQatorlar(rows) {
  const qatorlar = [];
  for (const [i, r] of (rows || []).entries()) {
    const dori = String(r.dori || '').trim(), sStr = String(r.soni || '').trim(), nStr = String(r.narx || '').trim();
    if (!dori && !sStr && !nStr) continue;
    const soni = /^\d{1,6}$/.test(sStr.replace(/\s/g, '')) ? Number(sStr.replace(/\s/g, '')) : null, narx = pul(nStr);
    if (soni > 100000) return { xato: (i + 1) + '-qator: soni 100 000 dan oshmasin' };
    if (narx != null && narx > 99999999999) return { xato: (i + 1) + '-qator: narx juda katta' };
    if (dori.length < 2 || !soni || narx == null) return { xato: (i + 1) + '-qator: dori nomi, soni va narxini to\'g\'ri yozing' };
    qatorlar.push({ dori, soni, narx });
  }
  return { qatorlar, jami: qatorlar.reduce((a, q) => a + q.soni * q.narx, 0) };
}

// Bir nechta hamyondan to'lov: "uydan 10 mln + kassadan 2 mln". Bo'sh maydon — 0.
export function tolovTekshir(m) {
  const q = {};
  for (const k of ['kassa', 'uy', 'bank']) {
    const v = m[k] == null || String(m[k]).trim() === '' ? 0 : pul(m[k]);
    if (v == null) return { xato: 'Summa noto\'g\'ri' };
    if (v) q[k] = v;
  }
  const jami = Object.values(q).reduce((a, b) => a + b, 0);
  return jami > 0 ? { manbalar: q, jami } : { xato: 'Kamida bitta hamyondan summa kiriting' };
}

// ---- Kun va oy ----

export function kunSavdo(smenalar, kun) {
  const out = { naqd: 0, karta: 0, jami: 0, filiallar: {} };
  smenalar.filter((m) => hisobda(m) && savdoKuni(m) === kun).forEach((m) => {
    const f = out.filiallar[m.filialId] || (out.filiallar[m.filialId] = { naqd: 0, karta: 0 });
    f.naqd += m.naqd || 0; f.karta += m.karta || 0;
    out.naqd += m.naqd || 0; out.karta += m.karta || 0;
  });
  out.jami = out.naqd + out.karta;
  return out;
}

export function oySavdo(smenalar, oy) {
  const out = { jami: 0, filiallar: {}, kunlar: {} };
  smenalar.filter((m) => hisobda(m) && savdoKuni(m).startsWith(oy)).forEach((m) => {
    const v = (m.naqd || 0) + (m.karta || 0), k = savdoKuni(m);
    out.jami += v;
    out.filiallar[m.filialId] = (out.filiallar[m.filialId] || 0) + v;
    out.kunlar[k] = (out.kunlar[k] || 0) + v;
  });
  return out;
}

// Bekor qilingan yozuvlar "tuzatish" (teskari summa) bilan qoplanadi — yig'indida ikkalasi ham hisoblanadi.
const turi = (h) => (h.tur === 'tuzatish' ? h.aslTur : h.tur);
const summasi = (h) => (h.summa != null ? h.summa : Math.abs(Object.values(h.d || {}).reduce((x, y) => x + y, 0)));

// Bog'lanish: qaysi yozuv avans (xodimlar[].avanslar[].harakatId) va qaysi biri qarz qaytishi (harakatlar[].qarzId).
// Holat har javobda yangi obyekt; sinov rejimida esa joyida o'zgaradi — shuning uchun soni bo'yicha yangilanadi.
const BOG = new WeakMap();
function boglanish(S) {
  const hs = S.harakatlar || [], xs = S.xodimlar || [];
  const av = xs.reduce((a, x) => a + (x.avanslar || []).length, 0);
  const c = BOG.get(hs);
  if (c && c.n === hs.length && c.av === av && c.xs === xs) return c;
  const b = { n: hs.length, av, xs, avans: new Set(), qarz: new Set() };
  xs.forEach((x) => (x.avanslar || []).forEach((a) => a.harakatId && b.avans.add(a.harakatId)));
  hs.forEach((h) => h.qarzId && b.qarz.add(h.id));
  BOG.set(hs, b);
  return b;
}
// Uy yozuvi: faqat uy hamyoniga tegadigan xarajat/kirim. Avans va qaytgan qarz — apteka puli (bekor qilish yozuvi — aslidan bilinadi);
// izoh matniga qaralmaydi — SQL uy_yozuvi bilan bir xil. S berilmasa (eski chaqiruv) — avans izohdan taxmin qilinadi.
export function uyYozuvi(h, S) {
  if (!((turi(h) === 'xarajat' || turi(h) === 'kirim') && h.d && h.d.uy && !(h.d.kassa || h.d.bank))) return false;
  if (h.qarzId) return false;
  if (!S || !Array.isArray(S.harakatlar)) return !/^(Bekor qilindi: )?(Avans:|Qarz qaytdi:)/.test(h.izoh || '');
  const b = boglanish(S), asl = h.tur === 'tuzatish' ? h.asl : h.id;
  return !b.avans.has(asl) && !b.qarz.has(asl);
}
// Kunlik yig'indilar: birinchi argument — S (bog'lanish bilan, SQL bilan bir xil) yoki eski usulda harakatlar ro'yxati.
const royxat = (S) => (Array.isArray(S) ? S : (S && S.harakatlar) || []);
const holati = (S) => (Array.isArray(S) ? null : S);
// Bekor qilingan yozuv va uning teskari "tuzatish"i yig'indiga kirmaydi — bekor qilish boshqa kunda bo'lsa ham
// o'sha kunda manfiy xarajat chiqmaydi (audit 26.10). SQL kun_yigindi / kun_uy_xarajat bilan bir xil.
// Bekor qilinganlar: belgisi bor (h.bekor) yoki unga teskari tuzatish yozuvi bor (asl).
const bekorlar = (r) => new Set(r.filter((h) => h.tur === 'tuzatish' && h.asl).map((h) => h.asl));
const amaldaF = (r) => { const bk = bekorlar(r); return (h) => h.tur !== 'tuzatish' && !h.bekor && !bk.has(h.id); };
const kunYigindi = (S, kun, tur) => { const r = royxat(S), amalda = amaldaF(r); return r.filter((h) => amalda(h) && h.tur === tur && kunKey(h.ts) === kun && !uyYozuvi(h, holati(S))).reduce((a, h) => a + summasi(h), 0); };
export const kunUyXarajat = (S, kun) => { const r = royxat(S), amalda = amaldaF(r); return r.filter((h) => amalda(h) && h.tur === 'xarajat' && kunKey(h.ts) === kun && uyYozuvi(h, holati(S))).reduce((a, h) => a + summasi(h), 0); };
export const kunXarajat = (S, kun) => kunYigindi(S, kun, 'xarajat');
export const kunKirim = (S, kun) => kunYigindi(S, kun, 'kirim');
export const kunTolov = (S, kun) => kunYigindi(S, kun, 'tolov');

// ---- Hisobot: davr savdosi (26.10) ----
// Davr savdosi batafsil: jami, naqd, karta; har filial (naqd/karta alohida); kunlar va oylar bo'yicha jami.
// Faqat tasdiqlangan savdo (hisobda), smena yopilgan kunga — kunSavdo/oySavdo bilan bir xil qoida.
export function davrSavdo(smenalar, dan, gacha) {
  const out = { jami: 0, naqd: 0, karta: 0, filiallar: {}, kunlar: {}, oylar: {}, smenaSoni: 0 };
  (smenalar || []).forEach((m) => {
    if (!hisobda(m)) return;
    const k = savdoKuni(m);
    if (k < dan || k > gacha) return;
    const n = m.naqd || 0, c = m.karta || 0;
    const f = out.filiallar[m.filialId] || (out.filiallar[m.filialId] = { jami: 0, naqd: 0, karta: 0 });
    f.naqd += n; f.karta += c; f.jami += n + c;
    out.naqd += n; out.karta += c; out.jami += n + c;
    out.kunlar[k] = (out.kunlar[k] || 0) + n + c;
    out.oylar[k.slice(0, 7)] = (out.oylar[k.slice(0, 7)] || 0) + n + c;
    out.smenaSoni += 1;
  });
  return out;
}
// Davr chegaralari (kun kalitlari, ikkalasi ham kiradi). tur: 'hafta' — kalit = oxirgi kun 'YYYY-MM-DD' (7 kun);
// 'oy' — 'YYYY-MM'; 'yil' — 'YYYY'. Kunlar soni — kunlik o'rtacha uchun (davr hali tugamagan bo'lsa — bugungacha).
const kunDan = (k) => { const [y, m, d] = k.split('-').map(Number); return Date.UTC(y, m - 1, d); };
export function davrChegara(tur, kalit, bugun = kunKey(Date.now())) {
  let dan, gacha;
  if (tur === 'hafta') { gacha = kalit; dan = kunQosh(kalit, -6); }
  else if (tur === 'yil') { dan = kalit + '-01-01'; gacha = kalit + '-12-31'; }
  else { dan = kalit + '-01'; gacha = oyOxirgiKun(kalit); }
  const oxiri = gacha < bugun ? gacha : bugun;
  const kunlar = oxiri < dan ? 0 : Math.round((kunDan(oxiri) - kunDan(dan)) / 864e5) + 1;
  return { dan, gacha, kunlar };
}
// Davrning birinchi n kuni (tugamagan davr bilan teng solishtirish uchun).
export function davrBoshi(c, n) {
  const oxiri = kunQosh(c.dan, Math.max(1, n) - 1);
  return { dan: c.dan, gacha: oxiri < c.gacha ? oxiri : c.gacha, kunlar: Math.min(n, c.kunlar) };
}
// Oldingi davr kaliti: 7 kun oldin / oldingi oy / oldingi yil.
export function oldingiDavr(tur, kalit) {
  if (tur === 'hafta') return kunQosh(kalit, -7);
  if (tur === 'yil') return String(Number(kalit) - 1);
  return oyQosh(kalit, -1);
}
// O'zgarish foizi (a — hozir, b — solishtiriladigan): b = 0 bo'lsa — null (solishtirib bo'lmaydi).
export const ozgarish = (a, b) => (b ? Math.round((a / b - 1) * 1000) / 10 : null);
// Audit 10.11 (statistika doim «tushdi»): hisobotning oxirgi kuni — bugun tasdiqlangan savdo bo'lsa bugun, aks holda kecha
// (savdoni direktor ertasi kuni kiritadi — bugungi 0 davrga kirsa «7 kun» 6 kunni 7 bilan solishtirardi, oyning 1-kuni −100%).
export function oxirgiKun(smenalar, bugun) {
  return (smenalar || []).some((m) => hisobda(m) && savdoKuni(m) === bugun) ? bugun : kunQosh(bugun, -1);
}
// Tanlangan davr (oxirigacha) va solishtiriladigan davr — teng kunlar soni. Davr tugamagan bo'lsa solishtiriladiganning ham
// birinchi shuncha kuni; davrda hali kun yo'q bo'lsa (kunlar 0) — solishtiriladigan ham bo'sh (0 bilan 0, foiz chiqmaydi).
export function statDavrlar(tur, kalit, solKalit, oxiri) {
  const ch = davrChegara(tur, kalit, oxiri);
  const qisman = ch.kunlar < davrChegara(tur, kalit, '9999-12-31').kunlar;
  const s = davrChegara(tur, solKalit, '9999-12-31');
  const chS = !qisman ? s : ch.kunlar ? davrBoshi(s, ch.kunlar) : { dan: s.dan, gacha: kunQosh(s.dan, -1), kunlar: 0 };
  return { ch, chS, qisman };
}
// Ilova so'nggi 400 kunni yuklaydi (server C3: harakatlar va smenalar now() − 400 kun): to'liq yuklangan eng eski kun.
export const ILOVA_KUNLAR = 400;
export const ilovaBoshi = (bugun) => kunQosh(bugun, -(ILOVA_KUNLAR - 1));

// ---- Kirim va chiqim (doira diagrammalar, 26.10) ----
// Davr — kun kalitlari [dan, gacha] (YYYY-MM-DD, ikkalasi ham kiradi).
const davrda = (ts, dan, gacha) => { const k = kunKey(ts); return k >= dan && k <= gacha; };
// Kirim — tasdiqlangan savdo (naqd + karta) filiallar bo'yicha, smena yopilgan kunga.
export function davrKirim(S, dan, gacha) {
  const filiallar = {};
  let jami = 0;
  (S.smenalar || []).filter((m) => hisobda(m) && savdoKuni(m) >= dan && savdoKuni(m) <= gacha).forEach((m) => {
    const v = (m.naqd || 0) + (m.karta || 0);
    filiallar[m.filialId] = (filiallar[m.filialId] || 0) + v;
    jami += v;
  });
  return { jami, filiallar };
}
// Chiqim: oylik (avanslar), ta'minotchilarga to'lov (har biri alohida), bankka va uyga olib ketilgan (seyfdan ko'chirish),
// boshqa xarajatlar (smena va daftar xarajatlari; avans va uy hamyonidan xarajat — kirmaydi). Bekor qilinganlar hisobga olinmaydi:
// avans/to'lov — bekor belgisi bilan, ko'chirish va xarajat — teskari "tuzatish" yozuvi bilan qoplanadi.
export function davrChiqim(S, dan, gacha) {
  const b = boglanish(S);
  let oylik = 0, bank = 0, uy = 0, boshqa = 0;
  const taminotchilar = {};
  (S.xodimlar || []).forEach((x) => (x.avanslar || []).forEach((a) => { if (!a.bekor && davrda(a.ts, dan, gacha)) oylik += a.summa || 0; }));
  (S.taminotchilar || []).forEach((t) => (t.amallar || []).forEach((a) => {
    // Faqat seyfdan berilgan qismi (bankdan to'langani "Bankka" bo'lib allaqachon chiqim — ikki marta sanalmasin).
    const seyfdan = a.manbalar ? (a.manbalar.kassa || 0) : (a.summa || 0);
    if (a.tur === 'tolov' && !a.bekor && seyfdan && davrda(a.ts, dan, gacha)) taminotchilar[t.id] = (taminotchilar[t.id] || 0) + seyfdan;
  }));
  const amalda = amaldaF(S.harakatlar || []);
  (S.harakatlar || []).forEach((h) => {
    if (!amalda(h) || !davrda(h.ts, dan, gacha)) return;
    const d = h.d || {}, tur = h.tur;
    if (tur === 'kochirish') {
      if (d.bank && d.kassa) bank += d.bank;
      else if (d.uy && d.kassa) uy += d.uy;
    } else if (tur === 'xarajat' && !uyYozuvi(h, S) && !b.avans.has(h.id)) boshqa += summasi(h);
  });
  bank = Math.max(0, bank); uy = Math.max(0, uy); boshqa = Math.max(0, boshqa);
  const taJami = Object.values(taminotchilar).reduce((a, v) => a + v, 0);
  // xarajatJami (audit 10.11): seyfdan chiqqan, lekin bankka topshirilgan va uyga olib ketilgan pul xarajat emas — «Kirim − xarajatlar».
  return { oylik, bank, uy, boshqa, taminotchilar, taJami, jami: oylik + bank + uy + boshqa + taJami, xarajatJami: oylik + boshqa + taJami };
}

// Kunlik daftar (26.10, foydalanuvchining qog'oz daftari kabi — "B" ko'rinish): bir kunning kirimi — har smena savdosi
// (filial, smena, kim, naqd, karta; yopilgan vaqt tartibida — tungi smena ertalab birinchi) va savdodan tashqari kirim;
// chiqimi — har biri alohida qator (bankka, ta'minotchi, oylik, uyga, xarajat). Chiqim qoidalari = davrChiqim.
// Jami naqd/karta — faqat tasdiqlangan savdo (hisobda); tasdiq kutayotgan smena ro'yxatda belgi bilan ko'rinadi.
const vaqtSon = (ts) => new Date(ts).getTime();
export function kunDaftari(S, kun) {
  const fil = (id) => ((S.filiallar || []).find((f) => f.id === id) || {}).nom || id;
  const ism = (id) => ((S.xodimlar || []).find((z) => z.id === id) || {}).ism || '';
  const kirim = (S.smenalar || []).filter((m) => m.yopildi && !m.bekor && savdoKuni(m) === kun)
    .sort((a, b) => vaqtSon(a.yopildi) - vaqtSon(b.yopildi))
    .map((m) => ({ id: m.id, filialId: m.filialId, filial: fil(m.filialId), smena: m.nom, xodim: ism(m.xodimId),
      naqd: m.naqd || 0, karta: m.karta || 0, tasdiq: hisobda(m) }));
  const b = boglanish(S);
  const amalda = amaldaF(S.harakatlar || []);
  const chiqim = [], boshqaKirim = [];
  (S.xodimlar || []).forEach((x) => (x.avanslar || []).forEach((a) => {
    if (!a.bekor && a.summa && kunKey(a.ts) === kun) chiqim.push({ tur: 'oylik', nom: 'Oylik: ' + x.ism, summa: a.summa, ts: a.ts });
  }));
  (S.taminotchilar || []).forEach((t) => (t.amallar || []).forEach((a) => {
    const seyfdan = a.manbalar ? (a.manbalar.kassa || 0) : (a.summa || 0);
    if (a.tur === 'tolov' && !a.bekor && seyfdan && kunKey(a.ts) === kun) chiqim.push({ tur: 'taminotchi', nom: t.nom, summa: seyfdan, ts: a.ts });
  }));
  (S.harakatlar || []).forEach((h) => {
    if (!amalda(h) || kunKey(h.ts) !== kun) return;
    const d = h.d || {};
    if (h.tur === 'kochirish' && d.kassa < 0) {
      if (d.bank > 0) chiqim.push({ tur: 'bank', nom: 'Bankka topshirildi', summa: d.bank, ts: h.ts });
      else if (d.uy > 0) chiqim.push({ tur: 'uy', nom: 'Uyga olib ketildi', summa: d.uy, ts: h.ts });
    } else if (h.tur === 'xarajat' && !uyYozuvi(h, S) && !b.avans.has(h.id)) {
      const smenadan = !d.kassa && !d.bank && !d.uy;
      chiqim.push({ tur: 'xarajat', nom: (h.izoh || 'Xarajat') + (smenadan ? ' (smena kassasidan)' : ''), summa: summasi(h), ts: h.ts });
    } else if (h.tur === 'kirim' && !uyYozuvi(h, S)) boshqaKirim.push({ nom: h.izoh || 'Kirim', summa: summasi(h), ts: h.ts });
  });
  chiqim.sort((x, y) => vaqtSon(x.ts) - vaqtSon(y.ts));
  const sum = (r, k) => r.reduce((a, q) => a + q[k], 0);
  const tasdiqli = kirim.filter((q) => q.tasdiq);
  return { kun, kirim, boshqaKirim, chiqim, naqd: sum(tasdiqli, 'naqd'), karta: sum(tasdiqli, 'karta'),
    boshqaKirimJami: sum(boshqaKirim, 'summa'), chiqimJami: sum(chiqim, 'summa') };
}

// Seyf bir kunda (27.10, Bosh "F" ko'rinish: yashil "Bugun kirdi", qizil "Bugun chiqdi"). Faqat seyf harakatlari (d.kassa) —
// shuning uchun boshi + kirdi − chiqdi = oxiri har doim seyf qoldig'iga teng (daftar emas: u savdo va karta bilan ishlaydi).
// Shu kunning o'zida yozilib bekor qilingan/tuzatilgan yozuv (asli va teskarisi) ko'rsatilmaydi; boshqa kunda bekor qilingani —
// bekor qilingan kunda "Bekor qilindi: …" qatori. Smena qutisidan to'langan xarajat seyfga tegmaydi — alohida (smenaXarajat).
const SMENA_KICHIK = { kunduzgi: 'kunduzgi', tungi: 'tungi' };
// Audit 10.11 (qotish): Bosh/Hamyonlar har chizishda kunSeyf ni ikki marta chaqirardi, ichida har yozuvga kunKey (Date +
// toISOString) ikki marta. Endi kun — sonli chegara [Toshkent 00:00, +24 soat), natija esa S bo'yicha eslab qolinadi.
// Sinov rejimida S joyida o'zgaradi — kesh imzosi (ro'yxatlar va uzunliklari, boshlang'ich seyf) o'zgarsa qayta hisoblanadi.
const kunBoshiMs = (kun) => Date.parse(kun + 'T00:00:00+05:00');
const tsSon = (ts) => (typeof ts === 'number' ? ts : new Date(ts).getTime());
const SEYF_KESH = new WeakMap();
const seyfImzo = (S) => {
  const so = S.sozlama || {}, xs = S.xodimlar || [];
  return [S.harakatlar, (S.harakatlar || []).length, S.smenalar, (S.smenalar || []).length, xs, xs.reduce((a, x) => a + (x.avanslar || []).length, 0),
    S.filiallar, S.taminotchilar, (so.boshlangich || {}).kassa, (so.hisobBoshi || {}).kassa];
};
export function kunSeyf(S, kun) {
  const imzo = seyfImzo(S);
  let c = SEYF_KESH.get(S);
  if (!c || c.imzo.length !== imzo.length || c.imzo.some((v, i) => v !== imzo[i])) { c = { imzo, kun: new Map() }; SEYF_KESH.set(S, c); }
  if (!c.kun.has(kun)) c.kun.set(kun, kunSeyfHisob(S, kun));
  return c.kun.get(kun);
}
// Keshsiz hisob (test eski natija bilan solishtiradi).
export function kunSeyfHisob(S, kun) {
  const hs = S.harakatlar || [];
  const dan = kunBoshiMs(kun), gacha = dan + 864e5;
  const fil = (id) => ((S.filiallar || []).find((f) => f.id === id) || {}).nom || id || '';
  const smena = (id) => (S.smenalar || []).find((m) => m.id === id);
  const avansIsm = new Map();
  (S.xodimlar || []).forEach((x) => (x.avanslar || []).forEach((a) => a.harakatId && avansIsm.set(a.harakatId, x.ism)));
  const taNom = (id) => ((S.taminotchilar || []).find((t) => t.id === id) || {}).nom;
  const shu = [];
  let keyin = 0;   // shu kundan keyingi seyf harakatlari (oxiri = hozirgi qoldiq − keyin)
  for (const h of hs) {
    const t = tsSon(h.ts);
    if (t >= dan && t < gacha) shu.push(h);
    else if (t >= gacha) keyin += (h.d && h.d.kassa) || 0;
  }
  const shuId = new Set(shu.map((h) => h.id));
  const juft = new Set();
  shu.forEach((h) => { if (h.tur === 'tuzatish' && h.asl && shuId.has(h.asl)) { juft.add(h.id); juft.add(h.asl); } });
  const nomi = (h, k) => {
    const d = h.d || {};
    if (h.tur === 'qabul' || h.tur === 'filialdanPul') {
      const m = smena(h.smenaId);
      if (!m) return h.filialId ? fil(h.filialId) : (h.izoh || 'Savdo puli');
      return fil(m.filialId) + (SMENA_KICHIK[m.nom] ? ' · ' + SMENA_KICHIK[m.nom] : '');
    }
    if (h.tur === 'kochirish') {
      if (k < 0) return d.bank > 0 ? 'Bankka topshirildi' : d.uy > 0 ? 'Uyga olib ketildi' : (h.izoh || 'Ko\'chirish');
      return d.uy < 0 ? 'Uydan olib kelindi' : d.bank < 0 ? 'Bankdan olindi' : (h.izoh || 'Ko\'chirish');
    }
    if (h.tur === 'xarajat' && avansIsm.has(h.id)) return 'Oylik: ' + avansIsm.get(h.id);
    if (h.tur === 'tolov') return 'Ta\'minotchi: ' + (taNom(h.taminotchiId) || String(h.izoh || '').split(' — ')[0]);
    return h.izoh || (k > 0 ? 'Kirim' : 'Chiqim');
  };
  const turi = (h, k) => {
    if (h.tur === 'tuzatish') return 'bekor';
    if (h.tur === 'kochirish') return 'kochirish';
    if (h.tur === 'xarajat') return avansIsm.has(h.id) ? 'oylik' : 'xarajat';
    if (h.tur === 'tolov') return 'taminotchi';
    if (h.tur === 'qabul' || h.tur === 'filialdanPul') return 'savdo';
    return k > 0 ? 'kirim' : 'chiqim';
  };
  const kirdi = [], chiqdi = [];
  shu.forEach((h) => {
    const k = (h.d && h.d.kassa) || 0;
    if (!k || juft.has(h.id)) return;
    (k > 0 ? kirdi : chiqdi).push({ id: h.id, tur: turi(h, k), nom: nomi(h, k), summa: Math.abs(k), ts: h.ts });
  });
  const amalda = amaldaF(hs);
  const smenaXarajat = shu.filter((h) => amalda(h) && h.tur === 'xarajat' && !uyYozuvi(h, S) && !avansIsm.has(h.id)
    && !(h.d && (h.d.kassa || h.d.bank || h.d.uy))).map((h) => ({ id: h.id, nom: h.izoh || 'Xarajat', summa: summasi(h), ts: h.ts }));
  const tartib = (x, y) => vaqtSon(x.ts) - vaqtSon(y.ts);
  kirdi.sort(tartib); chiqdi.sort(tartib); smenaXarajat.sort(tartib);
  const sum = (r) => r.reduce((a, q) => a + q.summa, 0);
  const oxiri = qoldiq(S, 'kassa') - keyin, kirdiJami = sum(kirdi), chiqdiJami = sum(chiqdi);
  return { kun, boshi: oxiri - kirdiJami + chiqdiJami, oxiri, kirdi, chiqdi, kirdiJami, chiqdiJami, smenaXarajat, smenaXarajatJami: sum(smenaXarajat) };
}

// "Sanash" yozuvi (SQL ilova.sanash bilan bir xil izoh): farq = haqiqiy − hisob. Kam — "Boshqa" xarajat, ortiqcha — kirim; 0 — yozuv yo'q.
export function sanashYozuvi(hamyon, farq, izoh = '') {
  if (!farq) return null;
  const qism = String(izoh || '').trim().replace(/\s+/g, ' ').slice(0, 200);
  return farq < 0
    ? { tur: 'xarajat', izoh: 'Boshqa — sanashda kam chiqdi' + (qism ? ': ' + qism : ''), summa: -farq, d: { [hamyon]: farq } }
    : { tur: 'kirim', izoh: 'Sanashda ortiqcha chiqdi' + (qism ? ': ' + qism : ''), summa: farq, d: { [hamyon]: farq } };
}

// Kechki xulosa (Telegram'ga shu matn boradi).
export function kunXulosa(s, kun, now = Date.now()) {
  const ism = (id) => (s.xodimlar.find((x) => x.id === id) || {}).ism || '?';
  const fil = (id) => (s.filiallar.find((f) => f.id === id) || {}).nom || id;
  const sv = kunSavdo(s.smenalar, kun);
  const ochiq = s.smenalar.filter((m) => !m.yopildi).map((m) => fil(m.filialId) + ' (' + ism(m.xodimId) + ')');
  const kutil = s.smenalar.filter((m) => m.qabul && m.qabul.holat === 'kutilmoqda').map((m) => fil(m.filialId) + ' ' + som(m.qabul.summa));
  const kam = s.smenalar.filter((m) => m.yopildi && !m.qolda && !m.bekor && kunKey(m.yopildi) === kun && farq(m) !== 0).map((m) => ism(m.xodimId) + ' ' + som(farq(m)));
  const tk = s.smenalar.filter(tasdiqKutadi);
  const otgan = s.qarzlar.filter((q) => q.holat === 'ochiq' && muddatiOtgan(q, now));
  const kassa = qoldiq(s, 'kassa');
  const uy = qoldiq(s, 'uy');
  // Uy hamyon sifatida ishlatilgan bo'lsa (boshlang'ich uy, uy xarajati/kirimi) — uy qatorlari. Faqat "uyga olib ketildi"
  // (seyf → uy ko'chirish) bo'lsa — uy qoldig'i ko'rsatilmaydi, bugun olib ketilgani alohida qator. SQL kun_xulosa bilan bir xil.
  const b = (s.sozlama && s.sozlama.boshlangich) || {};
  // Ta'minotchiga uydan to'lov uy hamyonini "ishlatilgan" qilmaydi (pul auditi 28.10, SQL kun_xulosa bilan bir xil).
  const uyBor = !!b.uy || (s.harakatlar || []).some((h) => h.d && h.d.uy && !['kochirish', 'tolov'].includes(turi(h)));
  const uyga = royxat(s).filter((h) => turi(h) === 'kochirish' && kunKey(h.ts) === kun).reduce((a, h) => a + ((h.d && h.d.uy) || 0), 0);
  return [
    'Kechki xulosa · ' + kun.split('-').reverse().join('.'),
    'Savdo: ' + som(sv.jami) + ' (naqd ' + som(sv.naqd) + ', karta ' + som(sv.karta) + ')',
    ...s.filiallar.map((f) => '  ' + f.nom + ': ' + som(((sv.filiallar[f.id] || {}).naqd || 0) + ((sv.filiallar[f.id] || {}).karta || 0))),
    'Tasdiq kutayotgan savdo: ' + (tk.length ? tk.length + ' ta smena, ' + som(tk.reduce((a, m) => a + (m.naqd || 0) + (m.karta || 0), 0)) : 'yo\'q'),
    'Xarajat: ' + som(kunXarajat(s, kun)) + ' · Kirim: ' + som(kunKirim(s, kun)) + ' · Ta\'minotchilarga to\'lov: ' + som(kunTolov(s, kun)),
    ...(uyBor ? ['Hamyonlar: seyf ' + som(kassa) + ', uy ' + som(uy), 'Uy xarajati: ' + som(kunUyXarajat(s, kun))]
      : ['Seyfda: ' + som(kassa), ...(uyga > 0 ? ['Uyga olib ketildi: ' + som(uyga)] : [])]),
    'Ochiq smenalar: ' + (ochiq.length ? ochiq.join(', ') : 'yo\'q'),
    'Qabul qilinmagan pul: ' + (kutil.length ? kutil.join(', ') : 'yo\'q'),
    // 09.11 (audit): xodimlardagi qarz puli (bo'lsa) — SQL kun_xulosa bilan bir xil (birinchi to'lov vaqti tartibida).
    ...(() => {
      const g = new Map();
      xodimdagiPullar(s.qarzlar).forEach((z) => g.set(z.pul.xodimId, (g.get(z.pul.xodimId) || 0) + z.pul.summa));
      return g.size ? ['Xodimlarda qarz puli: ' + [...g].map(([id, n]) => ((s.xodimlar || []).find((x) => x.id === id) || {}).ism + ' ' + som(n)).join(', ')] : [];
    })(),
    'Kassa farqlari: ' + (kam.length ? kam.join(', ') : 'yo\'q'),
    'Muddati o\'tgan qarzlar: ' + otgan.length + ' ta, ' + som(otgan.reduce((a, q) => a + qarzQoldiq(q), 0)),
    'Ruxsat kutayotgan qarzlar: ' + s.qarzlar.filter((q) => q.holat === 'ruxsat').length
  ].join('\n');
}

// ---- Ishdagi filial (SQL xodim_tg bilan bir xil) ----
// 1) Ochiq smenasi bo'lsa — o'sha smenaning filiali va turi (vaqtincha muddati smena ustida tugasa ham smena "yo'qolmaydi").
// 2) Muddati o'tmagan vaqtincha filial bo'lsa — xodim o'sha filialda ishlaydi; filialda smena — kunlik.
export function ishdagi(x, s, now = Date.now()) {
  if (!x || x.rol !== 'sotuvchi') return x;
  const ochiq = ((s && s.smenalar) || []).filter((m) => m.xodimId === x.id && !m.yopildi).sort((a, b) => a.ochildi - b.ochildi)[0];
  if (ochiq) return ochiq.filialId === x.filialId && ochiq.nom === x.smena ? x : { ...x, filialId: ochiq.filialId, asosiyFilialId: x.filialId, smena: ochiq.nom };
  if (!x.vaqtinchaFilial) return x;
  if (x.vaqtinchaGacha && x.vaqtinchaGacha < kunKey(now)) return x;
  const f = (s.filiallar || []).find((z) => z.id === x.vaqtinchaFilial) || {};
  const asosiy = f.asosiy || f.id === ASOSIY_FILIAL;
  return { ...x, filialId: x.vaqtinchaFilial, asosiyFilialId: x.filialId,
    smena: !asosiy ? 'kunlik' : (x.smena === 'kunduzgi' || x.smena === 'tungi' ? x.smena : 'kunduzgi') };
}

// ---- Defektura ----
// Bir xil nomli yozuvlar (har filialdan) bitta qatorga: necha marta, qaysi filiallar, holati (eng ochig'i).
export const defNom = (s) => String(s || '').trim().replace(/\s+/g, ' ');

// Qidiruv kaliti — kalit.mjs da (05.11: Edge funksiyasi ham shu faylni ishlatadi). SQL ilova.qidiruv_kalit bilan aynan bir xil.
export { qidiruvKalit };
// Berilgan dorilar jamida bitta modda bitta qator (03.11; foydalanuvchi: "Metformin soni aniq chiqmayabdi"): DMED rus interfeysida
// «Метформин 500 mg», «Ацетилсалициловая кислота», o'zbekchada «Metformin 500 mg», «Asetilsalitsil kislotasi» deb yozadi. Kalit:
// harfli so'z — qidiruvKalit va qo'shimchasiz o'zak (kengaytma core.js xpnGuruh qoidasi: «-ovaya», «-si», «-a»…, o'zak kamida
// 4 harf), «temir» = «железа»; raqam va birlik o'zgarmaydi (qidiruvKalit «500» ni «50» qilardi). Guruhlash core.js bilan bir xil
// (tests/miniapp-xpn-guruh.test.mjs).
const XPN_QOSH = /^(?:(?:ov|ev)?(?:aia|oi|oe|ogo|omu|om|ie|ia|uiu|iu|a|i|u|e|o)|si|ni|ning|lar|lari|ami|am|ax)$/;
const XPN_SINONIM = { temir: 'jelez' };
function xpnOzak(t) {
  for (let marta = 0; marta < 3; marta++) {
    let k = Math.min(7, t.length - 4);
    while (k > 0 && !XPN_QOSH.test(t.slice(-k))) k--;
    if (k <= 0) break;
    t = t.slice(0, -k);
  }
  return XPN_SINONIM[t] || t;
}
export function xpnGuruh(s) {
  return String(s == null ? '' : s).replace(/\([^)]*\)/g, ' ').replace(/(\d),(\d)/g, '$1.$2').toLowerCase()
    .replace(/\s*[/+]\s*/g, ' / ').split(/[\s,;]+/).filter(Boolean)
    .map((t) => (/\d|^\/$/.test(t) ? t : xpnOzak(qidiruvKalit(t).replace(/\s+/g, '')))).filter(Boolean).join(' ');
}
// Guruhdagi nomlardan ko'rsatiladigani: o'zbekcha (kirill harfisiz) bo'lsa — o'sha, aks holda birinchisi.
export const xpnAfzal = (eski, yangi) => (eski && (/[а-яё]/i.test(yangi) || !/[а-яё]/i.test(eski)) ? eski : yangi);
// So'rovning har bir so'zi nom kalitida bormi (prays_qidir bilan bir xil qoida).
export function qidiruvMos(soz, nom) {
  const w = qidiruvKalit(soz).split(' ').filter(Boolean);
  if (w.join('').length < 2) return false;
  const k = qidiruvKalit(nom);
  return w.every((x) => k.includes(x));
}
const DEF_TARTIB = { yangi: 0, buyurtma: 1, keldi: 2 };
export function defekturaGuruh(list) {
  const g = new Map();
  list.filter((d) => d.holat !== 'bekor').forEach((d) => {
    // 05.11: «Keldi» alohida qator — Oson bir filialga kelganini aytsa, boshqa filialdagi ochiq yozuv «Kerak»da qoladi,
    // kelgani esa «Keldi»da (avval guruh «Kerak» bo'lib, ikkala filial yonma-yon chiqardi).
    const k = defNom(d.nom).toLowerCase() + (d.holat === 'keldi' ? '|keldi' : '');
    const o = g.get(k) || { nom: defNom(d.nom), holat: d.holat, soni: 0, filiallar: [], izohlar: [], ts: d.ts, holatTs: 0, yozuvlar: [], asl: [] };
    o.soni += 1;
    // 09.11: xodim yozgan asl matn (nom to'g'irlangan bo'lsa) — «Xodim yozgani: …».
    if (d.aslNom && defNom(d.aslNom).toLowerCase() !== defNom(d.nom).toLowerCase() && !o.asl.includes(defNom(d.aslNom))) o.asl.push(defNom(d.aslNom));
    if (!o.filiallar.includes(d.filialId)) o.filiallar.push(d.filialId);
    if (d.izoh) o.izohlar.push(d.izoh);
    if (DEF_TARTIB[d.holat] < DEF_TARTIB[o.holat]) o.holat = d.holat;
    o.ts = Math.max(o.ts, d.ts);
    o.holatTs = Math.max(o.holatTs, d.holatTs || 0);
    o.yozuvlar.push(d);
    g.set(k, o);
  });
  return [...g.values()].sort((a, b) => DEF_TARTIB[a.holat] - DEF_TARTIB[b.holat] || b.ts - a.ts);
}

// Yozuvdan keyin manfiyga tushadigan hamyonlar (bank kuzatilmaydi). Ko'pincha boshlang'ich qoldiq kiritilmaganini bildiradi.
// yetmaydi(S, d) — hisobBoshi bilan; eski yetmaydi(harakatlar, boshlangich, d) ham ishlaydi.
export function yetmaydi(a, b, c) {
  const S = Array.isArray(a) ? null : a, d = S ? b : c;
  const q = (k) => (S ? qoldiq(S, k) : hamyonQoldiq(a, k, (b || {})[k] || 0));
  return Object.entries(d || {}).filter(([k, v]) => k !== 'bank' && v < 0 && q(k) + v < 0).map(([k]) => ({ hamyon: k, qoldiq: q(k) }));
}
