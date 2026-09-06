-- ============================================================
-- Çalışma Takvimi
--
-- Yıl içinde hangi gün atölye çalışması var, hangi gün yok; tatiller,
-- yarışma tarihleri, teslim günleri. Uçuşlar AYRI bir tabloda (flights)
-- duruyor ve takvimde salt okunur işaret olarak gösteriliyor — burada
-- tekrar tutulmuyor, tek kaynak flights tablosu.
--
-- Gün başına tek kayıt: takvimde bir kutu bir durumu anlatır.
-- Aynı güne hem "çalışma var" hem "tatil" yazılamaz.
--
-- Supabase → SQL Editor'a yapıştırıp çalıştırın.
-- Tekrar çalıştırmak güvenlidir.
-- ============================================================

create table if not exists public.calendar_days (
  day         date        primary key,
  -- calisma  : atölye/çalışma günü
  -- tatil    : çalışma yok
  -- etkinlik : toplantı, eğitim, tanıtım
  -- yarisma  : yarışma veya teslim tarihi
  kind        text        not null default 'calisma'
              check (kind in ('calisma', 'tatil', 'etkinlik', 'yarisma')),
  title       text,
  note        text,
  updated_by  uuid        references auth.users (id) on delete set null,
  updated_at  timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  team_id     uuid                       -- çok takımlı yapıya hazırlık
);

create index if not exists calendar_days_kind_idx on public.calendar_days (kind);

-- Değişiklik damgası
create or replace function public.calendar_days_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists calendar_days_touch_trg on public.calendar_days;
create trigger calendar_days_touch_trg
  before update on public.calendar_days
  for each row execute function public.calendar_days_touch();

-- ============================================================
-- RLS — tüm takım görür, takvimi kaptan ve yardımcısı düzenler
--
-- Takvim takım geneli bir bildirim ("bu hafta çalışma yok") olduğu için
-- düzenleme yetkisi bilerek dar tutuldu. Birim kaptanlarına da açılması
-- istenirse aşağıdaki iki politikaya `or is_unit_captain(...)` eklenir.
-- ============================================================
alter table public.calendar_days enable row level security;

drop policy if exists calendar_days_read on public.calendar_days;
create policy calendar_days_read
  on public.calendar_days for select
  to authenticated
  using (true);

drop policy if exists calendar_days_write on public.calendar_days;
create policy calendar_days_write
  on public.calendar_days for all
  to authenticated
  using (is_admin())
  with check (is_admin());

-- ------------------------------------------------------------
-- Realtime: biri günü değiştirince herkeste anında görünsün
-- ------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'calendar_days'
  ) then
    alter publication supabase_realtime add table public.calendar_days;
  end if;
end $$;

-- ------------------------------------------------------------
-- KONTROL
--   select day, kind, title from public.calendar_days order by day;
-- ------------------------------------------------------------
