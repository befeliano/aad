-- ============================================================
-- Görev atama yetkileri
--
-- KURAL:
--   Takım Kaptanı (admin) ve Kaptan Yardımcısı (vice)
--     -> her departmanda her şeyi yapar.
--   Birim Kaptanı (captain)
--     -> YALNIZCA kendi departmanının görevlerini açar, düzenler,
--        atar ve siler. Başka birime karışamaz.
--   Üye (member)
--     -> görev açamaz, atayamaz, silemez.
--        Yalnızca KENDİSİNE atanmış görevin DURUMUNU taşıyabilir
--        (yapılacak → yapılıyor → yapıldı).
--
-- NEDEN assignee_id EKLİYORUZ:
--   tasks.assignee bir METİN (görünen ad). RLS'in "bu görev bana mı
--   atanmış" sorusunu ada bakarak cevaplaması kırılgan olur: iki kişi
--   aynı adı taşıyabilir, kişi adını değiştirince bağ kopar. Bu yüzden
--   gerçek kimliği tutan bir kolon ekliyoruz. Metin alan görüntüleme
--   için duruyor.
--
-- Supabase → SQL Editor'a yapıştırıp çalıştırın.
-- Tekrar çalıştırmak güvenlidir.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Atanan kişinin kimliği
-- ------------------------------------------------------------
alter table public.tasks
  add column if not exists assignee_id uuid references auth.users (id) on delete set null;

create index if not exists tasks_assignee_id_idx on public.tasks (assignee_id);

-- Mevcut kayıtları ada göre eşleştir (yalnızca tek eşleşme varsa).
-- Birden fazla kişiye uyan adlar boş bırakılır — elle düzeltilir.
update public.tasks t
   set assignee_id = e.id
  from (
    select p.id,
           coalesce(nullif(btrim(p.full_name), ''),
                    nullif(btrim(p.username), ''),
                    split_part(coalesce(p.email, ''), '@', 1)) as ad
      from public.profiles p
  ) e
 where t.assignee_id is null
   and btrim(coalesce(t.assignee, '')) <> ''
   and lower(btrim(t.assignee)) = lower(e.ad)
   and (
     select count(*) from public.profiles p2
      where lower(coalesce(nullif(btrim(p2.full_name), ''),
                           nullif(btrim(p2.username), ''),
                           split_part(coalesce(p2.email, ''), '@', 1)))
            = lower(btrim(t.assignee))
   ) = 1;

-- ------------------------------------------------------------
-- 2) "Bu departmanın birim kaptanı mıyım?"
-- ------------------------------------------------------------
create or replace function public.is_unit_captain(hedef_dept text)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from public.profiles
     where id = auth.uid()
       and role = 'captain'
       and department is not null
       and department = hedef_dept
  );
$function$;

-- ------------------------------------------------------------
-- 3) Üye koruması — kolon bazlı kısıt
--
--    RLS satır bazlıdır; "sadece status değişsin" kuralını politikayla
--    yazamayız. Bu yüzden tetikleyiciyle koruyoruz.
-- ------------------------------------------------------------
create or replace function public.tasks_guard_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;                       -- servis anahtarı
  end if;

  if public.is_admin() then
    return new;                       -- kaptan ve yardımcısı serbest
  end if;

  if public.is_unit_captain(old.dept) and public.is_unit_captain(new.dept) then
    return new;                       -- kendi birimi içinde serbest
  end if;

  -- Geriye kalan herkes: yalnızca durum ve sıra değişebilir
  if new.dept        is distinct from old.dept
     or new.title    is distinct from old.title
     or new.description is distinct from old.description
     or new.assignee is distinct from old.assignee
     or new.assignee_id is distinct from old.assignee_id
     or new.deadline is distinct from old.deadline
     or new.priority is distinct from old.priority
  then
    raise exception
      'Yalnızca size atanan görevin durumunu değiştirebilirsiniz.'
      using errcode = '42501';
  end if;

  return new;
end $$;

drop trigger if exists tasks_guard_member_trg on public.tasks;
create trigger tasks_guard_member_trg
  before update on public.tasks
  for each row
  execute function public.tasks_guard_member();

-- ------------------------------------------------------------
-- 4) RLS politikaları
--
--    Mevcut politikaları adlarına bakmadan temizliyoruz; kuralı
--    daraltmak istediğimiz için "ekleme" yaklaşımı işe yaramaz
--    (politikalar OR'lanır, eklemek yalnızca genişletir).
--    RLS açık kalıp politika olmadığında erişim KAPALI olur —
--    yani hata durumunda güvenli tarafa düşer.
-- ------------------------------------------------------------
alter table public.tasks enable row level security;

do $$
declare pol record;
begin
  for pol in
    select policyname from pg_policies
     where schemaname = 'public' and tablename = 'tasks'
  loop
    execute format('drop policy if exists %I on public.tasks', pol.policyname);
    raise notice 'eski politika kaldırıldı: %', pol.policyname;
  end loop;
end $$;

-- Görev tablosunu tüm takım görür
create policy tasks_select
  on public.tasks for select
  to authenticated
  using (true);

-- Açma: kaptan/yardımcı her yerde, birim kaptanı kendi biriminde
create policy tasks_insert
  on public.tasks for insert
  to authenticated
  with check (
    public.is_admin() or public.is_unit_captain(dept)
  );

-- Güncelleme: yukarıdakiler + kendine atanmış görevin sahibi.
-- Üyenin yalnızca durumu değiştirebilmesini tetikleyici sağlıyor.
create policy tasks_update
  on public.tasks for update
  to authenticated
  using (
    public.is_admin()
    or public.is_unit_captain(dept)
    or assignee_id = auth.uid()
  )
  with check (
    public.is_admin()
    or public.is_unit_captain(dept)
    or assignee_id = auth.uid()
  );

-- Silme: yalnızca kaptan/yardımcı ve kendi biriminde birim kaptanı
create policy tasks_delete
  on public.tasks for delete
  to authenticated
  using (
    public.is_admin() or public.is_unit_captain(dept)
  );

-- ------------------------------------------------------------
-- KONTROL
--   select policyname, cmd from pg_policies
--    where schemaname='public' and tablename='tasks' order by cmd;
--
--   select assignee, assignee_id from public.tasks
--    where assignee is not null and assignee_id is null;
--     -> adı eşleşmeyenler; panelden yeniden atayın
--
-- TEST
--   Üye hesabıyla: başkasının görevini sürükle -> reddedilmeli.
--   Üye hesabıyla: kendi görevini "yapıldı"ya taşı -> geçmeli.
--   Yazılım birim kaptanıyla: medya görevini sil -> reddedilmeli.
--   Kaptan yardımcısıyla: her şey -> geçmeli.
-- ------------------------------------------------------------
