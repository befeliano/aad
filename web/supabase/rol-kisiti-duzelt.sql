-- ============================================================
-- DÜZELTME — profiles_role_check dört rolü kapsamıyor
--
-- BELİRTİ:
--   Üye Yönetimi'nden "Birim Kaptanı" veya "Takım Kaptan Yardımcısı"
--   atarken:
--     new row for relation "profiles" violates check constraint
--     "profiles_role_check"
--
-- SEBEP:
--   Eski siteden kalma, aynı isimde bir CHECK kısıtı zaten vardı
--   (büyük ihtimalle yalnızca 'admin' ve 'member' kabul ediyor).
--   rol-hiyerarsisi.sql "aynı isimde kısıt varsa dokunma" dediği için
--   yeni dört değerli sürüm hiç eklenmedi ve eski kısıt yürürlükte kaldı.
--
-- ÇÖZÜM:
--   Kısıtı içeriğine bakmadan yenile — önce mevcut verinin uygun
--   olduğunu doğrula, sonra eskiyi düşürüp yenisini ekle.
--
-- Supabase → SQL Editor'a yapıştırıp çalıştırın.
-- Tekrar çalıştırmak güvenlidir.
-- ============================================================

-- ------------------------------------------------------------
-- Önce mevcut hâli görmek isterseniz (isteğe bağlı):
--   select conname, pg_get_constraintdef(oid)
--   from pg_constraint
--   where conrelid = 'public.profiles'::regclass;
-- ------------------------------------------------------------

do $$
declare
  hatali bigint;
begin
  -- Veride dört rolün dışında değer var mı?
  select count(*) into hatali
  from public.profiles
  where role is null
     or role not in ('admin', 'vice', 'captain', 'member');

  if hatali > 0 then
    raise notice
      'ATLANDI: % satırda tanımsız rol var. Şunu çalıştırıp düzeltin: select distinct role from public.profiles;',
      hatali;
    return;
  end if;

  -- Adı ne olursa olsun eski sürümü düşür, dört değerli yenisini ekle.
  alter table public.profiles
    drop constraint if exists profiles_role_check;

  alter table public.profiles
    add constraint profiles_role_check
    check (role in ('admin', 'vice', 'captain', 'member'));

  raise notice 'profiles_role_check dört rolü kapsayacak şekilde yenilendi';
end $$;

-- ------------------------------------------------------------
-- KONTROL — dört değeri de içermeli:
--   select pg_get_constraintdef(oid)
--   from pg_constraint
--   where conrelid = 'public.profiles'::regclass
--     and conname = 'profiles_role_check';
--
-- TEST — Üye Yönetimi'nden birini "Birim Kaptanı" yap: kaydetmeli.
-- ------------------------------------------------------------
