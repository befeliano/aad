-- ============================================================
-- Takvimde çok günlü işler
--
-- İHTİYAÇ:
--   "Bir iş atadığımda bitişi için aynı gün içinde saat seçmek yerine
--    farklı bir gün seçebilmeliyim — 5-10 günlük bir iş mesela."
--
-- NEDEN AYRI TABLO:
--   calendar_days  -> o günün DURUMU (çalışma var / yok). Gün başına tek.
--   calendar_rules -> tekrar eden durum kuralı.
--   calendar_tasks -> BAŞLANGICI VE BİTİŞİ OLAN İŞ. Takvimde gün
--                     kutularının üstünden geçen şerit olarak çizilir.
--
--   Üçü farklı şeyler; aynı tabloya sıkıştırmak ikisini de bozardı.
--
-- Panel Görevler modülünden de ayrı: orası kanban, tarih aralığı yok.
--
-- ÖN KOŞUL: rol-hiyerarsisi.sql ve yetki-duzeltmeleri.sql
--           (is_admin() ve is_captain() kullanılıyor)
--
-- Supabase → SQL Editor'a yapıştırıp çalıştırın.
-- Tekrar çalıştırmak güvenlidir.
-- ============================================================

set lock_timeout = '5s';

create table if not exists public.calendar_tasks (
  id         uuid primary key default gen_random_uuid(),
  title      text        not null,
  note       text,
  -- Hangi birimin işi (yazilim, kompozit... ya da 'ortak')
  dept       text        not null default 'ortak',
  starts_on  date        not null,
  ends_on    date        not null,
  status     text        not null default 'planli'
             check (status in ('planli', 'devam', 'bitti')),
  color      text,                      -- ileride şerit rengi için
  created_by uuid,                      -- FK YOK: auth.users kilidi için
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  team_id    uuid,

  constraint calendar_tasks_tarih_kontrol check (ends_on >= starts_on)
);

-- Aya düşen işleri çekerken kullanılıyor
create index if not exists calendar_tasks_aralik_idx
  on public.calendar_tasks (starts_on, ends_on);
create index if not exists calendar_tasks_dept_idx
  on public.calendar_tasks (dept);

create or replace function public.calendar_tasks_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists calendar_tasks_touch_trg on public.calendar_tasks;
create trigger calendar_tasks_touch_trg
  before update on public.calendar_tasks
  for each row execute function public.calendar_tasks_touch();

-- ============================================================
-- RLS — takvimle aynı kural: herkes görür, kaptan/yardımcı/birim
-- kaptanı düzenler
-- ============================================================
alter table public.calendar_tasks enable row level security;

drop policy if exists calendar_tasks_read on public.calendar_tasks;
create policy calendar_tasks_read
  on public.calendar_tasks for select to authenticated using (true);

drop policy if exists calendar_tasks_write on public.calendar_tasks;
create policy calendar_tasks_write
  on public.calendar_tasks for all to authenticated
  using      (is_admin() or is_captain())
  with check (is_admin() or is_captain());

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'calendar_tasks'
  ) then
    alter publication supabase_realtime add table public.calendar_tasks;
  end if;
end $$;

-- ------------------------------------------------------------
-- KONTROL
--   select title, dept, starts_on, ends_on, status
--     from public.calendar_tasks order by starts_on;
-- ------------------------------------------------------------
