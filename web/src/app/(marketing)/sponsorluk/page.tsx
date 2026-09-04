import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Check, ArrowRight, Minus } from "lucide-react";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "@/components/marketing/SectionHeading";
import {
  SPONSOR_TIERS,
  SPONSOR_MATRIX_ROWS,
  SPONSOR_NOTE,
  SPONSOR_REASONS,
  SPONSORS_2025,
  ACHIEVEMENTS,
  TEAM,
  TEAM_LEADS,
  TAKIM_ISTATISTIK,
} from "@/lib/constants";

export const metadata: Metadata = {
  title: "Sponsorluk",
  description:
    "Anatolia Aero Design sponsorluk seviyeleri — First Class, Business Class ve Economy Class. Uçak gövdesinden takım kıyafetlerine marka görünürlüğü, ürün test ve raporlama imkânı.",
};

const REACH = [
  { num: TAKIM_ISTATISTIK.sampiyonluk, label: "Şampiyonluk" },
  { num: TAKIM_ISTATISTIK.uye, label: "Takım Üyesi" },
  { num: TAKIM_ISTATISTIK.mezun, label: "Sektörde Mezun" },
  { num: TAKIM_ISTATISTIK.kurulus, label: "Kuruluş" },
];

export default function SponsorlukPage() {
  const topAchievements = ACHIEVEMENTS.filter((a) => a.highlight);

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
            <div className="eyebrow mb-5">Sponsorluk · 2026–2027</div>
            <h1 className="display-tight text-5xl text-ink sm:text-7xl">
              Markanız bizimle
              <br />
              <span className="text-accent">havalansın.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-ink-2">
              Logonuz uçaklarımızda, takım kıyafetlerimizde ve dijital
              kanallarımızda yer alır. Ürünlerinizi gerçek uçuş koşullarında
              test eder, teknik raporunu size sunarız.
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
                Sponsorluk Dosyası İste
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

      {/* Seviyeler */}
      <section className="mx-auto max-w-7xl px-5 py-24 sm:px-8">
        <SectionHeading
          num="01"
          title="Seviyeler"
          kicker="Size uygun katkı düzeyi"
        />

        <div className="mt-14 grid gap-5 lg:grid-cols-3">
          {SPONSOR_TIERS.map((tier, i) => (
            <Reveal key={tier.key} delay={i * 80}>
              <article
                className={`relative flex h-full flex-col rounded-2xl border p-7 ${
                  tier.featured
                    ? "border-accent bg-[linear-gradient(180deg,var(--accent-soft),transparent_70%)]"
                    : "border-line bg-bg-1"
                }`}
              >
                {tier.featured && (
                  <span className="absolute -top-3 left-7 rounded-full bg-accent px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                    En Üst Seviye
                  </span>
                )}
                <div className="eyebrow !text-[10px]">{tier.label}</div>
                <h3 className="display-tight mt-2 text-3xl text-ink">
                  {tier.name}
                </h3>
                <div className="tabular mt-2 text-lg font-bold text-accent">
                  {tier.threshold}
                </div>
                <p className="mt-1 text-[12.5px] text-ink-3">
                  nakit veya malzeme desteği
                </p>

                <ul className="mt-6 flex-1 space-y-2.5 border-t border-line pt-5">
                  {tier.perks.map((perk) => (
                    <li
                      key={perk}
                      className="flex gap-2.5 text-[13.5px] text-ink-2"
                    >
                      <Check size={15} className="mt-0.5 shrink-0 text-accent" />
                      {perk}
                    </li>
                  ))}
                </ul>

                <Link
                  href="/iletisim"
                  className={`mt-7 inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition-transform hover:scale-[1.02] ${
                    tier.featured
                      ? "bg-accent text-white"
                      : "border border-line-2 text-ink hover:border-ink-3"
                  }`}
                >
                  Teklif Al
                  <ArrowRight size={15} />
                </Link>
              </article>
            </Reveal>
          ))}
        </div>

        <Reveal>
          <p className="mt-8 rounded-2xl border border-line bg-bg-1 p-6 text-[13.5px] leading-relaxed text-ink-2">
            {SPONSOR_NOTE}
          </p>
        </Reveal>
      </section>

      {/* Karşılaştırma tablosu */}
      <section className="border-t border-line bg-bg-1">
        <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8">
          <SectionHeading
            num="02"
            title="Haklar ve Avantajlar"
            kicker="Seviyelerin karşılaştırması"
          />
          <div className="mt-14 overflow-x-auto rounded-2xl border border-line">
            <table className="w-full min-w-[820px] border-collapse text-left">
              <thead>
                <tr>
                  <th className="bg-bg-2 px-5 py-4 text-[12.5px] font-bold text-ink">
                    Haklar ve Avantajlar
                  </th>
                  {SPONSOR_TIERS.map((t) => (
                    <th
                      key={t.key}
                      className={`px-5 py-4 text-center text-[13px] font-bold ${
                        t.featured ? "bg-accent text-white" : "bg-bg-2 text-ink"
                      }`}
                    >
                      {t.name}
                      <span className="mt-0.5 block text-[11px] font-medium opacity-80">
                        {t.threshold}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SPONSOR_MATRIX_ROWS.map((row, ri) => (
                  <tr key={row.key} className={ri % 2 ? "bg-bg-1" : "bg-bg"}>
                    <th className="border-t border-line px-5 py-4 align-top text-[12.5px] font-semibold text-ink">
                      {row.label}
                    </th>
                    {SPONSOR_TIERS.map((t) => {
                      const v = t.matrix[row.key];
                      return (
                        <td
                          key={t.key}
                          className={`border-t border-line px-5 py-4 align-top text-[12.5px] leading-relaxed ${
                            t.featured ? "text-ink" : "text-ink-2"
                          }`}
                        >
                          {v === "—" ? (
                            <Minus size={15} className="text-ink-3" />
                          ) : (
                            v
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Neden katkı */}
      <section className="mx-auto max-w-7xl px-5 py-24 sm:px-8">
        <SectionHeading
          num="03"
          title="Neden Katkı Yapmalısınız?"
          kicker="Desteğinizin karşılığı"
        />
        <div className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {SPONSOR_REASONS.map((r, i) => (
            <Reveal key={r.t} delay={i * 70}>
              <article className="h-full rounded-2xl border border-line bg-bg-1 p-7">
                <span className="display tabular text-2xl text-accent">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-4 text-lg font-bold text-ink">{r.t}</h3>
                <p className="mt-2.5 text-[13.5px] leading-relaxed text-ink-2">
                  {r.d}
                </p>
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Başarı şeridi */}
      <section className="border-t border-line bg-bg-1">
        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8">
          <div className="eyebrow mb-8 text-center">
            Desteğiniz sonuç üreten bir takıma gidiyor
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {topAchievements.map((a) => (
              <div
                key={a.year + a.title}
                className="rounded-2xl border border-accent/30 bg-[linear-gradient(135deg,var(--accent-soft),transparent_65%)] p-7 text-center"
              >
                <div className="display text-5xl text-accent">{a.rank}</div>
                <div className="mt-3 text-[15px] font-bold text-ink">
                  {a.title}
                </div>
                <div className="mt-1 text-[12.5px] text-ink-2">{a.detail}</div>
                <div className="eyebrow mt-3 !text-[10px]">{a.year}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Destekçiler */}
      <section className="mx-auto max-w-7xl px-5 py-24 sm:px-8">
        <SectionHeading
          num="04"
          title="Destekçilerimiz"
          kicker="Bize güvenen markalar"
        />
        <div className="mt-14 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-3">
          {SPONSORS_2025.map((s) => (
            <div
              key={s.name}
              className="flex flex-col items-center justify-center gap-3 bg-bg-1 px-5 py-9"
            >
              {s.logo ? (
                <Image
                  src={s.logo}
                  alt={`${s.name} logosu`}
                  width={150}
                  height={60}
                  className="h-11 w-auto object-contain"
                />
              ) : (
                <span className="display text-xl text-ink-2">{s.name}</span>
              )}
              <span className="eyebrow !text-[9.5px]">{s.role}</span>
            </div>
          ))}
        </div>

        <Reveal>
          <div className="mt-14 rounded-2xl border border-line bg-bg-1 p-9 text-center">
            <h2 className="display-tight text-3xl text-ink sm:text-4xl">
              Bir görüşmeyle başlayalım.
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-ink-2">
              Sponsorluk dosyamızı gönderelim, ihtiyaçlarınıza göre birlikte bir
              iş birliği kurgulayalım.
            </p>
            <div className="mt-7">
              <a
                href={`mailto:${TEAM.email}`}
                className="inline-flex items-center gap-2 rounded-full bg-accent px-7 py-3.5 text-sm font-semibold text-white transition-transform hover:scale-[1.03]"
              >
                {TEAM.email}
              </a>
            </div>
            <div className="mt-8 grid gap-3 border-t border-line pt-7 sm:grid-cols-2">
              {TEAM_LEADS.map((l) => (
                <div key={l.name} className="text-center">
                  <div className="text-sm font-bold text-ink">{l.name}</div>
                  <div className="text-[12.5px] text-ink-3">{l.role}</div>
                  <a
                    href={`tel:${l.phone.replace(/\s/g, "")}`}
                    className="tabular mt-1 block text-[13px] text-accent hover:underline"
                  >
                    {l.phone}
                  </a>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
