-- ============================================================
-- Yoklama — üye başına isteğe bağlı not
--
-- Üç seçenek (geldi / geç geldi / gelmedi) bazı durumları anlatmaya
-- yetmiyor: "gelmedi ama hastaydı", "sınavı vardı, haber verdi" gibi.
-- Birim kaptanı her üyenin yanına kısa bir not yazabilir. Not, satırla
-- aynı kurallara tabi (yoklama.sql): aynı kişiler görür ve yazar.
--
-- ÖN KOŞUL: yoklama.sql
-- Supabase → SQL Editor'a yapıştırıp çalıştırın.
-- Tekrar çalıştırmak güvenlidir.
-- ============================================================

alter table public.attendance
  add column if not exists note text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'attendance_not_uzunluk') then
    alter table public.attendance
      add constraint attendance_not_uzunluk
      check (note is null or char_length(note) <= 300);
  end if;
end $$;
