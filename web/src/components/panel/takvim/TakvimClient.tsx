"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plane,
  Save,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { trimTo, LIMITS } from "@/lib/security";
import { logAction } from "@/lib/audit";
import { useToast } from "@/components/ui/Toast";
import { Button, Card, Field } from "@/components/ui/Kit";
import { PageHeader } from "@/components/panel/PageHeader";

type Tur = "calisma" | "tatil" | "etkinlik" | "yarisma";

const TUR: Record<Tur, { etiket: string; nokta: string; kutu: string }> = {
  calisma: {
    etiket: "Çalışma",
    nokta: "bg-ok",
    kutu: "border-ok/45 bg-ok/10",
  },
  tatil: {
    etiket: "Çalışma yok",
    nokta: "bg-ink-3",
    kutu: "border-line-2 bg-bg-2",
  },
  etkinlik: {
    etiket: "Etkinlik",
    nokta: "bg-info",
    kutu: "border-info/45 bg-info/10",
  },
  yarisma: {
    etiket: "Yarışma / teslim",
    nokta: "bg-accent",
    kutu: "border-accent/50 bg-accent-soft",
  },
};

interface Gun {
  day: string;
  kind: Tur;
  title: string | null;
  note: string | null;
}

interface UcusIsareti {
  id: string;
  flight_date: string;
  aircraft: string;
  is_sim?: boolean;
}

const AY_ADI = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];
const GUN_KISA = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

/** Yerel saate göre YYYY-MM-DD — toISOString() UTC'ye kaydırıp günü şaşırtır */
function anahtar(y: number, a: number, g: number) {
  return `${y}-${String(a + 1).padStart(2, "0")}-${String(g).padStart(2, "0")}`;
}

export function TakvimClient({ canWrite }: { canWrite: boolean }) {
  const supabase = useMemo(() => createClient(), []);
  const { toast } = useToast();

  /* Gösterilen ay — Date.now() render sırasında çağrılamadığı için
     (react-hooks/purity) ilk değer effect'te belirleniyor. */
  const [yil, setYil] = useState<number | null>(null);
  const [ay, setAy] = useState(0);
  const [bugun, setBugun] = useState<string | null>(null);

  const [gunler, setGunler] = useState<Record<string, Gun>>({});
  const [ucuslar, setUcuslar] = useState<Record<string, UcusIsareti[]>>({});
  const [loading, setLoading] = useState(true);
  const [yok, setYok] = useState(false);

  const [secili, setSecili] = useState<string | null>(null);
  const [tur, setTur] = useState<Tur>("calisma");
  const [baslik, setBaslik] = useState("");
  const [not, setNot] = useState("");
  const [kaydediliyor, setKaydediliyor] = useState(false);

  /* Bugünü bir kez belirle */
  useEffect(() => {
    const d = new Date();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setYil(d.getFullYear());
    setAy(d.getMonth());
    setBugun(anahtar(d.getFullYear(), d.getMonth(), d.getDate()));
  }, []);

  const load = useCallback(async () => {
    if (yil === null) return;
    /* Ayın tamamı + kenarlardaki taşma günleri için geniş aralık */
    const bas = anahtar(yil, ay, 1);
    const sonGun = new Date(yil, ay + 1, 0).getDate();
    const son = anahtar(yil, ay, sonGun);

    const { data, error } = await supabase
      .from("calendar_days")
      .select("day, kind, title, note")
      .gte("day", bas)
      .lte("day", son);

    if (error) {
      setYok(true);
      setLoading(false);
      return;
    }
    setYok(false);
    const m: Record<string, Gun> = {};
    for (const g of (data as Gun[]) || []) m[g.day] = g;
    setGunler(m);

    /* Uçuşlar — salt okunur işaret */
    const { data: uc } = await supabase
      .from("flights")
      .select("id, flight_date, aircraft, is_sim")
      .gte("flight_date", bas)
      .lte("flight_date", son);

    const u: Record<string, UcusIsareti[]> = {};
    for (const f of (uc as UcusIsareti[]) || []) {
      (u[f.flight_date] ||= []).push(f);
    }
    setUcuslar(u);
    setLoading(false);
  }, [supabase, yil, ay]);

  useEffect(() => {
    // load() asenkrondur: setState ağ yanıtından sonra çalışır.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  /* Başkası takvimi değiştirince anında görelim */
  useEffect(() => {
    const ch = supabase
      .channel("takvim-canli")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "calendar_days" },
        () => void load()
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [supabase, load]);

  /* Ayın ızgarası — pazartesi başlangıçlı, 6 satır sabit */
  const izgara = useMemo(() => {
    if (yil === null) return [];
    const ilk = new Date(yil, ay, 1);
    const kaydir = (ilk.getDay() + 6) % 7; // Pazar=0 -> Pazartesi=0
    const sonGun = new Date(yil, ay + 1, 0).getDate();

    const hucreler: { gun: number | null; anahtar: string | null }[] = [];
    for (let i = 0; i < kaydir; i++) hucreler.push({ gun: null, anahtar: null });
    for (let g = 1; g <= sonGun; g++) {
      hucreler.push({ gun: g, anahtar: anahtar(yil, ay, g) });
    }
    while (hucreler.length % 7 !== 0) hucreler.push({ gun: null, anahtar: null });
    return hucreler;
  }, [yil, ay]);

  const sayim = useMemo(() => {
    const c: Record<string, number> = {};
    for (const g of Object.values(gunler)) c[g.kind] = (c[g.kind] || 0) + 1;
    return c;
  }, [gunler]);

  function sec(k: string) {
    setSecili(k);
    const mevcut = gunler[k];
    setTur(mevcut?.kind ?? "calisma");
    setBaslik(mevcut?.title ?? "");
    setNot(mevcut?.note ?? "");
  }

  async function kaydet() {
    if (!secili) return;
    setKaydediliyor(true);
    const { error } = await supabase.from("calendar_days").upsert(
      [
        {
          day: secili,
          kind: tur,
          title: trimTo(baslik, LIMITS.title),
          note: trimTo(not, LIMITS.shortText),
        },
      ],
      { onConflict: "day" }
    );
    setKaydediliyor(false);

    if (error) {
      toast("Kaydedilemedi: " + error.message, "error");
      return;
    }
    void logAction(supabase, "update", "calendar_days", secili, { tur });
    toast("Takvim güncellendi.");
    void load();
  }

  async function sil() {
    if (!secili) return;
    setKaydediliyor(true);
    const { error } = await supabase
      .from("calendar_days")
      .delete()
      .eq("day", secili);
    setKaydediliyor(false);

    if (error) {
      toast("Silinemedi: " + error.message, "error");
      return;
    }
    void logAction(supabase, "delete", "calendar_days", secili, {});
    setBaslik("");
    setNot("");
    toast("Gün kaydı kaldırıldı.");
    void load();
  }

  if (yil === null || loading) {
    return (
      <>
        <PageHeader title="Çalışma Takvimi" />
        <Card className="flex items-center gap-2 p-8 text-sm text-ink-3">
          <Loader2 size={16} className="animate-spin" />
          Yükleniyor…
        </Card>
      </>
    );
  }

  if (yok) {
    return (
      <>
        <PageHeader title="Çalışma Takvimi" />
        <Card className="p-6">
          <div className="flex items-start gap-3">
            <TriangleAlert size={18} className="mt-0.5 shrink-0 text-warn" />
            <div>
              <h2 className="text-[15px] font-semibold text-ink">
                Takvim tablosu hazır değil
              </h2>
              <p className="mt-1 text-sm text-ink-2">
                <code>supabase/calisma-takvimi.sql</code> dosyasını Supabase SQL
                Editor&apos;da çalıştırın.
              </p>
            </div>
          </div>
        </Card>
      </>
    );
  }

  const seciliGun = secili ? gunler[secili] : null;

  return (
    <>
      <PageHeader
        title="Çalışma Takvimi"
        desc="Hangi gün çalışma var, hangi gün yok. Planlanan uçuşlar takvimde işaret olarak görünür."
      >
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              if (ay === 0) {
                setYil(yil - 1);
                setAy(11);
              } else setAy(ay - 1);
              setSecili(null);
            }}
            aria-label="Önceki ay"
            className="flex size-9 items-center justify-center rounded-lg border border-line text-ink-2 transition-colors hover:border-ink-3 hover:text-ink"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="min-w-[132px] text-center text-sm font-semibold text-ink">
            {AY_ADI[ay]} {yil}
          </span>
          <button
            type="button"
            onClick={() => {
              if (ay === 11) {
                setYil(yil + 1);
                setAy(0);
              } else setAy(ay + 1);
              setSecili(null);
            }}
            aria-label="Sonraki ay"
            className="flex size-9 items-center justify-center rounded-lg border border-line text-ink-2 transition-colors hover:border-ink-3 hover:text-ink"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </PageHeader>

      {/* Ay özeti */}
      <div className="mb-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px] text-ink-3">
        {(Object.keys(TUR) as Tur[]).map((t) => (
          <span key={t} className="inline-flex items-center gap-1.5">
            <span className={`size-2 rounded-full ${TUR[t].nokta}`} />
            {TUR[t].etiket}
            {sayim[t] ? (
              <b className="tabular text-ink-2">{sayim[t]}</b>
            ) : null}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <Plane size={12} />
          Planlı uçuş
        </span>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* --- Ay ızgarası --- */}
        <Card className="overflow-hidden p-0">
          <div className="grid grid-cols-7 border-b border-line">
            {GUN_KISA.map((g) => (
              <div
                key={g}
                className="px-2 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider text-ink-3"
              >
                {g}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {izgara.map((h, i) => {
              if (!h.gun || !h.anahtar) {
                return (
                  <div
                    key={`bos-${i}`}
                    className="min-h-[86px] border-b border-r border-line-2/40 bg-bg-2/40 last:border-r-0"
                  />
                );
              }
              const kayit = gunler[h.anahtar];
              const gunUcus = ucuslar[h.anahtar] || [];
              const secliMi = secili === h.anahtar;
              const bugunMu = bugun === h.anahtar;

              return (
                <button
                  key={h.anahtar}
                  type="button"
                  onClick={() => sec(h.anahtar!)}
                  className={`min-h-[86px] border-b border-r border-line-2/40 p-2 text-left transition-colors last:border-r-0 ${
                    kayit ? TUR[kayit.kind].kutu : "hover:bg-bg-2/60"
                  } ${secliMi ? "ring-2 ring-inset ring-accent" : ""}`}
                >
                  <span
                    className={`tabular inline-flex size-6 items-center justify-center rounded-full text-[12.5px] font-semibold ${
                      bugunMu
                        ? "bg-accent text-white"
                        : kayit
                          ? "text-ink"
                          : "text-ink-2"
                    }`}
                  >
                    {h.gun}
                  </span>

                  {kayit?.title && (
                    <span className="mt-1 block truncate text-[11.5px] font-medium text-ink">
                      {kayit.title}
                    </span>
                  )}
                  {kayit && !kayit.title && (
                    <span className="mt-1 block text-[11px] text-ink-3">
                      {TUR[kayit.kind].etiket}
                    </span>
                  )}

                  {gunUcus.length > 0 && (
                    <span className="mt-1.5 flex flex-wrap items-center gap-1">
                      {gunUcus.slice(0, 3).map((f) => (
                        <span
                          key={f.id}
                          title={`${f.aircraft}${f.is_sim ? " (simülasyon)" : ""}`}
                          className={`inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[9.5px] font-semibold ${
                            f.is_sim
                              ? "bg-warn/15 text-warn"
                              : "bg-navy-soft text-navy"
                          }`}
                        >
                          <Plane size={9} />
                          {f.aircraft.slice(0, 6)}
                        </span>
                      ))}
                      {gunUcus.length > 3 && (
                        <span className="text-[9.5px] text-ink-3">
                          +{gunUcus.length - 3}
                        </span>
                      )}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </Card>

        {/* --- Gün düzenleme --- */}
        <Card className="h-max p-5">
          {!secili ? (
            <div className="py-6 text-center">
              <CalendarDays size={26} className="mx-auto text-ink-3" />
              <p className="mt-3 text-[13.5px] text-ink-2">
                Düzenlemek için takvimden bir gün seçin.
              </p>
            </div>
          ) : (
            <>
              <div className="border-b border-line pb-3">
                <div className="eyebrow !text-[10px]">Seçili gün</div>
                <div className="mt-1 text-[15px] font-semibold text-ink">
                  {new Date(secili + "T12:00:00").toLocaleDateString("tr-TR", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                    weekday: "long",
                  })}
                </div>
              </div>

              {/* O günün uçuşları */}
              {(ucuslar[secili] || []).length > 0 && (
                <div className="mt-4 rounded-xl border border-line bg-bg-2 p-3">
                  <div className="eyebrow mb-2 !text-[9.5px]">
                    Planlı uçuşlar
                  </div>
                  <ul className="space-y-1.5">
                    {(ucuslar[secili] || []).map((f) => (
                      <li
                        key={f.id}
                        className="flex items-center gap-2 text-[12.5px] text-ink-2"
                      >
                        <Plane size={12} className="shrink-0 text-ink-3" />
                        {f.aircraft}
                        {f.is_sim && (
                          <span className="text-[11px] text-warn">
                            simülasyon
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/panel/ucuslar"
                    className="mt-2.5 inline-block text-[12px] text-accent hover:underline"
                  >
                    Uçuş kayıtlarına git →
                  </Link>
                </div>
              )}

              {canWrite ? (
                <div className="mt-4 space-y-4">
                  <Field label="Gün türü">
                    <select
                      value={tur}
                      onChange={(e) => setTur(e.target.value as Tur)}
                      className="field"
                    >
                      {(Object.keys(TUR) as Tur[]).map((t) => (
                        <option key={t} value={t}>
                          {TUR[t].etiket}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Başlık" hint="İsteğe bağlı">
                    <input
                      value={baslik}
                      onChange={(e) => setBaslik(e.target.value)}
                      maxLength={LIMITS.title}
                      placeholder="örn. Kompozit kalıp çalışması"
                      className="field"
                    />
                  </Field>

                  <Field label="Not" hint="İsteğe bağlı">
                    <textarea
                      value={not}
                      onChange={(e) => setNot(e.target.value)}
                      rows={3}
                      maxLength={LIMITS.shortText}
                      className="field resize-y"
                    />
                  </Field>

                  <div className="flex items-center gap-2 border-t border-line pt-4">
                    <Button onClick={kaydet} disabled={kaydediliyor}>
                      {kaydediliyor ? (
                        <Loader2 size={15} className="animate-spin" />
                      ) : (
                        <Save size={15} />
                      )}
                      Kaydet
                    </Button>
                    {seciliGun && (
                      <Button
                        variant="ghost"
                        onClick={sil}
                        disabled={kaydediliyor}
                      >
                        <Trash2 size={15} />
                        Kaldır
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="mt-4 space-y-2">
                  {seciliGun ? (
                    <>
                      <div className="text-[13.5px] font-semibold text-ink">
                        {seciliGun.title || TUR[seciliGun.kind].etiket}
                      </div>
                      {seciliGun.note && (
                        <p className="text-[13px] leading-relaxed text-ink-2">
                          {seciliGun.note}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-[13px] text-ink-3">
                      Bu gün için kayıt yok.
                    </p>
                  )}
                  <p className="pt-2 text-[12px] text-ink-3">
                    Takvimi takım kaptanı ve yardımcısı düzenler.
                  </p>
                </div>
              )}
            </>
          )}
        </Card>
      </div>
    </>
  );
}
