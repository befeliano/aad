-- ============================================================
-- AAD Uçuş Öncesi Kontrol Listesi — GERÇEK FORM
-- Kaynak: web/Preflight_Checklist_v2.pdf (AAD-OPS-PCF-001 | Rev. A | Nisan 2025)
--
-- Supabase → SQL Editor'a yapıştırıp çalıştırın.
-- Tekrar çalıştırmak güvenlidir.
--
-- DİKKAT: Aşağıdaki DELETE mevcut TÜM şablon maddelerini siler ve
-- PDF'teki 53 maddeyi yükler. Kaptanın elle eklediği maddeler varsa
-- önce onları not alın. Doldurulmuş uçuş checklist'leri (flight_checklists)
-- ETKİLENMEZ — onlar kaydedildikleri anki hâllerini saklar.
-- ============================================================

-- 1) Bölüm bilgisi için yeni kolon (varsa dokunmaz)
alter table public.checklist_items
  add column if not exists section text;

begin;

delete from public.checklist_items;

insert into public.checklist_items (section, label, hint, position, required) values
  ('1. Meteoroloji ve Saha Güvenliği', 'Rüzgar hızı ölçümü', '≤ 10 m/s sürekli, ani gust ≤ 14 m/s', 10, true),
  ('1. Meteoroloji ve Saha Güvenliği', 'Rüzgar yönü değerlendirmesi', 'Pist aksına ≤ 45° sapma', 20, true),
  ('1. Meteoroloji ve Saha Güvenliği', 'Görüş mesafesi (VFR)', '≥ 1500 m yatay görüş', 30, true),
  ('1. Meteoroloji ve Saha Güvenliği', 'Yağış / yıldırım kontrolü', 'Aktif yağış veya fırtına yok', 40, true),
  ('1. Meteoroloji ve Saha Güvenliği', 'Sıcaklık aralığı', '0 °C – 45 °C arası', 50, true),
  ('1. Meteoroloji ve Saha Güvenliği', 'Uçuş alanı engel taraması', '30 m yarıçapta kişi / bina yok', 60, true),
  ('1. Meteoroloji ve Saha Güvenliği', 'İzin / NOTAM kontrolü', 'Yetkili onay alındı', 70, true),
  ('1. Meteoroloji ve Saha Güvenliği', 'Acil müdahale noktası tespiti', 'Toplanma noktası belirlendi', 80, true),
  ('2. Yapısal Kontrol', 'Gövde bütünlüğü', 'Kırık, çatlak, deformasyon yok', 90, true),
  ('2. Yapısal Kontrol', 'Kanat-gövde birleşim noktası', 'Spar kilitleri tam oturmuş, oynak yok', 100, true),
  ('2. Yapısal Kontrol', 'Sağ kanat yüzey bütünlüğü', 'Kaplama / kompozit hasarı yok', 110, true),
  ('2. Yapısal Kontrol', 'Sol kanat yüzey bütünlüğü', 'Kaplama / kompozit hasarı yok', 120, true),
  ('2. Yapısal Kontrol', 'Kuyruk takımı bağlantısı', 'Kuyruk sağlam', 130, true),
  ('2. Yapısal Kontrol', 'Kontrol yüzeyleri (ruddervator)', 'Serbestçe hareket eder, boşluk yok', 140, true),
  ('2. Yapısal Kontrol', 'Aileron hareket kontrolü', 'Serbestçe hareket eder, boşluk yok', 150, true),
  ('2. Yapısal Kontrol', 'Pushrod / trim kontrolü', 'Çift merkez, eğilme yok', 160, true),
  ('2. Yapısal Kontrol', 'Motor yuvası bağlantısı', '4 cıvata tam sıkılı', 170, true),
  ('2. Yapısal Kontrol', 'Pervane hasarsızlık kontrolü', 'Çatlak, kırık, asimetri yok', 180, true),
  ('2. Yapısal Kontrol', 'Pervane somunu sıkılığı', 'Uygun tork ile sıkılmış, somunu takılı', 190, true),
  ('2. Yapısal Kontrol', 'Gövde kapakları / erişim paneli', 'Kapaklar tam kapalı', 200, true),
  ('2. Yapısal Kontrol', 'Ağırlık merkezi (CG) kontrolü', 'Tasarım CG ± 5 mm tolerans', 210, true),
  ('2. Yapısal Kontrol', 'İniş takımı sağlamlığı', 'Tekerlekler düz / bağlantı tam oturmuş', 220, true),
  ('3. Elektronik Kontrol', 'Batarya şarj durumu', '≥ %80 (≥ 22.4 V 6S)', 230, true),
  ('3. Elektronik Kontrol', 'Batarya fiziksel durumu', 'Şişme, hasar yok', 240, true),
  ('3. Elektronik Kontrol', 'Batarya sabitleme', 'Dolgu malzemesi ile hareketsiz', 250, true),
  ('3. Elektronik Kontrol', 'Akım devre kesici kontrolü', 'Kesici açık konumda, erişim kolay', 260, true),
  ('3. Elektronik Kontrol', 'XT-60 / XT-90 konnektörü', 'Tam oturmuş, hasar izi yok', 270, true),
  ('3. Elektronik Kontrol', 'ESC bağlantı noktaları', 'Motor kabloları sıkı, açık yok', 280, true),
  ('3. Elektronik Kontrol', 'FCU montaj ve yönü', 'Doğru yönde, titreşim sönümlenmiş', 290, true),
  ('3. Elektronik Kontrol', 'FCU önyükleme (boot) kontrolü', 'Hata LED''i yok, ses tonu normal', 300, true),
  ('3. Elektronik Kontrol', 'GPS kilitleme (fix)', '≥ 8 uydu, HDOP ≤ 1.5', 310, true),
  ('3. Elektronik Kontrol', 'GPS montaj doğruluğu', 'Üzerinde karbon / metal engel yok', 320, true),
  ('3. Elektronik Kontrol', 'Telemetri bağlantısı', 'Yer istasyonu – İHA link aktif', 330, true),
  ('3. Elektronik Kontrol', 'Telemetri sinyal gücü (RSSI)', '≥ -90 dBm', 340, true),
  ('3. Elektronik Kontrol', 'RC alıcı bağlantısı', 'Tüm kanallar aktif, failsafe set', 350, true),
  ('3. Elektronik Kontrol', 'RC kumanda şarj durumu', '≥ %50', 360, true),
  ('3. Elektronik Kontrol', 'Servo hareket yönleri', 'FCU çıkışına senkron (ters yok)', 370, true),
  ('3. Elektronik Kontrol', 'Servo trim / nötr pozisyon', 'Kontrol yüzeyleri nötrde düz', 380, true),
  ('3. Elektronik Kontrol', 'Pitot tüpü (hava hızı sensörü)', 'Tıkanma yok, bağlantı sağlam', 390, true),
  ('3. Elektronik Kontrol', 'Lidar montaj ve LED', 'Yeşil LED aktif, lens temiz', 400, true),
  ('3. Elektronik Kontrol', 'Voltaj regülatörü (varsa)', '5V / 12V hat nominal', 410, false),
  ('3. Elektronik Kontrol', 'Kamera beslemesi ve görüntü', 'Yer istasyonunda canlı görüntü var', 420, true),
  ('3. Elektronik Kontrol', 'Görev bilgisayarı önyükleme', 'ROS / uygulama başlatıldı (varsa)', 430, false),
  ('3. Elektronik Kontrol', 'Tüm kablo geçişleri', 'Bükülme, sıkışma, açık tel yok', 440, true),
  ('4. Görev Konfigürasyonu', 'Görev tipi seçimi', 'Otonom kilitleme / Kamikaze / Kalibrasyon', 450, true),
  ('4. Görev Konfigürasyonu', 'Waypoint yükleme', 'GCS''te yüklendi ve doğrulandı', 460, true),
  ('4. Görev Konfigürasyonu', 'Fence area tanımlandı', 'Uçuş sınırları GCS''te set edildi', 470, true),
  ('4. Görev Konfigürasyonu', 'Failsafe parametreleri', 'RTL / Land failsafe aktif', 480, true),
  ('4. Görev Konfigürasyonu', 'TECS parametreleri', 'Normal görev: SINK_MAX nominal', 490, true),
  ('4. Görev Konfigürasyonu', 'Home pozisyonu set edildi', 'Kalkış noktası GCS''te kilitlendi', 500, true),
  ('4. Görev Konfigürasyonu', 'Arming kontrolü', 'Pre-arm check geçildi, arm onaylandı', 510, true),
  ('4. Görev Konfigürasyonu', 'Pilot – operatör haberdar', 'Tüm ekip hazır, rol atamaları tamam', 520, true),
  ('4. Görev Konfigürasyonu', 'Sunucu bağlantısı (varsa)', null, 530, false);

commit;

-- Kontrol:
-- select section, count(*) from public.checklist_items group by section order by section;
--   1. Meteoroloji ve Saha Güvenliği |  8
--   2. Yapısal Kontrol               | 14
--   3. Elektronik Kontrol            | 22
--   4. Görev Konfigürasyonu          |  9
