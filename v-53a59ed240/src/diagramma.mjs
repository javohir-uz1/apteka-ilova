// Doira (donut) diagramma (26.10): qism–butun bir qarashda — kirim (filiallar savdosi) va chiqim (oylik, ta'minotchilar, bank...).
// Ranglar — tekshirilgan kategorik palitra (dataviz: daltonizmda ham qo'shni ranglar farqi ΔE ≥ 9, oddiy ko'zda ≥ 19).
// Uchtasi oq kartada 3:1 dan och — shuning uchun har bo'lakning nomi, summasi va ulushi legendada yozilgan (rang yolg'iz emas).
// Rang bo'lakning o'ziga biriktirilgan (tartibiga emas): filial yoki chiqim turi doim bir xil rangda.
// Bo'lak yoki legenda qatori bosilsa (kompyuterda — sichqoncha ustiga kelsa) — markazda o'sha bo'lak summasi va ulushi.
import { h, kartaSarlavha } from './ui.mjs';

export const RANGLAR = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300'];
const NS = 'http://www.w3.org/2000/svg';
const R = 78, QALIN = 26, C = 2 * Math.PI * R;
const raqam = (n) => String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const foiz = (v, jami) => (jami ? (v / jami * 100 < 1 && v > 0 ? '<1' : String(Math.round(v / jami * 100))) : '0') + '%';

function svgEl(tag, attrs) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
}

// bolaklar: [{ nom, qiymat, rang, ichki?: [{ nom, qiymat }] }] — 0 lilari chizilmaydi, legendada ham yo'q.
// jamiNom — markazdagi yozuv ("Jami kirim"); bosh — hech narsa bo'lmaganda karta matni.
// tur — 'kirim' (yashil) yoki 'chiqim' (qizil): karta sarlavhasi va jami shu rangda (27.10); bo'laklar — palitra ranglari.
export function doira({ sarlavha, jamiNom, bolaklar, bosh, tur }) {
  const bor = bolaklar.filter((b) => b.qiymat > 0);
  const jami = bor.reduce((a, b) => a + b.qiymat, 0);
  const karta = h('section', { class: 'card doira-karta' + (tur ? ' ' + tur : ''), 'aria-label': sarlavha });
  karta.append(h('div', { class: 'line doira-bosh', style: 'border:0;padding:0;align-items:baseline' }, kartaSarlavha(sarlavha),
    h('b', { style: 'font-variant-numeric:tabular-nums;white-space:nowrap' }, raqam(jami) + ' so\'m')));
  if (!jami) { karta.append(h('div', { class: 'muted' }, bosh)); return karta; }

  // Bo'laklar: 12 soat yo'nalishidan soat mili bo'yicha; bo'laklar orasida 2 px oq tirqish (bitta bo'lakda — yo'q).
  const svg = svgEl('svg', { viewBox: '0 0 200 200', class: 'doira-svg', role: 'img',
    'aria-label': sarlavha + ': ' + bor.map((b) => b.nom + ' ' + foiz(b.qiymat, jami)).join(', ') });
  svg.append(svgEl('circle', { cx: 100, cy: 100, r: R, fill: 'none', stroke: 'var(--soft)', 'stroke-width': QALIN }));
  const tirqish = bor.length > 1 ? 2 : 0;
  let boshi = 0;
  const yoylar = bor.map((b) => {
    const uz = b.qiymat / jami * C;
    const yoy = svgEl('circle', { cx: 100, cy: 100, r: R, fill: 'none', stroke: b.rang, 'stroke-width': QALIN,
      'stroke-dasharray': Math.max(0.5, uz - tirqish) + ' ' + (C - Math.max(0.5, uz - tirqish)), 'stroke-dashoffset': -boshi,
      transform: 'rotate(-90 100 100)', class: 'doira-yoy' });
    boshi += uz;
    svg.append(yoy);
    return yoy;
  });
  const markazNom = h('span', { class: 'doira-m-nom' }, jamiNom);
  const markazSon = h('b', { class: 'doira-m-son' }, raqam(jami));
  const markazFoiz = h('span', { class: 'doira-m-foiz' }, 'so\'m');
  const markaz = h('div', { class: 'doira-markaz', 'aria-live': 'polite' }, markazNom, markazSon, markazFoiz);

  // Legenda — har bo'lak: rang belgisi, nomi, summasi, ulushi; ichki ro'yxat (masalan har ta'minotchi) — tagida chiziqcha bilan.
  const qatorlar = [];
  const legenda = h('div', { class: 'doira-legenda' });
  bor.forEach((b) => {
    const q = h('button', { type: 'button', class: 'doira-qator', 'aria-pressed': 'false' },
      h('span', { class: 'doira-belgi', style: 'background:' + b.rang, 'aria-hidden': 'true' }),
      h('span', { class: 'doira-nom' }, b.nom),
      h('b', { class: 'doira-summa' }, raqam(b.qiymat)),
      h('span', { class: 'doira-ulush' }, foiz(b.qiymat, jami)));
    qatorlar.push(q);
    legenda.append(q);
    (b.ichki || []).filter((x) => x.qiymat > 0).forEach((x) => legenda.append(h('div', { class: 'doira-ichki' },
      h('span', { class: 'doira-nom' }, x.nom),
      h('span', { class: 'doira-chiziq', 'aria-hidden': 'true' }, h('i', { style: 'width:' + Math.max(2, Math.round(x.qiymat / b.qiymat * 100)) + '%;background:' + b.rang })),
      h('b', { class: 'doira-summa' }, raqam(x.qiymat)))));
  });

  // Tanlash: markazda bo'lak, qolganlari xira. Yana bosilsa — jami.
  let tanlangan = -1;
  const korsat = (i) => {
    yoylar.forEach((y, j) => { y.setAttribute('stroke-width', j === i ? QALIN + 6 : QALIN); y.style.opacity = i < 0 || j === i ? '1' : '.35'; });
    qatorlar.forEach((q, j) => q.setAttribute('aria-pressed', String(j === i)));
    if (i < 0) { markazNom.textContent = jamiNom; markazSon.textContent = raqam(jami); markazFoiz.textContent = 'so\'m'; return; }
    markazNom.textContent = bor[i].nom; markazSon.textContent = raqam(bor[i].qiymat); markazFoiz.textContent = foiz(bor[i].qiymat, jami);
  };
  const tanla = (i) => { tanlangan = tanlangan === i ? -1 : i; korsat(tanlangan); };
  yoylar.forEach((y, i) => {
    y.addEventListener('click', () => tanla(i));
    y.addEventListener('mouseenter', () => korsat(i));
    y.addEventListener('mouseleave', () => korsat(tanlangan));
  });
  qatorlar.forEach((q, i) => {
    q.addEventListener('click', () => tanla(i));
    q.addEventListener('mouseenter', () => korsat(i));
    q.addEventListener('mouseleave', () => korsat(tanlangan));
  });
  karta.append(h('div', { class: 'doira-ichi' }, svg, markaz), legenda);
  return karta;
}
