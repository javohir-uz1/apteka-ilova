// O'zbek lotin → kirill (oddiy rejim, 26.10): ekrandagi matn chizilgandan keyin almashtiriladi — kod lotinda qoladi.
// Qoidalar: sh, ch, o', g', ya/yo/yu/ye, so'z boshidagi e → э, tutuq belgisi → ъ; oy nomlari — lug'atdan (октябрь).
// Inputga yozilgan qiymat, raqamlar va [data-asl] ichidagi matn (masalan "Lotin" tugmasi) o'zgarmaydi.

const HARF = { a: 'а', b: 'б', c: 'с', d: 'д', e: 'е', f: 'ф', g: 'г', h: 'ҳ', i: 'и', j: 'ж', k: 'к', l: 'л', m: 'м', n: 'н',
  o: 'о', p: 'п', q: 'қ', r: 'р', s: 'с', t: 'т', u: 'у', v: 'в', w: 'в', x: 'х', y: 'й', z: 'з' };
const UNLI = new Set(['a', 'e', 'i', 'o', 'u']);
const TUTUQ = /['’‘ʻʼ`]/;
const YO = { a: 'я', o: 'ё', u: 'ю', e: 'е' };
// Ruschadan kirgan so'zlar kirillda boshqacha yoziladi.
const LUGAT = { yanvar: 'январь', fevral: 'февраль', aprel: 'апрель', iyun: 'июнь', iyul: 'июль', sentabr: 'сентябрь',
  oktabr: 'октябрь', noyabr: 'ноябрь', dekabr: 'декабрь' };

function soz(w) {
  const k = w.toLowerCase();
  let r = LUGAT[k];
  if (!r) {
    r = '';
    for (let i = 0; i < k.length; i++) {
      const c = k[i], n = k[i + 1] || '', t = TUTUQ.test(n);
      if (c === 'y' && YO[n] && !(n === 'o' && TUTUQ.test(k[i + 2] || ''))) { r += YO[n]; i++; continue; }
      if (c === 's' && n === 'h') { r += 'ш'; i++; continue; }
      if (c === 'c' && n === 'h') { r += 'ч'; i++; continue; }
      if (c === 'o' && t) { r += 'ў'; i++; continue; }
      if (c === 'g' && t) { r += 'ғ'; i++; continue; }
      if (TUTUQ.test(c)) { r += 'ъ'; continue; }
      if (c === 'e' && (i === 0 || UNLI.has(k[i - 1]))) { r += 'э'; continue; }
      r += HARF[c] || c;
    }
  }
  if (w.length > 1 && w === w.toUpperCase()) return r.toUpperCase();
  return w[0] !== k[0] ? r[0].toUpperCase() + r.slice(1) : r;
}

// Matndagi har lotin so'z (tutuq belgisi faqat harflar orasida: "so'm", lekin 'Keldi' qo'shtirnog'i emas).
export function kirill(matn) {
  return String(matn).replace(/[A-Za-z]+(?:['’‘ʻʼ`][A-Za-z]+)*/g, soz);
}

// Yozuv (26.10): shu telefonda, hamma panel uchun bitta tanlov. <html class="yozuv-kirill"> — kirill yoqilgan.
// Avval faqat oddiy rejimda edi (apteka-oddiy:<id>.kirill) — o'sha tanlov ham hisobga olinadi.
export const KIRILL = 'yozuv-kirill';
const YOZUV = 'apteka-yozuv';
export function yozuvKirillmi(id) {
  try {
    const v = localStorage.getItem(YOZUV);
    if (v) return v === 'kirill';
    return !!(id && JSON.parse(localStorage.getItem('apteka-oddiy:' + id) || '{}').kirill);
  } catch (e) { return false; }
}
export function yozuvQoy(kir) {
  try { localStorage.setItem(YOZUV, kir ? 'kirill' : 'lotin'); } catch (e) { /* yopiq xotira */ }
}

const ATTR = ['placeholder', 'aria-label', 'title'];
// Element ichidagi hamma matn va yorliqlarni kirillga o'tkazadi (qayta chaqirish zararsiz).
export function kirillDom(el) {
  if (!el || el.nodeType !== 1 && el.nodeType !== 3) return;
  if (el.nodeType === 3) {
    if (/[A-Za-z]/.test(el.data) && !(el.parentElement && el.parentElement.closest('[data-asl], script, style, textarea'))) el.data = kirill(el.data);
    return;
  }
  if (el.closest('[data-asl], script, style')) return;
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let t = w.nextNode(); t; t = w.nextNode()) {
    if (/[A-Za-z]/.test(t.data) && !(t.parentElement && t.parentElement.closest('[data-asl], script, style, textarea'))) t.data = kirill(t.data);
  }
  for (const e of [el, ...el.querySelectorAll('[placeholder], [aria-label], [title]')]) {
    if (e.closest('[data-asl]')) continue;
    for (const a of ATTR) { const v = e.getAttribute(a); if (v && /[A-Za-z]/.test(v)) e.setAttribute(a, kirill(v)); }
  }
}

// Oynalar (sheet) va xabarlar (toast) body'ga keyin qo'shiladi — ular ham kirillda bo'lsin.
// Faqat <html class="yozuv-kirill"> paytida ishlaydi; bir marta o'rnatiladi.
let kuzatuvchi = null;
export function kirillKuzat() {
  if (kuzatuvchi || typeof MutationObserver === 'undefined') return;
  kuzatuvchi = new MutationObserver((ozgarish) => {
    if (!document.documentElement.classList.contains(KIRILL)) return;
    for (const o of ozgarish) o.addedNodes.forEach(kirillDom);
  });
  kuzatuvchi.observe(document.body, { childList: true, subtree: true });
}
// Audit 09.11: ekran chizilgach kirillDom(root) o'zi o'tkazdi — kuzatuvchi navbatidagi shu qo'shilishlar qayta aylanmasin
// (ikki marta yurish). ichki ichidagi tugunlar tashlanadi; tashqaridagilari (oyna, xabar) — shu yerda o'tkaziladi.
export function kirillYut(ichki) {
  if (!kuzatuvchi) return;
  const yozuvlar = kuzatuvchi.takeRecords();
  if (!document.documentElement.classList.contains(KIRILL)) return;
  for (const o of yozuvlar) o.addedNodes.forEach((n) => { if (!(ichki && ichki.contains(n))) kirillDom(n); });
}
