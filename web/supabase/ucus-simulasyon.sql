-- ============================================================
-- Uçuş kaydı: simülasyon / gerçek ayrımı
--
-- Takım bazı testleri simülasyonda (SITL, X-Plane, Gazebo) yapıyor ve
-- o koşuların verisini de panele yüklüyor. Simülasyon uçuşu gerçek
-- uçuşla aynı listede görünmemeli; istatistikleri de karıştırmamalı.
--
-- Tek bir bayrak yetiyor:
--   is_sim = false -> gerçek uçuş (varsayılan)
--   is_sim = true  -> simülasyon koşusu
--
-- DAVRANIŞ (panel tarafı):
--   Simülasyon uçuşunda "Uç!" düğmesi uçuş öncesi kontrol listesini
--   ATLAR — sahada yapılan fiziksel kontrollerin (pervane, batarya,
--   kontrol yüzeyleri) simülasyonda karşılığı yok.
--
-- Supabase → SQL Editor'a yapıştırıp çalıştırın.
-- Tekrar çalıştırmak güvenlidir.
-- ============================================================

alter table public.flights
  add column if not exists is_sim boolean not null default false;

-- Listeleri türe göre süzmek için
create index if not exists flights_is_sim_idx on public.flights (is_sim);

-- ------------------------------------------------------------
-- KONTROL
--   select is_sim, count(*) from public.flights group by 1;
-- ------------------------------------------------------------
