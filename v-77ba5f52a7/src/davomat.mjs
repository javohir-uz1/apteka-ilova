// Davomat (29.10, 20261029130000_davomat.sql; foydalanuvchi: "smenani ochish-yopishni olib tashla — xodimlar keldi-kelmadi
// davomatini direktor panelidan bajaradigan bo'lsin"). Direktor har kuni har xodimga «Keldi» / «Kelmadi» belgilaydi
// (qayta bosilsa — belgi olib tashlanadi); xodim o'zinikini Bosh va Oylik bo'limida ko'radi (o'zgartira olmaydi).
// Ma'lumot ilova holatida emas — oy bo'yicha alohida o'qiladi (davomat_oy) va shu telefonda 1 daqiqa saqlanadi.
import * as H from './hisob.mjs';
import { h, kartaSarlavha, kunNomi, ochiladi, sana } from './ui.mjs';

// oy → { data, vaqt, xato }; yuk — so'rov ketyapti; kun — direktor tanlagan kun (kunVaqt — qachon); yozuv — belgilashlar soni.
const K = { oy: {}, yuk: {}, kun: null, kunVaqt: 0, yozuv: 0 };

// Oy davomati: keshdan (1 daqiqa), bo'lmasa so'raladi va kelgach ekran qayta chiziladi. Hali yo'q bo'lsa — null.
export function davomatOl(ctx, oy) {
  const c = K.oy[oy];
  if ((!c || Date.now() - c.vaqt > 60000) && !K.yuk[oy]) {
    K.yuk[oy] = true;
    const n = K.yozuv;
    ctx.oqi('davomatOy', oy)
      // So'rov ketayotganda belgi qo'yilgan bo'lsa — eski javob ekrandagi belgini o'chirmasin: qayta so'raladi.
      .then((d) => { K.oy[oy] = n === K.yozuv ? { data: d, vaqt: Date.now() } : { ...(K.oy[oy] || { data: d }), vaqt: 0 }; })
      .catch(() => { K.oy[oy] = { data: c ? c.data : null, vaqt: Date.now(), xato: true }; })
      .finally(() => { K.yuk[oy] = false; ctx.rerender(); });
  }
  return c ? c.data : null;
}

const sanoq = (z, v) => Object.values(z.kunlar || {}).filter((x) => x === v).length;
const kunSana = (kun) => new Date(kun + 'T12:00:00+05:00');

// Bosh ekran uchun: bugun nechta faol xodim belgilanmagan (ma'lumot hali kelmagan bo'lsa — null).
export function davomatBugun(ctx) {
  const bugun = H.kunKey(Date.now());
  const d = davomatOl(ctx, bugun.slice(0, 7));
  if (!d) return null;
  const list = d.xodimlar.filter((z) => z.faol);
  return { jami: list.length, belgilanmagan: list.filter((z) => z.kunlar[bugun] === undefined).length };
}

// Xodim: bugungi va shu oydagi o'z davomati.
export function menDavomat(ctx) {
  const bugun = H.kunKey(Date.now());
  const d = davomatOl(ctx, bugun.slice(0, 7));
  const z = d && d.xodimlar[0];
  if (!z && K.oy[bugun.slice(0, 7)] && K.oy[bugun.slice(0, 7)].xato) return { xato: true };
  return z ? { bugun: z.kunlar[bugun], keldi: sanoq(z, true), kelmadi: sanoq(z, false), kelmaganKunlar: Object.keys(z.kunlar).filter((k) => z.kunlar[k] === false).sort() } : null;
}

// Direktor: Bo'limlar → Davomat.
export function davomatView(m, ctx, S) {
  const bugun = H.kunKey(Date.now());
  // Tanlangan kun 10 daqiqadan keyin bugunga qaytadi (ilova kechasi ochiq qolsa — ertalab kechagi kun ochilmasin).
  if (!K.kun || K.kun > bugun || Date.now() - K.kunVaqt > 600000) K.kun = bugun;
  const kun = K.kun, oy = kun.slice(0, 7);
  const kunga = (n) => { K.kun = H.kunQosh(kun, n); K.kunVaqt = Date.now(); ctx.rerender(); };
  m.append(h('div', { class: 'card davomat-kun' },
    h('button', { type: 'button', 'aria-label': 'Oldingi kun', onclick: () => kunga(-1) }, '‹'),
    h('div', { class: 'davomat-sana' }, h('b', {}, kun === bugun ? 'Bugun' : kunNomi(kunSana(kun))), h('span', { class: 'muted' }, sana(kunSana(kun)))),
    h('button', { type: 'button', 'aria-label': 'Keyingi kun', disabled: kun >= bugun, onclick: () => kunga(1) }, '›')));
  const d = davomatOl(ctx, oy);
  if (!d) {
    m.append(K.oy[oy] && K.oy[oy].xato ? h('div', { class: 'card warn', role: 'alert' }, 'Davomat olinmadi — internetni tekshirib, qayta oching.')
      : h('div', { class: 'card muted', 'aria-live': 'polite' }, 'Yuklanmoqda…'));
    return;
  }
  const list = d.xodimlar.filter((z) => z.faol || z.kunlar[kun] !== undefined);
  if (!list.length) { m.append(h('div', { class: 'card muted' }, 'Xodimlar yo\'q. Sozlamalar → Xodimlar bo\'limida qo\'shing.')); return; }
  const keldi = list.filter((z) => z.kunlar[kun] === true).length, kelmadi = list.filter((z) => z.kunlar[kun] === false).length;
  const yoq = list.filter((z) => z.kunlar[kun] === undefined);
  m.append(h('div', { class: 'grid2 davomat-jami' },
    h('div', { class: 'kp-tile kirim' }, h('span', {}, 'Keldi'), h('b', {}, String(keldi))),
    h('div', { class: 'kp-tile chiqim' }, h('span', {}, 'Kelmadi'), h('b', {}, String(kelmadi)))));
  // Belgilash: bosilgan holat qayta bosilsa — belgi olib tashlanadi (xato bosilgan bo'lsa).
  const belgila = (z, v) => {
    const yangi = z.kunlar[kun] === v ? null : v;
    K.yozuv += 1;
    return ctx.amal('davomatBelgila', z.id, kun, yangi).then((ok) => {
      if (ok === null) return false;
      // Keshdagi hozirgi yozuvga (eski obyektga emas) qo'yiladi.
      const joriy = ((K.oy[oy] && K.oy[oy].data) || d).xodimlar.find((q) => q.id === z.id) || z;
      if (yangi === null) delete joriy.kunlar[kun]; else joriy.kunlar[kun] = yangi;
      ctx.rerender();
      return true;
    });
  };
  if (yoq.length) {
    m.append(h('div', { class: 'msg info' }, yoq.length + ' ta xodim belgilanmagan.'),
      h('button', { class: 'p', onclick: async () => { for (const z of yoq) { if (!(await belgila(z, true))) break; } } },
        'Belgilanmaganlarning hammasi «Keldi»'));
  }
  const filialNomi = (id) => ((S.filiallar || []).find((f) => f.id === id) || { nom: id }).nom;
  const filiallar = [...new Set(list.map((z) => z.filial))];
  for (const f of filiallar) {
    m.append(h('div', { class: 'card davomat-list' }, kartaSarlavha(filialNomi(f)),
      ...list.filter((z) => z.filial === f).map((z) => {
        const v = z.kunlar[kun];
        return h('div', { class: 'davomat-qator' },
          h('span', { class: 'davomat-ism' }, z.ism, v === undefined ? h('small', {}, 'belgilanmagan') : null),
          h('div', { class: 'davomat-tug', role: 'group', 'aria-label': z.ism },
            h('button', { type: 'button', class: 'dv-ha', 'aria-pressed': String(v === true), onclick: () => belgila(z, true) }, 'Keldi'),
            h('button', { type: 'button', class: 'dv-yoq', 'aria-pressed': String(v === false), onclick: () => belgila(z, false) }, 'Kelmadi')));
      })));
  }
  // Oy bo'yicha jami (tanlangan kunning oyi).
  m.append(ochiladi('Oy bo\'yicha — ' + oy, h('div', { class: 'card list' },
    ...d.xodimlar.map((z) => h('div', { class: 'line' }, h('span', {}, z.ism + ' · ' + filialNomi(z.filial)),
      h('b', {}, sanoq(z, true) + ' kun keldi' + (sanoq(z, false) ? ' · ' + sanoq(z, false) + ' kelmadi' : ''))))), { k: 'davomat-oy' }));
}
