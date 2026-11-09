// Xodim va direktor uchun umumiy bo'limlar: prays-list qidiruvi va defektura (kam qolgan dorilar).
import * as H from './hisob.mjs';
import { h, input, kartaSarlavha, sana, sheet, tasdiqlash, xatoJoyla } from './ui.mjs';
import { osonKarta } from './oson-qoldiq.mjs';
import { mijozQism } from './mijoz.mjs';
import { skanerTugma } from './shtrix-skan.mjs';

export const DEF_HOLAT = { yangi: ['Kerak', 'var(--warn)'], buyurtma: ['Buyurtma berilgan', 'var(--info)'], keldi: ['Keldi ✓', 'var(--accent)'] };
// Kim yozgan (06.11; foydalanuvchi: "defekturani qaysi xodim yozgani ham ko'rinib tursin"): guruhdagi yozuvlarning xodimlari,
// takrorsiz, yozilish tartibida; ro'yxatda yo'q (ishdan bo'shagan) — «sobiq xodim».
export function yozganlar(S, d) {
  const ismi = (id) => ((S.xodimlar || []).find((z) => z.id === id) || {}).ism || 'sobiq xodim';
  const ids = [];
  (d.yozuvlar || []).slice().sort((a, b) => (a.ts || 0) - (b.ts || 0)).forEach((z) => { if (z.xodimId && !ids.includes(z.xodimId)) ids.push(z.xodimId); });
  return ids.map(ismi).join(', ');
}
export const yozganEl = (S, d) => { const t = yozganlar(S, d); return t ? h('div', { class: 'muted def-kim' }, 'Yozdi: ' + t) : null; };
// Qo'lda «Keldi» (audit 06.11: bir bosishda, qaytarib bo'lmaydi — shu nomli hamma filial yozuvi yopilib, kutayotgan mijozlarga
// «dori keldi» xabari ketardi): tasdiq bilan — nechta filial va mijoz.
export function keldiTasdiq(d) {
  const ochiq = (d.yozuvlar || []).filter((z) => z.holat === 'yangi' || z.holat === 'buyurtma');
  const filial = new Set(ochiq.map((z) => z.filialId)).size;
  const mijoz = (d.yozuvlar || []).reduce((s, z) => s + (Number(z.mijoz) || 0), 0);
  return tasdiqlash('«' + d.nom + '» keldimi?' + (filial > 1 ? ' ' + filial + ' ta filialdagi yozuv ham yopiladi.' : '')
    + (mijoz ? ' ' + mijoz + ' ta kutayotgan mijozga «dori keldi» xabari boradi.' : '') + ' Buni qaytarib bo\'lmaydi.');
}

// Qidiruv maydoni: yozgan sari (biroz kutib) prays-listdan topadi. tanlansa(nom) berilsa — natijani bosish mumkin.
// k — sahifadagi maydon kaliti (ekran qayta chizilganda yozilgani saqlanadi).
// qoshimcha(soz) → [{nom, izoh}] — praysdan oldin ko'rsatiladigan nomlar (masalan defekturada allaqachon bor dori);
// topilmasa(soz) → element — hech narsa topilmaganda (masalan "Praysda yo'q — o'zim yozaman" tugmasi).
export function praysMaydon(ctx, { yorliq = 'Dori nomi', tanlansa = null, cheklov = 30, k = null, qoshimcha = null, topilmasa = null, misol = 'trombo 150' } = {}) {
  const f = input(yorliq, { inputmode: 'search', placeholder: 'Masalan: ' + misol, autocomplete: 'off', k });
  const natija = h('div', { class: 'list' });
  let navbat = 0, taymer = null;
  const tugma = (nom, ong) => h('button', { type: 'button', class: 's', style: 'justify-content:space-between;text-align:left;height:auto;padding:10px 12px',
    onclick: () => { f.qiymat(nom); natija.textContent = ''; tanlansa(nom); } }, h('span', { 'data-asl': '' }, nom), h('span', { class: 'muted', style: 'white-space:nowrap' }, ong));
  // 06.11: server xatoni kechirib qidiradi (prays + Oson katalogi): narx va Oson'dagi qoldiq; aniq topilmasa — «shunga o'xshash».
  const izoh = (q) => (q.tax ? '≈ ' : '') + [q.narx ? H.som(q.narx) : '', q.soni == null ? '' : Number(q.soni) > 0 ? 'bizda bor' : 'tugagan'].filter(Boolean).join(' · ');   // ≈ — taxminiy moslik
  const chiz = (r, soz) => {
    natija.textContent = '';
    if (!soz || soz.trim().length < 2) return;
    // Ro'yxatda bor nomlar oldin; prays natijasidan ular takrorlanmaydi.
    const qo = qoshimcha ? qoshimcha(soz) : [];
    const bor = new Set(qo.map((z) => H.qidiruvKalit(z.nom)));
    const pr = r.filter((q) => !bor.has(H.qidiruvKalit(q.nom)));
    if (!qo.length && !pr.length) {
      natija.append(h('div', { class: 'muted' }, 'Topilmadi' + (tanlansa && !topilmasa ? ' — nomini to\'liq yozib qo\'shavering' : ' — boshqacha yozib ko\'ring (masalan faqat nomining boshi)')));
      if (topilmasa) natija.append(topilmasa(soz));
      return;
    }
    if (!qo.length && pr[0].tax) natija.append(h('div', { class: 'msg info taxminiy-sarlavha' }, 'Aniq topilmadi — shu dorini nazarda tutdingizmi?'));
    qo.forEach((z) => natija.append(tugma(z.nom, z.izoh)));
    pr.slice(0, cheklov).forEach((q) => natija.append(tanlansa ? tugma(q.nom, izoh(q))
      : h('div', { class: 'line' }, h('span', { 'data-asl': '' }, q.nom), h('b', { style: 'white-space:nowrap' }, izoh(q)))));
    if (topilmasa) natija.append(topilmasa(soz));
  };
  const izla = (kut) => {
    clearTimeout(taymer);
    const soz = f.i.value, men = ++navbat;
    if (soz.trim().length < 2) { chiz([], soz); return; }
    taymer = setTimeout(() => ctx.qidir(soz).then((r) => { if (men === navbat && natija.isConnected) chiz(r || [], soz); }), kut);
  };
  f.i.addEventListener('input', () => izla(300));
  if (f.i.value.trim().length >= 2 && !tanlansa) izla(0);   // ekran qayta chizildi — qidiruv natijasi ham qaytadi
  // Audit 06.11: tanlash maydoni (defektura) — yozib turganda ekran qayta chizilsa, takliflar ham qaytadi (fokus tiklangach).
  else if (tanlansa) setTimeout(() => { if (document.activeElement === f.i && f.i.value.trim().length >= 2) izla(0); }, 0);
  // Qutidagi shtrix-kod (kamera, qo'llab-quvvatlansa) — raqam qidiruvga yoziladi, server shu dorini topadi.
  const el = h('div', { class: 'skan-maydon' }, f.el, skanerTugma((kod) => { f.qiymat(kod); izla(0); }));
  return { el, natija, f };
}

export function praysQidiruv(ctx) {
  const { S } = ctx;
  const p = S.prays || {};
  const box = h('div', { style: 'display:flex;flex-direction:column;gap:12px' });
  if (!p.soni) {
    box.append(h('div', { class: 'card muted' }, 'Prays-list hali yuklanmagan. Aptekadagi kompyuterda nakladnoy dasturida "Praysni ilovaga yuborish" bosilgach shu yerda qidiriladi.'));
    return box;
  }
  const q = praysMaydon(ctx, { yorliq: 'Dori qidirish', k: 'prays-soz' });
  box.append(h('div', { class: 'card' }, q.el, h('div', { class: 'muted' }, p.soni + ' ta dori · narx — sotuv narxi (K ustuni)' + (p.yangilandi ? ' · yangilangan ' + sana(p.yangilandi) : '')), q.natija));
  return box;
}

// Kelgan dorilar (nakladnoy Excel'ga yozgan, 7 kun): defekturaga yozilganlari tepada alohida — xodim izlab o'tirmasin.
// defsiz — «Defekturaga yozilganlar keldi» bloki ko'rsatilmaydi (direktor Defektura → Keldi'da ro'yxat tepada turadi).
export function kelganKarta(S, o = {}) {
  const kelgan = S.kelgan || [];
  const fil = (id) => (S.filiallar.find((f) => f.id === id) || {}).nom || id;
  const defKeldi = H.defekturaGuruh((S.defektura || []).filter((d) => d.holat === 'keldi'));
  const defNomlar = new Set(defKeldi.map((d) => d.nom.toLowerCase()));
  const card = h('div', { class: 'card list' }, kartaSarlavha('Kelgan dorilar (7 kun)'));
  if (defKeldi.length && !o.defsiz) {
    card.append(h('div', { style: 'background:var(--soft);border-radius:14px;padding:10px 12px;display:flex;flex-direction:column;gap:4px' },
      h('b', { style: 'color:var(--accent)' }, '✓ Defekturaga yozilganlar keldi (' + defKeldi.length + ')'),
      ...defKeldi.map((d) => h('div', { class: 'line', style: 'border:0;padding:0' }, h('span', { 'data-asl': '' }, d.nom),
        h('span', { class: 'muted', style: 'text-align:right' }, d.filiallar.map(fil).join(', '))))));
  }
  if (!kelgan.length) { card.append(h('div', { class: 'muted' }, 'Hali yozilmagan. Faktura Excel\'ga yozilganda shu yerda chiqadi.')); return card; }
  const kunlar = new Map();
  kelgan.forEach((k) => { const s = sana(k.ts); if (!kunlar.has(s)) kunlar.set(s, []); kunlar.get(s).push(k); });
  [...kunlar.entries()].forEach(([s, list], i) => {
    const det = h('details', i === 0 ? { open: true } : {}, h('summary', {}, s + ' · ' + list.length + ' ta dori'));
    list.forEach((k) => {
      const def = defNomlar.has(String(k.nom).toLowerCase());
      det.append(h('div', { class: 'line', style: def ? 'background:var(--soft);border-radius:10px;padding:6px 8px' : '' },
        h('span', {}, def ? '✓ ' : '', h('span', { 'data-asl': '' }, k.nom), def ? ' (defekturada edi)' : ''), h('span', { class: 'muted', style: 'white-space:nowrap' }, k.soni != null ? k.soni + ' ta' : '')));
    });
    card.append(det);
  });
  return card;
}

// Xodim: kam qolgan dorini yozadi; hamma filiallar ro'yxatini ko'radi (boshqa xodimlar yozganini ham).
// Prays yuklangan bo'lsa — dori ro'yxatdan tanlanadi (bitta dori har xil nom bilan yozilmasin): praysdan yoki
// defekturada allaqachon bor nomdan. Praysda umuman yo'q dori — "Ro'yxatda yo'q" tugmasi yoki «Qo'shish», tasdiq bilan.
let defTanlangan = null;
// Defekturaga yozish formasi — xodim sahifasida (karta) va direktor Defekturasida («+ Dori yozish» oynasi, 08.11:
// "Defektura direktor ham yoza olishi kerak"). Server defektura_yoz — yozgan odamning (samarali) filialiga.
export function defekturaYozKarta(ctx, o = {}) {
  const { S } = ctx;
  const praysBor = !!(S.prays && S.prays.soni);
  const g = H.defekturaGuruh((S.defektura || []).filter((d) => d.holat !== 'keldi'));
  const izoh = input('Izoh (ixtiyoriy)', { inputmode: 'text', placeholder: 'Masalan: mijoz so\'radi', k: 'def-izoh' });
  const yoz = (nom) => ctx.amalX(xatoJoyla([[q.f, /dori|nom|ro'yxatda/i]]), 'defekturaYoz', nom, izoh.i.value)
    .then((ok) => { if (ok) { defTanlangan = null; ctx.toast('Ro\'yxatga qo\'shildi ✓'); if (o.yozildi) o.yozildi(); } });
  const q = praysMaydon(ctx, {
    yorliq: 'Qaysi dori kam qoldi?', cheklov: 6, k: 'def-nom', misol: 'парацетамол',
    tanlansa: (nom) => { defTanlangan = H.defNom(nom); q.f.xato(''); },
    qoshimcha: (soz) => g.filter((d) => H.qidiruvMos(soz, d.nom)).slice(0, 3).map((d) => ({ nom: d.nom, izoh: 'ro\'yxatda bor' })),
    topilmasa: praysBor ? (soz) => h('button', { type: 'button', class: 'link', onclick: () => {
      const v = H.defNom(soz);
      if (v.length < 2) return;
      tasdiqlash('«' + v + '» — prays-listda yo\'q dori sifatida yozilsinmi? Nomini to\'liq va dozasi bilan yozganingizni tekshiring.').then((ha) => ha && yoz(v));
    } }, 'Ro\'yxatda yo\'q — «' + H.defNom(soz) + '» deb yozish') : null
  });
  const card = h('div', { class: 'card' + (o.oynada ? ' def-yoz' : '') }, o.oynada ? null : kartaSarlavha('Defektura — kam qolgan dori'),
    h('div', { class: 'muted' }, praysBor ? 'Nomini yoza boshlang: ro\'yxatda bo\'lsa — tanlang (hamma bir xil nom bilan yozsin). Aptekada yo\'q dori bo\'lsa — to\'liq yozib «Qo\'shish»ni bosing. Son kerak emas.'
      : 'Nomini to\'liq yozing (dozasi bilan). Son kerak emas.' + (o.oynada ? '' : ' Direktor buyurtma beradi.')),
    q.el, q.natija, izoh.el,
    h('button', { class: 'p', onclick: () => {
      const v = H.defNom(q.f.i.value);
      if (v.length < 2) { q.f.xato('Dori nomini yozing'); q.f.i.focus(); return; }
      // 06.11 (foydalanuvchi: "biror dorini yozsa bazadan qarab «shumi?» deb so'rashi kerak — bizda bor yoki oldin bo'lgan
      // dorilardan bo'lishi kerak"): ro'yxatdan tanlanmagan bo'lsa — bazadan (prays, Oson katalogi, defektura) eng yaqinlari
      // ko'rsatiladi; hech biri bo'lmasa — o'zi yozgani, tasdiq bilan (aptekada umuman bo'lmagan dori ham yoziladi — 28.10).
      if (v !== defTanlangan) { shumi(v); return; }
      yoz(v);
    } }, 'Qo\'shish'));
  let shumiKetyapti = false;
  function shumi(v) {
    if (shumiKetyapti) return;   // qayta audit: «Qo'shish» ikki marta bosilsa — bitta oyna
    shumiKetyapti = true;
    const ozimcha = () => tasdiqlash('«' + v + '» — bazada (bizda bor va oldin bo\'lgan dorilar orasida) topilmadi. Shu nom bilan yozilsinmi? Nomini to\'liq va dozasi bilan yozganingizni tekshiring.')
      .then((ha) => ha && yoz(v));
    const ruyxatda = g.filter((d) => H.qidiruvMos(v, d.nom)).slice(0, 2).map((d) => ({ nom: d.nom, izoh: 'defekturada bor' }));
    Promise.resolve(ctx.qidir ? ctx.qidir(v) : []).catch(() => []).then((r) => {
      shumiKetyapti = false;
      const bor = new Set(ruyxatda.map((z) => H.qidiruvKalit(z.nom)));
      const t = [...ruyxatda, ...(r || []).filter((z) => !bor.has(H.qidiruvKalit(z.nom))).slice(0, 4 - ruyxatda.length)
        .map((z) => ({ nom: z.nom, izoh: [z.narx ? H.som(z.narx) : '', z.soni == null ? '' : Number(z.soni) > 0 ? 'bizda bor' : 'oldin bo\'lgan'].filter(Boolean).join(' · ') }))];
      if (!t.length) { ozimcha(); return; }
      sheet('Shu dorimi?', (box, close) => {
        box.append(h('div', { class: 'muted' }, 'Siz «' + v + '» deb yozdingiz. Bazada shunga o\'xshash dorilar bor — to\'g\'risini tanlang:'));
        t.forEach((z) => box.append(h('button', { type: 'button', class: 's shumi-t', onclick: () => {
          close(); const n = H.defNom(z.nom); q.f.qiymat(n); defTanlangan = n; yoz(n);
        } }, h('span', { 'data-asl': '' }, z.nom), z.izoh ? h('span', { class: 'muted' }, z.izoh) : null)));
        box.append(h('button', { type: 'button', class: 'link', onclick: () => { close(); ozimcha(); } }, 'Hech biri emas — «' + v + '» deb yozish'));
      }, { fokus: false });
    });
  }
  return card;
}

export function defekturaXodim(m, ctx, x) {
  const { S } = ctx;
  const praysBor = !!(S.prays && S.prays.soni);
  // Hamma filiallar; "Keldi"lar — "Keldi" bo'limida alohida.
  const g = H.defekturaGuruh((S.defektura || []).filter((d) => d.holat !== 'keldi'));
  m.append(defekturaYozKarta(ctx));
  defQoldiqYukla(ctx.oson, S);   // 09.11 kech: bizdagi qoldiq
  const fil = (id) => (S.filiallar.find((f) => f.id === id) || {}).nom || id;
  const qator = (d) => {
    const [l, c] = DEF_HOLAT[d.holat];
    const meniki = d.yozuvlar.find((z) => z.xodimId === x.id && z.holat === 'yangi');
    return h('div', { class: 'item' }, h('div', { class: 'line', style: 'border:0;padding:0' }, h('span', { 'data-asl': '' }, d.nom), h('span', { style: 'color:' + c + ';white-space:nowrap;font-weight:600' }, l)),
      h('div', { class: 'muted' }, d.filiallar.map(fil).join(', ') + (d.soni > 1 ? ' · ' + d.soni + ' marta yozilgan' : '')
        + (d.holat === 'buyurtma' && d.holatTs ? ' · buyurtma ' + sana(d.holatTs) : '') + (d.izohlar.length ? ' · ' + d.izohlar.join(' · ') : '')),
      yozganEl(S, d),   // 06.11: kim yozgan
      aslNomEl(d),   // 09.11: direktor nomini to'g'irlagan bo'lsa — xodim yozgani
      defQoldiqEl(ctx.oson, d, fil),   // 09.11 kech: bizdagi qoldiq (tanilmasa — taklif)
      mijozQism(ctx.oson, d, x.filialId),   // 06.11: mijoz kutish ro'yxati — o'z filialidagi yozuv
      // 2-darajali xodim buyurtma beradi va "Keldi" qiladi (pulga aralashmaydi).
      x.daraja === 2 ? h('div', { class: 'row' },
        d.holat === 'yangi' ? h('button', { class: 'p s', onclick: () => ctx.amal('defekturaHolat', d.nom, 'buyurtma') }, 'Buyurtma berdim') : null,
        h('button', { class: 's', onclick: () => keldiTasdiq(d).then((ha) => ha && ctx.amal('defekturaHolat', d.nom, 'keldi')) }, 'Keldi')) : null,
      meniki ? h('button', { class: 's', style: 'align-self:flex-start', onclick: () => tasdiqlash('«' + d.nom + '» ro\'yxatdan o\'chirilsinmi?').then((ha) => ha && ctx.amal('defekturaOchir', meniki.id)) }, 'O\'chirish') : null);
  };
  // 03.11: buyurtma berilganlar — alohida ro'yxatda (xodim yana yozib o'tirmasin).
  const kerak = g.filter((d) => d.holat === 'yangi');
  const berilgan = g.filter((d) => d.holat === 'buyurtma').sort((a, b) => b.holatTs - a.holatTs);
  const list = h('div', { class: 'card list' }, kartaSarlavha('Kam dori ro\'yxati (hamma filiallar)'));
  if (!kerak.length) list.append(h('div', { class: 'muted' }, g.length ? 'Hammasiga buyurtma berilgan ✓' : 'Hozircha bo\'sh. Dori kam qolsa — yuqorida yozing.'));
  kerak.forEach((d) => list.append(qator(d)));
  m.append(list);
  if (berilgan.length) m.append(h('div', { class: 'card list' }, kartaSarlavha('Buyurtma berilganlar (' + berilgan.length + ')'), ...berilgan.map(qator)));
  // Oson qoldig'i (02.11): kam qolgan va tugagan dorilar — xodim ham «+ Defekturaga» bosadi (faqat serverda).
  if (ctx.oson) { const ok = osonKarta(ctx.oson, fil, () => ctx.oson.rerender()); if (ok) m.append(ok); }
}

// 09.11: defektura nomi to'g'irlangan bo'lsa — xodim yozgan asl matn (u o'z yozganini taniydi).
export function aslNomEl(d) {
  const a = (d && d.asl) || [];
  return a.length ? h('div', { class: 'muted def-asl' }, 'Xodim yozgani: ', h('span', { 'data-asl': '' }, a.join('; '))) : null;
}

// 09.11 (egasi: "defekturadagi nomlarni xodimlar o'zlari tushunadigan tilda yozgan — to'g'irla"): direktor nomni Oson /
// prays-listdagi to'g'ri nomga almashtiradi. Hamma filialdagi shu nomli ochiq yozuvlar o'zgaradi, eski matn «Xodim yozgani»da
// qoladi va lug'atga yoziladi — xodim keyin yana shunday yozsa, o'zi to'g'ri nomga o'tadi. To'g'ri nom Oson'dagiga mos kelsa,
// dori Oson'ga kirim qilinganda «Keldi» o'zi bo'ladi. ctx: { amal, qidir, toast }
export function nomTuzatOyna(ctx, d, boshQidiruv) {
  sheet('Nomni to\'g\'irlash', (box, close) => {
    const asl = boshQidiruv || (d.asl && d.asl[0]) || d.nom;
    const q = input('Qidirish (Oson va prays-list)', { inputmode: 'text', placeholder: 'Masalan: Нош-Бра' });
    q.i.value = asl;
    q.i.defaultValue = asl;   // audit 09.11: yozilmagan bo'lsa yopishda «Yozganlaringiz o'chadi» so'ralmasin
    const nat = h('div', { class: 'shumi' });
    let navbat = 0, taymer = null, band = false;
    // Audit 09.11: saqlanayotganda tugmalar o'chiq (ikkinchi bosish yolg'on xato bermasin).
    const saqla = (nom) => {
      if (band) return;
      band = true; nat.querySelectorAll('button').forEach((b) => { b.disabled = true; });
      Promise.resolve(ctx.amal('defekturaNom', d.nom, nom)).then((n) => {
        band = false; nat.querySelectorAll('button').forEach((b) => { b.disabled = false; });
        if (n == null) return;
        close(); ctx.toast('Nom to\'g\'irlandi ✓');
      });
    };
    const qidir = () => {
      const v = String(q.i.value || '').replace(/\s+/g, ' ').trim();
      nat.textContent = '';
      if (v.length < 2) return;
      const men = ++navbat;
      nat.append(h('div', { class: 'muted' }, 'Qidirilmoqda…'));
      Promise.resolve(ctx.qidir ? ctx.qidir(v) : []).catch(() => []).then((r) => {
        if (men !== navbat) return;
        nat.textContent = '';
        // Oson nomlari birinchi (kirim shu nom bilan keladi — «Keldi» aniq moslashadi), keyin prays-list.
        const l = (Array.isArray(r) ? r : []).filter((z) => z && z.nom);
        const nomlar = [...new Set([...l.filter((z) => z.oson), ...l.filter((z) => !z.oson)].map((z) => z.nom))].slice(0, 8);
        const osonda = new Set(l.filter((z) => z.oson).map((z) => z.nom));
        if (!nomlar.length) nat.append(h('div', { class: 'muted' }, 'Topilmadi — boshqacha yozib ko\'ring.'));
        nomlar.forEach((n) => nat.append(h('button', { type: 'button', class: 's shumi-t', onclick: () => saqla(n) }, h('span', { 'data-asl': '' }, n),
          osonda.has(n) ? h('small', {}, 'Oson\'dagi nom') : null)));
        nat.append(h('button', { type: 'button', class: 'link', onclick: () => saqla(v) }, h('span', {}, '«', h('span', { 'data-asl': '' }, v), '» deb saqlash')));
      });
    };
    q.i.addEventListener('input', () => { clearTimeout(taymer); taymer = setTimeout(qidir, 350); });
    q.i.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); clearTimeout(taymer); qidir(); } });
    box.append(h('div', { class: 'tt-kim' }, 'Hozir: ', h('b', { 'data-asl': '' }, d.nom)),
      h('div', { class: 'muted' }, 'To\'g\'ri nomni tanlang — Oson\'dagi nom bilan tanlasangiz, dori kirim qilinganda «Keldi» o\'zi bo\'ladi. Xodim keyin yana shunday yozsa, o\'zi to\'g\'ri nomga o\'tadi.'),
      q.el, nat);
    // 09.11 (qotish): birinchi qidiruv oyna ochilib bo'lgach — ochilish harakati va klaviatura bilan bir vaqtga tushmasin.
    taymer = setTimeout(qidir, 300);
    return () => clearTimeout(taymer);
  });
}

// 09.11 kech (egasi: "defekturadagi dorilarning bizdagi qoldig'i ko'rinsin; nomini tanimasa — «bizda yo'q» demasin"):
// SQL defektura_qoldiq — tanilgan dori: filiallar bo'yicha qoldiq (hammasi 0 — «tugagan»); tanilmagan: «❓ tanilmadi» va
// Oson'dagi eng yaqin dori (qoldig'i bilan), direktorga — «Bog'lash» (nomni Oson nomiga to'g'irlash, lug'atga ham).
// Bir marta yuklanadi; ochiq nomlar o'zgarsa yoki 5 daqiqadan keyin — qayta. rctx: { oqi, server, rerender }.
const DQ = { kalit: '', data: null, yuk: null, vaqt: 0, osonVaqt: null, eski: false };
const dqKalit = (S) => (S.defektura || []).filter((d) => d.holat === 'yangi' || d.holat === 'buyurtma')
  .map((d) => H.defNom(d.nom).toLowerCase()).sort().join('|');
export function defQoldiqYukla(rctx, S) {
  if (!rctx || !rctx.server || !rctx.oqi || DQ.yuk) return;
  const k = dqKalit(S);
  if (DQ.kalit === k && DQ.vaqt && Date.now() - DQ.vaqt < 5 * 60e3) return;
  DQ.yuk = Promise.resolve(rctx.oqi('defekturaQoldiq')).then((r) => {
    // Javob: { royxat, vaqt, eski } yoki { yopiq } («Dori qidirish» o'chiq xodimga — qoldiq ko'rsatilmaydi).
    if (r && Array.isArray(r.royxat)) {
      DQ.data = r.yopiq ? null : new Map(r.royxat.map((z) => [H.defNom(z.nom).toLowerCase(), z]));
      DQ.osonVaqt = r.vaqt || null; DQ.eski = !!r.eski;
    }
  }, () => null).then(() => {
    DQ.kalit = k; DQ.vaqt = Date.now(); DQ.yuk = null;   // xato bo'lsa ham — 5 daqiqa qayta so'ralmaydi (cheksiz aylanish yo'q)
    if (rctx.rerender) rctx.rerender();
  });
}
export function defQoldiqEl(rctx, d, fil, bogla) {
  if (!rctx || !rctx.server || !DQ.data) return null;
  const z = DQ.data.get(H.defNom(d.nom).toLowerCase());
  if (!z) return null;
  // Oson ma'lumoti 26 soatdan eski — qaysi vaqtdagi ekani aytiladi (kompyuterda Oson admin ochilmagan bo'lishi mumkin).
  const eski = DQ.eski && DQ.osonVaqt ? ' (Oson ' + sana(DQ.osonVaqt) + ' dagi)' : '';
  // 09.11 kech (egasi: "qaysi geparin ekanligi ham yozilsin, hamma dorida; ko'rinishi tartibli, tushunarli bo'lsin"):
  // har filial alohida qatorda, ostida ishlab chiqaruvchilar (Bayan Medical — 11 quti, NANO — 26 quti). Yozilgan filialda yo'q,
  // boshqasida bor bo'lsa — shu aytiladi (ko'chirish mumkin).
  const filiallarEl = (filiallar) => {
    const bor = (filiallar || []).filter((f) => Number(f.soni) > 0);
    if (!bor.length) return null;
    // A maket (09.11 tun): ishlab chiqaruvchi bitta — filial bilan bir qatorda («4-filial · Дальхимфарм — 2 quti 8 dona»,
    // son ikki marta yozilmaydi); bir nechta — filial ostida alohida qatorlar.
    return h('div', { class: 'dq-fil' }, ...bor.map((f) => {
      const ish = Array.isArray(f.ish) ? f.ish : [];
      const nom = f.f ? fil(f.f) : f.b;
      if (ish.length === 1) {
        return h('div', { class: 'dq-f' }, h('div', { class: 'dq-fq' },
          h('span', {}, nom, h('span', { class: 'dq-ish1' }, ' · ', h('span', { 'data-asl': '' }, ish[0].i))), h('b', {}, f.matn)));
      }
      return h('div', { class: 'dq-f' }, h('div', { class: 'dq-fq' }, h('span', {}, nom), h('b', {}, f.matn)),
        ...ish.map((x) => h('div', { class: 'dq-iq' }, h('span', { 'data-asl': '' }, x.i), h('b', {}, x.matn))));
    }));
  };
  const boshqadaEl = (filiallar) => {
    const yozilgan = (d.filiallar || []).filter(Boolean);
    const borF = (filiallar || []).filter((f) => Number(f.soni) > 0 && f.f).map((f) => f.f);
    const yoqF = yozilgan.filter((id) => !borF.includes(id));
    if (!yoqF.length || !borF.some((id) => !yozilgan.includes(id))) return null;
    return h('div', { class: 'dq-maslahat' }, '↪ ' + yoqF.map(fil).join(', ') + 'da yo\'q — boshqa filialdan olish mumkin');
  };
  if (z.holat === 'bor') {
    return h('div', { class: 'dq dq-bor dq-blok' }, h('div', { class: 'dq-sar' }, h('span', {}, '📦 Bizda jami', eski), h('b', {}, z.jami || '')),
      filiallarEl(z.filiallar), boshqadaEl(z.filiallar));
  }
  if (z.holat === 'tugagan') return h('div', { class: 'dq dq-yoq dq-blok' }, h('div', { class: 'dq-sar' }, h('span', {}, '📦 Bizda' + eski), h('b', {}, 'hamma filialda tugagan')));
  const t = z.taklif;
  // Yagona to'liq mos variant (faqat «п/о», «№» kabi farq) — qoldiq «≈» bilan va Oson'dagi nomi; direktor bog'lab qo'yadi.
  // Filiallar bo'yicha (Энап 10мг /KRKA/ → «4-filial 3 ta, 1-filial 1 ta»).
  if (t && t.aniq) {
    return h('div', { class: 'dq dq-taxmin dq-blok' },
      h('div', { class: 'dq-sar' }, h('span', {}, '📦 Bizda ≈', eski), h('b', {}, Number(t.soni) > 0 ? t.matn : 'tugagan')),
      h('div', { class: 'dq-k' }, 'Oson\'da: ', h('span', { 'data-asl': '' }, t.nom)),
      filiallarEl(t.filiallar), boshqadaEl(t.filiallar),
      bogla ? h('button', { type: 'button', class: 'link dq-bogla', onclick: () => bogla(t.nom) }, 'Bog\'lash (nomini shunga o\'zgartirish)') : null);
  }
  // Oson'da o'xshashi ham yo'q, katalogda (Oson katalogi, prays-list, firma prayslari, davlat reyestri) bor. Kaliti aynan mos —
  // haqiqatan «yo'q»; faqat o'xshash — «ehtimol» (aniq «yo'q» demaymiz).
  const k = z.katalog;
  if (k && !t) {
    const m = k.manba || '';
    const manba = m === 'oson' ? 'Oson katalogida' : m === 'prays' ? 'prays-listda' : m === 'reyestr' ? 'davlat reyestrida'
      : m === 'firma' ? 'ta\'minotchi praysida' : /^firma:/.test(m) ? m.slice(6) + ' praysida' : '';
    if (k.aniq) {
      return h('div', { class: 'dq dq-yoq' }, '📦 Bizda yo\'q — Oson qoldig\'ida yozuvi yo\'q',
        h('span', { class: 'dq-k' }, ' · ', h('span', { 'data-asl': '' }, k.nom), manba ? ' (' + manba + ')' : ''), eski,
        bogla ? h('button', { type: 'button', class: 'link dq-bogla', onclick: () => bogla(null) }, 'Bog\'lash') : null);
    }
    return h('div', { class: 'dq dq-nomalum' }, h('span', {}, '❓ Oson qoldig\'ida topilmadi'),
      h('span', { class: 'dq-k' }, ' · ehtimol: ', h('span', { 'data-asl': '' }, k.nom), manba ? ' (' + manba + ')' : ''), eski,
      bogla ? h('button', { type: 'button', class: 'link dq-bogla', onclick: () => bogla(null) }, 'Bog\'lash') : null);
  }
  // Tanilmadi — «yo'q» demaymiz (egasi): taklif bo'lsa — ehtimol (bir necha variant bo'lsa — soni), aks holda direktor bog'laydi.
  return h('div', { class: 'dq dq-nomalum' },
    h('span', {}, '❓ Nomi Oson\'da tanilmadi'),
    t ? h('span', {}, ' · ehtimol: ', h('span', { 'data-asl': '' }, t.nom), ' — ' + (Number(t.soni) > 0 ? 'bizda ' + t.matn : 'tugagan')
      + (Number(t.variant) > 1 ? ' (yana ' + (Number(t.variant) - 1) + ' ta o\'xshash)' : ''))
      : h('span', {}, bogla ? ' — «Bog\'lash» bilan Oson\'dagi nomini tanlang' : ' — qoldig\'ini bilish uchun direktorga ayting'),
    bogla ? h('button', { type: 'button', class: 'link dq-bogla', onclick: () => bogla(t && t.nom) }, 'Bog\'lash') : null);
}
