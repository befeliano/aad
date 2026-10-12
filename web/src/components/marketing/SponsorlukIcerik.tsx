"use client";

import Link from "next/link";
import Image from "next/image";
import {
  Check,
  ArrowRight,
  Minus,
  FileText,
  Plane,
  Shirt,
  Megaphone,
  Presentation,
} from "lucide-react";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "./SectionHeading";
import { ACHIEVEMENTS, TEAM, TAKIM_ISTATISTIK } from "@/lib/constants";
import {
  useSponsorMatrixRows,
  useSponsorNote,
  useSponsorReasons,
  useSponsors,
  useSponsorTiers,
  useTeamLeads,
} from "@/lib/content";
import { S, useT } from "@/lib/i18n";

/** /sponsorluk sayfasının tamamı — sayfa yalnızca metadata için sunucuda kalır */
export function SponsorlukIcerik() {
  const t = useT();
  const tiers = useSponsorTiers();
  const matrixRows = useSponsorMatrixRows();
  const reasons = useSponsorReasons();
  const note = useSponsorNote();
  const sponsors = useSponsors();
  const leads = useTeamLeads();

  /* Şampiyonluklar. `highlight` alanı artık veride hiç set edilmiyor —
     eskiden onunla süzülüyordu ve bu şerit sessizce boş kalıyordu.
     Birincilikler rank ile seçiliyor. */
  const topAchievements = ACHIEVEMENTS.filter((a) => a.rank === "1");

  const reach = [
    { num: TAKIM_ISTATISTIK.birincilik, label: t(S.sponsor.birincilik) },
    { num: TAKIM_ISTATISTIK.derece, label: t(S.sponsor.derece) },
    { num: TAKIM_ISTATISTIK.uye, label: t(S.sponsor.uye) },
    { num: TAKIM_ISTATISTIK.mezun, label: t(S.sponsor.mezun) },
    { num: TAKIM_ISTATISTIK.kurulus, label: t(S.sponsor.kurulus) },
  ];

  const gorunurluk = [
    {
      Icon: Plane,
      baslik: t(S.sponsor.gorunurluk1t),
      metin: t(S.sponsor.gorunurluk1d),
    },
    {
      Icon: Shirt,
      baslik: t(S.sponsor.gorunurluk2t),
      metin: t(S.sponsor.gorunurluk2d),
    },
    {
      Icon: Megaphone,
      baslik: t(S.sponsor.gorunurluk3t),
      metin: t(S.sponsor.gorunurluk3d),
    },
    {
      Icon: Presentation,
      baslik: t(S.sponsor.gorunurluk4t),
      metin: t(S.sponsor.gorunurluk4d),
    },
  ];

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
            <div className="eyebrow mb-5">{t(S.sponsor.eyebrow)}</div>
            <h1 className="display-tight text-5xl text-ink sm:text-7xl">
              {t(S.sponsor.baslik1)}
              <br />
              <span className="text-accent">{t(S.sponsor.baslik2)}</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-ink-2">
              {t(S.sponsor.lead)}
            </p>
            <div className="mt-9 flex flex-wrap justify-center gap-2.5">
              <Link
                href="/iletisim"
                className="group inline-flex items-center gap-2 rounded-full bg-accent px-7 py-3.5 text-sm font-semibold text-white shadow-[var(--shadow)] transition-transform hover:scale-[1.03]"
              >
                {t(S.sponsor.gorusmeTalep)}
                <ArrowRight
                  size={16}
                  className="transition-transform group-hover:translate-x-1"
                />
              </Link>
              <a
                href={`mailto:${TEAM.email}?subject=${encodeURIComponent(
                  t(S.sponsor.mailKonu)
                )}`}
                className="rounded-full border border-line-2 px-7 py-3.5 text-sm font-semibold text-ink transition-colors hover:border-ink-3"
              >
                {t(S.sponsor.dosyaIste)}
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Rakamlar */}
      <section className="border-b border-line bg-bg-1">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-px overflow-hidden bg-line sm:grid-cols-5">
          {reach.map((r) => (
            <div key={r.label} className="bg-bg-1 px-5 py-10 text-center">
              <div className="display tabular text-4xl text-accent sm:text-6xl">
                {r.num}
              </div>
              <div className="eyebrow mt-2 !text-[9.5px]">{r.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Neden katkı */}
      <section className="mx-auto max-w-7xl px-5 py-24 sm:px-8">
        <SectionHeading
          num="01"
          title={t(S.sponsor.nedenBaslik)}
          kicker={t(S.sponsor.nedenKicker)}
        />
        <div className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {reasons.map((r, i) => (
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

      {/* Görünürlük */}
      <section className="border-t border-line bg-bg-1">
        <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8">
          <SectionHeading
            num="02"
            title={t(S.sponsor.gorunurlukBaslik)}
            kicker={t(S.sponsor.gorunurlukKicker)}
          />

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {gorunurluk.map(({ Icon, baslik, metin }, i) => (
              <Reveal key={baslik} delay={i * 70}>
                <article className="flex h-full flex-col rounded-2xl border border-line bg-bg p-6">
                  <span className="flex size-11 items-center justify-center rounded-xl bg-accent-soft text-accent">
                    <Icon size={19} />
                  </span>
                  <h3 className="mt-5 text-[15px] font-bold text-ink">
                    {baslik}
                  </h3>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-ink-2">
                    {metin}
                  </p>
                </article>
              </Reveal>
            ))}
          </div>

          <p className="mt-8 max-w-2xl text-[13px] leading-relaxed text-ink-3">
            {t(S.sponsor.gorunurlukNot)}
          </p>
        </div>
      </section>

      {/* Başarı şeridi */}
      <section className="border-t border-line bg-bg-1">
        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8">
          <div className="eyebrow mb-8 text-center">
            {t(S.sponsor.basariSerit)}
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {topAchievements.map((a) => (
              <div
                key={a.year + a.title[0]}
                className="rounded-2xl border border-accent/30 bg-[linear-gradient(135deg,var(--accent-soft),transparent_65%)] p-7 text-center"
              >
                <div className="display text-5xl text-accent">
                  {t(S.sponsor.birincilik)}
                </div>
                <div className="mt-3 text-[15px] font-bold text-ink">
                  {t(a.title)}
                </div>
                <div className="mt-1 text-[12.5px] text-ink-2">
                  {t(a.detail)}
                </div>
                <div className="eyebrow mt-3 !text-[10px]">{a.year}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Destekçiler */}
      <section className="mx-auto max-w-7xl px-5 py-24 sm:px-8">
        <SectionHeading
          num="03"
          title={t(S.sponsor.destekciBaslik)}
          kicker={t(S.sponsor.destekciKicker)}
        />
        <div className="mt-14 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-3">
          {sponsors.map((s) => (
            <div
              key={s.name}
              className="flex flex-col items-center justify-center gap-3 bg-bg-1 px-5 py-9"
            >
              {s.logo ? (
                /* Logolar çoğunlukla koyu renkli ve saydam zeminli; karanlık
                   temada kaybolmasınlar diye beyaz bir plakaya oturuyorlar. */
                <span className="flex h-16 w-full items-center justify-center rounded-xl bg-white px-4">
                  <Image
                    src={s.logo}
                    alt={s.name}
                    width={180}
                    height={72}
                    className="max-h-11 w-auto object-contain"
                  />
                </span>
              ) : (
                <span className="display text-xl text-ink-2">{s.name}</span>
              )}
              <span className="eyebrow !text-[9.5px]">{s.role}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Seviyeler */}
      <section className="mx-auto max-w-7xl px-5 py-24 sm:px-8">
        <SectionHeading
          num="04"
          title={t(S.sponsor.seviyeBaslik)}
          kicker={t(S.sponsor.seviyeKicker)}
        />

        <div className="mt-14 grid gap-5 lg:grid-cols-3">
          {tiers.map((tier, i) => (
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
                    {t(S.sponsor.enUst)}
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
                  {t(S.sponsor.nakitVeyaMalzeme)}
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
                  {t(S.sponsor.teklifAl)}
                  <ArrowRight size={15} />
                </Link>
              </article>
            </Reveal>
          ))}
        </div>

        <Reveal>
          <p className="mt-8 rounded-2xl border border-line bg-bg-1 p-6 text-[13.5px] leading-relaxed text-ink-2">
            {note}
          </p>
        </Reveal>
      </section>

      {/* Karşılaştırma tablosu */}
      <section className="border-t border-line bg-bg-1">
        <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8">
          <SectionHeading
            num="05"
            title={t(S.sponsor.haklarBaslik)}
            kicker={t(S.sponsor.haklarKicker)}
          />
          <div className="mt-14 overflow-x-auto rounded-2xl border border-line">
            <table className="w-full min-w-[820px] border-collapse text-left">
              <thead>
                <tr>
                  <th className="bg-bg-2 px-5 py-4 text-[12.5px] font-bold text-ink">
                    {t(S.sponsor.haklarBaslik)}
                  </th>
                  {tiers.map((tier) => (
                    <th
                      key={tier.key}
                      className={`px-5 py-4 text-center text-[13px] font-bold ${
                        tier.featured
                          ? "bg-accent text-white"
                          : "bg-bg-2 text-ink"
                      }`}
                    >
                      {tier.name}
                      <span className="mt-0.5 block text-[11px] font-medium opacity-80">
                        {tier.threshold}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrixRows.map((row, ri) => (
                  <tr key={row.key} className={ri % 2 ? "bg-bg-1" : "bg-bg"}>
                    <th className="border-t border-line px-5 py-4 align-top text-[12.5px] font-semibold text-ink">
                      {row.label}
                    </th>
                    {tiers.map((tier) => {
                      const v = tier.matrix[row.key];
                      return (
                        <td
                          key={tier.key}
                          className={`border-t border-line px-5 py-4 align-top text-[12.5px] leading-relaxed ${
                            tier.featured ? "text-ink" : "text-ink-2"
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

      {/* İletişim */}
      <section className="mx-auto max-w-7xl px-5 pb-24 sm:px-8">
        <Reveal>
          <div className="mt-14 rounded-2xl border border-line bg-bg-1 p-9 text-center">
            <h2 className="display-tight text-3xl text-ink sm:text-4xl">
              {t(S.sponsor.kapanisBaslik)}
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-ink-2">
              {t(S.sponsor.kapanisMetin)}
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <a
                href="/anatolia-aero-design-sponsorluk-dosyasi.pdf"
                target="_blank"
                rel="noopener"
                className="inline-flex items-center gap-2 rounded-full bg-accent px-7 py-3.5 text-sm font-semibold text-white transition-transform hover:scale-[1.03]"
              >
                <FileText size={16} />
                {t(S.sponsor.dosyaIndir)}
              </a>
              <a
                href={`mailto:${TEAM.email}`}
                className="inline-flex items-center gap-2 rounded-full border border-line-2 px-7 py-3.5 text-sm font-semibold text-ink transition-colors hover:border-accent hover:text-accent"
              >
                {TEAM.email}
              </a>
            </div>
            <div className="mt-8 grid gap-3 border-t border-line pt-7 sm:grid-cols-2">
              {leads.map((l) => (
                <div key={l.name} className="text-center">
                  <div className="text-sm font-bold text-ink">{l.name}</div>
                  <div className="text-[12.5px] text-ink-3">{l.role}</div>
                  {l.email && (
                    <a
                      href={`mailto:${l.email}`}
                      className="mt-1 block break-all text-[13px] text-accent hover:underline"
                    >
                      {l.email}
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
