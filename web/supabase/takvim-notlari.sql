-- ============================================================
-- Çalışma Takvimi — birime özel notlar
--
-- İSTEK: "Günün notu bütün birimlerde ortak; ayrı ayrı olsun. Yazılan
-- not yalnızca o birimin üyelerine görünsün; danışmanlar, kaptan ve
-- yardımcısı her şeyi görsün. Kaptan/yardımcı yazarken kim göreceğini
-- seçsin (herkes = duyuru, ya da birimler); diğerleri yalnızca kendi
-- birimine yazsın. Notlar birim renginde görünsün."
--
--   calendar_notes : gün başına istediğin kadar not
--     hedef        : kimler görür — {'herkes'} ya da {'yazilim','yapisal'}
--     yazan_birim  : yazanın birimi (rengi bu belirler); tetikleyici doldurur
--
--   calendar_days.note (eski ortak not) artık kullanılmıyor; içindekiler
--   "herkes" notu olarak buraya taşınır. Günün türü / saati / başlığı
--   calendar_days'te kalır (takımın ortak çalışma planı).
--
--   Çok günlü işler (calendar_tasks) de aynı görünürlüğe geçer:
--   'ortak' işi herkes, birim işini o birim + tam yetkililer görür.
--   Birim kaptanı yalnızca kendi birimine iş ekler.
--
-- ÖN KOŞUL: roller-danisman.sql (is_admin), yetki-duzeltmeleri.sql
--           (is_captain), takvim-isler.sql
-- Supabase → SQL Editor'a yapıştırıp çalıştırın.
-- Tekrar çalıştırmak güvenlidir.
-- ============================================================

set lock_timeout = '5s';

-- ------------------------------------------------------------
-- Yardımcı: "benim birimim"
-- ------------------------------------------------------------
create or replace function public.my_dept()
returns text
language sql
stable security definer
set search_path to 'public'
as $function$
  select department from public.profiles where id = auth.uid();
$function$;

-- ------------------------------------------------------------
-- Notlar
-- ------------------------------------------------------------
create table if not exists public.calendar_notes (
  id          uuid primary key default gen_random_uuid(),
  day         date        not null,
  body        text        not null check (char_length(body) between 1 and 1000),
  hedef       text[]      not null check (cardinality(hedef) >= 1),
  yazan_birim text,
  created_by  uuid,                    -- FK YOK: auth.users kilidi için
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  team_id     uuid
);

create index if not exists calendar_notes_day_idx on public.calendar_notes (day);

create or replace function public.calendar_notes_touch()
returns trigger language plpgsql
security definer set search_path = public as $$
begin
  new.updated_at := now();
  if tg_op = 'INSERT' then
    new.created_by  := coalesce(auth.uid(), new.created_by);
    new.yazan_birim := coalesce(public.my_dept(), new.yazan_birim);
  else
    new.created_by  := old.created_by;
    new.yazan_birim := old.yazan_birim;
  end if;
  return new;
end $$;

drop trigger if exists calendar_notes_touch_trg on public.calendar_notes;
create trigger calendar_notes_touch_trg
  before insert or update on public.calendar_notes
  for each row execute function public.calendar_notes_touch();

alter table public.calendar_notes enable row level security;

drop policy if exists calendar_notes_read on public.calendar_notes;
create policy calendar_notes_read
  on public.calendar_notes for select to authenticated
  using (
    is_admin()
    or 'herkes' = any (hedef)
    or my_dept() = any (hedef)
    or created_by = auth.uid()
  );

-- Tam yetkililer herkese / istediği birimlere; birim kaptanı yalnızca
-- kendi birimine yazar
drop policy if exists calendar_notes_insert on public.calendar_notes;
create policy calendar_notes_insert
  on public.calendar_notes for insert to authenticated
  with check (
    is_admin()
    or (is_captain() and my_dept() is not null and hedef = array[my_dept()])
  );

drop policy if exists calendar_notes_update on public.calendar_notes;
create policy calendar_notes_update
  on public.calendar_notes for update to authenticated
  using (created_by = auth.uid() or is_admin())
  with check (
    is_admin()
    or (created_by = auth.uid() and hedef = array[my_dept()])
  );

drop policy if exists calendar_notes_delete on public.calendar_notes;
create policy calendar_notes_delete
  on public.calendar_notes for delete to authenticated
  using (created_by = auth.uid() or is_admin());

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'calendar_notes'
  ) then
    alter publication supabase_realtime add table public.calendar_notes;
  end if;
end $$;

-- Eski ortak notları "herkes" notu olarak taşı (bir kez)
insert into public.calendar_notes (day, body, hedef)
select d.day, left(d.note, 1000), array['herkes']
  from public.calendar_days d
 where d.note is not null and btrim(d.note) <> ''
   and not exists (
     select 1 from public.calendar_notes n
      where n.day = d.day and n.body = left(d.note, 1000)
   );

-- ------------------------------------------------------------
-- Çok günlü işler: birime göre görünürlük
-- ------------------------------------------------------------
drop policy if exists calendar_tasks_read on public.calendar_tasks;
create policy calendar_tasks_read
  on public.calendar_tasks for select to authenticated
  using (is_admin() or dept = 'ortak' or dept = my_dept());

drop policy if exists calendar_tasks_write on public.calendar_tasks;
create policy calendar_tasks_write
  on public.calendar_tasks for all to authenticated
  using      (is_admin() or (is_captain() and dept = my_dept()))
  with check (is_admin() or (is_captain() and dept = my_dept()));

-- ------------------------------------------------------------
-- KONTROL
--   select day, hedef, yazan_birim, left(body, 40)
--     from public.calendar_notes order by day desc limit 20;
-- ------------------------------------------------------------
