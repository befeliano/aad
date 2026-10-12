"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Database,
  Download,
  ExternalLink,
  Loader2,
  Play,
  Search,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { fmtDate } from "@/lib/format";
import { useToast } from "@/components/ui/Toast";
import { Badge, EmptyState, Modal } from "@/components/ui/Kit";

/** ArduPilot'un resmî çevrim içi log görüntüleyicisi */
export const ARDUPILOT_VIEWER = "https://plot.ardupilot.org/#/";

/** Panelde çözümlenebilen uzantılar — geri kalanı yalnızca arşivlenir */
const COZUMLENEBILIR = /^(db|sqlite|sqlite3)$/i;

interface LogDosyasi {
  path: string;
  name: string;
  ext: string;
  size?: number | null;
  at?: string | null;
}

interface Kayit {
  flight_id: string;
  logs: LogDosyasi[] | null;
  log_path: string | null;
  flights: {
    aircraft: string;
    flight_date: string;
    is_sim?: boolean;
  } | null;
}

function boyut(b?: number | null) {
  if (!b) return null;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
}

/**
 * Daha önce bir uçuşa yüklenmiş kayıtların listesi.
 *
 * Amaç: aynı dosyayı her analizde yeniden yüklemek zorunda kalmamak.
 * .db dosyaları doğrudan açılır; .bin ve .tlog panelde çözümlenemediği
 * için indirilip ArduPilot Log Viewer'da açılır.
 */
export function LogKutuphanesi({
  open,
  onClose,
  onSec,
}: {
  open: boolean;
  onClose: () => void;
  /** Seçilen .db dosyasının storage yolu */
  onSec: (path: string, ad: string) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const { toast } = useToast();

  const [kayitlar, setKayitlar] = useState<Kayit[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [indiriliyor, setIndiriliyor] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("flight_checklists")
      .select("flight_id, logs, log_path, flights(aircraft, flight_date, is_sim)")
      .order("created_at", { ascending: false });

    setKayitlar(((data as unknown as Kayit[]) || []).filter((k) => {
      const n = k.logs?.length ?? 0;
      return n > 0 || !!k.log_path;
    }));
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    if (!open) return;
    // load() asenkrondur: setState ağ yanıtından sonra çalışır.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [open, load]);

  /** logs kolonu yoksa eski tek dosyayı diziymiş gibi göster */
  const dosyalarOf = (k: Kayit): LogDosyasi[] => {
    if (k.logs?.length) return k.logs;
    if (!k.log_path) return [];
    return [
      {
        path: k.log_path,
        name: k.log_path.split("/").pop() || "kayit",
        ext: (k.log_path.split(".").pop() || "").toLowerCase(),
      },
    ];
  };

  const filtreli = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase("tr");
    if (!needle) return kayitlar;
    return kayitlar.filter((k) =>
      `${k.flights?.aircraft || ""} ${k.flights?.flight_date || ""} ${dosyalarOf(k)
        .map((d) => d.name)
        .join(" ")}`
        .toLocaleLowerCase("tr")
        .includes(needle)
    );
  }, [kayitlar, q]);

  /** İmzalı bağlantı üretip indirir — bucket gizli olduğu için gerekli */
  async function indir(d: LogDosyasi) {
    setIndiriliyor(d.path);
    const { data, error } = await supabase.storage
      .from("flight-logs")
      .createSignedUrl(d.path, 600, { download: d.name });
    setIndiriliyor(null);

    if (error || !data) {
      toast("Bağlantı alınamadı: " + (error?.message || ""), "error");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
  }

  return (
    <Modal open={open} onClose={onClose} title="Uçuş Kaydı Kütüphanesi" wide>
      <div className="relative mb-5">
        <Search
          size={15}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3"
        />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Uçak, tarih veya dosya adı ara…"
          className="field !pl-9"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-14 text-sm text-ink-3">
          <Loader2 size={16} className="animate-spin" />
          Yükleniyor…
        </div>
      ) : filtreli.length === 0 ? (
        <EmptyState
          icon={<Database size={28} />}
          title={kayitlar.length === 0 ? "Kütüphane boş" : "Sonuç yok"}
          desc={
            kayitlar.length === 0
              ? "Uçuş Kayıtları ekranından bir uçuşa dosya eklediğinizde burada birikecek."
              : "Aramayı değiştirmeyi deneyin."
          }
        />
      ) : (
        <ul className="space-y-3">
          {filtreli.map((k) => {
            const dosyalar = dosyalarOf(k);
            return (
              <li
                key={k.flight_id}
                className="rounded-xl border border-line bg-bg-1 p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[14px] font-semibold text-ink">
                    {k.flights?.aircraft || "Uçak bilinmiyor"}
                  </span>
                  {k.flights?.flight_date && (
                    <span className="text-[12.5px] text-ink-3">
                      {fmtDate(k.flights.flight_date)}
                    </span>
                  )}
                  {k.flights?.is_sim && <Badge tone="warn">Simülasyon</Badge>}
                </div>

                <ul className="mt-3 space-y-2">
                  {dosyalar.map((d) => {
                    const acilabilir = COZUMLENEBILIR.test(d.ext);
                    return (
                      <li
                        key={d.path}
                        className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-bg p-2.5"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] text-ink">
                            {d.name}
                          </span>
                          <span className="text-[11.5px] text-ink-3">
                            .{d.ext}
                            {boyut(d.size) ? ` · ${boyut(d.size)}` : ""}
                          </span>
                        </span>

                        {acilabilir ? (
                          <button
                            type="button"
                            onClick={() => {
                              onSec(d.path, d.name);
                              onClose();
                            }}
                            className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-[12.5px] font-semibold text-white transition-transform hover:scale-105"
                          >
                            <Play size={13} />
                            .db analiz
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => indir(d)}
                              disabled={indiriliyor === d.path}
                              className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-[12.5px] font-semibold text-ink-2 transition-colors hover:border-ink-3 hover:text-ink disabled:opacity-60"
                            >
                              {indiriliyor === d.path ? (
                                <Loader2 size={13} className="animate-spin" />
                              ) : (
                                <Download size={13} />
                              )}
                              .{d.ext.toUpperCase()} indir
                            </button>
                            <a
                              href={ARDUPILOT_VIEWER}
                              target="_blank"
                              rel="noopener"
                              className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-[12.5px] font-semibold text-ink-2 transition-colors hover:border-accent hover:text-accent"
                              title="Dosyayı indirip bu sayfaya sürükleyin"
                            >
                              <ExternalLink size={13} />
                              ArduPilot
                            </a>
                          </>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-5 border-t border-line pt-4 text-[12.5px] leading-relaxed text-ink-3">
        <b className="text-ink-2">.db</b> kayıtları panelde açılır.{" "}
        <b className="text-ink-2">.bin</b> ve <b className="text-ink-2">.tlog</b>{" "}
        ArduPilot&apos;un DataFlash biçimindedir; panel bunları çözümleyemez.
        İndirip{" "}
        <a
          href={ARDUPILOT_VIEWER}
          target="_blank"
          rel="noopener"
          className="text-accent underline underline-offset-2"
        >
          ArduPilot Log Viewer
        </a>{" "}
        sayfasına sürükleyin.
      </p>
    </Modal>
  );
}
