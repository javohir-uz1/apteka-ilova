// Mijoz qarzi (09.11; egasi: "xodim qarz yozgandan keyin QR chiqadi, mijoz skanerlab qarz va muddatni tasdiqlaydi; bo'lib
// to'lasa — qoldiq va yangi muddat, mijoz yana tasdiqlaydi; to'liq to'lasa — «qarzingiz to'landi»; xodim panelida pul alohida —
// «direktorga bering», direktor tasdiqlasa — «tasdiqlandi»"). Server: 20261109120000_mijoz_qarzi.sql, bot — qarz-bot.mjs.
//  - qrOyna       — bir martalik QR (15 daqiqa): mijoz skanerlaydi → raqamini yuboradi → «✅ Tasdiqlayman».
//  - tolovOyna    — xodim: mijoz qancha to'ladi; qisman bo'lsa — qolganini qachon to'laydi (3/7/14/30 kun).
//  - topshirKarta — xodim: «Qarz pullari — direktorga bering» va «✓ Direktor qabul qildi».
//  - qabulKarta   — direktor: har xodimdagi qarz puli, «Qabul qildim — seyfga».
import * as H from './hisob.mjs';
import { h, input, kartaSarlavha, pills, sana, sheet, tasdiqlash } from './ui.mjs';
import { qrSvg } from './mijoz.mjs';

const MUDDAT = [[3, '3 kun'], [7, '7 kun'], [14, '14 kun'], [30, '30 kun']];

// Mijoz tasdig'i holati (faqat ochiq qarzda). rang: ok | warn | xato | ''.
export function tasdiqHolati(q) {
  if (!q || q.holat !== 'ochiq') return null;
  if (q.tasdiq === 'tasdiqladi') return { matn: '✅ Mijoz botda tasdiqlagan', rang: 'ok' };
  if (q.tasdiq === 'rad') return { matn: '❌ Mijoz «Noto\'g\'ri» dedi — direktorga xabar berildi', rang: 'xato' };
  if (q.tasdiq === 'kutilmoqda') return { matn: '⏳ Mijozga tasdiqlash so\'rovi borgan — javobini kutyapmiz', rang: 'warn' };
  return { matn: 'Mijoz hali tasdiqlamagan — «QR ko\'rsatish» ni bosing', rang: '' };
}
// QR kerakmi: ochiq, mijoz hali tasdiqlamagan.
export const qrKerak = (q) => !!q && q.holat === 'ochiq' && q.tasdiq !== 'tasdiqladi';

// ctx: { amal, tg, toast }
export function qrOyna(ctx, q, urinish = 0) {
  return Promise.resolve(ctx.amal('qarzQr', q.id)).then((r) => {
    if (r && r.takror && !urinish) return qrOyna(ctx, q, 1);   // takror javobi — natijasiz, yana bir bor
    if (!r || typeof r !== 'object' || !r.kod) return;
    sheet('Mijoz tasdiqlasin', (box, close) => {
      box.append(h('div', { class: 'qm-kim' }, h('b', { 'data-asl': '' }, r.ism), h('span', {}, ' · ' + H.som(r.summa))));
      if (!r.havola) { box.append(h('div', { class: 'msg warn' }, 'Bot sozlanmagan — QR yaratib bo\'lmadi. Direktorga ayting.')); return; }
      box.append(h('ol', { class: 'qm-qadam' },
        h('li', {}, 'Mijoz telefon kamerasi bilan QR kodni skanerlasin — Telegram ochiladi, «Start» ni bossin.'),
        h('li', {}, '«📱 Raqamni yuborish» ni bossin. Raqami siz yozgan raqamga mos kelsa — qarz ma\'lumoti chiqadi.'),
        h('li', {}, '«✅ Tasdiqlayman» ni bossin.')));
      const joy = h('div', { class: 'mijoz-qr' }, h('div', { class: 'muted', role: 'status' }, 'QR tayyorlanmoqda…'));
      box.append(joy, h('div', { class: 'muted' }, 'QR ' + (r.daqiqa || 15) + ' daqiqa ishlaydi va bir marta. Mijoz tasdiqlagach — ro\'yxatda «✅ Mijoz botda tasdiqlagan» chiqadi.'));
      qrSvg(r.havola, { yorliq: 'Qarzni tasdiqlash uchun QR kod', sinf: 'mijoz-qr-svg' })
        .then((svg) => { joy.textContent = ''; joy.append(svg); }, () => { joy.textContent = 'QR chizilmadi — havolani mijozga yuboring.'; });
      const tg = ctx.tg;
      box.append(h('div', { class: 'row' },
        tg && tg.openTelegramLink ? h('button', { type: 'button', class: 's', onclick: () => tg.openTelegramLink('https://t.me/share/url?url=' + encodeURIComponent(r.havola)
          + '&text=' + encodeURIComponent('Qarzni tasdiqlash uchun bosing')) }, 'Havolani yuborish') : null,
        h('button', { type: 'button', class: 'p', onclick: close }, 'Tayyor')));
    }, { fokus: false });
  });
}

// ctx: { amalX, toast }. Pul xodimda qoladi — direktorga topshiriladi (kassaga qo'shilmaydi).
export function tolovOyna(ctx, q) {
  const qol = H.qarzQoldiq(q);
  sheet('To\'lov kiritish', (box, close) => {
    let kun = null, band = false;
    const s = input('Mijoz qancha to\'ladi, so\'m', { placeholder: H.som(qol) });
    const xulosa = h('div', { class: 'qm-xulosa', 'aria-live': 'polite' });
    const muddatX = h('span', { class: 'err', 'aria-live': 'polite' });
    const muddat = pills(MUDDAT, null, (v) => { kun = v; muddatX.textContent = ''; }, 'Qolganini qachon to\'laydi?');
    const muddatJoy = h('div', { class: 'qm-muddat' }, h('b', {}, 'Qolganini qachon to\'laydi?'), muddat, muddatX);
    const btn = h('button', { type: 'button', class: 'p' }, 'To\'lovni saqlash');
    const upd = () => {
      const v = H.pul(s.i.value);
      const ok = v != null && v > 0 && v <= qol;
      xulosa.textContent = !ok ? '' : v === qol ? 'Qarz to\'liq yopiladi ✓' : 'Qoladi: ' + H.som(qol - v);
      muddatJoy.hidden = !(ok && v < qol);
      btn.textContent = ok && v === qol ? 'To\'landi — saqlash' : 'To\'lovni saqlash';
    };
    s.i.addEventListener('input', upd);
    const hammasi = h('button', { type: 'button', class: 's sm', onclick: () => { s.qiymat(String(qol)); upd(); } }, 'Hammasini to\'ladi — ' + H.som(qol));
    btn.addEventListener('click', () => {
      if (band) return;
      const v = H.pul(s.i.value);
      if (!v || v <= 0) { s.xato('Summani yozing'); s.i.focus(); return; }
      if (v > qol) { s.xato('Qoldiqdan ko\'p — qoldiq ' + H.som(qol)); s.i.focus(); return; }
      if (v < qol && !kun) { muddatX.textContent = 'Qolganini qachon to\'lashini tanlang'; return; }
      band = true; btn.disabled = true;
      const joyla = (m) => { if (/muddat/i.test(m)) muddatX.textContent = m; else s.xato(m); return true; };
      Promise.resolve(ctx.amalX(joyla, 'qarzTolov', q.id, s.i.value, v < qol ? kun : null)).then((r) => {
        band = false; btn.disabled = false;
        if (!r) return;
        close();
        const toliq = r.toliq === true || v === qol;
        ctx.toast(toliq ? 'Qarz to\'landi ✓ Pulni direktorga bering' : 'To\'lov yozildi ✓ Qoldi: ' + H.som(typeof r.qoldiq === 'number' ? r.qoldiq : qol - v));
      });
    });
    box.append(h('div', { class: 'qm-kim' }, h('b', { 'data-asl': '' }, q.ism), h('span', {}, ' · qoldiq '), h('b', {}, H.som(qol))),
      s.el, hammasi, xulosa, muddatJoy,
      h('div', { class: 'msg info' }, 'Pulni kassaga qo\'shmang — alohida saqlang va direktorga bering.'
        + (q.chatBor && q.tasdiq !== 'rad' ? ' Mijozga botda «to\'g\'rimi?» xabari boradi.' : '')),
      btn);
    upd();
  });
}

// Xodim: qo'lidagi qarz pullari va oxirgi 7 kunda direktor qabul qilgani. ctx: { amal, toast }
export function topshirKarta(ctx, S, x, now = Date.now()) {
  const r = H.xodimdagiPullar(S.qarzlar, x.id);
  const qabul = (S.qarzlar || []).flatMap((q) => (q.pullar || []).filter((p) => p.xodimId === x.id && p.holat === 'qabul' && p.qabulTs > now - 7 * 864e5));
  if (!r.length && !qabul.length) return null;
  const k = h('section', { class: 'card qm-topshir' + (r.length ? ' warn' : ''), 'aria-label': 'Qarz pullari' });
  if (r.length) {
    const jami = r.reduce((a, z) => a + z.pul.summa, 0);
    k.append(kartaSarlavha('Qarz pullari — direktorga bering'),
      h('div', { class: 'qm-jami' }, h('b', {}, H.som(jami)), h('span', { class: 'muted' }, ' · ' + r.length + ' ta to\'lov')),
      h('div', { class: 'muted' }, 'Kassaga qo\'shmang. Direktor qabul qilgach — shu yerda «✓ Direktor qabul qildi» chiqadi.'));
    r.forEach(({ qarz, pul }) => k.append(h('div', { class: 'qm-qator' },
      h('span', {}, h('span', { 'data-asl': '' }, qarz.ism), ' · ' + sana(pul.ts)), h('b', {}, H.som(pul.summa)),
      h('button', { type: 'button', class: 'link', 'aria-label': 'Bekor qilish: ' + qarz.ism + ', ' + H.som(pul.summa),
        onclick: () => tasdiqlash(qarz.ism + ': ' + H.som(pul.summa) + ' to\'lov yozuvi bekor qilinsinmi? (xato kiritilgan bo\'lsa) Qoldiq yana oshadi.')
          .then((ha) => ha && ctx.amal('qarzPulBekor', pul.id)).then((n) => { if (n) ctx.toast('Bekor qilindi'); }) }, 'Bekor'))));
  }
  if (qabul.length) {
    k.append(h('div', { class: 'msg ok' }, '✓ Direktor qabul qildi: ' + H.som(qabul.reduce((a, p) => a + p.summa, 0)) + ' (' + qabul.length + ' ta to\'lov, oxirgi 7 kun)'));
  }
  return k;
}

// Direktor: qarz pullari kimda (xodim bo'yicha). [{ xodimId, jami, soni, qatorlar }]
export function xodimlardagiPul(S) {
  const g = new Map();
  H.xodimdagiPullar(S.qarzlar).forEach((z) => {
    const id = z.pul.xodimId;
    if (!g.has(id)) g.set(id, { xodimId: id, jami: 0, soni: 0, qatorlar: [] });
    const t = g.get(id);
    t.jami += z.pul.summa; t.soni += 1; t.qatorlar.push(z);
  });
  return [...g.values()];
}

// Direktor: bitta xodimning qarz pulini qabul qilish oynasi. ctx: { amal, toast }, ism — xodim ismi.
export function qabulOyna(ctx, t, ism, uyBor = false) {
  sheet('Qarz pullari — ' + ism, (box, close) => {
    let ham = 'kassa';
    box.append(h('div', { class: 'qm-jami' }, h('b', {}, H.som(t.jami)), h('span', { class: 'muted' }, ' · ' + t.soni + ' ta to\'lov')));
    const l = h('div', { class: 'card list' });
    t.qatorlar.forEach(({ qarz, pul }) => l.append(h('div', { class: 'qm-qator' },
      h('span', {}, h('span', { 'data-asl': '' }, qarz.ism), ' · ' + sana(pul.ts)
        + (pul.mijoz === 'tasdiqladi' ? ' · mijoz ✓' : pul.mijoz === 'rad' ? ' · ❗ mijoz «noto\'g\'ri» dedi' : '')),
      h('b', {}, H.som(pul.summa)))));
    box.append(l);
    if (uyBor) box.append(h('b', {}, 'Pulni qayerga qo\'yasiz?'), pills([['kassa', 'Seyf'], ['uy', 'Uy']], ham, (v) => { ham = v; }, 'Hamyon'));
    else box.append(h('div', { class: 'muted' }, 'Pul seyfga qo\'shiladi — har to\'lov daftarda alohida kirim (xato bo\'lsa — bekor qilsa bo\'ladi).'));
    if (t.qatorlar.some((z) => z.pul.mijoz === 'rad')) box.append(h('div', { class: 'msg warn' }, 'Mijoz bir to\'lovni «Noto\'g\'ri» degan — avval xodim bilan tekshiring.'));
    box.append(h('button', { type: 'button', class: 'p', onclick: () => Promise.resolve(ctx.amal('qarzPulQabul', t.xodimId, ham, String(t.jami))).then((r) => {   // ko'rgan summa — shu orada yangi to'lov yozilsa server rad etadi
      if (!r) return;
      close();
      ctx.toast('Qabul qilindi ✓ ' + H.som(r.summa != null ? r.summa : t.jami));
    }) }, '✓ Qabul qildim — ' + H.som(t.jami)));
  }, { fokus: false });
}

// Yozilgan qarz (server javobi id beradi; sinovda r.qarz; takrorda — telefon va summa bo'yicha eng yangisi).
export function yozilganQarz(r, S, xodimId, forma) {
  const l = (S && S.qarzlar) || [];
  const id = r && typeof r === 'object' ? (r.id || (r.qarz && r.qarz.id)) : null;
  if (id) return l.find((z) => z.id === id) || null;
  const tel = H.normTel(forma && forma.tel), summa = H.pul(forma && forma.summa);
  return l.filter((z) => z.xodimId === xodimId && H.normTel(z.tel) === tel && z.summa === summa)
    .sort((a, b) => (a.berildi || 0) - (b.berildi || 0)).pop() || null;
}

// Qarz saqlangandan keyin: mijoz oldin tasdiqlagan bo'lsa — so'rov botga o'zi ketdi (xabar); aks holda — QR (faqat serverda).
// ctx: { S: () => holat, x, amal, toast, tg, server }
export function yozilgandan(ctx, r, forma) {
  const q = yozilganQarz(r, ctx.S(), ctx.x.id, forma);
  if (!q || q.holat !== 'ochiq') return;
  if ((r && r.chatBor) || q.tasdiq === 'kutilmoqda') { ctx.toast('Qarz yozildi ✓ Mijozga botda tasdiqlash so\'rovi yuborildi', 'ok'); return; }
  if (ctx.server && qrKerak(q)) qrOyna(ctx, q);
}
