"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  CheckCheck,
  ClipboardCheck,
  KanbanSquare,
  Mail,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { DEPT_LABELS } from "@/lib/constants";
import { bugunTR } from "@/lib/takvim";
import { eksikYoklamaGunleri, yoklamaSorumlusuMu } from "@/lib/yoklama";

/* ============================================================
   Bildirim zili — panelin sağ üstü

   Bildirimler bir tabloda TUTULMUYOR; her açılışta güncel durumdan
   hesaplanıyor. Sorun çözülünce (yoklama alınınca, görev bitince)
   bildirim kendiliğinden kaybolur, "okundu" işaretlemeye gerek yok.

   Şu an üç kaynak var:
     1. Birim kaptanına: yoklaması alınmamış çalışma günleri
     2. Herkese: kendisine atanmış, son tarihi geçmiş/2 gün içinde
        olan açık görevler
     3. Herkese: Profilim'de bildirim e-postası yoksa hatırlatma
        (kapatılabilir)
   Yeni bir kaynak eklemek = topla() içine bir blok daha.
   ============================================================ */

interface Bildirim {
  id: string;
  ikon: "yoklama" | "gorev" | "eposta";
  baslik: string;
  metin: string;
  href: string;
  ton: "warn" | "bad" | "info";
}

const IKON = {
  yoklama: ClipboardCheck,
  gorev: KanbanSquare,
  eposta: Mail,
} as const;

const TON = {
  warn: "bg-warn/15 text-warn",
  bad: "bg-bad/15 text-bad",
  info: "bg-info/15 text-info",
} as const;

/** Bu sürede bir tazelenir (sekme açık dururken) */
const TAZELEME_MS = 5 * 60 * 1000;
const EPOSTA_KAPAT_ANAHTAR = "aad:bildirim:eposta-kapat";

const gunYaz = (k: string) =>
  new Date(k + "T12:00:00").toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "short",
  });

function gunEkle(k: string, n: number) {
  const d = new Date(k + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function BildirimZili({
  userId,
  role,
  dept,
}: {
  userId: string;
  role: string;
  dept: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const pathname = usePathname();
  const [acik, setAcik] = useState(false);
  const [liste, setListe] = useState<Bildirim[]>([]);
  const kutuRef = useRef<HTMLDivElement>(null);

  const topla = useCallback(async () => {
    const bugun = bugunTR();
    const out: Bildirim[] = [];

    /* 1) Yoklama — birimin yoklama sorumlusuna (kaptan; yoksa birime
          kayıtlı tam yetkili) */
    if (await yoklamaSorumlusuMu(supabase, role, dept)) {
      const eksik = await eksikYoklamaGunleri(supabase, dept, bugun);
      if (eksik.length > 0) {
        const son = eksik[eksik.length - 1];
        out.push({
          id: "yoklama",
          ikon: "yoklama",
          ton: "warn",
          baslik:
            eksik.length === 1
              ? `${gunYaz(son)} yoklamasını al`
              : `${eksik.length} günün yoklaması alınmadı`,
          metin: `${DEPT_LABELS[dept] || dept} · ${eksik
            .slice(-4)
            .map(gunYaz)
            .join(", ")}${eksik.length > 4 ? "…" : ""}`,
          href: `/panel/yoklama/${eksik[0]}`,
        });
      }
    }

    /* 2) Bana atanmış, son tarihi yaklaşan ya da geçen görevler */
    const { data: gorevler } = await supabase
      .from("tasks")
      .select("id, title, deadline, status")
      .eq("assignee_id", userId)
      .neq("status", "done")
      .not("deadline", "is", null)
      .lte("deadline", gunEkle(bugun, 2))
      .order("deadline");
    for (const g of (gorevler as {
      id: string;
      title: string;
      deadline: string;
    }[]) || []) {
      const gecti = g.deadline < bugun;
      out.push({
        id: `gorev-${g.id}`,
        ikon: "gorev",
        ton: gecti ? "bad" : "info",
        baslik: g.title,
        metin: gecti
          ? `Son tarihi geçti (${gunYaz(g.deadline)})`
          : g.deadline === bugun
            ? "Son gün bugün"
            : `Son tarih ${gunYaz(g.deadline)}`,
        href: "/panel/gorevler",
      });
    }

    /* 3) Bildirim e-postası boşsa — kullanıcı kapatabilir */
    let kapali = false;
    try {
      kapali = localStorage.getItem(EPOSTA_KAPAT_ANAHTAR) === "1";
    } catch {
      // storage kapalı: göster
    }
    if (!kapali) {
      const { data: n, error } = await supabase
        .from("notification_prefs")
        .select("email")
        .eq("user_id", userId)
        .maybeSingle();
      // Tablo kurulu değilse (error) bu bildirimi hiç gösterme
      if (!error && !n?.email) {
        out.push({
          id: "eposta",
          ikon: "eposta",
          ton: "info",
          baslik: "Bildirim e-postanı ekle",
          metin: "Hatırlatmalar gerçek e-postana gelsin — Profilim'den bir dakikalık iş.",
          href: "/panel/ayarlar/profil",
        });
      }
    }

    setListe(out);
  }, [supabase, userId, role, dept]);

  /* Sayfa değişince, sekmeye dönünce ve belirli aralıkla tazele */
  useEffect(() => {
    // topla() asenkrondur: setState ağ yanıtından sonra çalışır.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void topla();
  }, [topla, pathname]);

  useEffect(() => {
    const t = setInterval(() => void topla(), TAZELEME_MS);
    const odak = () => void topla();
    window.addEventListener("focus", odak);
    return () => {
      clearInterval(t);
      window.removeEventListener("focus", odak);
    };
  }, [topla]);

  /* Dışarı tıklayınca / Esc ile kapan */
  useEffect(() => {
    if (!acik) return;
    const tikla = (e: MouseEvent) => {
      if (!kutuRef.current?.contains(e.target as Node)) setAcik(false);
    };
    const tus = (e: KeyboardEvent) => e.key === "Escape" && setAcik(false);
    document.addEventListener("mousedown", tikla);
    window.addEventListener("keydown", tus);
    return () => {
      document.removeEventListener("mousedown", tikla);
      window.removeEventListener("keydown", tus);
    };
  }, [acik]);

  function epostaKapat() {
    try {
      localStorage.setItem(EPOSTA_KAPAT_ANAHTAR, "1");
    } catch {
      // yok sayılır
    }
    setListe((v) => v.filter((b) => b.id !== "eposta"));
  }

  const sayi = liste.length;

  return (
    <div ref={kutuRef} className="relative">
      <button
        type="button"
        onClick={() => setAcik((v) => !v)}
        aria-label={sayi ? `Bildirimler (${sayi})` : "Bildirimler"}
        aria-expanded={acik}
        className="relative flex size-9 items-center justify-center rounded-full border border-line bg-bg-1 text-ink-2 transition-colors hover:border-ink-3 hover:text-ink"
      >
        <Bell size={17} />
        {sayi > 0 && (
          <span className="tabular absolute -right-1 -top-1 flex min-w-[18px] items-center justify-center rounded-full bg-accent px-1 text-[10.5px] font-bold leading-[18px] text-white">
            {sayi > 9 ? "9+" : sayi}
          </span>
        )}
      </button>

      {acik && (
        <div className="absolute right-0 top-11 z-50 w-[min(340px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-line bg-bg-1 shadow-[var(--shadow-lg)]">
          <div className="border-b border-line px-4 py-3 text-[13.5px] font-bold text-ink">
            Bildirimler
          </div>
          {sayi === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-8 text-center text-[13px] text-ink-3">
              <CheckCheck size={22} className="text-ok" />
              Bekleyen bir şey yok.
            </div>
          ) : (
            <ul className="max-h-[60vh] divide-y divide-line overflow-y-auto">
              {liste.map((b) => {
                const Ikon = IKON[b.ikon];
                return (
                  <li key={b.id} className="relative">
                    <Link
                      href={b.href}
                      onClick={() => setAcik(false)}
                      className="flex gap-3 px-4 py-3 pr-9 transition-colors hover:bg-bg-2"
                    >
                      <span
                        className={`flex size-8 shrink-0 items-center justify-center rounded-full ${TON[b.ton]}`}
                      >
                        <Ikon size={15} />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-semibold text-ink">
                          {b.baslik}
                        </span>
                        <span className="mt-0.5 block text-[12px] leading-snug text-ink-3">
                          {b.metin}
                        </span>
                      </span>
                    </Link>
                    {b.id === "eposta" && (
                      <button
                        type="button"
                        onClick={epostaKapat}
                        aria-label="Bu hatırlatmayı gösterme"
                        title="Bir daha gösterme"
                        className="absolute right-2 top-3 flex size-6 items-center justify-center rounded-full text-ink-3 hover:bg-bg-3 hover:text-ink"
                      >
                        <X size={13} />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
