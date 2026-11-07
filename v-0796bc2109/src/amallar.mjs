// Holatni o'zgartiruvchi amallar. Har biri xatoni Error bilan qaytaradi, muvaffaqiyatda holatni o'zgartiradi.
// Holat bitta obyekt: keyin server (Supabase/VPS) jadvallariga xuddi shu tuzilmada ko'chadi.
import * as H from './hisob.mjs';

let seq = 0;
export const yangiId = (p) => p + '-' + Date.now().toString(36) + '-' + (++seq).toString(36);

const xodim = (s, id) => s.xodimlar.find((x) => x.id === id);
const filial = (s, id) => s.filiallar.find((f) => f.id === id);

function harakat(s, h, kim) {
  const yangi = { id: yangiId('h'), ts: Date.now(), kim, ...h };
  s.harakatlar.push(yangi);
  return yangi;
}

// Direktorga xabar (keyin Telegram bot orqali yuboriladi).
export function xabar(s, matn, tur = 'info') {
  s.xabarlar.push({ id: yangiId('m'), ts: Date.now(), tur, matn, oqildi: false });
}

export const ochiqSmena = (s, filialId) => s.smenalar.find((m) => m.filialId === filialId && !m.yopildi) || null;
export const oxirgiYopilgan = (s, filialId) => s.smenalar.filter((m) => m.filialId === filialId && m.yopildi && !m.qolda).sort((a, b) => b.yopildi - a.yopildi)[0] || null;

const hamyonTekshir = (h) => { if (!H.NAQD_HAMYON.includes(h)) throw new Error('Hamyonni tanlang: Seyf yoki Uy'); };
// Teskari yozuv (tuzatish): asl yozuv bekor deb belgilanadi, hamyonlar qaytadi.
function teskari(s, h, izoh, kim) {
  const d = {};
  Object.entries(h.d || {}).forEach(([k, v]) => { if (v) d[k] = -v; });
  h.bekor = true;
  return harakat(s, { tur: 'tuzatish', izoh, summa: h.summa != null ? -h.summa : undefined, d, asl: h.id, aslTur: h.tur, filialId: h.filialId }, kim);
}
const egasi = (sm, xodimId) => { if (sm.xodimId !== xodimId) throw new Error('Bu smena sizniki emas'); };

// Smenani ochish: oldingi smena qoldirgan pul tasdiqlanadi; farq bo'lsa — direktorga (quti hamyon emas).
export function smenaOchish(s, xodimId, sanalganStr) {
  const x = H.ishdagi(xodim(s, xodimId), s);
  if (!x || x.rol !== 'sotuvchi') throw new Error('Xodim topilmadi');
  return smenaOchishIchki(s, x, sanalganStr);
}
// Joy tanlab ochish (SQL smena_ochish_joy): 'qoshimcha' — direktor belgilagan ikkinchi ish joyida.
export function smenaOchishJoy(s, xodimId, sanalganStr, joy) {
  if (joy !== 'qoshimcha') return smenaOchish(s, xodimId, sanalganStr);
  const z = xodim(s, xodimId);
  if (!z || z.rol !== 'sotuvchi') throw new Error('Xodim topilmadi');
  if (!z.qoshimchaFilial) throw new Error('Ikkinchi ish joyi belgilanmagan — direktordan so\'rang');
  return smenaOchishIchki(s, { ...H.ishdagi(z, s), filialId: z.qoshimchaFilial, smena: z.qoshimchaSmena }, sanalganStr);
}
function smenaOchishIchki(s, x, sanalganStr) {
  const xodimId = x.id;
  if (s.smenalar.some((m) => m.xodimId === xodimId && !m.yopildi && m.filialId !== x.filialId)) throw new Error('Sizda boshqa joyda ochiq smena bor — avval uni yoping');
  const band = ochiqSmena(s, x.filialId);
  if (band) throw new Error('Bu filialda smena ochiq: ' + (xodim(s, band.xodimId) || {}).ism);
  const sanalgan = H.pul(sanalganStr);
  if (sanalgan == null) throw new Error('Kassadagi pulni kiriting');
  const prev = oxirgiYopilgan(s, x.filialId);
  const kutilgan = prev ? prev.qoldirildi : 0;
  const sm = { id: yangiId('s'), filialId: x.filialId, nom: x.smena, xodimId, ochildi: Date.now(), ochilishPul: sanalgan, ochilishKutilgan: kutilgan, xarajatlar: [], olindi: [], yopildi: null };
  s.smenalar.push(sm);
  if (sanalgan !== kutilgan) {
    xabar(s, filial(s, x.filialId).nom + ': ' + x.ism + ' smenani ochdi, kassada ' + H.som(sanalgan) + ' (kutilgan ' + H.som(kutilgan) + ', farq ' + H.som(sanalgan - kutilgan) + ')', 'ogoh');
  }
  return sm;
}

export function xarajatQosh(s, smenaId, summaStr, izoh, xodimId) {
  const sm = s.smenalar.find((m) => m.id === smenaId);
  if (!sm || sm.yopildi) throw new Error('Ochiq smena topilmadi');
  egasi(sm, xodimId);
  const summa = H.pul(summaStr);
  if (!summa || summa <= 0) throw new Error('Summani kiriting');
  if (!String(izoh || '').trim()) throw new Error('Nima uchun ekanini yozing');
  const h = harakat(s, { ...H.xarajatHarakati(sm, summa, String(izoh).trim()), smenaId }, xodimId);
  sm.xarajatlar.push({ summa, izoh: String(izoh).trim(), ts: Date.now(), harakatId: h.id });
}

// Direktor ochiq smena qutisidan pul oladi (masalan, ta'minotchiga berish uchun) — smena kamomadga chiqmaydi.
export function smenadanOlish(s, smenaId, summaStr, hamyon, direktorId) {
  const sm = s.smenalar.find((m) => m.id === smenaId);
  if (!sm || sm.yopildi) throw new Error('Ochiq smena topilmadi');
  hamyonTekshir(hamyon);
  const summa = H.pul(summaStr);
  if (!summa || summa <= 0) throw new Error('Summani kiriting');
  sm.olindi = sm.olindi || [];
  const h = harakat(s, { tur: 'olindi', izoh: 'Smena qutisidan olindi (' + filial(s, sm.filialId).nom + ')', summa, d: { [hamyon]: summa }, smenaId, filialId: sm.filialId }, direktorId);
  sm.olindi.push({ summa, ts: Date.now(), hamyon, kim: direktorId, harakatId: h.id });
  xabar(s, filial(s, sm.filialId).nom + ': direktor qutidan ' + H.som(summa) + ' oldi', 'info');
}

export function smenaYopish(s, smenaId, forma, xodimId) {
  const sm = s.smenalar.find((m) => m.id === smenaId);
  if (!sm || sm.yopildi) throw new Error('Ochiq smena topilmadi');
  egasi(sm, xodimId);
  const t = H.yopishTekshir(forma, sm);
  if (t.xatolar.length) throw new Error(t.xatolar.join('. '));
  Object.assign(sm, t.qiymat, { yopildi: Date.now(), yopdi: xodimId });
  H.yopishHarakatlari(sm).forEach((h) => harakat(s, { ...h, smenaId }, xodimId));
  const f = H.farq(sm), x = xodim(s, sm.xodimId), fil = filial(s, sm.filialId).nom;
  if (f) xabar(s, fil + ': ' + x.ism + ' smenasi — ' + (f < 0 ? 'kamomad ' : 'ortiqcha ') + H.som(Math.abs(f)), 'ogoh');
  const top = H.topshiriladi(sm);
  sm.qabul = top ? { holat: 'kutilmoqda', summa: top } : { holat: 'yoq' };
  if (top) xabar(s, fil + ': ' + x.ism + ' ' + H.som(top) + ' topshirdi — qabul qiling', 'info');
  // Shu kunga savdo direktor tomonidan qo'lda ham kiritilgan bo'lsa — ogohlantirish (server smena_yopish bilan bir xil).
  if (s.smenalar.some((q) => q.qolda && !q.bekor && q.id !== sm.id && q.filialId === sm.filialId && q.nom === sm.nom && H.kunKey(q.yopildi) === H.kunKey(Date.now()))) {
    xabar(s, fil + ': ' + x.ism + ' ' + sm.nom + ' smenasini yopdi, lekin shu kunga savdo qo\'lda ham kiritilgan — savdo ikki marta sanalishi mumkin. Smenalar bo\'limida keraksizini bekor qiling', 'ogoh');
  }
  return sm;
}

// Direktor topshirilgan pulni qabul qiladi: Kassaga (seyf) yoki Uyga. Bir smena — bir marta.
// haqiqiyStr — direktor sanab qabul qilgan summa (bo'sh — topshirilgani). Kam chiqsa — xodim smenasida kamomad.
export function smenaQabul(s, smenaId, hamyon, direktorId, haqiqiyStr) {
  hamyonTekshir(hamyon);
  const sm = s.smenalar.find((m) => m.id === smenaId);
  if (sm && sm.bekor) throw new Error('Bu savdo bekor qilingan — pulini qabul qilib bo\'lmaydi');   // audit 4.2 (server bilan bir xil)
  if (!sm || !sm.qabul || sm.qabul.holat !== 'kutilmoqda') throw new Error('Qabul qilinadigan pul yo\'q');
  const top = sm.qabul.summa;
  const haqiqiy = haqiqiyStr == null || String(haqiqiyStr).trim() === '' ? top : H.pul(haqiqiyStr);
  if (!haqiqiy || haqiqiy <= 0) throw new Error('Qabul qilingan summani kiriting');
  if (haqiqiy > top * 2) throw new Error('Summa juda katta — tekshiring');
  const farq = haqiqiy - top;
  if (farq) {
    if (sm.sanalganXodim == null) sm.sanalganXodim = sm.sanalgan;
    sm.sanalgan += farq;
    xabar(s, filial(s, sm.filialId).nom + ': ' + (xodim(s, sm.xodimId) || {}).ism + ' ' + H.som(top) + ' topshirdi, qabulda ' + H.som(haqiqiy)
      + ' chiqdi — ' + (farq < 0 ? 'kamomad ' : 'ortiqcha ') + H.som(Math.abs(farq)), 'ogoh');
  }
  H.qabulHarakatlari(sm, hamyon, filial(s, sm.filialId).nom).forEach((h) => harakat(s, { ...h, smenaId }, direktorId));
  sm.qabul = { ...sm.qabul, summa: haqiqiy, holat: 'qabul', ts: Date.now(), kim: direktorId, hamyon };
  if (!sm.tasdiq) sm.tasdiq = Date.now();   // pulni qabul qilish = savdoni tasdiqlash
}

// ---- Savdo tasdig'i va direktor kiritadigan savdo (SQL: savdo_tasdiq, savdo_kiritish, savdo_bekor) ----
export function savdoTasdiq(s, smenaId) {
  const sm = s.smenalar.find((m) => m.id === smenaId);
  if (!sm || !sm.yopildi || sm.bekor) throw new Error('Yopilgan smena topilmadi');
  if (sm.tasdiq) throw new Error('Bu savdo allaqachon tasdiqlangan');
  sm.tasdiq = Date.now();
}

// f: { filialId, smena, xodimId (bo'sh — direktor), kun 'YYYY-MM-DD', naqd, karta, hamyon: kassa|uy|yoq }
export function savdoKiritish(s, f, direktorId, now = Date.now()) {
  const fl = filial(s, f.filialId);
  if (!fl) throw new Error('Filialni tanlang');
  const asosiy = fl.asosiy || fl.id === H.ASOSIY_FILIAL;
  const x = [];
  if (!['kunduzgi', 'tungi', 'kunlik'].includes(f.smena) || (!asosiy && f.smena !== 'kunlik')) x.push('Smenani tanlang');
  const bugun = H.kunKey(now);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.kun || '')) x.push('Kunni tanlang');
  else if (f.kun > bugun) x.push('Kelajakdagi kunga savdo yozib bo\'lmaydi');
  else if (f.kun < H.kunKey(now - 400 * 864e5)) x.push('Juda eski sana');
  const naqd = H.pul(f.naqd), karta = H.pul(f.karta);
  if (naqd == null) x.push('Naqd savdoni kiriting (bo\'lmasa — 0)');
  if (karta == null) x.push('Karta savdoni kiriting (bo\'lmasa — 0)');
  if (naqd != null && karta != null && naqd + karta === 0) x.push('Savdo summasini kiriting');
  if (naqd > 0 && !['kassa', 'uy', 'yoq'].includes(f.hamyon)) x.push('Naqd pul qayerda ekanini tanlang');
  const z = f.xodimId ? xodim(s, f.xodimId) : xodim(s, direktorId);
  if (!z || (z.rol === 'sotuvchi' && z.filialId !== f.filialId && z.qoshimchaFilial !== f.filialId)) x.push('Xodim bu filialda ishlamaydi');
  if (x.length) throw new Error(x.join('. '));
  // Bir kun + filial + smena — bitta yozuv. Xodimning ochiq smenasi ham hisobga olinadi (u yopilganda shu kunga yoziladi) — audit 4.4.
  const bir = s.smenalar.filter((m) => m.filialId === f.filialId && m.nom === f.smena && !m.bekor);
  if (bir.some((m) => m.yopildi && H.kunKey(m.yopildi) === f.kun)) {
    throw new Error('Bu kunda ' + fl.nom + ' ' + f.smena + ' savdosi allaqachon yozilgan — Smenalar bo\'limiga qarang');
  }
  const ochiq = bir.find((m) => !m.yopildi && H.kunKey(m.ochildi) <= f.kun);
  if (ochiq) throw new Error(fl.nom + ' ' + f.smena + ' smenasi hozir ochiq (' + ((xodim(s, ochiq.xodimId) || {}).ism || '?') + ') — savdosi smena yopilganda yoziladi');
  const ts = f.kun === bugun ? now : new Date(f.kun + 'T12:00:00').getTime();
  const pulda = naqd > 0 && (f.hamyon === 'kassa' || f.hamyon === 'uy');
  const sm = { id: yangiId('s'), filialId: f.filialId, nom: f.smena, xodimId: z.id, ochildi: ts, ochilishPul: 0, ochilishKutilgan: 0,
    yopildi: ts, yopdi: direktorId, naqd, karta, sanalgan: naqd, qoldirildi: 0, kimga: 'direktor', xarajatlar: [], olindi: [],
    qolda: true, tasdiq: now, qabul: pulda ? { holat: 'qabul', summa: naqd, ts: now, kim: direktorId, hamyon: f.hamyon } : { holat: 'yoq' } };
  s.smenalar.push(sm);
  if (pulda) harakat(s, { tur: asosiy ? 'qabul' : 'filialdanPul', izoh: 'Savdo puli (' + fl.nom + ', direktor kiritdi)', summa: naqd, d: { [f.hamyon]: naqd }, filialId: fl.id, smenaId: sm.id, ts }, direktorId);
  if (karta > 0 && f.hamyon !== 'yoq') harakat(s, { tur: 'pos', izoh: 'POS (karta savdo)', summa: karta, d: { bank: karta }, filialId: fl.id, smenaId: sm.id, ts }, direktorId);
  return sm.id;
}

export function savdoBekor(s, smenaId, sabab, direktorId) {
  const sm = s.smenalar.find((m) => m.id === smenaId);
  if (!sm || !sm.yopildi || sm.bekor) throw new Error('Bekor qilinadigan savdo topilmadi');
  if (!String(sabab || '').trim()) throw new Error('Sababini yozing');
  // 28.10 (server bilan bir xil): xodim yopgan smena ham bekor qilinadi; faqat savdo pullari qaytadi, xarajat yozuvi qoladi.
  if (!sm.qolda && H.olinganJami(sm) > 0) throw new Error('Bu smenadan kassadan pul olingan — bekor qilib bo\'lmaydi. Summani «Savdoni tuzatish» bilan to\'g\'rilang');
  // Pul auditi 28.10 (server bilan bir xil): kassasi naqd savdoga teng bo'lmagan xodim smenasi bekor qilinmaydi.
  if (!sm.qolda && ((sm.ochilishPul || 0) || (sm.qoldirildi || 0) || H.xarajatJami(sm) > 0 || (sm.qabul && sm.qabul.holat === 'qabul' && sm.qabul.summa !== sm.naqd))) {
    throw new Error('Bu smenada boshlang\'ich pul, kassada qoldirilgan pul, xarajat yoki naqddan boshqa summa qabul qilingan — bekor qilib qayta kiritilsa seyf noto\'g\'ri bo\'ladi. «Savdoni tuzatish»dan foydalaning');
  }
  s.harakatlar.filter((h) => h.smenaId === sm.id && ['pos', 'qabul', 'filialdanPul'].includes(h.tur) && !h.bekor).forEach((h) => {
    Object.assign(teskari(s, h, 'Bekor qilindi: ' + h.izoh + ' — ' + String(sabab).trim(), direktorId), { smenaId: sm.id, ts: h.ts });   // asl kuniga (28.10)
  });
  sm.bekor = true;
  sm.bekorSabab = String(sabab).trim();
  if (sm.qabul) sm.qabul = { holat: 'yoq' };   // bekor savdoni qayta "qabul qilib" bo'lmasin (audit 4.2)
}

// Yopilgan smena savdosini tuzatish (SQL savdo_tuzatish): faqat direktor; bekor qilinmagan smena.
// Karta — POS yozuvi teskari + yangi; naqd — direktor kiritgan savdoda seyf/uy yozuvi teskari + yangi, xodim smenasida faqat hisob
// (kamomad qayta hisoblanadi). Kim, qachon, nima uchun — smenada; sherikka xabar.
export function savdoTuzatish(s, smenaId, naqdStr, kartaStr, sabab, kim) {
  const dir = xodim(s, kim);
  if (!dir || dir.rol !== 'direktor') throw new Error('Bu amal uchun ruxsat yo\'q');
  const sm = s.smenalar.find((m) => m.id === smenaId);
  if (!sm || !sm.yopildi) throw new Error('Yopilgan smena topilmadi');
  if (sm.bekor) throw new Error('Bu savdo bekor qilingan — tuzatib bo\'lmaydi');
  const naqd = H.pul(naqdStr), karta = H.pul(kartaStr), sb = String(sabab || '').trim().replace(/\s+/g, ' ').slice(0, 300);
  const x = [];
  if (naqd == null) x.push('Naqd savdoni kiriting (bo\'lmasa — 0)');
  if (karta == null) x.push('Karta savdoni kiriting (bo\'lmasa — 0)');
  if (sb.length < 2) x.push('Sababini yozing');
  if (x.length) throw new Error(x.join('. '));
  const eski = { naqd: sm.naqd || 0, karta: sm.karta || 0 };
  if (eski.naqd === naqd && eski.karta === karta) throw new Error('Summalar o\'zgarmagan');
  if (sm.qolda && naqd + karta === 0) throw new Error('Savdo 0 bo\'lsa — "Bekor qilish" ni ishlating');
  const fl = filial(s, sm.filialId) || { nom: sm.filialId };
  const izoh = (h) => 'Savdo tuzatildi: ' + h.izoh + ' — ' + sb;
  const shu = (turlar) => s.harakatlar.filter((h) => h.smenaId === sm.id && turlar.includes(h.tur) && !h.bekor);
  // Daftar shu smena puliga ergashadimi: xodim smenasi — ha; qo'lda kiritilgan — "hisobda bor" (hamyonsiz) bo'lmasa.
  const kuzatadi = !sm.qolda || s.harakatlar.some((h) => h.smenaId === sm.id && h.tur !== 'tuzatish');
  if (naqd !== eski.naqd && sm.qolda && !(sm.qabul && ['qabul', 'kutilmoqda'].includes(sm.qabul.holat)) && kuzatadi && naqd > 0) {
    throw new Error('Bu savdoda naqd pul qaysi hamyonga tushgani noma\'lum — savdoni bekor qilib, qaytadan kiriting');
  }
  if (karta !== eski.karta && kuzatadi) {
    // Tuzatish asl savdo kuniga yoziladi (28.10, server savdo_tuzatish bilan bir xil).
    shu(['pos']).forEach((h) => { Object.assign(teskari(s, h, izoh(h), kim), { smenaId: sm.id, ts: h.ts }); });
    if (karta > 0) harakat(s, { tur: 'pos', izoh: 'POS (karta savdo, tuzatildi)', summa: karta, d: { bank: karta }, filialId: sm.filialId, smenaId: sm.id, ts: sm.yopildi }, kim);
  }
  if (naqd !== eski.naqd && sm.qolda && sm.qabul) {
    if (sm.qabul.holat === 'qabul') {
      const qb = shu(['qabul', 'filialdanPul']).at(-1);
      if (qb) Object.assign(teskari(s, qb, izoh(qb), kim), { smenaId: sm.id, ts: qb.ts });
      if (naqd > 0) {
        const tur = qb ? qb.tur : (fl.asosiy || fl.id === H.ASOSIY_FILIAL ? 'qabul' : 'filialdanPul');
        harakat(s, { tur, izoh: 'Savdo puli (' + fl.nom + ', tuzatildi)', summa: naqd, d: { [sm.qabul.hamyon]: naqd }, filialId: sm.filialId, smenaId: sm.id, ts: qb ? qb.ts : sm.yopildi }, kim);
        sm.qabul = { ...sm.qabul, summa: naqd, ts: Date.now(), kim };
      } else sm.qabul = { holat: 'yoq' };
    } else if (sm.qabul.holat === 'kutilmoqda') sm.qabul = naqd > 0 ? { holat: 'kutilmoqda', summa: naqd } : { holat: 'yoq' };
  }
  sm.naqd = naqd; sm.karta = karta;
  if (sm.qolda) sm.sanalgan = naqd;
  // Holatdagi ko'rinish (server smena_json → tuzatishlar) bilan bir xil.
  sm.tuzatishlar = [...(sm.tuzatishlar || []), { ts: Date.now(), kim, eskiNaqd: eski.naqd, eskiKarta: eski.karta, naqd, karta, sabab: sb }];
  xabar(s, fl.nom + ': ' + ((xodim(s, sm.xodimId) || {}).ism || '?') + ' ' + sm.nom + ' smenasi (' + new Date(sm.yopildi).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
    + ') savdosi tuzatildi — naqd ' + H.som(eski.naqd) + ' → ' + H.som(naqd) + ', karta ' + H.som(eski.karta) + ' → ' + H.som(karta) + '. Sabab: ' + sb + ' (' + dir.ism + ')', 'ogoh');
  return sm.id;
}

// Qarz yozish. Limitdan oshsa — direktor ruxsatini kutadi (holat 'ruxsat'). Limitda ruxsat kutayotganlar ham hisoblanadi.
export function qarzYozish(s, xodimId, forma, now = Date.now()) {
  const x = H.ishdagi(xodim(s, xodimId), s);
  if (!x || x.rol !== 'sotuvchi') throw new Error('Xodim topilmadi');
  const t = H.qarzTekshir(forma, s.qarzlar.filter((q) => q.holat === 'ochiq' || q.holat === 'ruxsat'), xodimId, s.sozlama, now);
  if (t.xatolar.length) throw new Error(t.xatolar.join('. '));
  const q = { id: yangiId('q'), ...t.qiymat, berildi: now, xodimId, filialId: x.filialId, tolovlar: [], holat: t.limit ? 'ruxsat' : 'ochiq', izoh: t.limit || '' };
  s.qarzlar.push(q);
  if (t.limit) xabar(s, x.ism + ' qarz yozmoqchi: ' + q.ism + ', ' + H.som(q.summa) + ' — ' + t.limit, 'sorov');
  t.ogohlantirish.forEach((o) => xabar(s, x.ism + ' → ' + q.ism + ': ' + o, 'ogoh'));
  return { qarz: q, limit: t.limit, ogohlantirish: t.ogohlantirish };
}

// Ruxsat berilsa — muddat ruxsat kunidan boshlanadi. Rad etilsa — xodim ro'yxatida "rad etildi" bo'lib qoladi.
export function qarzRuxsat(s, qarzId, ruxsat, now = Date.now()) {
  const q = s.qarzlar.find((z) => z.id === qarzId);
  if (!q || q.holat !== 'ruxsat') throw new Error('Ruxsat kutayotgan qarz topilmadi');
  q.holat = ruxsat ? 'ochiq' : 'rad';
  q.hal = now;
  if (ruxsat) q.berildi = now;
}

// Faqat direktor yopadi; qisman bo'lishi mumkin; pul Kassa yoki Uyga — kirim.
export function qarzUndirish(s, qarzId, summaStr, hamyon, direktorId) {
  hamyonTekshir(hamyon);
  const q = s.qarzlar.find((z) => z.id === qarzId);
  if (!q || q.holat !== 'ochiq') throw new Error('Ochiq qarz topilmadi');
  const t = H.undirishTekshir(q, summaStr);
  if (t.xato) throw new Error(t.xato);
  const h = harakat(s, { tur: 'kirim', izoh: 'Qarz qaytdi: ' + q.ism, summa: t.summa, d: { [hamyon]: t.summa }, qarzId }, direktorId);
  q.tolovlar.push({ summa: t.summa, ts: Date.now(), hamyon, harakatId: h.id });
  if (t.toliq) { q.holat = 'undirildi'; q.hal = Date.now(); }
}

export function avansBerish(s, xodimId, summaStr, hamyon, direktorId, oy) {
  hamyonTekshir(hamyon);
  const x = xodim(s, xodimId);
  const summa = H.pul(summaStr);
  if (!x || !summa || summa <= 0) throw new Error('Summani kiriting');
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(oy || '')) throw new Error('Oy noto\'g\'ri');
  const qoldi = H.oyOxiri(x, oy);
  if (summa > qoldi) throw new Error('Avans oylik qoldig\'idan (' + H.som(qoldi) + ') oshmasin');
  x.avanslar = x.avanslar || [];
  const h = harakat(s, { tur: 'xarajat', izoh: 'Avans: ' + x.ism, summa, d: { [hamyon]: -summa } }, direktorId);
  x.avanslar.push({ summa, ts: Date.now(), oy, hamyon, harakatId: h.id });
}

// Xato yozuvni bekor qilish: o'chirilmaydi, teskari yozuv qo'shiladi (tarix saqlanadi). Server (yozuv_bekor) bilan bir xil:
// smena qabuli bekor bo'lsa — pul yana "qabul kutilmoqda"; qaytgan qarz — qarz yana ochiq; ta'minotchiga to'lov — amal ham bekor;
// smena xarajati yoki direktor qutidan olgani — smena hisobidan chiqadi; avans — oylik qoldig'iga qaytadi. Karta savdo (POS) — yo'q.
export function yozuvBekor(s, harakatId, sabab, kim) {
  const h = s.harakatlar.find((x) => x.id === harakatId);
  if (!h || h.bekor || h.tur === 'tuzatish') throw new Error('Bekor qilinadigan yozuv topilmadi');
  if (h.tur === 'pos') throw new Error('Karta savdosi smena bilan birga yoziladi — uni alohida bekor qilib bo\'lmaydi');
  const sb = String(sabab || '').trim();
  if (!sb) throw new Error('Sababini yozing');
  teskari(s, h, 'Bekor qilindi: ' + (h.izoh || '') + ' — ' + sb, kim);
  s.xodimlar.forEach((x) => (x.avanslar || []).forEach((a) => { if (a.harakatId === h.id) a.bekor = true; }));
  const sm = h.smenaId ? s.smenalar.find((m) => m.id === h.smenaId) : null;
  if (sm && !sm.bekor && (h.tur === 'qabul' || h.tur === 'filialdanPul') && sm.qabul && sm.qabul.holat === 'qabul') sm.qabul = { holat: 'kutilmoqda', summa: sm.qabul.summa };
  if (sm && (h.tur === 'xarajat' || h.tur === 'olindi')) {
    sm.xarajatlar = (sm.xarajatlar || []).filter((z) => z.harakatId !== h.id);
    sm.olindi = (sm.olindi || []).filter((z) => z.harakatId !== h.id);
  }
  const q = h.qarzId ? s.qarzlar.find((z) => z.id === h.qarzId) : null;
  if (q) {
    q.tolovlar = (q.tolovlar || []).filter((t) => t.harakatId !== h.id);
    if (q.holat === 'undirildi') { q.holat = 'ochiq'; delete q.hal; }
  }
  const t = h.taminotchiId ? s.taminotchilar.find((z) => z.id === h.taminotchiId) : null;
  const a = t && t.amallar.find((z) => z.harakatId === h.id);
  if (a) { a.bekor = true; a.bekorSabab = sb; }
}

// Boshlang'ich qoldiqlar (tizim ishga tushgan kun): faqat Seyf va Uy — bank kerak emas. Bo'sh maydon — xato (0 emas).
// Daftarda yozuv bo'lsa — butun balans siljiydi: eski → yangi tarixga yoziladi va direktorlarga ogohlantirish (audit 4.3, SQL bilan bir xil).
export function boshlangichSaqla(s, f, kim) {
  const k = H.pul(f.kassa), u = H.pul(f.uy);
  if (k == null) throw new Error(String(f.kassa == null ? '' : f.kassa).trim() ? 'Seyfdagi summa noto\'g\'ri' : 'Seyfdagi pulni yozing (bo\'lmasa — 0)');
  if (u == null) throw new Error(String(f.uy == null ? '' : f.uy).trim() ? 'Uydagi summa noto\'g\'ri' : 'Uydagi pulni yozing (bo\'lmasa — 0)');
  const eski = { kassa: 0, uy: 0, ...s.sozlama.boshlangich };
  if (eski.kassa === k && eski.uy === u) return;
  s.sozlama.boshlangich = { kassa: k, uy: u };
  if (!s.harakatlar.length) return;   // birinchi marta — jim
  s.boshlangichTarix = [...(s.boshlangichTarix || []), { ts: Date.now(), kim, eski: { kassa: eski.kassa, uy: eski.uy }, yangi: { kassa: k, uy: u } }];
  xabar(s, ((xodim(s, kim) || {}).ism || 'Direktor') + ' boshlang\'ich pulni o\'zgartirdi: seyf ' + H.som(eski.kassa) + ' → ' + H.som(k)
    + ', uy ' + H.som(eski.uy) + ' → ' + H.som(u) + '. Daftarda yozuvlar bor — hamyon qoldiqlari ham shuncha o\'zgardi', 'ogoh');
}

// Sanash (SQL sanash): haqiqiy pul − hisob = farq; farq bo'lsa — daftarga tuzatish yozuvi (kam — "Boshqa" xarajat, ko'p — kirim).
// Farq shu paytdagi holatdan hisoblanadi (telefondagi eski ko'rinishdan emas). Qaytaradi: farq (0 — yozuv yo'q).
export function sanash(s, hamyon, haqiqiyStr, izoh, kim) {
  hamyonTekshir(hamyon);
  const haqiqiy = H.pul(haqiqiyStr);
  if (haqiqiy == null) throw new Error('Sanab chiqqan summani yozing');
  const fq = haqiqiy - H.qoldiq(s, hamyon);
  const y = H.sanashYozuvi(hamyon, fq, izoh);   // SQL bilan bir xil izoh
  if (y) harakat(s, y, kim);
  return fq;
}

// ---- Kunlik daftar: xarajat, kirim (savdodan tashqari), pul ko'chirish ----
const HAMYON = { kassa: 'Seyf', uy: 'Uy', bank: 'Bank' };

export function yozuv(s, f, kim) {
  const summa = H.pul(f.summa);
  if (!summa || summa <= 0) throw new Error('Summani kiriting');
  if (f.tur === 'xarajat' || f.tur === 'kirim') {
    hamyonTekshir(f.hamyon);
    if (!String(f.izoh || '').trim()) throw new Error(f.tur === 'xarajat' ? 'Nima uchun ekanini yozing' : 'Qayerdan kelganini yozing');
    harakat(s, { tur: f.tur, izoh: String(f.izoh).trim(), summa, d: { [f.hamyon]: f.tur === 'xarajat' ? -summa : summa } }, kim);
    return;
  }
  if (f.tur === 'kochirish') {
    if (!H.KOCHIRISH.some(([x, y]) => x === f.dan && y === f.ga)) throw new Error('Bu yo\'nalishda ko\'chirish mumkin emas (Seyf ↔ Uy, Seyf/Uy → Bank)');
    const lbl = f.dan === 'kassa' && f.ga === 'uy' ? 'Direktor oldi' : HAMYON[f.dan] + ' → ' + HAMYON[f.ga];
    harakat(s, { tur: 'kochirish', izoh: lbl + (String(f.izoh || '').trim() ? ' · ' + String(f.izoh).trim() : ''), summa, d: { [f.dan]: -summa, [f.ga]: summa } }, kim);
    return;
  }
  throw new Error('Yozuv turini tanlang');
}

// ---- Ta'minotchilar ----
export function taminotchiQosh(s, f) {
  const nom = String(f.nom || '').trim();
  if (nom.length < 2) throw new Error('Ta\'minotchi nomini kiriting');
  if (s.taminotchilar.some((t) => t.nom.toLowerCase() === nom.toLowerCase())) throw new Error('Bunday ta\'minotchi bor');
  const boshlangich = String(f.boshlangichQarz || '').trim() ? H.pul(f.boshlangichQarz) : 0;
  if (boshlangich == null) throw new Error('Boshlang\'ich qarz noto\'g\'ri');
  const t = { id: yangiId('t'), nom, yuridik: !!f.yuridik, boshlangichQarz: boshlangich, ulangan: false, amallar: [] };
  s.taminotchilar.push(t);
  return t;
}

const tamin = (s, id) => { const t = s.taminotchilar.find((x) => x.id === id); if (!t) throw new Error('Ta\'minotchi topilmadi'); return t; };

// Dori ro'yxati berilsa — summa qatorlar yig'indisi (soni × dona narxi); ro'yxatsiz — faqat jami summa.
export function xarid(s, tId, summaStr, izoh, kim, rows = [], sana = null) {
  const t = tamin(s, tId);
  const kun = taSana(sana);
  const r = H.xaridQatorlar(rows);
  if (r.xato) throw new Error(r.xato);
  const summa = r.qatorlar.length ? r.jami : H.pul(summaStr);
  if (!summa || summa <= 0) throw new Error('Xarid summasini kiriting');
  summaChegara(summa);
  // Ta'minotchi ulanmagan — darhol "ok", lekin avto (u tasdiqlamagan; SQL taminot_amal_yangi).
  const a = { id: yangiId('a'), tur: 'xarid', summa, izoh: String(izoh || '').trim() || 'Dori xaridi', ts: Date.now(), kim, holat: t.ulangan ? 'kutish' : 'ok' };
  if (!t.ulangan) a.avto = true;
  a.sana = kun || H.kunKey(a.ts);
  if (r.qatorlar.length) a.qatorlar = r.qatorlar.map((q) => ({ ...q, summa: q.soni * q.narx }));
  t.amallar.push(a);
  taDoriEsla(t, a);
}
// «Qachon olib keldi» (SQL ilova.taminot_sana): bo'sh — bugun; oxirgi 90 kun, kelajak emas.
function taSana(sana) {
  const v = String(sana || '').trim();
  if (!v) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || H.kunKey(Date.parse(v + 'T12:00:00+05:00')) !== v) throw new Error('Sana noto\'g\'ri — kalendardan tanlang');
  const bugun = H.kunKey(Date.now());
  if (v > bugun) throw new Error('Sana kelajakda bo\'lmasin');
  if (v < H.kunQosh(bugun, -90)) throw new Error('Sana 90 kundan eski — boshlang\'ich qarzga qo\'shing yoki direktorga ayting');
  return v;
}
// Xariddagi dorilar — ta'minotchi ro'yxatiga (SQL trigger taminot_dori_eslab).
function taDoriEsla(t, a) {
  t.dorilar = t.dorilar || [];
  for (const q of a.qatorlar || []) {
    const k = H.qidiruvKalit(q.dori);
    const d = t.dorilar.find((x) => H.qidiruvKalit(x.nom) === k);
    if (d) { d.narx = q.narx; d.n = (d.n || 0) + 1; } else t.dorilar.push({ nom: q.dori, narx: q.narx, n: 1 });
  }
}
// Direktor: ro'yxatga qo'shish / olib tashlash (SQL ilova.taminot_dori).
export function taminotDori(s, tId, nom, bor) {
  const t = tamin(s, tId);
  const v = String(nom || '').trim().replace(/\s+/g, ' ');
  if (v.length < 2) throw new Error('Dori nomini yozing');
  t.dorilar = t.dorilar || [];
  const k = H.qidiruvKalit(v), i = t.dorilar.findIndex((x) => H.qidiruvKalit(x.nom) === k);
  if (bor && i < 0) t.dorilar.push({ nom: v, n: 0 });
  if (bor && i >= 0) t.dorilar[i].nom = v;   // server ham: nomi yangilanadi
  if (!bor && i >= 0) t.dorilar.splice(i, 1);
  return i >= 0 || bor ? 1 : 0;
}
// Bitta yozuv 100 mlrd so'mdan oshmaydi (SQL taminot_amal_yangi).
const summaChegara = (v) => { if (v > 100000000000) throw new Error('Summa juda katta — 100 mlrd so\'mdan oshmasin'); };

// To'lov bir nechta hamyondan; ta'minotchi qarzi jami summaga kamayadi. Ta'minotchi hamyonlarni ko'rmaydi.
export function tolov(s, tId, manbalar, izoh, kim) {
  const t = tamin(s, tId);
  const r = H.tolovTekshir(manbalar);
  if (r.xato) throw new Error(r.xato);
  const parts = Object.entries(r.manbalar).map(([k, v]) => HAMYON[k].toLowerCase() + 'dan ' + H.som(v));
  const d = {};
  Object.entries(r.manbalar).forEach(([k, v]) => { d[k] = -v; });
  const h = harakat(s, { tur: 'tolov', izoh: t.nom + ' — to\'lov' + (String(izoh || '').trim() ? ' · ' + String(izoh).trim() : '') + ' (' + parts.join(' + ') + ')', summa: r.jami, d, taminotchiId: t.id }, kim);
  t.amallar.push({ id: yangiId('a'), tur: 'tolov', summa: r.jami, izoh: String(izoh || '').trim() || 'To\'lov', ts: Date.now(), kim, holat: t.ulangan ? 'kutish' : 'ok', manbalar: r.manbalar, harakatId: h.id, ...(t.ulangan ? {} : { avto: true }) });
}

// Ta'minotchi tarixidan bekor qilish: to'lov — daftardagi yozuvi bilan (hamyonlar qaytadi), xarid — o'zi.
export function amalBekor(s, tId, amalId, sabab, kim) {
  const t = tamin(s, tId), a = t.amallar.find((z) => z.id === amalId);
  if (!a || a.bekor) throw new Error('Bekor qilinadigan yozuv topilmadi');
  if (!String(sabab || '').trim()) throw new Error('Sababini yozing');
  // To'lov — daftardagi yozuvi orqali (server amal_bekor → yozuv_bekor), xarid (pulsiz) — o'zi.
  const h = a.harakatId ? s.harakatlar.find((z) => z.id === a.harakatId && !z.bekor) : null;
  if (h) yozuvBekor(s, h.id, sabab, kim);
  a.bekor = true;
  a.bekorSabab = String(sabab).trim();
}

// Ta'minotchi o'zi yozgan amalni direktor tasdiqlaydi.
export function amalTasdiq(s, tId, amalId) {
  const a = tamin(s, tId).amallar.find((x) => x.id === amalId);
  if (!a || a.holat !== 'ular' || a.bekor) throw new Error('Tasdiqlanadigan yozuv topilmadi');
  a.holat = 'ok';
}

export function sozlamaSaqla(s, f) {
  const m = H.pul(f.limitMijoz), x = H.pul(f.limitXodim);
  if (!m || !x) throw new Error('Limitlarni kiriting');
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(f.xulosaVaqti || '')) throw new Error('Xulosa vaqti HH:MM bo\'lsin (masalan 21:00)');
  if (f.xulosaVaqti > '23:55') throw new Error('Xulosa vaqti 23:55 dan kech bo\'lmasin');
  Object.assign(s.sozlama, { limitMijoz: m, limitXodim: x, xulosaVaqti: f.xulosaVaqti });
}

// ---- Filiallar (nomini direktor o'zi beradi; ichki id o'zgarmaydi) ----
function filialNomTekshir(s, nom, id) {
  const n = String(nom || '').trim();
  if (n.length < 2 || n.length > 40) throw new Error('Filial nomini yozing (2–40 harf)');
  if (s.filiallar.some((f) => f.id !== id && f.nom === n)) throw new Error('Bunday nomli filial bor');
  return n;
}

export function filialNomla(s, id, nom) {
  const f = filial(s, id);
  if (!f) throw new Error('Filial topilmadi');
  f.nom = filialNomTekshir(s, nom, id);
}

export function filialQosh(s, nom) {
  const n = filialNomTekshir(s, nom, null);
  const k = Math.max(1, ...s.filiallar.map((f) => Number((/^f(\d+)$/.exec(f.id) || [])[1]) || 0)) + 1;
  s.filiallar.push({ id: 'f' + k, nom: n });
  return 'f' + k;
}

// ---- Xodimlar ----
export function xodimQosh(s, f) {
  const ism = String(f.ism || '').trim();
  if (ism.length < 2) throw new Error('Ismni kiriting');
  if (!filial(s, f.filialId)) throw new Error('Filialni tanlang');
  if (!['direktor', 'sotuvchi'].includes(f.rol)) throw new Error('Rolni tanlang');
  if (f.rol === 'sotuvchi' && !['kunduzgi', 'tungi', 'kunlik'].includes(f.smena)) throw new Error('Smenani tanlang');
  const oylik = String(f.oylik || '').trim() ? H.pul(f.oylik) : 0;
  if (oylik == null) throw new Error('Oylik noto\'g\'ri');
  const x = { id: yangiId('x'), ism, filialId: f.filialId, rol: f.rol, smena: f.rol === 'sotuvchi' ? f.smena : null, oylik, avanslar: [] };
  s.xodimlar.push(x);
  return x.id;
}

export function xodimFaol(s, xodimId, faol, direktorId) {
  const x = xodim(s, xodimId);
  if (!x) throw new Error('Xodim topilmadi');
  if (xodimId === direktorId && !faol) throw new Error('O\'zingizni o\'chira olmaysiz');
  if (!faol && s.smenalar.some((m) => m.xodimId === xodimId && !m.yopildi)) throw new Error(x.ism + 'ning smenasi ochiq — avval u smenani yopsin');
  x.faol = !!faol;
}

export function xodimOylik(s, xodimId, oylikStr) {
  const x = xodim(s, xodimId), oylik = H.pul(oylikStr);
  if (!x || x.rol !== 'sotuvchi') throw new Error('Xodim topilmadi');
  if (oylik == null) throw new Error('Oylikni kiriting');
  x.oylik = oylik;
}

// Sinov rejimida haqiqiy havola yo'q — kod faqat ko'rinish uchun.
export function taklifYarat(s, xodimId) {
  const z = xodim(s, xodimId);
  if (!z) throw new Error('Xodim topilmadi');
  if (!z.telefon) throw new Error('Avval xodimning telefon raqamini yozing — havola faqat shu raqamda ochiladi');
  return 'sinov-' + xodimId;
}

// Havola telefon raqamga bog'lanadi (SQL xodim_telefon).
export function xodimTelefon(s, xodimId, tel) {
  const t = H.normTel(tel);
  if (!t) throw new Error('Telefon raqami noto\'g\'ri (+998 XX XXX XX XX)');
  if (s.xodimlar.some((z) => z.telefon === t && z.id !== xodimId && z.faol !== false)) throw new Error('Bu raqam boshqa xodimga yozilgan');
  const z = xodim(s, xodimId);
  if (!z || z.faol === false) throw new Error('Xodim topilmadi');
  z.telefon = t;
  return t;
}

// ---- Xodim: vaqtincha filial, 2-daraja (SQL: xodim_vaqtincha, xodim_daraja) ----
// Ikkinchi ish joyi (SQL xodim_qoshimcha): bo'sh filial — olib tashlash; asosiy filialda kunduzgi/tungi, boshqasida kunlik.
export function xodimQoshimcha(s, xodimId, filialId, smena) {
  const z = xodim(s, xodimId);
  if (!z || z.rol !== 'sotuvchi' || z.faol === false) throw new Error('Xodim topilmadi');
  if (!filialId) { delete z.qoshimchaFilial; delete z.qoshimchaSmena; return; }
  const f = filial(s, filialId);
  if (!f) throw new Error('Filialni tanlang');
  const sm = f.asosiy ? smena : 'kunlik';
  if (f.asosiy && sm !== 'kunduzgi' && sm !== 'tungi') throw new Error('Smenani tanlang: kunduzgi yoki tungi');
  if (filialId === z.filialId && sm === z.smena) throw new Error('Bu uning asosiy ish joyi — boshqasini tanlang');
  z.qoshimchaFilial = filialId; z.qoshimchaSmena = sm;
}
export function xodimVaqtincha(s, xodimId, filialId, gacha) {
  const z = xodim(s, xodimId);
  if (!z || z.rol !== 'sotuvchi') throw new Error('Xodim topilmadi');
  if (s.smenalar.some((m) => m.xodimId === xodimId && !m.yopildi)) throw new Error(z.ism + 'ning smenasi ochiq — avval smenani yopsin');
  if (!filialId || filialId === z.filialId) { delete z.vaqtinchaFilial; delete z.vaqtinchaGacha; return; }
  if (!filial(s, filialId)) throw new Error('Filialni tanlang');
  if (gacha && gacha < H.kunKey(Date.now())) throw new Error('Sana o\'tib ketgan');
  z.vaqtinchaFilial = filialId;
  z.vaqtinchaGacha = gacha || null;
}
export function xodimDaraja(s, xodimId, daraja) {
  const z = xodim(s, xodimId);
  if (!z || z.rol !== 'sotuvchi') throw new Error('Xodim topilmadi');
  z.daraja = daraja === 2 ? 2 : 1;
}
// Allaqachon o'ralgan bo'lsa — birinchi belgi (kim, vaqt) qoladi (SQL bemor_oraldi).
export function bemorOraldi(s, id, oraldi, kim) {
  const b = rs(s).bemorlar.find((z) => z.id === id && (z.holat === 'berildi' || z.holat === 'olindi'));
  if (!b) throw new Error('Berilgan bemor topilmadi');
  if (!oraldi) { delete b.oraldi; delete b.oraldiKim; return; }
  if (!b.oraldi) { b.oraldi = Date.now(); if (kim) b.oraldiKim = kim; }
}
// Oson Apteka'dan chiqarildi (SQL bemor_oson): birinchi qo'ygan va vaqt saqlanadi.
export function bemorOson(s, id, belgi, kim) {
  const b = rs(s).bemorlar.find((z) => z.id === id && (z.holat === 'berildi' || z.holat === 'olindi'));
  if (!b) throw new Error('Berilgan bemor topilmadi');
  if (!belgi) { delete b.oson; delete b.osonKim; return; }
  if (!b.oson) { b.oson = Date.now(); if (kim) b.osonKim = kim; }
}
// Aptekadagi mijozlar bir yo'la (SQL oson_mijozlar): aynan berilgan id'lar; bittasi ham mos kelmasa (ichki punktniki emas, berilmagan,
// allaqachon belgilangan) — hech narsa o'zgarmaydi.
export function osonMijozlar(s, idlar, kim) {
  if (!Array.isArray(idlar) || !idlar.length) throw new Error("Mijozlar ro'yxati bo'sh");
  if (idlar.length > 300) throw new Error("Bir yo'la ko'pi bilan 300 mijoz");
  if (new Set(idlar).size !== idlar.length) throw new Error("Mijozlar ro'yxati noto'g'ri");
  const ichki = new Set(rs(s).punktlar.filter((p) => p.ichki).map((p) => p.id));
  const list = idlar.map((id) => rs(s).bemorlar.find((z) => z.id === id));
  const yomon = list.filter((z) => !z || !ichki.has(z.punktId) || !(z.holat === 'berildi' || z.holat === 'olindi') || z.oson).length;
  if (yomon) throw new Error("Ro'yxat o'zgardi: " + yomon + " mijoz boshqa telefonda chiqarilgan yoki o'zgargan. Hech narsa belgilanmadi — jadval yangilanadi, Oson'dan chiqargan miqdoringizni qayta tekshiring");
  const t = Date.now();
  list.forEach((z) => { z.oson = t; if (kim) z.osonKim = kim; });
  return list.length;
}
// Punkt to'plami (punkt + kun) bir yo'la (SQL oson_toplam): belgilanmaganlarga belgi yoki hammasidan olib tashlash.
// soni — ekranda ko'ringan bemorlar soni: boshqacha bo'lsa (orada yangi bemor qo'shilgan) — hech narsa o'zgarmaydi.
export function osonToplam(s, punktId, kun, belgi, soni, kim) {
  const list = rs(s).bemorlar.filter((z) => z.punktId === punktId && H.kunKey(z.ts) === kun && (z.holat === 'berildi' || z.holat === 'olindi')
    && (belgi ? !z.oson : !!z.oson));
  if (!list.length) throw new Error(belgi ? 'Chiqariladigan bemor yo\'q — hammasi allaqachon belgilangan' : 'Belgilangan bemor yo\'q');
  if (list.length !== soni) throw new Error('Ro\'yxat o\'zgardi: ' + list.length + ' ta bemor (ekranda ' + soni + ' ta edi) — yangilandi, qayta ko\'rib bosing');
  const t = Date.now();
  list.forEach((z) => { if (belgi) { z.oson = t; if (kim) z.osonKim = kim; } else { delete z.oson; delete z.osonKim; } });
  return list.length;
}
// Qadoqlash va Oson ekrani uchun yengil holat (SQL qadoq_holat): berilgan bemorlar, JSHSHIR va kodlarsiz.
export const qadoqHolat = (s) => JSON.parse(JSON.stringify(rs(s).bemorlar.filter((b) => b.holat === 'berildi' || b.holat === 'olindi')
  .map((b) => ({ id: b.id, holat: b.holat, dorilar: b.dorilar, oraldi: b.oraldi, oraldiKim: b.oraldiKim, oson: b.oson, osonKim: b.osonKim, berdi: b.berdi, qolda: b.qolda }))));

// ---- Defektura (SQL: defektura_yoz, defektura_holat, defektura_ochir) ----
export function defekturaYoz(s, xodimId, nom, izoh) {
  const x = H.ishdagi(xodim(s, xodimId), s);
  const n = H.defNom(nom);
  if (n.length < 2 || n.length > 200) throw new Error('Dori nomini yozing');
  s.defektura = s.defektura || [];
  const bor = s.defektura.find((d) => d.filialId === x.filialId && (d.holat === 'yangi' || d.holat === 'buyurtma') && d.nom.toLowerCase() === n.toLowerCase());
  if (bor) throw new Error('Bu dori ro\'yxatda bor' + (bor.holat === 'buyurtma' ? ' — buyurtma berilgan' : ''));
  const d = { id: yangiId('d'), nom: n, izoh: String(izoh || '').trim(), xodimId, filialId: x.filialId, ts: Date.now(), holat: 'yangi' };
  s.defektura.push(d);
  return d.id;
}

// Kim: direktor yoki 2-darajali xodim (SQL katta_xodim); "Kerak emas" (bekor) — faqat direktor (audit 3.4).
export function defekturaHolat(s, nom, holat, kim) {
  const x = H.ishdagi(xodim(s, kim), s);
  if (!x || !(x.rol === 'direktor' || x.daraja === 2)) throw new Error('Bu amal uchun ruxsat yo\'q (2-daraja yoki direktor)');
  if (!['buyurtma', 'keldi', 'bekor'].includes(holat)) throw new Error('Holatni tanlang');
  if (holat === 'bekor' && x.rol !== 'direktor') throw new Error('"Kerak emas" ni faqat direktor belgilaydi');
  const n = H.defNom(nom).toLowerCase();
  const ochiq = (s.defektura || []).filter((d) => d.nom.toLowerCase() === n && (d.holat === 'yangi' || (d.holat === 'buyurtma' && holat !== 'buyurtma')));
  if (!ochiq.length) throw new Error('Ochiq yozuv topilmadi');
  ochiq.forEach((d) => { d.holat = holat; d.holatTs = Date.now(); });
  return ochiq.length;
}

export function defekturaOchir(s, id, xodimId) {
  const x = H.ishdagi(xodim(s, xodimId), s);
  const d = (s.defektura || []).find((z) => z.id === id && z.holat === 'yangi' && (z.xodimId === xodimId || (x && x.rol === 'direktor')));
  if (!d) throw new Error('O\'chiriladigan yozuv topilmadi');
  d.holat = 'bekor';
}

// ---- Shtrix-kodlar (SQL: shtrix_qosh, shtrix_ochir) — faqat direktor; bir xil nom va turi bo'lsa kodi yangilanadi ----
export function shtrixQosh(s, xodimId, guruh, nom, kod) {
  const x = xodim(s, xodimId);
  if (!x || x.rol !== 'direktor') throw new Error('Bu amal uchun ruxsat yo\'q');
  let g = String(guruh || '').trim().replace(/\s+/g, ' ');
  const n = String(nom || '').trim().replace(/\s+/g, ' ');
  const k = String(kod || '').replace(/\s/g, '');
  if (!g || g.length > 60) throw new Error('Nomini yozing (masalan: Shprits)');
  if (n.length > 60) throw new Error('Turi juda uzun');
  if (!/^[!-~]{1,40}$/.test(k)) throw new Error('Shtrix-kod noto\'g\'ri — raqamlarni yozing');
  s.shtrixlar = s.shtrixlar || [];
  const asl = s.shtrixlar.find((z) => z.guruh.toLowerCase() === g.toLowerCase());
  if (asl) g = asl.guruh;
  const bor = s.shtrixlar.find((z) => z.guruh === g && z.nom.toLowerCase() === n.toLowerCase());
  if (bor) { bor.kod = k; return bor.id; }
  const id = 'sh-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  s.shtrixlar.push({ id, guruh: g, nom: n, kod: k });
  return id;
}
export function shtrixOchir(s, xodimId, id) {
  const x = xodim(s, xodimId);
  if (!x || x.rol !== 'direktor') throw new Error('Bu amal uchun ruxsat yo\'q');
  const i = (s.shtrixlar || []).findIndex((z) => z.id === id);
  if (i < 0) throw new Error('Shtrix-kod topilmadi');
  s.shtrixlar.splice(i, 1);
}

// ---- Prays (sinov rejimida — kichik uydirma ro'yxat) ----
const DEMO_PRAYS = [['Trombopol 150 mg №60', 52000], ['Trombopol 75 mg №30', 21000], ['Kardiomagnil 75 mg №100', 89000], ['Analgin 500 mg №10', 4000],
  ['Paratsetamol 500 mg №10', 3000], ['Sitramon №10', 3500], ['No-shpa 40 mg №24', 38000], ['Ketonal 100 mg №20', 45000], ['Ambroksol sirop 100 ml', 18000], ['Vitamin C 500 mg №30', 25000]];
export function praysQidir(soz) {
  // Server bilan bir xil tartib: nomi so'rovning birinchi so'zi bilan boshlanganlari oldin, keyin alifbo.
  const bir = H.qidiruvKalit(soz).split(' ')[0];
  const boshi = (n) => (H.qidiruvKalit(n).startsWith(bir) ? 0 : 1);
  return DEMO_PRAYS.filter(([n]) => H.qidiruvMos(soz, n)).sort((a, b) => boshi(a[0]) - boshi(b[0]) || (a[0] < b[0] ? -1 : 1))
    .slice(0, 30).map(([nom, narx]) => ({ nom, narx }));
}

// ---- Ta'minotchi roli (SQL: ta_taklif_yarat, ta_tasdiq, ta_etiroz, ta_xarid) ----
export function taTaklifYarat(s, tId) {
  const t = tamin(s, tId);
  if (!t.telefon) throw new Error('Avval ta\'minotchining telefon raqamini yozing — havola faqat shu raqamda ochiladi');
  return 'sinov-' + tId;
}
// Havola telefon raqamga bog'lanadi; uzish — Telegram bog'lanishi olinadi (SQL taminotchi_telefon, taminotchi_uzish; 27.10).
export function taminotchiTelefon(s, tId, tel) {
  const t = tamin(s, tId), v = H.normTel(tel);
  if (!v) throw new Error('Telefon raqami noto\'g\'ri (+998 XX XXX XX XX)');
  t.telefon = v;
  return v;
}
export function taminotchiUzish(s, tId) { const t = tamin(s, tId); t.ulangan = false; t.uzildi = true; }
// Sinov: uzilgan ta'minotchi amal qila olmaydi (SQL taminotchi_tg).
const taUlangan = (s, id) => { const t = tamin(s, id); if (t.uzildi) throw new Error('Siz ta\'minotchi sifatida ulanmagansiz'); return t; };
export function taTasdiq(s, tId, amalId) {
  const t = taUlangan(s, tId);
  const a = t.amallar.find((x) => x.id === amalId && x.holat === 'kutish' && !x.bekor);
  if (!a) throw new Error('Tasdiqlanadigan yozuv topilmadi');
  a.holat = 'ok';
  delete a.etiroz; delete a.etirozTs;
  xabar(s, t.nom + ' tasdiqladi: ' + (a.tur === 'xarid' ? 'xarid ' : 'to\'lov ') + H.som(a.summa));
}
// E'tiroz yozuvda saqlanadi (SQL ta_etiroz, 04.11): faqat apteka yozganiga; tasdiqlangan bo'lsa — yana "kutish"; bir xil matn — rad.
export function taEtiroz(s, tId, amalId, matn) {
  const t = taUlangan(s, tId);
  const m = String(matn || '').replace(/\s+/g, ' ').trim().slice(0, 300);
  if (m.length < 2) throw new Error('Nima noto\'g\'ri ekanini yozing');
  const a = t.amallar.find((x) => x.id === amalId && !x.bekor);
  if (!a) throw new Error('Yozuv topilmadi yoki bekor qilingan');
  if (!a.kim) throw new Error('Bu yozuvni o\'zingiz yozgansiz — e\'tiroz faqat apteka yozgan yozuvga');
  if (a.etiroz === m) throw new Error('Bu e\'tiroz allaqachon yuborilgan — direktor ko\'rib chiqadi');
  Object.assign(a, { etiroz: m, etirozTs: Date.now(), holat: 'kutish' });
  delete a.avto;
  xabar(s, t.nom + ' e\'tiroz bildirdi: ' + (a.tur === 'xarid' ? 'xarid ' : 'to\'lov ') + H.som(a.summa) + ' (' + ui_kun(a.ts) + ') — ' + m, 'ogoh');
}
const ui_kun = (ts) => new Date(ts).toLocaleDateString('ru-RU', { timeZone: 'Asia/Tashkent', day: '2-digit', month: '2-digit' });
export function taXarid(s, tId, summaStr, izoh, rows = [], sana = null) {
  const t = taUlangan(s, tId);
  const kun = taSana(sana);
  const r = H.xaridQatorlar(rows);
  if (r.xato) throw new Error(r.xato);
  const summa = r.qatorlar.length ? r.jami : H.pul(summaStr);
  if (!summa || summa <= 0) throw new Error('Xarid summasini kiriting');
  summaChegara(summa);
  const a = { id: yangiId('a'), tur: 'xarid', summa, izoh: String(izoh || '').trim() || 'Dori xaridi', ts: Date.now(), kim: null, holat: 'ular' };
  a.sana = kun || H.kunKey(a.ts);
  if (r.qatorlar.length) a.qatorlar = r.qatorlar.map((q) => ({ ...q, summa: q.soni * q.narx }));
  t.amallar.push(a);
  taDoriEsla(t, a);
  xabar(s, t.nom + ' xarid yozdi: ' + H.som(summa) + ' — Ta\'minot bo\'limida tasdiqlang', 'sorov');
  return a.id;
}

// ---- Reimbursatsiya (sinov). Serverda ro'yxatni kengaytmadagi core.js ajratadi; bu yerda — soddalashtirilgan. ----
function demoRoyxat(matn) {
  return String(matn || '').split(/\r?\n/).map((q) => {
    // Lookbehind'siz (eski iPhone'da modul ochilsin — audit 06.11): oldingi belgi — boshi yoki raqam emas.
    const j = ((q.match(/(?:^|\D)(\d{14})(?!\d)/) || [])[1]) || '';
    const kodlar = [...q.replace(j, ' ').matchAll(/(?:^|\D)(\d{3})[\s-]?(\d{3})(?!\d)/g)].map((x) => x[1] + x[2]);
    const ism = q.replace(/^\s*\d{1,3}\s*[).]\s*/, '').replace(/[\d\-:;,.()]+/g, ' ').replace(/\s+/g, ' ').trim();
    const xato = [];
    if (!j) xato.push('JSHSHIR yo\'q');
    if (!kodlar.length) xato.push('Himoya kodi yo\'q');
    return j || kodlar.length ? { ism, jshshir: j, kodlar, xato } : null;
  }).filter(Boolean);
}
const rs = (s) => (s.retsept = s.retsept || { punktlar: [], xabarlar: [], bemorlar: [] });
function bemorQosh(s, punktId, xabarId, list) {
  const r = rs(s);
  const bugun = H.kunKey(Date.now());
  let n = r.bemorlar.filter((b) => b.punktId === punktId && H.kunKey(b.ts) === bugun).length;
  list.forEach((b) => r.bemorlar.push({ id: yangiId('b'), punktId, xabarId, ts: Date.now(), n: ++n, ...b, holat: 'navbat' }));
  return list.length;
}
export const retseptlar = (s) => JSON.parse(JSON.stringify(rs(s)));
// Berilgan dorilar hisoboti (SQL dorilar_hisobot): davrdagi berilgan bemorlar — punkt + modda bo'yicha jami.
export function dorilarHisobot(s, dan, gacha) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dan || '') || !/^\d{4}-\d{2}-\d{2}$/.test(gacha || '') || dan > gacha) throw new Error('Sana noto\'g\'ri');
  const g = new Map();
  rs(s).bemorlar.filter((b) => (b.holat === 'berildi' || b.holat === 'olindi') && Array.isArray(b.dorilar)).forEach((b) => {
    const kun = H.kunKey(b.ts);
    if (kun < dan || kun > gacha) return;
    const p = rs(s).punktlar.find((x) => x.id === b.punktId) || { nom: 'Punkt' };
    b.dorilar.filter((d) => !d.berilmadi && Number(d.soni) > 0).forEach((d) => {
      const xpn = String(d.xpn || '').trim(), k = b.punktId + '|' + xpn;
      const r = g.get(k) || { punktId: b.punktId, punkt: p.nom, ichki: !!p.ichki, xpn, soni: 0, bemorlar: new Set() };
      r.soni += Number(d.soni) || 0; r.bemorlar.add(b.id);
      g.set(k, r);
    });
  });
  return [...g.values()].map(({ bemorlar, ...r }) => ({ ...r, bemor: bemorlar.size }));
}
export function punktExcel() { throw new Error('Sinov rejimida bot yo\'q — Excel faqat ilovada'); }
export function punktRoyxatExcel() { throw new Error('Sinov rejimida bot yo\'q — Excel faqat ilovada'); }
// Davomat (29.10) — server: ilova.davomat_belgila / davomat_oy (bir xil qoida).
export function davomatBelgila(s, direktorId, xodimId, kun, keldi) {
  const d = xodim(s, direktorId);
  if (!d || d.rol !== 'direktor') throw new Error('Bu amal uchun ruxsat yo\'q');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(kun || ''))) throw new Error('Kun noto\'g\'ri');
  if (kun > H.kunKey(Date.now())) throw new Error('Kelajak kun uchun belgilab bo\'lmaydi');
  const x = xodim(s, xodimId);
  if (!x || x.rol !== 'sotuvchi') throw new Error('Xodim topilmadi');
  s.davomat = (s.davomat || []).filter((z) => !(z.kun === kun && z.xodimId === xodimId));
  if (keldi !== null && keldi !== undefined) s.davomat.push({ kun, xodimId, keldi: !!keldi, kim: direktorId });
  return true;
}
// «Savdo bo'lmadi» (server: ilova.savdo_yoq_belgila): filial shu kuni yopiq edi — faqat belgi, hisobga hech narsa yozilmaydi.
export function savdoYoq(s, direktorId, filialId, kun, yoq) {
  const d = xodim(s, direktorId);
  if (!d || d.rol !== 'direktor') throw new Error('Bu amal uchun ruxsat yo\'q');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(kun || '')) || Number.isNaN(Date.parse(kun))) throw new Error('Kun noto\'g\'ri');
  if (kun > H.kunKey(Date.now())) throw new Error('Kelajak kun uchun belgilab bo\'lmaydi');
  if (!s.filiallar.some((f) => f.id === filialId)) throw new Error('Filial topilmadi');
  s.savdoYoq = (s.savdoYoq || []).filter((y) => !(y.filialId === filialId && y.kun === kun));
  if (yoq) s.savdoYoq.push({ filialId, kun });
  return true;
}
// Eski ochiq smenani direktor yopadi (server: ilova.smena_direktor_yop): savdosiz, farqsiz, bekor qilingan.
export function smenaDirektorYop(s, direktorId, smenaId) {
  const d = xodim(s, direktorId);
  if (!d || d.rol !== 'direktor') throw new Error('Bu amal uchun ruxsat yo\'q');
  const sm = s.smenalar.find((z) => z.id === smenaId);
  if (!sm || sm.yopildi) throw new Error('Ochiq smena topilmadi — yangilab ko\'ring');
  const kut = Math.max(0, (sm.ochilishPul || 0) - H.xarajatJami(sm) - H.olinganJami(sm));
  Object.assign(sm, { naqd: 0, karta: 0, sanalgan: kut, qoldirildi: kut, kimga: 'tungi', yopildi: Date.now(), qabul: null,
    bekor: { vaqt: Date.now(), sabab: 'Smena tizimi olib tashlandi — direktor yopdi' } });
  return true;
}
export function davomatOy(s, menId, oy) {
  const men = xodim(s, menId);
  if (!/^\d{4}-\d{2}$/.test(String(oy || ''))) throw new Error('Oy noto\'g\'ri');
  const d = (s.davomat || []).filter((z) => z.kun.slice(0, 7) === oy);
  const xodimlar = s.xodimlar.filter((z) => z.rol === 'sotuvchi' && (men.rol === 'direktor' || z.id === menId) && (z.faol !== false || d.some((q) => q.xodimId === z.id)))
    .sort((a, b) => String(a.filialId).localeCompare(String(b.filialId)) || a.ism.localeCompare(b.ism))
    .map((z) => {
      const meniki = d.filter((q) => q.xodimId === z.id);
      return { id: z.id, ism: z.ism, filial: z.filialId, faol: z.faol !== false, kunlar: Object.fromEntries(meniki.map((q) => [q.kun, q.keldi])),
        keldi: meniki.filter((q) => q.keldi).length, kelmadi: meniki.filter((q) => !q.keldi).length };
    });
  return { oy, bugun: H.kunKey(Date.now()), xodimlar };
}
export function oyinYoq() { throw new Error('O\'yin faqat Telegram ilovasida (serverda) ishlaydi'); }
export function osonYoq() { throw new Error('Oson qoldig\'i faqat Telegram ilovasida (serverda) ishlaydi'); }
export function firmaYoq() { throw new Error('Firma prayslari faqat Telegram ilovasida (serverda) ishlaydi'); }
export function dorilarExcel() { throw new Error('Sinov rejimida bot yo\'q — Excel faqat ilovada'); }
// Kompyuterlardagi partiyalar (SQL partiyalar_royxat) — sinovda namuna; muddati o'tgan va yaqinlashgani ham bor.
const sanaKeyin = (kun) => { const d = new Date(Date.now() + kun * 864e5); return String(d.getDate()).padStart(2, '0') + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + d.getFullYear(); };
export const partiyalar = (s) => JSON.parse(JSON.stringify(s.partiyalar || [
  { id: 'p1', xpn: 'Asetilsalitsil kislotasi', doza: '150 mg', savdoNomi: 'Trombopol 150 mg', seriya: '40326', ishlabChiqarilgan: '04.03.2026', yaroqlilik: sanaKeyin(400), narx: '52000', faol: true },
  { id: 'p2', xpn: 'Asetilsalitsil kislotasi', doza: '75 mg', savdoNomi: 'Kardiomagnil 75 mg', seriya: 'K7', ishlabChiqarilgan: '01.02.2026', yaroqlilik: sanaKeyin(20), narx: '89000', faol: true },
  { id: 'p3', xpn: 'Amlodipin', doza: '10 mg', savdoNomi: 'Koronim 10 mg', seriya: 'KR2511', ishlabChiqarilgan: '12.01.2026', yaroqlilik: sanaKeyin(-3), narx: '', faol: true },
  { id: 'p4', xpn: 'Bisoprolol', doza: '5 mg', savdoNomi: 'Konkor 5 mg', seriya: 'B1', ishlabChiqarilgan: '01.01.2026', yaroqlilik: sanaKeyin(300), narx: '', faol: false }
]));
export function punktQosh(s, nom) {
  const n = String(nom || '').trim().replace(/\s+/g, ' ');
  if (n.length < 2) throw new Error('Punkt nomini yozing');
  if (rs(s).punktlar.some((p) => p.nom === n)) throw new Error('Bunday nomli punkt bor');
  const p = { id: yangiId('p'), nom: n, ulangan: false };
  rs(s).punktlar.push(p);
  return p.id;
}
export function punktTaklif(s, id) {
  const p = rs(s).punktlar.find((x) => x.id === id);
  if (!p) throw new Error('Punkt topilmadi');
  if (!p.telefon) throw new Error('Avval punktdagi odamning telefon raqamini yozing — havola faqat shu raqamda ochiladi');
  return 'sinov' + id.replace(/\W/g, '');
}
// SQL punkt_telefon, punkt_uzish (27.10).
export function punktTelefon(s, id, tel) {
  const p = rs(s).punktlar.find((x) => x.id === id && !x.ichki), v = H.normTel(tel);
  if (!p) throw new Error('Punkt topilmadi');
  if (!v) throw new Error('Telefon raqami noto\'g\'ri (+998 XX XXX XX XX)');
  p.telefon = v;
  return v;
}
export function punktUzish(s, id) {
  const p = rs(s).punktlar.find((x) => x.id === id && !x.ichki);
  if (!p) throw new Error('Punkt topilmadi');
  p.ulangan = false;
}
export function rasmRoyxat(s, id, qr, matn) {
  const m = rs(s).xabarlar.find((z) => z.id === id && z.tur === 'rasm');
  if (!m) throw new Error('Rasm topilmadi');
  // Server bilan bir xil (audit M1): ko'rib chiqilgan rasmning QR'i qayta qo'shilmaydi — 0.
  if (qr && m.qr != null && m.korildi) return 0;
  if (qr) m.qr = String(matn || '');
  m.korildi = Date.now();
  const n = bemorQosh(s, m.punktId, m.id, demoRoyxat(matn));
  if (!qr && !n) throw new Error('Ro\'yxatda bemor topilmadi — JSHSHIR va himoya kodini yozing');
  return n;
}
export function punktQolda(s, punktId, matn) {
  if (!rs(s).punktlar.some((p) => p.id === punktId)) throw new Error('Punktni tanlang');
  const x = { id: yangiId('m'), punktId, ts: Date.now(), tur: 'matn', matn, korildi: Date.now() };
  const list = demoRoyxat(matn);
  if (!list.length) throw new Error('Ro\'yxatda bemor topilmadi — har bemor uchun JSHSHIR va himoya kodini yozing');
  rs(s).xabarlar.push(x);
  return bemorQosh(s, punktId, x.id, list);
}
// Punkt panelidan bitta bemor (server punkt_bemor bilan bir xil qoidalar).
export function punktBemor(s, punktId, f) {
  if (!rs(s).punktlar.some((p) => p.id === punktId)) throw new Error('Bu amal faqat punkt uchun');
  const x = H.punktBemorXato(f);
  if (x) throw new Error(Object.values(x)[0]);
  const jshshir = H.raqamlar(f.jshshir);
  const kodlar = [...new Set((f.kodlar || []).map(H.raqamlar).filter(Boolean))];
  if (kodlar.length > 5) throw new Error('Bitta bemorga 5 tagacha kod');
  if (rs(s).bemorlar.some((b) => b.punktId === punktId && b.jshshir === jshshir && b.kodlar.some((k) => kodlar.includes(k)))) {
    throw new Error('Bu bemor shu kod bilan allaqachon yuborilgan');
  }
  const m = { id: yangiId('m'), punktId, ts: Date.now(), tur: 'matn', matn: 'Paneldan qo\'lda', korildi: Date.now() };
  rs(s).xabarlar.push(m);
  bemorQosh(s, punktId, m.id, [{ ism: String(f.ism).trim().replace(/\s+/g, ' '), jshshir, kodlar, xato: [] }]);
  return rs(s).bemorlar[rs(s).bemorlar.length - 1].n;
}
// Kim berdi (SQL trigger bemor_berdi_kompyuter): ilovada «berildi»/«olib ketildi»ga o'tganda — qo'lda, o'sha xodim; chiqsa — o'chadi.
const berdiQoy = (b, eski, kim) => {
  const ber = (h) => h === 'berildi' || h === 'olindi';
  if (!ber(b.holat)) { delete b.berdi; delete b.qolda; } else if (!ber(eski)) { delete b.berdi; if (kim) b.qolda = kim; else delete b.qolda; }
};
export function bemorHolat(s, id, holat, sabab, kim) {
  const b = rs(s).bemorlar.find((z) => z.id === id);
  if (!b) throw new Error('Bemor topilmadi');
  if (holat === 'ochilmadi' && String(sabab || '').trim().length < 2) throw new Error('Sababini yozing');
  const eski = b.holat;
  Object.assign(b, { holat, sabab: holat === 'ochilmadi' ? String(sabab).trim() : undefined, holatTs: Date.now() });
  berdiQoy(b, eski, kim);
}
export function bemorlarHammasi(s, punktId, kun, holat, kim) {
  const list = rs(s).bemorlar.filter((b) => b.punktId === punktId && H.kunKey(b.ts) === kun
    && b.holat === (holat === 'berildi' ? 'navbat' : 'berildi') && (holat !== 'berildi' || !(b.xato || []).length));
  list.forEach((b) => { const eski = b.holat; b.holat = holat; b.holatTs = Date.now(); berdiQoy(b, eski, kim); });
  return list.length;
}
export function punktgaXabar(s, punktId, kun) {
  const list = rs(s).bemorlar.filter((b) => b.punktId === punktId && H.kunKey(b.ts) === kun);
  if (!list.length) throw new Error('Bu kunda bemor yo\'q');
  const tayyor = list.filter((b) => b.holat === 'berildi' || b.holat === 'olindi').length;
  const t = (s.sozlama.aptekaNomi || 'Apteka') + '\n' + kun.slice(8) + '.' + kun.slice(5, 7) + ' ro\'yxat: ' + list.length + ' tadan ' + tayyor + ' tasi tayyor.';
  xabar(s, 'Punktga (sinov): ' + t);
  return t;
}
export function aptekaNomla(s, nom) {
  const n = String(nom || '').trim().replace(/\s+/g, ' ');
  if (n.length < 2 || n.length > 60) throw new Error('Apteka nomini yozing (2–60 harf)');
  s.sozlama.aptekaNomi = n;
}
// Punkt paneli (sinov): server punkt_holat bilan bir xil ko'rinish.
export function punktPanel(s, id) {
  const p = rs(s).punktlar.find((z) => z.id === id);
  s.apteka = s.sozlama.aptekaNomi;
  return { id, nom: p.nom, rasmlar: rs(s).xabarlar.filter((m) => m.punktId === id && m.tur === 'rasm' && !m.korildi).length,
    bemorlar: rs(s).bemorlar.filter((b) => b.punktId === id).map((b) => ({ ...b, jshshir: b.jshshir ? b.jshshir.slice(0, 1) + '•'.repeat(b.jshshir.length - 4) + b.jshshir.slice(-3) : null, kodlar: b.kodlar.length })) };   // server jshshir_niqob: tug'ilgan sana yashirin
}

// Sinov ma'lumotlari (uydirma). Haqiqiy ro'yxat foydalanuvchidan keladi.
export function demoHolat() {
  return {
    versiya: 1,
    filiallar: [
      { id: 'osnovnoy', nom: 'Osnovnoy', asosiy: true },
      { id: 'f2', nom: '2-filial' },
      { id: 'f3', nom: '3-filial' }
    ],
    xodimlar: [
      { id: 'dir', ism: 'Direktor', filialId: 'osnovnoy', rol: 'direktor' },
      { id: 'malika', ism: 'Malika', filialId: 'osnovnoy', smena: 'kunduzgi', rol: 'sotuvchi', oylik: 3500000, avanslar: [] },
      { id: 'dilshod', ism: 'Dilshod', filialId: 'osnovnoy', smena: 'tungi', rol: 'sotuvchi', oylik: 3500000, avanslar: [] },
      { id: 'aziza', ism: 'Aziza', filialId: 'f2', smena: 'kunlik', rol: 'sotuvchi', oylik: 3000000, avanslar: [] },
      { id: 'bekzod', ism: 'Bekzod', filialId: 'f3', smena: 'kunlik', rol: 'sotuvchi', oylik: 3000000, avanslar: [] }
    ],
    smenalar: [],
    harakatlar: [],
    qarzlar: [],
    xabarlar: [],
    defektura: [],
    // Uydirma shtrix-kodlar (13 raqamli — to'g'ri EAN-13, qolgani Code 128).
    shtrixlar: [{ id: 'sh-1', guruh: 'Shprits', nom: '2 ml', kod: '4780000000014' }, { id: 'sh-2', guruh: 'Shprits', nom: '5 ml', kod: '4780000000021' },
      { id: 'sh-3', guruh: 'Shprits', nom: '10 ml', kod: '4780000000038' }, { id: 'sh-4', guruh: 'Sistema', nom: '', kod: '1000245' },
      { id: 'sh-5', guruh: 'Analgin', nom: 'ampula 2 ml', kod: 'AN50' }, { id: 'sh-6', guruh: 'Analgin', nom: 'tabletka №10', kod: '4780000000045' }],
    // Uydirma: faktura Excel'ga yozilganda serverdan keladi.
    kelgan: [{ nom: 'Trombopol 150 mg №60', soni: 20, ts: Date.now() - 36e5 }, { nom: 'Sitramon №10', soni: 50, ts: Date.now() - 36e5 },
      { nom: 'No-shpa 40 mg №24', soni: 10, ts: Date.now() - 864e5 }],
    prays: { soni: DEMO_PRAYS.length, yangilandi: null, kalit: false },
    // Uydirma punkt va bemorlar (JSHSHIR — 01.01.1900/2000 sanali, haqiqiy emas).
    retsept: {
      punktlar: [{ id: 'p-poli3', nom: '3-poliklinika', ulangan: true }],
      xabarlar: [{ id: 'm-1', punktId: 'p-poli3', ts: Date.now() - 36e5, tur: 'matn', matn: 'ro\'yxat' },
        { id: 'm-2', punktId: 'p-poli3', ts: Date.now() - 18e5, tur: 'rasm', rasm: true }],
      bemorlar: [
        { id: 'b-1', punktId: 'p-poli3', xabarId: 'm-1', ts: Date.now() - 36e5, n: 1, ism: 'Testova A.', jshshir: '30101000000011', kodlar: ['111222', '333444'], xato: [], holat: 'navbat' },
        { id: 'b-2', punktId: 'p-poli3', xabarId: 'm-1', ts: Date.now() - 36e5, n: 2, ism: 'Sinovov B.', jshshir: '40101000000022', kodlar: ['555666'], xato: [], holat: 'navbat' },
        { id: 'b-3', punktId: 'p-poli3', xabarId: 'm-1', ts: Date.now() - 36e5, n: 3, ism: 'Namunova C.', jshshir: '', kodlar: ['777888'], xato: ['JSHSHIR yo\'q'], holat: 'navbat' },
        { id: 'b-4', punktId: 'p-poli3', xabarId: 'm-1', ts: Date.now() - 36e5, n: 4, ism: 'Misolova D.', jshshir: '50101000000033', kodlar: ['999000'], xato: [], holat: 'berildi',
          dorilar: [{ nom: 'Trombopol 150 mg', xpn: 'Asetilsalitsil kislotasi 150 mg', soni: 30 }, { nom: 'Koronim 10 mg', xpn: 'Amlodipin 10 mg', soni: 30 }] },
        // Aptekadagi kompyuter QR retsept bo'yicha bergan bemor (C4): JSHSHIR va kod yo'q.
        { id: 'b-5', punktId: 'p-poli3', ts: Date.now() - 18e5, n: 5, ism: 'Qrova E.', jshshir: '', kodlar: [], xato: [], holat: 'berildi',
          dorilar: [{ nom: 'Kardiomagnil 75 mg', xpn: 'Asetilsalitsil kislotasi 75 mg', soni: 100 }] }]
    },
    taminotchilar: [
      { id: 't-siroj', nom: 'Siroj', yuridik: false, boshlangichQarz: 5000000, ulangan: false, amallar: [] },
      { id: 't-bahodir', nom: 'Bahodir aka', yuridik: false, boshlangichQarz: 0, ulangan: false, amallar: [] },
      { id: 't-grandfarm', nom: 'Grandfarm', yuridik: true, boshlangichQarz: 0, ulangan: false, amallar: [] }
    ],
    // hisobBoshi (C3): 400 kundan eski yozuvlar yig'indisi — serverda hisoblanadi; sinovda doim 0.
    sozlama: { limitMijoz: 500000, limitXodim: 3000000, xulosaVaqti: '21:00', aptekaNomi: 'Shaxnoza Dinara Dorixona', boshlangich: { kassa: 0, uy: 0 }, hisobBoshi: { kassa: 0, uy: 0 } }
  };
}
