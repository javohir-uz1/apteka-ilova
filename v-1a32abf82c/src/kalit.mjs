// Qidiruv kaliti (26.10): dori nomini yozuvdan qat'i nazar solishtirish — "Парацетамол", "paratsetamol", "paracetamol"
// bir xil kalitga tushadi. Kirill → lotin, belgilar → bo'shliq, ts/c → s, y → i, x → h, q → k, w → v, takror harf bitta.
// SQL ilova.qidiruv_kalit bilan AYNAN bir xil (tests/server-defektura.test.mjs tekshiradi).
// 05.11: alohida fayl — Edge funksiyasi (supabase/functions/api/kalit.mjs) ham shu nusxani ishlatadi (Oson'dan «Keldi»).
const KIR_KOP = { 'ё': 'yo', 'ж': 'j', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sh', 'ъ': '', 'ь': '', 'ю': 'yu', 'я': 'ya' };
const KIR_BIR = 'абвгдезийклмнопрстуфхыэўқғҳ', LOT_BIR = 'abvgdeziyklmnoprstufxieoqgh';
export function qidiruvKalit(s) {
  let t = String(s == null ? '' : s).toLowerCase().replace(/[ёжцчшщъьюя]/g, (c) => KIR_KOP[c]);
  t = t.replace(/[а-яўқғҳ]/g, (c) => { const i = KIR_BIR.indexOf(c); return i >= 0 ? LOT_BIR[i] : c; });
  t = t.replace(/[ʻʼ'`’‘]/g, '').replace(/[^a-z0-9]+/g, ' ')
    .replace(/ts/g, 's').replace(/c/g, 's').replace(/y/g, 'i').replace(/x/g, 'h').replace(/q/g, 'k').replace(/w/g, 'v')
    .replace(/([a-z])\1+/g, '$1');
  return t.replace(/\s+/g, ' ').trim();
}
