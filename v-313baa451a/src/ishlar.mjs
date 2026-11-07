// Ekran amallari: bitta nom — ikki bajaruvchi.
// [0] sinov rejimi: amallar.mjs (S ni shu yerda o'zgartiradi); [1] server: [api amali, argumentlar].
// Pul matnlari serverga yuborishdan oldin butun so'mga aylanadi (hisob.mjs pul()).
import * as A from './amallar.mjs';
import * as H from './hisob.mjs';

// Bo'sh → null (server "kiriting" deydi), noto'g'ri yozilgan → shu yerda xato.
export function p(v) {
  if (v == null || String(v).trim() === '') return null;
  const n = H.pul(v);
  if (n == null) throw new Error('Summa noto\'g\'ri — masalan: 1 250 000');
  return n;
}
const p0 = (v) => p(v) ?? 0;
const m = (v) => (v == null || v === '' ? null : String(v));

export const ISHLAR = {
  smenaOchish: [(S, men, s) => A.smenaOchish(S, men.id, s), (s) => ['smena_ochish', [p(s)]]],
  smenaOchishJoy: [(S, men, s, joy) => A.smenaOchishJoy(S, men.id, s, joy), (s, joy) => ['smena_ochish_joy', [p(s), m(joy)]]],
  xarajatQosh: [(S, men, sm, s, iz) => A.xarajatQosh(S, sm, s, iz, men.id), (sm, s, iz) => ['xarajat_qosh', [sm, p(s), m(iz)]]],
  smenadanOlish: [(S, men, sm, s, ham) => A.smenadanOlish(S, sm, s, ham, men.id), (sm, s, ham) => ['smenadan_olish', [sm, p(s), ham]]],
  smenaYopish: [(S, men, sm, f) => A.smenaYopish(S, sm, f, men.id),
    (sm, f) => ['smena_yopish', [sm, p(f.naqd), p(f.karta), p(f.sanalgan), p(f.qoldirildi), m(f.kimga)]]],
  smenaQabul: [(S, men, sm, ham, haqiqiy) => A.smenaQabul(S, sm, ham, men.id, haqiqiy), (sm, ham, haqiqiy) => ['smena_qabul', [sm, ham, p(haqiqiy)]]],
  zaxira: [() => { throw new Error('Sinov rejimida zaxira yo\'q — Telegram ilovasida ishlaydi'); }, () => ['zaxira', []]],
  xodimQoshimcha: [(S, men, xid, f, sm) => A.xodimQoshimcha(S, xid, f, sm), (xid, f, sm) => ['xodim_qoshimcha', [xid, f || '', sm || '']]],
  xodimVaqtincha: [(S, men, xid, f, gacha) => A.xodimVaqtincha(S, xid, f, gacha), (xid, f, gacha) => ['xodim_vaqtincha', [xid, f || '', gacha || '']]],
  xodimDaraja: [(S, men, xid, d) => A.xodimDaraja(S, xid, d), (xid, d) => ['xodim_daraja', [xid, Number(d) === 2 ? 2 : 1]]],
  bemorOraldi: [(S, men, id, o) => A.bemorOraldi(S, id, o, men.ism), (id, o) => ['bemor_oraldi', [id, !!o]]],
  bemorOson: [(S, men, id, o) => A.bemorOson(S, id, o, men.ism), (id, o) => ['bemor_oson', [id, !!o]]],
  osonToplam: [(S, men, p, kun, o, n) => A.osonToplam(S, p, kun, o, n, men.ism), (p, kun, o, n) => ['oson_toplam', [p, m(kun), !!o, n]]],
  osonMijozlar: [(S, men, idlar) => A.osonMijozlar(S, idlar, men.ism), (idlar) => ['oson_mijozlar', [JSON.stringify(idlar)]]],
  qarzYozish: [(S, men, f) => A.qarzYozish(S, men.id, f),
    (f) => ['qarz_yozish', [m(f.ism), m(f.tel), p(f.summa), Number(f.muddatKun) || null]]],
  qarzRuxsat: [(S, men, q, r) => A.qarzRuxsat(S, q, r), (q, r) => ['qarz_ruxsat', [q, r]]],
  qarzUndirish: [(S, men, q, s, ham) => A.qarzUndirish(S, q, s, ham, men.id), (q, s, ham) => ['qarz_undirish', [q, p(s), ham]]],
  avansBerish: [(S, men, xid, s, ham, oy) => A.avansBerish(S, xid, s, ham, men.id, oy), (xid, s, ham, oy) => ['avans_berish', [xid, p(s), ham, oy]]],
  yozuv: [(S, men, f) => A.yozuv(S, f, men.id),
    (f) => ['yozuv', [m(f.tur), p(f.summa), m(f.hamyon), m(f.dan), m(f.ga), f.izoh || '']]],
  yozuvBekor: [(S, men, id, sabab) => A.yozuvBekor(S, id, sabab, men.id), (id, sabab) => ['yozuv_bekor', [id, sabab || '']]],
  // Bo'sh maydon — 0 emas, xato (server ham "kiriting" deydi); tarix bo'lsa server o'zgarish izini yozadi.
  boshlangichSaqla: [(S, men, f) => A.boshlangichSaqla(S, f, men.id), (f) => ['boshlangich_saqla', [p(f.kassa), p(f.uy)]]],
  // Sanash (C2): haqiqiy pul serverga, farqni server o'zi hisoblaydi (natija — farq).
  sanash: [(S, men, ham, haqiqiy, izoh) => A.sanash(S, ham, haqiqiy, izoh, men.id), (ham, haqiqiy, izoh) => ['sanash', [m(ham), p(haqiqiy), izoh || '']]],
  // Yopilgan smena savdosini tuzatish (C2): faqat direktor; naqd, karta, sabab.
  savdoTuzatish: [(S, men, sm, naqd, karta, sabab) => A.savdoTuzatish(S, sm, naqd, karta, sabab, men.id),
    (sm, naqd, karta, sabab) => ['savdo_tuzatish', [sm, p(naqd), p(karta), sabab || '']]],
  sozlamaSaqla: [(S, men, f) => A.sozlamaSaqla(S, f), (f) => ['sozlama_saqla', [p(f.limitMijoz), p(f.limitXodim), m(f.xulosaVaqti)]]],
  taminotchiQosh: [(S, men, f) => A.taminotchiQosh(S, f), (f) => ['taminotchi_qosh', [m(f.nom), !!f.yuridik, p0(f.boshlangichQarz)]]],
  xarid: [(S, men, t, s, iz, rows) => A.xarid(S, t, s, iz, men.id, rows), (t, s, iz, rows) => {
    const r = H.xaridQatorlar(rows);
    if (r.xato) throw new Error(r.xato);
    return ['xarid', [t, r.qatorlar.length ? null : p(s), iz || '', r.qatorlar.length ? r.qatorlar : null]];
  }],
  tolov: [(S, men, t, q, iz) => A.tolov(S, t, q, iz, men.id), (t, q, iz) => ['tolov', [t, p0(q.kassa), p0(q.uy), p0(q.bank), iz || '']]],
  amalTasdiq: [(S, men, t, a) => A.amalTasdiq(S, t, a), (t, a) => ['amal_tasdiq', [a]]],
  xodimQosh: [(S, men, f) => A.xodimQosh(S, f), (f) => ['xodim_qosh', [m(f.ism), m(f.filialId), m(f.rol), m(f.smena), p0(f.oylik)]]],
  taklifYarat: [(S, men, xid) => A.taklifYarat(S, xid), (xid) => ['taklif_yarat', [xid]]],
  xodimTelefon: [(S, men, xid, t) => A.xodimTelefon(S, xid, t), (xid, t) => ['xodim_telefon', [xid, m(t)]]],
  botUlash: [() => { throw new Error('Sinov rejimida bot yo\'q'); }, () => ['bot_ulash', []]],
  xodimFaol: [(S, men, xid, faol) => A.xodimFaol(S, xid, faol, men.id), (xid, faol) => ['xodim_faol', [xid, !!faol]]],
  xodimOylik: [(S, men, xid, s) => A.xodimOylik(S, xid, s), (xid, s) => ['xodim_oylik', [xid, p(s)]]],
  amalBekor: [(S, men, t, a, sabab) => A.amalBekor(S, t, a, sabab, men.id), (t, a, sabab) => ['amal_bekor', [a, sabab || '']]],
  filialNomla: [(S, men, id, nom) => A.filialNomla(S, id, nom), (id, nom) => ['filial_nomla', [id, m(nom)]]],
  filialQosh: [(S, men, nom) => A.filialQosh(S, nom), (nom) => ['filial_qosh', [m(nom)]]],
  savdoTasdiq: [(S, men, sm) => A.savdoTasdiq(S, sm), (sm) => ['savdo_tasdiq', [sm]]],
  savdoKiritish: [(S, men, f) => A.savdoKiritish(S, f, men.id),
    (f) => ['savdo_kiritish', [m(f.filialId), m(f.smena), m(f.xodimId), m(f.kun), p(f.naqd), p(f.karta), m(f.hamyon)]]],
  savdoBekor: [(S, men, sm, sabab) => A.savdoBekor(S, sm, sabab, men.id), (sm, sabab) => ['savdo_bekor', [sm, sabab || '']]],
  defekturaYoz: [(S, men, nom, izoh) => A.defekturaYoz(S, men.id, nom, izoh), (nom, izoh) => ['defektura_yoz', [m(nom), izoh || '']]],
  defekturaHolat: [(S, men, nom, holat) => A.defekturaHolat(S, nom, holat, men.id), (nom, holat) => ['defektura_holat', [m(nom), m(holat)]]],
  shtrixQosh: [(S, men, g, t, k) => A.shtrixQosh(S, men.id, g, t, k), (g, t, k) => ['shtrix_qosh', [m(g), t || '', m(k)]]],
  shtrixOchir: [(S, men, id) => A.shtrixOchir(S, men.id, id), (id) => ['shtrix_ochir', [id]]],
  defekturaOchir: [(S, men, id) => A.defekturaOchir(S, id, men.id), (id) => ['defektura_ochir', [id]]],
  praysKalitYarat: [() => { throw new Error('Sinov rejimida kalit yo\'q'); }, () => ['prays_kalit_yarat', []]],
  kengaytmaKalitYarat: [() => { throw new Error('Sinov rejimida kalit yo\'q'); }, () => ['kengaytma_kalit_yarat', []]],
  taTaklifYarat: [(S, men, t) => A.taTaklifYarat(S, t), (t) => ['ta_taklif_yarat', [t]]],
  taminotchiTelefon: [(S, men, t, tel) => A.taminotchiTelefon(S, t, tel), (t, tel) => ['taminotchi_telefon', [t, m(tel)]]],
  taminotchiUzish: [(S, men, t) => A.taminotchiUzish(S, t), (t) => ['taminotchi_uzish', [t]]],
  // Ta'minotchi o'zi (men.id — ta'minotchi id)
  taTasdiq: [(S, men, a) => A.taTasdiq(S, men.id, a), (a) => ['ta_tasdiq', [a]]],
  taEtiroz: [(S, men, a, matn) => A.taEtiroz(S, men.id, a, matn), (a, matn) => ['ta_etiroz', [a, m(matn)]]],
  // Reimbursatsiya (punktlar). Ro'yxat matni serverda ajratiladi.
  retseptlar: [(S) => A.retseptlar(S), () => ['retseptlar', []]],
  qadoqHolat: [(S) => A.qadoqHolat(S), () => ['qadoq_holat', []]],
  partiyalar: [(S) => A.partiyalar(S), () => ['partiyalar', []]],
  dorilarHisobot: [(S, men, dan, gacha) => A.dorilarHisobot(S, dan, gacha), (dan, gacha) => ['dorilar_hisobot', [m(dan), m(gacha)]]],
  dorilarExcel: [() => A.dorilarExcel(), (dan, gacha) => ['dorilar_excel', [m(dan), m(gacha)]]],
  punktExcel: [() => A.punktExcel(), (p) => ['punkt_excel', [p]]],
  // 07.11 tun: bir martalik yuklash havolasi (Telegram downloadFile) — tur: 'dorilar_excel', args: o'sha amal argumentlari.
  faylHavola: [() => A.dorilarExcel(), (tur, args) => ['fayl_havola', [m(tur), JSON.stringify(args || [])]]],
  punktRoyxatExcel: [() => A.punktRoyxatExcel(), (p, kun) => ['punkt_royxat_excel', [p, m(kun)]]],
  // «Bilimdon» o'yini — faqat serverda (sinov rejimida yo'q).
  oyinYarat: [() => A.oyinYoq(), (tur, soni, mavzu, jekpot) => ['oyin_yarat', [tur || 'klassik', Number(soni) || 15, m(mavzu), !!jekpot]]],
  oyinBekor: [() => A.oyinYoq(), (mashq) => ['oyin_bekor', [!!mashq]]],
  oyinQoshil: [() => A.oyinYoq(), () => ['oyin_qoshil', []]],
  oyinStart: [() => A.oyinYoq(), () => ['oyin_start', []]],
  oyinOch: [() => A.oyinYoq(), (x) => ['oyin_och', [x]]],
  oyinKeyingi: [() => A.oyinYoq(), (x) => ['oyin_keyingi', [x]]],
  oyinJavob: [() => A.oyinYoq(), (x, i, javob) => ['oyin_javob', [x, i, JSON.stringify(javob)]]],
  oyinMashq: [() => A.oyinYoq(), (tur) => ['oyin_mashq', [tur || 'klassik']]],
  oyinHolat: [() => A.oyinYoq(), () => ['oyin_holat', []]],
  oyinReyting: [() => A.oyinYoq(), () => ['oyin_reyting', []]],
  oyinSavolQosh: [() => A.oyinYoq(), (tur, matn, v, t, iz) => ['oyin_savol_qosh', [m(tur), m(matn), JSON.stringify(v || []), JSON.stringify(t || []), m(iz)]]],
  oyinSavollar: [() => A.oyinYoq(), () => ['oyin_savollar', []]],
  oyinSavolFaol: [() => A.oyinYoq(), (id, faol) => ['oyin_savol_faol', [id, !!faol]]],
  oyinVaqt: [() => A.oyinYoq(), (sek) => ['oyin_vaqt', [Number(sek) || 0]]],
  duelChaqir: [() => A.oyinYoq(), (raqib) => ['duel_chaqir', [m(raqib)]]],
  duelQabul: [() => A.oyinYoq(), (id, ha) => ['duel_qabul', [id, !!ha]]],
  duelSavol: [() => A.oyinYoq(), (id) => ['duel_savol', [id]]],
  duelJavob: [() => A.oyinYoq(), (id, i, javob) => ['duel_javob', [id, i, JSON.stringify(javob)]]],
  duelHolat: [() => A.oyinYoq(), () => ['duel_holat', []]],
  oyinProfil: [() => A.oyinYoq(), () => ['oyin_profil', []]],
  // Davomat (29.10): direktor belgilaydi (keldi: true / false / null — olib tashlash), oy jadvali.
  davomatBelgila: [(S, men, x, kun, keldi) => A.davomatBelgila(S, men.id, x, kun, keldi), (x, kun, keldi) => ['davomat_belgila', [x, kun, keldi === null || keldi === undefined ? null : !!keldi]]],
  davomatOy: [(S, men, oy) => A.davomatOy(S, men.id, oy), (oy) => ['davomat_oy', [oy]]],
  // Firmalar prayslari (30.10) — faqat serverda (direktor).
  firmaFayllar: [() => A.firmaYoq(), () => ['firma_fayllar', []]],
  firmaRoyxat: [() => A.firmaYoq(), () => ['firma_royxat', []]],
  firmaQatorlar: [() => A.firmaYoq(), (f) => ['firma_qatorlar', [m(f)]]],
  firmaOchir: [() => A.firmaYoq(), (f) => ['firma_ochir', [m(f)]]],
  firmaQaytar: [() => A.firmaYoq(), (f) => ['firma_qaytar', [m(f)]]],
  firmaFaylQaytar: [() => A.firmaYoq(), (id) => ['firma_fayl_qaytar', [id]]],
  // Oson Apteka qoldig'i (02.11): Defektura → «Tugayapti» — faqat serverda (kengaytma yuboradi).
  osonTugayapti: [() => A.osonYoq(), () => ['oson_tugayapti', []]],
  osonDefekturaga: [() => A.osonYoq(), (b, pr) => ['oson_defekturaga', [m(b), m(pr)]]],
  osonKerakEmas: [() => A.osonYoq(), (b, pr, ha) => ['oson_kerak_emas', [m(b), m(pr), !!ha]]],
  osonChegara: [() => A.osonYoq(), (n) => ['oson_chegara', [n]]],
  osonFilial: [() => A.osonYoq(), (b, f) => ['oson_filial', [m(b), f == null ? '' : String(f)]]],
  osonMuddat: [() => A.osonYoq(), (oy) => ['oson_muddat', [oy]]],
  osonQidir: [() => A.osonYoq(), (s) => ['oson_qidir', [m(s)]]],
  osonMajbur: [() => A.osonYoq(), () => ['oson_majbur', []]],
  osonMuddatiOtgan: [() => A.osonYoq(), () => ['oson_muddati_otgan', []]],
  // 06.11: Pul nazorati, Aqlli buyurtma (direktor), mijozga «dori keldi» havolasi — faqat serverda.
  osonPul: [() => A.osonYoq(), () => ['oson_pul', []]],
  osonBuyurtma: [() => A.osonYoq(), (z, y) => ['oson_buyurtma', [z, y]]],
  // 07.11: ertalabki hisobot (direktor), filiallar orasida ko'chirish, analog, inventarizatsiya — faqat serverda.
  ertalab: [() => A.osonYoq(), () => ['ertalab', []]],
  ertalabVaqti: [() => A.osonYoq(), (v) => ['ertalab_vaqti', [v == null ? '' : String(v)]]],
  osonKochirish: [() => A.osonYoq(), () => ['oson_kochirish', []]],
  osonAnalog: [() => A.osonYoq(), (g) => ['oson_analog', [m(g)]]],
  analogBogla: [() => A.osonYoq(), (g1, g2) => ['analog_bogla', [m(g1), m(g2)]]],
  analogUzish: [() => A.osonYoq(), (g) => ['analog_uzish', [m(g)]]],
  mnnRad: [() => A.osonYoq(), (g) => ['dori_mnn_rad', [m(g)]]],
  mnnQaytar: [() => A.osonYoq(), (g) => ['dori_mnn_qaytar', [m(g)]]],   // audit 06.11 kech (20261107170000_analog_kalit)
  analogEmas: [() => A.osonYoq(), (g1, g2) => ['analog_emas', [m(g1), m(g2)]]],   // 06.11 kech: direktor — «modda noto'g'ri» (20261107160000_dori_mnn)
  inventarHolat: [() => A.osonYoq(), () => ['inventar_holat', []]],
  inventarBoshla: [() => A.osonYoq(), (b) => ['inventar_boshla', [m(b)]]],
  inventarTop: [() => A.osonYoq(), (id, soz) => ['inventar_top', [id, m(soz)]]],
  inventarSana: [() => A.osonYoq(), (id, pr, quti, dona, aniq) => ['inventar_sana', [id, m(pr), Math.trunc(Number(quti) || 0), Math.trunc(Number(dona) || 0), !!aniq]]],
  inventarRoyxat: [() => A.osonYoq(), (id) => ['inventar_royxat', [id]]],
  // 07.11 (20261107180000_narx_kassa_partiya): narx farqi va yorliq, kassa ↔ Oson, reimbursatsiya partiyalari — faqat serverda.
  narxFarq: [() => A.osonYoq(), () => ['narx_farq', []]],
  narxBelgila: [() => A.osonYoq(), (g, narx) => ['narx_belgila', [m(g), p(narx)]]],
  narxXodim: [() => A.osonYoq(), () => ['narx_xodim', []]],
  // 07.11 tun: o'lcham — '58x40' | '40x30' | '30x20' | 'a4' (nazorat.mjs yorliqOlcham; bo'sh — a4).
  narxYorliq: [() => A.osonYoq(), (b, olcham) => ['narx_yorliq', [m(b), m(olcham)]]],
  kassaOson: [() => A.osonYoq(), (n) => ['kassa_oson', [Math.trunc(Number(n) || 7)]]],
  partiyaNazorat: [() => A.osonYoq(), () => ['partiya_nazorat', []]],
  partiyaNarx: [() => A.osonYoq(), (id, narx) => ['partiya_narx', [m(id), p(narx)]]],
  partiyaNarxOson: [() => A.osonYoq(), () => ['partiya_narx_oson', []]],
  // 07.11 (20261107210000_dori_reyestr): davlat reyestri — narx chegarasi (direktor), qayta moslash, «moslik noto'g'ri».
  narxChegara: [() => A.osonYoq(), () => ['narx_chegara', []]],
  reyestrMosla: [() => A.osonYoq(), () => ['reyestr_mosla', []]],
  reyestrRad: [() => A.osonYoq(), (g) => ['reyestr_rad', [m(g)]]],
  inventarYop: [() => A.osonYoq(), (id) => ['inventar_yop', [id]]],
  inventarNatija: [() => A.osonYoq(), (id) => ['inventar_natija', [id]]],
  // 07.11 kech (20261107200000_ombor_aqlli): muddat siyosati (direktor), bugungi sanash (kunlik inventarizatsiya) — faqat serverda.
  muddatSiyosat: [() => A.osonYoq(), (ogoh, javon) => ['muddat_siyosat', [Math.trunc(Number(ogoh) || 0), Math.trunc(Number(javon) || 0)]]],
  kunlikSanash: [() => A.osonYoq(), (b) => ['kunlik_sanash', [m(b)]]],
  kunlikSanashBoshla: [() => A.osonYoq(), (b) => ['kunlik_sanash_boshla', [m(b)]]],
  defekturaMijoz: [() => A.osonYoq(), (id) => ['defektura_mijoz', [id]]],
  defekturaMijozgaYubor: [() => A.osonYoq(), (id) => ['defektura_mijozga_yubor', [id]]],
  // 07.11 kech (20261107220000_mijoz_boti): mijoz botda qilgan bronlar — faqat serverda (bron.mjs).
  bronlar: [() => A.osonYoq(), () => ['bron_royxat', []]],
  bronHolat: [() => A.osonYoq(), (id, holat) => ['bron_holat', [id, m(holat)]]],
  // 07.11 tun (20261107260000_hisobdan_chiqarish): hisobdan chiqarish / firmaga qaytarish — faqat serverda (chiqarish.mjs).
  chiqarishYoz: [() => A.osonYoq(), (b, pr, tur, quti, dona, sabab, izoh, firma) => ['chiqarish_yoz',
    [m(b), m(pr), m(tur), Math.trunc(Number(quti) || 0), Math.trunc(Number(dona) || 0), m(sabab), String(izoh || '').trim().slice(0, 300), String(firma || '').trim().slice(0, 200)]]],
  chiqarishRoyxat: [() => A.osonYoq(), (kun) => ['chiqarish_royxat', [Math.trunc(Number(kun) || 30)]]],
  chiqarishBekor: [() => A.osonYoq(), (id, sabab) => ['chiqarish_bekor', [id, String(sabab || '').trim().slice(0, 300)]]],
  smenaDirektorYop: [(S, men, id) => A.smenaDirektorYop(S, men.id, id), (id) => ['smena_direktor_yop', [id]]],
  savdoYoq: [(S, men, f, kun, yoq) => A.savdoYoq(S, men.id, f, kun, yoq), (f, kun, yoq) => ['savdo_yoq_belgila', [m(f), m(kun), !!yoq]]],
  punktQosh: [(S, men, nom) => A.punktQosh(S, nom), (nom) => ['punkt_qosh', [m(nom)]]],
  punktTaklif: [(S, men, id) => A.punktTaklif(S, id), (id) => ['punkt_taklif', [id]]],
  punktTelefon: [(S, men, id, tel) => A.punktTelefon(S, id, tel), (id, tel) => ['punkt_telefon', [id, m(tel)]]],
  punktUzish: [(S, men, id) => A.punktUzish(S, id), (id) => ['punkt_uzish', [id]]],
  rasmRoyxat: [(S, men, id, qr, matn) => A.rasmRoyxat(S, id, qr, matn), (id, qr, matn) => ['rasm_royxat', [id, !!qr, String(matn || '').slice(0, 20000)]]],
  bemorHolat: [(S, men, id, holat, sabab) => A.bemorHolat(S, id, holat, sabab, men.ism), (id, holat, sabab) => ['bemor_holat', [id, m(holat), sabab || '']]],
  bemorlarHammasi: [(S, men, p, kun, holat) => A.bemorlarHammasi(S, p, kun, holat, men.ism), (p, kun, holat) => ['bemorlar_hammasi', [p, m(kun), m(holat)]]],
  punktgaXabar: [(S, men, p, kun) => A.punktgaXabar(S, p, kun), (p, kun) => ['punktga_xabar', [p, m(kun)]]],
  punktQolda: [(S, men, p, matn) => A.punktQolda(S, p, matn), (p, matn) => ['punkt_qolda', [p, String(matn || '').slice(0, 20000)]]],
  // Punkt o'zi (men.id — punkt id): bitta bemor formadan.
  punktBemor: [(S, men, f) => A.punktBemor(S, men.id, f),
    (f) => ['punkt_bemor', [String(f.ism || '').trim(), H.raqamlar(f.jshshir), (f.kodlar || []).map(H.raqamlar).filter(Boolean).join(',')]]],
  aptekaNomla: [(S, men, nom) => A.aptekaNomla(S, nom), (nom) => ['apteka_nomla', [m(nom)]]],
  // 07.11 (20261107230000_audit_jurnal): o'zgarishlar jurnali (jadval — bo'sh = hammasi, kun 1–180) va zaxira fayli kimga —
  // faqat serverda. zaxiraMenga(true) — tungi zaxira har kuni jim shu direktorga (Sozlamalar → «Zaxira fayli menga kelsin»).
  auditRoyxat: [() => { throw new Error('Jurnal faqat Telegram ilovasida (serverda) ishlaydi'); }, (jadval, kun) => ['audit_royxat', [m(jadval), Math.trunc(Number(kun) || 7)]]],
  zaxiraHolat: [() => { throw new Error('Sinov rejimida zaxira yo\'q — Telegram ilovasida ishlaydi'); }, () => ['zaxira_holat', []]],
  zaxiraMenga: [() => { throw new Error('Sinov rejimida zaxira yo\'q — Telegram ilovasida ishlaydi'); }, (yoq) => ['zaxira_menga', [!!yoq]]],
  // 07.11: direktor — xodim va mijoz (bot) imkoniyatlarini yoqish/o'chirish (faqat serverda; sinov rejimida hammasi yoqiq).
  funksiyalar: [() => { throw new Error('Faqat Telegram ilovasida (serverda) ishlaydi'); }, () => ['funksiyalar', []]],
  funksiyaSaqla: [() => { throw new Error('Faqat Telegram ilovasida (serverda) ishlaydi'); }, (kalit, yoq) => ['funksiya_saqla', [m(kalit), !!yoq]]],
  taXarid: [(S, men, s, iz, rows) => A.taXarid(S, men.id, s, iz, rows), (s, iz, rows) => {
    const r = H.xaridQatorlar(rows);
    if (r.xato) throw new Error(r.xato);
    return ['ta_xarid', [r.qatorlar.length ? null : p(s), iz || '', r.qatorlar.length ? r.qatorlar : null]];
  }]
};

// Server so'rovini tayyorlash: [amal, args]. Noto'g'ri pul yozilsa — xato (so'rov yuborilmaydi).
export const serverSorovi = (nom, args) => ISHLAR[nom][1](...args);
// Sinov rejimida bajarish.
export const sinovdaBajar = (nom, S, men, args) => ISHLAR[nom][0](S, men, ...args);
