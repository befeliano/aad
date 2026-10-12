/**
 * ============================================================
 * Anatolia Aero Design — Yoklama hatırlatma e-postası
 *
 * Birim kaptanı yoklama almadıysa, alana kadar HER AKŞAM kaptana
 * e-posta gider. Panel listeyi hazırlar (/api/yoklama/eksikler), bu
 * betik Gmail'den gönderir. SMTP ya da ek ayar gerekmez.
 *
 * KURULUM (bir kez, ~2 dk) — başvuru formu için kurduğunuz AYNI
 * Apps Script projesine:
 *
 *  1. Sol menü → Files yanındaki + → Script → adı "yoklama" olsun.
 *     Bu dosyanın TAMAMINI içine yapıştırıp kaydedin.
 *     (PANEL_URL ve PANEL_SECRET özellikleri zaten tanımlı; ek ayar yok.)
 *  2. Proje Ayarları (⚙) → "Time zone" Europe/Istanbul (GMT+03:00) olsun.
 *  3. Fonksiyon listesinden `yoklamaKur` → Çalıştır → izinleri onaylayın
 *     (bu kez Gmail ile gönderme izni de istenir). Her akşam 20:00–21:00
 *     arası çalışacak tetikleyiciyi kurar.
 *  4. Denemek için `yoklamaDene` çalıştırın: kimseye mail ATMAZ, kime ne
 *     gideceğini yürütme günlüğüne yazar.
 *
 * Mailler bu betiği kuran Google hesabından gider (günlük ~100 mail
 * sınırı var; birim sayısı kadar mail gittiği için fazlasıyla yeter).
 * Mail, kaptanın Profilim → "Bildirim e-postası" alanına yazdığı adrese
 * gider (giriş adresine DEĞİL). Kaptanı ya da e-postası olmayan
 * birimlerin eksikleri betiği kuran kişiye özetlenir.
 * ============================================================
 */

/** Her akşam çalışan tetikleyiciyi kurar (eskisini siler) */
function yoklamaKur() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "yoklamaHatirlat") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("yoklamaHatirlat").timeBased().everyDays(1).atHour(20).create();
  Logger.log("Yoklama hatırlatması her akşam 20:00 civarı çalışacak.");
}

/** Tetikleyici: eksik yoklaması olan her kaptana mail atar */
function yoklamaHatirlat() {
  yoklamaCalistir_(true);
}

/** Deneme: mail atmaz, ne yapılacağını günlüğe yazar */
function yoklamaDene() {
  yoklamaCalistir_(false);
}

function yoklamaCalistir_(gonder) {
  var veri = eksikleriGetir_();
  var kaptanlar = veri.kaptanlar || [];
  var kaptansiz = veri.kaptansiz || [];
  var epostasiz = veri.epostasiz || [];

  if (kaptanlar.length === 0 && kaptansiz.length === 0 && epostasiz.length === 0) {
    Logger.log(veri.tarih + ": eksik yoklama yok.");
    return;
  }

  kaptanlar.forEach(function (k) {
    var konu = "Yoklama hatırlatması — " + k.birimAdi + " (" + k.gunler.length + " gün)";
    var govde =
      "Merhaba" + (k.ad ? " " + k.ad : "") + ",\n\n" +
      k.birimAdi + " biriminin şu günlerdeki yoklaması henüz alınmadı:\n\n" +
      k.gunler.map(function (g) { return "  • " + gunYaz_(g); }).join("\n") +
      "\n\nYoklamayı Çalışma Takvimi'nden ilgili güne tıklayarak alabilirsin:\n" +
      veri.adres +
      "\n\nYoklama alınana kadar bu hatırlatma her akşam gelecek.\n\n— Anatolia Aero Design paneli";
    if (gonder) {
      MailApp.sendEmail(k.email, konu, govde);
      Logger.log("Gönderildi: " + k.email + " (" + k.birimAdi + ", " + k.gunler.length + " gün)");
    } else {
      Logger.log("[deneme] " + k.email + " ← " + konu);
    }
  });

  // Kimseye mail gidemeyen eksikler betik sahibine tek bir özet olarak gider
  var satirlar = [];
  kaptansiz.forEach(function (b) {
    satirlar.push("  • " + b.birimAdi + " (birim kaptanı atanmamış): " + b.gunler.map(gunYaz_).join(", "));
  });
  epostasiz.forEach(function (b) {
    satirlar.push("  • " + b.birimAdi + " — " + (b.ad || "kaptan") +
      " Profilim'e bildirim e-postası yazmamış: " + b.gunler.map(gunYaz_).join(", "));
  });
  if (satirlar.length > 0) {
    var ben = Session.getEffectiveUser().getEmail();
    var konu2 = "Yoklama: hatırlatma gidemeyen birimler";
    var govde2 =
      "Şu birimlerin yoklaması eksik ama hatırlatma e-postası kimseye gidemedi " +
      "(bu kaptanlar yine de paneldeki bildirim zilinde görüyor):\n\n" +
      satirlar.join("\n") +
      "\n\nKaptan yoksa Üye Yönetimi'nden atayın; e-posta yoksa kaptandan " +
      "Profilim → Bildirim e-postası alanını doldurmasını isteyin.\n" + veri.adres;
    if (gonder && ben) MailApp.sendEmail(ben, konu2, govde2);
    else Logger.log("[deneme] " + (ben || "(betik sahibi)") + " ← " + konu2 + "\n" + satirlar.join("\n"));
  }
}

function eksikleriGetir_() {
  var p = PropertiesService.getScriptProperties();
  var formUrl = p.getProperty("PANEL_URL");
  var secret = p.getProperty("PANEL_SECRET");
  if (!formUrl || !secret) {
    throw new Error("Proje Ayarları'nda PANEL_URL ve PANEL_SECRET tanımlanmalı.");
  }
  // PANEL_URL başvuru webhook'unu gösteriyor; aynı sitenin yoklama adresi
  var url = formUrl.replace(/\/api\/mulakat\/form\/?$/, "/api/yoklama/eksikler");

  var res = UrlFetchApp.fetch(url, {
    method: "get",
    headers: { Authorization: "Bearer " + secret },
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() !== 200) {
    // Hata fırlatmak, Google'ın betik sahibine e-posta atmasını sağlar
    throw new Error("Panel " + res.getResponseCode() + " döndürdü: " + res.getContentText());
  }
  return JSON.parse(res.getContentText());
}

/** "2026-10-17" → "17 Ekim 2026 Cumartesi" */
function gunYaz_(k) {
  var aylar = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
    "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
  var gunler = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
  var p = k.split("-");
  var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]), 12);
  return d.getDate() + " " + aylar[d.getMonth()] + " " + d.getFullYear() + " " + gunler[d.getDay()];
}
