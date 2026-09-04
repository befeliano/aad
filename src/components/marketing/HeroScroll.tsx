"use client";

import { useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowDown, ArrowRight } from "lucide-react";
import { TAKIM_ISTATISTIK, TEAM } from "@/lib/constants";

/**
 * Apple tarzı scroll hero.
 * Kaydırdıkça medya sahnesi büyüyüp kadrajı doldurur; başlık ayrı katmanda
 * yukarı süzülür. Gerçek hero görseli/videosu MediaStage içine konur.
 */
export interface HeroMedia {
  type: "video" | "image";
  src: string;
}

export function HeroScroll({ media }: { media?: HeroMedia | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  const stageScale = useTransform(scrollYProgress, [0, 0.9], [0.78, 1.22]);
  const stageRadius = useTransform(scrollYProgress, [0, 0.9], [24, 0]);
  const titleY = useTransform(scrollYProgress, [0, 0.6], [0, -140]);
  const titleOpacity = useTransform(scrollYProgress, [0, 0.42], [1, 0]);
  const footOpacity = useTransform(scrollYProgress, [0.02, 0.32], [1, 0]);
  const footY = useTransform(scrollYProgress, [0, 0.5], [0, -50]);

  return (
    <section ref={ref} className="relative h-[210vh]">
      <div className="sticky top-0 flex h-screen items-center justify-center overflow-hidden">
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
          className="relative aspect-[16/9] w-[min(1150px,88vw)] overflow-hidden border border-line-2 bg-bg-2 shadow-[var(--shadow-lg)]"
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
            ) : (
              <Image
                src={media.src}
                alt="SHADOW MK5 — Anatolia Aero Design savaşan İHA"
                fill
                priority
                sizes="(max-width: 768px) 100vw, 1150px"
                className="object-cover"
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

          {/* Yazıların okunması için hafif karartma */}
          {media && (
            <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/15 to-black/50" />
          )}
          <div className="eyebrow absolute bottom-4 right-5 !text-[10px]">
            SHADOW MK5 · 2026
          </div>
        </motion.div>

        {/* Başlık katmanı */}
        <motion.div
          style={{ y: titleY, opacity: titleOpacity }}
          className="pointer-events-none absolute inset-x-0 top-[24vh] z-10 flex flex-col items-center px-5 text-center"
        >
          <div className="mb-6 rounded-full border border-line-2 bg-bg/70 px-4 py-1.5 backdrop-blur-md">
            <span className="eyebrow !text-[10.5px]">
              EST. {TEAM.founded} · {TEAM.university}
            </span>
          </div>
          <h1
            className={`display-tight text-[clamp(2.9rem,10vw,8.5rem)] ${
              media ? "text-white drop-shadow-[0_2px_24px_rgba(0,0,0,0.55)]" : "text-ink"
            }`}
          >
            Gökyüzünü
            <br />
            <span className="text-accent">tasarlıyoruz.</span>
          </h1>
        </motion.div>

        {/* Alt katman */}
        <motion.div
          style={{ y: footY, opacity: footOpacity }}
          className="absolute inset-x-0 bottom-9 z-10 flex flex-col items-center gap-7 px-5"
        >
          <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-2.5">
            <Link
              href="/sponsorluk"
              className="group inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white shadow-[var(--shadow)] transition-transform hover:scale-[1.03]"
            >
              Sponsor Ol
              <ArrowRight
                size={15}
                className="transition-transform group-hover:translate-x-0.5"
              />
            </Link>
            <Link
              href="/#filo"
              className="rounded-full border border-line-2 bg-bg/70 px-6 py-3 text-sm font-semibold text-ink backdrop-blur-md transition-colors hover:border-ink-3"
            >
              Filoyu Keşfet
            </Link>
          </div>

          <div className="grid w-full max-w-2xl grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-4">
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
    <div className="bg-bg/80 px-3 py-4 text-center backdrop-blur-md">
      <div className="display tabular text-2xl text-ink sm:text-3xl">{num}</div>
      <div className="eyebrow mt-1.5 !text-[9.5px]">{label}</div>
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
