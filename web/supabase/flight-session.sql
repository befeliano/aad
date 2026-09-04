-- ============================================================
-- Uçuş oturumu: kronometre, tamamlama, log dosyası ve istatistikler
-- ÖNCE supabase/checklist.sql çalıştırılmış olmalı.
-- Supabase → SQL Editor. Tekrar çalıştırmak güvenlidir.
-- ============================================================

-- 1) flight_checklists tablosuna tamamlama alanları
alter table public.flight_checklists
  add column if not exists ended_at     timestamptz,
  add column if not exists log_path     text,
  add column if not exists flight_note  text,
  -- { duration_s, distance_km, max_alt, max_speed, avg_speed, telemetry_rows }
  add column if not exists stats        jsonb;

-- 2) Uçuş kaydı dosyaları için storage bucket (.db / .db-wal)
insert into storage.buckets (id, name, public)
select 'flight-logs', 'flight-logs', false
where not exists (select 1 from storage.buckets where id = 'flight-logs');

-- Bucket politikaları: giriş yapmış üyeler okur/yazar
drop policy if exists flight_logs_read on storage.objects;
create policy flight_logs_read
  on storage.objects for select
  to authenticated
  using (bucket_id = 'flight-logs');

drop policy if exists flight_logs_insert on storage.objects;
create policy flight_logs_insert
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'flight-logs');

drop policy if exists flight_logs_delete on storage.objects;
create policy flight_logs_delete
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'flight-logs');
