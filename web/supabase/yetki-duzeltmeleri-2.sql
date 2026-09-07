-- ============================================================
-- Yetki düzeltmeleri — 2. tur
--
--   1) Uçuş kayıtları: herkes görür, YALNIZCA birim kaptanları ve
--      kaptan/yardımcı oluşturur, düzenler, siler
--   2) Uçuş analizi kayıtları (flight_checklists) aynı kurala bağlanır
--      — şu an düpedüz açık (true/true)
--   3) Medya & Materyaller herkese açılır, ölü 'medya' değeri temizlenir
--   4) Toplantıyı herkes başlatır ve bitirir
--   5) İletişim mesajları Medya & Sponsorluk + kaptan/yardımcı ile sınırlanır
--   6) İKİ HATA: kontrol listesi ve toplantı politikaları kaptan
--      yardımcısını dışarıda bırakıyordu
--
-- ÖN KOŞUL: rol-hiyerarsisi.sql ve yetki-duzeltmeleri.sql çalıştırılmış
-- olmalı (is_admin() ve is_captain() burada kullanılıyor).
--
-- Supabase → SQL Editor'a yapıştırıp çalıştırın.
-- Tekrar çalıştırmak güvenlidir.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Uçuş kayıtları
--
--    flights tablosunda departman kolonu yok — uçuş takım geneli bir
--    olay. Bu yüzden is_unit_captain(dept) değil, birimden bağımsız
--    is_captain() kullanılıyor.
--
--    ÖNCEKİ DURUM: insert/update herkese açıktı; herhangi bir üye
--    başkasının uçuş tarihini, uçağını, pilotunu değiştirebiliyordu.
-- ------------------------------------------------------------
drop policy if exists flights_insert on public.flights;
create policy flights_insert
  on public.flights for insert to authenticated
  with check (is_admin() or is_captain());

drop policy if exists flights_update on public.flights;
create policy flights_update
  on public.flights for update to authenticated
  using      (is_admin() or is_captain())
  with check (is_admin() or is_captain());

drop policy if exists flights_delete on public.flights;
create policy flights_delete
  on public.flights for delete to authenticated
  using (is_admin() or is_captain());

-- Görme herkeste kalıyor
drop policy if exists flights_select on public.flights;
create policy flights_select
  on public.flights for select to authenticated using (true);

-- ------------------------------------------------------------
-- 2) Uçuş öncesi kontrol listesi + log bağlantıları
--
--    ÖNCEKİ DURUM: tek bir "ALL" politikası, qual ve with_check
--    ikisi de `true`. Veritabanındaki en gevşek kural buydu: giriş
--    yapan herkes herhangi bir uçuşun formunu ve log dosyalarını
--    silebiliyordu. Uçuş kaydıyla aynı kurala bağlanıyor.
-- ------------------------------------------------------------
drop policy if exists flight_checklists_write on public.flight_checklists;

create policy flight_checklists_insert
  on public.flight_checklists for insert to authenticated
  with check (is_admin() or is_captain());

create policy flight_checklists_update
  on public.flight_checklists for update to authenticated
  using      (is_admin() or is_captain())
  with check (is_admin() or is_captain());

create policy flight_checklists_delete
  on public.flight_checklists for delete to authenticated
  using (is_admin() or is_captain());

-- Okuma herkeste (analiz sayfası zaten teknik birimlerle sınırlı)
drop policy if exists flight_checklists_read on public.flight_checklists;
create policy flight_checklists_read
  on public.flight_checklists for select to authenticated using (true);

-- ------------------------------------------------------------
-- 3) Medya & Materyaller — herkese açık
--
--    Eski dizideki 'medya' değeri ÖLÜ: departman birleştirmesinden
--    sonra hiçbir üyenin departmanı 'medya' değil, hepsi 'sponsorluk'.
--    Zaten herkese açtığımız için dizi tamamen kalkıyor.
-- ------------------------------------------------------------
drop policy if exists media_select on public.media_assets;
create policy media_select
  on public.media_assets for select to authenticated using (true);

drop policy if exists media_insert on public.media_assets;
create policy media_insert
  on public.media_assets for insert to authenticated with check (true);

drop policy if exists media_update on public.media_assets;
create policy media_update
  on public.media_assets for update to authenticated
  using (true) with check (true);

-- DİKKAT: silme de herkese açık — bir üye başkasının yüklediği
-- dosyayı kaldırabilir. İstenirse tekrar (created_by/is_admin) yapılır.
drop policy if exists media_delete on public.media_assets;
create policy media_delete
  on public.media_assets for delete to authenticated using (true);

-- ------------------------------------------------------------
-- 4) Toplantı — herkes başlatır ve bitirir
--    (Eski politika yalnızca role='admin' tanıyordu; kaptan
--     yardımcısı bile bitiremiyordu.)
-- ------------------------------------------------------------
drop policy if exists meetings_update on public.meetings;
create policy meetings_update
  on public.meetings for update to authenticated
  using (true) with check (true);

-- ------------------------------------------------------------
-- 5) İletişim mesajları — Medya & Sponsorluk + kaptan/yardımcı
--    (has_dept_access zaten is_admin'i içeriyor)
-- ------------------------------------------------------------
drop policy if exists contact_select_authenticated on public.contact_messages;
create policy contact_select_authenticated
  on public.contact_messages for select to authenticated
  using (has_dept_access(array['sponsorluk']));

-- ------------------------------------------------------------
-- 6) HATA: kontrol listesi şablonu kaptan yardımcısına kapalıydı
--
--    Sayfa is_admin() (kaptan + yardımcı) ile açılıyor ama politika
--    yalnızca role='admin' istiyordu. Yardımcı sayfayı görüp madde
--    ekliyor, kaydet deyince sessizce reddediliyordu.
-- ------------------------------------------------------------
drop policy if exists checklist_items_write on public.checklist_items;
create policy checklist_items_write
  on public.checklist_items for all to authenticated
  using (is_admin()) with check (is_admin());

-- ------------------------------------------------------------
-- KONTROL
--   select tablename, policyname, cmd, qual from pg_policies
--    where schemaname='public'
--      and tablename in ('flights','flight_checklists','media_assets',
--                        'meetings','contact_messages','checklist_items')
--    order by tablename, cmd;
--
-- TEST
--   Düz üyeyle uçuş planla        -> REDDEDİLMELİ
--   Birim kaptanıyla uçuş planla  -> GEÇMELİ
--   Düz üyeyle materyal yükle     -> GEÇMELİ
--   Medya üyesiyle /panel/ucuslar/analiz -> AÇILMAMALI
--   Kaptan yardımcısıyla kontrol listesi maddesi ekle -> GEÇMELİ
-- ------------------------------------------------------------
