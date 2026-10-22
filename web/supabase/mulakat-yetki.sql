-- ============================================================
-- Mülakatlar — yetki tablosuna göre daraltma (Ekim 2026)
--
-- mulakat-form.sql mülakatları panele giren HERKESE açmıştı (ilk istek).
-- Emin ve Yekta'nın yetki tablosu:
--   Görüntüleme & puanlama : tam yetkililer + birim kaptanları
--   Silme / reddetme       : tam yetkililer + adayın birim kaptanı
--   Standart üye           : erişemez
--
-- Başvuru formu webhook'u servis anahtarıyla yazdığı için etkilenmez.
--
-- ÖN KOŞUL: mulakat.sql, mulakat-form.sql, roller-danisman.sql,
--           yetki-duzeltmeleri.sql (is_captain)
-- Supabase → SQL Editor'a yapıştırıp çalıştırın.
-- Tekrar çalıştırmak güvenlidir.
-- ============================================================

drop policy if exists interviews_select on public.interviews;
create policy interviews_select
  on public.interviews for select
  to authenticated
  using (is_admin() or is_captain());

drop policy if exists interviews_insert on public.interviews;
create policy interviews_insert
  on public.interviews for insert
  to authenticated
  with check (is_admin() or is_captain());

drop policy if exists interviews_update on public.interviews;
create policy interviews_update
  on public.interviews for update
  to authenticated
  using      (is_admin() or is_captain())
  with check (is_admin() or is_captain());

-- Silme (mulakat.sql'deki kural, tam yetkili kümesi güncel hâliyle)
drop policy if exists interviews_delete on public.interviews;
create policy interviews_delete
  on public.interviews for delete
  to authenticated
  using (is_admin() or is_unit_captain(dept));
