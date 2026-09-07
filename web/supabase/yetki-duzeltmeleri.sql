-- ============================================================
-- Yetki düzeltmeleri
--
--   1) Çalışma takvimini birim kaptanları da düzenleyebilsin
--   2) İşlem Kayıtları'nı YALNIZCA takım kaptanı ve yazılım ekibi görsün
--
-- Supabase → SQL Editor'a yapıştırıp çalıştırın.
-- Tekrar çalıştırmak güvenlidir.
--
-- ÖN KOŞUL: rol-hiyerarsisi.sql ve calisma-takvimi.sql çalıştırılmış olmalı
-- (is_admin() ve calendar_days burada kullanılıyor).
-- ============================================================

-- ------------------------------------------------------------
-- 0) Yardımcı: "birim kaptanı mıyım?" (hangi birim olduğuna bakmadan)
--
--    is_unit_captain(dept) belirli bir birimi soruyor. Takvim takım
--    geneli olduğu için burada birimden bağımsız bir kontrol gerekiyor.
-- ------------------------------------------------------------
create or replace function public.is_captain()
returns boolean
language sql
stable security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from public.profiles
     where id = auth.uid() and role = 'captain'
  );
$function$;

-- ------------------------------------------------------------
-- 1) Takvim: kaptan + yardımcı + birim kaptanları
-- ------------------------------------------------------------
drop policy if exists calendar_days_write on public.calendar_days;
create policy calendar_days_write
  on public.calendar_days for all
  to authenticated
  using      (is_admin() or is_captain())
  with check (is_admin() or is_captain());

-- calendar_rules tablosu takvim-kurallari.sql ile geliyor; henüz
-- çalıştırılmadıysa bu blok sessizce atlanır.
do $$
begin
  if to_regclass('public.calendar_rules') is not null then
    drop policy if exists calendar_rules_write on public.calendar_rules;
    create policy calendar_rules_write
      on public.calendar_rules for all
      to authenticated
      using      (is_admin() or is_captain())
      with check (is_admin() or is_captain());
    raise notice 'calendar_rules yazma yetkisi birim kaptanlarına açıldı';
  else
    raise notice 'calendar_rules yok — takvim-kurallari.sql sonrası bu betiği tekrar çalıştırın';
  end if;
end $$;

-- ------------------------------------------------------------
-- 2) İşlem Kayıtları: yalnızca takım kaptanı + yazılım ekibi
--
--    DİKKAT: is_admin() BURADA KULLANILMIYOR. O fonksiyon kaptan
--    yardımcısını da kapsıyor; burada istenen daha dar bir küme —
--    yalnızca role='admin' olan tek kişi ve departmanı 'yazilim'
--    olanlar. Denetim günlüğü teknik bir araç, yönetsel değil.
-- ------------------------------------------------------------
drop policy if exists audit_select_admin on public.audit_log;
create policy audit_select_admin
  on public.audit_log for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
       where id = auth.uid()
         and (role = 'admin' or department = 'yazilim')
    )
  );

-- ------------------------------------------------------------
-- KONTROL
--   select policyname, cmd, qual from pg_policies
--    where schemaname='public'
--      and tablename in ('calendar_days','calendar_rules','audit_log')
--    order by tablename, cmd;
--
-- TEST
--   Birim kaptanıyla takvimde bir gün değiştir -> geçmeli.
--   Kaptan yardımcısıyla /panel/kayitlar aç    -> AÇILMAMALI.
--   Yazılım departmanındaki düz üyeyle aç      -> AÇILMALI.
-- ------------------------------------------------------------
