// Ochilish qorovuli (06.11; foydalanuvchi: "Mini appga kirmayabdi" — iPhone'da OQ BO'SH EKRAN, serverga birorta so'rov
// kelmagan). Oddiy (modul emas) skript, eng birinchi ishlaydi; hech narsaga bog'liq emas.
// - Ilova kodi (src/app.mjs va ~25 ta modul) 12 s ichida ekranni chizmasa yoki yuklanishda xato bo'lsa — oq ekran o'rniga
//   tushunarli karta: nima kelmadi (Telegram skripti / ilova kodi), «Qayta urinish» (sahifani qayta yuklaydi).
// - Kirill yozuvi tanlangan bo'lsa (kirill.mjs bilan bir xil kalit) — kirillda.
// app.mjs birinchi chizishdan keyin window.__ilova.tayyor = true qiladi.
(function () {
  var t0 = Date.now();
  var I = window.__ilova = { t0: t0, tayyor: false, xatolar: [] };
  var kir = false;
  try { kir = localStorage.getItem('apteka-yozuv') === 'kirill'; } catch (e) { /* yopiq xotira */ }
  var M = kir ? {
    sarlavha: 'Илова юкланмади',
    matn: 'Интернет секин ёки узилган — илова файллари телефонга етиб келмади. «Қайта уриниш»ни босинг. Такрорланса — Wi‑Fi ёки мобил интернетни алмаштириб кўринг.',
    xatoMatn: 'Илова ишга тушмади — «Қайта уриниш»ни босинг; такрорланса, ушбу ёзувни расмга олиб директорга юборинг.',
    tugma: 'Қайта уриниш', tg: 'Telegram скрипти', kod: 'илова коди', bor: 'бор', yoq: 'йўқ', kelmadi: 'келмади'
  } : {
    sarlavha: 'Ilova yuklanmadi',
    matn: 'Internet sekin yoki uzilgan — ilova fayllari telefonga yetib kelmadi. «Qayta urinish»ni bosing. Takrorlansa — Wi‑Fi yoki mobil internetni almashtirib ko\'ring.',
    xatoMatn: 'Ilova ishga tushmadi — «Qayta urinish»ni bosing; takrorlansa, shu yozuvni rasmga olib direktorga yuboring.',
    tugma: 'Qayta urinish', tg: 'Telegram skripti', kod: 'ilova kodi', bor: 'bor', yoq: 'yo\'q', kelmadi: 'kelmadi'
  };
  // Telegram'ga «sahifa tayyor» (audit 06.11): Telegram o'z yuklanish pardasini ready() kelguncha yoki sahifa TO'LIQ yuklanguncha
  // ushlab turadi — ilova modullaridan biri kelmasa, «yuklanmoqda» yozuvi ham, quyidagi karta ham parda orqasida qolardi.
  // Shuning uchun HTML o'qilishi bilan aytiladi. SDK (defer) hali bo'lmasa — Telegram'ning o'z ko'prigi orqali (SDK postEvent bilan bir xil).
  var tayyorDedi = false;
  function tgTayyor() {
    if (tayyorDedi) return;
    try {
      if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.ready) window.Telegram.WebApp.ready();
      else if (window.TelegramWebviewProxy && window.TelegramWebviewProxy.postEvent) window.TelegramWebviewProxy.postEvent('web_app_ready', '""');
      else if (window.external && 'notify' in window.external) window.external.notify(JSON.stringify({ eventType: 'web_app_ready', eventData: '' }));
      else if (window.parent && window.parent !== window) window.parent.postMessage(JSON.stringify({ eventType: 'web_app_ready', eventData: '' }), 'https://web.telegram.org');
      else return;
      tayyorDedi = true;
    } catch (e) { /* Telegram'dan tashqarida */ }
  }
  if (document.readyState !== 'loading') tgTayyor();
  else document.addEventListener('readystatechange', function () { if (document.readyState !== 'loading') tgTayyor(); });
  var korsatildi = false;
  function korsat(xatoBor) {
    if (I.tayyor || korsatildi) return;
    var app = document.getElementById('app');
    if (!app) { setTimeout(function () { korsat(xatoBor); }, 1000); return; }   // HTML hali o'qilmagan — keyinroq
    korsatildi = true;
    tgTayyor();
    var tgBor = !!(window.Telegram && window.Telegram.WebApp);
    var tafsil = M.tg + ': ' + (tgBor ? M.bor : M.yoq) + ' · ' + M.kod + ': ' + M.kelmadi
      + (I.xatolar.length ? ' (' + I.xatolar.slice(0, 3).join(', ') + ')' : '') + ' · ' + Math.round((Date.now() - t0) / 1000) + ' s';
    while (app.firstChild) app.removeChild(app.firstChild);
    var k = document.createElement('div');
    k.setAttribute('role', 'alert');
    k.style.cssText = 'margin:16px;padding:16px;border-radius:14px;background:#FFF6E0;border:1px solid #E8C979;color:#3A2E00;font:16px/1.45 -apple-system,system-ui,sans-serif';
    var b = document.createElement('b'); b.textContent = M.sarlavha; b.style.cssText = 'display:block;font-size:18px;margin-bottom:6px';
    var p = document.createElement('div'); p.textContent = xatoBor ? M.xatoMatn : M.matn;
    var d = document.createElement('div'); d.textContent = tafsil; d.style.cssText = 'margin-top:8px;font-size:14px;color:#6B5A1E';
    var btn = document.createElement('button'); btn.type = 'button'; btn.textContent = M.tugma;
    btn.style.cssText = 'margin-top:12px;width:100%;min-height:48px;border:0;border-radius:12px;background:#1F7A4D;color:#fff;font:600 17px -apple-system,system-ui,sans-serif';
    btn.addEventListener('click', function () { location.reload(); });
    k.appendChild(b); k.appendChild(p); k.appendChild(d); k.appendChild(btn);
    app.appendChild(k);
  }
  // Fayl yuklanmadi (script/link) yoki ilova kodi ishga tushishda xato — darhol karta.
  window.addEventListener('error', function (e) {
    var t = e && e.target;
    if (t && t !== window && (t.src || t.href)) { I.xatolar.push(String(t.src || t.href).split('/').pop()); korsat(false); return; }
    if (e && e.error && !I.tayyor) { I.xatolar.push(String(e.message || e.error).slice(0, 60)); setTimeout(function () { korsat(true); }, 1500); }
  }, true);
  setTimeout(function () { korsat(false); }, 12000);
})();
