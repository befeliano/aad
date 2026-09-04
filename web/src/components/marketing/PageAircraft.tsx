"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

/**
 * Sayfa boyunca süzülen uçaklar.
 *
 * Tek bir bölüme hapsolmaz: ekrana sabitlenmiş bir katmanda dururlar ve
 * hareketleri TÜM SAYFA kaydırmasına kilitlidir (ScrollTrigger scrub).
 * Kaydırmayı bırakınca uçaklar da durur — kendi başına dönen animasyon yok.
 *
 * Biri sağdan, biri soldan girer; farklı hızlar derinlik hissi verir.
 */
const PLANES = [
  /* Sayfa açılır açılmaz ikisi ekranda: biri soldan sağa, biri sağdan sola.
     Diğer ikisi kaydırdıkça içeri girer. */
  {
    src: "/images/aircraft/daban.png",
    startX: 6,
    endX: 104,
    top: "18%",
    size: "w-[clamp(120px,15vw,250px)]",
    rotate: -6,
    speed: 1,
    opacity: 1,
  },
  {
    src: "/images/aircraft/harpy.png",
    startX: 82,
    endX: -30,
    top: "46%",
    size: "w-[clamp(95px,12vw,200px)]",
    rotate: 7,
    speed: 1.3,
    opacity: 1,
  },
  {
    src: "/images/aircraft/hydra.png",
    startX: -28,
    endX: 106,
    top: "70%",
    size: "w-[clamp(85px,10.5vw,175px)]",
    rotate: -4,
    speed: 0.72,
    opacity: 1,
  },
  {
    src: "/images/aircraft/golge.png",
    startX: 108,
    endX: -26,
    top: "86%",
    size: "w-[clamp(75px,9vw,150px)]",
    rotate: 9,
    speed: 1.6,
    opacity: 1,
  },
];

export function PageAircraft() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>(".pageplane").forEach((el) => {
        const speed = parseFloat(el.dataset.speed || "1") || 1;
        const startX = parseFloat(el.dataset.startx || "0");
        const endX = parseFloat(el.dataset.endx || "100");

        gsap.fromTo(
          el,
          { xPercent: 0, x: `${startX}vw`, y: 0 },
          {
            x: `${endX}vw`,
            // Yatay geçişe hafif dikey süzülme eşlik eder
            y: () => -window.innerHeight * 0.22 * speed,
            ease: "none",
            scrollTrigger: {
              /* DİKKAT: trigger olarak documentElement kullanma —
                 layout'ta html'e `h-full` verildiği için yüksekliği yalnızca
                 viewport kadardır ve "bottom bottom" anında tamamlanır.
                 Bunun yerine doğrudan sayfanın tam kaydırma aralığına
                 bağlanıyoruz. */
              start: 0,
              end: () => ScrollTrigger.maxScroll(window),
              scrub: 0.6,
              invalidateOnRefresh: true,
            },
          }
        );
      });
    }, root);

    return () => ctx.revert();
  }, []);

  return (
    <div
      ref={root}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[20] overflow-hidden"
    >
      {PLANES.map((p, i) => (
        <div
          key={`${p.src}-${i}`}
          data-startx={String(p.startX)}
          data-endx={String(p.endX)}
          data-speed={String(p.speed)}
          className={`pageplane absolute left-0 ${p.size} will-change-transform`}
          style={{ top: p.top, opacity: p.opacity }}
        >
          <Image
            src={p.src}
            alt=""
            width={900}
            height={540}
            sizes="(max-width: 760px) 30vw, 230px"
            className="h-auto w-full drop-shadow-[0_26px_44px_rgba(0,0,0,0.45)]"
            style={{ transform: `rotate(${p.rotate}deg)` }}
          />
        </div>
      ))}
    </div>
  );
}
