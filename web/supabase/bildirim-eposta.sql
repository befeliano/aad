-- ============================================================
-- Bildirim e-postası
--
-- Giriş adresleri çoğunlukla takımın verdiği @aad... adresleri; gerçek
-- kutu değil. Panelden giden her bildirim (ör. yoklama hatırlatması)
-- üyenin Profilim'e yazdığı GERÇEK adrese gider. Boşsa e-posta gitmez,
-- bildirim yalnızca paneldeki zilde görünür.
--
-- NEDEN profiles'ta DEĞİL: profiles tüm takıma açık. Kişisel e-posta
-- yalnızca sahibine (ve kaptan/yardımcıya) görünsün diye ayrı tablo.
-- E-postayı gönderen sunucu tarafı servis anahtarıyla okur.
--
-- ÖN KOŞUL: rol-hiyerarsisi.sql (is_admin)
-- Supabase → SQL Editor'a yapıştırıp çalıştırın.
-- Tekrar çalıştırmak güvenlidir.
-- ============================================================

create table if not exists public.notification_prefs (
  user_id    uuid primary key,          -- FK YOK: auth.users kilidi için
  email      text
             check (email is null
                    or (char_length(email) <= 200
                        and email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')),
  updated_at timestamptz not null default now()
);

create or replace function public.notification_prefs_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists notification_prefs_touch_trg on public.notification_prefs;
create trigger notification_prefs_touch_trg
  before update on public.notification_prefs
  for each row execute function public.notification_prefs_touch();

alter table public.notification_prefs enable row level security;

drop policy if exists notification_prefs_read on public.notification_prefs;
create policy notification_prefs_read
  on public.notification_prefs for select to authenticated
  using (user_id = auth.uid() or is_admin());

drop policy if exists notification_prefs_write on public.notification_prefs;
create policy notification_prefs_write
  on public.notification_prefs for all to authenticated
  using      (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ------------------------------------------------------------
-- KONTROL
--   select p.full_name, n.email
--     from public.notification_prefs n
--     join public.profiles p on p.id = n.user_id;
-- ------------------------------------------------------------
