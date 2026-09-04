-- ============================================================
-- Envanterde son kullanma tarihi (SKT) ve malzeme ömrü takibi
-- Supabase → SQL Editor. Tekrar çalıştırmak güvenlidir.
-- ============================================================

alter table public.stock
  -- Kompozit reçine, yapıştırıcı vb. için son kullanma tarihi
  add column if not exists expiry_date   date,
  -- Parti/lot numarası — tedarikçi takibi için
  add column if not exists batch_no      text,
  -- LiPo bataryalar için şarj döngüsü takibi
  add column if not exists cycle_count   int,
  add column if not exists cycle_limit   int,
  -- Malzeme türü: skt takibi mi, döngü takibi mi, ikisi de değil mi
  add column if not exists tracking      text;

-- tracking için geçerli değerler
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'stock_tracking_check'
  ) then
    alter table public.stock
      add constraint stock_tracking_check
      check (tracking is null or tracking in ('none', 'expiry', 'cycles'));
  end if;
end $$;

-- SKT'si yaklaşanları hızlı bulmak için
create index if not exists stock_expiry_date_idx
  on public.stock (expiry_date)
  where expiry_date is not null;
