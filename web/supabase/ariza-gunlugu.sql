-- ============================================================
-- Arıza Günlüğü
--
-- NEDEN:
--   "Ethernet kablosu bazen arızalıydı" gibi şeyler şu an kimsenin
--   aklında duruyor. Aynı parça üçüncü kez bozulduğunda kimse bunu
--   hatırlamıyor ve teşhis sıfırdan yapılıyor. Bu tablo o hafızayı
--   tutuyor: ne bozuldu, belirtisi neydi, ne yapıldı.
--
-- KİM YAZAR:
--   Arızayı HERKES bildirir — sorunu gören kişi bildirebilmeli, yoksa
--   kayıt tutulmaz. Kapatma/düzenleme ise bildiren kişide, o birimin
--   kaptanında ve kaptan + yardımcısında.
--
-- Supabase → SQL Editor'a yapıştırıp çalıştırın.
-- Tekrar çalıştırmak güvenlidir.
-- ============================================================

create table if not exists public.faults (
  id          uuid primary key default gen_random_uuid(),
  title       text        not null,
  description text,
  -- Hangi birimi ilgilendiriyor (yazilim, aviyonik, kompozit...)
  dept        text        not null default 'ortak',
  -- Neyle ilgili: "ethernet kablosu", "Jetson", "DABAN sol kanat"
  subject     text,
  severity    text        not null default 'orta'
              check (severity in ('dusuk', 'orta', 'yuksek', 'kritik')),
  status      text        not null default 'acik'
              check (status in ('acik', 'inceleniyor', 'cozuldu')),
  -- Nasıl çözüldü — tekrarında ilk bakılacak yer burası
  resolution  text,
  resolved_at timestamptz,
  reported_by uuid        references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  team_id     uuid                       -- çok takımlı yapıya hazırlık
);

create index if not exists faults_status_idx on public.faults (status);
create index if not exists faults_dept_idx   on public.faults (dept);
-- Aynı parçanın geçmişini çekmek için
create index if not exists faults_subject_idx on public.faults (lower(subject));

create or replace function public.faults_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  -- Çözüldü işaretlenince damgayı otomatik at, boşaltılırsa geri al
  if new.status = 'cozuldu' and old.status is distinct from 'cozuldu' then
    new.resolved_at := now();
  elsif new.status <> 'cozuldu' then
    new.resolved_at := null;
  end if;
  return new;
end $$;

drop trigger if exists faults_touch_trg on public.faults;
create trigger faults_touch_trg
  before update on public.faults
  for each row execute function public.faults_touch();

-- ============================================================
-- RLS
-- ============================================================
alter table public.faults enable row level security;

-- Tüm takım görür: bir arızayı bilmek herkesin işine yarar
drop policy if exists faults_select on public.faults;
create policy faults_select
  on public.faults for select
  to authenticated
  using (true);

-- Herkes bildirebilir (kendi adına)
drop policy if exists faults_insert on public.faults;
create policy faults_insert
  on public.faults for insert
  to authenticated
  with check (reported_by = auth.uid());

-- Düzenleme: bildiren + o birimin kaptanı + kaptan/yardımcı
drop policy if exists faults_update on public.faults;
create policy faults_update
  on public.faults for update
  to authenticated
  using (
    reported_by = auth.uid()
    or is_admin()
    or is_unit_captain(dept)
  )
  with check (
    reported_by = auth.uid()
    or is_admin()
    or is_unit_captain(dept)
  );

-- Silme: yalnızca bildiren ve kaptan/yardımcı.
-- Birim kaptanı kapatabilir ama silemez — kayıt hafıza, silinmemeli.
drop policy if exists faults_delete on public.faults;
create policy faults_delete
  on public.faults for delete
  to authenticated
  using (reported_by = auth.uid() or is_admin());

-- Realtime
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'faults'
  ) then
    alter publication supabase_realtime add table public.faults;
  end if;
end $$;

-- ------------------------------------------------------------
-- KONTROL
--   select status, count(*) from public.faults group by 1;
--   -- Aynı parçanın geçmişi:
--   select created_at, title, resolution from public.faults
--    where lower(subject) like '%ethernet%' order by created_at;
-- ------------------------------------------------------------
