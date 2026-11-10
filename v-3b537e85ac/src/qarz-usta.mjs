// Qarz yozish — 3 qadam (07.11, yangi ko'rinish; GOV.UK uslubi: har sahifada bitta savol):
// 1) «Kim qarzga oldi?» — ism-sharif, telefon (oldingi mijozlar — bir bosishda); 2) «Qancha?» — katta raqam, raqam tugmalari
// (000 va ⌫) va «Qachon qaytaradi?» 3/7/14/30 kun, limit eslatmasi; 3) «Tekshiring» — har qatorda «O'zgartirish», ogohlantirish,
// «Qarzni saqlash». Amal va tekshiruv — eski oynadagi bilan aynan bir xil (app.mjs qarzSheet: amalX('qarzYozish', forma),
// H.qarzTekshir, H.normTel, H.pul) — server qoidalari o'zgarmagan. Telefon majburiy: server (qarz_yozish) raqamsiz qarz yozmaydi.
// Xato (bu yerdagi tekshiruv yoki server qoidasi) — o'sha maydon tagida, kerak bo'lsa o'sha qadamga qaytib.
// Telegram «orqaga» — oldingi qadamga (1-qadamda — oyna yopiladi).
import * as H from './hisob.mjs';
import { asosiyTugma, h, input, pills, sana, sheet } from './ui.mjs';
import { qarzXabari } from './xabar.mjs';
import { haptik } from './qobiq.mjs';

const MUDDAT = [[3, '3 kun'], [7, '7 kun'], [14, '14 kun'], [30, '30 kun']];
const TUGMALAR = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '000', '0', '⌫'];
const MAX_RAQAM = 10;   // 9 999 999 999 so'm — qarz uchun yetadi (H.pul chegarasi 100 mlrd)

// Shu xodimning oldingi mijozlari (yangi birinchi, telefon bo'yicha bittadan) — bir bosishda ism va raqam.
export function oldingiMijozlar(qarzlar, xodimId, soni = 6) {
  const kor = new Set(), r = [];
  (qarzlar || []).filter((q) => q.xodimId === xodimId && q.holat !== 'rad').sort((a, b) => (b.berildi || 0) - (a.berildi || 0)).forEach((q) => {
    const t = H.normTel(q.tel);
    if (!t || kor.has(t) || r.length >= soni) return;
    kor.add(t); r.push({ ism: q.ism, tel: q.tel });
  });
  return r;
}

// Saqlanmadi — sababi bo'yicha matn (app.mjs bajar: { tur: 'eskirdi' | 'tarmoq' | 'server' | 'band' | 'qoida', matn }).
export function xatoMatni(x) {
  const tur = x && x.tur;
  if (tur === 'eskirdi') return 'Ilova eskirdi — yopib, Telegram\'dan qayta oching. Yozganlaringiz saqlanmadi.';
  if (tur === 'band') return 'Oldingi amal hali saqlanmoqda — bir soniyadan keyin «Qarzni saqlash»ni qayta bosing.';
  // Audit 10.11: tarmoq/server xatosida qarz serverda saqlangan bo'lishi mumkin — hech narsani o'zgartirmasdan qayta bosilsa
  // (bir xil kalit) ikki marta yozilmaydi; o'zgartirilsa — yangi qarz bo'lib qolardi.
  if (tur === 'server') return 'Server javob bermadi — saqlangan-saqlanmaganini bilib bo\'lmadi. Hech narsani o\'zgartirmasdan, biroz kutib «Qarzni saqlash»ni qayta bosing (ikki marta yozilmaydi).';
  if (tur === 'qoida' && x.matn) return x.matn;
  return 'Javob kelmadi — saqlangan-saqlanmaganini bilib bo\'lmadi. Internetni tekshirib, hech narsani o\'zgartirmasdan «Qarzni saqlash»ni qayta bosing (ikki marta yozilmaydi).';
}

// Telefon o'qishga qulay: +998 90 111 22 33 (noto'g'ri bo'lsa — yozilganicha).
export function telMatn(t) {
  const n = H.normTel(t);
  return n ? n.replace(/^\+998(\d{2})(\d{3})(\d{2})(\d{2})$/, '+998 $1 $2 $3 $4') : String(t || '');
}

// Raqam tugmasi: summa — faqat raqamlar matni ('150000'); boshida 0 bo'lmaydi.
export function raqamQosh(summa, k) {
  const s = String(summa || '');
  if (k === '⌫') return s.slice(0, -1);
  if (k === '000') return s && s.length + 3 <= MAX_RAQAM ? s + '000' : s;
  if (!/^\d$/.test(k) || (k === '0' && !s) || s.length >= MAX_RAQAM) return s;
  return s + k;
}

// ctx: { S: () => holat, x, amalX, toast }
export function qarzUsta(ctx) {
  const { x } = ctx;
  const f = { ism: '', tel: '', summa: '', muddatKun: 7, dorilar: '' };   // 09.11: dorilar nomi (ixtiyoriy) — mijoz botda ko'radi
  // 11.11 (pul auditi): ikkinchi ish joyi bo'lsa — qarz qaysi filialda berildi (kassa nazorati shu filial savdosiga qo'shadi;
  // «Kartaga tushdimi?» so'rovidagidek). Yo'q bo'lsa — tanlov ko'rinmaydi, forma avvalgidek (server asosiy ish joyini oladi).
  const uy = x && x.filialId, qf = (x && x.qoshimchaFilial) || ((ctx.S() || {}).men || {}).qoshimchaFilial;
  const tanlov = !!(uy && qf && qf !== uy);
  const fNom = (id) => (((ctx.S() || {}).filiallar || []).find((z) => z.id === id) || {}).nom || id;
  if (tanlov) f.filial = uy;
  const xato = { ism: '', tel: '', summa: '', muddat: '', umumiy: '' };
  let qadam = 1, band = false, chizish = null;
  const qarzlar = () => (ctx.S().qarzlar || []).filter((q) => q.holat !== 'rad');
  const tekshir = () => H.qarzTekshir(f, qarzlar(), x.id, ctx.S().sozlama);
  // Eski oyna bilan bir xil matnlar (app.mjs qarzSheet).
  const ismXato = () => (String(f.ism).trim().length < 3 ? 'Ism-sharifni to\'liq yozing' : '');
  const telXato = () => (H.normTel(f.tel) ? '' : 'Raqam noto\'g\'ri — masalan: 90 123 45 67');
  const summaXato = () => (!f.summa ? 'Summani yozing' : H.pul(f.summa) == null ? 'Raqam noto\'g\'ri — masalan: 1 250 000' : '');

  sheet('Qarz yozish', (box, close) => {
    const ichi = h('div', { class: 'qu' });
    const past = h('div', { class: 'qu-past' });
    box.append(ichi, past);
    let maydon = null;   // shu qadamdagi birinchi xatoli maydon (fokus uchun)
    // 07.11 tun: Telegram asosiy tugmasi (ekran pastida, klaviatura ustida) — shu qadamning asosiy amali; ko'ringanda sahifadagi
    // nusxasi yashiriladi, Telegram eski bo'lsa yoki brauzerda — sahifadagi tugma. Oyna yopilganda — tozalanadi (sheet chaqiradi).
    const asosiy = asosiyTugma({ oyna: box, bosildi: () => (qadam === 1 ? keyingi1() : qadam === 2 ? keyingi2() : saqla()) });
    // Tugma yetarli yozilgandagina yonadi; bosilsa — to'liq tekshiruv (xato maydon tagida, avvalgidek).
    const tayyormi = () => (qadam === 1 ? String(f.ism).trim().length >= 3 && String(f.tel).replace(/\D/g, '').length >= 9 : qadam === 2 ? !!f.summa : true);
    const asosiyYangila = () => {
      asosiy.yangila({ faol: true, band });   // audit 07.11: doim faol — bosilsa maydon tagida sabab (kul tugma jim turmasin)
      // Pastki qatorda boshqa ko'rinadigan tugma qolmasa (1-qadam) — bo'sh qator ham yashiriladi.
      past.hidden = asosiy.korinadimi() && ![...past.children].some((c) => !c.hidden);
    };

    const bosqich = () => h('div', { class: 'qu-bosqich', role: 'img', 'aria-label': qadam + '-qadam, jami 3 ta' },
      ...[1, 2, 3].map((n) => h('i', { class: n < qadam ? 'otdi' : n === qadam ? 'shu' : '' })), h('span', { class: 'muted' }, qadam + ' / 3'));
    const savol = (t) => h('h3', { class: 'qu-savol', tabindex: '-1' }, t);
    const davom = (matn, fn, cls = 'p') => h('button', { type: 'button', class: cls + ' qu-asosiy', onclick: fn }, matn);
    const orqa = () => h('button', { type: 'button', class: 'qu-orqa', onclick: () => { qadam -= 1; chiz(); } }, '‹ Orqaga');

    function qadam1(el) {
      const ism = input('Ism-sharifi', { inputmode: 'text', placeholder: 'Familiya Ism', autocapitalize: 'words', enterkeyhint: 'next' });
      const tel = input('Telefon raqami', { inputmode: 'tel', placeholder: '90 123 45 67', autocomplete: 'tel', enterkeyhint: 'next' });
      const dor = input('Qaysi dorilar? (ixtiyoriy)', { inputmode: 'text', placeholder: 'Masalan: Анальгин, Цитрамон', maxlength: '300', enterkeyhint: 'next' });
      ism.i.value = f.ism; tel.i.value = f.tel; dor.i.value = f.dorilar;
      ism.i.addEventListener('input', () => { f.ism = ism.i.value; xato.ism = ''; asosiyYangila(); });
      tel.i.addEventListener('input', () => { f.tel = tel.i.value; xato.tel = ''; asosiyYangila(); });
      dor.i.addEventListener('input', () => { f.dorilar = dor.i.value; });
      ism.i.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); tel.i.focus(); } });
      tel.i.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); dor.i.focus(); } });
      dor.i.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); keyingi1(); } });
      ism.xato(xato.ism); tel.xato(xato.tel);
      maydon = xato.ism ? ism.i : xato.tel ? tel.i : null;
      el.append(savol('Kim qarzga oldi?'), ism.el, tel.el, dor.el);
      if (tanlov) {
        el.append(h('b', { class: 'qu-s' }, 'Qaysi filialda?'),
          pills([[uy, h('span', { 'data-asl': '' }, fNom(uy))], [qf, h('span', { 'data-asl': '' }, fNom(qf))]], f.filial, (v) => { f.filial = v; }, 'Qaysi filialda?'));
      }
      const old = oldingiMijozlar(ctx.S().qarzlar, x.id);
      if (old.length) {
        el.append(h('div', { class: 'qu-chiplar', role: 'group', 'aria-label': 'Oldingi mijozlar' }, h('span', { class: 'muted' }, 'Oldingi mijozlar — bosing:'),
          ...old.map((q) => h('button', { type: 'button', class: 'qu-chip', onclick: () => { f.ism = q.ism; f.tel = q.tel; xato.ism = ''; xato.tel = ''; haptik('bos'); chiz(); } },
            h('b', { 'data-asl': '' }, q.ism), h('small', {}, q.tel)))));
      }
      const d1 = davom('Davom etish', keyingi1);
      past.append(d1);
      asosiy.yangila({ matn: 'Davom etish', tugma: d1 });
    }
    function keyingi1() {
      xato.ism = ismXato(); xato.tel = telXato();
      if (xato.ism || xato.tel) { haptik('xato'); chiz(); return; }
      qadam = 2; chiz();
    }

    function qadam2(el) {
      const raqam = h('div', { class: 'qu-summa' + (f.summa ? '' : ' bosh'), role: 'status', 'aria-live': 'polite' });
      const err = h('span', { class: 'err', 'aria-live': 'polite' }, xato.summa);
      const ogoh = h('div', { class: 'qu-ogoh', 'aria-live': 'polite' });
      const yangila = () => {
        raqam.textContent = f.summa ? H.som(Number(f.summa)) : '0 so\'m';
        raqam.classList.toggle('bosh', !f.summa);
        ogoh.textContent = '';
        const t = tekshir();
        if (t.limit) ogoh.append(h('div', { class: 'msg warn' }, t.limit));
        t.ogohlantirish.forEach((o) => ogoh.append(h('div', { class: 'msg info' }, o)));
      };
      const bos = (k) => { const v = raqamQosh(f.summa, k); if (v !== f.summa) { f.summa = v; xato.summa = ''; err.textContent = ''; haptik('bos'); } yangila(); asosiyYangila(); };
      const tugmalar = h('div', { class: 'qu-tugmalar', role: 'group', 'aria-label': 'Raqam tugmalari' },
        ...TUGMALAR.map((k) => h('button', { type: 'button', class: 'qu-k' + (k === '⌫' ? ' ochir' : ''), 'aria-label': k === '⌫' ? 'Oxirgi raqamni o\'chirish' : k, onclick: () => bos(k) }, k)));
      // Kompyuterda (klaviatura bor) — raqam va Backspace ham ishlaydi.
      el.addEventListener('keydown', (e) => {
        if (/^\d$/.test(e.key)) { e.preventDefault(); bos(e.key); } else if (e.key === 'Backspace') { e.preventDefault(); bos('⌫'); } else if (e.key === 'Enter') { e.preventDefault(); keyingi2(); }
      });
      const S = ctx.S(), sz = S.sozlama || {};
      const mine = (S.qarzlar || []).filter((q) => q.xodimId === x.id && (q.holat === 'ochiq' || q.holat === 'ruxsat'));
      const qoldi = Math.max(0, (sz.limitXodim || 0) - H.xodimOchiq(mine, x.id));
      const muddat = pills(MUDDAT, f.muddatKun, (v) => { f.muddatKun = v; xato.muddat = ''; muddatErr.textContent = ''; }, 'Qachon qaytaradi?');
      const muddatErr = h('span', { class: 'err', 'aria-live': 'polite' }, xato.muddat);
      el.tabIndex = -1;
      // Tartib: summa → qachon qaytaradi (standart 7 kun) → raqam tugmalari (barmoq ostida) → limit eslatmasi.
      el.append(savol('Qancha?'), h('div', { class: 'qu-mijoz muted' }, h('span', { 'data-asl': '' }, f.ism)), raqam, err,
        h('b', { class: 'qu-s' }, 'Qachon qaytaradi?'), muddat, muddatErr, tugmalar,
        h('div', { class: 'muted qu-limit' }, 'Bitta mijozga ko\'pi bilan ', h('b', {}, H.som(sz.limitMijoz || 0)), ' · siz yana ', h('b', {}, H.som(qoldi)), ' yozishingiz mumkin'), ogoh);
      yangila();
      const d2 = davom('Davom etish', keyingi2);
      past.append(orqa(), d2);
      asosiy.yangila({ matn: 'Davom etish', tugma: d2 });
    }
    function keyingi2() {
      xato.summa = summaXato();
      if (xato.summa) { haptik('xato'); chiz(); return; }
      qadam = 3; chiz();
    }

    function qadam3(el) {
      const t = tekshir();
      const qaytadi = sana(Date.now() + f.muddatKun * 864e5);
      const satr = (l, qiymat, q) => h('div', { class: 'qu-q' }, h('span', { class: 'qu-q-l' }, l), h('b', { class: 'qu-q-v' }, qiymat),
        h('button', { type: 'button', class: 'link qu-ozgar', 'aria-label': 'O\'zgartirish: ' + l, onclick: () => { qadam = q; chiz(); } }, 'O\'zgartirish'));
      el.append(...[savol('Tekshiring'),
        h('div', { class: 'card qu-royxat' },
          satr('Mijoz', h('span', { 'data-asl': '' }, f.ism.trim()), 1),
          satr('Telefon', telMatn(f.tel), 1),
          String(f.dorilar).trim() ? satr('Dorilar', h('span', { 'data-asl': '' }, String(f.dorilar).trim()), 1) : null,
          tanlov ? satr('Filial', h('span', { 'data-asl': '' }, fNom(f.filial)), 1) : null,
          satr('Summa', H.som(H.pul(f.summa) || 0), 2),
          satr('Qaytaradi', f.muddatKun + ' kunda · ' + qaytadi, 2)),
        t.limit ? h('div', { class: 'msg warn' }, t.limit + ' Ruxsat kelguncha dorini bermang.') : null,
        ...t.ogohlantirish.map((o) => h('div', { class: 'msg info' }, o)),
        h('div', { class: 'qu-diqqat', role: 'note' }, h('b', { 'aria-hidden': 'true' }, '!'),
          h('span', {}, 'Saqlagach QR chiqadi — mijoz skanerlab, botda qarzni tasdiqlaydi. To\'laganda — «To\'lov kiritish», pulni kassaga qo\'shmang, direktorga bering.')),
        xato.umumiy ? h('div', { class: 'msg xato', role: 'alert' }, xato.umumiy) : null].filter(Boolean));   // Element.append(null) «null» yozadi
      const d3 = davom(band ? 'Saqlanmoqda…' : t.limit ? 'Direktordan ruxsat so\'rash' : 'Qarzni saqlash', saqla);
      past.append(orqa(), d3);
      asosiy.yangila({ matn: t.limit ? 'Direktordan ruxsat so\'rash' : 'Qarzni saqlash', tugma: d3 });
    }

    // Server (yoki shu yerdagi) qoida xatosi — o'z maydoniga; eng birinchi qadamga qaytiladi.
    const xatoQoy = (matn) => {
      if (!box.isConnected) return false;   // audit 07.11: oyna yopilgan — xatoni bajar() toast qiladi (jim qolmasin)
      const qismlar = String(matn || '').split(/\.\s+/).map((s) => s.trim().replace(/\.$/, '')).filter(Boolean);
      let eng = 3;
      for (const q of qismlar) {
        if (/ism/i.test(q)) { xato.ism = q; eng = 1; }
        else if (/telefon|raqam/i.test(q)) { xato.tel = q; eng = 1; }
        else if (/summa|limit/i.test(q)) { xato.summa = q; eng = Math.min(eng, 2); }
        else if (/muddat/i.test(q)) { xato.muddat = q; eng = Math.min(eng, 2); }
        else xato.umumiy = (xato.umumiy ? xato.umumiy + '. ' : '') + q;
      }
      qadam = eng; chiz();
      return true;
    };
    function saqla() {
      if (band) return;
      xato.ism = ismXato(); xato.tel = telXato(); xato.summa = summaXato(); xato.umumiy = '';
      if (xato.ism || xato.tel || xato.summa) { haptik('xato'); qadam = xato.ism || xato.tel ? 1 : 2; chiz(); return; }
      const forma = { ism: f.ism, tel: f.tel, summa: f.summa, muddatKun: f.muddatKun, dorilar: String(f.dorilar).trim(), ...(tanlov ? { filial: f.filial } : {}) };
      let joylandi = false;
      band = true; chiz();
      Promise.resolve(ctx.amalX((m) => { joylandi = true; return xatoQoy(m); }, 'qarzBer', forma)).then((r) => {
        band = false;
        if (!r) {
          // Audit 09.11: xabar xato turiga qarab (app.mjs xatoTuri): eskirgan ilova uchun «internetni tekshiring» foyda bermaydi.
          if (!joylandi) xato.umumiy = xatoMatni(ctx.xatoTuri ? ctx.xatoTuri() : null);
          if (box.isConnected) chiz();
          return;
        }
        close();
        // Takrorda natija yo'q — xabar yangi holatdagi shu qarzdan (eski oyna bilan bir xil).
        ctx.toast(...qarzXabari(r, ctx.S(), x.id, forma));
        if (ctx.keyin) ctx.keyin(r, forma);   // 09.11: QR (mijoz botda tasdiqlaydi) yoki «so'rov botga ketdi»
      });
    }

    function chiz() {
      const el = h('div', { class: 'qu-qadam' });
      ichi.textContent = ''; past.textContent = ''; maydon = null;
      ichi.append(bosqich(), el);
      if (qadam === 1) qadam1(el); else if (qadam === 2) qadam2(el); else qadam3(el);
      asosiyYangila();
      ichi.scrollTop = 0;
      // Fokus: xatoli maydon; aks holda savol (ekran o'quvchi yangi qadamni o'qiydi). 1-qadam birinchi ochilishi — sheet o'zi.
      if (!box.isConnected) return;
      if (maydon) maydon.focus({ preventScroll: true });
      else if (qadam === 2) el.focus({ preventScroll: true });
      else { const s = el.querySelector('.qu-savol'); if (s) s.focus({ preventScroll: true }); }
    }
    chizish = chiz;
    chiz();
    return asosiy;   // oyna yopilganda — Telegram tugmasi yashiriladi va bosish ulanishi olinadi
  // Audit 10.11: saqlanayotganda «orqaga» oynani yopmaydi (aks holda xato kelsa yozilganlar yo'qolardi).
  }, { toliq: true, band: () => band, orqaga: () => { if (band) return true; if (qadam > 1 && chizish) { qadam -= 1; chizish(); return true; } return false; } });
}
