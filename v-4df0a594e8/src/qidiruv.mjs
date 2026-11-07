// Direktor uchun global qidiruv (07.11 tun; GitHub hisobotidagi shadcn-admin g'oyasi — o'z kodimiz):
// sarlavhadagi 🔍 → bitta maydon: bo'lim/sahifa nomi («qarz» → Mijozlar qarzi, «defek» → Defektura), xodim ismi (oynasi
// ochiladi), ta'minotchi, dori (Ombor → «Qaysi filialda bor?» shu so'z bilan). Yozuvga qaramaydi: H.qidiruvKalit (kirill = lotin).
// Klaviatura faqat maydon bosilganda chiqadi (iPhone: oyna ochilishi bilan emas — sheet { fokus: false }).
import * as H from './hisob.mjs';
import { h, input, sheet } from './ui.mjs';
import { ikon } from './ikon.mjs';

const KOP = 6;   // har guruhda ko'pi bilan

// Bir matnga moslik bali: 0 — mos emas; 3 — butun matn so'rov bilan boshlanadi; 2 — har so'rov so'zi biror so'z boshida;
// 1 — 3+ harfli so'rov so'zi so'z ichida. Sinonimlar (soz) — bir ball kam.
export function moslik(soz, matn, qoshimcha) {
  const q = H.qidiruvKalit(soz);
  if (q.length < 2) return 0;
  const bal = (t) => {
    const k = H.qidiruvKalit(t);
    if (!k) return 0;
    if (k.startsWith(q)) return 3;
    const sozlar = k.split(' ');
    let eng = 2;
    for (const w of q.split(' ')) {
      if (sozlar.some((s) => s.startsWith(w))) continue;
      if (w.length >= 3 && k.includes(w)) { eng = 1; continue; }
      return 0;
    }
    return eng;
  };
  const a = bal(matn);
  const b = qoshimcha ? Math.max(0, bal(qoshimcha) - 1) : 0;
  return Math.max(a, b);
}

// Sof hisob (test): { sahifalar: [{ nom, soz? }], xodimlar: [{ ism, faol? }], taminotchilar: [{ nom }] } → shu guruhlar,
// har birida mosi (ball, keyin nom bo'yicha), ko'pi bilan 6 tadan. Ishdan bo'shatilgan xodim — oxirida.
export function globalQidir(soz, manba = {}) {
  const tanla = (l, nomi, qosh) => (l || []).map((x) => ({ x, b: moslik(soz, nomi(x), qosh ? qosh(x) : '') })).filter((r) => r.b > 0)
    .sort((a, b) => b.b - a.b || String(nomi(a.x)).localeCompare(String(nomi(b.x)))).slice(0, KOP).map((r) => r.x);
  return {
    sahifalar: tanla(manba.sahifalar, (s) => s.nom, (s) => s.soz || ''),
    xodimlar: tanla((manba.xodimlar || []).slice().sort((a, b) => (a.faol === false) - (b.faol === false)), (z) => z.ism),
    taminotchilar: tanla(manba.taminotchilar, (t) => t.nom)
  };
}

// Oyna. nav: { sahifalar (katalog: [{ nom, izoh, soz, och }]), xodim(z), taminotchi(t), dori(soz) }.
export function globalQidiruvOyna(S, nav) {
  sheet('Qidirish', (box, close) => {
    const f = input('Nima qidiryapsiz?', { inputmode: 'search', enterkeyhint: 'search', placeholder: 'Masalan: qarz, defektura, Malika, analgin', autocomplete: 'off' });
    const natija = h('div', { class: 'gq-natija', 'aria-live': 'polite' });
    const bor = (fn) => () => { close(); fn(); };
    const qator = (ik, nom, izoh, fn, asl) => h('button', { type: 'button', class: 'yq gq-q', onclick: bor(fn) },
      h('span', { class: 'yq-d kul', 'aria-hidden': 'true' }, ikon(ik)),
      h('span', { class: 'yq-m' }, h('b', asl ? { 'data-asl': '' } : {}, nom), izoh ? h('span', { class: 'muted' }, izoh) : null),
      h('span', { class: 'yq-o' }, ikon('oldinga')));
    const guruh = (nom, qatorlar) => (qatorlar.length ? h('section', { class: 'yb', 'aria-label': nom }, h('h2', { class: 'yb-s' }, nom), h('div', { class: 'card yb-r' }, ...qatorlar)) : null);
    const chiz = () => {
      const soz = String(f.i.value).trim();
      natija.textContent = '';
      if (H.qidiruvKalit(soz).length < 2) {
        natija.append(h('div', { class: 'muted gq-yordam' }, 'Kamida 2 harf yozing — bo\'lim, xodim, ta\'minotchi yoki dori nomi. Lotin yoki kirill harfida.'));
        return;
      }
      const r = globalQidir(soz, { sahifalar: nav.sahifalar, xodimlar: S.xodimlar, taminotchilar: S.taminotchilar });
      const bolim = guruh('Bo\'limlar', r.sahifalar.map((s) => qator(s.ikon || 'oldinga', s.nom, s.izoh, s.och)));
      const xod = guruh('Xodimlar', r.xodimlar.map((z) => qator('xodimlar', z.ism, (z.faol === false ? 'Ishdan bo\'shatilgan · ' : '') + (z.rol === 'direktor' ? 'Direktor' : 'Xodim'), () => nav.xodim(z), true)));
      const ta = guruh('Ta\'minotchilar', r.taminotchilar.map((t) => qator('tamin', t.nom, 'Xaridlar, to\'lovlar, qarz', () => nav.taminotchi(t), true)));
      // Dori — doim oxirgi qator: Oson qoldig'idan «Qaysi filialda bor?» shu so'z bilan (server qidiradi).
      const dori = guruh('Dori', [h('button', { type: 'button', class: 'yq gq-q', onclick: bor(() => nav.dori(soz)) },
        h('span', { class: 'yq-d yashil', 'aria-hidden': 'true' }, ikon('qidir')),
        h('span', { class: 'yq-m' }, h('b', {}, '«', h('span', { 'data-asl': '' }, soz), '» — dorini qidirish'), h('span', { class: 'muted' }, 'Narxi va qaysi filialda bor')),
        h('span', { class: 'yq-o' }, ikon('oldinga')))]);
      natija.append(...[bolim, xod, ta, dori].filter(Boolean));
      if (!bolim && !xod && !ta) natija.prepend(h('div', { class: 'muted gq-yordam' }, 'Bo\'lim, xodim yoki ta\'minotchi topilmadi.'));
    };
    f.i.addEventListener('input', chiz);
    f.i.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); f.i.blur(); } });
    box.append(f.el, natija);
    chiz();
  }, { fokus: false });
}
