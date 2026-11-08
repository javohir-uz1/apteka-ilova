// Ikonkalar (07.11, yangi ko'rinish — variant A): 24×24, chiziq 2 px, uchlari yumaloq — Tabler Icons uslubida.
// Shakllar shu loyiha uchun qayta chizilgan; ba'zilari Tabler Icons'dagi shaklga tayanadi:
// Tabler Icons — MIT litsenziyasi, © 2020-2024 Paweł Kuna, https://github.com/tabler/tabler-icons
// Faqat path'lar (matn/HTML yo'q — CSP va XSS xavfsiz): { a: asosiy shakl, i: asosiy ichidagi chiziqlar, t: tashqi chiziqlar }.
// To'ldirilgan ko'rinish (pastki menyuda tanlangan bo'lim): asosiy shakl rang bilan to'ladi, ichki chiziqlar oq bo'lib qoladi.
const SVG = 'http://www.w3.org/2000/svg';
const doira = (cx, cy, r) => 'M' + (cx - r) + ' ' + cy + 'a' + r + ' ' + r + ' 0 1 0 ' + 2 * r + ' 0a' + r + ' ' + r + ' 0 1 0 ' + -2 * r + ' 0';

export const IKON = {
  // ---- Pastki menyu ----
  bugun: { a: ['M4 10.5 12 4l8 6.5V19a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z'], i: ['M10 21v-4.5a2 2 0 0 1 4 0V21'] },
  pul: { a: ['M5 6h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z'], i: [doira(12, 12, 2.5), 'M6.5 12h.01M17.5 12h.01'] },
  ombor: { a: ['M12 3l8 4.5v9L12 21l-8-4.5v-9z'], i: ['M4 7.5l8 4.5 8-4.5M12 12v9'] },
  xodimlar: { a: [doira(9, 7.5, 3.5), 'M3 20v-.5A5.5 5.5 0 0 1 8.5 14h1a5.5 5.5 0 0 1 5.5 5.5v.5z'], t: ['M16 4.2a3.5 3.5 0 0 1 0 6.6', 'M21 20v-.5a5.5 5.5 0 0 0-3.2-5'] },
  // ---- Umumiy ----
  qidir: { a: [doira(10.5, 10.5, 6.5)], t: ['M20 20l-4.6-4.6'] },
  skan: { t: ['M4 8V6a2 2 0 0 1 2-2h2', 'M16 4h2a2 2 0 0 1 2 2v2', 'M20 16v2a2 2 0 0 1-2 2h-2', 'M8 20H6a2 2 0 0 1-2-2v-2', 'M8 9v6M11 9v6M14 9v6M16.5 9v6'] },
  oldinga: { t: ['M9 6l6 6-6 6'] },
  orqaga: { t: ['M15 6l-6 6 6 6'] },
  check: { t: ['M5 12.5l4.5 4.5L19 7.5'] },
  ogoh: { a: ['M10.4 3.9 2.6 17.5A1.9 1.9 0 0 0 4.2 20.4h15.6a1.9 1.9 0 0 0 1.6-2.9L13.6 3.9a1.9 1.9 0 0 0-3.2 0z'], i: ['M12 9v4.5M12 17h.01'] },
  // ---- Pul ----
  savdo: { a: [doira(12, 12, 9)], i: ['M8 12h8M12 8v8'] },
  xarajat: { a: ['M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16l-2.3-1.5L14.3 21 12 19.5 9.7 21l-2.4-1.5z'], i: ['M9 8h6M9 12h6M9 16h3'] },
  qarz: { a: ['M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z'], i: ['M3 10h18M7 15h3'] },
  buyurtma: { t: ['M3 4h2l2.3 10.2a1 1 0 0 0 1 .8h8.6a1 1 0 0 0 1-.8L19.5 8H6.2', doira(9.5, 19, 1.5), doira(17, 19, 1.5)] },
  daftar: { a: ['M6 3h11a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6z'], i: ['M9 3v18', 'M12.5 8h3M12.5 12h3'] },
  soat: { a: [doira(12, 12, 9)], i: ['M12 7v5l3 2'] },
  hamyon: { t: ['M17 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0 0 4h12a2 2 0 0 1 2 2v2.5', 'M20 16.5V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6', 'M20.5 12.5v4h-4a2 2 0 0 1 0-4z'] },
  tamin: { t: ['M3 6.5h10.5V17H3z', 'M13.5 9.5h4l3.5 4V17h-7.5', doira(7, 17.5, 2), doira(17, 17.5, 2)] },
  mijoz: { a: [doira(12, 7.5, 4)], t: ['M5.5 21v-1.5a4.5 4.5 0 0 1 4.5-4.5h4a4.5 4.5 0 0 1 4.5 4.5V21'] },
  oylik: { a: [doira(12, 12, 9)], i: ['M14.8 9.2a2 2 0 0 0-1.8-1.2h-2a2 2 0 0 0 0 4h2a2 2 0 0 1 0 4h-2a2 2 0 0 1-1.8-1.2', 'M12 6.5v11'] },
  diagramma: { t: ['M10 3.2A9 9 0 1 0 20.8 14a1 1 0 0 0-1-1H13a2 2 0 0 1-2-2V4.2a1 1 0 0 0-1-1z', 'M15 3.5A9 9 0 0 1 20.5 9H16a1 1 0 0 1-1-1z'] },
  stat: { t: ['M4 13h3.5v7H4zM10.25 4h3.5v16h-3.5zM16.5 9H20v11h-3.5z'] },
  nazorat: { a: ['M12 3a12 12 0 0 0 8.5 3A12 12 0 0 1 12 21 12 12 0 0 1 3.5 6 12 12 0 0 0 12 3z'], i: ['M9 12l2 2 4-4'] },
  kassa: { t: ['M3 7h18M6 4L3 7l3 3', 'M21 17H3M18 14l3 3-3 3'] },
  bank: { t: ['M3 21h18M3 10h18M5 6.5 12 3l7 3.5', 'M5 10v11M19 10v11M9 14v3M12 14v3M15 14v3'] },
  // ---- Dorilar ----
  defektura: { a: ['M8.5 4.5H7a2.5 2.5 0 0 0-2.5 2.5v11.5A2.5 2.5 0 0 0 7 21h10a2.5 2.5 0 0 0 2.5-2.5V7A2.5 2.5 0 0 0 17 4.5h-1.5'], t: ['M9 3h6v3H9z'], i: ['M9 11h6M9 15h4'] },
  aqlli: { t: ['M9 18h6M10 21h4', 'M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1.1 2.2h5c.1-1 .5-1.7 1.1-2.2A6 6 0 0 0 12 3z'] },
  dori: { a: ['M4.5 12.5l8-8a4.95 4.95 0 0 1 7 7l-8 8a4.95 4.95 0 0 1-7-7z'], i: ['M8.5 8.5l7 7'] },
  kochirish: { t: ['M7 10h13l-4-4', 'M17 14H4l4 4'] },
  inventar: { t: ['M3.5 5.5 5 7l2.5-2.5', 'M3.5 11.5 5 13l2.5-2.5', 'M3.5 17.5 5 19l2.5-2.5', 'M11 6h9M11 12h9M11 18h9'] },
  narx: { a: ['M3 6v5.2a2 2 0 0 0 .6 1.4l7.7 7.7a2.4 2.4 0 0 0 3.4 0l5.6-5.6a2.4 2.4 0 0 0 0-3.4l-7.7-7.7A2 2 0 0 0 11.2 3H6a3 3 0 0 0-3 3z'], i: [doira(7.5, 7.5, 1)] },
  firma: { t: ['M3 21h18', 'M3 7v1a3 3 0 0 0 6 0V7m0 1a3 3 0 0 0 6 0V7m0 1a3 3 0 0 0 6 0V7H3l2-4h14l2 4', 'M5 21V10.9M19 21V10.9', 'M9 21v-4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v4'] },
  prays: { a: ['M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z'], i: ['M9 9h1M9 13h6M9 17h6'], t: ['M14 3v4a1 1 0 0 0 1 1h4'] },
  shtrix: { t: ['M4 7V6a2 2 0 0 1 2-2h2', 'M4 17v1a2 2 0 0 0 2 2h2', 'M16 4h2a2 2 0 0 1 2 2v1', 'M16 20h2a2 2 0 0 0 2-2v-1', 'M5 11h1v2H5zM10 11v2M14 11h1v2h-1zM19 11v2'] },
  retsept: { a: ['M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z'], i: ['M9.5 14h5M12 11.5v5'], t: ['M14 3v4a1 1 0 0 0 1 1h4'] },
  punkt: { a: ['M17.7 16.7l-4.3 4.2a2 2 0 0 1-2.8 0l-4.3-4.2a8 8 0 1 1 11.4 0z'], i: [doira(12, 11, 3)] },
  keldi: { t: ['M12 3l8 4.5v4', 'M12 3 4 7.5v9L12 21', 'M4 7.5l8 4.5 8-4.5M12 12v9', 'M15 19l2 2 4-4'] },
  // ---- Xodimlar ----
  davomat: { t: ['M11.5 21H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v6', 'M16 3v4M8 3v4M4 11h16', 'M15 19l2 2 4-4'] },
  qarzYoz: { a: [doira(10, 7.5, 4)], t: ['M4 21v-1.5A4.5 4.5 0 0 1 8.5 15h3', 'M16 19h6M19 16v6'] },
  oyin: { t: ['M8 21h8M12 17v4M7 4h10', 'M17 4v8a5 5 0 0 1-10 0V4', doira(5, 9, 2), doira(19, 9, 2)] },
  xulosa: { a: ['M12 3h.4a7.5 7.5 0 0 0 7.9 12.4A9 9 0 1 1 12 3z'] },
  xabar: { a: ['M18 4a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3h-5l-5 3v-3H6a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3z'], i: ['M8 9h8M8 13h6'] },
  sozlama: { t: ['M4 6h8M16 6h4M4 12h2M10 12h10M4 18h11M19 18h1', 'M14 4v4M8 10v4M17 16v4'] },
  korinish: { t: ['M3 7V5h13v2', 'M9.5 5v14M7.5 19h4', 'M14 13v-1h7v1', 'M17.5 12v7M16 19h3'] },
  men: { a: [doira(12, 12, 9)], i: [doira(12, 10, 3), 'M6.2 18.3A4 4 0 0 1 10 16h4a4 4 0 0 1 3.8 2.3'] },
  oddiy: { t: ['M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z'] }
};

// Ikonka (svg). tol — to'ldirilgan ko'rinish (CSS .tol: asosiy shakl rangli, ichki chiziqlar oq).
export function ikon(nom, { tol = false } = {}) {
  const s = document.createElementNS(SVG, 'svg');
  s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor');
  s.setAttribute('stroke-width', '2'); s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round');
  s.setAttribute('aria-hidden', 'true'); s.setAttribute('focusable', 'false');
  s.setAttribute('class', 'ikon' + (tol ? ' tol' : ''));
  const ik = IKON[nom] || IKON.oldinga;
  for (const [tur, yollar] of [['a', ik.a], ['t', ik.t], ['i', ik.i]]) {
    (yollar || []).forEach((d) => {
      const p = document.createElementNS(SVG, 'path');
      p.setAttribute('d', d);
      p.setAttribute('class', 'ik-' + tur);
      s.append(p);
    });
  }
  return s;
}
