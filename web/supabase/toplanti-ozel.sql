-- ============================================================
-- Toplantı Odası — özel odalar
--
-- İHTİYAÇ: "Özel oda açılsın; özel seçilirse açan kişi kimlerin
-- göreceğini seçsin."
--
--   is_private  false -> herkes görür (eski davranış)
--               true  -> yalnızca açan kişi ve invitees listesindekiler
--   invitees    davet edilen üyelerin kimlikleri
--
-- Gizlilik veritabanında (RLS) uygulanıyor: özel odanın satırı, dolayısıyla
-- Jitsi oda adı, davetli olmayanın tarayıcısına HİÇ gelmez. Realtime da
-- RLS'e uyar. Oda adı zaten tahmin edilemez (aad-<uuid>).
--
-- Aynı anda birden fazla toplantı açık olabilir (ör. bir genel, bir özel).
--
-- ÖN KOŞUL: toplanti.sql ve rol-hiyerarsisi.sql (is_admin()).
-- Supabase → SQL Editor'a yapıştırıp çalıştırın.
-- Tekrar çalıştırmak güvenlidir.
-- ============================================================

alter table public.meetings
  add column if not exists is_private boolean not null default false,
  add column if not exists invitees   uuid[]  not null default '{}';

-- Görme: genel odalar herkese; özel odalar açana ve davetlilere
drop policy if exists meetings_read on public.meetings;
create policy meetings_read
  on public.meetings for select
  to authenticated
  using (
    not is_private
    or started_by = auth.uid()
    or auth.uid() = any (invitees)
  );

-- Bitirme: açan kişi ya da kaptan/yardımcı. Kaptan/yardımcı yalnızca
-- görebildiği odaları bitirebilir (update de select politikasına tabi).
drop policy if exists meetings_update on public.meetings;
create policy meetings_update
  on public.meetings for update
  to authenticated
  using (started_by = auth.uid() or is_admin());

-- ------------------------------------------------------------
-- KONTROL
--   select title, is_private, cardinality(invitees), started_at
--     from public.meetings where ended_at is null;
-- ------------------------------------------------------------
