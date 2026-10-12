-- ============================================================
-- Yoklama
--
-- İHTİYAÇ: "Çalışma takvimine yoklama sistemi. Birim kaptanı kendi
-- biriminin yoklamasını alacak. 3 seçenek: geldi, gelmedi, geç geldi.
-- Ekstra bir şey olmayacak. Birim kaptanı yoklama almazsa, alana kadar
-- her gün mail atılacak."
--
-- Satır = bir üyenin bir günkü durumu. (gün, üye) tekil.
-- dept satıra yazılıyor: üye sonradan birim değiştirse bile o günkü
-- yoklamayı hangi kaptanın aldığı belli kalsın.
--
-- Hatırlatma e-postası: api/cron/yoklama-hatirlatma (Vercel Cron, her
-- akşam). Çalışma günü olup birim için HİÇ satır olmayan günleri kaptana
-- yollar.
--
-- YETKİ:
--   Görme -> kaptan/yardımcı her şeyi, birim kaptanı kendi birimini,
--            üye yalnızca kendi satırlarını
--   Yazma -> kaptan/yardımcı ve o birimin kaptanı
--
-- ÖN KOŞUL: rol-hiyerarsisi.sql (is_admin), gorev-yetkileri.sql
--           (is_unit_captain), calisma-takvimi.sql, takvim-kurallari.sql
-- Supabase → SQL Editor'a yapıştırıp çalıştırın.
-- Tekrar çalıştırmak güvenlidir.
-- ============================================================

set lock_timeout = '5s';

create table if not exists public.attendance (
  id         uuid primary key default gen_random_uuid(),
  day        date        not null,
  member_id  uuid        not null,   -- FK YOK: auth.users kilidi için
  dept       text        not null,
  status     text        not null
             check (status in ('geldi', 'gelmedi', 'gec')),
  taken_by   uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  team_id    uuid,

  constraint attendance_gun_uye_tekil unique (day, member_id)
);

create index if not exists attendance_gun_birim_idx
  on public.attendance (day, dept);

create or replace function public.attendance_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  if auth.uid() is not null then
    new.taken_by := auth.uid();
  end if;
  return new;
end $$;

drop trigger if exists attendance_touch_trg on public.attendance;
create trigger attendance_touch_trg
  before insert or update on public.attendance
  for each row execute function public.attendance_touch();

-- ============================================================
-- RLS
-- ============================================================
alter table public.attendance enable row level security;

drop policy if exists attendance_read on public.attendance;
create policy attendance_read
  on public.attendance for select to authenticated
  using (is_admin() or is_unit_captain(dept) or member_id = auth.uid());

drop policy if exists attendance_write on public.attendance;
create policy attendance_write
  on public.attendance for all to authenticated
  using      (is_admin() or is_unit_captain(dept))
  with check (is_admin() or is_unit_captain(dept));

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'attendance'
  ) then
    alter publication supabase_realtime add table public.attendance;
  end if;
end $$;

-- ------------------------------------------------------------
-- KONTROL
--   select day, dept, status, count(*) from public.attendance
--    group by 1,2,3 order by 1 desc, 2;
-- ------------------------------------------------------------
