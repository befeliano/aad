-- ============================================================
-- Mülakat — Google Form entegrasyonu + ortak not defteri
--
-- mulakat.sql'den SONRA çalıştırın.
-- Supabase → SQL Editor'a yapıştırıp çalıştırın.
-- Tekrar çalıştırmak güvenlidir.
--
-- 1) FORMDAN GELEN ADAYLAR
--    Başvuru formu doldurulunca Google Apps Script (scripts/
--    google-form-mulakat.gs) /api/mulakat/form'a POST eder; o da buraya
--    satır açar.
--      source           'form' | 'manuel'
--      form_response_id Google'ın yanıt kimliği — tekil: aynı başvuru
--                       ikinci kez gelirse yok sayılır, notlar ezilmez
--      form_data        formdaki TÜM soru-cevaplar, formdaki sırayla:
--                       [{"soru":"...","cevap":"..."}]
--      submitted_at     formun gönderildiği an
--    Form verisi SABİTTİR: panelden kimse değiştiremez (tetikleyici
--    eski değeri geri koyar). Yalnızca servis anahtarı (webhook) yazar.
--
-- 2) YETKİ GENİŞLEDİ
--    Panele giren herkes her adayı görür, aday ekler, notu düzenler.
--    mulakat.sql'deki "kaptan + birim kaptanı" kuralının yerini alır.
--    Silme DEĞİŞMEDİ: kaptan, yardımcısı ve adayın birim kaptanı.
--    Rol kısıtı geri gelecekse aşağıdaki üç politikayı mulakat.sql'deki
--    hâline döndürmek yeter.
--
-- 3) ORTAK NOT — iki kişi aynı anda yazarsa
--    notes_version not her değiştiğinde artar. Panel kaydederken
--    "okuduğum sürüm hâlâ bu mu" diye bakar; değilse ötekinin metnini
--    ezmek yerine birleştirir ya da kullanıcıya sorar.
--
-- 4) updated_by — son düzenleyen (tetikleyici doldurur)
-- 5) Canlı yayın — yeni başvuru ve not değişikliği anında görünür
-- ============================================================

alter table public.interviews
  add column if not exists source           text        not null default 'manuel',
  add column if not exists form_response_id text,
  add column if not exists form_data        jsonb       not null default '[]'::jsonb,
  add column if not exists submitted_at     timestamptz,
  add column if not exists notes_version    int         not null default 0,
  add column if not exists updated_by       uuid        references auth.users (id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'interviews_source_check'
  ) then
    alter table public.interviews
      add constraint interviews_source_check
      check (source in ('manuel', 'form'));
  end if;
end $$;

-- Kısmi DEĞİL, düz tekil indeks: webhook "on conflict (form_response_id)"
-- kullanıyor ve Postgres kısmi indeksi bu çıkarımda kullanamaz.
-- NULL'lar birbirine eşit sayılmadığı için elle açılan kayıtlar etkilenmez.
create unique index if not exists interviews_form_response_uidx
  on public.interviews (form_response_id);

-- Form her zaman birim sorar ama cevap tanınmazsa satır yine açılmalı;
-- birim sonra aday sayfasından seçilir.
alter table public.interviews alter column dept drop not null;

-- ------------------------------------------------------------
-- Tetikleyici: updated_at, updated_by, notes_version, form verisi koruması
-- ------------------------------------------------------------
create or replace function public.interviews_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();

  if auth.uid() is not null then
    new.updated_by := auth.uid();

    -- Başvuru formu adayın kendi beyanı: panelden değiştirilemez
    new.source           := old.source;
    new.form_response_id := old.form_response_id;
    new.form_data        := old.form_data;
    new.submitted_at     := old.submitted_at;
  end if;

  if new.notes is distinct from old.notes then
    new.notes_version := old.notes_version + 1;
  else
    new.notes_version := old.notes_version;
  end if;

  if new.status in ('yapildi','kabul','red')
     and new.interviewed_at is null then
    new.interviewed_at := now();
  end if;
  return new;
end $$;

drop trigger if exists interviews_touch_trg on public.interviews;
create trigger interviews_touch_trg
  before update on public.interviews
  for each row execute function public.interviews_touch();

-- ============================================================
-- RLS — panele giren herkes görür, ekler, düzenler
-- (silme politikası mulakat.sql'deki gibi kalır)
-- ============================================================
drop policy if exists interviews_select on public.interviews;
create policy interviews_select
  on public.interviews for select
  to authenticated
  using (true);

drop policy if exists interviews_insert on public.interviews;
create policy interviews_insert
  on public.interviews for insert
  to authenticated
  with check (true);

drop policy if exists interviews_update on public.interviews;
create policy interviews_update
  on public.interviews for update
  to authenticated
  using (true)
  with check (true);

-- ------------------------------------------------------------
-- Canlı yayın (realtime)
-- ------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'interviews'
  ) then
    alter publication supabase_realtime add table public.interviews;
  end if;
end $$;

-- ------------------------------------------------------------
-- KONTROL
--   select source, count(*) from public.interviews group by 1;
--   -- Formdan son gelenler:
--   select first_name, last_name, dept, submitted_at
--     from public.interviews where source = 'form'
--    order by submitted_at desc limit 10;
-- ------------------------------------------------------------
