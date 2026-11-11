// Shtrix-kodlar (28.10): shprits, sistema, analgin kabi mayda dorilar — xodim ro'yxatdan tanlaydi, ekranda shtrix-kod chiqadi,
// kassadagi skaner telefon ekranidan o'qiydi (Oson Apteka'ga qo'lda yozilmaydi). Direktor faqat raqamni yozadi — chizig'ini
// ilova o'zi chizadi: 13 raqamli to'g'ri EAN-13 bo'lsa — EAN-13, boshqasi — Code 128.
import { h, input, kartaSarlavha, sheet, tasdiqlash, xatoJoyla } from './ui.mjs';

// ---- Kodlash — shtrix-kod.mjs (sof funksiyalar; server narx yorlig'i ham shuni ishlatadi) ----
import { shtrixBit, shtrixYol, SHTRIX_CHET } from './shtrix-kod.mjs';
export { eanTogrimi, ean13, code128, code128Qiymat, C128_NAQSH, shtrixBit } from './shtrix-kod.mjs';

// Ekranga: oq fon, ikki chetda bo'sh joy (skaner chegarani topsin), chiziqlar aniq (crispEdges).
// Bitta modul — butun piksel (28.10: kasr kenglikda ba'zi chiziqlar 2, ba'zilari 3 piksel bo'lib, skaner bir kodni o'qib,
// boshqasini o'qimadi): ekranga sig'adigan eng katta butun son, kamida 2 px.
export function shtrixRasm(kod) {
  const bit = shtrixBit(kod);
  const chet = SHTRIX_CHET, w = bit.length + chet * 2;
  const ekran = Math.min(typeof window !== 'undefined' && window.innerWidth ? window.innerWidth : 375, 560) - 40;
  const px = Math.max(2, Math.floor(ekran / w));
  const yol = shtrixYol(bit, chet);
  const d = h('div', { class: 'shtrix-rasm', role: 'img', 'aria-label': 'Shtrix-kod ' + kod, 'data-asl': '' });
  d.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + ' 1" preserveAspectRatio="none" shape-rendering="crispEdges" style="width:' + (w * px) + 'px">'
    + '<rect width="' + w + '" height="1" fill="#FFFFFF"/><path d="' + yol + '" fill="#000000"/></svg>';
  return d;
}

// ---- Ro'yxat ----

const tartibla = (a, b) => String(a).localeCompare(String(b), 'en', { numeric: true, sensitivity: 'base' });
// [{ guruh, turlar: [{id, nom, kod}] }] — guruh nomi va turlari tabiiy tartibda (2 ml, 5 ml, 10 ml).
export function shtrixGuruhlar(list) {
  const m = new Map();
  (list || []).forEach((s) => {
    const k = s.guruh.toLowerCase();
    if (!m.has(k)) m.set(k, { guruh: s.guruh, turlar: [] });
    m.get(k).turlar.push(s);
  });
  return [...m.values()].sort((a, b) => tartibla(a.guruh, b.guruh))
    .map((g) => ({ ...g, turlar: g.turlar.sort((a, b) => tartibla(a.nom, b.nom)) }));
}

// Oson bilan bog'liqligi (12.11, 20261112020000_kateter_shtrix.sql): server har kodga «oson» — Oson qoldig'ida shu kodli dori
// nomini beradi. osonBor (S.osonShtrix) — Oson shtrix-kodlari umuman kelganmi; kelmagan bo'lsa (eski kengaytma, sinov) — jim.
// null — hech narsa; { ok: true, nom } — Oson taniydi; { ok: false } — Oson'da bu kod yo'q (kassa skaneri topmaydi).
export function shtrixOsonHolat(s, osonBor) {
  if (s && s.oson) return { ok: true, nom: s.oson };
  return osonBor ? { ok: false } : null;
}

// Kod Oson'da yo'q — xodimga qidirish yo'li: Oson'da nom ko'pincha boshqacha davom etadi («KD-Fix катетер внутривенный р.14G»),
// shuning uchun birinchi so'z bilan qidirib, qolganini (o'lcham) ro'yxatdan tanlash aytiladi (audit 12.11).
export function osonQidirIzoh(nom) {
  const [bosh, ...qolgan] = String(nom).trim().split(/\s+/);
  return h('div', { class: 'shtrix-oson ogoh', role: 'note' }, 'Bu kod Oson\'ga hali qo\'shilmagan — skaner topmasa, Oson\'da «',
    h('b', { 'data-asl': '' }, bosh), '» deb qidiring', qolgan.length ? [' va «', h('b', { 'data-asl': '' }, qolgan.join(' ')), '»ni tanlang'] : null, '.');
}

// Guruh oynasi: turlari ro'yxati → bosilsa shtrix-kod, tagida «Orqaga» (ro'yxat yana chiqadi).
// Bitta turi bo'lsa (masalan, Analgin) — darhol shtrix-kod.
export function shtrixOyna(g, boshTur = null, osonBor = false) {
  sheet(g.guruh, (box) => {
    const ich = h('div', { style: 'display:flex;flex-direction:column;gap:10px' });
    const yagona = g.turlar.length === 1;
    const royxat = () => {
      ich.textContent = '';
      ich.append(h('div', { class: 'muted' }, 'Turini tanlang — shtrix-kod chiqadi'),
        h('div', { class: 'shtrix-turlar' }, ...g.turlar.map((s) => h('button', { type: 'button', class: 'shtrix-tugma', 'data-asl': '', onclick: () => kod(s) }, s.nom || g.guruh))));
    };
    const kod = (s) => {
      ich.textContent = '';
      const oh = shtrixOsonHolat(s, osonBor);
      // Oddiy DOM append null'ni «null» matni qilib qo'yadi (12.11 topildi: bitta turli guruhda ham chiqardi) — avval filtrlanadi.
      ich.append(...[h('div', { class: 'shtrix-nomi', 'data-asl': '' }, g.guruh + (s.nom ? ' · ' + s.nom : '')),
        shtrixRasm(s.kod),
        h('div', { class: 'shtrix-raqam', 'data-asl': '' }, s.kod),
        h('div', { class: 'muted', style: 'text-align:center' }, 'Ekranni skanerga tuting. O\'qimasa — telefon yorug\'ligini oshiring.'),
        oh && oh.ok ? h('div', { class: 'shtrix-oson' }, 'Oson\'da: ', h('b', { 'data-asl': '' }, oh.nom)) : null,
        oh && !oh.ok ? osonQidirIzoh(s.nom || g.guruh) : null,
        yagona ? null : h('button', { type: 'button', class: 'p', onclick: royxat }, '‹ Orqaga — ro\'yxat')].filter(Boolean));
    };
    box.append(ich);
    if (boshTur) kod(boshTur); else if (yagona) kod(g.turlar[0]); else royxat();
  }, { fokus: false });
}

// Xodimning asosiy ekrani: guruh tugmalari (Shprits, Sistema, …). Ro'yxat bo'sh bo'lsa — hech narsa.
export function shtrixKarta(S) {
  const gs = shtrixGuruhlar(S.shtrixlar);
  if (!gs.length) return null;
  return h('div', { class: 'card' }, kartaSarlavha('Shtrix-kodlar'),
    h('div', { class: 'shtrix-turlar' }, ...gs.map((g) => h('button', { type: 'button', class: 'shtrix-tugma', onclick: () => shtrixOyna(g, null, !!S.osonShtrix) }, g.guruh))));
}

// Xodim yangi ko'rinishi (11.11, sodda Bosh; 12.11 — katta tugma): «Shtrix-kodlar» — oynada guruhlar (Ампула, Катетер, Шприц);
// bittasi bo'lsa — darhol uning oynasi.
export const shtrixBormi = (S) => shtrixGuruhlar(S.shtrixlar).length > 0;
// Katta tugma izohi: guruh nomlari (ekranga sig'maganini CSS «…» bilan qisqartiradi).
export const shtrixIzoh = (S) => shtrixGuruhlar(S.shtrixlar).map((g) => g.guruh).join(' · ');
export function shtrixRoyxatOyna(S) {
  const gs = shtrixGuruhlar(S.shtrixlar);
  const osonBor = !!S.osonShtrix;
  if (!gs.length) return;
  if (gs.length === 1) { shtrixOyna(gs[0], null, osonBor); return; }
  sheet('Shtrix-kodlar', (box, close) => {
    box.append(h('div', { class: 'muted' }, 'Nomini tanlang — shtrix-kod chiqadi'),
      h('div', { class: 'shtrix-turlar' }, ...gs.map((g) => h('button', { type: 'button', class: 'shtrix-tugma', onclick: () => { close(); shtrixOyna(g, null, osonBor); } }, g.guruh))));
  }, { fokus: false });
}

// Direktor: qo'shish (nomi, turi, raqami) va ro'yxat (ko'rish, o'chirish).
let tanlanganGuruh = '';
export function shtrixDirektor(m, ctx) {
  const { S } = ctx;
  const gs = shtrixGuruhlar(S.shtrixlar);
  const guruh = input('Nomi', { inputmode: 'text', placeholder: 'Masalan: Shprits', k: 'shtrix-guruh', autocapitalize: 'sentences' });
  if (tanlanganGuruh && !guruh.i.value) guruh.qiymat(tanlanganGuruh);
  const tur = input('Turi (bo\'lmasa — bo\'sh qoldiring)', { inputmode: 'text', placeholder: 'Masalan: 5 ml', k: 'shtrix-tur' });
  const kod = input('Shtrix-kod raqami', { inputmode: 'numeric', placeholder: 'Qutidagi shtrix ostidagi raqamlar', pul: false, k: 'shtrix-kod' });
  const qosh = () => {
    const g = guruh.i.value.trim(), t = tur.i.value.trim(), k = kod.i.value.replace(/\s/g, '');
    if (!g) { guruh.xato('Nomini yozing (masalan: Shprits)'); guruh.i.focus(); return; }
    if (!/^[!-~]{1,40}$/.test(k)) { kod.xato('Shtrix-kod raqamlarini yozing'); kod.i.focus(); return; }
    const bor = (S.shtrixlar || []).find((s) => s.guruh.toLowerCase() === g.toLowerCase() && s.nom.toLowerCase() === t.toLowerCase());
    // Keyingi turi uchun nomi qoladi: forma qiymatlari saqlangach unutiladi va ekran qayta chiziladi — nom shu yerdan olinadi.
    const ish = () => { tanlanganGuruh = g; return ctx.amalX(xatoJoyla([[guruh, /nom/i], [tur, /tur/i], [kod, /kod|raqam/i]]), 'shtrixQosh', g, t, k).then((ok) => {
      if (!ok) return;
      ctx.toast(bor ? 'Shtrix-kod yangilandi ✓' : 'Qo\'shildi ✓');
    }); };
    if (bor && bor.kod !== k) tasdiqlash(g + (t ? ' · ' + t : '') + ' bor (' + bor.kod + '). Kodi ' + k + ' ga almashtirilsinmi?').then((ha) => ha && ish());
    else ish();
  };
  m.append(h('div', { class: 'card' }, kartaSarlavha('Yangi shtrix-kod'),
    h('div', { class: 'muted' }, 'Xodimlar asosiy ekranda «Shtrix-kodlar» tugmasini bosadi → nomini → turini tanlaydi → shtrix-kod chiqadi va skanerga tutadi. Hamma filialda bir xil. Faqat raqamni yozing — chizig\'ini ilova o\'zi chizadi.'),
    gs.length ? h('div', { class: 'pills', role: 'group', 'aria-label': 'Bor nomlar' }, ...gs.map((g) => h('button', { type: 'button', class: 'pill',
      onclick: () => { guruh.qiymat(g.guruh); guruh.xato(''); tur.i.focus(); } }, g.guruh))) : null,
    guruh.el, tur.el, kod.el,
    h('button', { class: 'p', 'data-klav': 'qoldir', onclick: qosh }, 'Qo\'shish')));
  if (!gs.length) { m.append(h('div', { class: 'card muted' }, 'Hali shtrix-kod yo\'q. Masalan: nomi «Shprits», turi «5 ml», raqami — qutidagi shtrix ostidagi raqamlar.')); return; }
  gs.forEach((g) => {
    m.append(h('div', { class: 'card list' }, kartaSarlavha(g.guruh + ' · ' + g.turlar.length + ' ta'),
      ...g.turlar.map((s) => { const oh = shtrixOsonHolat(s, !!S.osonShtrix); return h('div', { class: 'item' },
        h('div', { class: 'line', style: 'border:0;padding:0' }, h('span', s.nom ? { 'data-asl': '' } : {}, s.nom || '(turisiz)'), h('b', { 'data-asl': '' }, s.kod)),
        oh ? h('div', { class: 'shtrix-oson' + (oh.ok ? '' : ' ogoh') }, oh.ok ? ['✓ Oson\'da: ', h('span', { 'data-asl': '' }, oh.nom)]
          : '⚠ Oson\'da bu kod yo\'q — Oson\'dagi dori kartasiga shu kodni qo\'shing, aks holda kassa skaneri topmaydi') : null,
        h('div', { class: 'row' },
          h('button', { class: 's', onclick: () => shtrixOyna(g, s, !!S.osonShtrix) }, 'Ko\'rish'),
          h('button', { class: 's ogoh', onclick: () => tasdiqlash(g.guruh + (s.nom ? ' · ' + s.nom : '') + ' o\'chirilsinmi?')
            .then((ha) => ha && ctx.amal('shtrixOchir', s.id).then((ok) => ok && ctx.toast('O\'chirildi'))) }, 'O\'chirish'))); })));
  });
}
