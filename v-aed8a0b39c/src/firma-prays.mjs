// Firmalar prayslari (30.10, foydalanuvchi: "defektura yozgan xodimlar endi — praysni qayerga tashlay, solishtirib ko'rsatsin").
// DOM'siz (Node testlarida ham ishlaydi): .xlsx o'qish (zip + inflate, kutubxonasiz), prays qatorlarini ajratish
// (sarlavhadan ustunlar — har firma fayli har xil), dori nomlarini moslash (defektura nomi ↔ firma nomi).
// Fayldagi rasmlar (17 MB gacha) o'qilmaydi — faqat jadval (2–4 MB).
import { qidiruvKalit } from './kalit.mjs';
import { brendlarTop, indeksQur, mosla } from './nom-mosla.mjs';
// Moslash funksiyalari nom-mosla.mjs da (05.11) — eski import yo'llari ishlashi uchun qayta eksport.
export * from './nom-mosla.mjs';

// ---------- Bo'lib bajarish (audit 10.11 kech, qotish) ----------
// indeksQur / brendlarTop hamma firmalarning 20 000+ qatori uchun bitta sinxron vazifada ishlardi (dori oynasi ochilganda ham) —
// telefon qotib qolardi. Endi har BOLAK qatordan keyin brauzerga navbat beriladi; natija aynan bir xil.
export const BOLAK = 500;
const tanaffus = () => new Promise((r) => setTimeout(r, 0));
// har(q) — har qatorga qo'shimcha ish (masalan qidiruv kaliti), shu bo'lak ichida.
export async function indeksQurBolib(qatorlar, har = null, qadam = BOLAK) {
  const ix = new Map();
  for (let i = 0; i < qatorlar.length; i += qadam) {
    const bol = qatorlar.slice(i, i + qadam);
    if (har) bol.forEach(har);
    for (const [k, l] of indeksQur(bol)) { const e = ix.get(k); if (e) { for (const q of l) e.push(q); } else ix.set(k, l); }
    if (i + qadam < qatorlar.length) await tanaffus();
  }
  return ix;
}
export async function brendlarBolib(qatorlar, qadam = BOLAK) {
  const s = new Set();
  for (let i = 0; i < qatorlar.length; i += qadam) {
    for (const b of brendlarTop(qatorlar.slice(i, i + qadam))) s.add(b);
    if (i + qadam < qatorlar.length) await tanaffus();
  }
  return s;
}

// ---------- .xlsx: zip markaziy katalogi → kerakli fayllar ----------
const u16 = (b, i) => b[i] | (b[i + 1] << 8);
const u32 = (b, i) => (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0;

function zipKatalog(b) {
  let e = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 70000); i--) if (u32(b, i) === 0x06054b50) { e = i; break; }
  if (e < 0) throw new Error('Bu .xlsx fayl emas (yoki buzilgan)');
  const soni = u16(b, e + 10);
  let p = u32(b, e + 16);
  const out = new Map();
  for (let k = 0; k < soni; k++) {
    if (u32(b, p) !== 0x02014b50) throw new Error('Fayl buzilgan (zip katalogi)');
    const usul = u16(b, p + 10), siqilgan = u32(b, p + 20), ochiq = u32(b, p + 24), n = u16(b, p + 28), x = u16(b, p + 30), iz = u16(b, p + 32), joy = u32(b, p + 42);
    const nom = new TextDecoder().decode(b.subarray(p + 46, p + 46 + n));
    out.set(nom, { usul, siqilgan, ochiq, joy });
    p += 46 + n + x + iz;
  }
  return out;
}

// Bitta ichki fayl ochilganda 80 MB dan oshmasin (audit 30.10: «siqilgan bomba» telefonni qotirmasin; haqiqiy jadval — 2–4 MB).
const OCHIQ_MAX = 80e6;
async function inflate(data) {
  if (typeof DecompressionStream !== 'function') throw new Error('Telefoningizdagi Telegram eskirgan — yangilang (fayl ochilmadi)');
  let ds;   // audit 09.11: 'deflate-raw' eski WebView'da yo'q — inglizcha xato o'rniga tushunarli matn
  try { ds = new DecompressionStream('deflate-raw'); } catch (e) { throw new Error('Telefoningizdagi Telegram eskirgan — yangilang (fayl ochilmadi)'); }
  const w = ds.writable.getWriter();
  w.write(data).catch(() => {}); w.close().catch(() => {});
  const r = ds.readable.getReader(), qism = [];
  let jami = 0;
  try {
    for (;;) {
      const { done, value } = await r.read();
      if (done) break;
      jami += value.length;
      if (jami > OCHIQ_MAX) { r.cancel().catch(() => {}); throw new Error('Fayl ichidagi jadval juda katta — bu prays emas'); }
      qism.push(value);
    }
  } catch (e) { if (/juda katta/.test(e.message)) throw e; throw new Error('Fayl buzilgan (ochilmadi)'); }
  const out = new Uint8Array(jami); let p = 0;
  for (const x of qism) { out.set(x, p); p += x.length; }
  return out;
}

async function zipOl(b, kat, nom) {
  const f = kat.get(nom);
  if (!f) return null;
  const p = f.joy;
  if (u32(b, p) !== 0x04034b50) throw new Error('Fayl buzilgan (zip)');
  if (f.ochiq > OCHIQ_MAX) throw new Error('Fayl ichidagi jadval juda katta — bu prays emas');
  const boshi = p + 30 + u16(b, p + 26) + u16(b, p + 28);
  if (boshi + f.siqilgan > b.length) throw new Error('Fayl buzilgan (oxiri yo\'q)');
  const data = b.subarray(boshi, boshi + f.siqilgan);
  const bayt = f.usul === 0 ? data : f.usul === 8 ? await inflate(data) : null;
  if (!bayt) throw new Error('Fayl siqilishi tanilmadi');
  return new TextDecoder().decode(bayt);
}

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: '\'' };
const kod = (n) => { try { return String.fromCodePoint(n); } catch (e) { return ''; } };
const xmlMatn = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (m, e) => (e[0] === '#'
  ? kod(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : ENT[e.toLowerCase()] || m));
// Teglar «x:» kabi nom maydoni prefiksi bilan ham bo'ladi (OpenXML SDK yozgan fayllar).
const tlar = (s) => { let t = ''; for (const m of s.matchAll(/<(?:\w+:)?t(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?t>/g)) t += m[1]; return xmlMatn(t); };
const ustunRaqami = (ref) => { let n = 0; for (const ch of /^[A-Z]+/.exec(ref)[0]) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };

// bayt (Uint8Array | ArrayBuffer) → [{ nom, qatorlar: [[katak, ...]] }]; katak — matn yoki son.
export async function xlsxOqi(bayt) {
  const b = bayt instanceof Uint8Array ? bayt : new Uint8Array(bayt);
  const kat = zipKatalog(b);
  const ss = [];
  const ssXml = await zipOl(b, kat, 'xl/sharedStrings.xml');
  if (ssXml) for (const m of ssXml.matchAll(/<(?:\w+:)?si>([\s\S]*?)<\/(?:\w+:)?si>/g)) ss.push(tlar(m[1].replace(/<(?:\w+:)?rPh[\s\S]*?<\/(?:\w+:)?rPh>/g, '')));
  const wb = await zipOl(b, kat, 'xl/workbook.xml');
  const rels = await zipOl(b, kat, 'xl/_rels/workbook.xml.rels');
  if (!wb || !rels) throw new Error('Bu Excel (.xlsx) fayl emas');
  const rmap = new Map([...rels.matchAll(/<Relationship\b[^>]*>/g)].map((m) => [/\bId="([^"]+)"/.exec(m[0])?.[1], /\bTarget="([^"]+)"/.exec(m[0])?.[1]]));
  const out = [];
  for (const m of wb.matchAll(/<(?:\w+:)?sheet\b[^>]*>/g)) {
    const nom = xmlMatn(/\bname="([^"]*)"/.exec(m[0])?.[1] || '');
    let t = rmap.get(/\br:id="([^"]+)"/.exec(m[0])?.[1]) || '';
    t = t.replace(/^\//, '');
    if (!t.startsWith('xl/')) t = 'xl/' + t;
    const xml = await zipOl(b, kat, t);
    if (!xml) continue;
    const qatorlar = [];
    for (const r of xml.matchAll(/<(?:\w+:)?row\b[^>]*>([\s\S]*?)<\/(?:\w+:)?row>/g)) {
      const q = [];
      let ustun = -1;
      for (const c of r[1].matchAll(/<(?:\w+:)?c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?c>)/g)) {
        const at = c[1], ich = c[2] || '';
        const ref = /\br="([A-Z]+)\d+"/.exec(at);
        ustun = ref ? ustunRaqami(ref[1]) : ustun + 1;   // r= yo'q — oldingisidan keyingi ustun
        if (ustun > 300) continue;
        const tur = /\bt="([^"]+)"/.exec(at)?.[1];
        let v;
        if (tur === 'inlineStr') v = tlar(ich);
        else {
          const vm = /<(?:\w+:)?v>([\s\S]*?)<\/(?:\w+:)?v>/.exec(ich);
          if (!vm) continue;
          v = tur === 's' ? ss[Number(vm[1])] ?? '' : tur === 'str' || tur === 'e' || tur === 'b' ? xmlMatn(vm[1]) : Number(vm[1]);
          if (typeof v === 'number' && !Number.isFinite(v)) v = vm[1];
        }
        q[ustun] = v;
      }
      if (q.length) qatorlar.push(Array.from(q, (x) => (x === undefined ? '' : x)));
    }
    out.push({ nom, qatorlar });
  }
  return out;
}

// ---------- Prays qatorlari: sarlavhadan ustunlar ----------
export const son = (v) => {
  if (typeof v === 'number') return v;
  let s = String(v ?? '').replace(/[\s\u00a0\u202f']/g, '');
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');        // 1.234,50
  else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '');                      // 1,234.50
  else s = s.replace(',', '.');
  return /^\d+(\.\d+)?$/.test(s) ? Number(s) : NaN;
};
// Nomdagi boshqaruv belgilari (\u0000 kabi — bazaga yozilmaydi) — bo'shliq.
const tozaMatn = (v) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
// Sarlavha qatori: nom ustuni va narx ustuni bor. Narx: «100%» (oldindan to'lov) va kechiktirilgan («отсрочк» / «договор»).
export function sarlavhaUstunlar(r) {
  const t = r.map((c) => String(c ?? '').replace(/\s+/g, ' ').trim().toLowerCase());
  const top = (re, yoq) => t.findIndex((x) => re.test(x) && !(yoq && yoq.test(x)));
  const nom = top(/наимен|назван|номи/);
  if (nom < 0) return null;
  const narxlar = t.map((x, i) => [x, i]).filter(([x]) => /цен|narx|price/.test(x) && !/бесплат|баз|без ндс|ндс %|^ндс$/.test(x));
  let yuz = (narxlar.find(([x]) => /100\s*%/.test(x) && /ндс/.test(x)) || narxlar.find(([x]) => /100\s*%/.test(x)) || [])[1];
  const kech = (narxlar.find(([x]) => /отсроч|договор|kechik/.test(x)) || [])[1];
  if (yuz === undefined) yuz = (narxlar.find(([x, i]) => i !== kech && /ндс/.test(x)) || narxlar.find(([, i]) => i !== kech) || [])[1];
  if (yuz === undefined && kech === undefined) return { nom, yuz: -1 };   // narxsiz bo'lim (aksiya, kutilayotgan tovarlar) — o'tkaziladi
  return { nom, yuz: yuz ?? kech, kech: kech !== undefined && kech !== yuz ? kech : -1, muddat: top(/срок|годн|muddat/), ishlab: top(/производ|ishlab/) };
}

// varaqlar → [{ nom, yuz, kech, muddat, ishlab }] (yuz — 100% to'lov narxi, kech — kechiktirilgan; bir nom va ishlab chiqaruvchi
// bir necha marta bo'lsa — arzoni).
export function praysAjrat(varaqlar) {
  const bir = new Map();
  for (const v of varaqlar) {
    let u = null;
    for (const r of v.qatorlar) {
      const s = sarlavhaUstunlar(r);
      if (s) { u = s; continue; }
      if (!u || u.yuz < 0) continue;
      const nom = tozaMatn(r[u.nom]);
      const yuz = son(r[u.yuz]);
      if (nom.length < 2 || nom.length > 200 || !(yuz > 0) || yuz > 1e9 || /^\d+([.,]\d+)?$/.test(nom)) continue;
      const kech = u.kech >= 0 ? son(r[u.kech]) : NaN;
      const md = u.muddat >= 0 ? r[u.muddat] : '';
      const x = { nom, yuz: Math.round(yuz), kech: kech > 0 && kech <= 1e9 ? Math.round(kech) : null,
        muddat: typeof md === 'number' ? excelSana(md) : tozaMatn(md).slice(0, 20),
        ishlab: u.ishlab >= 0 ? tozaMatn(r[u.ishlab]).slice(0, 120) : '' };
      // Bir nom — bir necha ishlab chiqaruvchi bo'lsa, alohida (narxi 2 baravar farq qilishi mumkin); bir xil — arzoni.
      const k = nom.toLowerCase() + '|' + x.ishlab.toLowerCase();
      const eski = bir.get(k);
      if (!eski || x.yuz < eski.yuz) bir.set(k, x);
    }
  }
  return [...bir.values()];
}
// Excel sana raqami (1900 tizimi) → DD.MM.YYYY.
function excelSana(n) {
  if (n >= 2958000) return '';   // 31.12.9999 — muddatsiz
  if (!(n > 20000 && n < 80000)) return String(n);
  const d = new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 864e5);
  return String(d.getUTCDate()).padStart(2, '0') + '.' + String(d.getUTCMonth() + 1).padStart(2, '0') + '.' + d.getUTCFullYear();
}

// ---------- Nom moslash ----------
// Xodimlar defekturani qo'lda ham yozadi — harf adashishi mumkin (foydalanuvchi 30.10): «Тромбапол», «Trombopol», «150» birliksiz.
// Shuning uchun so'zlar talaffuz kaliti bilan (H.qidiruvKalit: kirill = lotin, ts/c → s, y → i, takror harf bitta) va
// brendda 1–2 harf xatoga ruxsat bilan solishtiriladi; aniq bo'lmagan moslik «taxminiy» (aniq: false) — ekranda belgilanadi.
// Audit 30.10 (haqiqiy 3 prays × Torg zal 2051 nomi, 200 ta qo'lda baholangan moslik): taxminiy aniqligi ~84% → ~95%,
// topilish 68% → 73%, harf xatosida to'g'ri topish 87% → 95%. Qoidalar shu o'lchov bilan tanlangan — o'zgartirsangiz qayta o'lchang.
