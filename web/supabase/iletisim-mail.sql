-- ============================================================
-- İletişim formu → takım e-postası
--
-- SORUN: Sitedeki iletişim formundan gelen mesaj panelde Gelen Kutusu'na
-- düşüyor ama takım mailine (anatoliaaerodesign@gmail.com) gitmiyordu.
--
-- ÇÖZÜM: Google Apps Script (scripts/google-iletisim.gs) 5 dakikada bir
-- /api/iletisim/bildirim'e sorar; mail atılmamış mesajları takım
-- adresine gönderir, sonra "atıldı" diye işaretler. İşaret mail
-- GİTTİKTEN sonra konduğu için yarıda kalan gönderim kaybolmaz,
-- bir sonraki turda yeniden denenir.
--
-- mailed_at: mailin gönderildiği an (boşsa henüz gönderilmedi)
--
-- Supabase → SQL Editor'a yapıştırıp çalıştırın.
-- Tekrar çalıştırmak güvenlidir.
-- ============================================================

alter table public.contact_messages
  add column if not exists mailed_at timestamptz;

-- Kurulumdan önce gelmiş mesajlar zaten panelde görülmüş olabilir;
-- hepsini birden takıma yağdırmamak için şimdiye kadarkileri işaretle.
-- (Eskileri de mail olarak almak isterseniz bu satırı çalıştırmayın.)
update public.contact_messages
   set mailed_at = now()
 where mailed_at is null
   and created_at < now() - interval '1 day';

create index if not exists contact_messages_mailed_idx
  on public.contact_messages (created_at)
  where mailed_at is null;
