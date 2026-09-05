-- ============================================================
-- 5/5 — Tasarım departmanını veritabanında etkinleştir
--
-- NEDEN GEREKLİ?
-- Uygulama tarafında Tasarım ekibine şu yetkiler verildi:
--   /panel/parcalar   3D parça görüntüleme + yükleme + silme
--   /panel/envanter   envanter
--   /panel/notlar     uçuş notları
-- Ama mevcut RLS politikalarının departman listelerinde 'tasarim' YOK
-- (örn. parts_select -> ARRAY['yazilim','yapisal','kompozit','aviyonik',...]).
-- Bu betik olmadan panelde düğmeler görünür, kayıt ise RLS'e takılır.
--
-- YÖNTEM: Mevcut politikalara DOKUNULMUYOR. Politikalar OR'lanır, bu yüzden
-- aşağıdakiler yalnızca erişim ekler, hiçbir erişimi kaldırmaz.
--
-- Supabase → SQL Editor'a yapıştırıp çalıştırın.
-- Tekrar çalıştırmak güvenlidir.
-- ============================================================

do $$
declare
  t text;
  silme_kosulu text;
begin
  foreach t in array array['parts', 'stock', 'notes']
  loop
    -- Tablo yoksa atla
    if not exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = t
    ) then
      raise notice '% tablosu yok, atlandi', t;
      continue;
    end if;

    -- Okuma
    execute format('drop policy if exists %I on public.%I', t || '_select_tasarim', t);
    execute format(
      'create policy %I on public.%I for select to authenticated
         using (has_dept_access(array[''tasarim'']))',
      t || '_select_tasarim', t
    );

    -- Ekleme
    execute format('drop policy if exists %I on public.%I', t || '_insert_tasarim', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated
         with check (has_dept_access(array[''tasarim'']))',
      t || '_insert_tasarim', t
    );

    -- Güncelleme
    execute format('drop policy if exists %I on public.%I', t || '_update_tasarim', t);
    execute format(
      'create policy %I on public.%I for update to authenticated
         using (has_dept_access(array[''tasarim'']))
         with check (has_dept_access(array[''tasarim'']))',
      t || '_update_tasarim', t
    );

    -- Silme: mevcut sponsors/allocations deseniyle aynı —
    -- yalnızca kendi eklediğini ya da kaptan siler.
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = t and column_name = 'created_by'
    ) then
      silme_kosulu := 'has_dept_access(array[''tasarim'']) and (created_by = auth.uid() or is_admin())';
    else
      silme_kosulu := 'has_dept_access(array[''tasarim'']) and is_admin()';
    end if;

    execute format('drop policy if exists %I on public.%I', t || '_delete_tasarim', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (%s)',
      t || '_delete_tasarim', t, silme_kosulu
    );

    raise notice '% -> tasarim politikalari kuruldu', t;
  end loop;
end $$;

-- ------------------------------------------------------------
-- KONTROL — Tasarım departmanındaki bir üyeyle giriş yapıp:
--   /panel/parcalar  -> parçaları görmeli ve .glb yükleyebilmeli
--   /panel/envanter  -> listeyi görmeli
--   /panel/notlar    -> notları görmeli
--
-- Politikaları görmek için:
--   select tablename, policyname, cmd from pg_policies
--   where schemaname='public' and policyname like '%tasarim%'
--   order by tablename;
-- ------------------------------------------------------------
