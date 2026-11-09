// Hisobdan chiqarish va firmaga qaytarish (07.11 tun; server 20261107260000_hisobdan_chiqarish — ilova.chiqarish_yoz,
// chiqarish_royxat, chiqarish_bekor). Faqat serverda. Ilova faqat YOZIB QO'YADI — Oson'ga hech narsa yozmaydi: xodim Oson'da
// hisobdan chiqarishni / qaytarishni o'zi qiladi. Tartib: avval shu yerda (ilova sonni Oson qoldig'i bilan tekshiradi), keyin Oson'da.
// - chiqarishTugma / chiqarishOyna: Qoldiq → dori oynasi, «Muddati yaqin» va xodim Bosh → «Muddati o'tgan dorilar»: tur, soni
//   (quti + ochilgan qutidan dona), sabab, izoh, firma (qaytarishda; standart — Oson'dagi oxirgi kelgan firma).
// - chiqarishView: direktor — «Hisobdan chiqarilganlar»: davr, jami, oyma-oy, sabab va firma bo'yicha (firma qarzidan kamaytirish
//   avtomatik EMAS — faqat ko'rsatiladi), ro'yxat (bosilsa — tafsilot va «Bekor qilish», sabab bilan).
import * as H from './hisob.mjs';
import { h, input, kartaSarlavha, pills, sana, sheet, vaqt, yordam } from './ui.mjs';
import { qoldiqMatn, yanaRoyxat } from './oson-qoldiq.mjs';

export const TURLAR = [['hisobdan', 'Hisobdan chiqarish'], ['qaytarish', 'Firmaga qaytarish']];
export const SABABLAR = [['muddati_otgan', 'Muddati o\'tgan'], ['singan', 'Singan / shikastlangan'], ['sifatsiz', 'Sifatsiz'],
  ['qaytarildi', 'Mijoz qaytardi'], ['boshqa', 'Boshqa']];
const SABAB_NOM = Object.fromEntries(SABABLAR);
const TUR_NOM = { hisobdan: 'Hisobdan chiqarildi', qaytarish: 'Firmaga qaytarildi' };
const OY = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'];
const oyNomi = (k) => (/^\d{4}-\d{2}$/.test(k || '') ? OY[Number(k.slice(5, 7)) - 1] + ' ' + k.slice(0, 4) : k || '');
const asl = (t) => h('span', { 'data-asl': '' }, t);   // dori, firma, ism — Кирилл'ga o'tkazilmaydi
const astatka = (f) => /astatka|остат/i.test(f || '');
const som = (v, sotuv) => (v == null ? '—' : H.som(Math.round(Number(v) || 0)) + (sotuv ? '*' : ''));

// Kim yoza oladi (tugma ko'rinishi; server baribir tekshiradi — ilova.inventar_ruxsat): direktor yoki shu filial xodimi
// (asosiy, ikkinchi ish joyi, vaqtincha), «Inventarizatsiya» funksiyasi yoqiq bo'lsa.
export function chiqarishRuxsat(ctx, filialId) {
  const x = ctx && ctx.x;
  if (!ctx || !ctx.server || !x) return false;
  if (x.rol === 'direktor') return true;
  if (((ctx.S && ctx.S.sozlama && ctx.S.sozlama.funksiyalar) || {}).x_inventar === false) return false;
  const ish = H.ishdagi(x, ctx.S || {}) || x;
  return !!filialId && [x.filialId, x.qoshimchaFilial, ish.filialId].includes(filialId);
}

// d — Oson qatori: { b (Oson filiali), p (mahsulot), nom, ishlab, soni, dona, firma, otgan }.
export function chiqarishTugma(ctx, d, done, cls = 's') {
  return h('button', { type: 'button', class: cls + ' chiq-tugma', onclick: () => chiqarishOyna(ctx, d, done) }, 'Hisobdan chiqarish / Firmaga qaytarish');
}

export function chiqarishOyna(ctx, d, done) {
  sheet('Hisobdan chiqarish', (box, close) => {
    const f = { tur: 'hisobdan', sabab: d.otgan ? 'muddati_otgan' : null };
    const dn1 = d.dona > 1 ? d.dona : 0;
    const sonMaydon = { inputmode: 'numeric', pattern: '[0-9]*', enterkeyhint: 'done' };
    const q = input('Quti soni', { ...sonMaydon, placeholder: 'Masalan: 2' });
    const dn = dn1 ? input('Ochilgan qutidan dona soni (qutida ' + dn1 + ' ta)', sonMaydon) : null;
    const firma = input('Qaysi firmaga', { inputmode: 'text', value: astatka(d.firma) ? '' : d.firma || '', maxlength: '200', pul: false });
    const izoh = input('Izoh (ixtiyoriy)', { inputmode: 'text', maxlength: '300', pul: false });
    const firmaJoy = h('div', { style: 'display:none' }, firma.el);
    const sababXato = h('div', { class: 'err', role: 'alert' });
    const umumXato = h('div', { class: 'msg xato', role: 'alert', style: 'display:none' });
    const turQoy = (v) => {
      f.tur = v;
      firmaJoy.style.display = v === 'qaytarish' ? '' : 'none';
      izoh.yorliq(f.sabab === 'boshqa' ? 'Izoh — nima bo\'ldi?' : 'Izoh (ixtiyoriy)');
    };
    const saqla = h('button', { class: 'p', onclick: () => {
      umumXato.style.display = 'none';
      const qv = String(q.i.value).replace(/\s+/g, ''), dv = dn ? String(dn.i.value).replace(/\s+/g, '') : '';
      if (!/^\d{0,5}$/.test(qv) || Number(qv || 0) > 10000) { q.xato(dn ? 'Butun quti sonini yozing — ochilgan qutidagi donalarni pastdagi maydonga' : 'Butun son yozing'); q.i.focus(); return; }
      if (dv && !/^\d{1,4}$/.test(dv)) { dn.xato('Faqat butun son'); dn.i.focus(); return; }
      const quti = Number(qv || 0), dona = Number(dv || 0);
      if (dn && dona >= dn1) { dn.xato('Dona ' + dn1 + ' tadan kam bo\'lsin (qutida ' + dn1 + ' ta)'); dn.i.focus(); return; }
      if (quti + dona === 0) { q.xato('Sonni kiriting'); q.i.focus(); return; }
      const jami = quti + (dn1 ? dona / dn1 : 0);
      if (d.soni != null && jami > Number(d.soni) + 0.006) { q.xato('Oson\'da ' + qoldiqMatn(d.soni, d.dona) + ' bor — ko\'p yozildi'); q.i.focus(); return; }
      if (!f.sabab) { sababXato.textContent = 'Sababini tanlang'; return; }
      if (f.sabab === 'boshqa' && String(izoh.i.value).trim().length < 3) { izoh.xato('«Boshqa» — nima bo\'lganini yozing'); izoh.i.focus(); return; }
      const fm = String(firma.i.value).trim();
      if (f.tur === 'qaytarish' && fm.length < 2) { firma.xato('Firma nomini yozing'); firma.i.focus(); return; }
      saqla.disabled = true;
      Promise.resolve(ctx.amal('chiqarishYoz', d.b, d.p, f.tur, quti, dona, f.sabab, izoh.i.value, f.tur === 'qaytarish' ? fm : ''))
        .then((r) => {
          if (r == null) return;   // saqlanmadi — sababi xabarda, oyna ochiq qoladi
          close();
          ctx.toast((f.tur === 'qaytarish' ? 'Qaytarish' : 'Hisobdan chiqarish') + ' yozildi ✓ Endi Oson\'da ham qiling');
          CB.vaqt = 0;   // direktor ro'yxati keyingi ochilishda yangidan
          if (done) done(r);
        }, (e) => { umumXato.textContent = (e && e.message) || 'Saqlanmadi'; umumXato.style.display = ''; })
        .finally(() => { saqla.disabled = false; });
    } }, 'Saqlash');
    box.append(
      h('b', { class: 'oq-sheet-nom', 'data-asl': '' }, d.nom),
      d.ishlab ? h('div', { class: 'muted', 'data-asl': '' }, d.ishlab) : null,
      d.soni != null ? h('div', { class: 'muted' }, 'Oson\'da: ', h('b', {}, qoldiqMatn(d.soni, d.dona)), d.fn ? ' · ' + d.fn : '') : null,
      h('div', { class: 'msg info' }, 'Ilova faqat yozib qo\'yadi — Oson\'da hisobdan chiqarishni (qaytarishni) o\'zingiz qilasiz. Avval shu yerda yozing, keyin Oson\'da.'),
      pills(TURLAR, f.tur, turQoy, 'Turi'),
      q.el, dn ? dn.el : null,
      h('b', {}, 'Sababi'), pills(SABABLAR, f.sabab, (v) => { f.sabab = v; sababXato.textContent = ''; turQoy(f.tur); }, 'Sababi'), sababXato,
      firmaJoy, izoh.el, umumXato, saqla);
    turQoy(f.tur);
  }, { fokus: false });
}

// ---------- Direktor: «Hisobdan chiqarilganlar» ----------
const CBB = () => ({ j: null, kun: 30, kalit: 0, vaqt: 0, yuklanmoqda: null, xato: null, ochiq: false });
const CB = CBB();
export function chiqarishUnut() { Object.assign(CB, CBB()); }
const KORINADI = 30;

// Xatodan keyin ham 1 daqiqa kutiladi («Qayta urinish» — majbur): har chizishda yangi so'rov ketmasin.
function yukla(ctx, chiz, majbur = false) {
  if (CB.yuklanmoqda) return;
  if (!majbur && CB.kalit === CB.kun && (CB.j || CB.xato) && Date.now() - CB.vaqt < 60000) return;
  const kun = CB.kun;
  CB.yuklanmoqda = ctx.oqi('chiqarishRoyxat', kun)
    .then((j) => { if (!j || !Array.isArray(j.qatorlar)) throw new Error('Server javobi tushunarsiz'); if (CB.kun === kun) { CB.j = j; CB.xato = null; } })
      .catch((e) => { if (CB.kun === kun) CB.xato = (e && e.message) || 'Ro\'yxat olinmadi'; })
    .finally(() => { CB.kalit = kun; CB.vaqt = Date.now(); CB.yuklanmoqda = null; chiz(); });
}

export function chiqarishView(m, ctx, fil) {
  const chiz = () => ctx.rerender();
  if (!ctx.server) { m.append(h('div', { class: 'card muted' }, 'Hisobdan chiqarilganlar faqat Telegram ilovasida (serverda) ko\'rinadi.')); return; }
  yukla(ctx, chiz);
  m.append(h('div', { class: 'muted' }, 'Xodimlar Qoldiq → dori oynasida yoki Bosh sahifadagi «Muddati o\'tgan dorilar»da yozadi. Ilova Oson\'ga yozmaydi — bu ro\'yxat nazorat uchun.'),
    pills([[30, '30 kun'], [90, '90 kun'], [365, '1 yil']], CB.kun, (v) => { CB.kun = v; CB.ochiq = false; chiz(); }, 'Davr'));
  const j = CB.j && CB.kalit === CB.kun ? CB.j : null;
  if (!j) {
    m.append(CB.xato ? h('div', { class: 'card' }, h('div', { class: 'muted' }, CB.xato), h('button', { class: 's', onclick: () => { CB.xato = null; yukla(ctx, chiz, true); chiz(); } }, 'Qayta urinish'))
      : h('div', { class: 'card muted', role: 'status' }, 'Yuklanmoqda…'));
    return;
  }
  const dir = j.direktor !== false;
  m.append(h('div', { class: 'card hero chiq-jami' },
    h('span', { class: 'muted' }, 'So\'nggi ' + j.kun + ' kunda chiqarilgan' + (dir ? ' (taxminiy, kirim narxida)' : '')),
    h('span', { class: 'big' }, dir ? som(j.jami.summa) : j.jami.n + ' ta'),
    h('span', { class: 'muted' }, 'Hisobdan chiqarildi: ' + j.jami.hisobdan + ' · firmaga qaytarildi: ' + j.jami.qaytarish
      + (j.jami.sotuvNarx ? ' · * — kirim narxi yo\'q, sotuv narxida' : ''))));
  if (!j.qatorlar.length) { m.append(h('div', { class: 'card muted' }, '✓ Bu davrda hisobdan chiqarilgan yoki qaytarilgan dori yo\'q')); return; }
  // 3-audit: Oson bilan solishtirish to'xtagan (hujjatlar 1 kundan beri kelmagan) — jim emas (direktor «✓» yo'qligini sezmasdi).
  if (!j.osonTekshir && j.qatorlar.some((x) => !x.bekor && Date.now() - x.ts < 13 * 864e5)) {
    m.append(h('div', { class: 'msg info' }, 'Oson hujjatlari bilan solishtirish hozir ishlamayapti — oxirgi kunda Oson\'dan hujjatlar kelmagan. '
      + 'Aptekadagi kompyuterda kengaytma 0.9.20 o\'rnatilgan va Oson admin ochiq bo\'lsa, belgilar o\'zi qaytadi.'));
  }
  if (j.oylar.length) {
    const k = h('section', { class: 'card list' }, kartaSarlavha('Oyma-oy'));
    j.oylar.forEach((o) => k.append(h('div', { class: 'line' }, h('span', {}, oyNomi(o.oy) + ' · ' + o.n + ' ta'),
      h('span', {}, dir ? [h('b', {}, som(o.summa)), h('small', { class: 'muted' }, ' (hisobdan ' + som(o.hisobdan) + ', qaytarish ' + som(o.qaytarish) + ')')] : null))));
    m.append(k);
  }
  if (j.sabablar.length) {
    const k = h('section', { class: 'card list' }, kartaSarlavha('Sabab bo\'yicha'));
    j.sabablar.forEach((s) => k.append(h('div', { class: 'line' }, h('span', {}, (SABAB_NOM[s.sabab] || s.sabab) + ' · ' + s.n + ' ta'), dir ? h('b', {}, som(s.summa)) : null)));
    m.append(k);
  }
  if (j.firmalar.length) {
    const k = h('section', { class: 'card list' }, kartaSarlavha('Firmalarga qaytarilgan'),
      h('div', { class: 'muted' }, 'Firma qarzidan avtomatik ayirilmaydi — ta\'minotchi bilan kelishib, Ta\'minot bo\'limida o\'zingiz yozing.'));
    j.firmalar.forEach((x) => k.append(h('div', { class: 'line' }, h('span', {}, asl(x.firma), ' · ' + x.n + ' ta'), dir ? h('b', {}, som(x.summa)) : null)));
    m.append(k);
  }
  const ro = h('section', { class: 'card list' }, kartaSarlavha('Yozuvlar (' + j.qatorlar.length + (j.soni > j.qatorlar.length ? ' / ' + j.soni : '') + ')'));
  // Audit 10.11 kech: «Yana» — keyingi 50 tasi shu joyga qo'shiladi (avval qolgani bir yo'la, butun sahifa qayta chizilardi).
  yanaRoyxat(ro, j.qatorlar, Number(CB.ochiq) || KORINADI, (x) => qatorEl(ctx, x, fil, chiz, dir), (n) => { CB.ochiq = n; }, { boshi: KORINADI, yig: chiz });
  m.append(ro, yordam('Summa — taxminiy: muddati o\'tganda eng yaqin muddatli partiyalar tannarxi, bo\'lmasa qoldiq tannarxi yoki oxirgi kirim narxi (Oson). Kirim narxi bo\'lmasa — sotuv narxi (*). '
    + 'Xato yozilgan yozuvni bosib «Bekor qilish» (sababi bilan) — yozuv o\'chmaydi, jamlarga kirmaydi.'));
}

const filNomi = (fil, x) => (x.f && fil ? fil(x.f) : x.fn || '');
function qatorEl(ctx, x, fil, chiz, dir) {
  const bekor = !!x.bekor;
  return h('button', { type: 'button', class: 'item chiq-q' + (bekor ? ' bekor' : ''), onclick: () => tafsilot(ctx, x, fil, chiz, dir) },
    h('div', { class: 'line', style: 'border:0;padding:0' }, h('span', { 'data-asl': '' }, x.nom),
      h('b', {}, qoldiqMatn(x.soni, x.dona))),
    h('div', { class: 'muted' }, (x.tur === 'qaytarish' ? '↩ ' : '🗑 ') + (SABAB_NOM[x.sabab] || x.sabab), ' · ', asl(filNomi(fil, x)),
      x.tur === 'qaytarish' && x.firma ? [' · ', asl(x.firma)] : null,
      ' · ', asl(x.kim || ''), ' · ' + sana(x.ts) + ' ' + vaqt(x.ts),
      dir && x.summa != null ? ' · ' + som(x.summa, x.narxTur === 'sotuv') : null),
    bekor ? h('div', { class: 'belgi ogoh', style: 'align-self:flex-start' }, 'Bekor qilingan: ', asl(x.bekor.sabab || '')) : null,
    bekor ? null : osonBelgi(x));
}
// 10.11 tun (server 20261110210000): Oson'dagi hisobdan chiqarish / qaytarish hujjati bilan solishtirish. Server faqat Oson
// hujjatlari oxirgi kunda kelgan bo'lsa belgi beradi: {raqam, sana} — Oson'da bor; false — hali yo'q (1 kundan keyin — sariq).
export function osonBelgi(x) {
  if (!x || !('oson' in x)) return null;
  if (x.oson && typeof x.oson === 'object' && x.oson.qoralama) {
    return h('div', { class: 'belgi oson-b ogoh' }, 'Oson\'da №' + (x.oson.raqam == null ? '?' : x.oson.raqam) + ' hujjat bor, lekin faollashtirilmagan — Oson\'da «Faollashtirish»ni bosing');
  }
  if (x.oson && typeof x.oson === 'object') return h('div', { class: 'belgi ok oson-b' }, '✓ Oson\'da ' + (x.tur === 'qaytarish' ? 'qaytarilgan' : 'chiqarilgan') + ' (№' + (x.oson.raqam == null ? '?' : x.oson.raqam) + ')');
  if (x.oson === false) {
    const kech = Date.now() - (Number(x.ts) || 0) > 864e5;
    return h('div', { class: 'belgi oson-b ' + (kech ? 'ogoh' : 'muted') },
      kech ? '⚠ Oson\'da ' + (x.tur === 'qaytarish' ? 'qaytarish' : 'hisobdan chiqarish') + ' hujjati topilmadi — tekshiring' : 'Oson\'da hali ko\'rinmadi');
  }
  return null;
}

function tafsilot(ctx, x, fil, chiz, dir) {
  sheet(TUR_NOM[x.tur] || 'Yozuv', (box, close) => {
    const qator = (l, v) => (v == null || v === '' ? null : h('div', { class: 'line' }, h('span', { class: 'muted' }, l), h('b', {}, v)));
    box.append(h('b', { class: 'oq-sheet-nom', 'data-asl': '' }, x.nom), x.ishlab ? h('div', { class: 'muted', 'data-asl': '' }, x.ishlab) : null,
      qator('Soni', qoldiqMatn(x.soni, x.dona)), qator('Sababi', SABAB_NOM[x.sabab] || x.sabab), qator('Filial', asl(filNomi(fil, x))),
      x.tur === 'qaytarish' ? qator('Firma', asl(x.firma)) : null, qator('Izoh', x.izoh ? asl(x.izoh) : null),
      qator('Yozdi', [asl(x.kim || ''), ' · ' + sana(x.ts) + ' ' + vaqt(x.ts)]),
      dir ? qator('Summa (taxminiy)', som(x.summa, x.narxTur === 'sotuv')) : null,
      x.muddat ? qator('Muddati', String(x.muddat).slice(0, 10).split('-').reverse().join('.')) : null,
      x.bekor ? null : osonBelgi(x));
    if (x.bekor) {
      box.append(h('div', { class: 'msg warn' }, 'Bekor qilingan: ', asl(x.bekor.sabab || ''), ' (', asl(x.bekor.kim || ''), ', ' + sana(x.bekor.ts) + ')'));
      return;
    }
    if (!dir || !ctx.amal) return;
    const sabab = input('Bekor qilish sababi', { inputmode: 'text', maxlength: '300', pul: false, placeholder: 'Masalan: adashib yozildi' });
    const tugma = h('button', { class: 's', onclick: () => {
      const s = String(sabab.i.value).trim();
      if (s.length < 2) { sabab.xato('Sababini yozing'); sabab.i.focus(); return; }
      tugma.disabled = true;
      Promise.resolve(ctx.amal('chiqarishBekor', x.id, s)).then((r) => {
        if (r == null) return;
        close();
        ctx.toast('Bekor qilindi');
        yukla(ctx, chiz, true);
      }, () => {}).finally(() => { tugma.disabled = false; });
    } }, 'Bekor qilish');
    box.append(h('div', { class: 'muted' }, 'Xato yozilgan bo\'lsa — bekor qiling (yozuv qoladi, jamlarga kirmaydi). Oson\'dagi yozuvni Oson\'da o\'zingiz tuzatasiz.'), sabab.el, tugma);
  }, { fokus: false });
}
