-- ============================================================
-- Toplantı Odası (Jitsi)
--
-- Herhangi bir üye toplantı başlatabilir; başlatılmış aktif bir toplantı
-- varsa diğerleri panelden tek tıkla katılır. Video/ses/sohbet Jitsi
-- tarafında, biz yalnızca "hangi oda açık" bilgisini tutuyoruz.
--
-- Supabase → SQL Editor'a yapıştırıp çalıştırın.
-- Tekrar çalıştırmak güvenlidir.
-- ============================================================

create table if not exists public.meetings (
  id          uuid primary key default gen_random_uuid(),
  -- Jitsi oda adı. Tahmin edilemez olmalı: odayı bilen herkes girebilir.
  room        text        not null unique,
  title       text,
  started_by  uuid        references auth.users (id) on delete set null,
  started_at  timestamptz not null default now(),
  ended_at    timestamptz,
  -- Çok takımlı yapıya geçişi kolaylaştırmak için baştan duruyor.
  -- Şu an tek takım olduğu için boş; migration'da AAD id'si atanacak.
  team_id     uuid
);

-- Aktif toplantı sorgusu bunun üzerinden gider
create index if not exists meetings_active_idx
  on public.meetings (started_at desc)
  where ended_at is null;

-- ============================================================
-- RLS
-- ============================================================
alter table public.meetings enable row level security;

-- Tüm giriş yapmış üyeler toplantıları görür
drop policy if exists meetings_read on public.meetings;
create policy meetings_read
  on public.meetings for select
  to authenticated
  using (true);

-- Herhangi bir üye toplantı başlatabilir (kendi adına)
drop policy if exists meetings_insert on public.meetings;
create policy meetings_insert
  on public.meetings for insert
  to authenticated
  with check (started_by = auth.uid());

-- Toplantıyı yalnızca başlatan ya da kaptan bitirebilir
drop policy if exists meetings_update on public.meetings;
create policy meetings_update
  on public.meetings for update
  to authenticated
  using (
    started_by = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- ------------------------------------------------------------
-- Realtime: aktif toplantı açılınca herkeste anında görünsün
-- ------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'meetings'
  ) then
    alter publication supabase_realtime add table public.meetings;
  end if;
end $$;
