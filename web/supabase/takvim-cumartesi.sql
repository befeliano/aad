-- ============================================================
-- Çalışma Takvimi — Cumartesi çalışmaları
--
-- İHTİYAÇ: "Çalışma takvimi cumartesi günleri işaretlenecek."
--   Takımın düzeni: sezon boyunca her CUMARTESİ 10:00–17:00,
--   yarışma döneminde cumartesi + pazar (başvuru formundaki düzen).
--
-- takvim-kurallari.sql başlangıçta sezonu PAZAR olarak kurmuştu.
-- Bu betik o kuralı cumartesiye çevirir; kural hiç yoksa ekler.
-- Yarışma dönemi kuralı (cmt + paz, nisandan itibaren) aynen kalır.
--
-- ÖN KOŞUL: takvim-kurallari.sql çalıştırılmış olmalı.
-- Supabase → SQL Editor'a yapıştırıp çalıştırın.
-- Tekrar çalıştırmak güvenlidir.
-- ============================================================

-- Başlangıç kuralı pazar olarak duruyorsa cumartesiye çevir
update public.calendar_rules
   set weekdays = array[6]::smallint[]
 where title = 'Atölye çalışması'
   and weekdays = array[7]::smallint[];

-- Hiç yoksa ekle
insert into public.calendar_rules
  (weekdays, kind, starts_at, ends_at, valid_from, valid_to, title)
select array[6]::smallint[], 'calisma', '10:00', '17:00',
       date '2026-10-03', date '2027-03-31', 'Atölye çalışması'
where not exists (
  select 1 from public.calendar_rules where title = 'Atölye çalışması'
);

-- ------------------------------------------------------------
-- KONTROL
--   select weekdays, starts_at, ends_at, valid_from, valid_to, title
--     from public.calendar_rules order by valid_from;
--   -- Beklenen: Atölye çalışması {6}, Yarışma dönemi çalışması {6,7}
-- ------------------------------------------------------------
