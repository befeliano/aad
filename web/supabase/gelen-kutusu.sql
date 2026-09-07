-- ============================================================
-- Gelen Kutusu — site iletişim formu mesajları
--
-- DURUM TESPİTİ:
--   contact_messages tablosu eski siteden kalma ve RLS'i duruyor, AMA
--   yeni sitedeki iletişim formu hiçbir şey kaydetmiyordu: mesajı
--   mailto: bağlantısına çevirip kullanıcının posta uygulamasını
--   açıyordu. Yani tablo boş, form da izlenmiyor.
--
-- ------------------------------------------------------------
-- DEADLOCK NOTU (bu betiğin ilk sürümü 40P01 verdi)
--
--   handled_by kolonu önce `references auth.users (id)` ile
--   ekleniyordu. VAR OLAN bir tabloya auth.users'a giden foreign key
--   eklemek auth.users üzerinde de kilit ister; o tablo giriş yapmış
--   her kullanıcı tarafından sürekli okunduğu için iki işlem
--   birbirini bekleyip kilitlendi.
--
--   Foreign key'e ihtiyaç yok: handled_by yalnızca "kim işaretledi"
--   damgası. Kaldırıldı.
--
--   Ayrıca lock_timeout konuldu — betik takılıp kalmak yerine 5 saniye
--   sonra anlaşılır bir hatayla durur.
--
--   ÇALIŞTIRMADAN ÖNCE: Supabase SQL Editor'daki DİĞER SEKMELERİ
--   kapatın ya da sayfayı yenileyin. Açık bir sekme işlem tutuyorsa
--   kilit çakışması tekrarlar.
-- ------------------------------------------------------------
--
-- Tekrar çalıştırmak güvenlidir.
-- ============================================================

set lock_timeout = '5s';

create table if not exists public.contact_messages (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

-- Eksik kolonları tamamla. Zaten varsa hiçbir şey yapmaz;
-- eski sitenin verisi olduğu gibi kalır.
-- DİKKAT: handled_by'da foreign key YOK — yukarıdaki deadlock notuna bakın.
alter table public.contact_messages
  add column if not exists name       text,
  add column if not exists email      text,
  add column if not exists subject    text,
  add column if not exists message    text,
  add column if not exists handled    boolean not null default false,
  add column if not exists handled_by uuid,
  add column if not exists handled_at timestamptz,
  add column if not exists created_at timestamptz not null default now();

-- Mevcut kolon adlarını görün: beklenenden farklıysa bana söyleyin
do $$
declare k text;
begin
  select string_agg(column_name, ', ' order by ordinal_position) into k
    from information_schema.columns
   where table_schema = 'public' and table_name = 'contact_messages';
  raise notice 'contact_messages kolonları: %', k;
end $$;

create index if not exists contact_messages_handled_idx
  on public.contact_messages (handled, created_at desc);

-- İşaretlendiğinde damgayı otomatik at
create or replace function public.contact_messages_touch()
returns trigger language plpgsql as $$
begin
  if new.handled and not coalesce(old.handled, false) then
    new.handled_at := now();
    new.handled_by := auth.uid();
  elsif not new.handled then
    new.handled_at := null;
    new.handled_by := null;
  end if;
  return new;
end $$;

drop trigger if exists contact_messages_touch_trg on public.contact_messages;
create trigger contact_messages_touch_trg
  before update on public.contact_messages
  for each row execute function public.contact_messages_touch();

-- ============================================================
-- RLS
-- ============================================================
alter table public.contact_messages enable row level security;

-- Siteden gönderim: form ziyaretçiye açık, ziyaretçi giriş yapmamış olur.
-- Bu yüzden anon rolüne de izin veriliyor.
--
-- DİKKAT: herkese açık insert, tabloyu spam'e açar. Şimdilik uzunluk
-- sınırı dışında koruma yok; sorun olursa Edge Function ile oran sınırı
-- ya da hCaptcha eklenir.
drop policy if exists contact_insert_anyone on public.contact_messages;
create policy contact_insert_anyone
  on public.contact_messages for insert
  to anon, authenticated
  with check (
    coalesce(length(message), 0) between 1 and 5000
    and coalesce(length(name), 0) <= 200
    and coalesce(length(email), 0) <= 200
    and coalesce(length(subject), 0) <= 200
  );

-- Okuma: Medya & Sponsorluk ekibinin tamamı + kaptan ve yardımcısı
-- (has_dept_access zaten is_admin'i içeriyor)
drop policy if exists contact_select_authenticated on public.contact_messages;
create policy contact_select_authenticated
  on public.contact_messages for select
  to authenticated
  using (has_dept_access(array['sponsorluk']));

-- "İlgilenildi" işaretini aynı ekip koyabilsin
drop policy if exists contact_update on public.contact_messages;
create policy contact_update
  on public.contact_messages for update
  to authenticated
  using      (has_dept_access(array['sponsorluk']))
  with check (has_dept_access(array['sponsorluk']));

-- Silme yalnızca kaptan ve yardımcıda: gelen mesaj bir kayıt,
-- ilgilenildi diye silinmemeli.
drop policy if exists contact_delete_admin on public.contact_messages;
create policy contact_delete_admin
  on public.contact_messages for delete
  to authenticated
  using (is_admin());

-- ------------------------------------------------------------
-- KONTROL
--   select handled, count(*) from public.contact_messages group by 1;
--
-- TEST
--   Siteden /iletisim formunu doldur -> tabloya satır düşmeli
--   Medya üyesiyle /panel/mesajlar   -> AÇILMALI
--   Yazılım üyesiyle /panel/mesajlar -> AÇILMAMALI
-- ------------------------------------------------------------
