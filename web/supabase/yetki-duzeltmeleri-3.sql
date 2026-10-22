-- ============================================================
-- Yetki düzeltmeleri — 3 (Ekim 2026, Emin ve Yekta ile konuşulan tablo)
--
--   1) Kaptan yardımcısı ve danışmanlar takım kaptanıyla AYNI yetkide;
--      tek istisna ÜYE YÖNETİMİ: rol ve birim atamayı yalnızca takım
--      kaptanı (admin) ve teknik yönetici hesabı (sistem) yapar.
--   2) İşlem Kayıtları yalnızca tam yetkililere açık; yazılım birimine
--      açık olma kuralı kaldırıldı.
--   3) Kontrol listesi şablonunu birim kaptanları da düzenleyebilir.
--
-- ÖN KOŞUL: roller-danisman.sql, yetki-duzeltmeleri.sql (is_captain)
-- Supabase → SQL Editor'a yapıştırıp çalıştırın.
-- Tekrar çalıştırmak güvenlidir.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Rol / birim / e-posta değişikliği: yalnızca admin ve sistem
--    (servis anahtarı — hesap kurulum betiği — her zaman serbest)
-- ------------------------------------------------------------
create or replace function public.profiles_guard_privilege()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  atayabilir boolean;
begin
  if auth.uid() is null then
    return new;                 -- servis anahtarı: kısıtlama yok
  end if;

  select (p.role in ('admin', 'sistem'))
    into atayabilir
    from public.profiles p
   where p.id = auth.uid();

  if coalesce(atayabilir, false) then
    return new;
  end if;

  if new.role is distinct from old.role then
    raise exception 'Rol atamayı yalnızca takım kaptanı yapabilir.' using errcode = '42501';
  end if;

  if new.department is distinct from old.department then
    raise exception 'Birim atamayı yalnızca takım kaptanı yapabilir.' using errcode = '42501';
  end if;

  if new.email is distinct from old.email then
    raise exception 'E-posta panelden değiştirilemez.' using errcode = '42501';
  end if;

  return new;
end $$;

-- Üye silme de yalnızca admin / sistem.
-- Politikalar VEYA'lanır: eski siteden kalan, adı farklı bir silme
-- politikası is_admin()'e izin veriyorsa yenisi işe yaramaz. Bu yüzden
-- profiles üzerindeki TÜM silme politikaları düşürülüp tek kural kuruluyor.
do $$
declare
  p record;
begin
  for p in select policyname from pg_policies
            where schemaname = 'public' and tablename = 'profiles'
              and cmd = 'DELETE'
  loop
    execute format('drop policy %I on public.profiles', p.policyname);
    raise notice 'silme politikası kaldırıldı: %', p.policyname;
  end loop;
end $$;
create policy profiles_delete_admin
  on public.profiles for delete
  to authenticated
  using (
    exists (select 1 from public.profiles p
             where p.id = auth.uid() and p.role in ('admin', 'sistem'))
  );

-- ------------------------------------------------------------
-- 2) İşlem Kayıtları: yalnızca tam yetkililer
-- ------------------------------------------------------------
drop policy if exists audit_select_admin on public.audit_log;
create policy audit_select_admin
  on public.audit_log for select
  to authenticated
  using (is_admin());

-- ------------------------------------------------------------
-- 3) Kontrol listesi şablonu: tam yetkililer + birim kaptanları
-- ------------------------------------------------------------
drop policy if exists checklist_items_write on public.checklist_items;
create policy checklist_items_write
  on public.checklist_items for all
  to authenticated
  using      (is_admin() or is_captain())
  with check (is_admin() or is_captain());

-- ------------------------------------------------------------
-- KONTROL
--   select policyname, cmd from pg_policies
--    where tablename in ('profiles', 'audit_log', 'checklist_items');
-- ------------------------------------------------------------
