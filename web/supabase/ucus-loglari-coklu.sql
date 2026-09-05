-- ============================================================
-- Uçuşa birden fazla kayıt dosyası ekleme (.db, .tlog, .bin, .log)
--
-- MEVCUT DURUM:
--   flight_checklists.log_path  -> tek bir metin alanı, tek dosya.
--
-- İSTENEN:
--   Bir uçuşa aynı anda birkaç dosya: ArduPilot .bin, MAVLink .tlog,
--   kendi .db kaydımız. Türüne göre filtrelenebilsin.
--
-- YAKLAŞIM:
--   Yeni tablo açmak yerine jsonb bir dizi kolonu ekliyoruz. Uçuş başına
--   dosya sayısı az (bir avuç) olduğu için ayrı tabloya değmiyor.
--
--   logs = [
--     { "path": "...", "name": "flight_20260806.bin",
--       "ext": "bin", "size": 12345, "at": "2026-09-05T12:00:00Z" }
--   ]
--
--   log_path KORUNUYOR: uçuş analizi ekranı hâlâ onu okuyor ve
--   "birincil .db" anlamına geliyor. Yeni yüklemelerde ilk .db dosyası
--   otomatik oraya da yazılır, eski kayıtlar bozulmaz.
--
-- Supabase → SQL Editor'a yapıştırıp çalıştırın.
-- Tekrar çalıştırmak güvenlidir.
-- ============================================================

alter table public.flight_checklists
  add column if not exists logs jsonb not null default '[]'::jsonb;

-- Eski tek dosyalı kayıtları yeni diziye taşı (yalnızca boş olanları).
update public.flight_checklists
   set logs = jsonb_build_array(
         jsonb_build_object(
           'path', log_path,
           'name', split_part(log_path, '/', -1),
           'ext',  lower(split_part(log_path, '.', -1)),
           'size', null,
           'at',   coalesce(completed_at, created_at)
         )
       )
 where log_path is not null
   and (logs is null or jsonb_array_length(logs) = 0);

-- Türe göre filtreleme sorgularını hızlandırır
create index if not exists flight_checklists_logs_idx
  on public.flight_checklists using gin (logs);

-- ------------------------------------------------------------
-- Storage: flight-logs bucket'ı .bin ve .tlog da kabul etsin
-- (boyut sınırı 50 MB'a çekiliyor — uçuş analizi sınırıyla aynı)
-- ------------------------------------------------------------
update storage.buckets
   set file_size_limit = 52428800
 where id = 'flight-logs'
   and (file_size_limit is null or file_size_limit < 52428800);

-- ------------------------------------------------------------
-- KONTROL
--   select flight_id, jsonb_array_length(logs) as dosya, log_path
--   from public.flight_checklists order by created_at desc limit 10;
-- ------------------------------------------------------------
