-- ============================================================
-- 7 — İşlem Kayıtları (audit_log) düzeltmesi
--
-- SORUN:
--   audit_log.user_id  -> nullable, varsayılanı YOK
--   audit_insert_self  -> INSERT with_check: (auth.uid() = user_id)
--
--   Panel bu alanı hiç göndermiyordu. user_id NULL kalınca
--   `auth.uid() = NULL` ifadesi NULL döner; NULL, TRUE olmadığı için
--   RLS her insert'i reddediyordu. supabase-js de hata fırlatmayıp
--   `{ error }` döndürdüğü ve eski kod bunu okumadığı için hata
--   tamamen görünmezdi — panelde bir aydır yeni kayıt yoktu.
--
-- ÇÖZÜM (iki katman):
--   1. user_id'ye `default auth.uid()` — alan gönderilmezse bile dolar.
--   2. BEFORE INSERT tetikleyici — user_name ve user_dept'i profiles'tan
--      doldurur, böylece hangi modülden yazılırsa yazılsın kayıt eksiksiz
--      olur ve her çağrı yerinde ayrıca isim göndermek gerekmez.
--
-- Uygulama tarafı da user_id'yi artık açıkça gönderiyor (src/lib/audit.ts).
-- İkisi birlikte çalışır; biri devre dışı kalsa diğeri yeterlidir.
--
-- Supabase → SQL Editor'a yapıştırıp çalıştırın.
-- Tekrar çalıştırmak güvenlidir.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Varsayılan: alan gönderilmezse giriş yapmış kullanıcı
-- ------------------------------------------------------------
alter table public.audit_log
  alter column user_id set default auth.uid();

-- ------------------------------------------------------------
-- 2) Kullanıcı bilgisini profiles'tan doldur
--
-- BEFORE trigger'lar RLS WITH CHECK denetiminden ÖNCE çalışır; yani
-- burada atanan user_id, audit_insert_self kontrolüne girer.
-- ------------------------------------------------------------
create or replace function public.audit_log_fill_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  p record;
begin
  -- Kimlik: gönderilmediyse oturumdan al
  if new.user_id is null then
    new.user_id := auth.uid();
  end if;

  if new.user_id is null then
    return new;               -- servis anahtarı vb.: dolduracak bir şey yok
  end if;

  select full_name, username, email, department
    into p
    from public.profiles
   where id = new.user_id;

  if found then
    if new.user_name is null then
      new.user_name := coalesce(
        nullif(btrim(p.full_name), ''),
        nullif(btrim(p.username), ''),
        split_part(coalesce(p.email, ''), '@', 1),
        'Bilinmiyor'
      );
    end if;

    if new.user_dept is null then
      new.user_dept := p.department;
    end if;
  end if;

  return new;
end $$;

drop trigger if exists audit_log_fill_user_trg on public.audit_log;
create trigger audit_log_fill_user_trg
  before insert on public.audit_log
  for each row
  execute function public.audit_log_fill_user();

-- ------------------------------------------------------------
-- TEST — normal bir üye ile giriş yaptıktan sonra panelden herhangi bir
-- kayıt ekle/güncelle, sonra kaptan hesabıyla:
--
--   select created_at, user_name, user_dept, action, table_name
--   from public.audit_log order by created_at desc limit 10;
--
-- Bugünün tarihli satırları görünmeli ve user_name dolu olmalı.
-- (audit_select_admin politikası gereği listeyi yalnızca takım kaptanı
--  ve kaptan yardımcısı görebilir — is_admin() ikisini de kapsıyor.)
-- ------------------------------------------------------------
