// O'zgarishlar jurnali (07.11, server: 20261107230000_audit_jurnal — ilova.audit_royxat). Faqat direktor: kim, qachon, qaysi
// yozuvda nima o'zgardi («Narx: 12 000 so'm → 13 000 so'm»). Kunlar bo'yicha guruh, eng yangisi tepada, 200 tagacha.
// Menyuga ulash — integrator (direktor.mjs qayta chizilmoqda): masalan Bo'limlar → «O'zgarishlar jurnali» → auditView(m, ctx).
// ctx: { oqi(nom, ...args), rerender() } (direktor ctx'idagi kabi).
import * as H from './hisob.mjs';
import { h, kartaSarlavha, kunNomi, pills, vaqt } from './ui.mjs';

const AB = () => ({ j: null, kalit: '', vaqt: 0, yuklanmoqda: null, xato: null, xatoKalit: '', jadval: '', kun: 7, ochiq: {} });
const A = AB();
// Sinov uchun (tests): modul holatini tozalash.
export function auditUnut() { Object.assign(A, AB()); }

// Jadval nomlari (filtr va qator sarlavhasi).
export const JADVAL = {
  xodimlar: 'Xodim', filiallar: 'Filial', sozlama: 'Sozlamalar', smenalar: 'Savdo (smena)', qarzlar: 'Mijoz qarzi',
  qarz_tolovlar: 'Qarz to\'lovi', avanslar: 'Avans (oylik)', taminotchilar: 'Ta\'minotchi', taminot_amallar: 'Ta\'minot yozuvi',
  narx_qaror: 'Narx qarori', partiyalar: 'Partiya', savdo_yoq: 'Savdo bo\'lmadi', davomat: 'Davomat', punktlar: 'Punkt',
  shtrix_kodlar: 'Shtrix-kod', chiqarishlar: 'Hisobdan chiqarish'
};
const FILTR = [['', 'Hammasi'], ['smenalar', 'Savdo'], ['qarzlar', 'Qarzlar'], ['avanslar', 'Oylik'], ['taminot_amallar', 'Ta\'minot'],
  ['xodimlar', 'Xodimlar'], ['davomat', 'Davomat'], ['sozlama', 'Sozlamalar'], ['partiyalar', 'Partiyalar'], ['narx_qaror', 'Narx']];
const DAVR = [[1, 'Bugun'], [7, '7 kun'], [30, '30 kun'], [180, '180 kun']];

// Maydon nomlari (bazadagi ustun → odam o'qiydigan). Yo'g'i — ustun nomi o'zi.
export const MAYDON = {
  ism: 'Ism', nom: 'Nomi', filial_id: 'Filial', rol: 'Lavozim', smena: 'Smena', oylik: 'Oylik', faol: 'Faol', tg_id: 'Telegram',
  telefon: 'Telefon', tel: 'Telefon', daraja: 'Daraja', vaqtincha_filial: 'Vaqtincha filial', vaqtincha_gacha: 'Vaqtincha (gacha)',
  qoshimcha_filial: 'Ikkinchi ish joyi', qoshimcha_smena: 'Ikkinchi joy smenasi', zaxira_olsin: 'Zaxira fayli menga',
  limit_mijoz: 'Mijoz limiti', limit_xodim: 'Xodim limiti', xulosa_vaqti: 'Kechki xulosa vaqti', ertalab_vaqti: 'Ertalabki hisobot',
  boshlangich_kassa: 'Boshlang\'ich seyf', boshlangich_uy: 'Boshlang\'ich uy', apteka_nomi: 'Apteka nomi', oyin_sek: 'O\'yin vaqti',
  naqd: 'Naqd', karta: 'Karta', sanalgan: 'Sanalgan', sanalgan_xodim: 'Xodim sanagani', qoldirildi: 'Kassada qoldi', kimga: 'Kimga',
  qabul_holat: 'Qabul', qabul_summa: 'Qabul summasi', qabul_hamyon: 'Qabul hamyoni', savdo_tasdiq: 'Savdo tasdig\'i',
  ochildi: 'Ochildi', yopildi: 'Yopildi', ochilish_pul: 'Ochilishdagi pul', ochilish_kutilgan: 'Kutilgan pul',
  bekor_vaqt: 'Bekor qilindi', bekor_sabab: 'Bekor sababi', summa: 'Summa', muddat_kun: 'Muddat (kun)', holat: 'Holat', izoh: 'Izoh',
  hamyon: 'Hamyon', oy: 'Oy', narx: 'Narx', bajarildi: 'Bajarildi', boshlangich_qarz: 'Boshlang\'ich qarz', yuridik: 'Yuridik shaxs',
  keldi: 'Keldi', kun: 'Kun', etiroz: 'E\'tiroz', asosiy: 'Asosiy filial', guruh: 'Guruh', kod: 'Shtrix-kod', ochirildi: 'O\'chirildi',
  'malumot.narx': 'Narx', 'malumot.narx_dir': 'Direktor narxi', 'malumot.seriya': 'Seriya', 'malumot.savdoNomi': 'Savdo nomi',
  'malumot.xpn': 'XPN', 'malumot.doza': 'Doza', 'malumot.yaroqlilik': 'Yaroqlilik', 'malumot.ishlabChiqarilgan': 'Ishlab chiqarilgan',
  'malumot.faol': 'Faol', 'malumot.qidiruv': 'Qidiruv so\'zi',
  // 07.11 tun: hisobdan chiqarish / firmaga qaytarish
  soni: 'Soni (quti)', tur: 'Turi', sabab: 'Sababi', firma: 'Firma', bekor_kim: 'Bekor qilgan'
};
// Pul maydonlari — «12 000 so'm» ko'rinishida.
export const PUL = new Set(['oylik', 'limit_mijoz', 'limit_xodim', 'boshlangich_kassa', 'boshlangich_uy', 'naqd', 'karta', 'sanalgan',
  'sanalgan_xodim', 'qoldirildi', 'qabul_summa', 'ochilish_pul', 'ochilish_kutilgan', 'summa', 'narx', 'boshlangich_qarz',
  'malumot.narx', 'malumot.narx_dir']);
// Qo'shilgan yozuvda ko'rsatilmaydigan texnik maydonlar.
const YASHIRIN = new Set(['id', 'yaratildi', 'vaqt', 'kim', 'harakat_id', 'malumot', 'ogoh_vaqt']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_VAQT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

const qisqa = (s, n = 60) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
// Bitta qiymat matni: pul, ha/yo'q, sana-vaqt, uuid (qisqa), matn (60 belgigacha).
export function qiymatMatni(maydon, v) {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'ha' : 'yo\'q';
  if (PUL.has(maydon) && (typeof v === 'number' || (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v)))) return H.som(Number(v));
  if (typeof v === 'string' && ISO_VAQT.test(v)) {
    const t = Date.parse(v);
    if (Number.isFinite(t)) return new Date(t).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', timeZone: 'Asia/Tashkent' }) + ' ' + vaqt(t);
  }
  if (typeof v === 'string' && UUID.test(v)) return v.slice(0, 8) + '…';
  if (typeof v === 'object') return qisqa(JSON.stringify(v));
  return qisqa(String(v));
}
const maydonNomi = (k) => MAYDON[k] || k;

// Bitta jurnal yozuvi → o'zgarish qatorlari: U — «Maydon: eski → yangi»; I — asosiy maydonlar (6 tagacha); D — «o'chirildi».
export function ozgarishlar(q) {
  if (q.amal === 'U') {
    const e = q.eski || {}, y = q.yangi || {};
    return [...new Set([...Object.keys(e), ...Object.keys(y)])].sort((a, b) => (MAYDON[a] ? 0 : 1) - (MAYDON[b] ? 0 : 1))
      .map((k) => maydonNomi(k) + ': ' + qiymatMatni(k, e[k]) + ' → ' + qiymatMatni(k, y[k]));
  }
  const j = (q.amal === 'I' ? q.yangi : q.eski) || {};
  const qatorlar = Object.keys(j).filter((k) => !YASHIRIN.has(k) && j[k] !== null && j[k] !== '' && j[k] !== false
    && !(typeof j[k] === 'string' && UUID.test(j[k])) && MAYDON[k])
    .slice(0, 6).map((k) => maydonNomi(k) + ': ' + qiymatMatni(k, j[k]));
  return q.amal === 'D' ? ['O\'chirildi', ...qatorlar] : qatorlar;
}
const AMAL = { I: 'qo\'shdi', U: 'o\'zgartirdi', D: 'o\'chirdi' };

// Kunlar bo'yicha guruh (Toshkent kuni), tartib — serverdagidek (eng yangisi birinchi).
export function kunlargaBol(qatorlar) {
  const g = new Map();
  for (const q of qatorlar || []) {
    const k = H.kunKey(q.ts);
    if (!g.has(k)) g.set(k, []);
    g.get(k).push(q);
  }
  return [...g.entries()].map(([kun, list]) => ({ kun, list }));
}
const kunSarlavha = (kun) => {
  const bugun = H.kunKey(Date.now());
  if (kun === bugun) return 'Bugun';
  if (kun === H.kunQosh(bugun, -1)) return 'Kecha';
  return kunNomi(new Date(kun + 'T12:00:00+05:00'));
};

function yukla(ctx, chiz, majbur = false) {
  const kalit = A.jadval + '|' + A.kun;
  if (A.yuklanmoqda) return;
  if (!majbur && A.kalit === kalit && A.j && Date.now() - A.vaqt < 60000) return;
  if (!majbur && A.xatoKalit === kalit && Date.now() - A.vaqt < 60000) return;   // xatodan keyin 1 daqiqa kutadi (to'xtovsiz so'rov yo'q)
  A.yuklanmoqda = Promise.resolve().then(() => ctx.oqi('auditRoyxat', A.jadval, A.kun))
    .then((j) => {
      if (!j || !Array.isArray(j.qatorlar)) throw new Error('Server javobi tushunarsiz');
      A.j = j; A.kalit = kalit; A.xato = null; A.xatoKalit = '';
    }, (e) => { A.xato = (e && e.message) || 'Jurnal olinmadi'; A.xatoKalit = kalit; })
    .finally(() => { A.vaqt = Date.now(); A.yuklanmoqda = null; if (A.jadval + '|' + A.kun !== kalit) yukla(ctx, chiz); chiz(); });
}

const asl = (t) => h('span', { 'data-asl': '' }, t);

function qatorEl(q) {
  const sarlavha = (JADVAL[q.jadval] || q.jadval) + (q.nom ? ': ' : '');
  return h('div', { class: 'line audit-q', style: 'display:block' },
    h('div', {}, h('b', {}, asl(q.kim || 'Noma\'lum')), h('span', { class: 'muted' }, ' · ' + vaqt(q.ts) + ' · ' + (AMAL[q.amal] || ''))),
    h('div', {}, sarlavha, q.nom ? asl(q.nom) : null),
    ...ozgarishlar(q).map((t) => h('div', { class: 'muted', style: 'font-size:14px' }, t)));
}

export function auditView(m, ctx) {
  const chiz = () => ctx.rerender();
  yukla(ctx, chiz);
  m.append(h('div', { class: 'muted' }, 'Kim, qachon, nimani o\'zgartirgani: savdo, qarzlar, oylik, ta\'minot, xodimlar, sozlamalar, partiyalar. '
    + '180 kun saqlanadi.'));
  m.append(pills(FILTR, A.jadval, (v) => { A.jadval = v; A.ochiq = {}; yukla(ctx, chiz); chiz(); }, 'Bo\'lim'));
  m.append(pills(DAVR, A.kun, (v) => { A.kun = Number(v); A.ochiq = {}; yukla(ctx, chiz); chiz(); }, 'Davr'));
  const kalit = A.jadval + '|' + A.kun;
  if (!A.j || A.kalit !== kalit) {
    m.append(A.xatoKalit === kalit
      ? h('div', { class: 'card' }, h('div', { class: 'muted' }, A.xato),
        h('button', { class: 's', onclick: () => { A.xatoKalit = ''; yukla(ctx, chiz, true); chiz(); } }, 'Qayta urinish'))
      : h('div', { class: 'card muted', role: 'status' }, 'Yuklanmoqda…'));
    return;
  }
  m.append(h('div', { class: 'line', style: 'border:0;padding:0' },
    h('span', { class: 'muted' }, A.j.qatorlar.length >= 200 ? 'Oxirgi 200 ta o\'zgarish' : A.j.qatorlar.length + ' ta o\'zgarish'),
    h('button', { class: 's', onclick: () => { yukla(ctx, chiz, true); chiz(); } }, A.yuklanmoqda ? 'Yangilanmoqda…' : 'Yangilash')));
  if (A.xatoKalit === kalit) m.append(h('div', { class: 'msg warn', role: 'status' }, 'Yangilanmadi: ' + A.xato + ' — ko\'rinib turgani avvalgi ma\'lumot.'));
  if (!A.j.qatorlar.length) { m.append(h('div', { class: 'card muted' }, 'Bu davrda o\'zgarish yo\'q.')); return; }
  for (const { kun, list } of kunlargaBol(A.j.qatorlar)) {
    const kor = A.ochiq[kun] ? list : list.slice(0, 30);
    const k = h('div', { class: 'card list' }, kartaSarlavha(kunSarlavha(kun) + ' · ' + list.length + ' ta'), ...kor.map(qatorEl));
    if (kor.length < list.length) {
      k.append(h('button', { class: 's', onclick: () => { A.ochiq[kun] = true; chiz(); } }, 'Yana ' + (list.length - kor.length) + ' ta'));
    }
    m.append(k);
  }
}
