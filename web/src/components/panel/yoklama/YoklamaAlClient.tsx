"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Loader2, TriangleAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { DEPT_KEYS, DEPT_LABELS } from "@/lib/constants";
import {
  YOKLAMA_DURUMLARI,
  YOKLAMA_ETIKET,
  type YoklamaDurumu,
} from "@/lib/takvim";
import {
  YOKLAMA_ACILIS,
  eksikYoklamaGunleri,
  saatTR,
  yoklamaSorumlusuMu,
} from "@/lib/yoklama";
import { useToast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Kit";
import { PageHeader } from "@/components/panel/PageHeader";

interface Uye {
  id: string;
  full_name: string | null;
  username: string | null;
  email: string | null;
}

interface Satir {
  member_id: string;
  status: YoklamaDurumu;
  note: string | null;
}

/** attendance.note üst sınırı — yoklama-not.sql ile aynı */
const NOT_SINIRI = 300;

const uyeAdi = (u: Uye) =>
  u.full_name?.trim() || u.username?.trim() || u.email?.split("@")[0] || "Üye";

const RENK: Record<YoklamaDurumu, string> = {
  geldi: "border-ok bg-ok text-white",
  gec: "border-warn bg-warn text-white",
  gelmedi: "border-bad bg-bad text-white",
};

const gunYaz = (k: string) =>
  new Date(k + "T12:00:00").toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    weekday: "long",
  });

/**
 * Bir günün yoklaması — tam sayfa.
 *
 * Takvimde çalışma gününe tıklayıp "Yoklamayı düzenle" ile gelinir.
 * Birim kaptanı kendi biriminin listesini görür; her üyeye üç seçenekten
 * birini verir (tıklayınca kaydedilir, seçili olana tekrar tıklamak
 * işareti kaldırır) ve isteğe bağlı not yazar ("gelmedi, hastaydı").
 * Tam yetkililer birim seçerek her birimin yoklamasını alabilir.
 * Üye yalnızca kendi durumunu görür.
 */
export function YoklamaAlClient({
  gun,
  userId,
  isAdmin,
  role,
  myDept,
}: {
  gun: string;
  userId: string;
  isAdmin: boolean;
  role: string;
  myDept: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const { toast } = useToast();

  const alabilir = isAdmin || (role === "captain" && !!myDept);
  const [dept, setDept] = useState<string>(myDept || DEPT_KEYS[0]);
  const [uyeler, setUyeler] = useState<Uye[]>([]);
  const [durum, setDurum] = useState<Record<string, YoklamaDurumu>>({});
  /** Sunucudaki notlar ve ekrandaki taslaklar */
  const [notlar, setNotlar] = useState<Record<string, string>>({});
  const [taslak, setTaslak] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [tabloYok, setTabloYok] = useState(false);
  const [kaydedilen, setKaydedilen] = useState<string | null>(null);

  /* Bugün ve saat render'da okunamıyor (react-hooks/purity) */
  const [bugun, setBugun] = useState<string | null>(null);
  const [simdi, setSimdi] = useState<string | null>(null);
  useEffect(() => {
    const tazele = () => {
      const d = new Date();
      setBugun(
        new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(d)
      );
      setSimdi(saatTR(d));
    };
    tazele();
    const t = setInterval(tazele, 30_000);
    return () => clearInterval(t);
  }, []);
  const gelecek = bugun !== null && gun > bugun;
  const henuzKapali =
    bugun === null || (gun === bugun && (simdi === null || simdi < YOKLAMA_ACILIS));

  const load = useCallback(async () => {
    setLoading(true);
    const ekle = (a: Satir[] | null) => {
      const d: Record<string, YoklamaDurumu> = {};
      const n: Record<string, string> = {};
      for (const s of a || []) {
        d[s.member_id] = s.status;
        n[s.member_id] = s.note ?? "";
      }
      setDurum(d);
      setNotlar(n);
      setTaslak(n);
    };
    if (alabilir) {
      const [{ data: u }, { data: a, error }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, username, email").eq("department", dept),
        supabase
          .from("attendance")
          .select("member_id, status, note")
          .eq("day", gun)
          .eq("dept", dept),
      ]);
      setTabloYok(!!error);
      setUyeler(((u as Uye[]) || []).sort((x, y) => uyeAdi(x).localeCompare(uyeAdi(y), "tr")));
      ekle(a as Satir[] | null);
    } else {
      const { data: a, error } = await supabase
        .from("attendance")
        .select("member_id, status, note")
        .eq("day", gun)
        .eq("member_id", userId);
      setTabloYok(!!error);
      ekle(a as Satir[] | null);
    }
    setLoading(false);
  }, [supabase, alabilir, dept, gun, userId]);

  useEffect(() => {
    // load() asenkrondur: setState ağ yanıtından sonra çalışır.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function isaretle(uyeId: string, yeni: YoklamaDurumu) {
    const onceki = durum[uyeId];
    const kaldir = onceki === yeni;
    setDurum((v) => {
      const n = { ...v };
      if (kaldir) delete n[uyeId];
      else n[uyeId] = yeni;
      return n;
    });
    setKaydedilen(uyeId);

    const not = (taslak[uyeId] ?? "").trim().slice(0, NOT_SINIRI) || null;
    const { error } = kaldir
      ? await supabase.from("attendance").delete().eq("day", gun).eq("member_id", uyeId)
      : await supabase
          .from("attendance")
          .upsert([{ day: gun, member_id: uyeId, dept, status: yeni, note: not }], {
            onConflict: "day,member_id",
          });
    setKaydedilen(null);

    if (error) {
      setDurum((v) => {
        const n = { ...v };
        if (onceki) n[uyeId] = onceki;
        else delete n[uyeId];
        return n;
      });
      toast("Yoklama kaydedilemedi: " + error.message, "error");
      return;
    }
    if (kaldir) {
      setNotlar((v) => ({ ...v, [uyeId]: "" }));
      setTaslak((v) => ({ ...v, [uyeId]: "" }));
    } else {
      setNotlar((v) => ({ ...v, [uyeId]: not ?? "" }));
    }
  }

  /** Not, alandan çıkınca kaydedilir (durum seçilmişse) */
  async function notKaydet(uyeId: string) {
    const metin = (taslak[uyeId] ?? "").trim().slice(0, NOT_SINIRI);
    if (metin === (notlar[uyeId] ?? "") || !durum[uyeId]) return;
    setKaydedilen(uyeId);
    const { error } = await supabase
      .from("attendance")
      .update({ note: metin || null })
      .eq("day", gun)
      .eq("member_id", uyeId);
    setKaydedilen(null);
    if (error) {
      toast(
        "Not kaydedilemedi: " +
          error.message +
          (error.message.includes("note") ? " (supabase/yoklama-not.sql çalıştırıldı mı?)" : ""),
        "error"
      );
      return;
    }
    setNotlar((v) => ({ ...v, [uyeId]: metin }));
  }

  const sayim = useMemo(() => {
    const c: Record<string, number> = {};
    for (const s of Object.values(durum)) c[s] = (c[s] || 0) + 1;
    return c;
  }, [durum]);

  return (
    <>
      <Link
        href="/panel/yoklama"
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-3 transition-colors hover:text-ink"
      >
        <ArrowLeft size={15} />
        Yoklama Kayıtları
      </Link>
      <PageHeader title="Yoklama" desc={gunYaz(gun)}>
        {isAdmin && (
          <select
            value={dept}
            onChange={(e) => setDept(e.target.value)}
            aria-label="Birim"
            className="field !w-auto"
          >
            {DEPT_KEYS.map((k) => (
              <option key={k} value={k}>
                {DEPT_LABELS[k] || k}
              </option>
            ))}
          </select>
        )}
      </PageHeader>

      {tabloYok ? (
        <Card className="p-6 text-sm text-ink-2">
          Yoklama henüz kurulmadı: Supabase SQL Editor&apos;da <code>supabase/yoklama.sql</code> ve{" "}
          <code>supabase/yoklama-not.sql</code> çalıştırılmalı.
        </Card>
      ) : gelecek ? (
        <Card className="p-6 text-sm text-ink-3">Yoklama gün gelince alınır.</Card>
      ) : loading || bugun === null ? (
        <Card className="flex items-center gap-2 p-6 text-sm text-ink-3">
          <Loader2 size={15} className="animate-spin" />
          Yükleniyor…
        </Card>
      ) : !alabilir ? (
        <Card className="p-6 text-[14px] text-ink-2">
          {durum[userId] ? (
            <>
              Bu gün: <b className="text-ink">{YOKLAMA_ETIKET[durum[userId]]}</b>
              {notlar[userId] && <span className="text-ink-3"> · {notlar[userId]}</span>}
            </>
          ) : (
            "Bu gün için yoklaman henüz girilmemiş."
          )}
        </Card>
      ) : henuzKapali ? (
        <Card className="p-6 text-sm text-ink-3">
          Bugünün yoklaması {YOKLAMA_ACILIS}&apos;da açılır.
        </Card>
      ) : uyeler.length === 0 ? (
        <Card className="p-6 text-sm text-ink-3">
          {DEPT_LABELS[dept] || dept} biriminde kayıtlı üye yok.
        </Card>
      ) : (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3.5">
            <span className="text-[14px] font-bold text-ink">
              {DEPT_LABELS[dept] || dept}
            </span>
            <span className="tabular text-[12.5px] text-ink-3">
              {Object.keys(durum).length}/{uyeler.length} girildi
              {sayim.geldi ? ` · ${sayim.geldi} geldi` : ""}
              {sayim.gec ? ` · ${sayim.gec} geç` : ""}
              {sayim.gelmedi ? ` · ${sayim.gelmedi} gelmedi` : ""}
            </span>
          </div>
          <ul className="divide-y divide-line">
            {uyeler.map((u) => {
              const secili = durum[u.id];
              const notDegisti = (taslak[u.id] ?? "") !== (notlar[u.id] ?? "");
              return (
                <li
                  key={u.id}
                  className="grid gap-3 px-5 py-3.5 md:grid-cols-[minmax(0,200px)_auto_minmax(0,1fr)] md:items-center"
                >
                  <span className="flex items-center gap-2 text-[14px] font-semibold text-ink">
                    <span className="truncate">{uyeAdi(u)}</span>
                    {kaydedilen === u.id && (
                      <Loader2 size={13} className="shrink-0 animate-spin text-ink-3" />
                    )}
                  </span>
                  <div className="grid grid-cols-3 gap-1.5 md:w-[300px]">
                    {YOKLAMA_DURUMLARI.map((d) => (
                      <button
                        key={d}
                        type="button"
                        aria-pressed={secili === d}
                        onClick={() => void isaretle(u.id, d)}
                        className={`rounded-lg border px-2 py-2 text-[13px] font-semibold transition-colors ${
                          secili === d
                            ? RENK[d]
                            : "border-line text-ink-3 hover:border-ink-3 hover:text-ink"
                        }`}
                      >
                        {YOKLAMA_ETIKET[d]}
                      </button>
                    ))}
                  </div>
                  <div className="relative">
                    <input
                      value={taslak[u.id] ?? ""}
                      onChange={(e) => setTaslak((v) => ({ ...v, [u.id]: e.target.value }))}
                      onBlur={() => void notKaydet(u.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                      }}
                      disabled={!secili}
                      maxLength={NOT_SINIRI}
                      placeholder={secili ? "Not (isteğe bağlı) — örn. hastaydı, haber verdi" : "Önce durum seçin"}
                      aria-label={`${uyeAdi(u)} için not`}
                      className="field !py-2 pr-8 text-[13px] disabled:opacity-55"
                    />
                    {secili && !notDegisti && notlar[u.id] && (
                      <Check size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ok" />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="border-t border-line px-5 py-3 text-[12px] text-ink-3">
            Seçim tıklayınca kaydedilir; seçili olana tekrar tıklamak işareti kaldırır. Not, kutudan
            çıkınca ya da Enter&apos;a basınca kaydedilir.
          </p>
        </Card>
      )}
    </>
  );
}

/**
 * Yoklama sorumlusuna: yoklaması alınmamış çalışma günleri.
 * E-posta hatırlatmasıyla aynı hesap (lib/yoklama.ts).
 */
export function YoklamaEksikleri({
  bugun,
  role,
  myDept,
}: {
  bugun: string;
  role: string;
  myDept: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [eksik, setEksik] = useState<string[]>([]);

  useEffect(() => {
    let iptal = false;
    void (async () => {
      if (!(await yoklamaSorumlusuMu(supabase, role, myDept))) return;
      const g = await eksikYoklamaGunleri(supabase, myDept, bugun);
      if (!iptal) setEksik(g);
    })();
    return () => {
      iptal = true;
    };
  }, [supabase, bugun, role, myDept]);

  if (eksik.length === 0) return null;

  return (
    <div className="mb-5 flex flex-wrap items-start gap-2.5 rounded-2xl border border-warn/30 bg-warn/8 p-4 text-[13px] text-ink-2">
      <TriangleAlert size={16} className="mt-0.5 shrink-0 text-warn" />
      <div className="min-w-0 flex-1">
        <b className="text-ink">
          {DEPT_LABELS[myDept] || myDept} biriminin yoklaması alınmamış gün var.
        </b>{" "}
        Alınana kadar her akşam hatırlatılır.
        <div className="mt-2 flex flex-wrap gap-1.5">
          {eksik.map((k) => (
            <Link
              key={k}
              href={`/panel/yoklama/${k}`}
              className="tabular rounded-full border border-warn/40 px-2.5 py-0.5 text-[12px] font-semibold text-warn transition-colors hover:bg-warn hover:text-white"
            >
              {new Date(k + "T12:00:00").toLocaleDateString("tr-TR", {
                day: "numeric",
                month: "short",
                weekday: "short",
              })}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
