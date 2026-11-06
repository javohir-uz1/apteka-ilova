// Amal natijasidan foydalanuvchiga xabar (DOM'siz — Node testlarida tekshiriladi).
// Takror javobida (C1, sorov.mjs TAKROR) natija yo'q: xabar holatdan yoki betaraf so'z bilan tuziladi —
// "true ta bemor" yoki "topilmadi, qo'lda yozing" kabi chalg'ituvchi gap chiqmasin.
import * as H from './hisob.mjs';

const takrormi = (r) => !!(r && r.takror);
// Server bigint (int8) ni matn qilib yuborishi mumkin ("-50000"): raqamga aylantiramiz; raqam bo'lmasa — null.
export function sonmi(v) {
  if (v === null || v === undefined || v === true || v === false || typeof v === 'object' || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// Qarz yozildi: [matn, tur]. Takrorda — yangi holatdagi shu qarz (shu xodim, telefon, summa; eng oxirgisi) holatiga qarab:
// limit oshgan bo'lsa (ruxsat kutmoqda) ogohlantirish yo'qolmasin — javob kelguncha dori berilmaydi.
export function qarzXabari(r, S, xodimId, forma) {
  if (takrormi(r)) {
    const tel = H.normTel(forma.tel), summa = H.pul(forma.summa);
    const q = ((S && S.qarzlar) || []).filter((z) => z.xodimId === xodimId && H.normTel(z.tel) === tel && z.summa === summa)
      .sort((a, b) => (a.berildi || 0) - (b.berildi || 0)).pop();
    if (q && q.holat === 'ruxsat') return ['Qarz avvalgi urinishda yozilgan — direktor ruxsatini kutmoqda. Javob kelguncha dorini bermang', 'xato'];
    return ['Qarz avvalgi urinishda yozilgan ✓ — ro\'yxatga qarang', 'ok'];
  }
  const ogoh = ((r && r.ogohlantirish) || [])[0];
  if (r && r.limit) return ['Direktorga ruxsat so\'rovi yuborildi — javob kelguncha dorini bermang', 'xato'];
  if (ogoh) return ['Qarz yozildi. ' + ogoh, 'xato'];
  return ['Qarz yozildi ✓', 'ok'];
}

// Sanash (C2): natija — farq (haqiqiy − hisob). v — yozilgan haqiqiy summa.
export function sanashXabari(fq, hamyon, v) {
  const nomi = hamyon === 'uy' ? 'uy' : 'seyf';
  if (takrormi(fq)) return 'Sanash avvalgi urinishda saqlangan ✓ — hisob endi ' + H.som(v);
  const f = sonmi(fq);
  if (f === 0) return 'Hisob mos ✓ — ' + nomi + 'da ' + H.som(v);
  if (f != null) return (f < 0 ? 'Kam chiqdi: ' : 'Ortiqcha chiqdi: ') + H.som(Math.abs(f)) + ' — daftarga yozildi. Hisob endi ' + H.som(v);
  return 'Saqlandi ✓ — hisob endi ' + H.som(v);
}

// Qo'lda yozilgan ro'yxat (rasmdan yoki qog'ozdan) qo'shildi.
export function royxatXabari(n) {
  if (takrormi(n)) return 'Bu ro\'yxat avvalgi urinishda qo\'shilgan ✓ — ro\'yxatga qarang';
  const k = sonmi(n);
  return k != null ? k + ' ta bemor qo\'shildi ✓' : 'Ro\'yxatga qo\'shildi ✓';
}

// Rasm QR'idan avtomatik qo'shish natijasi. n: null — xato (xabar alohida chiqqan); TAKROR; son.
// 0 ikki ma'noda keladi (server): QR ichida bemor yo'q YOKI rasm avval ko'rib chiqilgan (audit M1, qayta qo'shilmaydi) —
// shuning uchun "qo'lda yozing" deb buyurmaymiz: avval ro'yxatni tekshirishni aytamiz.
export function rasmQrXabari(n, qrlar) {
  if (n === null) return 'Qo\'shilmadi — pastdagi xabarga qarang va qayta urinib ko\'ring.';
  if (takrormi(n)) return 'QR\'dagi bemorlar avvalgi urinishda qo\'shilgan ✓ — ro\'yxatga qarang.';
  const k = sonmi(n);
  if (k) return '✓ QR\'dan ' + k + ' ta bemor qo\'shildi.';
  return 'Yangi bemor qo\'shilmadi: QR ichida JSHSHIR va kod yo\'q yoki bu rasm avval ko\'rib chiqilgan. Avval ro\'yxatni tekshiring; '
    + 'bemor u yerda bo\'lmasa — rasmdan qo\'lda yozing. QR ichida: «' + (qrlar || []).join(' | ').slice(0, 200) + '»';
}

// Rasm ko'rib chiqilganmi (audit §3.1/M1): ko'rib chiqilgan rasmdan QR faqat ko'rsatiladi, bemorlar qayta qo'shilmaydi.
// Ro'yxat (R) fonda yangilanguncha korildi eski bo'lishi mumkin — shu telefonda QR'dan qo'shilgan rasmlar ham ko'rilgan.
export const rasmKorilganmi = (z, qoshilgan) => !!(z && (z.korildi || (qoshilgan && qoshilgan.has(z.id))));
