// Reimbursatsiya puli (13.11, foydalanuvchi: "Mini App'da Reimbursatsiya bo'limi kerak — ichida qaysi dorilar berilgani, qanchadan,
// qanday narxda va jami reimbursatsiya puli qancha bo'lgani Excel'da yuklab olinadigan, ko'rinadigan bo'lsin"; kechroq: "reimbursatsiyada
// dorilarni solishtir — qaysi MNN'ga qaysi dorilar eng qimmat, tartibli ro'yxat"). Faqat direktor, faqat reimbursatsiya (oddiy
// retsept yozilmaydi — egasi qarori 13.11).
// Manba — DMED'ning o'z Excel'i: DMED → Рецепты → Реимбурсация → bir oylik sana → «Скачать Excel» → shu yerga. Fayl TELEFONDA o'qiladi
// (reimb-fayl.mjs): faqat dori ustunlari olinadi, serverga — retsept ID, sana, MNN, doza, savdo nomi, ishlab chiqaruvchi, soni, narx,
// summa (POST /reimb_yukla). Ekran: ko'rinish (Pul | Narxlar), davr; «Pul» — jami pul, kunma-kun grafik, dorilar (summa bo'yicha);
// «Narxlar» — MNN + doza bo'yicha savdo nomlari 1 dona narxi bilan (eng qimmat / eng arzon, farq), eng katta farqlar, qidiruv.
// Excel (telefonga yoki bot orqali). Sinov rejimida — uydirma namuna (amallar.mjs).
import * as H from './hisob.mjs';
import { h, kartaSarlavha, sheet } from './ui.mjs';
import { ikon } from './ikon.mjs';
import { telefongaMumkin, yuklashTugmalari } from './yuklash.mjs';
import { xlsxOqi } from './firma-prays.mjs';
import { REIMB_MAX, REIMB_TANA_MAX, reimbAjrat, reimbTana, qisqaNom } from './reimb-fayl.mjs';
import { reimbYuklaSinov } from './amallar.mjs';

const KORINISH = [['pul', 'Pul'], ['narx', 'Narxlar']];
const DAVR = [['bugun', 'Bugun'], ['hafta', '7 kun'], ['oy', 'Shu oy'], ['otgan', 'O\'tgan oy']];
const KORINADI = 30, GURUH_KORINADI = 20;
const YOL = 'DMED → Рецепты → Реимбурсация → bir oylik sanani tanlang → Скачать Excel → shu yerga yuklang';
const BOSH = { korinish: 'pul', davr: 'oy', kalit: '', natija: null, xato: null, yuklanmoqda: '', vaqt: 0, hammasi: false, qidir: '', guruhHammasi: false };
const R = { ...BOSH };
// Testlar uchun: holatni boshlang'ichga qaytarish.
export function reimbTozala() { Object.assign(R, BOSH); }

export function reimbDavr(davr, now = Date.now()) {
  const bugun = H.kunKey(now), oy = bugun.slice(0, 7);
  if (davr === 'bugun') return [bugun, bugun, 'Bugun'];
  if (davr === 'hafta') return [H.kunQosh(bugun, -6), bugun, '7 kun'];
  if (davr === 'otgan') { const o = H.oyQosh(oy, -1); return [o + '-01', H.oyOxirgiKun(o), 'O\'tgan oy']; }
  return [oy + '-01', bugun, 'Shu oy'];
}
const kunMatn = (k) => (typeof k === 'string' && /^\d{4}-\d{2}-\d{2}/.test(k) ? k.slice(8, 10) + '.' + k.slice(5, 7) + '.' + k.slice(0, 4) : '');
const kunQisqa = (k) => kunMatn(k).slice(0, 5);
const sonMatn = (n) => String(Math.round((Number(n) || 0) * 1000) / 1000).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const butun = (n) => String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
// 13 900 000 → «13,9 mln so'm»; kichigi — to'liq.
const qisqaSom = (n) => (Math.abs(Number(n) || 0) >= 1e6 ? String(Math.round(Number(n) / 1e5) / 10).replace('.', ',') + ' mln so\'m' : H.som(n));
// Ko'rinadigan qisqa summa + ekran o'quvchiga to'liq summa (aria-label oddiy span'da ishonchli o'qilmaydi).
// 1 dona narxi — tiyin bilan (2 xonagacha): 1 166,67 so'm.
export const narxSom = (n) => {
  const v = Math.round((Number(n) || 0) * 100) / 100, [b, k] = Math.abs(v).toFixed(2).split('.');
  return (v < 0 ? '−' : '') + b.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + (k === '00' ? '' : ',' + k.replace(/0$/, '')) + ' so\'m';
};
const summaMatn = (n, cls) => h('span', { class: cls }, h('span', { 'aria-hidden': 'true' }, qisqaSom(n)), h('span', { class: 'sr' }, H.som(n)));

// Ma'lumot: kalit — ko'rinish + davr. Kalit o'zgarsa eski natija darhol tozalanadi va eski so'rov javobi qabul qilinmaydi (L5).
function yukla(ctx) {
  const [dan, gacha] = reimbDavr(R.davr), kalit = R.korinish + ':' + dan + ':' + gacha;
  if (R.kalit === kalit && (R.yuklanmoqda === kalit || ((R.natija || R.xato) && Date.now() - R.vaqt < 60000))) return kalit;
  if (R.kalit !== kalit) R.natija = null;
  Object.assign(R, { kalit, xato: null, yuklanmoqda: kalit, vaqt: Date.now() });
  const nom = R.korinish === 'narx' ? 'reimbNarxlar' : 'reimbHisobot';
  Promise.resolve().then(() => ctx.oqi(nom, dan, gacha))
    .then((r) => { if (R.kalit === kalit) R.natija = r && typeof r === 'object' ? r : null; },
      (e) => { if (R.kalit === kalit) R.xato = (e && e.message) || 'Ochilmadi'; })
    .finally(() => { if (R.yuklanmoqda === kalit) R.yuklanmoqda = ''; if (R.kalit === kalit) ctx.rerender(); });
  return kalit;
}

// Segmentli tanlov (radiogroup): oq «tabletka» kulrang yo'lakda; strelkalar bilan ham.
function korinishTanlov(ctx) {
  const g = h('div', { class: 'rb-seg', role: 'radiogroup', 'aria-label': 'Ko\'rinish' });
  const tanla = (v) => {
    if (v === R.korinish) return;
    Object.assign(R, { korinish: v, hammasi: false, guruhHammasi: false });
    ctx.rerender();
    const b = document.querySelector('.rb-seg [aria-checked="true"]'); if (b) b.focus({ preventScroll: true });
  };
  KORINISH.forEach(([v, l], i) => g.append(h('button', { type: 'button', role: 'radio', 'aria-checked': String(v === R.korinish), tabindex: v === R.korinish ? '0' : '-1',
    onclick: () => tanla(v),
    onkeydown: (e) => {
      const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      tanla(KORINISH[(i + d + KORINISH.length) % KORINISH.length][0]);
    } }, l)));
  return g;
}
function davrTanlov(ctx) {
  return h('div', { class: 'rb-davr', role: 'group', 'aria-label': 'Davr' }, ...DAVR.map(([v, l]) => h('button', { type: 'button', 'aria-pressed': String(v === R.davr),
    onclick: () => { if (v === R.davr) return; Object.assign(R, { davr: v, hammasi: false, guruhHammasi: false }); ctx.rerender(); } }, l)));
}

const QADAMLAR = ['DMED → «Рецепты» → «Реимбурсация»', 'Bir oylik sanani tanlang → «Скачать Excel» (bir martada bir oy)', 'Faylni shu yerga yuklang (.xlsx)'];
const qadamlar = () => h('ol', { class: 'rb-qadam' }, ...QADAMLAR.map((q) => h('li', {}, q)));

// Kunma-kun grafik (4 kundan kam bo'lsa — yo'q): eng ko'p kun — urg'u rangida; ekran o'quvchiga — bitta xulosa.
function grafik(kunlar) {
  if (!Array.isArray(kunlar) || kunlar.length < 4) return null;
  const mx = Math.max(1, ...kunlar.map((k) => Number(k.summa) || 0));
  const eng = kunlar.reduce((a, k) => ((Number(k.summa) || 0) > (Number(a.summa) || 0) ? k : a), kunlar[0]);
  const izoh = kunlar.length + ' kun · eng ko\'p ' + kunMatn(eng.kun) + ': ' + H.som(eng.summa);
  const ustunlar = h('div', { class: 'rb-grafik', role: 'img', 'aria-label': 'Kunma-kun summa: ' + izoh });
  kunlar.forEach((k) => ustunlar.append(h('span', { class: 'rb-ustun' + (k === eng ? ' eng' : ''), 'aria-hidden': 'true',
    style: 'height:' + Math.max(3, Math.round((Number(k.summa) || 0) / mx * 100)) + '%' })));
  return h('div', { class: 'rb-grafik-k' }, ustunlar,
    h('div', { class: 'rb-grafik-iz', 'aria-hidden': 'true' }, h('span', {}, kunQisqa(kunlar[0].kun)),
      h('span', { class: 'rb-eng' }, 'Eng ko\'p: ' + kunQisqa(eng.kun) + ' · ' + qisqaSom(eng.summa)), h('span', {}, kunQisqa(kunlar[kunlar.length - 1].kun))));
}

function yangilikMatn(r) {
  const q = [];
  if (r && r.oxirgi_yuklash) q.push('Oxirgi yuklash: ' + r.oxirgi_yuklash);
  if (r && r.mavjud_davr) q.push('ma\'lumot ' + kunMatn(r.mavjud_davr.dan) + '–' + kunMatn(r.mavjud_davr.gacha) + ' oralig\'ida');
  return q.length ? h('p', { class: 'rb-yangilik' }, q.join(' · ')) : null;
}
const dozaMatn = (d) => [d.mnn, d.doza].filter(Boolean).join(' · ');
// Guruh nomi: MNN · doza; MNN bo'sh bo'lsa (solishtirilmaydi) — savdo nomi.
const guruhNom = (g) => (g.mnn ? dozaMatn(g) : qisqaNom(((g.dorilar || [])[0] || {}).savdo) + ' (MNN ko\'rsatilmagan)');

export function reimbView(m, ctx) {
  yukla(ctx);
  const [dan, gacha, davrNom] = reimbDavr(R.davr);
  m.append(korinishTanlov(ctx), davrTanlov(ctx));
  const yuklaTugma = (asosiy) => h('button', { type: 'button', class: (asosiy ? 'p' : 's rb-ikkinchi') + ' rb-tugma', onclick: () => yuklashOyna(ctx) },
    ikon('yukla'), 'DMED faylini yuklash');
  if (R.xato) {
    m.append(h('div', { class: 'msg warn', role: 'status' }, 'Hisobot ochilmadi: ' + R.xato + ' ',
      h('button', { type: 'button', class: 's', onclick: () => { R.kalit = ''; ctx.rerender(); } }, 'Qayta urinish')), yuklaTugma(false));
    return;
  }
  const r = R.natija;
  if (!r) { m.append(h('div', { class: 'card muted', role: 'status' }, 'Yuklanmoqda…')); return; }
  // Excel: Telegram 8.0+ — to'g'ridan telefonga; eski Telegram — bot orqali (faqat direktor; bemor ma'lumotisiz).
  const args = [dan, gacha];
  const tel = ctx.server && telefongaMumkin(ctx.tg);
  const amallar = (yangilik) => h('div', { class: 'rb-amallar' },
    ...yuklashTugmalari(ctx, { tur: 'reimb_excel', args, botga: () => ctx.amal('reimbExcel', ...args),
      telMatn: [ikon('yuklab'), 'Excel yuklab olish'], botMatn: tel ? 'Excel — Telegram\'ga yuborish' : [ikon('yuklab'), 'Excel yuklab olish (Telegram\'ga)'] }),
    yuklaTugma(false), yangilik);
  if (R.korinish === 'narx') { narxlarView(m, ctx, Array.isArray(r) ? r : [], davrNom, yuklaTugma, amallar); return; }

  // Hali hech narsa yuklanmagan — yo'riqnoma va bitta asosiy amal.
  if (!r.mavjud_davr) {
    m.append(h('section', { class: 'card rb-bosh', 'aria-label': 'Ma\'lumot yo\'q' },
      kartaSarlavha('Hali DMED fayli yuklanmagan'),
      h('p', { class: 'muted' }, 'Qaysi dori qancha berilgani va reimbursatsiya puli DMED\'ning o\'z faylidan olinadi. Uch qadam:'),
      qadamlar(), yuklaTugma(true)));
    return;
  }
  const jami = Number(r.jami_summa) || 0;
  const dorilar = Array.isArray(r.dorilar) ? r.dorilar : [];
  m.append(h('section', { class: 'card rb-jami', 'aria-label': 'Jami reimbursatsiya puli · ' + davrNom },
    h('div', { class: 'rb-jami-l' }, 'Jami reimbursatsiya puli · ' + davrNom),
    h('div', { class: 'rb-pul' }, h('span', {}, butun(jami)), h('small', {}, ' so\'m')),
    h('div', { class: 'muted rb-sana' }, kunMatn(dan) + (dan !== gacha ? ' — ' + kunMatn(gacha) : '')),
    h('div', { class: 'rb-plitka' },
      h('div', {}, h('b', {}, sonMatn(r.jami_soni)), h('span', {}, 'dona')),
      h('div', {}, h('b', {}, butun(r.retsept_soni)), h('span', {}, 'retsept')),
      h('div', {}, h('b', {}, butun(dorilar.length)), h('span', {}, 'xil dori'))),
    grafik(r.kunlar)));
  if (!jami && !dorilar.length) {
    m.append(h('div', { class: 'card muted' }, 'Bu davrda ma\'lumot yo\'q. Shu davr uchun DMED faylini yuklang yoki boshqa davrni tanlang.'));
  } else {
    const mx = Math.max(1, ...dorilar.map((d) => Number(d.summa) || 0));
    const kor = R.hammasi ? dorilar : dorilar.slice(0, KORINADI);
    const k = h('section', { class: 'card list rb-dorilar', 'aria-label': 'Dorilar' }, kartaSarlavha('Dorilar · ' + dorilar.length + ' xil'));
    kor.forEach((d) => k.append(h('div', { class: 'rb-dori' },
      h('div', { class: 'rb-q1' }, h('b', { 'data-asl': '' }, qisqaNom(d.savdo) || d.mnn || '—'), summaMatn(d.summa, 'rb-summa')),
      h('div', { class: 'rb-q2' }, h('span', { 'data-asl': '' }, [dozaMatn(d), d.ishlab].filter(Boolean).join(' · ')), h('span', { class: 'rb-dona' }, sonMatn(d.soni) + ' dona')),
      h('div', { class: 'rb-ulush', 'aria-hidden': 'true' }, h('i', { style: 'width:' + Math.max(1, Math.round((Number(d.summa) || 0) / mx * 100)) + '%' })))));
    if (dorilar.length > KORINADI && !R.hammasi) k.append(h('button', { type: 'button', class: 'link rb-yana', onclick: () => { R.hammasi = true; ctx.rerender(); } }, 'Hammasini ko\'rish (' + dorilar.length + ')'));
    m.append(k);
  }
  m.append(amallar(yangilikMatn(r)));
}

// ---------- Narxlar: MNN + doza bo'yicha savdo nomlari 1 dona reimbursatsiya narxi bilan ----------
// Belgi (api.mjs reimbBelgi bilan bir xil): guruhda 2+ nom va narxlar farq qilsa — eng katta narx «Eng qimmat», eng kichigi «Eng arzon».
export function narxBelgi(dorilar, d) {
  if (!Array.isArray(dorilar) || dorilar.length < 2) return '';
  const ns = dorilar.map((x) => Number(x.narx) || 0), mx = Math.max(...ns), mn = Math.min(...ns), n = Number(d.narx) || 0;
  if (!(mx > mn)) return '';
  return n === mx ? 'qimmat' : n === mn ? 'arzon' : '';
}
const chip = (b) => (b === 'qimmat' ? h('span', { class: 'rb-chip qimmat' }, h('span', { 'aria-hidden': 'true' }, '▲ '), 'Eng qimmat')
  : b === 'arzon' ? h('span', { class: 'rb-chip arzon' }, h('span', { 'aria-hidden': 'true' }, '▼ '), 'Eng arzon') : null);

function guruhKarta(g) {
  const ds = Array.isArray(g.dorilar) ? g.dorilar : [];
  const mx = ds.length ? Math.max(...ds.map((d) => Number(d.narx) || 0)) : 0;
  const farq = Number(g.farq) || 0;
  const s = h('section', { class: 'card rb-guruh' },
    h('h3', { class: 'rb-g-nom', 'data-asl': '' }, guruhNom(g)),
    h('p', { class: 'rb-g-meta' }, qisqaSom(g.summa) + ' · ' + ds.length + ' xil nom · ' + sonMatn(g.soni) + ' dona'));
  if (farq > 0) s.append(h('p', { class: 'rb-farq' }, 'Eng qimmat nom berilganda +' + H.som(farq) + ' (xarid narxi hisobga olinmagan)'));
  const ol = h('ol', { class: 'rb-nomlar', 'aria-label': 'Savdo nomlari, 1 dona narxi bo\'yicha (qimmatdan arzonga)' });
  ds.forEach((d) => {
    const n = Number(d.narx) || 0;
    ol.append(h('li', { class: 'rb-nom' },
      h('div', { class: 'rb-n1' }, h('b', { 'data-asl': '' }, qisqaNom(d.savdo)), chip(narxBelgi(ds, d)),
        h('span', { class: 'rb-narx' }, narxSom(n), h('small', {}, ' / dona'))),
      h('div', { class: 'rb-n2' }, h('span', { 'data-asl': '' }, [d.qadoq, d.ishlab].filter(Boolean).join(' · ')),
        n < mx ? h('span', { class: 'rb-kam' }, '−' + narxSom(mx - n) + ' / dona') : null),
      h('div', { class: 'rb-n2' }, h('span', {}, sonMatn(d.soni) + ' dona berildi'), summaMatn(d.summa, 'rb-n-summa'))));
  });
  s.append(ol);
  return s;
}

function narxlarView(m, ctx, gs, davrNom, yuklaTugma, amallar) {
  if (!gs.length) {
    m.append(h('section', { class: 'card rb-bosh', 'aria-label': 'Ma\'lumot yo\'q' },
      kartaSarlavha('Bu davrda ma\'lumot yo\'q'),
      h('p', { class: 'muted' }, 'Narxlarni solishtirish uchun shu davrning DMED faylini yuklang yoki boshqa davrni tanlang.'),
      qadamlar(), yuklaTugma(true)));
    return;
  }
  // Eng katta farqlar: eng qimmat nom berilganda qancha ko'p bo'lardi (8 ta guruh).
  const top = gs.filter((g) => Number(g.farq) > 0).sort((a, b) => b.farq - a.farq).slice(0, 8);
  if (top.length) {
    const jamiFarq = gs.reduce((a, g) => a + (Number(g.farq) || 0), 0);
    const k = h('section', { class: 'card list rb-farqlar', 'aria-label': 'Eng katta farqlar' },
      kartaSarlavha('Eng katta farqlar · ' + davrNom),
      h('p', { class: 'muted rb-izoh' }, 'Eng qimmat nom berilganda jami +' + H.som(jamiFarq) + ' bo\'lardi (xarid narxi hisobga olinmagan).'));
    top.forEach((g) => {
      const t = (g.dorilar || [])[0] || {};
      k.append(h('div', { class: 'rb-dori' },
        h('div', { class: 'rb-q1' }, h('b', { 'data-asl': '' }, guruhNom(g)), h('span', { class: 'rb-summa rb-plus' }, '+' + qisqaSom(g.farq))),
        h('div', { class: 'rb-q2' }, h('span', { 'data-asl': '' }, '→ ' + qisqaNom(t.savdo) + ' (' + narxSom(t.narx) + ' / dona)'))));
    });
    m.append(k);
  }
  // Qidiruv: faqat ro'yxat qayta chiziladi (maydondan fokus ketmaydi).
  const ruyxat = h('div', { class: 'rb-guruhlar' });
  const holat = h('p', { class: 'rb-topildi muted', role: 'status', 'aria-live': 'polite' });
  const chiz = () => {
    const q = R.qidir.trim().toLowerCase();
    const mos = q ? gs.filter((g) => [g.mnn, g.doza, ...(g.dorilar || []).flatMap((d) => [d.savdo, d.ishlab])].join(' ').toLowerCase().includes(q)) : gs;
    ruyxat.textContent = '';
    holat.textContent = q ? (mos.length ? mos.length + ' ta guruh topildi' : 'Hech narsa topilmadi — boshqa nom bilan qidiring') : '';
    const kor = q || R.guruhHammasi ? mos : mos.slice(0, GURUH_KORINADI);
    kor.forEach((g) => ruyxat.append(guruhKarta(g)));
    if (kor.length < mos.length) ruyxat.append(h('button', { type: 'button', class: 'link rb-yana', onclick: () => { R.guruhHammasi = true; chiz(); } }, 'Hammasini ko\'rish (' + mos.length + ')'));
  };
  const inp = h('input', { type: 'search', class: 'rb-qidir', placeholder: 'MNN yoki dori nomi', 'aria-label': 'MNN yoki dori nomi bo\'yicha qidirish', value: R.qidir,
    oninput: () => { R.qidir = inp.value; chiz(); } });
  m.append(h('h2', { class: 'rb-bolim' }, 'MNN bo\'yicha narxlar · ' + gs.length), h('label', { class: 'rb-qidir-k' }, ikon('qidir'), inp), holat, ruyxat);
  chiz();
  m.append(amallar(null));
}

// DMED faylini yuklash oynasi: yo'riqnoma → fayl → telefonda o'qish → ko'rib chiqish → yuklash.
export function yuklashOyna(ctx) {
  let band = false;
  sheet('DMED faylini yuklash', (box, close) => {
    const ich = h('div', { class: 'rb-oyna' });
    box.append(ich);
    let fayl = null, varaqlar = null;
    const holat = h('div', { class: 'rb-holat', role: 'status', 'aria-live': 'polite' });
    const faylMaydon = () => {
      const inp = h('input', { type: 'file', class: 'skan-fayl', accept: '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        onclick: (e) => { if (band) e.preventDefault(); else inp.value = ''; } });
      inp.addEventListener('change', () => { const f = inp.files && inp.files[0]; if (f && !band) oqi(f); });
      return h('label', { class: 'btn p rb-tugma rb-fayl-tanla' }, ikon('yukla'), 'Faylni tanlash', inp);
    };
    const bosh = () => {
      fayl = null; varaqlar = null;
      ich.textContent = '';
      holat.textContent = '';
      ich.append(h('p', { class: 'rb-yol' }, YOL),
        h('p', { class: 'muted' }, 'Bir martada bir oy (DMED katta davrni bermaydi). Fayl aptekadagi kompyuterda bo\'lsa — shu ilovani kompyuterdagi Telegram Desktop\'da oching yoki faylni o\'zingizga Telegram\'da yuborib, telefonda tanlang.'),
        faylMaydon(), holat);
    };
    const oqi = async (f) => {
      band = true;
      holat.textContent = 'O\'qilmoqda…';
      try {
        if (/\.xls$/i.test(f.name)) throw new Error('Bu eski .xls fayl — Excel\'da oching va «.xlsx» qilib saqlang, keyin qayta tanlang');
        if (f.size > 40e6) throw new Error('Fayl juda katta (40 MB dan ko\'p)');
        varaqlar = await xlsxOqi(new Uint8Array(await f.arrayBuffer()));
        fayl = f.name;
        korsat();
      } catch (e) { holat.textContent = (e && e.message) || 'Fayl o\'qilmadi'; } finally { band = false; }
    };
    // Ko'rib chiqish: fayl o'qildi → serverda SINOV (hech narsa yozilmaydi: nechta yangi, yangilanadi, o'chiriladi) → tasdiq.
    // O'chirish faqat: faylda noto'g'ri qator yo'q (otkazildi = 0) VA sinov o'chiriladigan qator ko'rsatgan VA direktor alohida
    // «Ha, … o'chirib yuklash» ni bosgan bo'lsa. Aks holda — faqat qo'shish va yangilash.
    const korsat = () => {
      let n;
      try { n = reimbAjrat(varaqlar); } catch (e) { holat.textContent = e.message; return; } finally { varaqlar = null; }   // xom fayl xotirada qolmasin
      ich.textContent = '';
      const davr = n.dan ? kunMatn(n.dan) + (n.gacha !== n.dan ? ' – ' + kunMatn(n.gacha) : '') : '';
      ich.append(h('div', { class: 'rb-fayl' }, h('b', { 'data-asl': '' }, fayl), h('span', { class: 'muted' }, n.soni + ' qator' + (davr ? ' · ' + davr : ''))));
      ich.append(h('div', { class: 'msg ok rb-himoya' }, ikon('qalqon'),
        h('span', {}, 'Faqat dori ustunlari o\'qildi — bemor, shifokor, farmatsevt, telefon, PINFL va tashxis serverga ketmaydi.')));
      const dl = h('dl', { class: 'rb-dl' }, h('dt', {}, 'Fayldagi qatorlar'), h('dd', {}, n.soni + ' ta'));
      if (davr) dl.append(h('dt', {}, 'Davr'), h('dd', {}, davr));
      dl.append(h('dt', {}, 'Jami summa'), h('dd', {}, H.som(n.jami)));
      if (n.oddiy) dl.append(h('dt', {}, 'Oddiy retsept'), h('dd', {}, n.oddiy + ' ta — o\'tkazildi'));
      if (n.otkazildi) dl.append(h('dt', {}, 'Noto\'g\'ri ID, sana yoki son'), h('dd', {}, n.otkazildi + ' ta — o\'tkazildi'));
      if (n.birlashdi) dl.append(h('dt', {}, 'Bir dori bir necha qatorda'), h('dd', {}, n.birlashdi + ' ta — qo\'shildi'));
      if (n.takrorVaraq) dl.append(h('dt', {}, 'Bir xil varaq'), h('dd', {}, n.takrorVaraq + ' ta — bir marta olindi'));
      ich.append(dl);
      const natija = h('div', { class: 'rb-oyna' });
      const xato = h('div', { class: 'rb-holat', role: 'status', 'aria-live': 'polite' });
      ich.append(natija, xato, h('button', { type: 'button', class: 'link rb-boshqa', onclick: () => { if (!band) bosh(); } }, 'Boshqa fayl tanlash'));
      if (!n.soni) { xato.textContent = 'Saqlanadigan reimbursatsiya qatori yo\'q.'; return; }
      const katta = 'Fayl juda katta — bir faylda bir oylik ma\'lumot yuklang (DMED\'da bir oyni tanlang).';
      if (n.soni > REIMB_MAX) { xato.textContent = katta; return; }
      const tana0 = reimbTana(n);
      if (JSON.stringify(tana0).length > REIMB_TANA_MAX) { xato.textContent = katta; return; }
      const ochirsaBoladi = n.otkazildi === 0;   // noto'g'ri qatorli fayl bilan bazadan hech narsa o'chirilmaydi
      const yubor = async (tasdiq, ochir) => {
        const tana = { ...tana0, tasdiq, ochir };
        if (!ctx.server) return reimbYuklaSinov(tana.qatorlar, { tasdiq, ochir });
        if (!ctx.firma || !ctx.firma.reimb) throw new Error('Faqat Telegram ilovasida yuklanadi');
        return ctx.firma.reimb(tana);
      };
      const saqla = async (ochir, tugmalar) => {
        if (band) return;
        band = true; tugmalar.forEach((b) => { b.disabled = true; }); xato.textContent = 'Saqlanmoqda…';
        try {
          const r = await yubor(true, ochir);
          ctx.toast('Saqlandi ✓ — yangi: ' + ((r && r.qoshildi) || 0) + ', yangilangan: ' + ((r && r.yangilandi) || 0)
            + (r && r.ochirildi ? ', o\'chirildi: ' + r.ochirildi : ''));
          band = false;
          close();
          R.kalit = ''; R.vaqt = 0;
          ctx.rerender();
        } catch (e) { xato.textContent = (e && e.message) || 'Saqlanmadi'; tugmalar.forEach((b) => { b.disabled = false; }); band = false; }
      };
      const ogoh = (matn) => h('div', { class: 'msg warn rb-ogoh', role: 'note' }, ikon('ogoh'), h('span', {}, matn));
      const sinov = async () => {
        band = true; natija.textContent = ''; xato.textContent = 'Bazadagi ma\'lumot bilan solishtirilmoqda…';
        let s;
        try { s = await yubor(false, ochirsaBoladi); } catch (e) {
          band = false;
          xato.textContent = (e && e.message) || 'Tekshirilmadi';
          natija.append(h('button', { type: 'button', class: 's', onclick: () => { if (!band) sinov(); } }, 'Qayta urinish'));
          return;
        }
        band = false; xato.textContent = '';
        const q = (s && s.qoshildi) || 0, y = (s && s.yangilandi) || 0, o = (s && s.ochiriladi) || 0, jami = (s && s.jami) || n.soni;
        natija.append(h('dl', { class: 'rb-dl rb-sinov' }, h('dt', {}, 'Yangi'), h('dd', {}, q + ' qator'), h('dt', {}, 'Yangilanadi'), h('dd', {}, y + ' qator'),
          h('dt', {}, 'O\'zgarmaydi'), h('dd', {}, Math.max(0, jami - q - y) + ' qator')));
        if (!ochirsaBoladi) {
          natija.append(ogoh('Faylda ' + n.otkazildi + ' ta noto\'g\'ri qator bor — ular o\'tkazildi va bazadan hech narsa o\'chirilmaydi (faqat qo\'shiladi va yangilanadi).'));
        }
        const asosiy = h('button', { type: 'button', class: 'p rb-tugma' }, n.soni + ' ta qatorni yuklash');
        if (!o) {
          asosiy.addEventListener('click', () => saqla(false, [asosiy]));
          natija.append(asosiy);
          return;
        }
        // O'chiriladigan qator bor: ogohlantirish + ikkinchi, alohida tasdiq.
        const oraliq = kunMatn(s.dan).slice(0, 5) + '–' + kunMatn(s.gacha).slice(0, 5);
        natija.append(ogoh('Bazadagi ' + o + ' qator (' + H.som(s.ochiriladi_summa) + ') ' + oraliq + ' oralig\'ida faylda yo\'q — o\'chiriladi. '
          + 'Faqat to\'liq (filtrsiz) oylik fayl yuklang.'));
        const tasdiqJoy = h('div', { class: 'rb-oyna rb-tasdiq' });
        asosiy.addEventListener('click', () => {
          if (band) return;
          asosiy.remove();
          const ha = h('button', { type: 'button', class: 'p rb-tugma rb-xavf' }, 'Ha, ' + o + ' qatorni o\'chirib yuklash');
          const yoq = h('button', { type: 'button', class: 's rb-tugma' }, 'O\'chirmasdan yuklash (faqat qo\'shish)');
          ha.addEventListener('click', () => saqla(true, [ha, yoq]));
          yoq.addEventListener('click', () => saqla(false, [ha, yoq]));
          tasdiqJoy.append(h('p', { class: 'rb-tasdiq-s' }, 'Rostdan ham ' + o + ' qator (' + H.som(s.ochiriladi_summa) + ') o\'chirilsinmi?'), ha, yoq);
          ha.focus({ preventScroll: true });
        });
        natija.append(asosiy, tasdiqJoy);
      };
      sinov();
    };
    bosh();
  }, { fokus: false, band: () => band });
}
