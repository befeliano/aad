import { FLEET_SPRITE } from "@/lib/constants";

export interface SpriteBox {
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * Üç uçağın tek bir vektör sayfada (harpy-golge-hydra.svg) durduğu dosyadan
 * yalnızca istenen uçağı gösterir.
 *
 * Neden kırpma: dosya 4 MB'lık tek bir SVG. Üç kopya çıkarmak yerine aynı
 * dosyayı üç yerde kullanıp CSS ile kırpıyoruz — tek indirme, tarayıcı
 * önbelleğinden tekrar kullanım, her ölçekte vektör keskinliği.
 *
 * SVG'nin zemini saf siyah olduğu için görsel alanına bilinçli olarak koyu
 * bir "sahne" zemini veriyoruz; aydınlık temada da stüdyo çekimi gibi durur.
 */
export function AircraftSprite({
  box,
  alt,
  className = "",
}: {
  box: SpriteBox;
  alt: string;
  className?: string;
}) {
  const { viewW, viewH, src } = FLEET_SPRITE;

  return (
    <div
      className={`relative overflow-hidden bg-[#050505] ${className}`}
      style={{ aspectRatio: `${box.width} / ${box.height}` }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        style={{
          position: "absolute",
          // Kutu genişliği kap genişliğine oturur; diğer ölçüler ona göre
          width: `${(viewW / box.width) * 100}%`,
          height: `${(viewH / box.height) * 100}%`,
          left: `${(-box.left / box.width) * 100}%`,
          top: `${(-box.top / box.height) * 100}%`,
          maxWidth: "none",
        }}
      />
    </div>
  );
}
