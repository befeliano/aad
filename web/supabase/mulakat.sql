-- ============================================================
-- Mülakat Değerlendirme
--
-- Ekim alımı için: adayın künyesi, seçilen departmana göre çıkan beceri
-- listesi, yine departmana göre çıkan sorular ve cevapları, puan ve not.
-- Mülakatı yapan kişi telefondan/siteden doldurur.
--
-- YETKİ:
--   Yazma  -> takım kaptanı, kaptan yardımcısı ve ADAYIN ALINDIĞI
--             departmanın birim kaptanı.
--   Okuma  -> aynı küme. Bilerek dar: burada aday adı, yaşı, notu gibi
--             kişisel veri var; tüm takıma açmak doğru değil.
--
-- Beceri listeleri ve sorular KODDA (src/lib/interview.ts). Deploy
-- gerektirmeden düzenlenebilmesi için ileride tabloya alınabilir —
-- çok takımlı yapıya geçişte zaten gerekecek.
--
-- Supabase → SQL Editor'a yapıştırıp çalıştırın.
-- Tekrar çalıştırmak güvenlidir.
-- ============================================================

create table if not exists public.interviews (
  id           uuid primary key default gen_random_uuid(),

  -- Künye
  first_name   text        not null,
  last_name    text        not null,
  age          int         check (age is null or age between 15 and 70),
  program      text,                       -- üniversitedeki bölümü
  email        text,
  phone        text,

  -- Hangi birime alınıyor (yazilim, tasarim, kompozit, ...)
  dept         text        not null,

  -- Seçilen beceriler: ["python","cpp","ros"]
  skills       jsonb       not null default '[]'::jsonb,
  -- Soru anahtarı -> cevap: {"yazilim_eksik":"...","genel_katki":"..."}
  answers      jsonb       not null default '{}'::jsonb,

  score        int         check (score is null or score between 1 and 5),
  notes        text,
  status       text        not null default 'planlandi'
               check (status in ('planlandi','yapildi','kabul','red','beklemede')),

  interviewed_at timestamptz,
  interviewer  uuid        references auth.users (id) on delete set null,
  created_by   uuid        references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  team_id      uuid
);

create index if not exists interviews_dept_idx   on public.interviews (dept);
create index if not exists interviews_status_idx on public.interviews (status);

create or replace function public.interviews_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
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
-- RLS — kaptan, yardımcı ve ilgili birim kaptanı
-- ============================================================
alter table public.interviews enable row level security;

drop policy if exists interviews_select on public.interviews;
create policy interviews_select
  on public.interviews for select
  to authenticated
  using (is_admin() or is_unit_captain(dept));

drop policy if exists interviews_insert on public.interviews;
create policy interviews_insert
  on public.interviews for insert
  to authenticated
  with check (is_admin() or is_unit_captain(dept));

drop policy if exists interviews_update on public.interviews;
create policy interviews_update
  on public.interviews for update
  to authenticated
  using (is_admin() or is_unit_captain(dept))
  with check (is_admin() or is_unit_captain(dept));

drop policy if exists interviews_delete on public.interviews;
create policy interviews_delete
  on public.interviews for delete
  to authenticated
  using (is_admin() or is_unit_captain(dept));

-- ------------------------------------------------------------
-- KONTROL
--   select dept, status, count(*) from public.interviews
--   group by 1,2 order by 1,2;
-- ------------------------------------------------------------
