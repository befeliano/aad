-- ============================================================
-- Çalışma Takvimi — tekrarlı kurallar + saat aralığı
--
-- SORUN:
--   calendar_days gün başına tek satır tutuyor. "Her pazar, nisandan
--   itibaren cumartesi de eklenerek 10:00–17:00" demek için ekimden
--   ağustosa ~50 günü tek tek işaretlemek gerekiyordu. Kullanılabilir değil.
--
-- ÇÖZÜM — iki katman:
--   calendar_rules : tekrar eden kural. "Her Paz, 10:00–17:00,
--                    2026-10-03 → 2027-03-31". Bir satır.
--   calendar_days  : YALNIZCA sapmalar. "Bu pazar çalışma yok",
--                    "bu cumartesi 09:00 başlıyoruz".
--
--   Takvim ekranı ikisini birleştirir ve GÜN KAYDI KURALI EZER.
--   Böylece nisanda cumartesiyi eklemek 20 tık değil, bir satır.
--
-- calendar_days verisi KORUNUYOR — bu betik yalnızca ekleme yapıyor.
--
-- Supabase → SQL Editor'a yapıştırıp çalıştırın.
-- Tekrar çalıştırmak güvenlidir.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Gün kayıtlarına saat aralığı
-- ------------------------------------------------------------
alter table public.calendar_days
  add column if not exists starts_at time,
  add column if not exists ends_at   time;

-- ------------------------------------------------------------
-- 2) Tekrar eden kurallar
-- ------------------------------------------------------------
create table if not exists public.calendar_rules (
  id         uuid primary key default gen_random_uuid(),
  -- Haftanın günleri, ISO: 1=Pazartesi … 7=Pazar
  weekdays   smallint[]  not null,
  kind       text        not null default 'calisma'
             check (kind in ('calisma', 'tatil', 'etkinlik', 'yarisma')),
  starts_at  time        not null default '10:00',
  ends_at    time        not null default '17:00',
  -- Kuralın geçerli olduğu tarih aralığı (bitiş boşsa süresiz)
  valid_from date        not null,
  valid_to   date,
  title      text,
  note       text,
  active     boolean     not null default true,
  created_by uuid        references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  team_id    uuid,

  constraint calendar_rules_gun_kontrol
    check (array_length(weekdays, 1) between 1 and 7),
  constraint calendar_rules_tarih_kontrol
    check (valid_to is null or valid_to >= valid_from),
  constraint calendar_rules_saat_kontrol
    check (ends_at > starts_at)
);

create index if not exists calendar_rules_aralik_idx
  on public.calendar_rules (valid_from, valid_to) where active;

create or replace function public.calendar_rules_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists calendar_rules_touch_trg on public.calendar_rules;
create trigger calendar_rules_touch_trg
  before update on public.calendar_rules
  for each row execute function public.calendar_rules_touch();

-- ============================================================
-- RLS — calendar_days ile aynı kural
-- ============================================================
alter table public.calendar_rules enable row level security;

drop policy if exists calendar_rules_read on public.calendar_rules;
create policy calendar_rules_read
  on public.calendar_rules for select to authenticated using (true);

drop policy if exists calendar_rules_write on public.calendar_rules;
create policy calendar_rules_write
  on public.calendar_rules for all to authenticated
  using (is_admin()) with check (is_admin());

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'calendar_rules'
  ) then
    alter publication supabase_realtime add table public.calendar_rules;
  end if;
end $$;

-- ============================================================
-- BAŞLANGIÇ KURALLARI — anlattığınız düzen
-- Tarihleri panelden değiştirebilirsiniz.
-- ============================================================

-- Sezon boyunca: her PAZAR 10:00–17:00
-- (ISO gün numarası: 1=Pazartesi … 6=Cumartesi, 7=Pazar)
insert into public.calendar_rules
  (weekdays, kind, starts_at, ends_at, valid_from, valid_to, title)
select array[7]::smallint[], 'calisma', '10:00', '17:00',
       date '2026-10-03', date '2027-03-31', 'Atölye çalışması'
where not exists (
  select 1 from public.calendar_rules where title = 'Atölye çalışması'
);

-- Yarışma dönemi: nisandan itibaren cumartesi DE ekleniyor
insert into public.calendar_rules
  (weekdays, kind, starts_at, ends_at, valid_from, valid_to, title)
select array[6, 7]::smallint[], 'calisma', '10:00', '17:00',
       date '2027-04-01', date '2027-08-10', 'Yarışma dönemi çalışması'
where not exists (
  select 1 from public.calendar_rules where title = 'Yarışma dönemi çalışması'
);

-- ------------------------------------------------------------
-- KONTROL
--   select weekdays, starts_at, ends_at, valid_from, valid_to, title
--     from public.calendar_rules order by valid_from;
-- ------------------------------------------------------------
