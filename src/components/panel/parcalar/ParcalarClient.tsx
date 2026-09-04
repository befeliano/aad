"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  Plus,
  Search,
  Trash2,
  Download,
  Box,
  Upload,
  Loader2,
  Eye,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { DEPT_KEYS, DEPT_LABELS, FLEET } from "@/lib/constants";
import { fmtDate } from "@/lib/format";
import { reqText, trimTo, oneOf, safeExt, safeFileName, LIMITS } from "@/lib/security";
import { logAction } from "@/lib/audit";
import type { Part } from "@/lib/types";
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

/** three.js tarayıcıya özgüdür — SSR kapalı */
const PartViewer = dynamic(
  () => import("./PartViewer").then((m) => m.PartViewer),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[420px] items-center justify-center rounded-xl border border-line bg-bg-2 text-sm text-ink-3">
        Görüntüleyici yükleniyor…
      </div>
    ),
  }
);

/** 3D olarak görüntülenebilen uzantılar */
const VIEWABLE_EXTS = ["stl", "obj", "glb", "gltf"];
const MAX_MB = 100;
const PART_DEPTS = [...DEPT_KEYS, "ortak"] as const;

export function ParcalarClient({
  userId,
  canWrite,
}: {
  userId: string;
  canWrite: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const { toast } = useToast();

  const [parts, setParts] = useState<Part[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [dept, setDept] = useState("");
  const [aircraft, setAircraft] = useState("");
  const [onlyViewable, setOnlyViewable] = useState(false);

  const [selected, setSelected] = useState<Part | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [delTarget, setDelTarget] = useState<Part | null>(null);
  const [fileHint, setFileHint] = useState<{ text: string; tone: string } | null>(
    null
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("parts")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast("Parçalar yüklenemedi: " + error.message, "error");
    else setParts((data as Part[]) || []);
    setLoading(false);
  }, [supabase, toast]);

  useEffect(() => {
    /* load() asenkrondur: setState ancak ağ yanıtı geldikten sonra çalışır. */
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const ch = supabase
      .channel("realtime:parts")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "parts" },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [supabase, load]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase("tr");
    return parts.filter((p) => {
      if (dept && p.dept !== dept) return false;
      if (aircraft && p.aircraft !== aircraft) return false;
      if (onlyViewable && !p.is_viewable) return false;
      if (
        needle &&
        !`${p.name} ${p.description || ""} ${p.version || ""}`
          .toLocaleLowerCase("tr")
          .includes(needle)
      )
        return false;
      return true;
    });
  }, [parts, q, dept, aircraft, onlyViewable]);

  async function upload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const file = fileInputRef.current?.files?.[0];

    const name = reqText(fd.get("name"), LIMITS.name);
    if (!name) {
      toast("Parça adı zorunlu.", "error");
      return;
    }
    if (!file) {
      toast("Dosya seçilmedi.", "error");
      return;
    }
    if (file.size > MAX_MB * 1048576) {
      toast(`Dosya çok büyük (max ${MAX_MB} MB).`, "error");
      return;
    }

    const ext = safeExt(file.name);
    const storagePath = `parts/${crypto.randomUUID()}.${ext}`;

    setUploading(true);
    const { error: upErr } = await supabase.storage
      .from("parts")
      .upload(storagePath, file, { cacheControl: "3600", upsert: false });

    if (upErr) {
      setUploading(false);
      toast("Yükleme hatası: " + upErr.message, "error");
      return;
    }

    const payload = {
      name,
      dept: oneOf(fd.get("dept"), PART_DEPTS, "ortak"),
      aircraft: trimTo(fd.get("aircraft"), 80),
      version: trimTo(fd.get("version"), 40) || "v1",
      description: trimTo(fd.get("description"), LIMITS.shortText),
      file_path: storagePath,
      file_name: safeFileName(file.name),
      file_ext: ext,
      file_size: file.size,
      is_viewable: VIEWABLE_EXTS.includes(ext),
      created_by: userId,
    };

    const { data, error: dbErr } = await supabase
      .from("parts")
      .insert([payload])
      .select();
    setUploading(false);

    if (dbErr) {
      // Kayıt açılamadıysa yüklenen dosyayı geri al
      await supabase.storage.from("parts").remove([storagePath]);
      toast("Kaydedilemedi: " + dbErr.message, "error");
      return;
    }

    logAction(supabase, "create", "parts", data?.[0]?.id ?? null, { name, ext });
    toast(
      payload.is_viewable
        ? "Parça yüklendi — 3D görüntülenebilir."
        : "Parça yüklendi."
    );
    form.reset();
    setFileHint(null);
    setFormOpen(false);
    load();
  }

  /** Görüntüleyici için imzalı URL — PartViewer'a geçilir */
  const getSignedUrl = useCallback(
    async (path: string) => {
      const { data, error } = await supabase.storage
        .from("parts")
        .createSignedUrl(path, 900);
      if (error || !data) return null;
      return data.signedUrl;
    },
    [supabase]
  );

  async function download(p: Part) {
    // Büyük dosyalar için indirme süresine göre geçerlilik ver
    const validity = Math.max(
      300,
      Math.ceil(((p.file_size || 0) / 1048576) * 20)
    );
    const { data, error } = await supabase.storage
      .from("parts")
      .createSignedUrl(p.file_path, validity);
    if (error || !data) {
      toast("İndirme bağlantısı oluşturulamadı.", "error");
      return;
    }
    const a = document.createElement("a");
    a.href = data.signedUrl;
    a.download = safeFileName(p.file_name);
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function doDelete() {
    if (!delTarget) return;
    await supabase.storage.from("parts").remove([delTarget.file_path]);
    const { error } = await supabase.from("parts").delete().eq("id", delTarget.id);
    if (selected?.id === delTarget.id) setSelected(null);
    if (error) toast("Silinemedi: " + error.message, "error");
    else {
      logAction(supabase, "delete", "parts", delTarget.id, {
        name: delTarget.name,
      });
      toast("Parça silindi.");
    }
    setDelTarget(null);
    load();
  }

  const viewableCount = parts.filter((p) => p.is_viewable).length;

  return (
    <>
      <PageHeader
        title="Parçalar (3D)"
        desc="Takımın CAD parça arşivi. Tüm üyeler görüntüleyip indirebilir; yükleme teknik departmanlara açıktır."
      >
        {canWrite && (
          <Button onClick={() => setFormOpen(true)}>
            <Plus size={16} />
            Parça Yükle
          </Button>
        )}
      </PageHeader>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Tile icon={<Box size={18} />} label="Toplam Parça" value={String(parts.length)} />
        <Tile icon={<Eye size={18} />} label="3D Görüntülenebilir" value={String(viewableCount)} />
        <Tile
          icon={<Download size={18} />}
          label="Toplam Boyut"
          value={`${(
            parts.reduce((a, p) => a + Number(p.file_size || 0), 0) / 1048576
          ).toFixed(0)} MB`}
        />
      </div>

      {/* 3D Görüntüleyici — bir parça seçilince açılır */}
      {selected && (
        <div className="mb-5 rounded-2xl border border-line bg-bg-1 p-4">
          <PartViewer
            part={selected}
            getUrl={getSignedUrl}
            onClose={() => setSelected(null)}
          />
        </div>
      )}

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
              placeholder="Parça ara…"
              className="field !pl-9"
            />
          </div>
          <select value={dept} onChange={(e) => setDept(e.target.value)} className="field !w-auto">
            <option value="">Tüm departmanlar</option>
            {PART_DEPTS.map((k) => (
              <option key={k} value={k}>{DEPT_LABELS[k] || k}</option>
            ))}
          </select>
          <select
            value={aircraft}
            onChange={(e) => setAircraft(e.target.value)}
            className="field !w-auto"
          >
            <option value="">Tüm platformlar</option>
            {FLEET.map((f) => (
              <option key={f.name} value={f.name}>{f.name}</option>
            ))}
          </select>
          <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-ink-2">
            <input
              type="checkbox"
              checked={onlyViewable}
              onChange={(e) => setOnlyViewable(e.target.checked)}
              className="size-4 accent-[var(--accent)]"
            />
            Sadece 3D
          </label>
          <span className="ml-auto text-xs text-ink-3">{filtered.length} parça</span>
        </div>

        {loading ? (
          <div className="px-5 py-16 text-center text-sm text-ink-3">Yükleniyor…</div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Box size={30} />}
            title={parts.length === 0 ? "Henüz parça yok" : "Sonuç bulunamadı"}
            desc={
              parts.length === 0
                ? canWrite
                  ? "İlk CAD dosyanızı yükleyerek arşivi başlatın (STL, OBJ, GLB…)."
                  : "Teknik departmanlar parça yükledikçe burada görünecek."
                : "Filtreleri değiştirmeyi deneyin."
            }
            action={
              parts.length === 0 && canWrite ? (
                <Button onClick={() => setFormOpen(true)}>
                  <Plus size={16} />
                  Parça Yükle
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((p) => (
              <article
                key={p.id}
                onClick={() => p.is_viewable && setSelected(p)}
                className={`flex flex-col rounded-xl border bg-bg p-4 transition-all ${
                  selected?.id === p.id
                    ? "border-accent ring-2 ring-[color:var(--accent-soft)]"
                    : p.is_viewable
                      ? "cursor-pointer border-accent/30 hover:border-accent hover:shadow-[var(--shadow-sm)]"
                      : "border-line"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="min-w-0 flex-1 truncate font-semibold text-ink" title={p.name}>
                    {p.name}
                  </h3>
                  <span className="flex shrink-0 items-center gap-1.5">
                    {p.is_viewable && <Badge tone="accent">3D</Badge>}
                    <Badge tone="neutral">
                      {(p.file_ext || "").toUpperCase()}
                    </Badge>
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap gap-1.5">
                  {p.aircraft && <Badge tone="info">{p.aircraft}</Badge>}
                  {p.dept && <Badge tone="neutral">{DEPT_LABELS[p.dept] || p.dept}</Badge>}
                  {p.version && <Badge tone="neutral">{p.version}</Badge>}
                </div>

                {p.description && (
                  <p className="mt-3 line-clamp-2 text-[12.5px] leading-relaxed text-ink-3">
                    {p.description}
                  </p>
                )}

                <div className="mt-auto flex items-center justify-between gap-2 border-t border-line pt-3 text-[12px] text-ink-3">
                  <span>
                    {p.file_size
                      ? `${(p.file_size / 1048576).toFixed(2)} MB`
                      : "—"}{" "}
                    · {fmtDate(p.created_at)}
                  </span>
                  <span className="flex gap-1">
                    {p.is_viewable && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelected(p);
                        }}
                        aria-label="3D görüntüle"
                        title="3D görüntüle"
                        className="flex size-7 items-center justify-center rounded-md text-accent transition-colors hover:bg-accent-soft"
                      >
                        <Eye size={14} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        download(p);
                      }}
                      aria-label="İndir"
                      title="İndir"
                      className="flex size-7 items-center justify-center rounded-md text-ink-3 transition-colors hover:bg-bg-2 hover:text-ink"
                    >
                      <Download size={14} />
                    </button>
                    {canWrite && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDelTarget(p);
                        }}
                        aria-label="Sil"
                        className="flex size-7 items-center justify-center rounded-md text-ink-3 transition-colors hover:bg-bad/12 hover:text-bad"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
      </Card>

      {canWrite && (
        <Modal open={formOpen} onClose={() => setFormOpen(false)} title="Parça Yükle">
          <form onSubmit={upload} className="space-y-4">
            <Field label="Parça adı">
              <input
                name="name"
                required
                maxLength={LIMITS.name}
                placeholder="örn. Sol kanat ana kiriş"
                className="field"
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Departman">
                <select name="dept" defaultValue="ortak" className="field">
                  {PART_DEPTS.map((k) => (
                    <option key={k} value={k}>{DEPT_LABELS[k] || k}</option>
                  ))}
                </select>
              </Field>
              <Field label="Platform">
                <select name="aircraft" defaultValue="" className="field">
                  <option value="">—</option>
                  {FLEET.map((f) => (
                    <option key={f.name} value={f.name}>{f.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Versiyon">
                <input name="version" defaultValue="v1" maxLength={40} className="field" />
              </Field>
            </div>

            <Field label="Açıklama">
              <textarea
                name="description"
                rows={2}
                maxLength={LIMITS.shortText}
                className="field resize-y"
              />
            </Field>

            <Field
              label="Dosya"
              hint={`STL, OBJ, GLB tercih edilir (max ${MAX_MB} MB)`}
            >
              <input
                ref={fileInputRef}
                type="file"
                required
                className="field !py-2"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return setFileHint(null);
                  const ext = safeExt(f.name);
                  const mb = (f.size / 1048576).toFixed(1);
                  if (f.size > MAX_MB * 1048576) {
                    setFileHint({
                      text: `Dosya çok büyük (${mb} MB) — max ${MAX_MB} MB`,
                      tone: "text-bad",
                    });
                  } else if (VIEWABLE_EXTS.includes(ext)) {
                    setFileHint({
                      text: `${ext.toUpperCase()} · ${mb} MB · 3D görüntülenebilir`,
                      tone: "text-ok",
                    });
                  } else {
                    setFileHint({
                      text: `${ext.toUpperCase()} · ${mb} MB · sadece indirme`,
                      tone: "text-warn",
                    });
                  }
                }}
              />
            </Field>
            {fileHint && (
              <p className={`-mt-2 text-[12.5px] ${fileHint.tone}`}>{fileHint.text}</p>
            )}

            <div className="flex justify-end gap-2.5 pt-1">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                Vazgeç
              </Button>
              <Button type="submit" disabled={uploading}>
                {uploading && <Loader2 size={15} className="animate-spin" />}
                {uploading ? "Yükleniyor…" : <><Upload size={15} />Yükle</>}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      <ConfirmDialog
        open={!!delTarget}
        message={`"${delTarget?.name}" parçası ve dosyası kalıcı olarak silinecek.`}
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
