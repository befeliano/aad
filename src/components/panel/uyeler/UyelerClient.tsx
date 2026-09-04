"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, Trash2, Users, ShieldCheck, UserCog } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { DEPT_KEYS, DEPT_LABELS } from "@/lib/constants";
import { fmtDateTime } from "@/lib/format";
import { oneOf } from "@/lib/security";
import { logAction } from "@/lib/audit";
import type { Profile, Role } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";
import {
  Badge,
  Card,
  ConfirmDialog,
  EmptyState,
} from "@/components/ui/Kit";
import { PageHeader } from "@/components/panel/PageHeader";

const ROLES = ["member", "admin"] as const;

export function UyelerClient({ myId }: { myId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const { toast } = useToast();

  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [delTarget, setDelTarget] = useState<Profile | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast("Üyeler yüklenemedi: " + error.message, "error");
    else setUsers((data as Profile[]) || []);
    setLoading(false);
  }, [supabase, toast]);

  useEffect(() => {
    /* load() asenkrondur: setState ancak ağ yanıtı geldikten sonra çalışır. */
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const ch = supabase
      .channel("realtime:profiles")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [supabase, load]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase("tr");
    if (!needle) return users;
    return users.filter((u) =>
      `${u.full_name || ""} ${u.username || ""} ${u.email || ""} ${
        DEPT_LABELS[u.department || ""] || u.department || ""
      }`
        .toLocaleLowerCase("tr")
        .includes(needle)
    );
  }, [users, q]);

  const stats = useMemo(
    () => ({
      total: users.length,
      admins: users.filter((u) => u.role === "admin").length,
      unassigned: users.filter((u) => !u.department).length,
    }),
    [users]
  );

  async function updateField(
    user: Profile,
    field: "role" | "department",
    rawValue: string
  ) {
    // Kendi rolünü değiştirmeyi engelle (kilitlenmeyi önler)
    if (field === "role" && user.id === myId) {
      toast("Kendi rolünüzü değiştiremezsiniz.", "error");
      return;
    }
    const value =
      field === "role"
        ? oneOf<Role>(rawValue, ROLES, "member")
        : rawValue === ""
          ? null
          : oneOf(rawValue, DEPT_KEYS, "ortak");

    // İyimser güncelleme
    setUsers((v) =>
      v.map((u) => (u.id === user.id ? { ...u, [field]: value } : u))
    );

    const { error } = await supabase
      .from("profiles")
      .update({ [field]: value })
      .eq("id", user.id);

    if (error) {
      toast("Güncellenemedi: " + error.message, "error");
      load();
      return;
    }
    logAction(supabase, "update", "profiles", user.id, { [field]: value });
    toast(field === "role" ? "Rol güncellendi." : "Departman güncellendi.");
  }

  async function doDelete() {
    if (!delTarget) return;
    const { error } = await supabase
      .from("profiles")
      .delete()
      .eq("id", delTarget.id);
    if (error) toast("Silinemedi: " + error.message, "error");
    else {
      logAction(supabase, "delete", "profiles", delTarget.id, {
        name: delTarget.full_name,
      });
      toast("Üye profili silindi.");
    }
    setDelTarget(null);
    load();
  }

  return (
    <>
      <PageHeader
        title="Üye Yönetimi"
        desc="Takım üyelerinin rol ve departman atamaları. Yetkiler buradan belirlenir."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Tile icon={<Users size={18} />} label="Toplam Üye" value={String(stats.total)} />
        <Tile icon={<ShieldCheck size={18} />} label="Kaptan (Admin)" value={String(stats.admins)} />
        <Tile
          icon={<UserCog size={18} />}
          label="Departmansız"
          value={String(stats.unassigned)}
          tone={stats.unassigned > 0 ? "warn" : undefined}
        />
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4">
          <div className="relative min-w-[200px] flex-1 sm:max-w-sm">
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3"
            />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="İsim, e-posta veya departman ara…"
              className="field !pl-9"
            />
          </div>
          <span className="ml-auto text-xs text-ink-3">{filtered.length} üye</span>
        </div>

        {loading ? (
          <div className="px-5 py-16 text-center text-sm text-ink-3">Yükleniyor…</div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={<Users size={30} />} title="Üye bulunamadı" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-line text-left">
                  {["Üye", "E-posta", "Departman", "Rol", "Son Görülme", ""].map((h, i) => (
                    <th
                      key={h + i}
                      className="px-4 py-3 text-[11.5px] font-semibold uppercase tracking-wider text-ink-3"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => {
                  const isMe = u.id === myId;
                  return (
                    <tr
                      key={u.id}
                      className={`border-b border-line last:border-0 ${
                        isMe ? "bg-accent-soft" : "hover:bg-bg-2/60"
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="font-semibold text-ink">
                          {u.full_name || "(İsim yok)"}
                          {isMe && (
                            <span className="ml-2 text-[11.5px] font-medium text-accent">
                              · siz
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 text-[12px] text-ink-3">
                          @{u.username || "?"}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[12.5px] text-ink-2">
                        {u.email || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={u.department || ""}
                          onChange={(e) => updateField(u, "department", e.target.value)}
                          className="field !w-auto !py-1.5 !text-[13px]"
                          aria-label={`${u.full_name} departmanı`}
                        >
                          <option value="">— Atanmamış —</option>
                          {DEPT_KEYS.map((k) => (
                            <option key={k} value={k}>{DEPT_LABELS[k]}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={u.role}
                          onChange={(e) => updateField(u, "role", e.target.value)}
                          disabled={isMe}
                          title={isMe ? "Kendi rolünüzü değiştiremezsiniz" : undefined}
                          className="field !w-auto !py-1.5 !text-[13px] disabled:opacity-55"
                          aria-label={`${u.full_name} rolü`}
                        >
                          <option value="member">Üye</option>
                          <option value="admin">Kaptan (Admin)</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 text-[12.5px] text-ink-3">
                        {u.last_seen ? fmtDateTime(u.last_seen) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {!isMe && (
                          <button
                            type="button"
                            onClick={() => setDelTarget(u)}
                            aria-label="Üyeyi sil"
                            className="flex size-7 items-center justify-center rounded-md text-ink-3 transition-colors hover:bg-bad/12 hover:text-bad"
                          >
                            <Trash2 size={14} />
                          </button>
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

      <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-warn/30 bg-warn/8 p-4">
        <Badge tone="warn">Not</Badge>
        <p className="text-[13px] leading-relaxed text-ink-2">
          Üye silmek yalnızca <strong>profil</strong> kaydını kaldırır; Supabase
          Auth hesabı durur. Hesabı tamamen kapatmak için Supabase
          Dashboard&apos;dan da silmeniz gerekir.
        </p>
      </div>

      <ConfirmDialog
        open={!!delTarget}
        message={`"${
          delTarget?.full_name || delTarget?.username
        }" üyesinin profili silinecek. Auth hesabı Supabase Dashboard'dan ayrıca silinmelidir.`}
        onConfirm={doDelete}
        onCancel={() => setDelTarget(null)}
      />
    </>
  );
}

function Tile({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: "warn";
}) {
  return (
    <div className="rounded-2xl border border-line bg-bg-1 p-5">
      <div className="flex items-center gap-2 text-ink-3">
        {icon}
        <span className="text-[12.5px] font-semibold">{label}</span>
      </div>
      <div
        className={`display tabular mt-3 text-3xl ${
          tone === "warn" ? "text-warn" : "text-ink"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
