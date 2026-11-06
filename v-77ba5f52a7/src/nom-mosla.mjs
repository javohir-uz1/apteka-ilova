// Dori nomlarini moslash (30.10 firma prayslari uchun yozilgan; 05.11 alohida fayl — Edge funksiyasi
// supabase/functions/api/nom-mosla.mjs ham shu nusxani ishlatadi: Oson'ga kirgan dori defekturadagi qaysi dori ekanini topish).
// DOM'siz, faqat kalit.mjs ga bog'liq.
import { qidiruvKalit } from './kalit.mjs';

export function normNom(s) {
  return String(s ?? '').toLowerCase().replace(/ё/g, 'е').replace(/,/g, '.').replace(/[«»"'`®™()[\]]/g, ' ').replace(/\s+/g, ' ').trim();
}
// "Тромбопол 150мг №60 /Polpharma S.A./" → "Тромбопол 150мг №60" (ishlab chiqaruvchi — oxirgi «/Katta harf»).
export const nomQismi = (s) => { const m = /\/\s*["«]?[A-ZА-ЯЁ]/.exec(String(s ?? '')); return (m ? String(s).slice(0, m.index) : String(s ?? '')).trim(); };
// Dori shakli, qadoq, tavsif va o'zbekcha qo'shimcha so'zlar — muhim so'z emas (kalit ko'rinishida).
const SHAKL = ['таб', 'табл', 'таблетки', 'капс', 'капсулы', 'сироп', 'сусп', 'суспензия', 'супп', 'рект', 'мазь', 'крем', 'гель', 'капли', 'спрей', 'наз',
  'р-р', 'раствор', 'пор', 'порошок', 'лиоф', 'для', 'ин', 'инф', 'инъек', 'амп', 'ампулы', 'флак', 'флакон', 'фл', 'шип', 'жев', 'диспер', 'покр', 'пленочн',
  'оболоч', 'кишечнораств', 'кишечн', 'пролонг', 'мягк', 'мяг', 'вагин', 'глазн', 'ушн', 'конц', 'приг', 'внутр', 'наруж', 'примен', 'приема', 'внутрь',
  'шприц', 'тюбик', 'пакет', 'пакетики', 'саше', 'пастилки', 'леден', 'драже', 'гран', 'эмульс', 'аэрозоль', 'ингал', 'доз', 'дозир', 'набор', 'уп', 'упак',
  'бут', 'туба', 'стрип', 'блист', 'плен', 'обол', 'пл', 'ретард', 'шт', 'мкг', 'мг', 'мл', 'гр', 'ме', 'ед', 'порош', 'сус', 'бад', 'жидк', 'экстракт',
  'tabletka', 'tabletkasi', 'tab', 'tabl', 'kapsula', 'kaps', 'sirop', 'siropi', 'suspenziya', 'ampula', 'ampulasi', 'malham', 'malhami', 'krem', 'gel', 'tomchi',
  'tomchisi', 'sprey', 'sham', 'shamcha', 'kukun', 'eritma', 'ukol', 'dona', 'quti', 'upakovka', 'pachka', 'blister', 'kerak', 'bor', 'yoq', 'yo\'q', 'kam', 'qoldi',
  'tugadi', 'katta', 'kichik', 'bolalar', 'uchun', 'mg', 'ml', 'mkg', 'gr',
  'суппозитории', 'суппазитории', 'ректальные', 'ректал', 'вагинальные', 'вагинал', 'инфузий', 'инфузионный', 'инфузия', 'ингаляций', 'ингаляц', 'суспен',
  'наружного', 'применения', 'прим', 'концентрат', 'модель', 'мед', 'медицинский', 'нат', 'соль', 'покрытые', 'покрыт', 'оболочкой', 'пленочной', 'раствора',
  'приготовления', 'притг', 'капсула', 'таблетка', 'лиофилизат', 'гранулы', 'введения', 'инъекций', 'инъекции', 'ампулах', 'внутривенного',
  'внутримышечного', 'масляный', 'жевательные', 'шипучие', 'растворимые', 'диспергируемые', 'глазные', 'ушные', 'назальный', 'назальные', 'стерильный',
  'однократного', 'пероральный', 'оральный', 'перорал', 'mazi', 'syrup', 'tablet', 'capsule', 'sashe'];
const SHAKL_K = new Set(SHAKL.map((w) => qidiruvKalit(w).replace(/\s/g, '')));
// Shakl so'zining boshi (2-so'zdan boshlab): «суппоз…», «ингал…», «приготов…».
const SHAKL_BOSH = ['supp', 'supaz', 'rekt', 'vagin', 'infuz', 'ingal', 'suspen', 'prigot', 'rastvor', 'poroshok', 'kapsul', 'tabletk', 'oboloh', 'pokrit', 'primen',
  'naruj', 'vveden', 'iniek', 'ampul', 'granul', 'liof', 'dispers', 'rasasiv', 'peroral'].map((w) => qidiruvKalit(w));
const shaklmi = (w, i) => SHAKL_K.has(w) || (i > 0 && w.length >= 5 && SHAKL_BOSH.some((p) => w.startsWith(p)));
const kalitSoz = (s) => qidiruvKalit(s).split(' ').filter((w) => /[a-z]/.test(w) && w.replace(/[0-9]/g, '').length >= 3)
  .map((w) => w.replace(/[0-9]+/g, ''));
// Raqam bilan yopishgan so'z ajratiladi: «Л-Тироксин50» → «Л-Тироксин 50».
const kalitSozAjrat = (s) => kalitSoz(String(s).replace(/(\d)(?=[^\d\s.,/%])/g, '$1 ').replace(/([^\d\s.,/])(?=\d)/g, '$1 '));
// Qavs ichi — ko'pincha ta'sir etuvchi modda yoki shahar: «Аторем 20мг (Аторвастатин)», «Аевит (Минск)». Asosiy so'zlarga kirmaydi,
// lekin firma nomidagi qavs ichi — muqobil nom (xodim «Аторвастатин 20мг» deb yozsa, Аторем ham topiladi — taxminiy).
const qavsSiz = (s) => nomQismi(s).replace(/\([^)]*\)/g, ' ');
const qavsIchi = (s) => [...nomQismi(s).matchAll(/\(([^)]*)\)/g)].map((m) => m[1]).join(' ');
const muhim = (s) => kalitSozAjrat(qavsSiz(s)).filter((w, i) => !shaklmi(w, i));
export const sozlar = muhim;
// Brend — birinchi muhim so'z (talaffuz kaliti): "Тромбопол" va "Trombopol" — "trombopol". Bo'lmasa — birinchi so'z («Шприц 2мл»).
export const brend = (s) => muhim(s)[0] || kalitSoz(qavsSiz(s))[0] || '';
// Ishlab chiqaruvchi so'zlari («/Polpharma/») — majburiy emas, lekin bor bo'lsa — o'sha ishlab chiqaruvchi afzal.
const ishlabSoz = (s) => { const m = /\/\s*["«]?[A-ZА-ЯЁ]/.exec(String(s ?? '')); return m ? new Set(kalitSoz(String(s).slice(m.index))) : new Set(); };
// Dori shakli guruhi (asl matndan): ikkala nomda shakl bo'lsa va mos kelmasa — boshqa dori (MIKON saше ↔ Миксон «р-р д/ин.»).
// rastvor/spirt/masl — «yumshoq» (eritma ukol ham, tomchi ham bo'lishi mumkin); krem/mazь/gel bir-biriga yaqin (jarima bilan).
const SHAKL_TUR = [['tab', /(^|[^a-zа-я])(таб|табл|драже|tab|tabl|tabletka)/], ['kaps', /(^|[^a-zа-я])(капс|kaps)/],
  ['ukol', /(д\/ин|д\/инф|для ин|инъек|инфуз|(^|[^a-zа-я])амп(?![а-я])|ампул|(^|[^a-z])amp(?![a-z])|ampula|ukol)/], ['rastvor', /((^|[^a-zа-я])р\/р|р-р|раствор)/], ['suyuq', /(сироп|сусп|sirop|suspenz|эликсир)/],
  ['sham', /(супп|рект|свеч|(^|[^a-zа-я])sham)/], ['maz', /(мазь|malham|линим)/], ['krem', /(крем|krem)/], ['gel', /((^|[^a-zа-я])гель|(^|[^a-z])gel)/],
  ['tomchi', /(капли|(^|[^a-zа-я])кап\.\s*гл|гл\.\s*кап|глаз|tomchi)/], ['sprei', /(спрей|аэроз|sprey|sprei)/], ['kukun', /(порош|(^|[^a-zа-я])пор\.|саше|пакет|sashe|kukun|гранул)/],
  ['shampun', /шампун/], ['spirt', /спирт/], ['masl', /масл/],
  // 05.11: «амп» endi faqat alohida so'z yoki «ампул…» («Ампициллин» ukol emas); pasta va pastilka — alohida shakl
  // («Теймурова спрей» ≠ «Теймурова паста», «Пиковит сироп» ≠ «Пиковит пастилки»).
  ['pasta', /((^|[^a-zа-я])паст(а|ы)(?![а-я])|(^|[^a-z])pasta(?![a-z]))/], ['pastil', /(пастил|леден|pastil)/]];
const shakllar = (s) => { const t = normNom(qavsSiz(s)); return new Set(SHAKL_TUR.filter(([, re]) => re.test(t)).map(([k]) => k)); };
const SHAKL_YAQIN = { rastvor: ['rastvor', 'ukol', 'suyuq', 'tomchi', 'spirt', 'masl', 'sprei'], spirt: ['spirt', 'rastvor'], masl: ['masl', 'rastvor', 'kaps'] };
const SURTMA = ['maz', 'krem', 'gel'];

const BIRLIK = [[/^(мкг|mcg|mkg)$/, 'мкг'], [/^(мг|mg)$/, 'мг'], [/^(мл|ml)$/, 'мл'], [/^(гр|г|g|gr)$/, 'г'], [/^(ме|ед|iu|me|tme)$/, 'ме'], [/^%$/, '%'],
  [/^(мм|mm)$/, 'мм'], [/^(см|sm|cm)$/, 'см'], [/^(м|m)$/, 'м'], [/^(л|l)$/, 'л'], [/^(кг|kg)$/, 'кг'], [/^(доз|доза|дозы|doz)$/, 'доз']];
const DONA_U = /^(ta|dona|шт)$/;
// iOS 16.4 dan eski iPhone (Safari) «(?<!…)» (lookbehind)ni bilmaydi: regex LITERAL bo'lsa butun modul — va u bilan butun
// ilova — ochilmay oq ekran bo'lardi (audit 06.11). Shuning uchun matndan yasaladi; eski telefonda — lookbehind'siz taxminiy shakl.
const reYasa = (yangi, eski, f) => { try { return new RegExp(yangi, f); } catch (e) { return new RegExp(eski, f); } };
const RE_KASR = reYasa(String.raw`(?<!\d)(?<!\d\.)(\d+(?:\.\d+)?)\s*([+/])\s*(\d+(?:\.\d+)?)\s*(мкг|мг|гр|г|ме|ед)(?![a-zа-я])`,
  String.raw`(\d+(?:\.\d+)?)\s*([+/])\s*(\d+(?:\.\d+)?)\s*(мкг|мг|гр|г|ме|ед)(?![a-zа-я])`, 'g');
const RE_SON = reYasa(String.raw`(?:№|(?<![a-zа-я])n)\s*(\d+)(?!\d|\.\d)|(?<!\d)(?<!\d\.)(\d+(?:\.\d+)?)(?![\d])\s*([a-zа-я%]+)?`,
  String.raw`(?:№|n)\s*(\d+)(?!\d|\.\d)|(\d+(?:\.\d+)?)(?![\d])\s*([a-zа-я%]+)?`, 'g');
const yaxlit = (n) => String(Math.round(n * 1e6) / 1e6);
// Doza, hajm va dona. dozalar — to'plam, dl — ro'yxat (125мг/125мг ikki marta), г → мг; bir — birliksiz sonlar (xodim «150» deb yozishi mumkin);
// kombi — bir xil birlikli X/Y yoki X+Y bor birliklar; ekv — %↔мг/мл tengi (Атропин 1мг/мл = 0,1%).
// Son tahlili: «100 000 ЕД», «100.000 ЕД» — minglik; «х» — ajratuvchi (2х1000); «1,0г+1,0» — birlik meros; «/1г» maxraji; «360см» butun.
export function sonlar(s) {
  const dozalar = new Set(), dl = [], sonlarT = new Set(), bir = new Set(); let dona = null;
  let t = normNom(qavsSiz(s));
  t = t.replace(/(\d)\s+(000)(?!\d)/g, '$1$2').replace(/(\d)\s+(000)(?!\d)/g, '$1$2')
    .replace(/\b([1-9]\d{0,2})\.(\d{3})(?=\.?\s*(ед|ме|me|iu))/g, '$1$2')
    .replace(/(\d)\s*[хx×*]\s*(?=\d)/g, '$1 * ').replace(/([a-zа-я])[хx×*](?=\d)/g, '$1 * ')
    .replace(/\/\s*1(?:[.,]0)?\s*(г|гр|g)(?![a-zа-я])/g, '/$1')
    .replace(/(\d)\s*(мкг|мг|гр|г|ме|ед|%)\s*([+/])\s*(\d+(?:\.\d+)?)(?!\s*[\d.a-zа-я%])/g, '$1$2$3$4$2')
    .replace(RE_KASR, '$1$4$2$3$4');
  for (const m of t.matchAll(RE_SON)) {
    if (m[1]) { if (dona == null) dona = Number(m[1]); continue; }
    const n = Number(m[2]), u0 = m[3] || '';
    if (DONA_U.test(u0)) { dona = n; continue; }
    const bu = (BIRLIK.find(([re]) => re.test(u0)) || [])[1];
    sonlarT.add(String(n));
    if (!bu) { bir.add(String(n)); continue; }
    const k = bu === 'г' ? yaxlit(n * 1000) + 'мг' : yaxlit(n) + bu;
    dozalar.add(k); dl.push(k);
  }
  const ekv = new Set();
  for (const m of t.matchAll(/(\d+(?:\.\d+)?)\s*мг\s*\/\s*(мл|г)(?![a-zа-я])/g)) ekv.add(yaxlit(Number(m[1]) / 10) + '%');
  for (const d of dl) if (d.endsWith('%')) ekv.add(yaxlit(parseFloat(d) * 10) + 'мг/мл');
  const kombi = new Set();
  const nu = (u) => (/^г/.test(u) ? 'мг' : u === 'ед' ? 'ме' : u);
  for (const m of t.matchAll(/(\d+(?:\.\d+)?)\s*(мкг|мг|гр|г|ме|ед|%)\s*[+/]\s*(\d+(?:\.\d+)?)\s*(мкг|мг|гр|г|ме|ед|%)/g)) if (nu(m[2]) === nu(m[4])) kombi.add(nu(m[2]));
  return { dozalar, dl, dona, sonlar: sonlarT, bir, kombi, ekv };
}

// Damerau (qo'shni harflar almashishi — 1) Levenshtein, chegara bilan: harf adashishi, tushib qolishi, ortiqchasi, «Клопидагрел».
export function farq(a, b, max = 3) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let pp = null, p = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const c = [i]; let eng = i;
    for (let j = 1; j <= b.length; j++) {
      c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (pp && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) c[j] = Math.min(c[j], pp[j - 2] + 1);
      if (c[j] < eng) eng = c[j];
    }
    if (eng > max) return max + 1;
    pp = p; p = c;
  }
  return p[b.length];
}
// Kelishik qo'shimchasi (Атропина ↔ Атропин) — bir xil so'z.
const ildiz = (x) => x.replace(/(ovaia|evaia|aia|oi|ii|ia|a|i|e|o|u)$/, '');
// So'z mos: aynan (0); kelishik farqi (0); biri ikkinchisining boshi, 2+ harf farq bilan (≥ 6 harf; brend bo'lmasa ≥ 5) — 1;
// 1 (≥ 6 harf) / 2 (≥ 10 harf) harf xato. Qisqa nomda xato ruxsati yo'q: «Микон» ↔ «Миксон», «Амлодипин» ↔ «Амрадипин» — boshqa dorilar.
export function sozMos(a, b, brendmi = false) {
  if (a === b) return 0;
  if (a.length >= 6 && b.length >= 6 && ildiz(a) === ildiz(b)) return 0;
  const q = Math.min(a.length, b.length);
  const boshi = (b.startsWith(a) || a.startsWith(b)) && Math.abs(b.length - a.length) >= 2;
  if (boshi && (q >= 6 || (q >= 5 && !brendmi))) return 1;
  const ruxsat = q >= 10 ? 2 : q >= 6 ? 1 : 0;
  const d = ruxsat ? farq(a, b, ruxsat) : 1;
  return d <= ruxsat ? d : -1;
}
// Variant so'zlari — ikki tomonda ham qat'iy (Энап ↔ Энап HL, Рингер ↔ Рингер Лактат, Сиофор ↔ Сиофор XR, Канефрон Н ↔ Канефрон SP).
const VARIANT = new Set(['forte', 'plius', 'plus', 'neo', 'ekspres', 'express', 'laktat', 'detski', 'kids', 'kid', 'iunior', 'junior', 'bebi', 'baby', 'aktiv', 'maks',
  'max', 'long', 'retard', 'duo', 'trio', 'kombi', 'combi', 'lait', 'mini', 'super', 'ekstra', 'extra', 'ultra', 'total', 'kardio', 'bronho', 'hotmiks', 'malish', 'mite',
  'rapid', 'start', 'sr', 'xr', 'hl', 'nd', 'od', 'kvik', 'kviktab', 'zinkum', 'sink', 'dh', 'dks', 'gami', 'gumi', 'advans', 'ekspektorant', 'antistres', 'ekstrakt']
  .map((w) => qidiruvKalit(w)));
// Qisqa katta harfli kodlar (MR, SP, SD, DF, Н): zid kodlar — boshqa dori; bir tomonda bo'lsa — jarima. Lotin H = kirill Н.
const kodlar = (s) => new Set([...nomQismi(s).replace(/\([^)]*\)/g, ' ').matchAll(/(?:^|[\s\-.,])([A-ZА-ЯЁ]{1,4})(?=$|[\s\-.,])/g)]
  .map((m) => qidiruvKalit(m[1])).map((x) => (x === 'h' ? 'n' : x))
  .filter((x) => x && x.length <= 4 && !SHAKL_K.has(x) && !/^(i|v|x|d|s|l|m|xl|xxl|xs|mg|ml|me|ed)$/.test(x)));
// O'lcham (S/M/L/XL — kamar, bandaj) — mos kelishi shart.
const olchamlar = (x) => new Set([...nomQismi(x).matchAll(/(?:^|[\s.,(])(?:р\.?\s*|раз\.?\s*)?(XXL|XL|XS|S|M|L)(?=$|[\s.,)№])/g)].map((m) => m[1]));
const birlikOf = (d) => d.replace(/^[\d.]+/, '');

// Har firma qatoriga bir marta hisoblanadigan narsalar (qator obyektida keshlanadi).
const tayyor = (q) => q._t || (q._t = { w: (() => { const w = muhim(q.nom); return w.length ? w : kalitSoz(qavsSiz(q.nom)).slice(0, 1); })(),
  s: sonlar(q.nom), alt: kalitSoz(qavsIchi(q.nom)).filter((x) => !SHAKL_K.has(x)), sh: shakllar(q.nom), k: kodlar(q.nom), o: olchamlar(q.nom),
  isl: new Set(kalitSoz(q.ishlab || '')) });
// Brend harfi bo'yicha indeks (≈20× kam nomzod): har harfga — shu harf bilan boshlanadigan brendli yoki qavs so'zli qatorlar.
export function indeksQur(qatorlar) {
  const ix = new Map();
  const qosh = (h, q) => { const l = ix.get(h); if (!l) ix.set(h, [q]); else if (l[l.length - 1] !== q) l.push(q); };
  for (const q of qatorlar) {
    const t = tayyor(q);
    if (t.w[0]) qosh(t.w[0][0], q);
    for (const a of t.alt) qosh(a[0], q);
  }
  return ix;
}
// Hamma firmalardagi brendlar (aynan shu brend biror firmada bo'lsa — harf xatoli moslik va qavsdagi analog berilmaydi).
export const brendlarTop = (qatorlar) => new Set(qatorlar.map((q) => tayyor(q).w[0]).filter(Boolean));

// Defektura nomi → shu firmaning eng mos qatori: { ...qator, aniq } yoki null.
// Shart: brend mos (harf xatosi bilan ham; yoki firma nomining qavsidagi modda nomi); defekturadagi har muhim so'z firma nomida bor
// (ishlab chiqaruvchi so'zi — shart emas); doza firma nomida bor (birlikli doza — xuddi shu birlikda, bir necha bo'lsa — hammasi);
// birliksiz son ham bor; dona (ikkalasida bo'lsa) teng; dori shakli zid emas; variant so'zi (Форте, XR, Лактат…) ikki tomonda bir xil.
// qatorlar — firmaning hamma qatorlari yoki indeksQur() dan shu harfning ro'yxati (Map berilsa — o'zi tanlaydi).
// bilingan — brendlarTop() (ixtiyoriy): defekturadagi brend biror firmada aynan bor bo'lsa, xatoli brend va analog qidirilmaydi.
export function mosla(nom, qatorlar, bilingan = null) {
  const w = muhim(nom).length ? muhim(nom) : kalitSoz(qavsSiz(nom)).slice(0, 1);
  if (!w.length) return null;
  const b = w[0], s = sonlar(nom), sh = shakllar(nom), isl = ishlabSoz(nom), kk = kodlar(nom), so = olchamlar(nom);
  const rows = qatorlar instanceof Map ? [...new Set([...(qatorlar.get(b[0]) || [])])] : qatorlar;
  const bor = !!(bilingan && bilingan.has(b));
  let eng = null, ball = -1e9;
  for (const q of rows) {
    const t = tayyor(q), qw = t.w;
    if (!qw.length) continue;
    let bf = qw[0][0] === b[0] ? sozMos(b, qw[0], true) : -1, qavs = false;
    if (bor && bf > 0 && ildiz(b) !== ildiz(qw[0])) bf = -1;
    if (bf < 0) {
      if (bor) continue;
      let best = -1;
      for (const x of t.alt) { const d = sozMos(b, x, true); if (d >= 0 && (best < 0 || d < best)) best = d; }
      if (best < 0) continue;
      bf = best; qavs = true;
    }
    // Defekturadagi har muhim so'z — firma nomida (yoki qavsida); ishlab chiqaruvchi so'zi shart emas.
    if (w.slice(1).some((x) => !qw.slice(1).some((y) => sozMos(x, y) >= 0) && !isl.has(x) && !t.alt.some((y) => sozMos(x, y) >= 0))) continue;
    const qs = t.s;
    let yoqDoza = 0, bad = false;
    const fl = [...qs.dl];
    for (const d of s.dl) {
      const i = fl.indexOf(d);
      if (i >= 0) { fl.splice(i, 1); continue; }
      const u = birlikOf(d), v = parseFloat(d);
      if (qs.ekv.has(d)) continue;
      if (u === 'мл' && qs.dl.includes(d)) continue;
      if (qs.dl.some((x) => birlikOf(x) === u)) { bad = true; break; }
      if (qs.bir.has(String(v)) || (u === 'мг' && qs.bir.has(String(v / 1000)))) continue;
      if (u === '%' && [...qs.ekv].some((x) => x.endsWith('%'))) { bad = true; break; }
      if (u === 'мг' && [...s.ekv].some((x) => x.endsWith('%')) && qs.dl.includes([...s.ekv].find((x) => x.endsWith('%')))) continue;
      // Firmada bu doza yo'q: boshqa dozasi bo'lsa — boshqa dori (Сиофор 850 ↔ 1000); umuman dozasiz bo'lsa — taxminiy (Монтулар «№100»).
      if (u !== '%' && u !== 'ме' && (qs.dl.length || qs.bir.size || (u === 'мл' && qs.dona > 1))) { bad = true; break; }
      yoqDoza++;
    }
    if (bad || (yoqDoza && bf > 0)) continue;
    const fv = qs.dl.map((d) => parseFloat(d));
    if (![...s.bir].every((x) => { const n = Number(x); return qs.bir.has(x) || fv.includes(n) || (n < 10 && fv.includes(n * 1000)) || (s.dona == null && qs.dona === n); })) continue;
    if (s.dona != null && qs.dona != null && s.dona !== qs.dona) continue;
    if (s.dona > 1 && qs.dona == null && qs.dl.some((x) => /(мл|мг)$/.test(x)) && !s.dl.some((x) => /(мл|мг)$/.test(x))) continue;
    // Firmada bir xil birlikli dozalar ko'p (X/Y, X+Y) — kombinatsiya (Роксера плюс 10/10 ↔ 20/10).
    const sana = (l) => l.reduce((m, d) => { const u = birlikOf(d); m[u] = (m[u] || 0) + 1; return m; }, {});
    const cs = sana(s.dl), cf = sana(qs.dl);
    if (Object.keys(cs).some((u) => (cf[u] || 0) > cs[u] && qs.kombi.has(u))) continue;
    let jarima = 0;
    if (sh.size && t.sh.size) {
      const qattiq = (set) => [...set].filter((x) => !['rastvor', 'spirt', 'masl'].includes(x));
      const ch = qattiq(sh), fh = qattiq(t.sh);
      if (ch.length && fh.length) {
        // Pastilka ↔ «таб. д/рассас.» — yaqin (jarima bilan; audit 05.11: «Стрепсилс пастилки» firma «таб. д/рассас.» nomini topsin).
        const pt = (a, b) => a.includes('pastil') && b.includes('tab');
        if (!ch.some((x) => fh.includes(x))) { if ((ch.some((x) => SURTMA.includes(x)) && fh.some((x) => SURTMA.includes(x))) || pt(ch, fh) || pt(fh, ch)) jarima = 1; else continue; }
      } else if (![...sh].some((x) => t.sh.has(x) || (SHAKL_YAQIN[x] || []).some((y) => t.sh.has(y)) || [...t.sh].some((y) => (SHAKL_YAQIN[y] || []).includes(x)))) continue;
      if ((sh.has('spirt') && t.sh.has('masl')) || (sh.has('masl') && t.sh.has('spirt'))) continue;
    }
    const ortiqW = qavs ? [] : qw.slice(1).filter((y) => !w.slice(1).some((x) => sozMos(x, y) >= 0));
    if (ortiqW.some((y) => VARIANT.has(y))) continue;
    const fk = [...t.k].filter((x) => !kk.has(x) && !w.includes(x)), ck = [...kk].filter((x) => !t.k.has(x) && !qw.includes(x));
    if (fk.some((x) => VARIANT.has(x)) || (fk.length && ck.length)) continue;
    if (so.size && t.o.size && ![...so].some((x) => t.o.has(x))) continue;
    const kodJ = jarima + fk.length + ck.length;
    const ortiq = ortiqW.length;
    const ortiqDoza = [...qs.dozalar].filter((x) => !s.dozalar.has(x) && !s.ekv.has(x)).length;
    if (s.dozalar.size && ortiqDoza && (ortiq || bf > 0)) continue;
    const donasiz = s.dona != null && qs.dona == null;
    const sonBonus = [...s.bir].filter((x) => qs.dl.some((d) => parseFloat(d) === Number(x))).length * 0.5;
    const ishlabBonus = isl.size && [...isl].some((x) => t.isl.has(x)) ? 0.5 : 0;   // katalogda yozilgan ishlab chiqaruvchi — afzal
    const b2 = -bf * 6 - (qavs ? 8 : 0) - ortiq * 3 - (s.dozalar.size ? ortiqDoza * 4 : 0) - (s.dona == null && qs.dona != null ? 1 : 0) - (donasiz ? 2 : 0)
      - yoqDoza * 3 - kodJ * 2 + sonBonus + ishlabBonus;
    if (b2 > ball || (b2 === ball && q.yuz < eng.yuz)) {
      ball = b2;
      eng = { ...q, aniq: bf === 0 && !qavs && ortiq === 0 && s.dozalar.size > 0 && ortiqDoza === 0 && (s.dona == null || qs.dona === s.dona) && !yoqDoza && !kodJ && !donasiz };
    }
  }
  if (eng) delete eng._t;
  return eng;
}

// Oson'ga kirgan dori defekturadagi dorimi (05.11; foydalanuvchi: "dori kelganini Oson'ga kiritilganidan bilishi kerak").
// mosla shartlari (muhim so'zlar, doza, dona, shakl, variant) + brend qat'iyroq: aynan (yoki kelishik farqi) yoki 8+ harfda
// bitta harf xatosi, uzunligi deyarli bir xil («Furadanin» = «Фурадонин»). Brendning boshi mos kelishi yetmaydi
// («Traneksa» ≠ «Транексамовая кислота»), qavsdagi muqobil nom ham hisobga olinmaydi — xato «Keldi» bo'lmasin.
export function kelganMos(defNom, osonNom, ishlab = '') {
  const m = mosla(defNom, [{ nom: osonNom, ishlab, yuz: 0 }]);
  if (!m) return null;
  const a = brend(defNom), b = brend(osonNom);
  if (!a || !b) return null;
  const teng = a === b || (a.length >= 6 && b.length >= 6 && ildiz(a) === ildiz(b));
  const xato = !teng && Math.min(a.length, b.length) >= 8 && Math.abs(a.length - b.length) <= 1 && farq(a, b, 1) <= 1;
  if (!teng && !xato) return null;
  // Taxminiy moslik faqat defekturada shakl yoki son bo'lsa (audit 05.11): «Анальгин», «Нурофен», «Цитрамон П» — qaysi shakli
  // kelgani noma'lum (ukol, bolalar suspenziyasi…), xato «Keldi» bo'lmasin. Aniq moslik — doim.
  if (!m.aniq) {
    const s = sonlar(defNom);
    if (!shakllar(defNom).size && !s.dozalar.size && !s.bir.size && s.dona == null) return null;
  }
  return { aniq: m.aniq };
}
