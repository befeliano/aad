-- ============================================================
-- Ekim düzeltmeleri (Erdeniz'in listesi)
--
--   1) Yoklama: "Erken ayrıldı" ve "Mazeretli" (hastalık / geçerli
--      mazeret) seçenekleri
--   2) Envanter: birim fiyatın ait olduğu ay (price_period)
--   3) Envanter: üyeler yalnızca kendi biriminin envanterini görür
--      (tam yetkililer ve birim kaptanları hepsini görür)
--   4) Mülakat: formdan gelen telefonu künyeye yaz (telefon sorusunun
--      başlığı uzun olduğu için eşleşmemişti)
--
-- ÖN KOŞUL: yoklama.sql, takvim-notlari.sql (my_dept), roller-danisman.sql
-- Supabase → SQL Editor'a yapıştırıp çalıştırın.
-- Tekrar çalıştırmak güvenlidir.
-- ============================================================

-- 1) Yoklama durumları
alter table public.attendance drop constraint if exists attendance_status_check;
alter table public.attendance
  add constraint attendance_status_check
  check (status in ('geldi', 'gec', 'erken', 'mazeretli', 'gelmedi'));

-- 2) Envanter fiyat tarihi (ayın ilk günü)
alter table public.stock
  add column if not exists price_period date;

-- 3) Envanter görünürlüğü: önce mevcut TÜM okuma politikalarını kaldır
--    (politikalar VEYA'lanır; eski "herkes görür" kuralı kalırsa yenisi
--    işe yaramaz), sonra tek kural kur. Ekleme/silme kuralları değişmez.
do $$
declare
  p record;
begin
  for p in select policyname from pg_policies
            where schemaname = 'public' and tablename = 'stock' and cmd = 'SELECT'
  loop
    execute format('drop policy %I on public.stock', p.policyname);
    raise notice 'stock okuma politikası kaldırıldı: %', p.policyname;
  end loop;
end $$;

create policy stock_read
  on public.stock for select to authenticated
  using (is_admin() or is_captain() or dept = my_dept() or dept = 'ortak');

-- 4) Mülakat telefonları — formdaki "Telefon…" sorusunun cevabından
update public.interviews i
   set phone = left(x.cevap, 40)
  from (
    select id,
           (select e->>'cevap'
              from jsonb_array_elements(form_data) e
             where lower(e->>'soru') like 'telefon%'
             limit 1) as cevap
      from public.interviews
     where source = 'form'
  ) x
 where i.id = x.id
   and i.phone is null
   and x.cevap is not null;

-- KONTROL
--   select count(*) filter (where phone is null) as telefonsuz, count(*)
--     from public.interviews where source = 'form';
