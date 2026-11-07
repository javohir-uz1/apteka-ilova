// Ta'minotchi ekrani: o'z hisobi (apteka qancha qarz), apteka yozgan yozuvlarni tasdiqlash yoki e'tiroz, o'zi xarid yozish.
// Ta'minotchi pul qaysi hamyondan berilganini, kim yozganini va bekor qilish sababini ko'rmaydi (server bermaydi).
// Audit 04.11: e'tiroz yozuvda saqlanadi va ko'rinadi; tasdiqlangan yozuvga ham e'tiroz; ulanmasdan oldingi yozuvlar alohida belgi;
// «To'g'ri» — tasdiq bilan; nomlar va izohlar Кирилл'ga o'tmaydi (data-asl).
import * as H from './hisob.mjs';
import { h, input, kartaSarlavha, kunNomi, sana, sheet, tasdiqlash, xatoJoyla, yordam, yozuvTugma } from './ui.mjs';
import { xaridSheet } from './direktor.mjs';
import { hisobKarta, qisqaSana } from './taminot-hisob.mjs';

// 07.11: xarid — olib kelgan kuni (qachon dori berdingiz), to'lov — yozilgan kuni.
const ks = (a) => (a.tur === 'xarid' ? qisqaSana(H.taSana(a)) : sana(a.ts));
let soni = 20, soniKim = null;   // tarixda nechta yozuv ko'rinadi ("Yana ko'rsatish" ko'paytiradi) — har ta'minotchiga alohida

// Ta'minotchi o'zi yozganmi (server: ozi; sinov: kim === null).
export const oziYozgan = (a) => !!a.ozi || a.kim === null;
// Yozuv nomi ta'minotchi tomonidan: xarid — u dori bergan, to'lov — u pul olgan.
const nima = (a) => (a.tur === 'xarid' ? 'Dori berdingiz' : 'Pul oldingiz');

// Tarixdagi holat matni va rangi (ta'minotchi tomonidan).
export function taHolat(a) {
  if (a.bekor) return ['Bekor qilingan', 'var(--muted)'];
  if (oziYozgan(a)) return a.holat === 'ular' ? ['Siz yozdingiz — apteka tasdig\'i kutilmoqda', 'var(--info)'] : ['Siz yozdingiz — apteka tasdiqlagan ✓', 'var(--accent)'];
  if (a.holat === 'kutish') return a.etiroz ? ['E\'tiroz bildirgansiz — direktor ko\'rib chiqadi', 'var(--warn)'] : ['Tasdiqlashingiz kutilmoqda', 'var(--warn)'];
  if (a.avto) return ['Siz ilovaga ulanmasdan oldin yozilgan', 'var(--muted)'];
  return ['Ikkala tomon tasdiqlagan ✓', 'var(--accent)'];
}

export function renderTaminotchi(root, ctx, t) {
  if (soniKim !== t.id) { soni = 20; soniKim = t.id; }
  if (ctx.logout) root.append(h('div', { class: 'demo' }, 'Sinov rejimi · ', h('button', { class: 's', onclick: ctx.logout }, 'boshqa xodim')));
  // Ta'minotchi bizni apteka nomi bilan ko'radi (Sozlamalar → Apteka nomi).
  const apteka = ctx.S.apteka || (ctx.S.sozlama && ctx.S.sozlama.aptekaNomi) || 'Apteka';
  root.append(h('header', { class: 'top' }, h('span', { class: 'avatar', 'aria-hidden': 'true' }, apteka[0]),
    h('div', { class: 't' }, h('h1', { 'data-asl': '' }, apteka), h('span', {}, h('span', { 'data-asl': '' }, t.nom), ' · ta\'minotchi · ' + kunNomi())), yozuvTugma(ctx.rerender, t.id)));
  const m = h('main', {});
  root.append(m);

  const ular = H.ularBoyicha(t), biz = H.bizBoyicha(t);
  m.append(h('div', { class: 'card hero' }, h('div', { class: 'line', style: 'border:0' },
    h('span', { class: 'muted' }, ular >= 0 ? [h('span', { 'data-asl': '' }, apteka), ' sizga qarz'] : ['Siz ', h('span', { 'data-asl': '' }, apteka), 'ga qarzdorsiz (ortiqcha to\'langan)']),
    h('b', { class: 'big' }, H.som(Math.abs(ular)))),
    h('div', { class: 'muted' }, ular === biz ? 'Apteka hisobi bilan mos ✓' : 'Apteka hisobida: ' + H.som(biz) + ' — farq siz hali tasdiqlamagan yoki apteka hali tasdiqlamagan yozuvlardan')));

  const kutish = t.amallar.filter((a) => a.holat === 'kutish' && !a.bekor && !oziYozgan(a));
  kutish.forEach((a) => m.append(h('div', { class: 'card warn' },
    kartaSarlavha([h('span', { 'data-asl': '' }, apteka), ' yozdi: ' + nima(a).toLowerCase() + ' ' + H.som(a.summa)]),
    h('div', {}, ks(a) + ' · ', h('span', { 'data-asl': '' }, a.izoh)),
    qatorlar(a),
    a.etiroz ? etirozMatn(a) : null,
    h('div', { class: 'row' }, h('button', { class: 'p s', onclick: () => togri(ctx, a) }, 'To\'g\'ri'),
      h('button', { class: 's', onclick: () => etirozSheet(ctx, a) }, a.etiroz ? 'E\'tirozni o\'zgartirish' : 'Noto\'g\'ri')))));

  m.append(h('button', { class: 'p', onclick: () => xaridSheet(ctx, t, (s, iz, rows, j, kun) => ctx.amalX(j, 'taXarid', s, iz, rows, kun), 'Yangi xarid (dori berdim)') }, '+ Xarid yozish (dori berdim)'));
  // 07.11 (maket C): «Qarz qanday chiqdi» — direktor panelidagi bilan bir xil karta, o'z tomonidan so'zlar bilan; Excel — Telegram'ga.
  m.append(hisobKarta(t, 'ta', { onYozuv: (a) => tarixSheet(ctx, a),
    excel: ctx.server ? () => ctx.amal('taExcel').then((r) => { if (r) ctx.toast('Excel Telegram\'ga yuborildi ✓'); }) : null }));
  m.append(yordam('Siz yozgan xarid apteka tasdiqlagach qarzga qo\'shiladi. Apteka yozgan har yozuvni tekshirib "To\'g\'ri" ni bosing; xato bo\'lsa — "Noto\'g\'ri" va sababini yozing. Avval tasdiqlagan yozuvingiz xato chiqsa — Tarixda ustiga bosib "Noto\'g\'ri" ni tanlang.'));

  const list = h('div', { class: 'card list' }, kartaSarlavha('Tarix'));
  if (t.boshlangichQarz) list.append(h('div', { class: 'line' }, h('span', {}, 'Boshlang\'ich qarz (apteka yozgan)'), h('b', {}, H.som(t.boshlangichQarz))));
  // Har yozuv — bitta qator; dori ro'yxati va «Noto'g'ri» bosilganda oynada.
  const hammasi = t.amallar.slice().reverse();
  hammasi.slice(0, soni).forEach((a) => {
    const [matn, rang] = taHolat(a);
    list.append(h('button', { type: 'button', class: 'yozuv', onclick: () => tarixSheet(ctx, a) },
      h('div', { class: 'line', style: 'border:0;padding:0' }, h('span', { style: a.bekor ? 'text-decoration:line-through' : '' }, nima(a) + ' · ', h('span', { 'data-asl': '' }, a.izoh)),
        h('b', { style: a.bekor ? 'text-decoration:line-through' : '' }, (a.tur === 'xarid' ? '+' : '−') + H.som(a.summa))),
      h('div', { class: 'muted' }, ks(a) + ' · ', h('span', { style: 'color:' + rang + ';font-weight:600' }, matn),
        a.qatorlar && a.qatorlar.length ? ' · ' + a.qatorlar.length + ' xil dori' : null)));
  });
  if (hammasi.length > soni) list.append(h('button', { class: 's', onclick: () => { soni += 30; ctx.rerender(); } }, 'Yana ko\'rsatish (' + (hammasi.length - soni) + ' ta)'));
  if (!t.amallar.length && !t.boshlangichQarz) list.append(h('div', { class: 'muted' }, 'Hali yozuv yo\'q'));
  m.append(list);
}

const qatorlar = (a) => (a.qatorlar || []).map((q, i) => h('div', { class: 'line', style: 'border:0;padding:0;font-size:14px' },
  h('span', {}, (i + 1) + '. ', h('span', { 'data-asl': '' }, q.dori)), h('span', { style: 'white-space:nowrap' }, q.soni + ' × ' + H.som(q.narx) + ' = ' + H.som(q.summa))));

const etirozMatn = (a) => h('div', { class: 'msg warn' }, 'Siz e\'tiroz bildirgansiz' + (a.etirozTs ? ' (' + sana(a.etirozTs) + ')' : '') + ': «',
  h('span', { 'data-asl': '' }, a.etiroz), '». Direktor ko\'rib chiqadi: xato bo\'lsa yozuvni bekor qilib, to\'g\'risini yozadi.');

function togri(ctx, a) {
  tasdiqlash(nima(a) + ' ' + H.som(a.summa) + ' (' + ks(a) + ') — to\'g\'rimi?')
    .then((ha) => ha && ctx.amal('taTasdiq', a.id).then((r) => r !== null && ctx.toast('Tasdiqlandi ✓')));
}

function tarixSheet(ctx, a) {
  sheet(nima(a) + ' · ' + ks(a), (box, close) => {
    const [matn, rang] = taHolat(a);
    box.append(h('div', { class: 'line', style: 'border:0;padding:0' }, h('span', { 'data-asl': '' }, a.izoh), h('b', {}, H.som(a.summa))),
      h('div', { style: 'color:' + rang + ';font-weight:600' }, matn), ...qatorlar(a));
    if (a.etiroz && !a.bekor) box.append(etirozMatn(a));
    if (a.bekor) box.append(h('div', { class: 'msg info' }, 'Apteka bu yozuvni bekor qilgan — hisobga kirmaydi.'));
    else if (!oziYozgan(a)) {
      if (a.holat === 'kutish') box.append(h('button', { class: 'p', onclick: () => { close(); togri(ctx, a); } }, 'To\'g\'ri — tasdiqlayman'));
      box.append(h('button', { class: a.holat === 'kutish' ? 's' : 'ogoh', onclick: () => { close(); etirozSheet(ctx, a); } },
        a.etiroz ? 'E\'tirozni o\'zgartirish' : 'Noto\'g\'ri — e\'tiroz bildirish'));
    }
  }, { fokus: false });
}

function etirozSheet(ctx, a) {
  sheet('Nima noto\'g\'ri?', (box, close) => {
    const mt = input('Sababi', { inputmode: 'text', placeholder: 'Masalan: summa 2 000 000 emas, 1 800 000', value: a.etiroz || '' });
    box.append(h('div', {}, nima(a) + ' ' + H.som(a.summa) + ' · ' + ks(a)),
      h('div', { class: 'msg info' }, 'Xabaringiz direktorga boradi va yozuv ostida ko\'rinib turadi. Xato bo\'lsa, direktor yozuvni bekor qilib, to\'g\'risini yozadi.'
        + (a.holat === 'ok' ? ' Bu yozuv hozir hisobingizda — e\'tirozdan keyin u siz tasdiqlamagan bo\'lib qoladi.' : '')), mt.el,
      h('button', { class: 'p', onclick: () => {
        if (String(mt.i.value).trim().length < 2) { mt.xato('Sababini yozing'); mt.i.focus(); return; }
        ctx.amalX(xatoJoyla([[mt, /yozing|sabab|noto|allaqachon/i]]), 'taEtiroz', a.id, mt.i.value).then((r) => r !== null && (close(), ctx.toast('Direktorga yuborildi ✓')));
      } }, 'Yuborish'));
  });
}
