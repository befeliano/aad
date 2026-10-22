/**
 * ============================================================
 * Anatolia Aero Design — İletişim formu → takım e-postası
 *
 * Sitedeki iletişim formundan gelen her mesajı takım adresine
 * (anatoliaaerodesign@gmail.com) e-posta olarak iletir. "Yanıtla"ya
 * basınca doğrudan mesajı yazan kişiye gider.
 *
 * KURULUM (bir kez, ~2 dk) — başvuru formu için kurduğunuz AYNI
 * Apps Script projesine:
 *
 *  0. Supabase'de supabase/iletisim-mail.sql çalıştırılmış olmalı.
 *  1. Sol menü → Files yanındaki + → Script → adı "iletisim" olsun.
 *     Bu dosyanın TAMAMINI yapıştırıp kaydedin. (PANEL_URL ve
 *     PANEL_SECRET zaten tanımlı; ek ayar yok.)
 *  2. Fonksiyon listesinden `iletisimKur` → Çalıştır → izinleri onaylayın.
 *     5 dakikada bir çalışan tetikleyiciyi kurar.
 *  3. Denemek için sitedeki iletişim formundan bir mesaj gönderin,
 *     sonra `iletisimKontrol` çalıştırın: mail takım adresine düşmeli.
 * ============================================================
 */

/** 5 dakikada bir çalışan tetikleyiciyi kurar (eskisini siler) */
function iletisimKur() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "iletisimKontrol") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("iletisimKontrol").timeBased().everyMinutes(5).create();
  Logger.log("İletişim mesajları 5 dakikada bir takım mailine iletilecek.");
}

/** Mail atılmamış mesajları gönderir ve işaretler */
function iletisimKontrol() {
  var ayar = iletisimAyar_();
  var res = UrlFetchApp.fetch(ayar.url, {
    method: "get",
    headers: { Authorization: "Bearer " + ayar.secret },
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() !== 200) {
    throw new Error("Panel " + res.getResponseCode() + " döndürdü: " + res.getContentText());
  }
  var veri = JSON.parse(res.getContentText());
  var gonderilen = [];

  (veri.mesajlar || []).forEach(function (m) {
    var konu = "[Site iletişim] " + (m.subject || "Mesaj") + (m.name ? " — " + m.name : "");
    var govde =
      "Sitedeki iletişim formundan yeni mesaj:\n\n" +
      "Ad Soyad : " + (m.name || "-") + "\n" +
      "E-posta  : " + (m.email || "-") + "\n" +
      "Konu     : " + (m.subject || "-") + "\n" +
      "Tarih    : " + new Date(m.created_at).toLocaleString("tr-TR") + "\n\n" +
      (m.message || "") +
      "\n\n— Bu mesaja \"Yanıtla\" derseniz doğrudan gönderene gider.\n" +
      "Panelde: " + veri.adres;
    var secenek = { to: veri.alici, subject: konu, body: govde };
    if (m.email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(m.email)) secenek.replyTo = m.email;
    MailApp.sendEmail(secenek);
    gonderilen.push(m.id);
  });

  if (gonderilen.length > 0) {
    UrlFetchApp.fetch(ayar.url, {
      method: "post",
      contentType: "application/json",
      headers: { Authorization: "Bearer " + ayar.secret },
      payload: JSON.stringify({ ids: gonderilen }),
      muteHttpExceptions: true,
    });
  }
  Logger.log(gonderilen.length + " mesaj takım mailine iletildi.");
}

function iletisimAyar_() {
  var p = PropertiesService.getScriptProperties();
  var formUrl = p.getProperty("PANEL_URL");
  var secret = p.getProperty("PANEL_SECRET");
  if (!formUrl || !secret) {
    throw new Error("Proje Ayarları'nda PANEL_URL ve PANEL_SECRET tanımlanmalı.");
  }
  return {
    url: formUrl.replace(/\/api\/mulakat\/form\/?$/, "/api/iletisim/bildirim"),
    secret: secret,
  };
}
