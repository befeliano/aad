-- ============================================================
-- Yeni roller + yoklama saati
--
-- 1) TAM YETKİLİ ROLLER
--      admin    Takım Kaptanı            (tek kişi)
--      vice     Takım Kaptan Yardımcısı  (tek kişi)
--      advisor  Danışman Hoca            (yeni)
--      mentor   Danışman                 (yeni)
--      sistem   Teknik Yönetici          (yeni — admin@anatolia.com gibi
--                                         kişiye ait olmayan hesap)
--    Hepsinin yetkisi aynı: is_admin() beşine de true döner. Birim
--    kaptanı (captain) ve üye (member) değişmedi.
--    İşlem Kayıtları da artık bu beş role + yazılım birimine açık.
--
-- 2) YOKLAMA SAATİ
--    Yoklama bugünün tarihi için ancak 09:50'den (Türkiye saati) itibaren
--    alınabilir; gelecek bir güne hiç alınamaz. Geçmiş günler her zaman
--    düzeltilebilir. Kural hem panelde hem burada (RLS) uygulanıyor.
--
-- ÖN KOŞUL: rol-hiyerarsisi.sql, yoklama.sql
-- hesaplari-kur.mjs betiğinden ÖNCE çalıştırın.
-- Supabase → SQL Editor'a yapıştırıp çalıştırın.
-- Tekrar çalıştırmak güvenlidir.
-- ============================================================

-- ------------------------------------------------------------
-- 1a) Geçerli roller
-- ------------------------------------------------------------
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('admin', 'vice', 'advisor', 'mentor', 'sistem', 'captain', 'member'));

-- ------------------------------------------------------------
-- 1b) is_admin(): tam yetkili beş rol
--     has_dept_access() ve tüm politikalar bunu çağırdığı için
--     modüller otomatik uyar.
-- ------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('admin', 'vice', 'advisor', 'mentor', 'sistem')
  );
$function$;

-- ------------------------------------------------------------
-- 1c) Yetki yükseltme koruması — tam yetkililer her alanı değiştirir
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

  select (p.role in ('admin', 'vice', 'advisor', 'mentor', 'sistem'))
    into cagiran_yetkili
    from public.profiles p
   where p.id = auth.uid();

  if coalesce(cagiran_yetkili, false) then
    return new;
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

-- ------------------------------------------------------------
-- 1d) İşlem Kayıtları: tam yetkililer + yazılım birimi
-- ------------------------------------------------------------
drop policy if exists audit_select_admin on public.audit_log;
create policy audit_select_admin
  on public.audit_log for select
  to authenticated
  using (
    is_admin()
    or exists (
      select 1 from public.profiles
       where id = auth.uid() and department = 'yazilim'
    )
  );

-- ------------------------------------------------------------
-- 2) Yoklama: bugün 09:50'den önce ve gelecek günler için yazılamaz
-- ------------------------------------------------------------
create or replace function public.yoklama_acik_mi(gun date)
returns boolean
language sql
stable
as $function$
  select gun < (now() at time zone 'Europe/Istanbul')::date
      or (gun = (now() at time zone 'Europe/Istanbul')::date
          and (now() at time zone 'Europe/Istanbul')::time >= time '09:50');
$function$;

drop policy if exists attendance_write on public.attendance;
create policy attendance_write
  on public.attendance for all to authenticated
  using      (is_admin() or is_unit_captain(dept))
  with check ((is_admin() or is_unit_captain(dept)) and yoklama_acik_mi(day));

-- ------------------------------------------------------------
-- KONTROL
--   select pg_get_constraintdef(oid) from pg_constraint
--    where conname = 'profiles_role_check';
--   select role, count(*) from public.profiles group by 1;
-- ------------------------------------------------------------
