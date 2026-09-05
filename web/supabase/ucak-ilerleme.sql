-- ============================================================
-- Uçak Yapım İlerlemesi — Genel Bakış'taki kuşbakışı şema
--
-- FİKİR:
--   Panele giren herkes uçağın üstten şemasını görsün; her bölge
--   (sol kanat, gövde, kuyruk, itki, aviyonik, faydalı yük...) kendi
--   yüzdesiyle renklensin. F1 yayınlarındaki araç hasar göstergesi gibi.
--
-- İKİ TABLO:
--   aircraft_builds    -> uçak projesi: ad, başlangıç tarihi, durum
--   aircraft_sections  -> o uçağın bölgeleri ve yüzdeleri
--
-- YÜZDE NEREDEN GELİYOR?
--   Elle giriliyor. Otomatik hesaplamaya çalışmak (görev sayısı,
--   parça sayısı) yanıltıcı olur: 3 görevden 2'sini bitirmek %66
--   ilerleme demek değildir. Bölümün sorumlusu haftada bir kendi
--   yüzdesini günceller; kim ne zaman güncelledi kayıtlı kalır.
--
-- Supabase → SQL Editor'a yapıştırıp çalıştırın.
-- Tekrar çalıştırmak güvenlidir.
-- ============================================================

create table if not exists public.aircraft_builds (
  id          uuid primary key default gen_random_uuid(),
  name        text        not null unique,      -- "DABAN", "GÖLGE"
  started_on  date,
  target_on   date,                             -- hedeflenen ilk uçuş
  status      text        not null default 'aktif',
  note        text,
  is_current  boolean     not null default false, -- Genel Bakış'ta gösterilen
  created_by  uuid        references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  team_id     uuid                                -- çok takımlı yapıya hazırlık
);

create table if not exists public.aircraft_sections (
  id          uuid primary key default gen_random_uuid(),
  build_id    uuid        not null references public.aircraft_builds (id) on delete cascade,
  -- şemadaki bölge anahtarı: govde, sol_kanat, sag_kanat, kuyruk,
  -- itki, aviyonik, yuk, iniz_takimi
  section_key text        not null,
  label       text        not null,
  percent     int         not null default 0 check (percent between 0 and 100),
  note        text,
  updated_by  uuid        references auth.users (id) on delete set null,
  updated_at  timestamptz not null default now(),
  unique (build_id, section_key)
);

create index if not exists aircraft_sections_build_idx
  on public.aircraft_sections (build_id);

-- Aynı anda tek "güncel" uçak olsun
create unique index if not exists aircraft_builds_tek_guncel
  on public.aircraft_builds (is_current) where is_current;

-- ============================================================
-- RLS — tüm takım görür, yalnızca teknik departmanlar günceller
-- ============================================================
alter table public.aircraft_builds   enable row level security;
alter table public.aircraft_sections enable row level security;

drop policy if exists aircraft_builds_read on public.aircraft_builds;
create policy aircraft_builds_read
  on public.aircraft_builds for select to authenticated using (true);

drop policy if exists aircraft_sections_read on public.aircraft_sections;
create policy aircraft_sections_read
  on public.aircraft_sections for select to authenticated using (true);

-- Yazma: 3D parça yükleyebilenlerle aynı küme + kaptan/yardımcı
-- (has_dept_access zaten is_admin'i içeriyor)
drop policy if exists aircraft_builds_write on public.aircraft_builds;
create policy aircraft_builds_write
  on public.aircraft_builds for all to authenticated
  using (
    has_dept_access(array['yazilim', 'tasarim', 'yapisal', 'kompozit', 'aviyonik'])
  )
  with check (
    has_dept_access(array['yazilim', 'tasarim', 'yapisal', 'kompozit', 'aviyonik'])
  );

drop policy if exists aircraft_sections_write on public.aircraft_sections;
create policy aircraft_sections_write
  on public.aircraft_sections for all to authenticated
  using (
    has_dept_access(array['yazilim', 'tasarim', 'yapisal', 'kompozit', 'aviyonik'])
  )
  with check (
    has_dept_access(array['yazilim', 'tasarim', 'yapisal', 'kompozit', 'aviyonik'])
  );

-- Yüzde değişince damgayı tazele
create or replace function public.aircraft_sections_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists aircraft_sections_touch_trg on public.aircraft_sections;
create trigger aircraft_sections_touch_trg
  before update on public.aircraft_sections
  for each row execute function public.aircraft_sections_touch();

-- ============================================================
-- BAŞLANGIÇ VERİSİ — DABAN 2027, sekiz bölge
-- Yüzdeler örnek; panelden güncelleyeceksiniz.
-- ============================================================
insert into public.aircraft_builds (name, started_on, target_on, status, is_current, note)
values ('DABAN', date '2026-10-03', date '2027-08-10', 'aktif', true,
        'TEKNOFEST 2027 Savaşan İHA platformu')
on conflict (name) do nothing;

-- Tarihler sonradan netleşti: çalışmalara 3 Ekim 2026'da başlandı,
-- hedef 10 Ağustos 2027. Kayıt zaten varsa güncellenir.
update public.aircraft_builds
   set started_on = date '2026-10-03',
       target_on  = date '2027-08-10'
 where name = 'DABAN';

insert into public.aircraft_sections (build_id, section_key, label, percent)
select b.id, s.k, s.l, 0
from public.aircraft_builds b
cross join (values
  ('govde',        'Gövde'),
  ('sol_kanat',    'Sol Kanat'),
  ('sag_kanat',    'Sağ Kanat'),
  ('kuyruk',       'Kuyruk Takımı'),
  ('itki',         'İtki Sistemi'),
  ('aviyonik',     'Aviyonik'),
  ('yuk',          'Faydalı Yük'),
  ('inis_takimi',  'İniş Takımı')
) as s(k, l)
where b.name = 'DABAN'
on conflict (build_id, section_key) do nothing;

-- ------------------------------------------------------------
-- KONTROL
--   select b.name, s.label, s.percent
--   from aircraft_builds b join aircraft_sections s on s.build_id = b.id
--   order by b.name, s.label;
-- ------------------------------------------------------------
