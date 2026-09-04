# Uçuş Analiz ve Görselleştirme Sistemi

**Proje:** Anatolia Aero Design — Savaşan İHA Yarışması 2026
**Doküman türü:** Teknik tasarım / mimari
**Kapsam:** Sunucudan/loglardan gelen telemetri verisinin kaydedilmesi, geriye sarılabilir (scrubbable) şekilde tekrar oynatılması, harita üzerinde uçuş rotası (trail), Hava Savunma Sistemi (HSS) bölgeleri, kilitlenme/kamikaze olayları ve **algoritmanın o anki karar durumunun** (mod, hedef, RK4 tahmini) görselleştirilmesi.

**İş bölümü (06.08.2026 itibarıyla):**
- ROS tarafındaki loglama (mod değişimleri, RK4 tahminleri, algoritma durumu) → Erdeniz + Mehmet, şema yarına kadar netleşecek.
- Backend (Playback API) + Frontend (bu doküman + prototip) → burada teslim edilen kısım.
- Şema geldiğinde tek değişiklik gerekecek yer: `backend/main.py` içindeki yorum satırı haline getirilmiş `algorithm_state` / `rk4_predictions` sorguları aktif edilecek.

---

## 1. Amaç ve Kapsam

Erdeniz'in belirttiği ihtiyaç: *"kayıt tutan sistemi görselleştiren, ileri geri sarılabilen, belli zaman aralığında uçağın trail'ini gösterebilen, aynı anda uçağın kamera görüntüsünü de gösterebilen geniş bir analiz sistemi."*

Bu sistem iki bağlamda kullanılacak:

| Bağlam | Kullanım |
|---|---|
| **Simülasyon / geliştirme** | Algoritma optimizasyonu sırasında (RK4 tahmin, PN guidance, hedef takibi) uçuşun neden o kararı verdiğini görsel olarak incelemek |
| **Yarışma sonrası analiz** | Her seans sonunda dönüp uçuşu tekrar oynatmak, kilitlenme/kamikaze anlarını doğrulamak, rakip davranışlarını incelemek |

Kapsam dışı (bu sürümde): canlı video akışı senkronu. Bu, ileri bir aşamada ayrı bir modül olarak eklenecek (bkz. §9 Yol Haritası).

---

## 2. Veri Kaynağı: Yarışma Şartnamesiyle Uyum

TEKNOFEST 2026 Haberleşme Dokümanı'ndaki gerçek alan adları temel alınmıştır. Analiz sisteminin veritabanı şeması, sunucudan gelen/giden JSON yapılarıyla birebir örtüşecek şekilde tasarlanmıştır — böylece canlı yarışma sırasında ekstra dönüştürme katmanı gerekmez.

### 2.1 Kendi İHA'mızın gönderdiği telemetri (`POST /api/telemetri_gonder`)

```json
{
  "takim_numarasi": 1,
  "iha_enlem": 41.508775,
  "iha_boylam": 36.118335,
  "iha_irtifa": 38,
  "iha_dikilme": 7,
  "iha_yonelme": 210,
  "iha_yatis": -30,
  "iha_hiz": 28,
  "iha_batarya": 50,
  "iha_otonom": 1,
  "iha_kilitlenme": 1,
  "hedef_merkez_X": 300,
  "hedef_merkez_Y": 230,
  "hedef_genislik": 30,
  "hedef_yukseklik": 43,
  "gps_saati": { "saat": 11, "dakika": 38, "saniye": 37, "milisaniye": 654 }
}
```

### 2.2 Sunucudan gelen rakip konum listesi (telemetri cevabı)

```json
{
  "sunucusaati": { "gun": 13, "saat": 11, "dakika": 38, "saniye": 38, "milisaniye": 739 },
  "konumBilgileri": [
    {
      "takim_numarasi": 2,
      "iha_enlem": 41.5100365,
      "iha_boylam": 36.11837,
      "iha_irtifa": 44.0,
      "iha_dikilme": 24.0,
      "iha_yonelme": 277.0,
      "iha_yatis": -37.0,
      "iha_hizi": 40.0,
      "zaman_farki": 248
    }
  ]
}
```

> ⚠️ **Önemli fark:** Rakip konum verisinde `hedef_merkez_X/Y`, `hedef_genislik/yukseklik`, `iha_batarya`, `iha_otonom`, `iha_kilitlenme` **yok**. Bu alanlar yalnızca kendi gönderdiğimiz pakette bulunur. Analiz aracı bu ayrımı tabloda ayrı sütun/nullable alanlarla yansıtmalı, aksi halde rakip uçaklar için sahte "hedef kutusu" çizilir.

### 2.3 Olay tipleri

- **Kilitlenme** (`POST /api/kilitlenme_bilgisi`): `kilitlenmeBitisZamani` + `otonom_kilitlenme`
  > Erdeniz'in netleştirmesi (06.08.2026): telemetri paketindeki `iha_kilitlenme` alanı **kilitlenmeye çalıştığımız anı** ifade eder, kilitlenmenin başarıyla tamamlandığı anı değil. Bu iki sinyal **bağımsızdır** — biri diğerinin türevi değildir, ayrı ayrı kaydedilmelidir. `iha_kilitlenme=1` → "kilitlenme denemesi sürüyor"; `kilitlenme_events` tablosu → "deneme başarıyla sonuçlandı".
- **Kamikaze** (`POST /api/kamikaze_bilgisi`): `kamikazeBaslangicZamani`, `kamikazeBitisZamani`, `qrMetni`
- **HSS bölgeleri** (`GET /api/hss_koordinatlari`): `id`, `hssEnlem`, `hssBoylam`, `hssYaricap`
  > Erdeniz'in netleştirmesi (06.08.2026): HSS koordinatları hakemden **bir kez** çekilip ROS tarafında `nfz_areas` topiğine publish edilir. Logger bunu **event tabanlı** kaydeder: açılış anında bir kayıt, kapanış anında bir kayıt — sürekli polling/interval bazlı değil. Bu, §3'teki `hss_events` şemasını (aç/kapa çifti) doğrudan belirliyor.

### 2.4 Algoritma durumu (ROS tarafı — tahmini şema, Erdeniz & Mehmet netleştirecek)

Aşağıdaki iki alan henüz kesinleşmiş bir tablo şemasına sahip değil; bu doküman ve prototip, ROS logger'ının **ne kaydetmesi gerektiğine dair bir öneri** olarak mock veriyle dolduruldu. Şema geldiğinde yalnızca §3'teki tablo tanımı ve §5'teki API sorgusu güncellenecek, frontend değişmeyecek.

- **Mod / durum makinesi:** Örn. `ARAMA → TAKİP → KİLİTLENME → KAMİKAZE`, `KAÇINMA` (HSS'ten kaçınma manevrası). Her geçişin zaman damgası ve (varsa) hedef takım numarası.
- **RK4 konum tahmini** (`rk4_predictions` tablosu, zaten mevcut): rakip uçağın bir sonraki anda nerede olacağının tahmini. Playback'te bunu **gerçek konumun yanında "hayalet iz"** olarak görmek, algoritmanın ne kadar isabetli tahmin ettiğini (tahmin hatası, metre cinsinden) doğrudan gösterir.

---

## 3. Veritabanı Şeması (SQLite)

Mevcut `.db` dosyasının üzerine, mevcut `rk4_predictions` ve `incoming_telemetry` tablolarıyla **çakışmayacak** şekilde genişletme:

```sql
-- Kendi İHA'mızın gönderdiği/gönderilecek telemetri
CREATE TABLE IF NOT EXISTS own_telemetry (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp       REAL,           -- epoch, local kayıt anı
    gps_saat        REAL,           -- gps_saati -> epoch'a çevrilmiş
    takim_numarasi  INTEGER,
    iha_enlem       REAL,
    iha_boylam      REAL,
    iha_irtifa      REAL,
    iha_dikilme     REAL,
    iha_yonelme     REAL,
    iha_yatis       REAL,
    iha_hiz         REAL,
    iha_batarya     REAL,
    iha_otonom      INTEGER,
    iha_kilitlenme  INTEGER,
    hedef_merkez_x  REAL,
    hedef_merkez_y  REAL,
    hedef_genislik  REAL,
    hedef_yukseklik REAL
);

-- Rakip uçakların telemetrisi (incoming_telemetry genişletilmiş hali / mevcut tabloya uyumlu)
-- Not: incoming_telemetry zaten var; zaman_farki ve sunucu_saati eklenmesi önerilir.
ALTER TABLE incoming_telemetry ADD COLUMN zaman_farki REAL;
ALTER TABLE incoming_telemetry ADD COLUMN sunucu_saati REAL;

-- Kilitlenme olayları
CREATE TABLE IF NOT EXISTS kilitlenme_events (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    kilitlenme_bitis_ts   REAL,     -- epoch
    otonom_kilitlenme     INTEGER,
    hedef_takim_numarasi  INTEGER   -- (opsiyonel, kendi tuttuğumuz ek bilgi)
);

-- Kamikaze olayları
CREATE TABLE IF NOT EXISTS kamikaze_events (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    baslangic_ts      REAL,
    bitis_ts          REAL,
    qr_metni          TEXT
);

-- HSS (Hava Savunma Sistemi) bölgeleri — EVENT TABANLI (Erdeniz'in netleştirmesi):
-- hakemden bir kez çekilip nfz_areas topiğine publish edilir; logger açılışta
-- ve kapanışta birer kayıt atar. Sürekli polling/interval DEĞİLDİR.
CREATE TABLE IF NOT EXISTS hss_events (
    hss_id        INTEGER PRIMARY KEY,
    hss_enlem     REAL,
    hss_boylam    REAL,
    hss_yaricap   REAL,
    opened_ts     REAL,      -- aktif edildiği an (epoch)
    closed_ts     REAL       -- kapatıldığı an (epoch), NULL ise hâlâ aktif
);

-- QR / kamikaze hedef koordinatı (tek, oturum başına sabit olabilir)
CREATE TABLE IF NOT EXISTS qr_koordinati (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    ts          REAL,
    qr_enlem    REAL,
    qr_boylam   REAL
);

-- ═══════════════════════════════════════════════════════════════
-- AŞAĞIDAKİ İKİ TABLO TAHMİNİDİR — Erdeniz & Mehmet ROS loglama
-- şemasını netleştirdiğinde bu tanımların yerini alacaktır.
-- ═══════════════════════════════════════════════════════════════

-- Algoritma durum makinesi (mod geçmişi)
CREATE TABLE IF NOT EXISTS algorithm_state (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp             REAL,       -- epoch, mod bu anda başladı
    mode                  TEXT,       -- 'ARAMA' | 'TAKIP' | 'KILITLENME' | 'KAMIKAZE' | 'KACINMA' | ...
    hedef_takim_numarasi  INTEGER,    -- NULL olabilir (örn. ARAMA modunda hedef yok)
    guidance_type         TEXT        -- örn. '3D_PN', NULL
);

-- rk4_predictions zaten mevcut (bkz. önceki konuşma), playback amacıyla
-- yalnızca timestamp aralığına göre sorgulanacak. Ek bir değişiklik gerekmiyor.
```

**Neden ayrı tablolar:** Kilitlenme, kamikaze ve HSS olayları telemetriden farklı frekansta ve farklı şemada gelir. Tek bir tabloya sıkıştırmak (`event_type` + JSON blob gibi) sorgu performansını ve indeksleme kolaylığını düşürür. Zaman bazlı JOIN yerine, playback sırasında her tablo kendi zaman aralığında ayrı ayrı sorgulanıp overlay olarak çizilir.

**HSS'in event-tabanlı olmasının pratik sonucu:** Playback arayüzü, o anki `curT` için "hangi HSS'ler `opened_ts ≤ curT AND (closed_ts IS NULL OR closed_ts ≥ curT)` koşulunu sağlıyor" diye sorar ve yalnızca onları haritada çizer. Yani HSS dairesi sürekli orada durmuyor — açılış anında beliriyor, kapanış anında kayboluyor. Prototip bunu birebir bu mantıkla uyguluyor.

---

## 4. Sistem Mimarisi

```
┌─────────────────┐      ┌──────────────────┐      ┌───────────────────┐
│  Yarışma Sunucusu │ ---> │  Logger / Adapter │ ---> │  SQLite (.db)      │
│  (veya SITL/sim)  │      │  (mevcut sistem)  │      │  own_telemetry     │
└─────────────────┘      └──────────────────┘      │  incoming_telemetry│
                                                      │  kilitlenme_events │
                                                      │  kamikaze_events   │
                                                      │  hss_bolgeleri     │
                                                      └─────────┬──────────┘
                                                                │
                                                       ┌────────▼─────────┐
                                                       │  Playback API     │
                                                       │  (FastAPI/Flask)  │
                                                       │  GET /flight/     │
                                                       │  {session}/range  │
                                                       └────────┬─────────┘
                                                                │  JSON
                                                       ┌────────▼─────────┐
                                                       │  Web Arayüzü      │
                                                       │  Harita + Slider  │
                                                       │  + Event Overlay  │
                                                       └────────────────────┘
```

- **Logger/Adapter:** Zaten mevcut olan kayıt sistemi (Erdeniz'in bahsettiği "logger gibi" yapı). Bu değişmez, sadece yukarıdaki yeni tablolara da yazacak şekilde genişletilir.
- **Playback API:** Yeni eklenecek ince bir okuma katmanı. Tek görevi zaman aralığı verilince ilgili tüm tabloları JSON olarak döndürmek.
- **Web Arayüzü:** Statik dosya (tek HTML+JS), backend'e sadece `fetch` ile bağlanır. Sunucu tarafında ağır iş yok — tüm interpolasyon ve çizim istemci tarafında.

---

## 5. Playback API Tasarımı

Tek endpoint yeterli, karmaşıklığı azaltır:

```
GET /flight/{session_id}/range?start={epoch}&end={epoch}
```

**Cevap:**

```json
{
  "own_track": [ { "t": 1721. , "lat":..., "lon":..., "irtifa":..., "yonelme":..., "hedef_x":..., ... } ],
  "rival_tracks": {
    "2": [ { "t":..., "lat":..., "lon":..., "irtifa":..., "yonelme":... } ],
    "3": [ ... ]
  },
  "kilitlenmeler": [ { "t":..., "otonom": 1 } ],
  "kamikazeler": [ { "start":..., "end":..., "qr":"teknofest2025" } ],
  "hss": [ { "id":0, "lat":..., "lon":..., "yaricap":50, "aktif_from":... } ]
}
```

Bunu şu an mock JSON olarak servis edeceğiz (bkz. §7); backend hazır olduğunda tek yapılacak iş bu endpoint'i gerçek SQLite sorgusuna bağlamak — arayüz tarafında hiçbir değişiklik gerekmez.

---

## 6. Arayüz Tasarımı

### 6.1 Harita katmanı — çift mod

Yarışma alanında internet garantisi yok. Bu yüzden **iki modlu harita** kullanılır:

1. **Çevrimiçi mod:** Leaflet.js + uydu görüntüsü (Esri World Imagery) veya OSM sokak katmanı. Gerçek coğrafi bağlam, HSS bölgelerinin gerçek arazi üzerinde nerede olduğunu görmek için kritik (bkz. Şekil 3, pist/bina/tarla üzerine bindirilmiş HSS daireleri).
2. **Çevrimdışı mod:** İnternet yoksa otomatik fallback — canvas tabanlı düz bir koordinat grid'i (enlem/boylam eksenleri, ölçek çubuğu, kuzey oku). Görsel "gerçek harita" değildir ama **birebir orantılı ve doğru** konumlandırma sağlar; iğneler, trail, HSS çemberleri aynı hassasiyetle çizilir.

Geçiş otomatik: sayfa yüklenirken tile sunucusuna bir istek atılır, 2 saniye içinde cevap gelmezse offline moda düşülür ve kullanıcıya küçük bir bildirim gösterilir ("Uydu görüntüsü yüklenemedi — çevrimdışı harita kullanılıyor").

### 6.2 Uçak temsili

- Her takım numarası **sabit bir renk** alır (takım 1: turkuaz, takım 2: turuncu, takım 3: mor gibi) — tüm playback boyunca tutarlı.
- Uçak ikonu, `iha_yonelme` açısına göre **döner** (gerçek yönü gösterir), sadece nokta değil.
- Kilitlenme anında hedef alınan uçağın etrafında kısa süreli kırmızı halka animasyonu.
- Kamikaze aktifken ilgili uçağın rengi yanıp söner ve QR hedef noktasına çizgi çekilir.

### 6.3 Trail (iz)

- Son N saniyenin izi harita üzerinde soluklaşan bir çizgi olarak çizilir (kuyruğa doğru opaklık azalır) — anlık yön ve manevra geçmişi bir bakışta görülür.
- Trail uzunluğu ayarlanabilir (5sn / 15sn / 30sn / tüm oturum).

### 6.4 Zaman çubuğu (scrubber) ve mod şeridi

- Alt kısımda tam genişlikte slider + oynat/durdur + hız kontrolü (0.25x – 4x).
- Slider üzerinde kilitlenme ve kamikaze olayları **işaretçi (marker)** olarak görünür — kullanıcı doğrudan o ana tıklayıp atlayabilir.
- Klavye kısayolları: boşluk (oynat/durdur), sağ/sol ok (kare kare ileri/geri), J/K/L (geri sar/duraklat/ileri sar — video editör alışkanlığı).
- **Mod şeridi:** Scrubber'ın hemen üstünde, video editördeki katman şeridine benzer renkli bir bant. Her renk bir algoritma modunu temsil eder (ARAMA=gri, TAKİP=mavi, KİLİTLENME=kırmızı, KAMİKAZE=turuncu, KAÇINMA=sarı). Bir segmente tıklamak o modun başladığı ana atlar. Bu, "algoritma o an ne düşünüyordu" sorusuna tek bakışta cevap verir — kilitlenme anındaki bir manevranın aslında `KAÇINMA` modundan mı yoksa `TAKİP`ten mi geldiğini ayırt etmeyi sağlar.
- Haritanın üstünde ortalı bir **anlık mod rozeti** de bulunur (oynatma sırasında sürekli günceli gösterir), böylece kullanıcı gözünü şeritle harita arasında gezdirmek zorunda kalmaz.

### 6.4.1 RK4 tahmini — "hayalet iz"

- Rakip uçaklar için, mevcut `rk4_predictions` tablosundaki tahmini konum, gerçek konumun **hemen yanında kesikli/soluk bir ikon** olarak çizilir (kesik çizgili üçgen, mavi renk).
- Bu iki iz arasındaki mesafe (metre cinsinden) yan panelde **"RK4 tahmin hatası"** olarak canlı gösterilir — algoritmanın tahmin kalitesini zaman içinde izlemeyi sağlar, özellikle rakip ani manevra yaptığında hata büyümesi net görülür.
- Hayalet iz, sağ alttaki bir düğmeyle açılıp kapatılabilir (kalabalık bir ekranda gerektiğinde sadeleştirme için).

### 6.5 Akıcılık (FPS)

- Telemetri 1 Hz geldiği için ham veri noktaları arasında **linear interpolation** yapılır; render döngüsü `requestAnimationFrame` ile 60 FPS'te çalışır, veri noktaları arası ara karelerde uçak konumu/açısı yumuşatılır.
- Harita re-render'ı yerine yalnızca uçak ikonlarının transform'u güncellenir (tüm harita yeniden çizilmez) — bu, büyük trail geçmişlerinde bile takılmayı önler.
- Sekme arka planda değilken (`visibilitychange`) animasyon durur, pil/CPU tasarrufu sağlar.

### 6.6 Bilgi paneli

Seçili anda:
- Aktif uçağın tüm telemetri değerleri (irtifa, hız, yatış, dikilme, batarya, otonom durumu)
- HSS bölgelerine mesafe (yarıçap ihlali varsa kırmızı uyarı)
- O anki kilitlenme/kamikaze durumu

---

## 7. Prototip

Bu dokümanla birlikte, yukarıdaki tasarımı somutlaştıran **çalışan bir prototip** teslim edilmiştir. Dosya yapısı (bakımı kolaylaştırmak için HTML/CSS/JS ayrılmıştır):

```
index.html       — sayfa iskeleti, Leaflet + kendi CSS/JS dosyalarını yükler
style.css        — tüm görsel tasarım (koyu tema, mod renkleri, layout)
mockdata.js      — mock veri üreteci + Erdeniz'in netleştirmelerini yansıtan yorumlar
app.js           — harita, interpolasyon, scrubber, mod şeridi, RK4 hayalet iz mantığı
backend/main.py  — FastAPI Playback API iskeleti (gerçek SQLite'a bağlanmaya hazır)
```

İçeriği:

- Mock veri: 3 uçak, ~90 saniyelik uçuş, 2 kilitlenme olayı, 1 kamikaze görevi, 4 HSS bölgesi (açılış/kapanış zamanlarıyla, event-tabanlı), tahmini bir mod zaman çizelgesi (`ARAMA → TAKİP → KİLİTLENME → ARAMA → KAÇINMA → TAKİP → KİLİTLENME → KAMİKAZE → ARAMA`) ve rakipler için RK4 tahmini konum serisi.
- Çevrimiçi harita çalışmazsa (2.5 sn timeout) otomatik offline grid moduna düşer — hem Leaflet hem canvas render yolu HSS event-tabanlı görünürlüğü ve hayalet izi aynı mantıkla uygular.
- Tüm etkileşimler (scrubber, hız, trail uzunluğu, mod şeridi tıklama, olay atlama, hayalet iz aç/kapa) çalışır durumdadır.

**Gerçek veriye bağlamak için gereken tek değişiklik:** `app.js`'in en üstündeki `const DATA = generateMockData();` satırını, §5'teki `/flight/{session_id}/range` endpoint'ine yapılan bir `fetch` çağrısıyla değiştirmek. Veri şekli (`tracks`, `rk4`, `kilitlenmeler`, `kamikazeler`, `hssEvents`) backend ile birebir aynı tutulduğu için başka hiçbir satır değişmeyecek.

`backend/main.py` şu an `own_telemetry`, `incoming_telemetry`, `kilitlenme_events`, `kamikaze_events`, `hss_events` tablolarını sorguluyor; `algorithm_state` ve `rk4_predictions` sorguları şema netleşene kadar yorum satırı olarak bırakıldı.

---

## 8. Teknoloji Seçimleri ve Gerekçeleri

| Katman | Seçim | Gerekçe |
|---|---|---|
| Harita | Leaflet.js + Esri/OSM tile, offline canvas fallback | Hafif, MIT lisanslı, offline moda geçiş kolay |
| Backend | Python FastAPI (mevcut stack'e uyumlu) | Ekip zaten Python/sqlite3 kullanıyor, ek öğrenme maliyeti yok |
| Frontend | Vanilla JS (framework yok) | Kavuralım panelindeki mimariyle tutarlı, bağımlılık az |
| Render döngüsü | `requestAnimationFrame` + linear interpolation | 1 Hz veriden 60 FPS akıcı animasyon |

---

## 9. Yol Haritası

1. **Faz 1 (bu doküman + prototip):** Mock veriyle arayüz + offline/online harita + scrubber + mod şeridi + RK4 hayalet iz — **tamamlandı**
2. **Faz 2 (Erdeniz + Mehmet, ROS tarafı):** `algorithm_state` ve `rk4_predictions` loglama şemasının netleştirilmesi ve tablo açıklamalarının yazılması (yarına kadar)
3. **Faz 3:** SQLite şemasının (§3) uygulanması, logger'ın `own_telemetry`, `hss_events`, `kilitlenme_events`, `kamikaze_events`, `algorithm_state` tablolarına yazması
4. **Faz 4:** `backend/main.py`'deki Playback API'nin gerçek `.db` dosyasına bağlanması, `algorithm_state`/`rk4_predictions` sorgularının aktif edilmesi
5. **Faz 5:** Kamera görüntüsü senkronu (video başlangıç epoch'u kaydedilip `video.currentTime` senkronize edilecek — ayrı görev)
6. **Faz 6:** Yarışma sonrası oturum karşılaştırma (iki farklı seansın üst üste bindirilmesi, algoritma versiyonları arası karşılaştırma)

---

## 10. Erdeniz'e Sorulan Sorular — Cevaplar (06.08.2026)

| Soru | Cevap |
|---|---|
| `iha_kilitlenme` alanı ile `kilitlenme_bilgisi` postu aynı anı mı ifade ediyor? | Hayır. `iha_kilitlenme` **kilitlenmeye çalıştığımız anı** ifade eder, sonucu değil. İki sinyal **bağımsız** tutulacak — biri diğerinin türevi olarak hesaplanmayacak. (§2.3'e işlendi) |
| HSS koordinatları ne sıklıkla çekilip nasıl loglanacak? | Hakemden **bir kez** çekilip ROS'ta `nfz_areas` topiğine publish ediliyor. Logger açılışta bir, kapanışta bir kayıt atıyor — sürekli polling değil, **event tabanlı**. (§3'teki `hss_events` şeması buna göre tasarlandı) |
| Bu doküman GitHub repo'sunun `docs/` klasörüne konabilir mi? | Evet, uygun görüldü. |

## 11. Açık Kalan Nokta

- `algorithm_state` ve `rk4_predictions` tablolarının **kesin** sütun adları ve olası ek alanlar (örn. hedef seçim gerekçesi, guidance parametreleri) Erdeniz & Mehmet'in ROS loglama incelemesi sonrası netleşecek. Bu doküman ve prototip, o şema gelene kadar makul bir varsayımla ilerliyor; şema geldiğinde §3 ve `backend/main.py` güncellenecek, frontend'de değişiklik gerekmeyecek.