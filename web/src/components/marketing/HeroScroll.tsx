"use client";

import { useEffect, useRef, useState } from "react";
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
  src: string;
}

export function HeroScroll({
  media,
  slides = [],
}: {
  media?: HeroMedia | null;
  /** Hero slider kareleri (public/images/hero + galeri) */
  slides?: string[];
}) {
  /* Slider — 6 saniyede bir çapraz geçiş */
  const [slide, setSlide] = useState(0);
  const hasSlider = slides.length > 1;

  useEffect(() => {
    if (!hasSlider) return;
    const id = window.setInterval(
      () => setSlide((s) => (s + 1) % slides.length),
      6000
    );
    return () => window.clearInterval(id);
  }, [hasSlider, slides.length]);

  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  const stageScale = useTransform(scrollYProgress, [0, 0.9], [0.82, 1.18]);
  const stageRadius = useTransform(scrollYProgress, [0, 0.9], [24, 0]);
  const titleY = useTransform(scrollYProgress, [0, 0.6], [0, -140]);
  const titleOpacity = useTransform(scrollYProgress, [0, 0.42], [1, 0]);
  const footOpacity = useTransform(scrollYProgress, [0.02, 0.32], [1, 0]);
  const footY = useTransform(scrollYProgress, [0, 0.5], [0, -50]);

  return (
    <section ref={ref} className="relative h-[210vh]">
      <div className="sticky top-0 flex h-screen items-center justify-center overflow-hidden pt-16">
        {/* Zemin */}
        <div className="absolute inset-0 bg-bg">
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 110% 75% at 50% -8%, var(--hero-glow), transparent 62%)",
            }}
          />
          <div className="grid-texture absolute inset-0" />
        </div>

        {/* Medya sahnesi */}
        <motion.div
          style={{ scale: stageScale, borderRadius: stageRadius }}
          className="relative aspect-[16/9] h-[min(68vh,50vw)] max-h-[68vh] w-auto max-w-[94vw] overflow-hidden border border-line-2 bg-bg-2 shadow-[var(--shadow-lg)]"
        >
          {media ? (
            media.type === "video" ? (
              <video
                src={media.src}
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                className="absolute inset-0 size-full object-cover"
              />
            ) : hasSlider ? (
              slides.map((src, i) => (
                <Image
                  key={src}
                  src={src}
                  alt={
                    i === 0
                      ? "Anatolia Aero Design — gün batımında test uçuşu"
                      : ""
                  }
                  fill
                  priority={i === 0}
                  sizes="(max-width: 768px) 100vw, 1300px"
                  className={`kenburns object-cover transition-opacity duration-[1400ms] ease-in-out ${
                    i === slide ? "opacity-100" : "opacity-0"
                  }`}
                />
              ))
            ) : (
              <Image
                src={media.src}
                alt="Anatolia Aero Design — gün batımında test uçuşu"
                fill
                priority
                sizes="(max-width: 768px) 100vw, 1300px"
                className="kenburns object-cover"
              />
            )
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
          {/* Slider göstergeleri */}
          {hasSlider && (
            <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 gap-1.5">
              {slides.map((s, i) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSlide(i)}
                  aria-label={`${i + 1}. kare`}
                  aria-current={i === slide}
                  className={`h-1.5 rounded-full transition-all ${
                    i === slide
                      ? "w-7 bg-white"
                      : "w-1.5 bg-white/45 hover:bg-white/70"
                  }`}
                />
              ))}
            </div>
          )}

          <div className="eyebrow absolute bottom-4 right-5 !text-[10px] !text-white/70">
            DABAN · 2027
          </div>
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
          className="absolute inset-x-0 bottom-8 z-10 flex flex-col items-center gap-5 px-5"
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
