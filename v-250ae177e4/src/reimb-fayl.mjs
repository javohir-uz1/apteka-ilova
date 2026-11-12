// Reimbursatsiya puli (13.11): DMED «Рецепты» → «Реимбурсация» → «Скачать Excel» faylini TELEFONDA o'qish. DOM'siz (Node testlarida ham).
// Haqiqiy fayl (13.11, egasining kompyuterida ko'rildi): .xlsx, sarlavha 1-qatorda, ustunlar A..U: «ID рецепта», «Дата выдачи»,
// «ФИО пациента», «Номер телефона пациента», «ПИНФЛ Пациента», «Ответственное лицо», «Номер Телефона Ответственного лица»,
// «ПИНФЛ Ответсвтенного лица», «ФИО Врача», «Организация», «Район (организации)», «Регион (организации)», «ФИО Фармацевта»,
// «Диагнозы по Д-учету», «Название Медикамента», «Активные ингредиенты (на латинице)», «Дозировка», «Производитель», «Кол-во»,
// «Цена по реимбурсации» (1 dona), «Общая стоимость».
// SHAXSIY MA'LUMOT — QAT'IY RUXSAT RO'YXATI: sarlavha AYNAN quyidagi nomlardan biri bo'lgan 9 ta ustun o'qiladi (A, B, O..U), xolos.
// Bemor, mas'ul shaxs, shifokor, farmatsevt, telefon, PINFL va tashxis ustunlari umuman o'qilmaydi — ularning kataklariga murojaat
// qilinmaydi, natijaga, xato matniga, serverga, logga tushmaydi. Xato matnida faqat bizning kanonik ustun nomlarimiz (fayl matni emas).
// Oddiy retsept (ID «MAB…») — Mini App'da yozilmaydi (egasi qarori 13.11): sanab o'tkazib yuboriladi.
import { son as sonTozala } from './firma-prays.mjs';

export const REIMB_MAX = 50000;          // bitta yuklashda qatorlar (server ham shuni tekshiradi)
export const REIMB_TANA_MAX = 5900000;   // JSON hajmi (Edge /reimb_yukla 6 M belgi)
const SARLAVHA_QATOR = 15;

// Sarlavha matni → kichik harf, bitta bo'shliq, ё → е, o'zbekcha tutuq belgilari va Unicode chiziqchalar («Кол‑во», «Кол–во») bir xil.
const norm = (v) => String(v ?? '').replace(/[ \s]+/g, ' ').trim().toLowerCase().replace(/ё/g, 'е').replace(/[ʻʼ‘’`´]/g, '\'')
  .replace(/[\u2010-\u2015\u2212]/g, '-');

// Maydon → kanonik DMED nomi (xato matni uchun) va qabul qilinadigan sarlavhalar (normallashtirilgan, AYNAN teng). O'zbekcha interfeys
// nomlari — faqat shu maydonlarning o'zi (taxminiy; DMED UZ fayli hali ko'rilmagan).
export const REIMB_USTUN = {
  id: ['ID рецепта', ['retsept id', 'retsept id si', 'retsept idsi', 'рецепт id']],
  sana: ['Дата выдачи', ['berilgan sana', 'berilgan sanasi', 'berish sanasi', 'берилган сана']],
  savdo: ['Название Медикамента', ['dori nomi', 'medikament nomi', 'дори номи']],
  mnn: ['Активные ингредиенты (на латинице)', ['faol moddalar (lotin tilida)', 'faol ingredientlar (lotin tilida)', 'faol moddalar (lotincha)']],
  doza: ['Дозировка', ['dozalash', 'dozasi', 'doza', 'дозаси']],
  ishlab: ['Производитель', ['ishlab chiqaruvchi', 'ишлаб чиқарувчи']],
  soni: ['Кол-во', ['количество', 'soni', 'miqdori', 'miqdor', 'сони']],
  narx: ['Цена по реимбурсации', ['reimbursatsiya narxi', 'reimbursatsiya bo\'yicha narx', 'реимбурсация нархи']],
  summa: ['Общая стоимость', ['umumiy narx', 'umumiy narxi', 'umumiy qiymat', 'umumiy qiymati', 'умумий нарх']]
};
const KERAK = ['id', 'sana', 'savdo', 'soni', 'summa'];   // narx bo'lmasa — summa / soni
const SARLAVHA = new Map();
for (const [k, [kan, uz]] of Object.entries(REIMB_USTUN)) for (const s of [kan, ...uz]) SARLAVHA.set(norm(s), k);

// Bitta (sarlavha) qatoridan ruxsat etilgan ustunlar: { id: 0, sana: 1, savdo: 14, ... }. Boshqa kataklar — faqat solishtiriladi
// (60 belgidan uzun yoki matn bo'lmagani umuman ko'rilmaydi), hech qayerga yozilmaydi.
export function reimbUstunlar(qator) {
  const u = {};
  const n = Array.isArray(qator) ? qator.length : 0;
  for (let i = 0; i < n; i++) {
    const c = qator[i];
    if (typeof c !== 'string' || c.length > 60) continue;
    const k = SARLAVHA.get(norm(c));
    if (k && u[k] === undefined) u[k] = i;
  }
  return u;
}
const yetadi = (u) => KERAK.every((k) => u[k] !== undefined);
const ball = (u) => KERAK.filter((k) => u[k] !== undefined).length;

// '69 995.4 сум', '1 000 сум', '69 995,40', 69995.4 → son; bo'lmasa NaN.
export function reimbSon(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : NaN;
  const s = String(v ?? '').replace(/сум|so['ʻ’]?m|сўм|uzs|шт|dona|дона/gi, '').trim();
  if (!s) return NaN;
  return sonTozala(s);
}

// 'DD.MM.YYYY' (vaqt bilan ham), 'YYYY-MM-DD', Excel sana raqami → 'YYYY-MM-DD'; bo'lmasa null.
export function reimbSana(v) {
  let y, m, d;
  if (typeof v === 'number') {
    if (!(v > 20000 && v < 80000)) return null;
    const t = new Date(Date.UTC(1899, 11, 30) + Math.floor(v) * 864e5);
    [y, m, d] = [t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()];
  } else {
    const s = String(v ?? '').trim();
    let r = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})(?:[ T,]+\d{1,2}:\d{2}(?::\d{2})?)?$/.exec(s);
    if (r) [d, m, y] = [Number(r[1]), Number(r[2]), Number(r[3])];
    else if ((r = /^(\d{4})-(\d{2})-(\d{2})(?:[ T].*)?$/.exec(s))) [y, m, d] = [Number(r[1]), Number(r[2]), Number(r[3])];
    else return null;
  }
  const t = new Date(Date.UTC(y, m - 1, d));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== m - 1 || t.getUTCDate() !== d) return null;
  return t.toISOString().slice(0, 10);
}

const toza = (v, n) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
// Retsept ID: 2–4 harf + 4+ raqam (RAB…). 14 raqam — JSHSHIR shakli: hech qachon olinmaydi (server ham rad etadi).
export const REIMB_ID = /^[A-Z]{2,4}\d{4,56}$/i;
const JSHSHIR = /^\d{14}$/;
export const oddiyId = (id) => /^mab/i.test(id);

// «ЭНАМ® Таблетки 10мг блистеры №30(3x10)» → «ЭНАМ»; qadoq → «№30». Ekranda qisqa nom (to'liq nom — Excel'da).
const SHAKL = /\s(таблетк|капсул|раствор|порош|суспенз|капли|спрей|мазь|гель|сироп|аэрозоль|драже|гранул|лиофилизат|концентрат|суппозитор|крем|пластыр|tablet|capsul)/i;
export function qisqaNom(savdo) {
  const s = String(savdo || '').trim();
  const b = /[®™]/.exec(s);
  let q = b ? s.slice(0, b.index) : s;
  if (!b) { const f = SHAKL.exec(q); if (f && f.index > 0) q = q.slice(0, f.index); }
  q = q.replace(/[\s,;-]+$/, '').trim();
  return q || s.slice(0, 40);
}
export const qadoqOl = (savdo) => { const r = /№\s*(\d+)/.exec(String(savdo || '')); return r ? '№' + r[1] : ''; };

// varaqlar (xlsxOqi natijasi) → { qatorlar, soni, dan, gacha, jami, oddiy, otkazildi, jamiQator, birlashdi, takrorVaraq, varaqlar }.
// qatorlar: [{ id, sana, mnn, doza, savdo, ishlab, soni, narx, summa }] — kalit (id, mnn, doza, savdo, sana). Bitta kalit bir necha
// qatorda (ikki partiya; seriya ustuni o'qilmagani uchun qatorlar aynan bir xil ko'rinishi ham mumkin) — HAR DOIM qo'shiladi.
// Takror faqat varaq darajasida: aynan bir xil varaq (masalan nusxa) ikkinchi marta o'qilmaydi (takrorVaraq).
// jamiQator — sanasi ham, dori nomi ham bo'sh qator («Итого»): sanalmaydi, xato ham emas. otkazildi — noto'g'ri ID, sana, soni yoki
// summa (bunday fayl bilan bazadan hech narsa o'chirilmaydi — reimb.mjs). oddiy — oddiy retsept (MAB…), yozilmaydi.
// Kerakli ustunlar topilmasa yoki ID ustuni retsept ID'ga o'xshamasa — Error (faqat kanonik nomlar bilan).
const ID_MIN = 10;   // shundan kam qatorli faylda har bir qatorning ID'si to'g'ri bo'lishi shart; ko'pida — kamida 80%
export function reimbAjrat(varaqlar) {
  const bir = new Map(), izlar = new Set();
  let otkazildi = 0, jamiQator = 0, birlashdi = 0, oddiy = 0, takrorVaraq = 0, eng = null, ishlatildi = 0;
  const qosh = (o, q) => {
    o.soni = Math.round((o.soni + q.soni) * 1000) / 1000;
    o.summa = Math.round((o.summa + q.summa) * 100) / 100;
    o.narx = Math.max(o.narx, q.narx);
    if (!o.ishlab) o.ishlab = q.ishlab;
  };
  for (const v of varaqlar || []) {
    const rows = Array.isArray(v && v.qatorlar) ? v.qatorlar : [];
    let bosh = -1, u = null;
    for (let i = 0; i < Math.min(rows.length, SARLAVHA_QATOR); i++) {
      const s = reimbUstunlar(rows[i]);
      if (!eng || ball(s) > ball(eng)) eng = s;
      if (yetadi(s)) { bosh = i; u = s; break; }
    }
    if (!u) continue;
    const ol = (r, k) => (u[k] === undefined ? '' : r[u[k]]);   // faqat ruxsat etilgan ustun
    const bosh_ = (c) => c === '' || c == null || (typeof c === 'string' && !c.trim());
    // Qator turlari: bo'sh, jami («Итого»: sana ham, dori nomi ham bo'sh) va ma'lumot.
    const malumot = [];
    let vJami = 0;
    for (let i = bosh + 1; i < rows.length; i++) {
      const r = rows[i] || [];
      const id = toza(ol(r, 'id'), 60);
      const sanaX = ol(r, 'sana'), savdoX = ol(r, 'savdo');
      if (!id && [sanaX, savdoX, ol(r, 'soni'), ol(r, 'summa')].every(bosh_)) continue;   // bo'sh qator
      if (bosh_(sanaX) && bosh_(savdoX)) { vJami++; continue; }
      malumot.push([r, id]);
    }
    // ID ustuni tekshiruvi (jami qatorlarsiz): 10+ qatorda kamida 80%, kamida — hammasi retsept ID shaklida.
    const mos = malumot.filter(([, id]) => REIMB_ID.test(id) && !JSHSHIR.test(id)).length;
    if (malumot.length && (malumot.length >= ID_MIN ? mos / malumot.length < 0.8 : mos < malumot.length)) {
      throw new Error('Bu DMED «Реимбурсация» fayliga o\'xshamaydi — «' + REIMB_USTUN.id[0] + '» ustunidagi qiymatlar retsept ID\'ga (RAB…) o\'xshamaydi.');
    }
    const vb = new Map();
    let vOt = 0, vOd = 0, vBir = 0;
    for (const [r, id] of malumot) {
      if (!REIMB_ID.test(id) || JSHSHIR.test(id)) { vOt++; continue; }   // qiymat hech qayerda ko'rsatilmaydi
      if (oddiyId(id)) { vOd++; continue; }
      const savdo = toza(ol(r, 'savdo'), 300), mnn = toza(ol(r, 'mnn'), 300), doza = toza(ol(r, 'doza'), 100), ishlab = toza(ol(r, 'ishlab'), 200);
      const soni = reimbSon(ol(r, 'soni')), summa = reimbSon(ol(r, 'summa')), sana = reimbSana(ol(r, 'sana'));
      if (!savdo || !(soni > 0 && soni < 1e6) || !(summa >= 0 && summa <= 1e11) || !sana) { vOt++; continue; }
      let narx = u.narx !== undefined ? reimbSon(ol(r, 'narx')) : NaN;
      if (!(narx >= 0 && narx <= 1e11)) narx = 0;
      if (!(narx > 0) && summa > 0) narx = summa / soni;   // narx yo'q yoki 0 — summa / soni
      const q = { id, sana, mnn, doza, savdo, ishlab, soni: Math.round(soni * 1000) / 1000, narx: Math.round(narx * 100) / 100, summa: Math.round(summa * 100) / 100 };
      const k = [id, mnn, doza, savdo, sana].join('\u0000');
      const o = vb.get(k);
      if (o) { qosh(o, q); vBir++; } else vb.set(k, q);   // bitta retseptda bitta dori bir necha qatorda — qo'shiladi
    }
    // Aynan bir xil varaq (nusxa) — ikkinchi marta qo'shilmaydi.
    const iz = JSON.stringify([...vb.values()].map((q) => [q.id, q.sana, q.mnn, q.doza, q.savdo, q.ishlab, q.soni, q.narx, q.summa]));
    if (vb.size && izlar.has(iz)) { takrorVaraq++; continue; }
    izlar.add(iz);
    ishlatildi++;
    otkazildi += vOt; oddiy += vOd; birlashdi += vBir; jamiQator += vJami;
    for (const [k, q] of vb) { const o = bir.get(k); if (o) { qosh(o, q); birlashdi++; } else bir.set(k, q); }
  }
  if (!ishlatildi && !takrorVaraq) {
    const top = eng || {};
    const yoq = KERAK.filter((k) => top[k] === undefined).map((k) => '«' + REIMB_USTUN[k][0] + '»');
    throw new Error('Bu DMED «Реимбурсация» fayliga o\'xshamaydi — ustunlar topilmadi: ' + yoq.join(', ') + '.'
      + ' DMED → Рецепты → Реимбурсация → «Скачать Excel» faylini tanlang.');
  }
  const qatorlar = [...bir.values()];
  let dan = null, gacha = null, jami = 0;
  for (const q of qatorlar) {
    if (!dan || q.sana < dan) dan = q.sana;
    if (!gacha || q.sana > gacha) gacha = q.sana;
    jami += q.summa;
  }
  return { qatorlar, soni: qatorlar.length, dan, gacha, jami: Math.round(jami * 100) / 100, oddiy, otkazildi, jamiQator, birlashdi, takrorVaraq, varaqlar: ishlatildi };
}

// Serverga yuboriladigan tana — faqat ruxsat etilgan maydonlar (yana bir bor, ehtiyot uchun).
export const reimbTana = (natija) => ({ qatorlar: natija.qatorlar.map((q) => ({ id: q.id, sana: q.sana, mnn: q.mnn, doza: q.doza, savdo: q.savdo,
  ishlab: q.ishlab, soni: q.soni, narx: q.narx, summa: q.summa })) });
