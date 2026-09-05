-- ============================================================
-- 4/5 — Departman birleştirme: "medya" -> "sponsorluk"
--
-- Medya ve Sponsorluk tek bir alt ekip. Panelde tek seçenek:
-- anahtar "sponsorluk", etiket "Medya & Sponsorluk".
--
-- NEDEN "sponsorluk" TARAFINDA BİRLEŞTİRİYORUZ?
--   sponsors  -> has_dept_access(ARRAY['sponsorluk'])
--   allocations -> has_dept_access(ARRAY['sponsorluk'])
-- Finans erişimi veritabanında bu metne bağlı. Ters yönde birleştirseydik
-- sponsorluk ekibi kendi modülünü göremez hâle gelirdi. Bu yönde ise
-- eski "medya" üyeleri de finansı görür — istenen davranış tam olarak bu.
--
-- ÖN KONTROL SONUÇLARI (05.09.2026'da 'medya' geçen politikalar):
--   media_assets (select/insert/update) -> ARRAY['sponsorluk','medya']
--       Her ikisini de kabul ediyor, migration BUNLARI ETKİLEMEZ.
--   parts (parts_select) -> listede 'medya' var, 'sponsorluk' belirsiz.
--       Bu yüzden aşağıda ek bir SELECT politikası ekliyoruz.
--
-- Supabase → SQL Editor'a yapıştırıp çalıştırın.
-- Tekrar çalıştırmak güvenlidir.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1) parts görüntüleme güvencesi
--
-- Mevcut parts_select politikasına DOKUNMUYORUZ. Politikalar OR'lanır,
-- dolayısıyla bu ek politika yalnızca erişim ekler, asla kaldırmaz.
-- 'sponsorluk' zaten listedeyse bu satır yalnızca gereksiz olur, zararsız.
-- ------------------------------------------------------------
drop policy if exists parts_select_sponsorluk on public.parts;
create policy parts_select_sponsorluk
  on public.parts for select
  to authenticated
  using (has_dept_access(array['sponsorluk']));

-- ------------------------------------------------------------
-- 2) Departman değerlerini taşı
--    Kolon yoksa o satır sessizce atlanır; şema farklıysa hata vermez.
-- ------------------------------------------------------------
do $$
declare
  pair record;
  n    bigint;
begin
  for pair in
    select * from (values
      ('profiles', 'department'),
      ('stock',    'dept'),
      ('tasks',    'dept'),
      ('needs',    'dept'),
      ('parts',    'dept'),
      ('notes',    'dept')
    ) as t(tbl, col)
  loop
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name  = pair.tbl
        and column_name = pair.col
    ) then
      execute format(
        'update public.%I set %I = ''sponsorluk'' where %I = ''medya''',
        pair.tbl, pair.col, pair.col
      );
      get diagnostics n = row_count;
      raise notice '%.% -> % satir guncellendi', pair.tbl, pair.col, n;
    else
      raise notice '%.% yok, atlandi', pair.tbl, pair.col;
    end if;
  end loop;
end $$;

commit;

-- ------------------------------------------------------------
-- SONRA KONTROL — 'medya' kalmamalı:
--   select department, count(*) from public.profiles group by 1 order by 2 desc;
--
-- Ve Medya & Sponsorluk ekibinden biriyle giriş yapıp şunları dene:
--   /panel/sponsorluk   -> açılmalı (finans)
--   /panel/parcalar     -> parçalar görünmeli
--   /panel/materyaller  -> medya dosyaları görünmeli
-- ------------------------------------------------------------
