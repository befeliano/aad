-- ============================================================
-- Uçuş öncesi kontrol listesi (checklist)
-- Supabase → SQL Editor'a yapıştırıp çalıştırın.
-- Tekrar çalıştırmak güvenlidir (IF NOT EXISTS / DROP POLICY IF EXISTS).
-- ============================================================

-- 1) Kaptanın tanımladığı şablon maddeleri
create table if not exists public.checklist_items (
  id          uuid primary key default gen_random_uuid(),
  label       text not null,
  hint        text,
  position    int  not null default 0,
  required    boolean not null default true,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);

-- 2) Bir uçuş için doldurulmuş checklist
create table if not exists public.flight_checklists (
  id            uuid primary key default gen_random_uuid(),
  flight_id     uuid not null references public.flights (id) on delete cascade,
  -- [{ "label": "...", "ok": true, "required": true }]
  checked       jsonb not null default '[]'::jsonb,
  note          text,
  started_at    timestamptz,
  completed_at  timestamptz,
  created_by    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now()
);

-- Bir uçuşun tek bir checklist kaydı olsun
create unique index if not exists flight_checklists_flight_id_key
  on public.flight_checklists (flight_id);

-- ============================================================
-- RLS
-- ============================================================
alter table public.checklist_items    enable row level security;
alter table public.flight_checklists  enable row level security;

-- Şablonu tüm giriş yapmış üyeler okur
drop policy if exists checklist_items_read on public.checklist_items;
create policy checklist_items_read
  on public.checklist_items for select
  to authenticated
  using (true);

-- Şablonu yalnızca kaptan (admin) düzenler
drop policy if exists checklist_items_write on public.checklist_items;
create policy checklist_items_write
  on public.checklist_items for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Doldurulmuş checklist'leri tüm üyeler görür ve doldurabilir
drop policy if exists flight_checklists_read on public.flight_checklists;
create policy flight_checklists_read
  on public.flight_checklists for select
  to authenticated
  using (true);

drop policy if exists flight_checklists_write on public.flight_checklists;
create policy flight_checklists_write
  on public.flight_checklists for all
  to authenticated
  using (true)
  with check (true);

-- ============================================================
-- Başlangıç şablonu (yalnızca tablo boşsa eklenir)
-- ============================================================
insert into public.checklist_items (label, hint, position, required)
select * from (values
  ('Batarya şarj seviyeleri kontrol edildi', 'Uçuş ve verici bataryaları', 1, true),
  ('Pervaneler sıkı ve hasarsız',            'Çatlak/çentik kontrolü', 2, true),
  ('Kontrol yüzeyleri serbest ve doğru yönde','Aileron, elevator, rudder', 3, true),
  ('Kumanda bağlantısı ve failsafe testi',   'Menzil testi yapıldı', 4, true),
  ('Telemetri ve yer istasyonu bağlantısı',  'Veri akışı doğrulandı', 5, true),
  ('GPS fix alındı (min. 8 uydu)',           null, 6, true),
  ('Kamera ve görüntü işleme çalışıyor',     null, 7, false),
  ('Ağırlık merkezi (CG) doğrulandı',        null, 8, true),
  ('Uçuş alanı ve hava durumu uygun',        'Rüzgâr, yağış, görüş', 9, true),
  ('Acil durum planı ekiple paylaşıldı',     null, 10, true)
) as v(label, hint, position, required)
where not exists (select 1 from public.checklist_items);
