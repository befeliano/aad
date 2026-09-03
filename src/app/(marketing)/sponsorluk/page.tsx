import type { Metadata } from "next";
import Link from "next/link";
import { Check, ArrowRight, FileText, ShieldCheck, Users } from "lucide-react";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "@/components/marketing/SectionHeading";
import {
  SPONSOR_STEPS,
  VISIBILITY_SURFACES,
  SPONSOR_COMMITMENTS,
  ACHIEVEMENTS,
  TEAM,
} from "@/lib/constants";

export const metadata: Metadata = {
  title: "Sponsorluk",
  description:
    "Anatolia Aero Design sponsorluğu: faturalı ve şeffaf harcama, kalem kalem raporlama, uçak gövdesinden takım tişörtüne kadar marka görünürlüğü.",
};

const REACH = [
  { num: "2x", label: "Teknofest Türkiye 1.'liği" },
  { num: "4.5K+", label: "Sosyal Medya Takipçisi" },
  { num: "6", label: "Mühendislik Departmanı" },
  { num: "10+", label: "Yıllık Takım Tecrübesi" },
];

const WHY = [
  {
    icon: ShieldCheck,
    t: "Şeffaflık",
    d: "Verdiğiniz desteğin tamamı faturalı olarak harcanır ve kalem kalem raporlanır. Kurumsal muhasebeniz için belgelenebilir bir süreç.",
  },
  {
    icon: Users,
    t: "Yetenek Havuzu",
    d: "Yazılımdan kompozite altı disiplinde çalışan mühendislik öğrencileri. Sponsorlarımız için doğrudan bir staj ve işe alım kanalı.",
  },
  {
    icon: FileText,
    t: "Kanıtlanmış Başarı",
    d: "Teknofest Savaşan İHA ve UAV Turkey Türkiye birincisi bir takım. Desteğiniz, sonuç üreten bir ekibe gidiyor.",
  },
];

export default function SponsorlukPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-line pt-28">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 100% 80% at 50% -10%, var(--hero-glow), transparent 62%)",
          }}
        />
        <div className="relative mx-auto max-w-4xl px-5 py-20 text-center sm:px-8">
          <Reveal>
            <div className="eyebrow mb-5">Sponsorluk</div>
            <h1 className="display-tight text-5xl text-ink sm:text-7xl">
              Markanız bizimle
              <br />
              <span className="text-accent">havalansın.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-ink-2">
              Anatolia Aero Design&apos;a verdiğiniz destek, geleceğin havacılık
              mühendislerine yapılan bir yatırımdır. Desteğinizin tamamını
              faturalı harcar, nereye gittiğini kalem kalem raporlarız.
            </p>
            <div className="mt-9 flex flex-wrap justify-center gap-2.5">
              <Link
                href="/iletisim"
                className="group inline-flex items-center gap-2 rounded-full bg-accent px-7 py-3.5 text-sm font-semibold text-white shadow-[var(--shadow)] transition-transform hover:scale-[1.03]"
              >
                Görüşme Talep Et
                <ArrowRight
                  size={16}
                  className="transition-transform group-hover:translate-x-1"
                />
              </Link>
              <a
                href={`mailto:${TEAM.email}?subject=${encodeURIComponent(
                  "Sponsorluk Görüşmesi"
                )}`}
                className="rounded-full border border-line-2 px-7 py-3.5 text-sm font-semibold text-ink transition-colors hover:border-ink-3"
              >
                Sunum İste
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Rakamlar */}
      <section className="border-b border-line bg-bg-1">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-px overflow-hidden bg-line sm:grid-cols-4">
          {REACH.map((r) => (
            <div key={r.label} className="bg-bg-1 px-5 py-10 text-center">
              <div className="display tabular text-4xl text-accent sm:text-6xl">
                {r.num}
              </div>
              <div className="eyebrow mt-2 !text-[9.5px]">{r.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Nasıl işliyor */}
      <section className="mx-auto max-w-7xl px-5 py-24 sm:px-8">
        <SectionHeading
          num="01"
          title="Nasıl İşliyor?"
          kicker="Görüşmeden rapora, adım adım"
        />
        <ol className="mt-14 space-y-3">
          {SPONSOR_STEPS.map((s, i) => (
            <Reveal key={s.n} delay={i * 60}>
              <li className="flex flex-col gap-4 rounded-2xl border border-line bg-bg-1 p-6 sm:flex-row sm:items-center sm:gap-7 sm:p-7">
                <span className="display tabular shrink-0 text-4xl text-accent sm:w-20 sm:text-5xl">
                  {s.n}
                </span>
                <div className="min-w-0">
                  <h3 className="text-lg font-bold text-ink">{s.t}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-2">
                    {s.d}
                  </p>
                </div>
              </li>
            </Reveal>
          ))}
        </ol>
      </section>

      {/* Görünürlük yüzeyleri */}
      <section className="border-t border-line bg-bg-1">
        <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8">
          <SectionHeading
            num="02"
            title="Logonuz Nerede?"
            kicker="Markanızın fiilen göründüğü yerler"
          />
          <div className="mt-14 grid gap-4 sm:grid-cols-2">
            {VISIBILITY_SURFACES.map((v, i) => (
              <Reveal key={v.title} delay={i * 70}>
                <article className="h-full rounded-2xl border border-line bg-bg p-7">
                  <h3 className="text-lg font-bold text-ink">{v.title}</h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-ink-2">
                    {v.desc}
                  </p>
                </article>
              </Reveal>
            ))}
          </div>
          <p className="mt-8 text-center text-sm text-ink-3">
            Görünürlüğün kapsamı, desteğin büyüklüğüne göre birlikte belirlenir
            — hazır paket dayatmıyoruz.
          </p>
        </div>
      </section>

      {/* Neden biz */}
      <section className="mx-auto max-w-7xl px-5 py-24 sm:px-8">
        <SectionHeading
          num="03"
          title="Neden Biz?"
          kicker="Desteğinizin karşılığı"
        />
        <div className="mt-14 grid gap-4 md:grid-cols-3">
          {WHY.map((w, i) => {
            const Icon = w.icon;
            return (
              <Reveal key={w.t} delay={i * 80}>
                <div className="h-full rounded-2xl border border-line bg-bg-1 p-7">
                  <Icon size={22} className="text-accent" />
                  <h3 className="mt-5 text-lg font-bold text-ink">{w.t}</h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-ink-2">
                    {w.d}
                  </p>
                </div>
              </Reveal>
            );
          })}
        </div>

        {/* Taahhütler */}
        <Reveal>
          <div className="mt-6 rounded-2xl border border-accent/30 bg-[linear-gradient(135deg,var(--accent-soft),transparent_65%)] p-7 sm:p-9">
            <div className="eyebrow mb-4">Size taahhüdümüz</div>
            <ul className="grid gap-3 sm:grid-cols-2">
              {SPONSOR_COMMITMENTS.map((c) => (
                <li key={c} className="flex gap-2.5 text-sm text-ink">
                  <Check size={17} className="mt-0.5 shrink-0 text-accent" />
                  {c}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </section>

      {/* Başarılar şeridi */}
      <section className="border-t border-line bg-bg-1">
        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8">
          <div className="eyebrow mb-6 text-center">
            Desteğiniz sonuç üreten bir takıma gidiyor
          </div>
          <div className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
            {ACHIEVEMENTS.map((a) => (
              <div key={a.year + a.title} className="bg-bg-1 px-5 py-7">
                <div className="display tabular text-2xl text-accent">
                  {a.year}
                </div>
                <div className="mt-1.5 text-sm font-bold text-ink">
                  {a.title}
                </div>
                <div className="mt-1 text-[12.5px] text-ink-3">{a.detail}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Destekçiler */}
      <section className="mx-auto max-w-7xl px-5 py-24 sm:px-8">
        <SectionHeading num="04" title="Destekçiler" kicker="Bize güvenenler" />
        <div className="mt-14 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="flex aspect-[3/2] items-center justify-center bg-bg-1"
            >
              <span className="eyebrow !text-[10px]">Logo</span>
            </div>
          ))}
        </div>
        <p className="mt-6 text-center text-sm text-ink-3">
          Sponsor logoları{" "}
          <code className="rounded bg-bg-2 px-1.5 py-0.5 text-[12.5px]">
            public/images/sponsors/
          </code>{" "}
          klasörüne eklendiğinde burada gösterilecek.
        </p>

        <Reveal>
          <div className="mt-14 rounded-2xl border border-line bg-bg-1 p-9 text-center">
            <h2 className="display-tight text-3xl text-ink sm:text-4xl">
              Bir görüşmeyle başlayalım.
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-ink-2">
              Size takımı anlatan sunumumuzu gönderelim, ihtiyaçlarınıza göre
              birlikte bir iş birliği kurgulayalım.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-2.5">
              <Link
                href="/iletisim"
                className="inline-flex items-center gap-2 rounded-full bg-accent px-7 py-3.5 text-sm font-semibold text-white transition-transform hover:scale-[1.03]"
              >
                İletişime Geç
                <ArrowRight size={16} />
              </Link>
              <a
                href={`mailto:${TEAM.email}`}
                className="rounded-full border border-line-2 px-7 py-3.5 text-sm font-semibold text-ink transition-colors hover:border-ink-3"
              >
                {TEAM.email}
              </a>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
