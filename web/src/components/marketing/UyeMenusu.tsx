"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, LayoutDashboard, LogOut, UserRound } from "lucide-react";
import { createClientSafe } from "@/lib/supabase/client";

/**
 * Navbar'ın sağ ucu.
 *
 * Oturum İSTEMCİDE okunuyor. Sunucuda `getSession()` çağırmak cookies()
 * kullanmak demek; o da tüm pazarlama sayfalarını dinamik hâle getirir ve
 * statik önbelleği bitirirdi. Giriş yapmış üye artık panele zorlanmıyor,
 * ana sayfada gezinip menüden geçebiliyor.
 */
export function UyeMenusu({ mobil = false }: { mobil?: boolean }) {
  const supabase = useMemo(() => createClientSafe(), []);
  const [ad, setAd] = useState<string | null>(null);
  const [yuklendi, setYuklendi] = useState(false);
  const [acik, setAcik] = useState(false);
  const kutu = useRef<HTMLDivElement>(null);

  /* Supabase yapılandırılmamışsa beklenecek bir oturum yok — bunu
     render sırasında biliyoruz, effect içinde setState gerekmiyor. */
  const biliniyor = yuklendi || !supabase;

  useEffect(() => {
    if (!supabase) return;
    let iptal = false;

    const oku = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (iptal) return;

      if (!user) {
        setAd(null);
        setYuklendi(true);
        return;
      }

      /* İsim profiles'tan; yoksa e-postanın @ öncesi */
      const { data } = await supabase
        .from("profiles")
        .select("full_name, username")
        .eq("id", user.id)
        .maybeSingle();

      if (iptal) return;
      const p = data as { full_name?: string; username?: string } | null;
      setAd(
        p?.full_name?.trim() ||
          p?.username?.trim() ||
          user.email?.split("@")[0] ||
          "Üye"
      );
      setYuklendi(true);
    };

    void oku();

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      void oku();
    });
    return () => {
      iptal = true;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  /* Dışarı tıklayınca kapat */
  useEffect(() => {
    if (!acik) return;
    const onDown = (e: MouseEvent) => {
      if (!kutu.current?.contains(e.target as Node)) setAcik(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setAcik(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [acik]);

  async function cikis() {
    await supabase?.auth.signOut();
    setAd(null);
    setAcik(false);
  }

  /* Oturum belli olana kadar yer tut — düğmenin yanıp sönmesini engeller */
  if (!biliniyor) {
    return mobil ? null : <div className="h-9 w-[104px]" aria-hidden="true" />;
  }

  /* --- Giriş yapılmamış --- */
  if (!ad) {
    return mobil ? (
      <Link
        href="/giris"
        className="mt-2 rounded-lg bg-accent px-3 py-3 text-center text-base font-semibold text-white"
      >
        Takım Girişi
      </Link>
    ) : (
      <Link
        href="/giris"
        className="hidden rounded-full bg-ink px-4 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-90 sm:inline-block"
      >
        Takım Girişi
      </Link>
    );
  }

  /* --- Giriş yapılmış (mobil) --- */
  if (mobil) {
    return (
      <div className="mt-2 flex flex-col gap-1 border-t border-line pt-3">
        <span className="px-3 pb-1 text-[13px] text-ink-3">
          Hoş geldin, <b className="text-ink">{ad}</b>
        </span>
        <Link
          href="/panel"
          className="rounded-lg px-3 py-3 text-base font-medium text-ink-2 hover:bg-bg-2 hover:text-ink"
        >
          Panel
        </Link>
        <Link
          href="/panel/ayarlar/profil"
          className="rounded-lg px-3 py-3 text-base font-medium text-ink-2 hover:bg-bg-2 hover:text-ink"
        >
          Profilim
        </Link>
        <button
          type="button"
          onClick={cikis}
          className="rounded-lg px-3 py-3 text-left text-base font-medium text-bad hover:bg-bad/10"
        >
          Çıkış
        </button>
      </div>
    );
  }

  /* --- Giriş yapılmış (masaüstü) --- */
  return (
    <div ref={kutu} className="relative hidden sm:block">
      <button
        type="button"
        onClick={() => setAcik((v) => !v)}
        aria-expanded={acik}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-full border border-line bg-bg-1 py-1.5 pl-3.5 pr-2.5 text-sm transition-colors hover:border-ink-3"
      >
        <span className="size-1.5 rounded-full bg-ok" />
        <span className="text-ink-3">Hoş geldin,</span>
        <span className="max-w-[130px] truncate font-semibold text-ink">
          {ad}
        </span>
        <ChevronDown
          size={14}
          className={`text-ink-3 transition-transform ${acik ? "rotate-180" : ""}`}
        />
      </button>

      {acik && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+8px)] w-56 overflow-hidden rounded-xl border border-line bg-bg shadow-[var(--shadow)]"
        >
          <Link
            href="/panel"
            role="menuitem"
            onClick={() => setAcik(false)}
            className="flex items-center gap-2.5 px-4 py-3 text-sm text-ink-2 transition-colors hover:bg-bg-2 hover:text-ink"
          >
            <LayoutDashboard size={15} />
            Panel
          </Link>
          <Link
            href="/panel/ayarlar/profil"
            role="menuitem"
            onClick={() => setAcik(false)}
            className="flex items-center gap-2.5 border-t border-line px-4 py-3 text-sm text-ink-2 transition-colors hover:bg-bg-2 hover:text-ink"
          >
            <UserRound size={15} />
            Profilim
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={cikis}
            className="flex w-full items-center gap-2.5 border-t border-line px-4 py-3 text-left text-sm text-bad transition-colors hover:bg-bad/10"
          >
            <LogOut size={15} />
            Çıkış
          </button>
        </div>
      )}
    </div>
  );
}
