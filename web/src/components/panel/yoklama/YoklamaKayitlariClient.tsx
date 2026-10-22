"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ClipboardCheck, Download, Loader2, Search, TriangleAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { DEPT_KEYS, DEPT_LABELS } from "@/lib/constants";
import {
  YOKLAMA_BASLANGIC,
  YOKLAMA_DURUMLARI,
  YOKLAMA_ETIKET,
  type YoklamaDurumu,
} from "@/lib/takvim";
import { downloadFile, toCSV } from "@/lib/format";
import { useKaliciFiltre } from "@/lib/useKaliciFiltre";
import { Card, EmptyState } from "@/components/ui/Kit";
import { PageHeader } from "@/components/panel/PageHeader";
import { YoklamaEksikleri } from "./YoklamaAlClient";

interface Kayit {
  day: string;
  member_id: string;
  dept: string;
  status: YoklamaDurumu;
  /** yoklama-not.sql çalıştırılmadıysa gelmez */
  note?: string | null;
}

interface Profil {
  id: string;
  full_name: string | null;
  username: string | null;
  email: string | null;
}

const ROZET: Record<YoklamaDurumu, string> = {
  geldi: "bg-ok/12 text-ok",
  gec: "bg-warn/14 text-warn",
  gelmedi: "bg-bad/12 text-bad",
};

const adOf = (p?: Profil) =>
  p?.full_name?.trim() || p?.username?.trim() || p?.email?.split("@")[0] || "Silinmiş üye";

const gunYaz = (k: string) =>
  new Date(k + "T12:00:00").toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    weekday: "long",
  });

/**
 * Yoklama Kayıtları — birim kaptanlarının aldığı yoklamaların ortak havuzu.
 *
 * Görünürlük RLS'te (yoklama.sql): tam yetkililer tüm birimleri, birim
 * kaptanı kendi birimini, üye yalnızca kendi kayıtlarını görür. Bu ekran
 * gelen ne varsa onu gösterir; ayrı bir yetki kontrolü yapmaz.
 */
export function YoklamaKayitlariClient({
  role,
  myDept,
  isAdmin,
}: {
  role: string;
  myDept: string;
  isAdmin: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  /* Bugün render'da okunamıyor (react-hooks/purity) */
  const [bugun, setBugun] = useState<string | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBugun(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date()));
  }, []);
  const alabilir = isAdmin || (role === "captain" && !!myDept);

  const [kayitlar, setKayitlar] = useState<Kayit[]>([]);
  const [profiller, setProfiller] = useState<Record<string, Profil>>({});
  const [loading, setLoading] = useState(true);
  const [tabloYok, setTabloYok] = useState(false);

  const [gorunum, setGorunum] = useKaliciFiltre<"gun" | "kisi">("yoklama.gorunum", "gun");
  const [birim, setBirim] = useKaliciFiltre("yoklama.birim", "");
  const [q, setQ] = useKaliciFiltre("yoklama.q", "");

  const load = useCallback(async () => {
    /* Sezon boyunca satır sayısı 1000'i (PostgREST sınırı) aşar */
    const tum: Kayit[] = [];
    // note kolonu yoksa (yoklama-not.sql çalıştırılmadıysa) notsuz dene
    let kolonlar = "day, member_id, dept, status, note";
    for (let i = 0; ; i += 1000) {
      let { data, error } = await supabase
        .from("attendance")
        .select(kolonlar)
        .gte("day", YOKLAMA_BASLANGIC)
        .order("day", { ascending: false })
        .range(i, i + 999);
      if (error && kolonlar.includes("note")) {
        kolonlar = "day, member_id, dept, status";
        ({ data, error } = await supabase
          .from("attendance")
          .select(kolonlar)
          .gte("day", YOKLAMA_BASLANGIC)
          .order("day", { ascending: false })
          .range(i, i + 999));
      }
      if (error) {
        setTabloYok(true);
        setLoading(false);
        return;
      }
      tum.push(...((data as unknown as Kayit[]) || []));
      if (!data || data.length < 1000) break;
    }
    const { data: p } = await supabase
      .from("profiles")
      .select("id, full_name, username, email");
    const m: Record<string, Profil> = {};
    for (const x of (p as Profil[]) || []) m[x.id] = x;
    setProfiller(m);
    setKayitlar(tum);
    setTabloYok(false);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    // load() asenkrondur: setState ağ yanıtından sonra çalışır.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const ch = supabase
      .channel("yoklama-kayitlari")
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance" }, () => void load())
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [supabase, load]);

  const filtreli = useMemo(() => {
    const n = q.trim().toLocaleLowerCase("tr");
    return kayitlar.filter((k) => {
      if (birim && k.dept !== birim) return false;
      if (n && !adOf(profiller[k.member_id]).toLocaleLowerCase("tr").includes(n)) return false;
      return true;
    });
  }, [kayitlar, profiller, birim, q]);

  /* Günlere göre: gün → birim → kayıtlar */
  const gunler = useMemo(() => {
    const m = new Map<string, Map<string, Kayit[]>>();
    for (const k of filtreli) {
      if (!m.has(k.day)) m.set(k.day, new Map());
      const g = m.get(k.day)!;
      if (!g.has(k.dept)) g.set(k.dept, []);
      g.get(k.dept)!.push(k);
    }
    return [...m.entries()].map(([gun, b]) => ({
      gun,
      birimler: [...b.entries()]
        .sort((x, y) => DEPT_KEYS.indexOf(x[0] as never) - DEPT_KEYS.indexOf(y[0] as never))
        .map(([dept, liste]) => ({
          dept,
          liste: liste.sort((x, y) =>
            adOf(profiller[x.member_id]).localeCompare(adOf(profiller[y.member_id]), "tr")
          ),
        })),
    }));
  }, [filtreli, profiller]);

  /* Kişilere göre: toplamlar */
  const kisiler = useMemo(() => {
    const m = new Map<string, { id: string; dept: string; c: Record<YoklamaDurumu, number> }>();
    for (const k of filtreli) {
      const e = m.get(k.member_id) ?? { id: k.member_id, dept: k.dept, c: { geldi: 0, gec: 0, gelmedi: 0 } };
      e.c[k.status]++;
      e.dept = k.dept;
      m.set(k.member_id, e);
    }
    return [...m.values()].sort(
      (a, b) =>
        DEPT_KEYS.indexOf(a.dept as never) - DEPT_KEYS.indexOf(b.dept as never) ||
        adOf(profiller[a.id]).localeCompare(adOf(profiller[b.id]), "tr")
    );
  }, [filtreli, profiller]);

  function csvIndir() {
    const csv = toCSV(
      ["Tarih", "Birim", "Ad Soyad", "Durum", "Not"],
      filtreli.map((k) => [
        k.day,
        DEPT_LABELS[k.dept] || k.dept,
        adOf(profiller[k.member_id]),
        YOKLAMA_ETIKET[k.status],
        k.note ?? "",
      ])
    );
    downloadFile(csv, `yoklama-${new Date().toISOString().slice(0, 10)}.csv`, "text/csv;charset=utf-8");
  }

  return (
    <>
      <PageHeader
        title="Yoklama Kayıtları"
        desc="Birim kaptanlarının çalışma günlerinde aldığı yoklamalar. Yoklama 09:50'den itibaren alınır; Çalışma Takvimi'nde güne tıklayıp &quot;Yoklamayı düzenle&quot;ye basın."
      >
        {alabilir && bugun && (
          <Link
            href={`/panel/yoklama/${bugun}`}
            className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-all hover:brightness-110"
          >
            <ClipboardCheck size={15} />
            Bugünün yoklaması
          </Link>
        )}
        <button
          type="button"
          onClick={csvIndir}
          disabled={filtreli.length === 0}
          className="inline-flex items-center gap-2 rounded-full border border-line-2 px-4 py-2.5 text-sm font-semibold text-ink transition-all hover:border-ink-3 disabled:opacity-55"
        >
          <Download size={15} />
          CSV indir
        </button>
      </PageHeader>

      {bugun && myDept && (
        <YoklamaEksikleri bugun={bugun} role={role} myDept={myDept} />
      )}

      {tabloYok ? (
        <Card className="p-6">
          <div className="flex items-start gap-3 text-sm text-ink-2">
            <TriangleAlert size={18} className="mt-0.5 shrink-0 text-warn" />
            Yoklama henüz kurulmadı: Supabase SQL Editor&apos;da <code>supabase/yoklama.sql</code> çalıştırılmalı.
          </div>
        </Card>
      ) : (
        <>
          <Card className="mb-5 flex flex-wrap items-center gap-3 p-4">
            <div className="flex rounded-full border border-line p-0.5" role="tablist">
              {(
                [
                  ["gun", "Günlere göre"],
                  ["kisi", "Kişilere göre"],
                ] as const
              ).map(([k, l]) => (
                <button
                  key={k}
                  type="button"
                  role="tab"
                  aria-selected={gorunum === k}
                  onClick={() => setGorunum(k)}
                  className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
                    gorunum === k ? "bg-accent text-white" : "text-ink-2 hover:text-ink"
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
            <div className="relative min-w-[180px] flex-1">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Üye ara…"
                aria-label="Üye ara"
                className="field !pl-9"
              />
            </div>
            <select
              value={birim}
              onChange={(e) => setBirim(e.target.value)}
              aria-label="Birime göre filtrele"
              className="field !w-auto"
            >
              <option value="">Tüm birimler</option>
              {DEPT_KEYS.map((k) => (
                <option key={k} value={k}>
                  {DEPT_LABELS[k] || k}
                </option>
              ))}
            </select>
          </Card>

          {loading ? (
            <Card className="flex items-center gap-2 p-8 text-sm text-ink-3">
              <Loader2 size={16} className="animate-spin" />
              Yükleniyor…
            </Card>
          ) : filtreli.length === 0 ? (
            <Card className="p-8">
              <EmptyState
                icon={<ClipboardCheck size={28} />}
                title={kayitlar.length === 0 ? "Henüz yoklama alınmadı" : "Sonuç yok"}
                desc={
                  kayitlar.length === 0
                    ? "Birim kaptanları çalışma günlerinde yoklama aldıkça burada birikir."
                    : "Filtreyi değiştirmeyi deneyin."
                }
                action={
                  kayitlar.length === 0 ? (
                    <Link href="/panel/takvim" className="text-sm font-semibold text-accent hover:underline">
                      Çalışma Takvimi&apos;ne git →
                    </Link>
                  ) : undefined
                }
              />
            </Card>
          ) : gorunum === "gun" ? (
            <div className="space-y-5">
              {gunler.map(({ gun, birimler }) => (
                <Card key={gun} title={gunYaz(gun)}>
                  <div className="divide-y divide-line">
                    {birimler.map(({ dept, liste }) => {
                      const c = { geldi: 0, gec: 0, gelmedi: 0 } as Record<YoklamaDurumu, number>;
                      for (const k of liste) c[k.status]++;
                      return (
                        <div key={dept} className="px-5 py-4">
                          <div className="mb-2.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span className="text-[13.5px] font-bold text-ink">
                              {DEPT_LABELS[dept] || dept}
                            </span>
                            <span className="tabular text-[12px] text-ink-3">
                              {YOKLAMA_DURUMLARI.filter((d) => c[d])
                                .map((d) => `${c[d]} ${YOKLAMA_ETIKET[d].toLocaleLowerCase("tr")}`)
                                .join(" · ")}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {liste.map((k) => (
                              <span
                                key={k.member_id}
                                title={`${YOKLAMA_ETIKET[k.status]}${k.note ? " — " + k.note : ""}`}
                                className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${ROZET[k.status]}`}
                              >
                                {adOf(profiller[k.member_id])}
                                {k.status !== "geldi" && ` · ${YOKLAMA_ETIKET[k.status].toLocaleLowerCase("tr")}`}
                                {k.note && (
                                  <span className="font-normal opacity-80"> ({k.note})</span>
                                )}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-[13px]">
                <thead>
                  <tr className="border-b border-line text-[11.5px] font-semibold uppercase tracking-wide text-ink-3">
                    <th className="px-5 py-3">Üye</th>
                    <th className="px-3 py-3">Birim</th>
                    <th className="px-3 py-3 text-right">Geldi</th>
                    <th className="px-3 py-3 text-right">Geç</th>
                    <th className="px-3 py-3 text-right">Gelmedi</th>
                    <th className="px-5 py-3 text-right">Katılım</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {kisiler.map((k) => {
                    const toplam = k.c.geldi + k.c.gec + k.c.gelmedi;
                    const oran = toplam ? Math.round(((k.c.geldi + k.c.gec) / toplam) * 100) : 0;
                    return (
                      <tr key={k.id}>
                        <td className="px-5 py-2.5 font-semibold text-ink">{adOf(profiller[k.id])}</td>
                        <td className="px-3 py-2.5 text-ink-2">{DEPT_LABELS[k.dept] || k.dept}</td>
                        <td className="tabular px-3 py-2.5 text-right text-ok">{k.c.geldi}</td>
                        <td className="tabular px-3 py-2.5 text-right text-warn">{k.c.gec}</td>
                        <td className="tabular px-3 py-2.5 text-right text-bad">{k.c.gelmedi}</td>
                        <td className="tabular px-5 py-2.5 text-right font-semibold text-ink">%{oran}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          )}
        </>
      )}
    </>
  );
}
