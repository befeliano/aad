import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

/**
 * SUNUCU TARAFI — public/ altındaki bir dosyanın var olup olmadığını söyler.
 * Böylece takım klasöre foto attığında site otomatik onu kullanır,
 * atmadığında placeholder görünür.
 *
 * Not: Sadece güvenli karakterlere izin verilir (path traversal koruması).
 */
const SAFE = /^[a-zA-Z0-9/_.-]+$/;

export function publicAsset(relPath: string): string | null {
  if (!SAFE.test(relPath) || relPath.includes("..")) return null;
  const abs = path.join(process.cwd(), "public", relPath);
  return existsSync(abs) ? "/" + relPath.replace(/^\/+/, "") : null;
}

/**
 * Birden fazla uzantıyı sırayla dener, ilk bulduğunu döndürür.
 * örn. firstAsset("images/fleet/hydra", ["jpg","png","webp"])
 */
export function firstAsset(base: string, exts: string[]): string | null {
  for (const e of exts) {
    const hit = publicAsset(`${base}.${e}`);
    if (hit) return hit;
  }
  return null;
}

export const IMAGE_EXTS = ["jpg", "jpeg", "png", "webp", "avif"];
export const VIDEO_EXTS = ["mp4", "webm"];

/**
 * Hero slider görselleri.
 * public/images/hero/hero.jpg + hero2, hero3 … sırayla aranır;
 * yoksa galeri fotoğraflarının ilk birkaçı kullanılır.
 */
export function heroSlides(max = 5): string[] {
  const out: string[] = [];
  const first = firstAsset("images/hero/hero", IMAGE_EXTS);
  if (first) out.push(first);
  for (let i = 2; i <= max; i++) {
    const hit = firstAsset(`images/hero/hero${i}`, IMAGE_EXTS);
    if (hit) out.push(hit);
  }
  if (out.length < 2) {
    // Galeriden tamamla — slider en az birkaç kare istiyor
    for (const g of galleryPhotos()) {
      if (out.length >= 4) break;
      if (!out.includes(g.src)) out.push(g.src);
    }
  }
  return out;
}

/** Ana sayfa hero medyası: video varsa video, yoksa foto, o da yoksa null */
export function heroMedia(): { type: "video" | "image"; src?: string; srcLight?: string; srcDark?: string } | null {
  const video = firstAsset("images/hero/hero", VIDEO_EXTS);
  if (video) return { type: "video", src: video };
  
  const darkImage = firstAsset("images/hero/hero", IMAGE_EXTS);
  const lightImage = firstAsset("images/hero/hero2", IMAGE_EXTS);

  // Eğer her iki görsel de varsa ikisini de gönder
  if (darkImage && lightImage) {
    return { type: "image", srcDark: darkImage, srcLight: lightImage };
  }

  // Sadece biri varsa fallback olarak normal src gönder
  const image = darkImage || lightImage;
  if (image) return { type: "image", src: image };
  
  return null;
}

/** Uçak görseli — public/images/fleet/<slug>.<ext> */
export function fleetImage(slug: string): string | null {
  return firstAsset(`images/fleet/${slug}`, IMAGE_EXTS);
}

/** Ekip fotoğrafı — public/images/team/takim.<ext> */
export function teamImage(): string | null {
  return firstAsset("images/team/takim", IMAGE_EXTS);
}

/**
 * Ana sayfa ekip galerisi: takim1, takim2, … sırayla aranır.
 * Klasöre yeni dosya eklendikçe otomatik görünür.
 */
export function teamPhotos(max = 6): string[] {
  const out: string[] = [];
  for (let i = 1; i <= max; i++) {
    const hit = firstAsset(`images/team/takim${i}`, IMAGE_EXTS);
    if (hit) out.push(hit);
  }
  const legacy = teamImage();
  if (legacy) out.push(legacy);
  return out;
}

/**
 * Galeri fotoğrafları — public/images/gallery/ klasöründeki tüm görseller.
 * Klasöre dosya atmak yeterli; sıralama dosya adına göre.
 *
 * YILA GÖRE: fotoğrafı yıl klasörüne koyun → galeride o yılın sekmesinde
 * çıkar:  public/images/gallery/2025/teknofest-stant.jpg
 * Ya da dosya adı yılla başlasın:  2025-teknofest-stant.jpg
 * Yılı belli olmayanlar "Diğer"de görünür.
 */
export function galleryPhotos(): { src: string; alt: string; year: string | null }[] {
  const dir = path.join(process.cwd(), "public", "images", "gallery");
  const out: { src: string; alt: string; year: string | null }[] = [];
  const resim = (n: string) =>
    IMAGE_EXTS.includes(n.split(".").pop()?.toLowerCase() || "");
  const altMetni = (n: string) =>
    // "03-savasan-iha.jpg" -> "Savasan iha"
    n
      .replace(/\.[^.]+$/, "")
      .replace(/^(\d{4}[-_])?\d*-?/, "")
      .replace(/[-_]/g, " ")
      .replace(/^./, (c) => c.toUpperCase()) || "Anatolia Aero Design";

  let girdiler: import("node:fs").Dirent[] = [];
  try {
    girdiler = readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  for (const g of girdiler.sort((a, b) => a.name.localeCompare(b.name))) {
    if (g.isDirectory() && /^(19|20)\d{2}$/.test(g.name)) {
      let icerik: string[] = [];
      try {
        icerik = readdirSync(path.join(dir, g.name));
      } catch {
        continue;
      }
      for (const n of icerik.filter(resim).sort()) {
        out.push({
          src: `/images/gallery/${g.name}/${encodeURIComponent(n)}`,
          alt: altMetni(n),
          year: g.name,
        });
      }
    } else if (g.isFile() && resim(g.name)) {
      out.push({
        src: `/images/gallery/${encodeURIComponent(g.name)}`,
        alt: altMetni(g.name),
        year: g.name.match(/^((?:19|20)\d{2})[-_]/)?.[1] ?? null,
      });
    }
  }
  return out;
}

/** Başarılar bölümü görseli */
export function achievementImage(): string | null {
  return firstAsset("images/achievements/odul-toreni", IMAGE_EXTS);
}
