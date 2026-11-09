// Ta'minotchi hisobi — C ko'rinish (07.11; foydalanuvchi maketlardan C ni tanladi: https://claude.ai/artifact/KG88QXD2PXh4QcsZSiyTZx).
// «Qarz qanday chiqdi»: boshlang'ich qarz + dori olib kelingan − pul berilgan = qarz; ostida ikki ustun — dori kelgan sanalar va pul
// berilgan sanalar (sana bosilsa — o'sha yozuv oynasi). Direktor (rol 'dir') va ta'minotchi (rol 'ta') panelida bir xil, faqat so'zlar
// o'z tomonidan: «Dori olib keldi / Pul berdik» va «Dori berdingiz / Pul oldingiz». Hisob — H.taHisob (= bizBoyicha / ularBoyicha).
import * as H from './hisob.mjs';
import { h, kartaSarlavha } from './ui.mjs';

const KORSAT = 8;   // har ustunda oxirgi 8 ta; oldingilari — yig'iq bo'limda
const yil = () => H.kunKey(Date.now()).slice(0, 4);
// «07.11», boshqa yil — «07.11.25».
export const qisqaSana = (k) => (/^\d{4}-\d{2}-\d{2}$/.test(k || '') ? k.slice(8, 10) + '.' + k.slice(5, 7) + (k.slice(0, 4) !== yil() ? '.' + k.slice(2, 4) : '') : '');

const SOZ = {
  dir: { dori: 'Dori olib keldi', pul: 'Pul berdik', jD: 'Dori olib kelindi', jP: 'Pul berildi', qarz: 'Qarzimiz', ortiq: 'Ortiqcha to\'langan (ta\'minotchi bizga qarz)' },
  ta: { dori: 'Dori berdingiz', pul: 'Pul oldingiz', jD: 'Dori berdingiz', jP: 'Pul oldingiz', qarz: 'Apteka sizga qarz', ortiq: 'Siz aptekaga qarzdorsiz (ortiqcha to\'langan)' }
};
// Holat belgisi — kim nima qilishi kerak (audit 07.11: ta'minotchi tomonida almashib qolgan edi).
// Direktor: ta'minotchi yozgan (ular) — «tasdiqlang», apteka yozgan, ta'minotchi tasdiqlamagan (kutish) — «kutilmoqda».
// Ta'minotchi: apteka yozgan (kutish) — «tasdiqlang», o'zi yozgan (ular) — «apteka tasdig'ida».
function belgi(a, rol) {
  if (a.bekor) return 'bekor';
  if (a.holat === 'ular') return rol === 'ta' ? 'apteka tasdig\'ida' : 'tasdiqlang';
  if (a.holat === 'kutish') return rol === 'ta' ? 'tasdiqlang' : 'kutilmoqda';
  return null;
}

// o: { onYozuv(a) — yozuv oynasi, excel() — Excel tugmasi (bo'lmasa tugma yo'q) }.
export function hisobKarta(t, rol, o = {}) {
  const r = H.taHisob(t, rol), s = SOZ[rol] || SOZ.dir;
  const k = h('section', { class: 'card ta-c', 'aria-labelledby': 'ta-c-s' }, kartaSarlavha('Qarz qanday chiqdi', { id: 'ta-c-s' }));
  const satr = (l, v, cls) => h('div', { class: 'ta-l' + (cls ? ' ' + cls : '') }, h('span', {}, l), h('b', { class: 'num' }, v));
  k.append(h('div', { class: 'ta-f' },
    satr('Boshlang\'ich qarz', H.som(r.bosh)),
    satr('+ ' + s.jD + ' (' + r.nD + ' marta)', H.som(r.jamiD), 'ta-plus'),
    satr('− ' + s.jP + ' (' + r.nP + ' marta)', H.som(r.jamiP), 'ta-minus'),
    // Ortiqcha to'langan bo'lsa — manfiy son emas, tushunarli so'z (tepadagi ta'minotchi kartasi bilan bir xil).
    satr('= ' + (r.qarz < 0 ? s.ortiq : s.qarz), H.som(Math.abs(r.qarz)), 'ta-tot')));
  if (r.kutish.length) {
    k.append(h('div', { class: 'msg warn' }, 'Hisobga hali kirmagan: ' + r.kutish.length + ' ta yozuv ('
      + (r.kutishSumma >= 0 ? '+' : '−') + H.som(Math.abs(r.kutishSumma)) + ') — '
      + (rol === 'ta' ? 'apteka yozgan, siz hali tasdiqlamagansiz.' : 'ta\'minotchi yozgan, siz hali tasdiqlamagansiz.')
      + ' Belgisi «tasdiqlang».'));
  }
  const ustun = (sarlavha, cls, l, nima) => {
    const c = h('div', { class: 'ta-col' }, h('h3', { class: cls }, sarlavha));
    if (!l.length) { c.append(h('div', { class: 'muted', style: 'font-size:14px' }, 'Hali yo\'q')); return c; }
    const qator = (y) => {
      const a = y.a, pill = belgi(a, rol);
      return h('button', { type: 'button', class: 'ta-ci' + (a.bekor ? ' bekor' : ''), onclick: o.onYozuv ? () => o.onYozuv(a) : null,
        'aria-label': nima + ': ' + qisqaSana(y.sana) + ', ' + H.som(a.summa) + (pill ? ', ' + pill : '') },
        h('span', { class: 'ta-cs' }, qisqaSana(y.sana), pill ? h('span', { class: 'ta-pill' + (a.bekor ? '' : pill === 'tasdiqlang' ? ' diq' : ' warn') }, pill) : null),
        h('b', { class: 'num' }, H.som(a.summa).replace(/ so'm$/, '')));
    };
    if (l.length > KORSAT) {
      // Audit 10.11: yopiq details ichidagi yuzlab tugma ham DOM'da chizilardi — endi birinchi ochilganda chiziladi.
      const eski = l.slice(0, l.length - KORSAT);
      const d = h('details', { class: 'ta-eski' }, h('summary', {}, 'Oldingilari (' + eski.length + ')'));
      let chizildi = false;
      d.addEventListener('toggle', () => { if (d.open && !chizildi) { chizildi = true; d.append(...eski.map(qator)); } });
      c.append(d);
    }
    l.slice(-KORSAT).forEach((y) => c.append(qator(y)));
    return c;
  };
  k.append(h('div', { class: 'ta-cols' }, ustun('📦 ' + s.dori, 'ta-plus', r.dori, s.dori), ustun('💵 ' + s.pul, 'ta-minus', r.pul, s.pul)));
  k.append(h('div', { class: 'muted', style: 'font-size:13px' }, 'Sanani bosing — o\'sha yozuv: dorilar, izoh' + (rol === 'ta' ? ', «Noto\'g\'ri».' : ', «Bekor qilish».')));
  if (o.excel) {
    let band = false;
    const b = h('button', { type: 'button', class: 's', onclick: async () => {
      if (band) return;
      band = true; b.disabled = true;
      try { await o.excel(); } finally { band = false; b.disabled = false; }
    } }, '📊 Excel — hisob-kitob (Telegram\'ga)');
    k.append(b);
  }
  return k;
}
