"use client";

import { useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowDown, ArrowRight, Trophy } from "lucide-react";
import { TAKIM_ISTATISTIK, TEAM } from "@/lib/constants";
import { TurkishFlag } from "@/components/ui/TurkishMarks";

/**
 * Apple tarzı scroll hero.
 * Kaydırdıkça medya sahnesi büyüyüp kadrajı doldurur; başlık ayrı katmanda
 * yukarı süzülür. Gerçek hero görseli/videosu MediaStage içine konur.
 */
export interface HeroMedia {
  type: "video" | "image";
  src?: string;
  srcLight?: string;
  srcDark?: string;
}

export function HeroScroll({ media }: { media?: HeroMedia | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  // Animasyonların tamamlanma aralığını 0.9'dan 0.5 - 0.6 bandına çekin:
  const stageScale = useTransform(scrollYProgress, [0, 0.6], [0.96, 1.12]);
  /* PERFORMANS: borderRadius artık kaydırmayla değişmiyor.
     `scale` derleyici (compositor) katmanında çalışır, bedava sayılır;
     borderRadius ise BOYAMA katmanındadır ve her karede kadrajın ve
     içindeki büyük görselin yeniden çizilmesine yol açıyordu. Kasmanın
     asıl kaynağı buydu — yarıçap sabit bir sınıfa alındı. */
  const titleY = useTransform(scrollYProgress, [0, 0.2], [0, -180]);
  const titleOpacity = useTransform(scrollYProgress, [0, 0.12], [1, 0]);
  const footOpacity = useTransform(scrollYProgress, [0, 0.15], [1, 0]);
  const footY = useTransform(scrollYProgress, [0, 0.25], [0, -50]);

  return (
    // 210vh yerine 130vh veya 140vh: Kaydırma yolunu neredeyse yarı yarıya kısaltır
    <section ref={ref} className="relative h-[130vh]">
      {/* Mobilde dikey akış: kadraj → butonlar → boşluk → istatistikler.
          sm ve üstünde butonlar/istatistikler tekrar kadrajın üzerine biner. */}
      <div className="sticky top-0 flex h-screen flex-col items-center justify-center gap-5 overflow-hidden pt-16 sm:gap-0">
        {/* Zemin */}
        <div className="absolute inset-0 bg-bg">
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 110% 75% at 50% -8%, var(--hero-glow), transparent 62%)",
            }}
          />
        </div>

        {/* Medya sahnesi */}
        <motion.div
          style={{ scale: stageScale, willChange: "transform" }}
          /* Mobilde sabit 50vh — altına buton ve istatistikler sığsın.
             sm üstünde 52.9vw (= 94vw'nin 16:9 karşılığı) ile 80vh'nin küçüğü:
             geniş ekranda navbar payından sonra kalan alanı doldurur. */
          className="relative h-[50vh] w-[94vw] shrink-0 overflow-hidden rounded-2xl border border-line-2 bg-bg-2 shadow-[var(--shadow)] sm:h-[min(80vh,52.9vw)]"
        >
          {media ? (
            media.type === "video" && media.src ? (
              <video
                src={media.src}
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                className="absolute inset-0 size-full object-cover"
              />
            ) : media.srcLight && media.srcDark ? (
                <>
                  <Image
                    src={media.srcLight}
                    alt="Anatolia Aero Design"
                    fill
                    priority
                    sizes="(max-width: 640px) 94vw, 55vw"
                    className="absolute inset-0 object-cover transition-opacity duration-1000"
                    style={{ opacity: "var(--hero-light-op)" }}
                  />
                  <Image
                    src={media.srcDark}
                    alt="Anatolia Aero Design"
                    fill
                    priority
                    sizes="(max-width: 640px) 94vw, 55vw"
                    className="absolute inset-0 object-cover transition-opacity duration-1000"
                    style={{ opacity: "var(--hero-dark-op)" }}
                  />
                </>
              ) : media.src ? (
              <Image
                src={media.src}
                alt="Anatolia Aero Design — gün batımında test uçuşu"
                fill
                priority
                sizes="(max-width: 640px) 94vw, 55vw"
                className="object-cover"
              />
            ) : null // Eğer hiçbir src yoksa boş yere Image basmaya çalışıp preload hatası verdirmesin
          ) : (
            <>
              {/* public/images/hero/hero.jpg (veya .mp4) eklenince otomatik kullanılır */}
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(140deg, var(--bg-3) 0%, var(--bg-2) 45%, var(--bg-1) 100%)",
                }}
              />
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "radial-gradient(circle at 68% 34%, var(--accent-soft), transparent 58%)",
                }}
              />
              <PlaneSilhouette className="absolute left-1/2 top-1/2 w-[44%] -translate-x-1/2 -translate-y-1/2 text-ink opacity-[0.07]" />
              <div className="absolute left-5 top-4 flex items-center gap-2">
                <span className="size-1.5 animate-pulse rounded-full bg-accent" />
                <span className="eyebrow !text-[10px]">
                  Hero görseli · medya alanı
                </span>
              </div>
            </>
          )}

          {/* Okunurluk için seçici karartma — gün batımı renkleri korunsun */}
          {media && (
            <>
              <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-transparent to-black/65" />
              {/* Başlığın oturduğu banda odaklı perde — yazı her koşulda okunsun */}
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "radial-gradient(ellipse 70% 42% at 50% 38%, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0.35) 55%, transparent 80%)",
                }}
              />
              {/* Aviyonik HUD hissi — yavaşça tarayan ufuk çizgisi */}
              <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="scanline h-px w-full bg-gradient-to-r from-transparent via-accent-2 to-transparent" />
              </div>
              <HudCorners />
            </>
          )}
        </motion.div>

        {/* Başlık katmanı */}
        <motion.div
          style={{ y: titleY, opacity: titleOpacity }}
          className="pointer-events-none absolute inset-x-0 top-[26vh] z-10 flex flex-col items-center px-5 text-center"
        >
          <div className="mb-5 flex items-center rounded-full border border-line-2 bg-bg/70 px-4 py-1.5 backdrop-blur-md">
            <TurkishFlag className="mr-2 h-3 w-[18px] shrink-0 rounded-[2px]" />
            <span className="eyebrow !text-[10.5px]">
              EST. {TEAM.founded} · {TEAM.university}
            </span>
          </div>

          {/* Şampiyonluk rozetleri — sponsorun ilk gördüğü şey */}
          <div className="mb-6 flex flex-wrap items-center justify-center gap-2">
            {[
              "Teknofest 2022 · Türkiye 1.",
              "SAE Aero Design 2017 · Dünya 1.",
              "Teknofest 2018 · Türkiye 1.",
            ].map((b) => (
              <span
                key={b}
                className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-black/45 px-3.5 py-1.5 text-[11.5px] font-semibold text-white backdrop-blur-md sm:text-[12.5px]"
              >
                <Trophy size={12} className="text-accent-2" />
                {b}
              </span>
            ))}
          </div>
          <h1
            className={`display-tight ${media ? "text-white" : "text-ink"}`}
            style={{
              // Tailwind arbitrary değerinde virgül sorun çıkarıyordu — inline
              fontSize: "clamp(2.2rem, 7.6vw, 6.2rem)",
              textShadow: media
                ? "0 2px 28px rgba(0,0,0,0.85), 0 1px 3px rgba(0,0,0,0.6)"
                : undefined,
            }}
          >
            Gökyüzünü
            <br />
            <span
              style={{
                color: media ? "#ff5560" : "var(--accent)",
                textShadow: media
                  ? "0 2px 28px rgba(0,0,0,0.9), 0 1px 3px rgba(0,0,0,0.7)"
                  : undefined,
              }}
            >
              tasarlıyoruz.
            </span>
          </h1>
        </motion.div>

        {/* Alt katman */}
        <motion.div
          style={{ y: footY, opacity: footOpacity }}
          className="relative z-10 flex w-full flex-col items-center gap-6 px-5 sm:absolute sm:inset-x-0 sm:bottom-8 sm:gap-5"
        >
          <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-2.5">
            <Link
              href="/sponsorluk"
              className="group inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-[13px] font-semibold text-white shadow-[var(--shadow)] transition-transform hover:scale-[1.03]"
            >
              Sponsor Ol
              <ArrowRight
                size={15}
                className="transition-transform group-hover:translate-x-0.5"
              />
            </Link>
            <Link
              href="/#filo"
              className="rounded-full border border-line-2 bg-bg/70 px-5 py-2.5 text-[13px] font-semibold text-ink backdrop-blur-md transition-colors hover:border-ink-3"
            >
              Filoyu Keşfet
            </Link>
          </div>

          <div className="grid w-full max-w-lg grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-4">
            <Stat num={TAKIM_ISTATISTIK.sampiyonluk} label="Şampiyonluk" />
            <Stat num={TAKIM_ISTATISTIK.uye} label="Takım Üyesi" />
            <Stat num={TAKIM_ISTATISTIK.mezun} label="Mezun" />
            <Stat num={TAKIM_ISTATISTIK.kurulus} label="Kuruluş" />
          </div>

          <div className="flex items-center gap-2 text-ink-3">
            <ArrowDown size={13} className="animate-bounce" />
            <span className="eyebrow !text-[10px]">Kaydır</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function Stat({ num, label }: { num: string; label: string }) {
  return (
    <div className="bg-bg/80 px-2.5 py-3 text-center backdrop-blur-md">
      <div className="display tabular text-lg text-ink sm:text-xl">{num}</div>
      <div className="eyebrow mt-1 !text-[8.5px]">{label}</div>
    </div>
  );
}

function PlaneSilhouette({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 120" className={className} aria-hidden="true">
      <path
        d="M100 30 L140 60 L160 70 L160 75 L140 70 L120 75 L120 90 L130 95 L130 98 L100 95 L70 98 L70 95 L80 90 L80 75 L60 70 L40 75 L40 70 L60 60 Z"
        fill="currentColor"
      />
    </svg>
  );
}

/** Kadraj köşelerine nişangâh çizgileri — aviyonik/İHA hissi */
function HudCorners() {
  const base =
    "pointer-events-none absolute size-10 border-accent-2/70 sm:size-14";
  return (
    <>
      <span className={`${base} left-4 top-4 border-l-2 border-t-2`} />
      <span className={`${base} right-4 top-4 border-r-2 border-t-2`} />
      <span className={`${base} bottom-4 left-4 border-b-2 border-l-2`} />
      <span className={`${base} bottom-4 right-4 border-b-2 border-r-2`} />
    </>
  );
}
