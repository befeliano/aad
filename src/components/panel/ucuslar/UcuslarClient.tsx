"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Plus,
  Search,
  Download,
  Trash2,
  Pencil,
  Plane,
  Clock,
  MapPin,
  User,
  CalendarClock,
  Timer,
  Activity,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { fmtDate, fmtTime, toCSV, downloadFile } from "@/lib/format";
import type { Flight } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Field,
  Modal,
} from "@/components/ui/Kit";
import { PageHeader } from "@/components/panel/PageHeader";

/** Uçuşun tarih+saatini tek bir Date'e çevirir */
function flightDate(f: Flight): Date {
  return new Date(`${f.flight_date}T${f.flight_time || "00:00:00"}`);
}

export function UcuslarClient({ userId }: { userId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const { toast } = useToast();

  const [flights, setFlights] = useState<Flight[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");

  const [editing, setEditing] = useState<Flight | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [delTarget, setDelTarget] = useState<Flight | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("flights")
      .select("*")
      .order("flight_date", { ascending: false })
      .order("flight_time", { ascending: false });
    if (error) toast("Uçuşlar yüklenemedi: " + error.message, "error");
    else setFlights((data as Flight[]) || []);
    setLoading(false);
  }, [supabase, toast]);

  useEffect(() => {
    /* load() asenkrondur: setState ancak ağ yanıtı geldikten sonra
       çalışır, dolayısıyla senkron bir render zinciri oluşmaz. */
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const ch = supabase
      .channel("realtime:flights")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "flights" },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [supabase, load]);

  const { upcoming, past } = useMemo(() => {
    const now = new Date();
    const needle = q.trim().toLocaleLowerCase("tr");
    const match = (f: Flight) =>
      !needle ||
      `${f.aircraft} ${f.pilot || ""} ${f.location || ""} ${f.mission || ""}`
        .toLocaleLowerCase("tr")
        .includes(needle);

    const up = flights
      .filter((f) => flightDate(f) >= now && match(f))
      .sort((a, b) => +flightDate(a) - +flightDate(b));
    const pa = flights
      .filter((f) => flightDate(f) < now && match(f))
      .sort((a, b) => +flightDate(b) - +flightDate(a));
    return { upcoming: up, past: pa };
  }, [flights, q]);

  const stats = useMemo(() => {
    const now = new Date();
    const done = flights.filter((f) => flightDate(f) < now);
    const minutes = done.reduce((a, f) => a + Number(f.duration || 0), 0);
    const aircraft = new Set(flights.map((f) => f.aircraft)).size;
    return {
      total: flights.length,
      done: done.length,
      upcoming: flights.length - done.length,
      hours: (minutes / 60).toFixed(1),
      aircraft,
    };
  }, [flights]);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = {
      flight_date: String(fd.get("flight_date") || ""),
      flight_time: String(fd.get("flight_time") || ""),
      aircraft: String(fd.get("aircraft") || "").trim(),
      pilot: String(fd.get("pilot") || "").trim() || null,
      location: String(fd.get("location") || "").trim() || null,
      duration: fd.get("duration") ? Number(fd.get("duration")) : null,
      mission: String(fd.get("mission") || "").trim() || null,
    };
    if (!payload.flight_date || !payload.flight_time || !payload.aircraft) {
      toast("Tarih, saat ve uçak zorunlu.", "error");
      return;
    }

    setSaving(true);
    const { error } = editing
      ? await supabase.from("flights").update(payload).eq("id", editing.id)
      : await supabase
          .from("flights")
          .insert([{ ...payload, created_by: userId }]);
    setSaving(false);

    if (error) {
      toast("Kaydedilemedi: " + error.message, "error");
      return;
    }
    toast(editing ? "Uçuş güncellendi." : "Uçuş kaydedildi.");
    setFormOpen(false);
    setEditing(null);
    load();
  }

  async function doDelete() {
    if (!delTarget) return;
    const { error } = await supabase
      .from("flights")
      .delete()
      .eq("id", delTarget.id);
    if (error) toast("Silinemedi: " + error.message, "error");
    else toast("Uçuş kaydı silindi.");
    setDelTarget(null);
    load();
  }

  function exportCSV() {
    const rows = flights.map((f) => [
      f.flight_date,
      fmtTime(f.flight_time),
      f.aircraft,
      f.pilot || "",
      f.location || "",
      f.duration ?? "",
      f.mission || "",
    ]);
    downloadFile(
      toCSV(
        ["Tarih", "Saat", "Uçak", "Pilot", "Konum", "Süre (dk)", "Görev"],
        rows
      ),
      `ucus-kayitlari-${new Date().toISOString().slice(0, 10)}.csv`
    );
    toast(`${rows.length} uçuş dışa aktarıldı.`);
  }

  const list = tab === "upcoming" ? upcoming : past;

  return (
    <>
      <PageHeader
        title="Uçuş Kayıtları"
        desc="Planlanan ve gerçekleşen test uçuşlarının kaydı. Telemetri analizi için uçuş verisi yükleyebilirsiniz."
      >
        <Link href="/panel/ucuslar/analiz">
          <Button variant="outline" size="md">
            <Activity size={15} />
            Uçuş Analizi
          </Button>
        </Link>
        <Button variant="outline" size="md" onClick={exportCSV}>
          <Download size={15} />
          CSV indir
        </Button>
        <Button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus size={16} />
          Uçuş Planla
        </Button>
      </PageHeader>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryTile
          icon={<Plane size={18} />}
          label="Toplam Uçuş"
          value={String(stats.total)}
        />
        <SummaryTile
          icon={<CalendarClock size={18} />}
          label="Yaklaşan"
          value={String(stats.upcoming)}
        />
        <SummaryTile
          icon={<Timer size={18} />}
          label="Havada Kalış"
          value={`${stats.hours} sa`}
        />
        <SummaryTile
          icon={<Activity size={18} />}
          label="Platform"
          value={String(stats.aircraft)}
        />
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4">
          <div className="flex rounded-full border border-line p-0.5">
            {(
              [
                ["upcoming", `Yaklaşan (${upcoming.length})`],
                ["past", `Geçmiş (${past.length})`],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`rounded-full px-4 py-1.5 text-[13px] font-semibold transition-colors ${
                  tab === key
                    ? "bg-accent text-white"
                    : "text-ink-2 hover:text-ink"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="relative ml-auto min-w-[210px] flex-1 sm:max-w-xs">
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3"
            />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Uçak, pilot, görev ara…"
              className="field !pl-9"
            />
          </div>
        </div>

        {loading ? (
          <div className="px-5 py-16 text-center text-sm text-ink-3">
            Yükleniyor…
          </div>
        ) : list.length === 0 ? (
          <EmptyState
            icon={<Plane size={30} />}
            title={
              tab === "upcoming"
                ? "Planlanmış uçuş yok"
                : "Geçmiş uçuş kaydı yok"
            }
            desc={
              tab === "upcoming"
                ? "Yeni bir test uçuşu planlayarak takımı bilgilendirin."
                : "Gerçekleşen uçuşlar burada listelenir."
            }
            action={
              tab === "upcoming" ? (
                <Button
                  onClick={() => {
                    setEditing(null);
                    setFormOpen(true);
                  }}
                >
                  <Plus size={16} />
                  Uçuş Planla
                </Button>
              ) : undefined
            }
          />
        ) : (
          <ul className="divide-y divide-[color:var(--line)]">
            {list.map((f) => {
              const d = flightDate(f);
              const isPast = tab === "past";
              return (
                <li
                  key={f.id}
                  className={`flex flex-wrap items-center gap-4 px-5 py-4 transition-colors hover:bg-bg-2/60 ${
                    isPast ? "opacity-80" : ""
                  }`}
                >
                  {/* Tarih bloğu */}
                  <div className="flex size-14 shrink-0 flex-col items-center justify-center rounded-xl border border-line bg-bg-2">
                    <span className="display tabular text-xl leading-none text-ink">
                      {d.getDate()}
                    </span>
                    <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-3">
                      {d.toLocaleDateString("tr-TR", { month: "short" })}
                    </span>
                  </div>

                  <div className="min-w-[190px] flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-ink">{f.aircraft}</span>
                      <Badge tone={isPast ? "neutral" : "accent"}>
                        {fmtTime(f.flight_time)}
                      </Badge>
                      {f.duration ? (
                        <Badge tone="info">{f.duration} dk</Badge>
                      ) : null}
                    </div>
                    {f.mission && (
                      <p className="mt-1 text-sm text-ink-2">{f.mission}</p>
                    )}
                    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-ink-3">
                      {f.location && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin size={12} />
                          {f.location}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        <User size={12} />
                        {f.pilot || "Pilot atanmadı"}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock size={12} />
                        {fmtDate(f.flight_date)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(f);
                        setFormOpen(true);
                      }}
                      className="flex size-8 items-center justify-center rounded-lg text-ink-3 transition-colors hover:bg-bg-2 hover:text-ink"
                      aria-label="Düzenle"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDelTarget(f)}
                      className="flex size-8 items-center justify-center rounded-lg text-ink-3 transition-colors hover:bg-bad/12 hover:text-bad"
                      aria-label="Sil"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Modal
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        title={editing ? "Uçuşu Düzenle" : "Yeni Uçuş"}
      >
        <form onSubmit={save} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tarih">
              <input
                name="flight_date"
                type="date"
                required
                defaultValue={
                  editing?.flight_date || new Date().toISOString().slice(0, 10)
                }
                className="field"
              />
            </Field>
            <Field label="Saat">
              <input
                name="flight_time"
                type="time"
                required
                defaultValue={editing?.flight_time?.slice(0, 5) || "10:00"}
                className="field"
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Uçak / Platform">
              <input
                name="aircraft"
                required
                defaultValue={editing?.aircraft || ""}
                placeholder="örn. HYDRA"
                className="field"
              />
            </Field>
            <Field label="Pilot">
              <input
                name="pilot"
                defaultValue={editing?.pilot || ""}
                placeholder="Ad Soyad"
                className="field"
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Konum">
              <input
                name="location"
                defaultValue={editing?.location || ""}
                placeholder="örn. ESTÜ Pisti"
                className="field"
              />
            </Field>
            <Field label="Süre (dakika)" hint="Uçuş sonrası doldurulabilir">
              <input
                name="duration"
                type="number"
                min="0"
                defaultValue={editing?.duration ?? ""}
                className="field"
              />
            </Field>
          </div>

          <Field label="Görev tanımı">
            <textarea
              name="mission"
              rows={3}
              defaultValue={editing?.mission || ""}
              placeholder="örn. Otonom hedef takibi ve kilitlenme testi"
              className="field resize-y"
            />
          </Field>

          <div className="flex justify-end gap-2.5 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setFormOpen(false);
                setEditing(null);
              }}
            >
              Vazgeç
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Kaydediliyor…" : editing ? "Güncelle" : "Kaydet"}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!delTarget}
        message={`${delTarget?.aircraft} · ${fmtDate(
          delTarget?.flight_date
        )} uçuş kaydı silinecek. Bu işlem geri alınamaz.`}
        onConfirm={doDelete}
        onCancel={() => setDelTarget(null)}
      />
    </>
  );
}

function SummaryTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-line bg-bg-1 p-5">
      <div className="flex items-center gap-2 text-ink-3">
        {icon}
        <span className="text-[12.5px] font-semibold">{label}</span>
      </div>
      <div className="display tabular mt-3 text-3xl text-ink">{value}</div>
    </div>
  );
}
