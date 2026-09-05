"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Plane, Save, TriangleAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { logAction } from "@/lib/audit";
import { useToast } from "@/components/ui/Toast";
import { fmtDate } from "@/lib/format";

interface Build {
  id: string;
  name: string;
  started_on: string | null;
  target_on: string | null;
  status: string;
  note: string | null;
}

interface Bolum {
  id: string;
  section_key: string;
  label: string;
  percent: number;
  note: string | null;
  updated_at: string;
}

/**
 * Kuşbakışı uçak şeması. Her bölge kendi ilerleme yüzdesiyle doluyor —
 * F1 yayınlarındaki araç göstergesi mantığı, ama hasar değil ilerleme.
 *
 * Çizim sabit: bir sabit kanat + V kuyruk planformu. Bölge anahtarları
 * veritabanındaki section_key ile birebir eşleşiyor; veritabanında olmayan
 * bir anahtar çizimde gri kalır, çizimde olmayan bir anahtar listede görünür.
 */
const CIZIM: Record<string, { d: string; etiket: [number, number] }> = {
  itki: {
    d: "M210 30 C218 30 224 24 224 17 C224 10 218 5 210 5 C202 5 196 10 196 17 C196 24 202 30 210 30 Z M176 17 a34 6 0 1 0 68 0 a34 6 0 1 0 -68 0 Z",
    etiket: [210, 46],
  },
  govde: {
    d: "M210 32 C224 56 232 94 232 142 L232 238 C232 254 223 264 210 270 C197 264 188 254 188 238 L188 142 C188 94 196 56 210 32 Z",
    etiket: [210, 150],
  },
  sol_kanat: {
    d: "M188 124 L34 148 L27 160 L188 172 Z",
    etiket: [104, 152],
  },
  sag_kanat: {
    d: "M232 124 L386 148 L393 160 L232 172 Z",
    etiket: [316, 152],
  },
  kuyruk: {
    d: "M197 240 L119 284 L127 294 L205 260 Z M223 240 L301 284 L293 294 L215 260 Z",
    etiket: [210, 292],
  },
  aviyonik: {
    d: "M197 72 h26 a4 4 0 0 1 4 4 v34 a4 4 0 0 1 -4 4 h-26 a4 4 0 0 1 -4 -4 v-34 a4 4 0 0 1 4 -4 Z",
    etiket: [210, 95],
  },
  yuk: {
    d: "M195 186 h30 a4 4 0 0 1 4 4 v38 a4 4 0 0 1 -4 4 h-30 a4 4 0 0 1 -4 -4 v-38 a4 4 0 0 1 4 -4 Z",
    etiket: [210, 210],
  },
  inis_takimi: {
    d: "M210 118 m-7 0 a7 7 0 1 0 14 0 a7 7 0 1 0 -14 0 Z M162 190 m-8 0 a8 8 0 1 0 16 0 a8 8 0 1 0 -16 0 Z M258 190 m-8 0 a8 8 0 1 0 16 0 a8 8 0 1 0 -16 0 Z",
    etiket: [162, 214],
  },
};

/** Yüzdeye göre dolgu — 0 nötr, arada kırmızı tonu koyulaşır, 100 yeşil */
function dolgu(p: number) {
  if (p >= 100) return { fill: "var(--ok)", opacity: 0.32, stroke: "var(--ok)" };
  if (p <= 0)
    return { fill: "var(--bg-3)", opacity: 1, stroke: "var(--line-2)" };
  return {
    fill: "var(--accent)",
    opacity: 0.12 + (p / 100) * 0.42,
    stroke: "var(--accent)",
  };
}

export function UcakDurumu({ canWrite }: { canWrite: boolean }) {
  const supabase = useMemo(() => createClient(), []);
  const { toast } = useToast();

  const [build, setBuild] = useState<Build | null>(null);
  const [bolumler, setBolumler] = useState<Bolum[]>([]);
  const [loading, setLoading] = useState(true);
  const [yok, setYok] = useState(false);
  const [secili, setSecili] = useState<string | null>(null);
  const [taslak, setTaslak] = useState<number | null>(null);
  const [kaydediliyor, setKaydediliyor] = useState(false);
  /* Kaçıncı gün — Date.now() render sırasında çağrılamadığı için
     (react-hooks/purity) veri yüklenirken bir kez hesaplanıyor. */
  const [gun, setGun] = useState<number | null>(null);

  const load = useCallback(async () => {
    const { data: b, error } = await supabase
      .from("aircraft_builds")
      .select("id, name, started_on, target_on, status, note")
      .eq("is_current", true)
      .maybeSingle();

    if (error) {
      setYok(true);
      setLoading(false);
      return;
    }
    setYok(false);
    const yapim = (b as Build) ?? null;
    setBuild(yapim);

    if (yapim?.started_on) {
      const bas = Date.parse(yapim.started_on);
      setGun(
        Number.isFinite(bas)
          ? Math.max(0, Math.floor((Date.now() - bas) / 86400000))
          : null
      );
    } else {
      setGun(null);
    }

    if (b) {
      const { data: s } = await supabase
        .from("aircraft_sections")
        .select("id, section_key, label, percent, note, updated_at")
        .eq("build_id", (b as Build).id)
        .order("label");
      setBolumler((s as Bolum[]) || []);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    // load() asenkrondur: setState ağ yanıtından sonra çalışır.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const genel = useMemo(() => {
    if (!bolumler.length) return 0;
    return Math.round(
      bolumler.reduce((t, b) => t + b.percent, 0) / bolumler.length
    );
  }, [bolumler]);

  const seciliBolum = bolumler.find((b) => b.section_key === secili) ?? null;

  async function kaydet() {
    if (!seciliBolum || taslak === null) return;
    const deger = Math.min(100, Math.max(0, Math.round(taslak)));
    setKaydediliyor(true);
    const { error } = await supabase
      .from("aircraft_sections")
      .update({ percent: deger })
      .eq("id", seciliBolum.id);
    setKaydediliyor(false);

    if (error) {
      toast("Güncellenemedi: " + error.message, "error");
      return;
    }
    void logAction(supabase, "update", "aircraft_sections", seciliBolum.id, {
      bolum: seciliBolum.label,
      yuzde: deger,
    });
    setBolumler((v) =>
      v.map((b) => (b.id === seciliBolum.id ? { ...b, percent: deger } : b))
    );
    setTaslak(null);
    toast(`${seciliBolum.label}: %${deger}`);
  }

  if (loading) {
    return (
      <div className="mt-8 flex items-center gap-2 rounded-2xl border border-line bg-bg-1 p-8 text-sm text-ink-3">
        <Loader2 size={16} className="animate-spin" />
        Uçak durumu yükleniyor…
      </div>
    );
  }

  if (yok || !build) {
    return (
      <div className="mt-8 rounded-2xl border border-warn/30 bg-warn/8 p-6">
        <div className="flex items-start gap-3">
          <TriangleAlert size={18} className="mt-0.5 shrink-0 text-warn" />
          <div>
            <h2 className="text-[15px] font-semibold text-ink">
              Uçak durumu tablosu hazır değil
            </h2>
            <p className="mt-1 text-sm text-ink-2">
              <code>supabase/ucak-ilerleme.sql</code> dosyasını Supabase SQL
              Editor&apos;da çalıştırın; DABAN kaydı ve sekiz bölge otomatik
              oluşur.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <section className="mt-8 overflow-hidden rounded-2xl border border-line bg-bg-1">
      {/* Başlık */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line px-6 py-5 sm:px-8">
        <div>
          <div className="eyebrow !text-[10px]">Yapımdaki platform</div>
          <h2 className="display-tight mt-1.5 text-3xl text-ink">
            {build.name}
          </h2>
          <p className="mt-1.5 text-[13px] text-ink-3">
            {build.started_on && <>Başlangıç {fmtDate(build.started_on)}</>}
            {gun !== null && <> · {gun}. gün</>}
            {build.target_on && <> · Hedef {fmtDate(build.target_on)}</>}
          </p>
        </div>
        <div className="text-right">
          <div className="display tabular text-4xl text-accent">%{genel}</div>
          <div className="eyebrow mt-0.5 !text-[9.5px]">Genel ilerleme</div>
        </div>
      </div>

      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* --- Şema --- */}
        <div className="border-b border-line p-4 sm:p-6 lg:border-b-0 lg:border-r">
          <svg
            viewBox="0 0 420 310"
            className="mx-auto block h-auto w-full max-w-[440px]"
            role="img"
            aria-label={`${build.name} yapım ilerlemesi şeması`}
          >
            {Object.entries(CIZIM).map(([key, cz]) => {
              const b = bolumler.find((x) => x.section_key === key);
              const p = b?.percent ?? 0;
              const st = dolgu(p);
              const aktif = secili === key;
              return (
                <g
                  key={key}
                  onClick={() => {
                    setSecili(aktif ? null : key);
                    setTaslak(null);
                  }}
                  style={{ cursor: b ? "pointer" : "default" }}
                >
                  <path
                    d={cz.d}
                    fill={st.fill}
                    fillOpacity={st.opacity}
                    stroke={aktif ? "var(--ink)" : st.stroke}
                    strokeWidth={aktif ? 2.4 : 1.4}
                    strokeLinejoin="round"
                  />
                  {b && (
                    <text
                      x={cz.etiket[0]}
                      y={cz.etiket[1]}
                      textAnchor="middle"
                      fontSize="13"
                      fontWeight="700"
                      fill="var(--ink)"
                      style={{ fontVariantNumeric: "tabular-nums" }}
                    >
                      %{p}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          <p className="mt-3 text-center text-[12px] text-ink-3">
            Bir bölgeye tıklayarak detayını açın
            {canWrite ? " ve yüzdesini güncelleyin." : "."}
          </p>
        </div>

        {/* --- Bölüm listesi --- */}
        <div className="p-4 sm:p-6">
          <ul className="space-y-2.5">
            {bolumler.map((b) => {
              const aktif = secili === b.section_key;
              return (
                <li key={b.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSecili(aktif ? null : b.section_key);
                      setTaslak(null);
                    }}
                    className={`w-full rounded-lg border p-2.5 text-left transition-colors ${
                      aktif
                        ? "border-accent bg-accent-soft"
                        : "border-transparent hover:border-line"
                    }`}
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[13.5px] font-medium text-ink">
                        {b.label}
                      </span>
                      <span className="tabular text-[13px] font-bold text-ink-2">
                        %{b.percent}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-bg-3">
                      <div
                        className={`h-full rounded-full transition-all ${
                          b.percent >= 100 ? "bg-ok" : "bg-accent"
                        }`}
                        style={{ width: `${b.percent}%` }}
                      />
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>

          {/* Seçili bölümün düzenlemesi */}
          {seciliBolum && canWrite && (
            <div className="mt-4 rounded-xl border border-line bg-bg p-3.5">
              <div className="text-[12.5px] font-semibold text-ink">
                {seciliBolum.label}
              </div>
              <div className="mt-2.5 flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={taslak ?? seciliBolum.percent}
                  onChange={(e) => setTaslak(Number(e.target.value))}
                  className="flex-1 accent-[var(--accent)]"
                  aria-label={`${seciliBolum.label} yüzdesi`}
                />
                <span className="tabular w-12 text-right text-[13px] font-bold text-ink">
                  %{taslak ?? seciliBolum.percent}
                </span>
              </div>
              <button
                type="button"
                onClick={kaydet}
                disabled={
                  kaydediliyor ||
                  taslak === null ||
                  taslak === seciliBolum.percent
                }
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-[12.5px] font-semibold text-white transition-opacity disabled:opacity-45"
              >
                {kaydediliyor ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Save size={13} />
                )}
                Kaydet
              </button>
            </div>
          )}

          {seciliBolum && !canWrite && (
            <p className="mt-4 flex items-start gap-2 text-[12.5px] text-ink-3">
              <Plane size={13} className="mt-0.5 shrink-0" />
              Yüzdeleri teknik departmanlar günceller.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
