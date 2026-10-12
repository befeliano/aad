"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ClipboardCheck, Loader2, TriangleAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { DEPT_KEYS, DEPT_LABELS } from "@/lib/constants";
import {
  YOKLAMA_BASLANGIC,
  YOKLAMA_DURUMLARI,
  YOKLAMA_ETIKET,
  calismaGunleri,
  type GunKaydi,
  type GunKurali,
  type YoklamaDurumu,
} from "@/lib/takvim";
import { useToast } from "@/components/ui/Toast";

interface Uye {
  id: string;
  full_name: string | null;
  username: string | null;
  email: string | null;
}

interface Satir {
  member_id: string;
  status: YoklamaDurumu;
}

const uyeAdi = (u: Uye) =>
  u.full_name?.trim() || u.username?.trim() || u.email?.split("@")[0] || "Üye";

const RENK: Record<YoklamaDurumu, string> = {
  geldi: "border-ok bg-ok text-white",
  gec: "border-warn bg-warn text-white",
  gelmedi: "border-bad bg-bad text-white",
};

/**
 * Seçili günün yoklaması.
 *
 * Birim kaptanı kendi biriminin listesini görür ve her üyeye üç
 * seçenekten birini verir; tıklama anında kaydedilir. Seçili seçeneğe
 * tekrar tıklamak işareti kaldırır (yanlış tıklamayı düzeltmek için).
 * Kaptan/yardımcı birim seçerek her birimin yoklamasını alabilir.
 * Üye yalnızca kendi durumunu görür.
 */
export function YoklamaPaneli({
  gun,
  bugun,
  calismaGunu,
  userId,
  isAdmin,
  role,
  myDept,
  onDegisti,
}: {
  gun: string;
  bugun: string;
  calismaGunu: boolean;
  userId: string;
  isAdmin: boolean;
  role: string;
  myDept: string;
  /** Kayıt değişince — eksik günler uyarısı tazelensin */
  onDegisti?: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const { toast } = useToast();

  const kaptanim = role === "captain" && !!myDept;
  const alabilir = isAdmin || kaptanim;
  const [dept, setDept] = useState<string>(myDept || DEPT_KEYS[0]);
  const [uyeler, setUyeler] = useState<Uye[]>([]);
  const [satirlar, setSatirlar] = useState<Record<string, YoklamaDurumu>>({});
  const [loading, setLoading] = useState(true);
  const [tabloYok, setTabloYok] = useState(false);
  const [kaydedilen, setKaydedilen] = useState<string | null>(null);

  const gelecek = gun > bugun;

  const load = useCallback(async () => {
    setLoading(true);
    if (alabilir) {
      const [{ data: u }, { data: a, error }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, username, email")
          .eq("department", dept),
        supabase
          .from("attendance")
          .select("member_id, status")
          .eq("day", gun)
          .eq("dept", dept),
      ]);
      setTabloYok(!!error);
      setUyeler(
        ((u as Uye[]) || []).sort((x, y) => uyeAdi(x).localeCompare(uyeAdi(y), "tr"))
      );
      const m: Record<string, YoklamaDurumu> = {};
      for (const s of (a as Satir[]) || []) m[s.member_id] = s.status;
      setSatirlar(m);
    } else {
      const { data: a, error } = await supabase
        .from("attendance")
        .select("member_id, status")
        .eq("day", gun)
        .eq("member_id", userId);
      setTabloYok(!!error);
      const m: Record<string, YoklamaDurumu> = {};
      for (const s of (a as Satir[]) || []) m[s.member_id] = s.status;
      setSatirlar(m);
    }
    setLoading(false);
  }, [supabase, alabilir, dept, gun, userId]);

  useEffect(() => {
    // load() asenkrondur: setState ağ yanıtından sonra çalışır.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function isaretle(uyeId: string, durum: YoklamaDurumu) {
    const onceki = satirlar[uyeId];
    const kaldir = onceki === durum;
    setSatirlar((v) => {
      const n = { ...v };
      if (kaldir) delete n[uyeId];
      else n[uyeId] = durum;
      return n;
    });
    setKaydedilen(uyeId);

    const { error } = kaldir
      ? await supabase
          .from("attendance")
          .delete()
          .eq("day", gun)
          .eq("member_id", uyeId)
      : await supabase
          .from("attendance")
          .upsert([{ day: gun, member_id: uyeId, dept, status: durum }], {
            onConflict: "day,member_id",
          });
    setKaydedilen(null);

    if (error) {
      setSatirlar((v) => {
        const n = { ...v };
        if (onceki) n[uyeId] = onceki;
        else delete n[uyeId];
        return n;
      });
      toast("Yoklama kaydedilemedi: " + error.message, "error");
      return;
    }
    onDegisti?.();
  }

  const sayim = useMemo(() => {
    const c: Record<string, number> = {};
    for (const s of Object.values(satirlar)) c[s] = (c[s] || 0) + 1;
    return c;
  }, [satirlar]);

  return (
    <div className="mt-4 rounded-xl border border-line bg-bg-2 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="eyebrow inline-flex items-center gap-1.5 !text-[9.5px]">
          <ClipboardCheck size={11} />
          Yoklama
        </span>
        {isAdmin && (
          <select
            value={dept}
            onChange={(e) => setDept(e.target.value)}
            aria-label="Birim"
            className="field !w-auto !py-1 text-[12px]"
          >
            {DEPT_KEYS.map((k) => (
              <option key={k} value={k}>
                {DEPT_LABELS[k] || k}
              </option>
            ))}
          </select>
        )}
      </div>

      {tabloYok ? (
        <p className="text-[12px] leading-relaxed text-ink-3">
          Yoklama henüz kurulmadı: Supabase SQL Editor&apos;da{" "}
          <code>supabase/yoklama.sql</code> çalıştırılmalı.
        </p>
      ) : gelecek ? (
        <p className="text-[12.5px] text-ink-3">Yoklama gün gelince alınır.</p>
      ) : loading ? (
        <p className="flex items-center gap-2 text-[12.5px] text-ink-3">
          <Loader2 size={13} className="animate-spin" />
          Yükleniyor…
        </p>
      ) : !alabilir ? (
        <p className="text-[13px] text-ink-2">
          {satirlar[userId]
            ? `Bu gün: ${YOKLAMA_ETIKET[satirlar[userId]]}`
            : calismaGunu
              ? "Bu gün için yoklaman henüz girilmemiş."
              : "Bu gün için yoklama yok."}
        </p>
      ) : uyeler.length === 0 ? (
        <p className="text-[12.5px] text-ink-3">
          {DEPT_LABELS[dept] || dept} biriminde kayıtlı üye yok.
        </p>
      ) : (
        <>
          {!calismaGunu && (
            <p className="mb-2 text-[12px] text-ink-3">
              Bu gün takvimde çalışma günü değil; yine de yoklama alabilirsiniz.
            </p>
          )}
          <ul className="space-y-1.5">
            {uyeler.map((u) => (
              <li key={u.id} className="rounded-lg border border-line bg-bg px-2.5 py-2">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="truncate text-[12.5px] font-semibold text-ink">
                    {uyeAdi(u)}
                  </span>
                  {kaydedilen === u.id && (
                    <Loader2 size={12} className="shrink-0 animate-spin text-ink-3" />
                  )}
                </div>
                <div className="grid grid-cols-3 gap-1">
                  {YOKLAMA_DURUMLARI.map((d) => {
                    const secili = satirlar[u.id] === d;
                    return (
                      <button
                        key={d}
                        type="button"
                        aria-pressed={secili}
                        onClick={() => void isaretle(u.id, d)}
                        className={`rounded-md border px-1 py-1 text-[11.5px] font-semibold transition-colors ${
                          secili
                            ? RENK[d]
                            : "border-line text-ink-3 hover:border-ink-3 hover:text-ink"
                        }`}
                      >
                        {YOKLAMA_ETIKET[d]}
                      </button>
                    );
                  })}
                </div>
              </li>
            ))}
          </ul>
          <p className="tabular mt-2 text-[11.5px] text-ink-3">
            {Object.keys(satirlar).length}/{uyeler.length} girildi
            {sayim.geldi ? ` · ${sayim.geldi} geldi` : ""}
            {sayim.gec ? ` · ${sayim.gec} geç` : ""}
            {sayim.gelmedi ? ` · ${sayim.gelmedi} gelmedi` : ""}
          </p>
        </>
      )}
    </div>
  );
}

/**
 * Birim kaptanına: yoklaması alınmamış çalışma günleri.
 * E-posta hatırlatmasıyla aynı hesap (lib/takvim.ts).
 */
export function YoklamaEksikleri({
  bugun,
  myDept,
  onGunSec,
  surum,
}: {
  bugun: string;
  myDept: string;
  onGunSec: (gun: string) => void;
  /** Artınca yeniden hesaplanır (yoklama girildiğinde) */
  surum: number;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [eksik, setEksik] = useState<string[]>([]);

  useEffect(() => {
    let iptal = false;
    void (async () => {
      /* Birim × gün satırları zamanla 1000'i (PostgREST sınırı) aşar */
      const alinan = new Set<string>();
      for (let i = 0; ; i += 1000) {
        const { data, error } = await supabase
          .from("attendance")
          .select("day")
          .eq("dept", myDept)
          .gte("day", YOKLAMA_BASLANGIC)
          .lte("day", bugun)
          .order("day")
          .range(i, i + 999);
        if (iptal || error) return;
        for (const x of (data as { day: string }[]) || []) alinan.add(x.day);
        if (!data || data.length < 1000) break;
      }

      const [{ data: g }, { data: r }, { count }] = await Promise.all([
        supabase
          .from("calendar_days")
          .select("day, kind")
          .gte("day", YOKLAMA_BASLANGIC)
          .lte("day", bugun),
        supabase.from("calendar_rules").select("*").eq("active", true),
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("department", myDept),
      ]);
      if (iptal || !count) return;
      const gunler: Record<string, GunKaydi> = {};
      for (const x of (g as GunKaydi[]) || []) gunler[x.day] = x;
      setEksik(
        calismaGunleri(YOKLAMA_BASLANGIC, bugun, gunler, (r as GunKurali[]) || []).filter(
          (k) => !alinan.has(k)
        )
      );
    })();
    return () => {
      iptal = true;
    };
  }, [supabase, bugun, myDept, surum]);

  if (eksik.length === 0) return null;

  return (
    <div className="mb-5 flex flex-wrap items-start gap-2.5 rounded-2xl border border-warn/30 bg-warn/8 p-4 text-[13px] text-ink-2">
      <TriangleAlert size={16} className="mt-0.5 shrink-0 text-warn" />
      <div className="min-w-0 flex-1">
        <b className="text-ink">
          {DEPT_LABELS[myDept] || myDept} biriminin yoklaması alınmamış gün var.
        </b>{" "}
        Alınana kadar her akşam e-posta ile hatırlatılır.
        <div className="mt-2 flex flex-wrap gap-1.5">
          {eksik.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => onGunSec(k)}
              className="tabular rounded-full border border-warn/40 px-2.5 py-0.5 text-[12px] font-semibold text-warn transition-colors hover:bg-warn hover:text-white"
            >
              {new Date(k + "T12:00:00").toLocaleDateString("tr-TR", {
                day: "numeric",
                month: "short",
                weekday: "short",
              })}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
