"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, ScrollText, RefreshCw, Download } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { fmtDateTime, toCSV, downloadFile } from "@/lib/format";
import type { AuditEntry } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";
import { Badge, Button, Card, EmptyState } from "@/components/ui/Kit";
import { PageHeader } from "@/components/panel/PageHeader";

const ACTION_META: Record<
  string,
  { label: string; tone: "ok" | "info" | "bad" | "accent" }
> = {
  create: { label: "Oluşturma", tone: "ok" },
  update: { label: "Güncelleme", tone: "info" },
  delete: { label: "Silme", tone: "bad" },
  login: { label: "Giriş", tone: "accent" },
};

const TABLE_LABELS: Record<string, string> = {
  stock: "Envanter",
  flights: "Uçuşlar",
  notes: "Uçuş Notları",
  parts: "Parçalar",
  tasks: "Görevler",
  needs: "İhtiyaçlar",
  telemetry: "Telemetri",
  media_assets: "Medya",
  sponsors: "Sponsorlar",
  allocations: "Tahsisler",
  profiles: "Üyeler",
};

export function KayitlarClient() {
  const supabase = useMemo(() => createClient(), []);
  const { toast } = useToast();

  const [rows, setRows] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [action, setAction] = useState("");
  const [table, setTable] = useState("");

  const load = useCallback(async () => {
    let query = supabase
      .from("audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300);
    if (action) query = query.eq("action", action);
    if (table) query = query.eq("table_name", table);

    const { data, error } = await query;
    if (error) toast("Kayıtlar yüklenemedi: " + error.message, "error");
    else setRows((data as AuditEntry[]) || []);
    setLoading(false);
  }, [supabase, toast, action, table]);

  useEffect(() => {
    /* load() asenkrondur: setState ancak ağ yanıtı geldikten sonra çalışır. */
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const ch = supabase
      .channel("realtime:audit_log")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "audit_log" },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [supabase, load]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase("tr");
    if (!needle) return rows;
    return rows.filter((r) =>
      `${r.user_name || ""} ${r.user_dept || ""} ${r.table_name || ""} ${JSON.stringify(
        r.details || {}
      )}`
        .toLocaleLowerCase("tr")
        .includes(needle)
    );
  }, [rows, q]);

  function exportCSV() {
    const data = filtered.map((r) => [
      fmtDateTime(r.created_at),
      r.user_name || "?",
      r.user_dept || "",
      ACTION_META[r.action]?.label ?? r.action,
      TABLE_LABELS[r.table_name || ""] || r.table_name || "",
      JSON.stringify(r.details || {}),
    ]);
    downloadFile(
      toCSV(["Zaman", "Kullanıcı", "Departman", "İşlem", "Tablo", "Detay"], data),
      `islem-kayitlari-${new Date().toISOString().slice(0, 10)}.csv`
    );
    toast(`${data.length} kayıt dışa aktarıldı.`);
  }

  return (
    <>
      <PageHeader
        title="İşlem Kayıtları"
        desc="Panelde yapılan tüm ekleme, güncelleme ve silme işlemlerinin denetim günlüğü."
      >
        <Button variant="outline" size="md" onClick={exportCSV}>
          <Download size={15} />
          CSV indir
        </Button>
        <Button variant="outline" size="md" onClick={() => load()}>
          <RefreshCw size={15} />
          Yenile
        </Button>
      </PageHeader>

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4">
          <div className="relative min-w-[190px] flex-1 sm:max-w-xs">
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3"
            />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Kullanıcı veya detay ara…"
              className="field !pl-9"
            />
          </div>
          <select
            value={action}
            onChange={(e) => setAction(e.target.value)}
            className="field !w-auto"
          >
            <option value="">Tüm işlemler</option>
            {Object.entries(ACTION_META).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
          <select
            value={table}
            onChange={(e) => setTable(e.target.value)}
            className="field !w-auto"
          >
            <option value="">Tüm modüller</option>
            {Object.entries(TABLE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <span className="ml-auto text-xs text-ink-3">{filtered.length} kayıt</span>
        </div>

        {loading ? (
          <div className="px-5 py-16 text-center text-sm text-ink-3">Yükleniyor…</div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<ScrollText size={30} />}
            title="Kayıt bulunamadı"
            desc="Panelde işlem yapıldıkça denetim günlüğü burada birikir."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-sm">
              <thead>
                <tr className="border-b border-line text-left">
                  {["Zaman", "Kullanıcı", "İşlem", "Modül", "Detay"].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-[11.5px] font-semibold uppercase tracking-wider text-ink-3"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const meta = ACTION_META[r.action] ?? {
                    label: r.action,
                    tone: "info" as const,
                  };
                  const details = r.details || {};
                  const entries = Object.entries(details).slice(0, 4);
                  return (
                    <tr
                      key={r.id}
                      className="border-b border-line last:border-0 hover:bg-bg-2/60"
                    >
                      <td className="tabular whitespace-nowrap px-4 py-3 text-[12.5px] text-ink-3">
                        {fmtDateTime(r.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-ink">
                          {r.user_name || "—"}
                        </div>
                        {r.user_dept && (
                          <div className="text-[11.5px] text-ink-3">
                            {r.user_dept}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={meta.tone}>{meta.label}</Badge>
                      </td>
                      <td className="px-4 py-3 text-[12.5px] text-ink-2">
                        {TABLE_LABELS[r.table_name || ""] || r.table_name || "—"}
                      </td>
                      <td className="px-4 py-3">
                        {entries.length === 0 ? (
                          <span className="text-ink-3">—</span>
                        ) : (
                          <span className="flex flex-wrap gap-1.5">
                            {entries.map(([k, v]) => (
                              <span
                                key={k}
                                className="rounded bg-bg-2 px-1.5 py-0.5 text-[11.5px] text-ink-2"
                              >
                                {k}={String(v).slice(0, 40)}
                              </span>
                            ))}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
