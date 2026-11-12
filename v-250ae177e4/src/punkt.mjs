// Punkt paneli: punkt o'zi yuborgan ro'yxatlar holatini ko'radi (7 kun) va bemorni qo'lda kiritadi.
import { h, input, kartaSarlavha, kunNomi, ochiladi, qiymatlar, sana, vaqt, xatoJoyla, yordam, yozuvTugma } from './ui.mjs';
import * as H from './hisob.mjs';

const HOLAT = { navbat: ['Aptekada, navbatda', 'var(--muted)'], berildi: ['Tayyor ✓ — olib ketishingiz mumkin', 'var(--accent)'],
  ochilmadi: ['Ochilmadi', 'var(--warn)'], olindi: ['Olib ketildi', 'var(--info)'] };
// Aptekadagi kompyuter QR retsept bo'yicha bergan bemor (C4) — server belgisi (punkt_holat 'qr', 20261110170000_audit_retsept).
// 04.11 dan QR bemorda JSHSHIR va kod ham saqlanadi — «JSHSHIR va kod yo'q» belgisidan tanib bo'lmaydi.
const qrBemor = (z) => z.qr === true;
const KOD_KOP = 5;
let keyingi = false;   // bemor qo'shildi — yangi formada ism maydoniga fokus (keyingi bemor uchun)

// Raqam maydoni: telefonda faqat raqamlar klaviaturasi (inputmode numeric), harf va boshqa belgi kirmaydi.
// kerak — nechta raqam bo'lishi kerak; formatla(raqamlar) — maydonda ko'rinishi (ortiqchasi kesiladi).
export function raqamMaydon(label, kerak, formatla, attrs = {}) {
  const f = input(label, { pul: false, pattern: '[0-9]*', enterkeyhint: 'next', ...attrs });
  if (f.i.value) f.i.value = formatla(H.raqamlar(f.i.value).slice(0, kerak));   // saqlangan qiymat (ekran qayta chizilgan)
  const holat = h('span', { class: 'hint', 'aria-live': 'polite' });
  const upd = () => {
    const d = H.raqamlar(f.i.value).slice(0, kerak);
    const toza = formatla(d);
    if (f.i.value !== toza) f.i.value = toza;
    holat.textContent = d.length ? d.length + ' / ' + kerak + ' raqam' + (d.length === kerak ? ' ✓' : '') : '';
  };
  f.i.addEventListener('input', upd);
  f.el.insertBefore(holat, f.el.lastChild);
  upd();
  return f;
}

function qoldaForma(ctx) {
  // k — ilovaga qaytganda yoki ekran yangilanganda yozilgan qiymatlar o'chmasin (yuborilgach — bo'sh forma).
  const ism = input('Bemorning ism-familiyasi', { inputmode: 'text', autocapitalize: 'words', enterkeyhint: 'next', placeholder: 'Masalan: Karimova Dilnoza', maxlength: '100', k: 'punkt-ism' });
  const jsh = raqamMaydon('JSHSHIR (14 raqam)', 14, (d) => d, { placeholder: '14 ta raqam', k: 'punkt-jshshir' });
  const kodlar = [];
  const kodBox = h('div', {});
  const yanaKod = h('button', { class: 's', type: 'button', onclick: () => { kodQosh(); kodlar[kodlar.length - 1].i.focus(); } }, '+ Yana himoya kodi');
  const kodQosh = () => {
    const k = raqamMaydon(kodlar.length ? (kodlar.length + 1) + '-himoya kodi' : 'Himoya kodi (6 raqam)', 6, H.kodKorinish, { placeholder: '123-456', k: 'punkt-kod-' + kodlar.length });
    kodlar.push(k);
    kodBox.append(k.el);
    yanaKod.hidden = kodlar.length >= KOD_KOP;
  };
  kodQosh();
  while (kodlar.length < KOD_KOP && qiymatlar.has('punkt-kod-' + kodlar.length)) kodQosh();   // oldin qo'shilgan kod maydonlari
  const yubor = async () => {
    const f = { ism: ism.i.value, jshshir: jsh.i.value, kodlar: kodlar.map((k) => k.i.value) };
    const x = H.punktBemorXato(f) || {};
    const juft = [[ism, x.ism], [jsh, x.jshshir], ...kodlar.map((k, i) => [k, x['kod' + i]])];
    juft.forEach(([m, t]) => m.xato(t || ''));
    const birinchi = juft.find(([, t]) => t);
    if (birinchi) { birinchi[0].i.focus(); return; }
    keyingi = true;
    const joyla = xatoJoyla([[ism, /ism/i], [jsh, /JSHSHIR/i], [kodlar[0], /kod/i]]);
    const n = await ctx.amalX(joyla, 'punktBemor', f);
    if (n === null) { keyingi = false; return; }   // xato — forma qiymatlari joyida qoladi
    ctx.toast((typeof n === 'number' ? n + ') ' : '') + String(f.ism).trim() + ' — aptekaga yuborildi ✓');
  };
  ism.i.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); jsh.i.focus(); } });
  jsh.i.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); kodlar[0].i.focus(); } });
  kodBox.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); yubor(); } });
  const card = h('div', { class: 'card' }, kartaSarlavha('Bemorni qo\'lda kiritish'),
    h('div', { class: 'muted' }, 'Har bemor alohida. Kod bir nechta bo\'lsa — "+ Yana himoya kodi".'),
    ism.el, jsh.el, kodBox, yanaKod, h('button', { class: 'p', type: 'button', onclick: yubor }, 'Aptekaga yuborish'));
  if (keyingi) { keyingi = false; setTimeout(() => ism.i.focus(), 0); }
  return card;
}

export function renderPunkt(root, ctx, p) {
  const apteka = ctx.S.apteka || 'Apteka';
  if (ctx.logout) root.append(h('div', { class: 'demo' }, 'Sinov rejimi · ', h('button', { class: 's', onclick: ctx.logout }, 'boshqa xodim')));
  root.append(h('header', { class: 'top' }, h('span', { class: 'avatar', 'aria-hidden': 'true' }, p.nom[0]),
    h('div', { class: 't' }, h('h1', {}, p.nom), h('span', {}, 'Punkt · ' + apteka + ' · ' + kunNomi())), yozuvTugma(ctx.rerender, p.id)));
  const m = h('main', {});
  root.append(m);
  const b = p.bemorlar || [];
  const c = (x) => b.filter((z) => z.holat === x).length;
  m.append(h('div', { class: 'card hero' }, h('div', { class: 'line', style: 'border:0' }, h('span', { class: 'muted' }, 'Tayyor — olib keting'), h('b', { class: 'big' }, String(c('berildi')))),
    h('div', { class: 'muted' }, 'Navbatda ' + c('navbat') + ' · ochilmadi ' + c('ochilmadi') + ' · olib ketildi ' + c('olindi') + (p.rasmlar ? ' · ' + p.rasmlar + ' ta rasm ko\'rilmoqda' : ''))));
  if (ctx.amal) m.append(qoldaForma(ctx));
  m.append(yordam('Botga (shu chatga) yuboring: matn — har bemor: ism, JSHSHIR (14 raqam), himoya kodi (masalan 123-456); '
    + 'rasm — retseptlarni terib rasmga oling (QR kod ko\'rinsin); yoki retseptlarni aptekaga o\'zingiz olib keling. '
    + 'Tayyor bo\'lganda Telegram\'ga xabar keladi. Ma\'lumotlar 7 kundan keyin o\'chiriladi.', 'Boshqa yo\'l bilan yuborish'));
  // Kun bo'yicha: eng oxirgi kun ochiq, oldingilari yopiq (bosilsa ochiladi).
  const kunlar = new Map();
  b.forEach((z) => { const k = sana(z.ts); if (!kunlar.has(k)) kunlar.set(k, []); kunlar.get(k).push(z); });
  if (!b.length) m.append(h('div', { class: 'card muted' }, 'So\'nggi 7 kunda ro\'yxat yo\'q.'));
  [...kunlar.entries()].reverse().forEach(([k, list], i) => m.append(ochiladi(k + ' · ' + list.length + ' bemor', h('div', { class: 'list' },
    ...list.map((z) => {
      const [l, col] = HOLAT[z.holat] || [z.holat, 'var(--muted)'];
      return h('div', { class: 'item' }, h('div', { class: 'line', style: 'border:0;padding:0' }, h('span', { style: 'font-weight:600' }, z.n + ') ', z.ism ? h('span', { 'data-asl': '' }, z.ism) : 'Ismsiz'), h('span', { style: 'color:' + col + ';text-align:right;font-weight:600' }, l)),
        h('span', { class: 'muted' }, (qrBemor(z) ? 'QR retsept bo\'yicha berildi' + (z.jshshir ? ' · ' + z.jshshir : '') : (z.jshshir || 'JSHSHIR yo\'q') + ' · ' + (z.kodlar || 0) + ' ta kod')
          + (z.holatTs ? ' · ' + vaqt(z.holatTs) : '') + (z.sabab ? ' · ' + z.sabab : '')),
        z.xato && z.xato.length ? h('span', { style: 'color:var(--warn);font-size:13px;font-weight:600' }, 'Xato: ' + z.xato.join(', ') + ' — to\'g\'risini qayta yuboring') : null);
    })), { k: 'punkt-kun-' + k, ochiq: i === 0, cls: 'karta list',
    izoh: 'Tayyor ' + list.filter((z) => z.holat === 'berildi').length + ' · navbatda ' + list.filter((z) => z.holat === 'navbat').length })));
}
