// «Yangi kelgan dorilar» (11.11; egasi: "hamma filial xodimlari va direktor bugun nima kelganini ko'rsin — nomi, soni, narxi, hammasi";
// 1-filial va 4-filial Osnovnoy'dan oladi — Osnovnoy'dagi qatorda «+ <filial> uchun kerak»). Ma'lumot: server osonKeldi(kun) —
// kengaytma Oson'dan taxminan har 30 daqiqada yuboradi. Ekranlar sodda (keksa xodimlar): bitta karta, bitta ro'yxat.
// «📦 Kelgan dorilar» (kirim.mjs — ko'chirishni sanash) bilan adashmasin: bu karta faqat ma'lumot, nomi va belgisi boshqa.
//   keldiKarta(ctx, chiz, { doim })  — karta «Yangi kelgan dorilar — bugun N xil» (N = 0 va Oson yangi — yashirin; doim — «Dorilar»da
//                                      bo'sh bo'lsa ham kirish joyi); bosilsa — keldiOyna.
//   keldiOyna(ctx)                    — oyna: «Bugun | Kecha» (sarlavha shunga qarab), bitta holat qatori («Keldi: Osnovnoy · N xil ·
//                                      yangilandi HH:MM»), eski bo'lsa — bitta sariq qator, jadval Nomi | Soni | Narxi | (+) (egasi «B»),
//                                      15 tadan ko'p qatorda — qidiruv.
//   keldiView(joy, ctx, qayta)        — oyna ichi (testda ham). Tuzilma bir marta quriladi (qidiruv maydoni, ro'yxat joyi — doimiy),
//                                      har yangilanishda faqat qismlar qayta chiziladi va doim hozirgi ma'lumotdan.
// Chaqiruvchilar «Qidiruv» funksiyasi (x_qidiruv) bilan cheklaydi — o'chiq bo'lsa karta ham, so'rov ham yo'q.
// Yangilash: taymer yo'q (eng arzon) — karta yoki oyna chizilganda ma'lumot 5 daqiqadan eski bo'lsa qayta olinadi. Saboq 24: har kun
// uchun so'rov raqami — kech kelgan eski javob yangisini bosmaydi; javob boshqa kunniki bo'lsa (yarim tun) — o'z kuniga yoziladi.
import * as H from './hisob.mjs';
import { h, input, pills, sheet, vaqt } from './ui.mjs';
import { ikon } from './ikon.mjs';
import { osonEskimi } from './oson-qoldiq.mjs';
import { sorashOch, sorovHolati, sorovYukla } from './filial-sorov.mjs';

export const KELDI_ESKI = 5 * 60000;   // shundan eski ro'yxat karta/oyna chizilganda qayta olinadi
export const QIDIRUV_DAN = 15;         // shundan ko'p qatorda — qidiruv maydoni
export const KELDI_NOM = 'Yangi kelgan dorilar';
const SS = () => ({ kunlar: {}, tanlov: 'bugun', soz: '', oyna: null, bugun: null });
// kunlar[kalit] = { j, xato, vaqt, yuk (Promise), n (oxirgi yuborilgan), q (oxirgi qo'llangan) }
const K = SS();
export function keldiUnut() { Object.assign(K, SS()); }

const asl = (t) => h('span', { 'data-asl': '' }, t == null ? '' : String(t));
// «Bugun» — serverning kuni (bo'sh kun so'rovi javobidagi j.kun; telefon soati noto'g'ri yoki yarim tun bo'lsa ham bir xil);
// hali javob bo'lmasa — telefon kuni (Toshkent). «Kecha» — shu kundan bir kun oldin.
const bugunKun = () => K.bugun || H.kunKey(Date.now());
export const oldingiKun = (kun) => { const t = Date.parse(kun + 'T00:00:00Z'); return Number.isFinite(t) ? new Date(t - 864e5).toISOString().slice(0, 10) : H.kunKey(Date.now() - 864e5); };
const kechaKun = () => oldingiKun(bugunKun());
const kunOl = (tanlov) => (tanlov === 'kecha' ? kechaKun() : bugunKun());
const kunHolat = (kun) => K.kunlar[kun] || (K.kunlar[kun] = { j: null, xato: null, vaqt: 0, yuk: null, n: 0, q: 0 });
const yangila = () => { if (K.oyna) { try { K.oyna(); } catch (e) { /* oyna chizish xatosi ro'yxatni buzmasin */ } } };

// Ro'yxatni olish (kun — 'YYYY-MM-DD'; bugun bo'lsa serverga '' ketadi). Tugagach chiz() (o'zgargan bo'lsa).
// Javob boshqa kunniki bo'lsa (yarim tun, telefon soati): o'z kuni (j.kun) ostiga yoziladi; bugun so'rovida — server kuni «bugun»
// bo'ladi va ekran qayta chiziladi («Yuklanmoqda…»da qolmaydi); boshqa kun so'rovida — shu kun uchun xato (qayta urinish).
function yukla(ctx, kun, chiz, majbur = false) {
  const s = kunHolat(kun);
  if (s.yuk) return s.yuk;
  if (!majbur && (s.j || s.xato) && Date.now() - s.vaqt < KELDI_ESKI) return null;
  const n = ++s.n, bosh = kun === bugunKun();
  const oldin = JSON.stringify([s.j, s.xato, K.bugun]);
  s.yuk = Promise.resolve().then(() => ctx.oqi('osonKeldi', bosh ? '' : kun))
    .then((j) => {
      if (!j || typeof j !== 'object' || !Array.isArray(j.qatorlar)) throw new Error('Server javobi tushunarsiz');
      if (n < s.q) return;
      s.q = n;
      const jk = typeof j.kun === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(j.kun) ? j.kun : kun;
      if (bosh) K.bugun = jk;
      if (jk !== kun) {
        const b = kunHolat(jk);
        if (!b.yuk) { b.j = j; b.xato = null; b.vaqt = Date.now(); }
        if (!bosh) s.xato = 'Server boshqa kun ro\'yxatini berdi — qayta urinib ko\'ring';
        return;
      }
      s.j = j; s.xato = null;
    })
    .catch((e) => { if (n >= s.q) s.xato = (e && e.message) || 'Ro\'yxat olinmadi'; })
    .then(() => {
      s.vaqt = Date.now(); s.yuk = null;
      if (JSON.stringify([s.j, s.xato, K.bugun]) !== oldin) {
        if (chiz) { try { chiz(); } catch (e) { /* chizish xatosi ro'yxatni buzmasin */ } }
        yangila();
      }
    });
  return s.yuk;
}
// Sinov uchun: majburiy yangilash (standart — bugun).
export function keldiYukla(ctx, chiz, kun) { return yukla(ctx, kun || bugunKun(), chiz, true); }

// Asosiy filial (Osnovnoy): S.filiallar dagi belgi; bo'lmasa — 'osnovnoy'.
const asosiyId = (ctx) => (((ctx.S && ctx.S.filiallar) || []).find((f) => f.asosiy) || {}).id || 'osnovnoy';
const filialNom = (ctx, id) => (((ctx.S && ctx.S.filiallar) || []).find((f) => f.id === id) || {}).nom || id;
const direktormi = (ctx) => !!(ctx.x && ctx.x.rol === 'direktor');
// Necha xil dori: Oson mahsuloti (p) bo'yicha, bo'lmasa nom bo'yicha.
export const xilSoni = (qatorlar) => new Set((qatorlar || []).map((q) => (q.p != null ? 'p' + q.p : 'n' + H.qidiruvKalit(q.nom)))).size;
// «N xil»: server xil (har xil mahsulot soni, 500 qatorda kesishdan oldin); eski server — jami, bo'lmasa qatorlardan.
const sonOl = (v) => (v != null && Number.isFinite(Number(v)) ? Number(v) : null);
const xilJami = (j) => (!j ? 0 : sonOl(j.xil) != null ? sonOl(j.xil) : sonOl(j.jami) != null ? sonOl(j.jami) : xilSoni(j.qatorlar));
// Chala ro'yxat: kesishdan oldingi qatorlar soni (jami), bo'lmasa xil.
const chalaJami = (j) => (sonOl(j.jami) != null ? sonOl(j.jami) : xilJami(j));
// Oson ma'lumoti eski yoki vaqti yo'q — «kelmagan» deb aytilmaydi.
export const keldiEskimi = (j) => !!j && (!!j.eski || j.vaqt == null || osonEskimi(j.vaqt));
const ESKI_MATN = 'Oson ma\'lumoti eski — kelgan dorilar ko\'rinmasligi mumkin';

// Filial bo'yicha guruhlar: Osnovnoy birinchi, keyin xodimning o'z filiali, qolgani nom bo'yicha. Guruh ichida — nom bo'yicha.
export function keldiGuruhlar(qatorlar, asosiy, ozi = null) {
  const g = new Map();
  (qatorlar || []).forEach((q) => { if (!g.has(q.f)) g.set(q.f, { f: q.f, fn: q.fn || q.f, qatorlar: [] }); g.get(q.f).qatorlar.push(q); });
  const tartib = (x) => (x.f === asosiy ? 0 : x.f === ozi ? 1 : 2);
  return [...g.values()].map((x) => ({ ...x, qatorlar: x.qatorlar.slice().sort((a, b) => String(a.nom).localeCompare(String(b.nom))) }))
    .sort((a, b) => tartib(a) - tartib(b) || String(a.fn).localeCompare(String(b.fn)));
}

// Muddat: '2027-12-31' / '2027-12' / ms → «12.2027»; boshqasi — o'zgarishsiz.
export function muddatMatn(m) {
  if (m == null || m === '') return '';
  if (typeof m === 'number' || /^\d{10,}$/.test(String(m))) { const d = new Date(Number(m)); return Number.isFinite(d.getTime()) ? String(d.getUTCMonth() + 1).padStart(2, '0') + '.' + d.getUTCFullYear() : ''; }
  const x = /^(\d{4})-(\d{2})/.exec(String(m));
  if (x) return x[2] + '.' + x[1];
  const y = /^\d{2}\.(\d{2})\.(\d{4})$/.exec(String(m));
  return y ? y[1] + '.' + y[2] : String(m);
}

// Xodimning Osnovnoy bo'lmagan filiallari (asosiysi birinchi; ikkinchi ish joyi ham).
function sorashFiliallar(ctx, j) {
  const men = (j && j.men) || {};
  const asosiy = asosiyId(ctx);
  return [...new Set([men.filial, ...(Array.isArray(men.filiallar) ? men.filiallar : [])].filter((f) => f && f !== asosiy))];
}
// «+ <filial> uchun kerak»: xodim (direktor emas), filiallaridan biri Osnovnoy emas, qator Osnovnoy'da va qoldig'i bor.
export function sorashMumkin(ctx, j, q) {
  if (direktormi(ctx) || !ctx.server) return false;
  return q.f === asosiyId(ctx) && Number(q.soni) > 0 && sorashFiliallar(ctx, j).length > 0;
}
// Shu dori Osnovnoy'dan (xodimning biror filiali uchun) allaqachon so'ralgan va ochiq bo'lsa — so'rov.
const OCHIQ_SOROV = { yangi: 'tayyorlanmoqda', tayyor: 'tayyor — olib keting' };
function ochiqSorov(ctx, j, q) {
  for (const f of sorashFiliallar(ctx, j)) {
    const s = sorovHolati(q.nom, f, q.f);
    if (s && OCHIQ_SOROV[s.holat]) return s;
  }
  return null;
}

// Jadval (11.11, egasi «B variant»: "tushunarli, soddaroq — nomi, soni, narxi yetadi"): Nomi | Soni | Narxi | (+).
// Soni — «keldi» (kq, taxminiy) ma'lum bo'lsa o'sha, bo'lmasa hozirgi qoldiq; birligi — jadval tagidagi izohda (quti). Tugagan — «tugadi».
// «+» — faqat so'ray oladigan xodimga (Osnovnoy bo'lmagan filial, Osnovnoy qatori, qoldig'i bor); so'ralgan bo'lsa — «✓».
// Direktor — nom ostida kirim narxi. Ishlab chiqaruvchi, firma, muddat va boshqa belgilar ro'yxatda yo'q (sodda).
const sonKor = (v) => { const n = Number(v); if (!Number.isFinite(n)) return ''; const r = Math.round(n * 100) / 100; return String(r).replace('.', ','); };
const narxKor = (v) => H.som(v).replace(/ so'm$/, '');
function qatorEl(ctx, j, q, plus) {
  const tugagan = !(Number(q.soni) > 0);
  const son = tugagan ? 'tugadi' : sonKor(q.kq != null ? q.kq : q.soni);
  let ust = null;
  if (plus) {
    if (sorashMumkin(ctx, j, q)) {
      const bor = ochiqSorov(ctx, j, q);
      const fl = sorashFiliallar(ctx, j);
      ust = bor ? h('span', { class: 'keldi-soralgan', role: 'img', 'aria-label': 'So\'ralgan — ' + OCHIQ_SOROV[bor.holat] }, '✓')
        : h('button', { type: 'button', class: 'keldi-plus', 'aria-label': '+ ' + filialNom(ctx, fl[0]) + ' uchun so\'rash',
          onclick: () => sorashOch(ctx, { nom: q.nom, filial: fl[0], manba: q.f, qoldiq: [{ f: q.f, soni: q.soni, dona: q.dona }], vaqt: j.vaqt }, yangila) }, '+');
    }
  }
  return h('tr', { class: tugagan ? 'tugagan' : null, 'data-rk': String(q.f) + '|' + String(q.p != null ? q.p : q.nom) },
    h('td', { class: 'keldi-nom' }, h('span', { 'data-asl': '' }, q.nom || ''),
      direktormi(ctx) && q.kirimNarx != null ? h('span', { class: 'keldi-kirim' }, 'kirim: ' + narxKor(q.kirimNarx)) : null),
    h('td', { class: 'son' }, son),
    h('td', { class: 'son' }, q.narx ? narxKor(q.narx) : '—'),
    plus ? h('td', { class: 'keldi-plus-td' }, ust) : null);
}

const sarlavha = () => KELDI_NOM + ' — ' + (K.tanlov === 'kecha' ? 'kecha' : 'bugun');

// Oyna ichi. Birinchi chaqiruvda tuzilma quriladi; keyingilari — faqat qismlar (qidiruv maydoni va uning tinglovchisi doimiy,
// tinglovchi K.oyna orqali hozirgi ma'lumotni o'qiydi — fonda yangilangandan keyin ham yangi ro'yxatni filtrlaydi).
export function keldiView(joy, ctx, qayta) {
  if (!joy._keldi) {
    const q = input('Qidirish', { inputmode: 'search', enterkeyhint: 'search', autocomplete: 'off', placeholder: 'Dori nomi', pul: false });
    q.el.classList.add('keldi-qidir');
    q.i.addEventListener('input', () => { K.soz = q.i.value; qayta(); });
    joy._keldi = { tepa: h('div', { class: 'keldi-tepa' }), holat: h('div', { class: 'keldi-holat' }), q, royxat: h('div', { class: 'keldi-royxat' }) };
    const t = joy._keldi;
    joy.replaceChildren(t.tepa, t.holat, q.el, t.royxat);
  }
  const t = joy._keldi;
  const kun = kunOl(K.tanlov);
  yukla(ctx, kun, qayta);
  const s = kunHolat(kun), j = s.j;
  const box = joy.closest && joy.closest('.sheet');
  const h2 = box && box.querySelector('.head h2');
  if (h2 && h2.textContent !== sarlavha()) h2.textContent = sarlavha();
  // Tanlov tugmalari — faqat tanlov o'zgarganda qayta chiziladi (har yangilanishda fokus yo'qolmasin).
  if (t.tepa.dataset.tanlov !== K.tanlov) {
    t.tepa.dataset.tanlov = K.tanlov;
    t.tepa.replaceChildren(pills([['bugun', 'Bugun'], ['kecha', 'Kecha']], K.tanlov, (v) => { K.tanlov = v; qayta(); }, 'Qaysi kun'));
  }
  const qidiruv = !!j && j.qatorlar.length > QIDIRUV_DAN;
  t.q.el.hidden = !qidiruv;
  if (t.q.i.value !== K.soz && document.activeElement !== t.q.i) t.q.i.value = K.soz;
  if (!j) {
    t.holat.replaceChildren(s.xato ? h('div', { class: 'msg warn', role: 'status' }, 'Ro\'yxat olinmadi: ' + s.xato + ' ',
      h('button', { type: 'button', class: 's', onclick: () => { yukla(ctx, kun, qayta, true); } }, 'Qayta urinish'))
      : h('div', { class: 'muted', 'aria-live': 'polite' }, 'Yuklanmoqda…'));
    t.royxat.replaceChildren();
    return;
  }
  const eski = keldiEskimi(j);
  const hammasi = j.qatorlar;
  const asosiy = asosiyId(ctx), ozi = (j.men && j.men.filial) || (ctx.x && ctx.x.filialId) || null;
  const gs0 = keldiGuruhlar(hammasi, asosiy, ozi);
  // Bitta qator: «Keldi: Osnovnoy · N xil · yangilandi HH:MM»; eski bo'lsa — bitta sariq qator; chala va xato — alohida.
  const holat = [];
  // R11: kirill rejimida asl nomga qo'shimcha ulanmasin («Osnovnoy'ga» → «Osnovnoyга») — «Keldi: Osnovnoy».
  const qayerga = gs0.length === 1 ? ['Keldi: ', asl(gs0[0].fn)] : [K.tanlov === 'kecha' ? 'Kecha keldi' : 'Bugun keldi'];
  const vq = j.vaqt != null && Number.isFinite(Number(j.vaqt)) && Number(j.vaqt) > 0 ? ' · yangilandi ' + vaqt(Number(j.vaqt)) : '';
  if (hammasi.length) holat.push(h('div', { class: 'keldi-jami' }, ...qayerga, ' · ' + xilJami(j) + ' xil' + vq));
  if (eski) holat.push(h('div', { class: 'oson-vaqt eski', role: 'status' }, '⚠ ' + ESKI_MATN));
  if (j.chala) holat.push(h('div', { class: 'msg warn', role: 'status' }, 'Ro\'yxat to\'liq emas — ' + chalaJami(j) + ' xildan ' + j.qatorlar.length + ' tasi ko\'rsatilgan'));
  if (s.xato) holat.push(h('div', { class: 'muted' }, 'Yangilanmadi (' + s.xato + ') — oldingi ro\'yxat.'));
  t.holat.replaceChildren(...holat);
  if (!hammasi.length) {
    t.royxat.replaceChildren(h('div', { class: 'card muted keldi-bosh' }, eski ? '⚠ ' + ESKI_MATN + '.'
      : K.tanlov === 'kecha' ? 'Kecha yangi dori kelmagan.' : 'Bugun hali yangi dori kelmagan. Oson\'ga kirim qilinsa, ~30 daqiqada shu yerda chiqadi.'));
    return;
  }
  // So'rovlar holati («✓»): har chizishda — 60 s dan eski bo'lsa filial-sorov o'zi qayta oladi, o'zgarsa — yangila().
  const plus = hammasi.some((q) => sorashMumkin(ctx, j, q));
  if (plus) sorovYukla(ctx, yangila);
  const soz = qidiruv ? H.qidiruvKalit(K.soz) : '';
  const kor = soz ? hammasi.filter((q) => H.qidiruvKalit(q.nom).includes(soz)) : hammasi;
  const gs = keldiGuruhlar(kor, asosiy, ozi);
  if (!gs.length) { t.royxat.replaceChildren(h('div', { class: 'muted' }, 'Bu so\'z bo\'yicha topilmadi.')); return; }
  const ustunlar = plus ? 4 : 3;
  const tbody = h('tbody', {});
  gs.forEach((g) => {
    if (gs0.length > 1) tbody.append(h('tr', { class: 'keldi-guruh-tr' }, h('th', { scope: 'rowgroup', colspan: String(ustunlar) }, asl(g.fn))));
    g.qatorlar.forEach((q) => tbody.append(qatorEl(ctx, j, q, plus)));
  });
  const jadval = h('table', { class: 'keldi-jadval' + (plus ? ' plusli' : '') },
    h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Nomi'), h('th', { scope: 'col', class: 'son' }, 'Soni'), h('th', { scope: 'col', class: 'son' }, 'Narxi'),
      plus ? h('th', { scope: 'col', class: 'keldi-plus-td' }, h('span', { class: 'yashirin' }, 'So\'rash')) : null)),
    tbody);
  const fl = plus ? sorashFiliallar(ctx, j) : [];
  t.royxat.replaceChildren(h('div', { class: 'keldi-jadval-joy' }, jadval),
    h('div', { class: 'muted keldi-izoh' }, 'Soni — quti. Narxi — 1 quti, so\'m.', plus ? [' «+» — ', asl(filialNom(ctx, fl[0])), ' uchun so\'rash.'] : null));
}

export function keldiOyna(ctx) {
  sheet(sarlavha(), (box) => {
    const joy = h('div', { class: 'keldi-oyna' });
    box.append(joy);
    const qayta = () => keldiView(joy, ctx, qayta);
    keldiView(joy, ctx, qayta);
    K.oyna = qayta;
    return () => { if (K.oyna === qayta) K.oyna = null; };
  }, { fokus: false });
}

// Karta. Bugungi ro'yxat; N = 0 va Oson yangi (yoki hali yuklanmagan / xato) — yashirin belgi; Oson eski bo'lsa — N = 0 da ham ⚠ bilan
// («kelmagan» deyilmaydi). o.doim — «Dorilar → Keldi»da doim kirish joyi.
export function keldiKarta(ctx, chiz, o = {}) {
  if (!ctx.server) return null;
  const kun = bugunKun();
  yukla(ctx, kun, chiz);
  const s = kunHolat(kun), j = s.j;
  const n = xilJami(j);
  const eski = keldiEskimi(j);
  if (!n && !eski && !o.doim) return h('div', { 'data-keldi-karta': '', hidden: true });
  const izoh = !j ? (s.xato ? 'Ro\'yxat olinmadi — bosing, qayta urinadi' : 'Yuklanmoqda…')
    : !n ? (eski ? null : 'Bugun hali yangi dori kelmagan')
      : ((gs) => (gs.length === 1 ? [asl(gs[0].fn)] : gs.map((g) => [asl(g.fn), ' ' + xilSoni(g.qatorlar)]).flatMap((x, i) => (i ? [' · ', ...x] : x))))(keldiGuruhlar(j.qatorlar, asosiyId(ctx), (j.men && j.men.filial) || null));
  return h('button', { type: 'button', class: 'card keldi-karta', 'data-keldi-karta': '', onclick: () => { K.tanlov = 'bugun'; if (s.xato) yukla(ctx, kun, chiz, true); keldiOyna(ctx); } },
    h('span', { class: 'keldi-karta-s' }, h('span', { class: 'keldi-ikon', 'aria-hidden': 'true' }, ikon('keldi')),
      h('b', {}, KELDI_NOM + (n ? ' — bugun ' + n + ' xil' : '')), h('span', { class: 'keldi-o', 'aria-hidden': 'true' }, '›')),
    izoh ? h('span', { class: 'muted' }, ...[].concat(izoh)) : null,
    eski ? h('span', { class: 'keldi-eski' }, '⚠ ' + ESKI_MATN) : null);
}

// Xodim Bosh sahifasidagi katta tugma uchun (11.11, sodda Bosh): holat va bir qatorli izoh — karta o'rniga. null — serversiz.
// { n, eski, xato, izoh } ; bosilsa — keldiOch(ctx, chiz).
export function keldiHolat(ctx, chiz) {
  if (!ctx.server) return null;
  const kun = bugunKun();
  yukla(ctx, kun, chiz);
  const s = kunHolat(kun), j = s.j;
  const n = xilJami(j), eski = keldiEskimi(j);
  // Bir qator (R9/R10, 11.11): uzun ogohlantirish — oynada; tugmada qisqa.
  // R11: filial xodimi (Osnovnoy'da ishlamaydi) — qayerga kelgani aytiladi («Osnovnoy: 3 xil keldi»), o'z filialiga kelgan deb o'ylamasin.
  // Nom — data-asl, qo'shimchasiz (kirill rejimida «Osnovnoy'ga» buzilmasin).
  const asosiy = asosiyId(ctx);
  const begona = !!j && !direktormi(ctx) && !!(j.men && j.men.filial) && j.men.filial !== asosiy && !(j.men.filiallar || []).includes(asosiy);
  const fn = (((j && j.qatorlar) || []).find((q) => q.f === asosiy) || {}).fn || filialNom(ctx, asosiy);
  const izoh = !j ? (s.xato ? 'Olinmadi — bosing, qayta urinadi' : 'Yuklanmoqda…')
    : eski ? '⚠ Oson yangilanmagan' + (n ? ' · ' + n + ' xil' : '')
      : !n ? 'Bugun hali kelmagan' : begona ? [asl(fn), ': ' + n + ' xil keldi'] : n + ' xil dori keldi';
  return { n, eski, xato: !!s.xato, izoh };
}
export function keldiOch(ctx, chiz) {
  const kun = bugunKun(), s = kunHolat(kun);
  K.tanlov = 'bugun';
  if (s.xato) yukla(ctx, kun, chiz, true);
  keldiOyna(ctx);
}
