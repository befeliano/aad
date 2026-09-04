"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Upload,
  Trash2,
  Download,
  ExternalLink,
  Link2,
  ImageIcon,
  Film,
  FileText,
  Loader2,
  Search,
  Plus,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { fmtDate } from "@/lib/format";
import {
  safeUrl,
  openExternal,
  safeExt,
  safeFileName,
  reqText,
  trimTo,
  LIMITS,
} from "@/lib/security";
import type { MediaAsset } from "@/lib/types";
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

const CATEGORIES: Record<string, string> = {
  foto: "Fotoğraf",
  video: "Video",
  logo: "Logo",
  sunum: "Sunum",
  sablon: "Şablon",
  sozlesme: "Sözleşme",
  diger: "Diğer",
};

const IMAGE_EXT = ["jpg", "jpeg", "png", "webp", "gif", "avif", "heic"];
const VIDEO_EXT = ["mp4", "webm", "mov", "m4v"];

const MAX_MB = 50;

function extOf(name: string) {
  return safeExt(name);
}
function kindOf(m: MediaAsset): "image" | "video" | "file" {
  const e = (m.file_ext || extOf(m.file_name || "")).toLowerCase();
  if (IMAGE_EXT.includes(e)) return "image";
  if (VIDEO_EXT.includes(e)) return "video";
  return "file";
}
function guessCategory(file: File): string {
  const e = extOf(file.name);
  if (IMAGE_EXT.includes(e)) return "foto";
  if (VIDEO_EXT.includes(e)) return "video";
  if (["pdf", "ppt", "pptx", "key"].includes(e)) return "sunum";
  return "diger";
}
function oneOfCategory(v: FormDataEntryValue | null): string {
  const s = typeof v === "string" ? v : "";
  return Object.keys(CATEGORIES).includes(s) ? s : "diger";
}
function humanSize(bytes: number | null | undefined) {
  const b = Number(bytes || 0);
  if (!b) return "—";
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
}

export function MedyaClient({ userId }: { userId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const { toast } = useToast();

  const [items, setItems] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [cat, setCat] = useState("");
  const [q, setQ] = useState("");

  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [dragOver, setDragOver] = useState(false);
  const [delTarget, setDelTarget] = useState<MediaAsset | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("media_assets")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast("Materyaller yüklenemedi: " + error.message, "error");
      setLoading(false);
      return;
    }
    const list = (data as MediaAsset[]) || [];
    setItems(list);
    setLoading(false);

    /* Görsel/video önizlemeleri için imzalı URL üret */
    const media = list.filter((m) => m.file_path && kindOf(m) !== "file");
    if (media.length) {
      const { data: signed } = await supabase.storage
        .from("media")
        .createSignedUrls(
          media.map((m) => m.file_path as string),
          3600
        );
      if (signed) {
        const map: Record<string, string> = {};
        signed.forEach((s, i) => {
          if (s.signedUrl) map[media[i].id] = s.signedUrl;
        });
        setPreviews(map);
      }
    }
  }, [supabase, toast]);

  useEffect(() => {
    /* load() asenkrondur: setState ancak ağ yanıtı geldikten sonra
       çalışır, dolayısıyla senkron bir render zinciri oluşmaz. */
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const ch = supabase
      .channel("realtime:media_assets")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "media_assets" },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [supabase, load]);

  /* ---------- yükleme ---------- */
  const uploadFiles = useCallback(
    async (files: File[]) => {
      const valid = files.filter((f) => {
        if (f.size > MAX_MB * 1048576) {
          toast(`"${f.name}" çok büyük (max ${MAX_MB} MB).`, "error");
          return false;
        }
        return true;
      });
      if (!valid.length) return;

      setUploading(true);
      setProgress({ done: 0, total: valid.length });
      let ok = 0;

      for (const file of valid) {
        const ext = extOf(file.name);
        const path = `media/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("media")
          .upload(path, file, { upsert: false, contentType: file.type });

        if (upErr) {
          toast(`"${file.name}" yüklenemedi: ${upErr.message}`, "error");
          setProgress((p) => ({ ...p, done: p.done + 1 }));
          continue;
        }

        const { error: dbErr } = await supabase.from("media_assets").insert([
          {
            title: safeFileName(file.name.replace(/\.[^.]+$/, "")).slice(0, LIMITS.title),
            category: guessCategory(file),
            description: null,
            external_url: null,
            file_path: path,
            file_name: safeFileName(file.name),
            file_ext: ext,
            file_size: file.size,
            created_by: userId,
          },
        ]);

        if (dbErr) {
          // Kayıt açılamadıysa yüklenen dosyayı geri al
          await supabase.storage.from("media").remove([path]);
          toast(`"${file.name}" kaydedilemedi: ${dbErr.message}`, "error");
        } else {
          ok++;
        }
        setProgress((p) => ({ ...p, done: p.done + 1 }));
      }

      setUploading(false);
      if (ok > 0) toast(`${ok} dosya yüklendi.`);
      load();
    },
    [supabase, userId, toast, load]
  );

  async function addLink(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const url = safeUrl(reqText(fd.get("external_url"), LIMITS.url));
    const title = reqText(fd.get("title"), LIMITS.title);
    if (!title) {
      toast("Başlık zorunlu.", "error");
      return;
    }
    if (!url) {
      toast("Geçerli bir http(s) bağlantısı girin.", "error");
      return;
    }
    const { error } = await supabase.from("media_assets").insert([
      {
        title,
        category: oneOfCategory(fd.get("category")),
        description: trimTo(fd.get("description"), LIMITS.shortText),
        external_url: url,
        created_by: userId,
      },
    ]);
    if (error) {
      toast("Eklenemedi: " + error.message, "error");
      return;
    }
    toast("Bağlantı eklendi.");
    setLinkOpen(false);
    load();
  }

  async function doDelete() {
    if (!delTarget) return;
    if (delTarget.file_path) {
      await supabase.storage.from("media").remove([delTarget.file_path]);
    }
    const { error } = await supabase
      .from("media_assets")
      .delete()
      .eq("id", delTarget.id);
    if (error) toast("Silinemedi: " + error.message, "error");
    else toast("Materyal silindi.");
    setDelTarget(null);
    load();
  }

  async function download(m: MediaAsset) {
    if (m.external_url) {
      if (!openExternal(m.external_url)) {
        toast("Bu bağlantı güvenli değil, açılmadı.", "error");
      }
      return;
    }
    if (!m.file_path) return;
    const { data, error } = await supabase.storage
      .from("media")
      .createSignedUrl(m.file_path, 300);
    if (error || !data) {
      toast("İndirme bağlantısı oluşturulamadı.", "error");
      return;
    }
    const a = document.createElement("a");
    a.href = data.signedUrl;
    a.download = safeFileName(m.file_name);
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  const filtered = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase("tr");
    return items.filter((m) => {
      if (cat && m.category !== cat) return false;
      if (
        needle &&
        !`${m.title} ${m.description || ""} ${m.file_name || ""}`
          .toLocaleLowerCase("tr")
          .includes(needle)
      )
        return false;
      return true;
    });
  }, [items, cat, q]);

  const counts = useMemo(() => {
    const photos = items.filter((m) => kindOf(m) === "image").length;
    const videos = items.filter((m) => kindOf(m) === "video").length;
    return { photos, videos, total: items.length };
  }, [items]);

  return (
    <>
      <PageHeader
        title="Medya & Materyaller"
        desc="Fotoğraf, video, logo, sunum ve sözleşmeleri buraya yükleyin. Takımın tüm görsel arşivi burada."
      >
        <Button variant="outline" size="md" onClick={() => setLinkOpen(true)}>
          <Link2 size={15} />
          Bağlantı ekle
        </Button>
        <Button onClick={() => fileRef.current?.click()} disabled={uploading}>
          {uploading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Upload size={16} />
          )}
          {uploading
            ? `Yükleniyor ${progress.done}/${progress.total}`
            : "Dosya Yükle"}
        </Button>
      </PageHeader>

      <input
        ref={fileRef}
        type="file"
        multiple
        hidden
        accept="image/*,video/*,.pdf,.ppt,.pptx,.doc,.docx,.ai,.psd,.svg,.zip"
        onChange={(e) => {
          const fs = Array.from(e.target.files || []);
          if (fs.length) uploadFiles(fs);
          e.target.value = "";
        }}
      />

      {/* Sürükle-bırak alanı */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const fs = Array.from(e.dataTransfer.files || []);
          if (fs.length) uploadFiles(fs);
        }}
        onClick={() => !uploading && fileRef.current?.click()}
        className={`mb-6 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
          dragOver ? "border-accent bg-accent-soft" : "border-line-2 bg-bg-1"
        }`}
      >
        <Upload size={24} className="text-ink-3" />
        <p className="mt-3 text-sm font-semibold text-ink">
          Fotoğraf ve videoları buraya sürükleyin
        </p>
        <p className="mt-1 text-[13px] text-ink-3">
          veya tıklayıp seçin · birden fazla dosya · dosya başına max {MAX_MB} MB
        </p>
        {uploading && (
          <div className="mt-4 h-1.5 w-56 overflow-hidden rounded-full bg-bg-3">
            <div
              className="h-full bg-accent transition-all"
              style={{
                width: `${(progress.done / Math.max(1, progress.total)) * 100}%`,
              }}
            />
          </div>
        )}
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4">
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3"
            />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Materyal ara…"
              className="field !pl-9"
            />
          </div>
          <select
            value={cat}
            onChange={(e) => setCat(e.target.value)}
            className="field !w-auto"
          >
            <option value="">Tüm kategoriler</option>
            {Object.entries(CATEGORIES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <div className="ml-auto flex items-center gap-3 text-xs text-ink-3">
            <span className="inline-flex items-center gap-1">
              <ImageIcon size={13} />
              {counts.photos}
            </span>
            <span className="inline-flex items-center gap-1">
              <Film size={13} />
              {counts.videos}
            </span>
            <span>{filtered.length} kayıt</span>
          </div>
        </div>

        {loading ? (
          <div className="px-5 py-16 text-center text-sm text-ink-3">
            Yükleniyor…
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<ImageIcon size={30} />}
            title={items.length === 0 ? "Henüz materyal yok" : "Sonuç yok"}
            desc={
              items.length === 0
                ? "İlk fotoğraf veya videonuzu yükleyerek arşivi başlatın."
                : "Filtreleri değiştirmeyi deneyin."
            }
            action={
              items.length === 0 ? (
                <Button onClick={() => fileRef.current?.click()}>
                  <Plus size={16} />
                  Dosya Yükle
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((m) => {
              const kind = kindOf(m);
              const src = previews[m.id];
              return (
                <figure
                  key={m.id}
                  className="group overflow-hidden rounded-xl border border-line bg-bg"
                >
                  <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-bg-2">
                    {kind === "image" && src ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={src}
                        alt={m.title}
                        loading="lazy"
                        className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : kind === "video" && src ? (
                      <video
                        src={src}
                        controls
                        preload="metadata"
                        className="size-full object-cover"
                      />
                    ) : m.external_url ? (
                      <ExternalLink size={26} className="text-ink-3" />
                    ) : (
                      <FileText size={26} className="text-ink-3" />
                    )}
                    <span className="absolute left-2 top-2">
                      <Badge tone={kind === "image" ? "info" : kind === "video" ? "accent" : "neutral"}>
                        {CATEGORIES[m.category] || m.category}
                      </Badge>
                    </span>
                  </div>

                  <figcaption className="p-3.5">
                    <div className="truncate text-[13.5px] font-semibold text-ink" title={m.title}>
                      {m.title}
                    </div>
                    <div className="mt-0.5 text-[11.5px] text-ink-3">
                      {m.external_url
                        ? "Harici bağlantı"
                        : humanSize(m.file_size)}{" "}
                      · {fmtDate(m.created_at)}
                    </div>
                    <div className="mt-3 flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => download(m)}
                        className="flex size-7 items-center justify-center rounded-md text-ink-3 transition-colors hover:bg-bg-2 hover:text-ink"
                        aria-label={m.external_url ? "Aç" : "İndir"}
                        title={m.external_url ? "Aç" : "İndir"}
                      >
                        {m.external_url ? (
                          <ExternalLink size={14} />
                        ) : (
                          <Download size={14} />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setDelTarget(m)}
                        className="ml-auto flex size-7 items-center justify-center rounded-md text-ink-3 transition-colors hover:bg-bad/12 hover:text-bad"
                        aria-label="Sil"
                        title="Sil"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </figcaption>
                </figure>
              );
            })}
          </div>
        )}
      </Card>

      {/* Harici bağlantı ekle */}
      <Modal
        open={linkOpen}
        onClose={() => setLinkOpen(false)}
        title="Harici Bağlantı Ekle"
      >
        <form onSubmit={addLink} className="space-y-4">
          <Field label="Başlık">
            <input name="title" required className="field" placeholder="örn. Tanıtım filmi 2026" />
          </Field>
          <Field label="Bağlantı" hint="Drive, YouTube, Vimeo vb.">
            <input
              name="external_url"
              type="url"
              required
              className="field"
              placeholder="https://…"
            />
          </Field>
          <Field label="Kategori">
            <select name="category" defaultValue="video" className="field">
              {Object.entries(CATEGORIES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Açıklama">
            <textarea name="description" rows={2} className="field resize-y" />
          </Field>
          <div className="flex justify-end gap-2.5 pt-1">
            <Button type="button" variant="outline" onClick={() => setLinkOpen(false)}>
              Vazgeç
            </Button>
            <Button type="submit">Ekle</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!delTarget}
        message={`"${delTarget?.title}" kalıcı olarak silinecek${
          delTarget?.file_path ? " (dosya dahil)" : ""
        }. Bu işlem geri alınamaz.`}
        onConfirm={doDelete}
        onCancel={() => setDelTarget(null)}
      />
    </>
  );
}
