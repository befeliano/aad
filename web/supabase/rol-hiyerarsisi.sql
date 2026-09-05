-- ============================================================
-- 6 — Rol hiyerarşisi
--
--   admin    Takım Kaptanı              (tüm takımda 1 kişi)
--   vice     Takım Kaptan Yardımcısı    (tüm takımda 1 kişi)
--   captain  Birim Kaptanı              (her alt birimde 1 kişi)
--   member   Üye                        (sınırsız)
--
-- YETKİ KURALI:
--   admin ve vice TAM YETKİLİDİR (is_admin() ikisine de true döner):
--   üye yönetimi, rol atama, işlem kayıtları, finans — hepsi açık.
--
--   captain SADECE BİR UNVANDIR. Birim kaptanı olmak hiçbir ek yetki
--   vermez; yetkileri düz üye ile aynıdır. Özellikle finans (sponsors,
--   allocations) birim kaptanına KAPALIDIR — oraya erişim yalnızca
--   admin/vice ile veya "sponsorluk" (Medya & Sponsorluk) departmanında
--   olmakla gelir.
--
-- Bu dosya, daha önce çalıştırdığınız profil-isim.sql'deki tetikleyiciyi
-- de günceller (o sürüm yalnızca 'admin'i tanıyordu).
--
-- Supabase → SQL Editor'a yapıştırıp çalıştırın.
-- Tekrar çalıştırmak güvenlidir.
-- ============================================================

-- ------------------------------------------------------------
-- 1) is_admin(): başkan yardımcısı da tam yetkili
--    Gövde, mevcut fonksiyonun birebir aynısı; yalnızca rol kümesi genişledi.
--    has_dept_access() bunu çağırdığı için tüm modüller otomatik uyar.
-- ------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'vice')
  );
$function$;

-- ------------------------------------------------------------
-- 2) Yetki yükseltme koruması — 'vice' de ayrıcalıklı sayılsın
--    (profil-isim.sql'deki sürümün yerini alır)
-- ------------------------------------------------------------
create or replace function public.profiles_guard_privilege()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cagiran_yetkili boolean;
begin
  if auth.uid() is null then
    return new;                 -- servis anahtarı: kısıtlama yok
  end if;

  select (p.role in ('admin', 'vice'))
    into cagiran_yetkili
    from public.profiles p
   where p.id = auth.uid();

  if coalesce(cagiran_yetkili, false) then
    return new;                 -- kaptan ve yardımcısı her alanı değiştirir
  end if;

  if new.role is distinct from old.role then
    raise exception 'Kendi rolünüzü değiştiremezsiniz.' using errcode = '42501';
  end if;

  if new.department is distinct from old.department then
    raise exception 'Kendi departmanınızı değiştiremezsiniz.' using errcode = '42501';
  end if;

  if new.email is distinct from old.email then
    raise exception 'E-posta panelden değiştirilemez.' using errcode = '42501';
  end if;

  return new;
end $$;

drop trigger if exists profiles_guard_privilege_trg on public.profiles;
create trigger profiles_guard_privilege_trg
  before update on public.profiles
  for each row
  execute function public.profiles_guard_privilege();

-- ------------------------------------------------------------
-- 3) Geçerli rol değerleri
--    Mevcut veride kural dışı değer varsa kısıt EKLENMEZ, uyarı basılır —
--    böylece betiğin tamamı bir aykırı satır yüzünden geri alınmaz.
-- ------------------------------------------------------------
do $$
declare
  hatali bigint;
begin
  select count(*) into hatali
  from public.profiles
  where role is null or role not in ('admin', 'vice', 'captain', 'member');

  if hatali > 0 then
    raise notice 'ATLANDI: % satırda tanımsız rol var. Şunu çalıştırıp düzeltin: select distinct role from public.profiles;', hatali;
  elsif not exists (
    select 1 from pg_constraint where conname = 'profiles_role_check'
  ) then
    alter table public.profiles
      add constraint profiles_role_check
      check (role in ('admin', 'vice', 'captain', 'member'));
    raise notice 'profiles_role_check eklendi';
  else
    raise notice 'profiles_role_check zaten var';
  end if;
end $$;

-- ------------------------------------------------------------
-- 4) Teklik kuralları
--    Kısmi tekil indeks: yalnızca ilgili role sahip satırları kapsar.
--    Örn. role='admin' olan satırlarda "role" sütunu hep 'admin' olduğu
--    için tekil indeks o rolden ikinci bir satıra izin vermez.
-- ------------------------------------------------------------
do $$
declare
  n bigint;
begin
  -- Tek Takım Kaptanı
  select count(*) into n from public.profiles where role = 'admin';
  if n > 1 then
    raise notice 'ATLANDI: % adet takım kaptanı var, önce bire indirin', n;
  else
    create unique index if not exists profiles_tek_takim_kaptani
      on public.profiles (role) where role = 'admin';
    raise notice 'Tek takım kaptanı kuralı kuruldu';
  end if;

  -- Tek Takım Kaptan Yardımcısı
  select count(*) into n from public.profiles where role = 'vice';
  if n > 1 then
    raise notice 'ATLANDI: % adet kaptan yardımcısı var, önce bire indirin', n;
  else
    create unique index if not exists profiles_tek_kaptan_yardimcisi
      on public.profiles (role) where role = 'vice';
    raise notice 'Tek kaptan yardımcısı kuralı kuruldu';
  end if;

  -- Her birimde tek Birim Kaptanı
  select count(*) into n from (
    select department from public.profiles
    where role = 'captain' and department is not null
    group by department having count(*) > 1
  ) x;
  if n > 0 then
    raise notice 'ATLANDI: % birimde birden fazla birim kaptanı var', n;
  else
    -- NOT: departmanı boş olan birim kaptanları bu kurala takılmaz
    -- (Postgres tekil indekste NULL'ları birbirinden farklı sayar).
    create unique index if not exists profiles_birim_basina_tek_kaptan
      on public.profiles (department) where role = 'captain';
    raise notice 'Birim başına tek kaptan kuralı kuruldu';
  end if;
end $$;

-- ------------------------------------------------------------
-- KONTROL
--   select role, department, count(*) from public.profiles
--   group by 1,2 order by 1,2;
--
-- TEST
--   İkinci bir kişiyi "Takım Kaptanı" yapmayı dene -> hata vermeli.
--   Aynı birimde ikinci "Birim Kaptanı" atamayı dene -> hata vermeli.
--   Bir birim kaptanıyla /panel/sponsorluk aç -> ERİŞİM OLMAMALI.
--   Kaptan yardımcısıyla /panel/uyeler aç -> AÇILMALI.
-- ------------------------------------------------------------
