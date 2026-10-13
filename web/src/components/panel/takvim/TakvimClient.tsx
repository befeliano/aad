"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plane,
  Repeat,
  Save,
  Trash2,
  TriangleAlert,
  ListTodo,
  Plus,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { trimTo, LIMITS } from "@/lib/security";
import { logAction } from "@/lib/audit";
import { useToast } from "@/components/ui/Toast";
import { Button, Card, Field, Modal } from "@/components/ui/Kit";
import { PageHeader } from "@/components/panel/PageHeader";
import { DEPT_KEYS, DEPT_LABELS } from "@/lib/constants";
import { YoklamaEksikleri, YoklamaPaneli } from "./YoklamaPaneli";

const IS_DEPTS = [...DEPT_KEYS, "ortak"] as const;

type Tur = "calisma" | "tatil" | "etkinlik" | "yarisma";

const TUR: Record<Tur, { etiket: string; nokta: string; kutu: string }> = {
  calisma: { etiket: "Çalışma", nokta: "bg-ok", kutu: "border-ok/45 bg-ok/10" },
  tatil: { etiket: "Çalışma yok", nokta: "bg-ink-3", kutu: "border-line-2 bg-bg-2" },
  etkinlik: { etiket: "Etkinlik", nokta: "bg-info", kutu: "border-info/45 bg-info/10" },
  yarisma: { etiket: "Yarışma / teslim", nokta: "bg-accent", kutu: "border-accent/50 bg-accent-soft" },
};

interface Gun {
  day: string;
  kind: Tur;
  title: string | null;
  note: string | null;
  starts_at: string | null;
  ends_at: string | null;
}

interface Kural {
  id: string;
  weekdays: number[];
  kind: Tur;
  starts_at: string;
  ends_at: string;
  valid_from: string;
  valid_to: string | null;
  title: string | null;
  note: string | null;
  active: boolean;
}

interface Is {
  id: string;
  title: string;
  note: string | null;
  dept: string;
  starts_on: string;
  ends_on: string;
  status: "planli" | "devam" | "bitti";
}

const IS_DURUM: Record<Is["status"], { etiket: string; sinif: string }> = {
  planli: { etiket: "Planlı", sinif: "bg-info/20 text-info border-info/40" },
  devam: { etiket: "Devam ediyor", sinif: "bg-accent/20 text-accent border-accent/45" },
  bitti: { etiket: "Bitti", sinif: "bg-ok/20 text-ok border-ok/40" },
};

interface UcusIsareti {
  id: string;
  flight_date: string;
  aircraft: string;
  is_sim?: boolean;
}

/** Ekranda gösterilen birleşik gün — kuraldan mı elle mi geldiği belli */
interface EtkinGun {
  kind: Tur;
  title: string | null;
  starts_at: string | null;
  ends_at: string | null;
  note: string | null;
  kaynak: "gun" | "kural";
}

const AY_ADI = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];
/** ISO sırası: 1=Pazartesi … 7=Pazar */
const GUN_KISA = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

/** Yerel saate göre YYYY-MM-DD — toISOString() UTC'ye kaydırıp günü şaşırtır */
function anahtar(y: number, a: number, g: number) {
  return `${y}-${String(a + 1).padStart(2, "0")}-${String(g).padStart(2, "0")}`;
}
/** "10:00:00" -> "10:00" */
const saat = (t: string | null) => (t ? t.slice(0, 5) : null);

export function TakvimClient({
  canWrite,
  userId,
  isAdmin,
  role,
  myDept,
}: {
  canWrite: boolean;
  userId: string;
  isAdmin: boolean;
  role: string;
  myDept: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const { toast } = useToast();
  /** Yoklama girildikçe "eksik günler" uyarısı tazelensin */
  const [yoklamaSurum, setYoklamaSurum] = useState(0);
  /** Başka aydaki bir güne atlanınca o ay yüklenince seçilecek gün */
  const [bekleyenGun, setBekleyenGun] = useState<string | null>(null);
  /** Verisi yüklenmiş ay ("2026-9") — bekleyen seçim için */
  const [yukluAy, setYukluAy] = useState<string | null>(null);

  /* Date.now() render sırasında çağrılamadığı için (react-hooks/purity)
     bugün ve açılış ayı effect'te belirleniyor. */
  const [yil, setYil] = useState<number | null>(null);
  const [ay, setAy] = useState(0);
  const [bugun, setBugun] = useState<string | null>(null);

  const [gunler, setGunler] = useState<Record<string, Gun>>({});
  const [kurallar, setKurallar] = useState<Kural[]>([]);
  const [ucuslar, setUcuslar] = useState<Record<string, UcusIsareti[]>>({});
  const [loading, setLoading] = useState(true);
  const [yok, setYok] = useState(false);
  const [kuralTabloYok, setKuralTabloYok] = useState(false);

  const [secili, setSecili] = useState<string | null>(null);
  const [tur, setTur] = useState<Tur>("calisma");
  const [baslik, setBaslik] = useState("");
  const [not, setNot] = useState("");
  const [bas, setBas] = useState("");
  const [bit, setBit] = useState("");
  const [kaydediliyor, setKaydediliyor] = useState(false);

  const [kurallarAcik, setKurallarAcik] = useState(false);
  const [isler, setIsler] = useState<Is[]>([]);
  const [isTabloYok, setIsTabloYok] = useState(false);
  const [isFormAcik, setIsFormAcik] = useState(false);
  const [duzenlenenIs, setDuzenlenenIs] = useState<Is | null>(null);

  useEffect(() => {
    const d = new Date();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBugun(anahtar(d.getFullYear(), d.getMonth(), d.getDate()));
    /* Bildirim zilinden gelindiyse (?gun=2026-10-17) o günü aç */
    const istenen = new URLSearchParams(window.location.search).get("gun");
    if (istenen && /^\d{4}-\d{2}-\d{2}$/.test(istenen)) {
      const [y, a] = istenen.split("-").map(Number);
      setYil(y);
      setAy(a - 1);
      setBekleyenGun(istenen);
    } else {
      setYil(d.getFullYear());
      setAy(d.getMonth());
    }
  }, []);

  const load = useCallback(async () => {
    if (yil === null) return;
    const ilkGun = anahtar(yil, ay, 1);
    const sonGunNo = new Date(yil, ay + 1, 0).getDate();
    const sonGun = anahtar(yil, ay, sonGunNo);

    const { data, error } = await supabase
      .from("calendar_days")
      .select("day, kind, title, note, starts_at, ends_at")
      .gte("day", ilkGun)
      .lte("day", sonGun);

    if (error) {
      setYok(true);
      setLoading(false);
      return;
    }
    setYok(false);
    const m: Record<string, Gun> = {};
    for (const g of (data as Gun[]) || []) m[g.day] = g;
    setGunler(m);

    /* Kurallar — bu ayla kesişenler */
    const { data: kr, error: kErr } = await supabase
      .from("calendar_rules")
      .select("*")
      .eq("active", true)
      .lte("valid_from", sonGun)
      .or(`valid_to.is.null,valid_to.gte.${ilkGun}`);

    if (kErr) {
      setKuralTabloYok(true);
      setKurallar([]);
    } else {
      setKuralTabloYok(false);
      setKurallar((kr as Kural[]) || []);
    }

    /* Çok günlü işler — bu ayla kesişenler */
    const { data: isVeri, error: isErr } = await supabase
      .from("calendar_tasks")
      .select("*")
      .lte("starts_on", sonGun)
      .gte("ends_on", ilkGun)
      .order("starts_on");

    if (isErr) {
      setIsTabloYok(true);
      setIsler([]);
    } else {
      setIsTabloYok(false);
      setIsler((isVeri as Is[]) || []);
    }

    /* Uçuşlar — salt okunur işaret */
    const { data: uc } = await supabase
      .from("flights")
      .select("id, flight_date, aircraft, is_sim")
      .gte("flight_date", ilkGun)
      .lte("flight_date", sonGun);

    const u: Record<string, UcusIsareti[]> = {};
    for (const f of (uc as UcusIsareti[]) || []) {
      (u[f.flight_date] ||= []).push(f);
    }
    setUcuslar(u);
    setYukluAy(`${yil}-${ay}`);
    setLoading(false);
  }, [supabase, yil, ay]);

  useEffect(() => {
    // load() asenkrondur: setState ağ yanıtından sonra çalışır.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  useEffect(() => {
    const ch = supabase
      .channel("takvim-canli")
      .on("postgres_changes", { event: "*", schema: "public", table: "calendar_days" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "calendar_rules" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "calendar_tasks" }, () => void load())
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [supabase, load]);

  /**
   * Bir günün nihai hâli.
   *
   * ÖNCELİK: elle girilmiş gün kaydı kuralı EZER. Böylece "her cumartesi
   * çalışma" kuralı dururken tek bir cumartesiyi "çalışma yok" yapabilirsin.
   */
  const etkinGun = useCallback(
    (k: string): EtkinGun | null => {
      const elle = gunler[k];
      if (elle) {
        return {
          kind: elle.kind,
          title: elle.title,
          note: elle.note,
          starts_at: elle.starts_at,
          ends_at: elle.ends_at,
          kaynak: "gun",
        };
      }
      const d = new Date(k + "T12:00:00");
      const iso = d.getDay() === 0 ? 7 : d.getDay();
      const kural = kurallar.find(
        (r) =>
          r.weekdays.includes(iso) &&
          k >= r.valid_from &&
          (!r.valid_to || k <= r.valid_to)
      );
      if (!kural) return null;
      return {
        kind: kural.kind,
        title: kural.title,
        note: kural.note,
        starts_at: kural.starts_at,
        ends_at: kural.ends_at,
        kaynak: "kural",
      };
    },
    [gunler, kurallar]
  );

  /** O güne denk gelen çok günlü işler */
  const gununIsleri = useCallback(
    (k: string) => isler.filter((i) => k >= i.starts_on && k <= i.ends_on),
    [isler]
  );

  const izgara = useMemo(() => {
    if (yil === null) return [];
    const ilk = new Date(yil, ay, 1);
    const kaydir = (ilk.getDay() + 6) % 7; // Pazartesi başlangıç
    const sonGunNo = new Date(yil, ay + 1, 0).getDate();
    const h: { gun: number | null; k: string | null }[] = [];
    for (let i = 0; i < kaydir; i++) h.push({ gun: null, k: null });
    for (let g = 1; g <= sonGunNo; g++) h.push({ gun: g, k: anahtar(yil, ay, g) });
    while (h.length % 7 !== 0) h.push({ gun: null, k: null });
    return h;
  }, [yil, ay]);

  const sayim = useMemo(() => {
    const c: Record<string, number> = {};
    for (const h of izgara) {
      if (!h.k) continue;
      const e = etkinGun(h.k);
      if (e) c[e.kind] = (c[e.kind] || 0) + 1;
    }
    return c;
  }, [izgara, etkinGun]);

  function sec(k: string) {
    setSecili(k);
    const e = etkinGun(k);
    const elle = gunler[k];
    setTur(e?.kind ?? "calisma");
    setBaslik(elle?.title ?? "");
    setNot(elle?.note ?? "");
    setBas(saat(elle?.starts_at ?? e?.starts_at ?? null) ?? "");
    setBit(saat(elle?.ends_at ?? e?.ends_at ?? null) ?? "");
  }

  /* Uyarıdaki bir güne tıklanınca: ayı değiştir, veri gelince günü seç */
  function gunAtla(k: string) {
    const [y, a] = k.split("-").map(Number);
    if (y === yil && a - 1 === ay) {
      sec(k);
      return;
    }
    setBekleyenGun(k);
    setYil(y);
    setAy(a - 1);
    setSecili(null);
  }

  useEffect(() => {
    if (!bekleyenGun) return;
    const [y, a] = bekleyenGun.split("-").map(Number);
    if (yukluAy !== `${y}-${a - 1}`) return;
    // Ayın verisi geldi: seçimi şimdi yap ki form doğru günle dolsun
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBekleyenGun(null);
    sec(bekleyenGun);
    // sec her render'da yeni; yalnızca veri değişince çalışmalı
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bekleyenGun, yukluAy]);

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
          starts_at: bas || null,
          ends_at: bit || null,
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
    toast("Gün güncellendi.");
    void load();
  }

  async function sil() {
    if (!secili) return;
    setKaydediliyor(true);
    const { error } = await supabase.from("calendar_days").delete().eq("day", secili);
    setKaydediliyor(false);
    if (error) {
      toast("Silinemedi: " + error.message, "error");
      return;
    }
    void logAction(supabase, "delete", "calendar_days", secili, {});
    toast("Gün kaydı kaldırıldı — kural varsa yeniden geçerli.");
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
                <code>supabase/calisma-takvimi.sql</code> dosyasını çalıştırın.
              </p>
            </div>
          </div>
        </Card>
      </>
    );
  }

  const seciliElle = secili ? gunler[secili] : null;
  const seciliEtkin = secili ? etkinGun(secili) : null;

  return (
    <>
      <PageHeader
        title="Çalışma Takvimi"
        desc="Tekrarlı kurallar takvimi doldurur; tek bir günü değiştirmek istediğinizde o gün kuralı ezer."
      >
        {canWrite && (
          <Button variant="outline" onClick={() => setKurallarAcik(true)}>
            <Repeat size={15} />
            Kurallar ({kurallar.length})
          </Button>
        )}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              if (ay === 0) { setYil(yil - 1); setAy(11); } else setAy(ay - 1);
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
              if (ay === 11) { setYil(yil + 1); setAy(0); } else setAy(ay + 1);
              setSecili(null);
            }}
            aria-label="Sonraki ay"
            className="flex size-9 items-center justify-center rounded-lg border border-line text-ink-2 transition-colors hover:border-ink-3 hover:text-ink"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </PageHeader>

      {myDept && bugun && (
        <YoklamaEksikleri
          bugun={bugun}
          role={role}
          myDept={myDept}
          onGunSec={gunAtla}
          surum={yoklamaSurum}
        />
      )}

      {kuralTabloYok && (
        <Card className="mb-5 border-warn/30 bg-warn/8 p-4">
          <div className="flex items-start gap-2.5 text-[13px] text-ink-2">
            <TriangleAlert size={16} className="mt-0.5 shrink-0 text-warn" />
            <span>
              Tekrarlı kurallar için <code>supabase/takvim-kurallari.sql</code>{" "}
              çalıştırılmamış. Takvim şimdilik yalnızca elle girilen günleri
              gösteriyor.
            </span>
          </div>
        </Card>
      )}

      <div className="mb-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px] text-ink-3">
        {(Object.keys(TUR) as Tur[]).map((t) => (
          <span key={t} className="inline-flex items-center gap-1.5">
            <span className={`size-2 rounded-full ${TUR[t].nokta}`} />
            {TUR[t].etiket}
            {sayim[t] ? <b className="tabular text-ink-2">{sayim[t]}</b> : null}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <Repeat size={12} />
          Kuraldan gelen
        </span>
        <span className="inline-flex items-center gap-1.5">
          <ListTodo size={12} />
          Çok günlü iş
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Plane size={12} />
          Planlı uçuş
        </span>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Ay ızgarası */}
        <Card className="overflow-hidden p-0">
          <div className="grid grid-cols-7 border-b border-line">
            {GUN_KISA.map((g) => (
              <div key={g} className="px-2 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider text-ink-3">
                {g}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {izgara.map((h, i) => {
              if (!h.gun || !h.k) {
                return (
                  <div key={`bos-${i}`} className="min-h-[92px] border-b border-r border-line-2/40 bg-bg-2/40 last:border-r-0" />
                );
              }
              const e = etkinGun(h.k);
              const gunUcus = ucuslar[h.k] || [];
              const gunIsler = gununIsleri(h.k);
              const secliMi = secili === h.k;
              const bugunMu = bugun === h.k;

              return (
                <button
                  key={h.k}
                  type="button"
                  onClick={() => sec(h.k!)}
                  className={`min-h-[92px] border-b border-r border-line-2/40 p-2 text-left transition-colors last:border-r-0 ${
                    e ? TUR[e.kind].kutu : "hover:bg-bg-2/60"
                  } ${secliMi ? "ring-2 ring-inset ring-accent" : ""}`}
                >
                  <span className="flex items-center justify-between">
                    <span
                      className={`tabular inline-flex size-6 items-center justify-center rounded-full text-[12.5px] font-semibold ${
                        bugunMu ? "bg-accent text-white" : e ? "text-ink" : "text-ink-2"
                      }`}
                    >
                      {h.gun}
                    </span>
                    {e?.kaynak === "kural" && (
                      <Repeat size={10} className="text-ink-3" aria-label="Kuraldan geliyor" />
                    )}
                  </span>

                  {e?.starts_at && (
                    <span className="tabular mt-1 block text-[10.5px] text-ink-3">
                      {saat(e.starts_at)}–{saat(e.ends_at)}
                    </span>
                  )}
                  {e?.title && (
                    <span className="mt-0.5 block truncate text-[11.5px] font-medium text-ink">
                      {e.title}
                    </span>
                  )}
                  {e && !e.title && !e.starts_at && (
                    <span className="mt-1 block text-[11px] text-ink-3">
                      {TUR[e.kind].etiket}
                    </span>
                  )}

                  {gunIsler.length > 0 && (
                    <span className="mt-1 block space-y-0.5">
                      {gunIsler.slice(0, 2).map((i) => (
                        <span
                          key={i.id}
                          title={`${i.title} - ${i.starts_on} / ${i.ends_on}`}
                          className={`block truncate rounded border px-1 py-0.5 text-[9.5px] font-semibold ${IS_DURUM[i.status].sinif}`}
                        >
                          {i.title}
                        </span>
                      ))}
                      {gunIsler.length > 2 && (
                        <span className="block text-[9.5px] text-ink-3">
                          +{gunIsler.length - 2} is
                        </span>
                      )}
                    </span>
                  )}

                  {gunUcus.length > 0 && (
                    <span className="mt-1.5 flex flex-wrap items-center gap-1">
                      {gunUcus.slice(0, 2).map((f) => (
                        <span
                          key={f.id}
                          title={`${f.aircraft}${f.is_sim ? " (simülasyon)" : ""}`}
                          className={`inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[9.5px] font-semibold ${
                            f.is_sim ? "bg-warn/15 text-warn" : "bg-navy-soft text-navy"
                          }`}
                        >
                          <Plane size={9} />
                          {f.aircraft.slice(0, 6)}
                        </span>
                      ))}
                      {gunUcus.length > 2 && (
                        <span className="text-[9.5px] text-ink-3">+{gunUcus.length - 2}</span>
                      )}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </Card>

        {/* Gün düzenleme */}
        <Card className="h-max p-5">
          {!secili ? (
            <div className="py-6 text-center">
              <CalendarDays size={26} className="mx-auto text-ink-3" />
              <p className="mt-3 text-[13.5px] text-ink-2">
                Bir gün seçin.
              </p>
            </div>
          ) : (
            <>
              <div className="border-b border-line pb-3">
                <div className="eyebrow !text-[10px]">Seçili gün</div>
                <div className="mt-1 text-[15px] font-semibold text-ink">
                  {new Date(secili + "T12:00:00").toLocaleDateString("tr-TR", {
                    day: "numeric", month: "long", year: "numeric", weekday: "long",
                  })}
                </div>
                {seciliEtkin?.kaynak === "kural" && (
                  <div className="mt-2 flex items-start gap-1.5 text-[12px] text-ink-3">
                    <Repeat size={12} className="mt-0.5 shrink-0" />
                    Bu gün bir kuraldan geliyor. Kaydedersen yalnızca bu gün
                    için kuralı ezersin.
                  </div>
                )}
              </div>

              {/* O güne denk gelen çok günlü işler */}
              <div className="mt-4 rounded-xl border border-line bg-bg-2 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="eyebrow !text-[9.5px]">İşler</span>
                  {canWrite && !isTabloYok && (
                    <button
                      type="button"
                      onClick={() => {
                        setDuzenlenenIs(null);
                        setIsFormAcik(true);
                      }}
                      className="inline-flex items-center gap-1 text-[12px] font-semibold text-accent hover:underline"
                    >
                      <Plus size={12} />
                      İş ekle
                    </button>
                  )}
                </div>

                {isTabloYok ? (
                  <p className="text-[12px] leading-relaxed text-ink-3">
                    Çok günlü işler henüz kurulmadı: Supabase SQL Editor&apos;da{" "}
                    <code>supabase/takvim-isler.sql</code> çalıştırılmalı.
                  </p>
                ) : gununIsleri(secili).length === 0 ? (
                  <p className="text-[12.5px] text-ink-3">
                    Bu güne denk gelen iş yok.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {gununIsleri(secili).map((i) => (
                      <li key={i.id}>
                        <button
                          type="button"
                          disabled={!canWrite}
                          onClick={() => {
                            setDuzenlenenIs(i);
                            setIsFormAcik(true);
                          }}
                          className={`w-full rounded-lg border p-2 text-left ${IS_DURUM[i.status].sinif} ${
                            canWrite ? "hover:opacity-80" : "cursor-default"
                          }`}
                        >
                          <span className="block text-[12.5px] font-semibold">
                            {i.title}
                          </span>
                          <span className="tabular block text-[11px] opacity-80">
                            {i.starts_on} / {i.ends_on} ·{" "}
                            {DEPT_LABELS[i.dept] || i.dept}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {bugun && (
                <YoklamaPaneli
                  key={secili}
                  gun={secili}
                  bugun={bugun}
                  calismaGunu={seciliEtkin?.kind === "calisma"}
                  userId={userId}
                  isAdmin={isAdmin}
                  role={role}
                  myDept={myDept}
                  onDegisti={() => setYoklamaSurum((s) => s + 1)}
                />
              )}

              {(ucuslar[secili] || []).length > 0 && (
                <div className="mt-4 rounded-xl border border-line bg-bg-2 p-3">
                  <div className="eyebrow mb-2 !text-[9.5px]">Planlı uçuşlar</div>
                  <ul className="space-y-1.5">
                    {(ucuslar[secili] || []).map((f) => (
                      <li key={f.id} className="flex items-center gap-2 text-[12.5px] text-ink-2">
                        <Plane size={12} className="shrink-0 text-ink-3" />
                        {f.aircraft}
                        {f.is_sim && <span className="text-[11px] text-warn">simülasyon</span>}
                      </li>
                    ))}
                  </ul>
                  <Link href="/panel/ucuslar" className="mt-2.5 inline-block text-[12px] text-accent hover:underline">
                    Uçuş kayıtlarına git →
                  </Link>
                </div>
              )}

              {canWrite ? (
                <div className="mt-4 space-y-4">
                  <Field label="Gün türü">
                    <select value={tur} onChange={(e) => setTur(e.target.value as Tur)} className="field">
                      {(Object.keys(TUR) as Tur[]).map((t) => (
                        <option key={t} value={t}>{TUR[t].etiket}</option>
                      ))}
                    </select>
                  </Field>

                  {/* Bu saatler GÜNÜN çalışma saati. Birden fazla güne yayılan
                      iş için yukarıdaki "İş ekle" kullanılır (gün seçilir, saat yok). */}
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Çalışma başlangıcı">
                      <input type="time" value={bas} onChange={(e) => setBas(e.target.value)} className="field" />
                    </Field>
                    <Field label="Çalışma bitişi">
                      <input type="time" value={bit} onChange={(e) => setBit(e.target.value)} className="field" />
                    </Field>
                  </div>

                  <Field label="Başlık" hint="İsteğe bağlı">
                    <input value={baslik} onChange={(e) => setBaslik(e.target.value)} maxLength={LIMITS.title} placeholder="örn. Kompozit kalıp çalışması" className="field" />
                  </Field>

                  <Field label="Not" hint="İsteğe bağlı">
                    <textarea value={not} onChange={(e) => setNot(e.target.value)} rows={3} maxLength={LIMITS.shortText} className="field resize-y" />
                  </Field>

                  <div className="flex items-center gap-2 border-t border-line pt-4">
                    <Button onClick={kaydet} disabled={kaydediliyor}>
                      {kaydediliyor ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                      Kaydet
                    </Button>
                    {seciliElle && (
                      <Button variant="ghost" onClick={sil} disabled={kaydediliyor}>
                        <Trash2 size={15} />
                        Kaldır
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="mt-4 space-y-2">
                  {seciliEtkin ? (
                    <>
                      <div className="text-[13.5px] font-semibold text-ink">
                        {seciliEtkin.title || TUR[seciliEtkin.kind].etiket}
                      </div>
                      {seciliEtkin.starts_at && (
                        <div className="tabular text-[13px] text-ink-2">
                          {saat(seciliEtkin.starts_at)}–{saat(seciliEtkin.ends_at)}
                        </div>
                      )}
                      {seciliEtkin.note && (
                        <p className="text-[13px] leading-relaxed text-ink-2">{seciliEtkin.note}</p>
                      )}
                    </>
                  ) : (
                    <p className="text-[13px] text-ink-3">Bu gün için kayıt yok.</p>
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

      {canWrite && (
        <IsFormu
          open={isFormAcik}
          onClose={() => {
            setIsFormAcik(false);
            setDuzenlenenIs(null);
          }}
          mevcut={duzenlenenIs}
          varsayilanGun={secili}
          yenile={load}
        />
      )}

      {canWrite && (
        <KurallarPenceresi
          open={kurallarAcik}
          onClose={() => setKurallarAcik(false)}
          kurallar={kurallar}
          yenile={load}
        />
      )}
    </>
  );
}

/* ============================================================
   Tekrarlı kurallar penceresi
   ============================================================ */
function KurallarPenceresi({
  open,
  onClose,
  kurallar,
  yenile,
}: {
  open: boolean;
  onClose: () => void;
  kurallar: Kural[];
  yenile: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [gunler, setGunler] = useState<number[]>([6, 7]);

  function gunDegis(g: number) {
    setGunler((v) => (v.includes(g) ? v.filter((x) => x !== g) : [...v, g].sort()));
  }

  async function ekle(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (gunler.length === 0) {
      toast("En az bir gün seçin.", "error");
      return;
    }
    const fd = new FormData(e.currentTarget);
    const payload = {
      weekdays: gunler,
      kind: (fd.get("kind") as Tur) || "calisma",
      starts_at: String(fd.get("starts_at") || "10:00"),
      ends_at: String(fd.get("ends_at") || "17:00"),
      valid_from: String(fd.get("valid_from") || ""),
      valid_to: String(fd.get("valid_to") || "") || null,
      title: trimTo(fd.get("title"), LIMITS.title),
    };
    if (!payload.valid_from) {
      toast("Başlangıç tarihi zorunlu.", "error");
      return;
    }

    setSaving(true);
    const { error } = await supabase.from("calendar_rules").insert([payload]);
    setSaving(false);
    if (error) {
      toast("Eklenemedi: " + error.message, "error");
      return;
    }
    void logAction(supabase, "create", "calendar_rules", null, payload);
    toast("Kural eklendi.");
    e.currentTarget.reset();
    yenile();
  }

  async function kuralSil(id: string) {
    const { error } = await supabase.from("calendar_rules").delete().eq("id", id);
    if (error) {
      toast("Silinemedi: " + error.message, "error");
      return;
    }
    void logAction(supabase, "delete", "calendar_rules", id, {});
    toast("Kural silindi.");
    yenile();
  }

  return (
    <Modal open={open} onClose={onClose} title="Tekrarlı Çalışma Kuralları" wide>
      <p className="mb-5 text-[13px] leading-relaxed text-ink-2">
        Bir kural, tarih aralığındaki tüm o günleri doldurur. Tek bir günü
        değiştirmek isterseniz takvimden o güne tıklayıp kaydedin — gün kaydı
        kuralı ezer.
      </p>

      {kurallar.length > 0 && (
        <ul className="mb-6 space-y-2">
          {kurallar.map((k) => (
            <li key={k.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-bg-1 p-3.5">
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-semibold text-ink">
                  {k.title || TUR[k.kind].etiket}
                </span>
                <span className="tabular mt-0.5 block text-[12px] text-ink-3">
                  {k.weekdays.map((g) => GUN_KISA[g - 1]).join(", ")} ·{" "}
                  {saat(k.starts_at)}–{saat(k.ends_at)} · {k.valid_from}
                  {k.valid_to ? ` → ${k.valid_to}` : " → süresiz"}
                </span>
              </span>
              <button
                type="button"
                onClick={() => kuralSil(k.id)}
                className="rounded-full border border-line px-3 py-1.5 text-[12.5px] font-semibold text-ink-3 transition-colors hover:border-bad hover:text-bad"
              >
                Sil
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={ekle} className="space-y-4 border-t border-line pt-5">
        <div className="eyebrow !text-[10px]">Yeni kural</div>

        <Field label="Hangi günler">
          <div className="flex flex-wrap gap-2">
            {GUN_KISA.map((g, i) => {
              const iso = i + 1;
              const secili = gunler.includes(iso);
              return (
                <button
                  key={g}
                  type="button"
                  aria-pressed={secili}
                  onClick={() => gunDegis(iso)}
                  className={`rounded-lg border px-3.5 py-2 text-[13px] font-semibold transition-colors ${
                    secili
                      ? "border-accent bg-accent text-white"
                      : "border-line bg-bg text-ink-3 hover:border-ink-3"
                  }`}
                >
                  {g}
                </button>
              );
            })}
          </div>
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Tür">
            <select name="kind" defaultValue="calisma" className="field">
              {(Object.keys(TUR) as Tur[]).map((t) => (
                <option key={t} value={t}>{TUR[t].etiket}</option>
              ))}
            </select>
          </Field>
          <Field label="Başlangıç saati">
            <input name="starts_at" type="time" defaultValue="10:00" className="field" />
          </Field>
          <Field label="Bitiş saati">
            <input name="ends_at" type="time" defaultValue="17:00" className="field" />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Geçerlilik başlangıcı">
            <input name="valid_from" type="date" required className="field" />
          </Field>
          <Field label="Geçerlilik bitişi" hint="Boş = süresiz">
            <input name="valid_to" type="date" className="field" />
          </Field>
          <Field label="Başlık" hint="İsteğe bağlı">
            <input name="title" maxLength={LIMITS.title} placeholder="örn. Yarışma dönemi" className="field" />
          </Field>
        </div>

        <div className="flex justify-end border-t border-line pt-4">
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Repeat size={15} />}
            Kural ekle
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/* ============================================================
   Çok günlü iş formu

   calendar_days (günün durumu) ve calendar_rules (tekrar kuralı)
   ile karıştırılmamalı: bu, başlangıcı ve bitişi olan bir İŞ.
   Takvimde gün kutularının içinde renkli şerit olarak görünür.
   ============================================================ */
function IsFormu({
  open,
  onClose,
  mevcut,
  varsayilanGun,
  yenile,
}: {
  open: boolean;
  onClose: () => void;
  mevcut: Is | null;
  varsayilanGun: string | null;
  yenile: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  async function kaydet(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const title = trimTo(fd.get("title"), LIMITS.title);
    const starts_on = String(fd.get("starts_on") || "");
    const ends_on = String(fd.get("ends_on") || "");

    if (!title || !starts_on || !ends_on) {
      toast("Başlık ve iki tarih de zorunlu.", "error");
      return;
    }
    if (ends_on < starts_on) {
      toast("Bitiş tarihi başlangıçtan önce olamaz.", "error");
      return;
    }

    const payload = {
      title,
      note: trimTo(fd.get("note"), LIMITS.shortText),
      dept: String(fd.get("dept") || "ortak"),
      starts_on,
      ends_on,
      status: String(fd.get("status") || "planli"),
    };

    setSaving(true);
    const { error } = mevcut
      ? await supabase.from("calendar_tasks").update(payload).eq("id", mevcut.id)
      : await supabase.from("calendar_tasks").insert([payload]);
    setSaving(false);

    if (error) {
      toast("Kaydedilemedi: " + error.message, "error");
      return;
    }
    void logAction(
      supabase,
      mevcut ? "update" : "create",
      "calendar_tasks",
      mevcut?.id ?? null,
      { baslik: title }
    );
    toast(mevcut ? "İş güncellendi." : "İş eklendi.");
    onClose();
    yenile();
  }

  async function sil() {
    if (!mevcut) return;
    setSaving(true);
    const { error } = await supabase
      .from("calendar_tasks")
      .delete()
      .eq("id", mevcut.id);
    setSaving(false);
    if (error) {
      toast("Silinemedi: " + error.message, "error");
      return;
    }
    void logAction(supabase, "delete", "calendar_tasks", mevcut.id, {});
    toast("İş silindi.");
    onClose();
    yenile();
  }

  const bas = mevcut?.starts_on ?? varsayilanGun ?? "";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mevcut ? "İşi Düzenle" : "Çok Günlü İş Ekle"}
    >
      <form onSubmit={kaydet} className="space-y-4">
        <Field label="İş" hint="Tek cümlelik başlık">
          <input
            name="title"
            required
            defaultValue={mevcut?.title || ""}
            maxLength={LIMITS.title}
            placeholder="örn. Sol kanat kalıbı üretimi"
            className="field"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Başlangıç">
            <input
              name="starts_on"
              type="date"
              required
              defaultValue={bas}
              className="field"
            />
          </Field>
          <Field label="Bitiş" hint="Farklı bir gün olabilir">
            <input
              name="ends_on"
              type="date"
              required
              defaultValue={mevcut?.ends_on ?? bas}
              className="field"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Birim">
            <select
              name="dept"
              defaultValue={mevcut?.dept || "ortak"}
              className="field"
            >
              {IS_DEPTS.map((k) => (
                <option key={k} value={k}>
                  {DEPT_LABELS[k] || k}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Durum">
            <select
              name="status"
              defaultValue={mevcut?.status || "planli"}
              className="field"
            >
              {(Object.keys(IS_DURUM) as Is["status"][]).map((d) => (
                <option key={d} value={d}>
                  {IS_DURUM[d].etiket}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Not" hint="İsteğe bağlı">
          <textarea
            name="note"
            rows={2}
            defaultValue={mevcut?.note || ""}
            maxLength={LIMITS.shortText}
            className="field resize-y"
          />
        </Field>

        <div className="flex justify-end gap-2.5 border-t border-line pt-4">
          {mevcut && (
            <Button type="button" variant="ghost" onClick={sil} disabled={saving}>
              <Trash2 size={15} />
              Sil
            </Button>
          )}
          <Button type="button" variant="outline" onClick={onClose}>
            Vazgeç
          </Button>
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 size={15} className="animate-spin" />}
            Kaydet
          </Button>
        </div>
      </form>
    </Modal>
  );
}
