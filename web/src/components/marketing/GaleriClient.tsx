"use client";

import { useEffect, useMemo, useState } from "react";
import { ImageIcon, X, ExternalLink } from "lucide-react";
import { createClientSafe } from "@/lib/supabase/client";
import type { MediaAsset } from "@/lib/types";
import { TEAM } from "@/lib/constants";
import { safeUrl } from "@/lib/security";

interface GalleryItem {
  id: string;
  title: string;
  url: string;
  kind: "image" | "video";
}

const IMAGE_EXT = ["jpg", "jpeg", "png", "webp", "gif", "avif"];
const VIDEO_EXT = ["mp4", "webm", "mov"];

/**
 * Galeri — panele yüklenen foto/videoları gösterir.
 * media_assets üzerindeki RLS herkese açık okumaya izin vermiyorsa
 * boş durum gösterilir (hata fırlatılmaz).
 *
 * NOT: Bu sayfa statik olarak prerender edilir. Supabase istemcisi bilerek
 * render sırasında DEĞİL, yalnızca effect içinde (tarayıcıda) kuruluyor —
 * aksi halde ortam değişkenleri olmayan bir build ortamında (ör. Vercel'de
 * env tanımlanmadan) prerender hata verip build'i düşürür.
 */
export function GaleriClient({
  local = [],
}: {
  /** public/images/gallery/ içindeki fotoğraflar (sunucuda okundu) */
  local?: { src: string; alt: string }[];
}) {
  const [items, setItems] = useState<GalleryItem[]>([]);

  /* Yerel fotoğraflar her zaman gösterilir; panelden yüklenenler bunlara eklenir */
  const localItems: GalleryItem[] = useMemo(
    () =>
      local.map((p, i) => ({
        id: `local-${i}`,
        title: p.alt,
        url: p.src,
        kind: "image" as const,
      })),
    [local]
  );
  const all = useMemo(() => [...localItems, ...items], [localItems, items]);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState<GalleryItem | null>(null);

  useEffect(() => {
    (async () => {
      const supabase = createClientSafe();
      if (!supabase) {
        setLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from("media_assets")
        .select("*")
        .in("category", ["foto", "video"])
        .order("created_at", { ascending: false })
        .limit(60);

      if (error || !data?.length) {
        setLoading(false);
        return;
      }

      const assets = data as MediaAsset[];
      const withFiles = assets.filter((a) => a.file_path);

      const signedMap: Record<string, string> = {};
      if (withFiles.length) {
        const { data: signed } = await supabase.storage
          .from("media")
          .createSignedUrls(
            withFiles.map((a) => a.file_path as string),
            3600
          );
        if (signed) {
          signed.forEach((s, i) => {
            if (s.signedUrl) signedMap[withFiles[i].id] = s.signedUrl;
          });
        }
      }

      const out: GalleryItem[] = [];
      assets.forEach((a) => {
        const url = signedMap[a.id] || safeUrl(a.external_url);
        if (!url) return;
        const ext = (a.file_ext || "").toLowerCase();
        const kind: "image" | "video" = VIDEO_EXT.includes(ext)
          ? "video"
          : IMAGE_EXT.includes(ext)
            ? "image"
            : a.category === "video"
              ? "video"
              : "image";
        out.push({ id: a.id, title: a.title, url, kind });
      });

      setItems(out);
      setLoading(false);
    })();
  }, []);

  /* Esc ile lightbox kapansın */
  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) =>
      e.key === "Escape" && setLightbox(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox]);

  if (loading && localItems.length === 0) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="aspect-[4/3] animate-pulse rounded-2xl bg-bg-2"
          />
        ))}
      </div>
    );
  }

  if (all.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line-2 bg-bg-1 px-6 py-20 text-center">
        <ImageIcon size={30} className="text-ink-3" />
        <p className="mt-4 text-base font-bold text-ink">
          Galeri yakında dolacak
        </p>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-2">
          Takım fotoğraf ve videoları panelden yüklendiğinde burada
          görünecek. Şimdilik en güncel içeriklerimizi Instagram&apos;da
          bulabilirsiniz.
        </p>
        <a
          href={TEAM.instagramUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white transition-transform hover:scale-[1.03]"
        >
          Instagram&apos;da gör
          <ExternalLink size={15} />
        </a>
      </div>
    );
  }

  return (
    <>
      <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 [&>*]:mb-4">
        {all.map((it) => (
          <button
            key={it.id}
            type="button"
            onClick={() => setLightbox(it)}
            className="group block w-full overflow-hidden rounded-2xl border border-line bg-bg-2 text-left"
          >
            {it.kind === "video" ? (
              <video
                src={it.url}
                preload="metadata"
                muted
                className="w-full"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={it.url}
                alt={it.title}
                loading="lazy"
                className="w-full transition-transform duration-500 group-hover:scale-[1.03]"
              />
            )}
          </button>
        ))}
      </div>

      {lightbox && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            onClick={() => setLightbox(null)}
            className="absolute right-5 top-5 flex size-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            aria-label="Kapat"
          >
            <X size={20} />
          </button>
          {lightbox.kind === "video" ? (
            <video
              src={lightbox.url}
              controls
              autoPlay
              className="max-h-[88vh] max-w-full rounded-xl"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={lightbox.url}
              alt={lightbox.title}
              className="max-h-[88vh] max-w-full rounded-xl object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          )}
        </div>
      )}
    </>
  );
}
