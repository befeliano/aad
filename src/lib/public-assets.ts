import { existsSync } from "node:fs";
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

/** Ana sayfa hero medyası: video varsa video, yoksa foto, o da yoksa null */
export function heroMedia(): { type: "video" | "image"; src: string } | null {
  const video = firstAsset("images/hero/hero", VIDEO_EXTS);
  if (video) return { type: "video", src: video };
  const image = firstAsset("images/hero/hero", IMAGE_EXTS);
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
