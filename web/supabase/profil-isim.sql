-- ============================================================
-- Profil: üye kendi adını düzenleyebilsin + YETKİ YÜKSELTME KAPATMA
--
-- !!! BU BETİK BİR GÜVENLİK AÇIĞINI KAPATIYOR — ÖNCELİKLİ ÇALIŞTIRIN !!!
--
-- Mevcut durumda profiles tablosunda şu politika var:
--
--     profiles_update_self | UPDATE | (auth.uid() = id)
--
-- RLS satır bazlıdır, KOLON bazlı değildir. Yani bu politika altında
-- herhangi bir üye kendi satırında istediği kolonu değiştirebilir:
--
--     update profiles set role = 'admin' where id = auth.uid();
--
-- ...ve anında kaptan yetkisi kazanır. is_admin() buna dayandığı için
-- tüm panel (Üye Yönetimi, İşlem Kayıtları, finans) açılır.
--
-- Politikayı kaldıramayız: üyenin kendi adını yazabilmesi için gerekli.
-- Çözüm, kolon bazlı kontrolü tetikleyiciyle yapmak.
--
-- Supabase → SQL Editor'a yapıştırıp çalıştırın.
-- Tekrar çalıştırmak güvenlidir.
-- ============================================================

-- ------------------------------------------------------------
-- Kaptan (admin) ve başkan yardımcısı (vice) dışındaki hiç kimse
-- role / department / email alanlarını değiştiremez.
-- full_name, username ve last_seen herkese serbest.
--
-- NOT: 'vice' rolü supabase/rol-yardimci.sql ile tanımlanıyor; bu betik
-- ondan önce çalıştırılsa bile sorun çıkmaz (henüz kimse 'vice' değildir).
-- ------------------------------------------------------------
create or replace function public.profiles_guard_privilege()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cagiran_admin boolean;
begin
  -- Servis anahtarıyla (sunucu tarafı / trigger'lar) yapılan işlemlerde
  -- auth.uid() boştur; orada kısıtlama uygulanmaz.
  if auth.uid() is null then
    return new;
  end if;

  -- DİKKAT: burada is_admin() ÇAĞIRMIYORUZ. is_admin() büyük ihtimalle
  -- profiles'a bakıyor ve bu tetikleyici profiles üzerinde çalışıyor;
  -- doğrudan okumak hem daha açık hem de döngü riski taşımıyor.
  select (p.role in ('admin', 'vice'))
    into cagiran_admin
    from public.profiles p
   where p.id = auth.uid();

  if coalesce(cagiran_admin, false) then
    return new;   -- kaptan ve başkan yardımcısı her alanı değiştirebilir
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
-- TEST — normal (admin olmayan) bir üye ile giriş yaptıktan sonra:
--
--   update profiles set full_name = 'Deneme' where id = auth.uid();
--     -> BAŞARILI olmalı
--
--   update profiles set role = 'admin' where id = auth.uid();
--     -> 'Kendi rolünüzü değiştiremezsiniz.' hatası vermeli
--
-- Kaptan hesabıyla Üye Yönetimi'nden rol/departman atama
-- çalışmaya devam etmeli.
-- ------------------------------------------------------------
