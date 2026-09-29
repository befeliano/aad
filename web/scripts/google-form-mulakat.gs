/**
 * ============================================================
 * Anatolia Aero Design — Başvuru Formu → Panel (Mülakatlar)
 *
 * Form her doldurulduğunda cevapları panele gönderir; panelde o kişi
 * için otomatik bir aday sayfası açılır. Google Sheets GEREKMEZ —
 * betik doğrudan forma bağlanır. Make.com / Zapier de gerekmez.
 *
 * KURULUM (bir kez, formun sahibi / düzenleyicisi yapar, ~5 dk)
 *
 *  0. Vercel → Project Settings → Environment Variables:
 *       SUPABASE_SERVICE_ROLE_KEY  Supabase → Project Settings → API →
 *                                  "service_role" anahtarı (GİZLİ)
 *       MULAKAT_WEBHOOK_SECRET     en az 16 karakterlik rastgele bir metin
 *                                  (örn. bir parola üreticisinden 40 karakter)
 *     Ardından yeniden deploy edin. Supabase'de supabase/mulakat-form.sql
 *     çalıştırılmış olmalı.
 *
 *  1. Formu düzenleme modunda açın → sağ üstteki ⋮ → "Komut dosyası
 *     düzenleyici" (Apps Script).
 *  2. Code.gs'nin içeriğini silip bu dosyanın TAMAMINI yapıştırın, kaydedin.
 *  3. Sol menü → Proje Ayarları (⚙) → en altta "Komut dosyası
 *     özellikleri" → iki özellik ekleyin:
 *       PANEL_URL     https://<site-adresiniz>/api/mulakat/form
 *       PANEL_SECRET  Vercel'deki MULAKAT_WEBHOOK_SECRET ile AYNI metin
 *  4. Düzenleyiciye dönün, üstteki fonksiyon listesinden `kur` seçip
 *     ▶ Çalıştır'a basın. Google izin isteyecek (formu okuma + dış
 *     bağlantı) → onaylayın. Bu, "form gönderilince çalış" tetikleyicisini
 *     kurar.
 *  5. `baglantiyiDene` çalıştırın: yürütme günlüğünde "Bağlantı tamam"
 *     görmelisiniz.
 *  6. Daha önce gelmiş başvuruları da aktarmak için `tumunuGonder`
 *     çalıştırın. Aynı başvuru iki kez eklenmez, var olan notlar ezilmez;
 *     gönül rahatlığıyla tekrar çalıştırabilirsiniz.
 *
 * Bir gönderim başarısız olursa Google formun sahibine e-posta ile
 * bildirir; sorun giderilince `tumunuGonder` eksikleri tamamlar.
 * ============================================================
 */

/** Form gönderilince çalışacak tetikleyiciyi kurar (eskisini siler) */
function kur() {
  var form = FormApp.getActiveForm();
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "formGonderildi") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("formGonderildi").forForm(form).onFormSubmit().create();
  Logger.log("Tetikleyici kuruldu: " + form.getTitle());
}

/** Tetikleyici — her yeni başvuruda */
function formGonderildi(e) {
  gonder_(e.response);
}

/** Formdaki tüm eski başvuruları gönderir (tekrarlar panelde yok sayılır) */
function tumunuGonder() {
  var yanitlar = FormApp.getActiveForm().getResponses();
  var yeni = 0, zatenVar = 0, hatali = 0;
  yanitlar.forEach(function (r) {
    try {
      if (gonder_(r).yeni) yeni++;
      else zatenVar++;
    } catch (err) {
      hatali++;
      Logger.log("Gönderilemedi (" + r.getId() + "): " + err);
    }
  });
  Logger.log(
    yanitlar.length + " başvuru: " + yeni + " yeni, " + zatenVar +
      " zaten vardı, " + hatali + " hatalı."
  );
}

/** Ayarları ve anahtarı sınar — kayıt açmaz */
function baglantiyiDene() {
  var ayar = ayarlar_();
  var res = UrlFetchApp.fetch(ayar.url, {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: "Bearer " + ayar.secret },
    payload: JSON.stringify({ answers: [] }),
    muteHttpExceptions: true,
  });
  var kod = res.getResponseCode();
  // Boş cevap listesi 400 döner: anahtar kabul edildi demektir
  if (kod === 400) Logger.log("Bağlantı tamam — anahtar doğru.");
  else if (kod === 401) Logger.log("Anahtar yanlış: PANEL_SECRET ile MULAKAT_WEBHOOK_SECRET aynı değil.");
  else if (kod === 503) Logger.log("Sunucu ayarı eksik: " + res.getContentText());
  else Logger.log("Beklenmeyen yanıt " + kod + ": " + res.getContentText());
}

function ayarlar_() {
  var p = PropertiesService.getScriptProperties();
  var url = p.getProperty("PANEL_URL");
  var secret = p.getProperty("PANEL_SECRET");
  if (!url || !secret) {
    throw new Error("Proje Ayarları'nda PANEL_URL ve PANEL_SECRET tanımlanmalı.");
  }
  return { url: url, secret: secret };
}

/** Tek başvuruyu panele gönderir */
function gonder_(r) {
  var ayar = ayarlar_();

  var answers = r.getItemResponses().map(function (ir) {
    return { question: ir.getItem().getTitle(), answer: metne_(ir.getResponse()) };
  });

  var eposta = "";
  try {
    eposta = r.getRespondentEmail() || "";
  } catch (err) {
    // Form e-posta toplamıyorsa
  }

  var res = UrlFetchApp.fetch(ayar.url, {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: "Bearer " + ayar.secret },
    payload: JSON.stringify({
      response_id: r.getId(),
      submitted_at: r.getTimestamp().toISOString(),
      respondent_email: eposta,
      answers: answers,
    }),
    muteHttpExceptions: true,
  });

  var kod = res.getResponseCode();
  if (kod >= 300) {
    // Hata fırlatmak, Google'ın formun sahibine e-posta atmasını sağlar
    throw new Error("Panel " + kod + " döndürdü: " + res.getContentText());
  }
  return JSON.parse(res.getContentText());
}

/** Onay kutusu / ızgara cevapları dizi gelir: düz metne çevir */
function metne_(v) {
  if (v === null || v === undefined) return "";
  if (Array.isArray(v)) {
    return v
      .map(function (x) { return Array.isArray(x) ? x.join(" / ") : String(x); })
      .filter(function (x) { return x; })
      .join(", ");
  }
  return String(v);
}
