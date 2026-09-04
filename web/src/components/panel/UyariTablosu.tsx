"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  TriangleAlert,
  CalendarClock,
  PackageX,
  BatteryWarning,
  ArrowRight,
  CircleCheck,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { DEPT_LABELS } from "@/lib/constants";
import {
  needsAttention,
  statusOf,
  STATUS_META,
  expiryText,
  EXPIRY_WARN_DAYS,
  type StockStatus,
} from "@/lib/stock-health";
import type { StockItem } from "@/lib/types";
import { Badge, Card } from "@/components/ui/Kit";

const ICONS: Record<StockStatus, React.ReactNode> = {
  out: <PackageX size={15} />,
  expired: <CalendarClock size={15} />,
  worn: <BatteryWarning size={15} />,
  critical: <TriangleAlert size={15} />,
  expiring: <CalendarClock size={15} />,
  ok: null,
};

/**
 * Panelin en üstündeki uyarı tablosu.
 * Tükenen, kritik seviyedeki, SKT'si yaklaşan/geçen ve ömrünü dolduran
 * malzemeleri tek bakışta gösterir.
 */
export function UyariTablosu() {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase.from("stock").select("*");
    setItems((data as StockItem[]) || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    // load() asenkrondur: setState ağ yanıtından sonra çalışır.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const ch = supabase
      .channel("realtime:stock-alerts")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "stock" },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [supabase, load]);

  const alerts = useMemo(() => needsAttention(items), [items]);

  if (loading) return null;

  /* Her şey yolundaysa küçük bir onay şeridi göster */
  if (alerts.length === 0) {
    return (
      <div className="mb-6 flex items-center gap-2.5 rounded-2xl border border-ok/25 bg-ok/8 px-5 py-3.5">
        <CircleCheck size={17} className="shrink-0 text-ok" />
        <span className="text-[13.5px] text-ink-2">
          Envanterde uyarı gerektiren malzeme yok — stok, SKT ve şarj
          döngüleri normal.
        </span>
      </div>
    );
  }

  const critical = alerts.filter((s) =>
    ["out", "expired", "worn"].includes(statusOf(s))
  ).length;

  return (
    <Card
      className="mb-6 !border-warn/30"
      title="Uyarı Tablosu"
      desc={`${alerts.length} malzeme dikkat gerektiriyor${
        critical ? ` · ${critical} tanesi acil` : ""
      }`}
      actions={
        <Link
          href="/panel/envanter"
          className="inline-flex items-center gap-1.5 rounded-full border border-line-2 px-3.5 py-1.5 text-[12.5px] font-semibold text-ink transition-colors hover:border-accent hover:text-accent"
        >
          Envantere git
          <ArrowRight size={14} />
        </Link>
      }
    >
      <ul className="divide-y divide-[color:var(--line)]">
        {alerts.slice(0, 8).map((s) => {
          const st = statusOf(s);
          const meta = STATUS_META[st];
          const exp = expiryText(s);
          const cl = Number(s.cycle_limit || 0);
          const cc = Number(s.cycle_count || 0);

          return (
            <li key={s.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
              <span
                className={`shrink-0 ${
                  meta.tone === "bad"
                    ? "text-bad"
                    : meta.tone === "warn"
                      ? "text-warn"
                      : "text-ok"
                }`}
              >
                {ICONS[st]}
              </span>

              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-semibold text-ink">
                  {s.name}
                </span>
                <span className="block text-[11.5px] text-ink-3">
                  {DEPT_LABELS[s.dept] || s.dept}
                  {s.location ? ` · ${s.location}` : ""}
                  {s.batch_no ? ` · Parti ${s.batch_no}` : ""}
                </span>
              </span>

              <span className="tabular shrink-0 text-[12.5px] text-ink-2">
                {st === "out" || st === "critical"
                  ? `${s.qty} ${s.unit || ""}`
                  : exp
                    ? exp
                    : cl > 0
                      ? `${cc}/${cl} döngü`
                      : ""}
              </span>

              <Badge tone={meta.tone}>{meta.short}</Badge>
            </li>
          );
        })}
      </ul>

      {alerts.length > 8 && (
        <div className="border-t border-line px-5 py-3 text-center">
          <Link
            href="/panel/envanter"
            className="text-[12.5px] font-semibold text-accent hover:underline"
          >
            +{alerts.length - 8} malzeme daha
          </Link>
        </div>
      )}

      <p className="border-t border-line px-5 py-3 text-[11.5px] text-ink-3">
        SKT&apos;sine {EXPIRY_WARN_DAYS} gün kalan malzemeler burada uyarı verir.
        Takip için envanterde malzemeye SKT veya şarj döngüsü limiti girin.
      </p>
    </Card>
  );
}
