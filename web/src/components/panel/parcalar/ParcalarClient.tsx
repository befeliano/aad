"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  Plus,
  Folder,
  FolderPlus,
  ChevronLeft,
  ChevronRight,
  Search,
  Trash2,
  Download,
  Box,
  Upload,
  Loader2,
  Eye,
} from "lucide-react";
import { useKaliciFiltre } from "@/lib/useKaliciFiltre";
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
  const [q, setQ] = useKaliciFiltre("parcalar.q", "");
  const [dept, setDept] = useKaliciFiltre("parcalar.dept", "");
  const [onlyViewable, setOnlyViewable] = useKaliciFiltre("parcalar.onlyViewable", false);
  /* null = klasör listesi görünümü, "" = Klasörsüz, "DABAN" = o klasör */
  const [openFolder, setOpenFolder] = useState<string | null>(null);
  /* "Klasör oluştur" ile girilen ad — yükleme formuna ön dolgu olarak geçer */
  const [draftFolder, setDraftFolder] = useState("");

  const [selected, setSelected] = useState<Part | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
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

  /* Klasörler = parts.aircraft alanının benzersiz değerleri.
     Ayrı bir tablo tutmuyoruz; klasör, içine ilk dosya yüklendiğinde var olur. */
  const folders = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of parts) {
      const key = (p.aircraft || "").trim();
      m.set(key, (m.get(key) || 0) + 1);
    }
    return [...m.entries()]
      .sort((a, b) => (a[0] === "" ? 1 : b[0] === "" ? -1 : a[0].localeCompare(b[0], "tr")));
  }, [parts]);

  /* Bilinen tüm klasör adları — yükleme formundaki öneri listesi */
  const folderNames = useMemo(() => {
    const set = new Set<string>(FLEET.map((f) => f.name));
    for (const [k] of folders) if (k) set.add(k);
    return [...set].sort((a, b) => a.localeCompare(b, "tr"));
  }, [folders]);

  /* Arama yazılmışsa klasörden bağımsız düz listeye düşülür */
  const searching = q.trim().length > 0;

  const filtered = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase("tr");
    return parts.filter((p) => {
      if (dept && p.dept !== dept) return false;
      if (!searching && openFolder !== null && (p.aircraft || "") !== openFolder)
        return false;
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
  }, [parts, q, dept, onlyViewable, openFolder, searching]);

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
    // Yüklenen dosyanın klasörüne gir ki kullanıcı sonucu hemen görsün
    setOpenFolder(payload.aircraft || "");
    setDraftFolder("");
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
          <>
            <Button
              variant="outline"
              onClick={() => {
                setDraftFolder("");
                setNewFolderOpen(true);
              }}
            >
              <FolderPlus size={16} />
              Klasör Oluştur
            </Button>
            <Button onClick={() => setFormOpen(true)}>
              <Plus size={16} />
              Parça Yükle
            </Button>
          </>
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
          {openFolder !== null && !searching && (
            <button
              type="button"
              onClick={() => setOpenFolder(null)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink-2 transition-colors hover:border-ink-3 hover:text-ink"
            >
              <ChevronLeft size={15} />
              Klasörler
            </button>
          )}
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
        ) : openFolder === null && !searching ? (
          /* --- Klasör görünümü --- */
          <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-4">
            {folders.map(([ad, adet]) => (
              <button
                key={ad || "__yok__"}
                type="button"
                onClick={() => setOpenFolder(ad)}
                className="group flex items-center gap-3 rounded-xl border border-line bg-bg p-4 text-left transition-all hover:border-accent hover:shadow-[var(--shadow-sm)]"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
                  <Folder size={19} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold text-ink">
                    {ad || "Klasörsüz"}
                  </span>
                  <span className="block text-[12.5px] text-ink-3">
                    {adet} parça
                  </span>
                </span>
                <ChevronRight
                  size={16}
                  className="shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5"
                />
              </button>
            ))}
          </div>
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
              <Field
                label="Klasör"
                hint="Var olanı seçin ya da yeni bir ad yazın — klasör ilk dosyayla oluşur."
              >
                <input
                  name="aircraft"
                  list="parca-klasorleri"
                  defaultValue={draftFolder || (openFolder ?? "")}
                  maxLength={80}
                  placeholder="örn. DABAN"
                  className="field"
                />
                <datalist id="parca-klasorleri">
                  {folderNames.map((n) => (
                    <option key={n} value={n} />
                  ))}
                </datalist>
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

      {/* --- Klasör oluştur --- */}
      <Modal
        open={newFolderOpen}
        onClose={() => setNewFolderOpen(false)}
        title="Klasör Oluştur"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const ad = draftFolder.trim().slice(0, 80);
            if (!ad) return;
            setNewFolderOpen(false);
            setOpenFolder(ad);
            setFormOpen(true);
          }}
          className="space-y-5"
        >
          <Field
            label="Klasör adı"
            hint="Klasör, içine ilk dosya yüklendiğinde kalıcı olur. Kaydetmeden çıkarsanız oluşmaz."
          >
            <input
              autoFocus
              value={draftFolder}
              onChange={(e) => setDraftFolder(e.target.value)}
              maxLength={80}
              placeholder="örn. DORJE"
              className="field"
            />
          </Field>
          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setNewFolderOpen(false)}
            >
              Vazgeç
            </Button>
            <Button type="submit" disabled={!draftFolder.trim()}>
              <FolderPlus size={15} />
              Devam et
            </Button>
          </div>
        </form>
      </Modal>
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
