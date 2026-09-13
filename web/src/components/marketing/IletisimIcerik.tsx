"use client";

import { ContactForm } from "./ContactForm";
import { Reveal } from "@/components/ui/Reveal";
import { SocialIcon } from "@/components/ui/SocialIcon";
import { TEAM, SOCIALS } from "@/lib/constants";
import { useTeamLeads } from "@/lib/content";
import { S, useT } from "@/lib/i18n";

/** /iletisim sayfasının tamamı — sayfa yalnızca metadata için sunucuda kalır */
export function IletisimIcerik() {
  const t = useT();
  const leads = useTeamLeads();

  return (
    <section className="relative pt-28">
      <div
        className="absolute inset-0 top-0 h-72"
        style={{
          background:
            "radial-gradient(ellipse 100% 100% at 50% -20%, var(--hero-glow), transparent 62%)",
        }}
      />
      <div className="relative mx-auto max-w-7xl px-5 py-16 sm:px-8">
        <Reveal>
          <div className="eyebrow mb-4">{t(S.iletisim.eyebrow)}</div>
          <h1 className="display-tight text-5xl text-ink sm:text-7xl">
            {t(S.iletisim.baslik)}
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-ink-2">
            {t(S.iletisim.lead)}
          </p>
        </Reveal>

        <div className="mt-16 grid gap-12 lg:grid-cols-[1fr_1.2fr]">
          {/* Bilgiler */}
          <div className="space-y-8">
            <Reveal>
              <div className="border-l-2 border-accent pl-5">
                <div className="eyebrow mb-2">{t(S.iletisim.adres)}</div>
                <p className="text-lg leading-relaxed text-ink">
                  {t(S.hero.universite)}
                  <br />
                  {TEAM.address}
                </p>
              </div>
            </Reveal>

            <Reveal>
              <div className="border-l-2 border-accent pl-5">
                <div className="eyebrow mb-2">{t(S.iletisim.eposta)}</div>
                <a
                  href={`mailto:${TEAM.email}`}
                  className="text-lg text-ink transition-colors hover:text-accent"
                >
                  {TEAM.email}
                </a>
              </div>
            </Reveal>

            <Reveal>
              <div className="border-l-2 border-accent pl-5">
                <div className="eyebrow mb-3">{t(S.iletisim.yonetim)}</div>
                <ul className="space-y-3.5">
                  {leads.map((l) => (
                    <li key={l.name}>
                      <div className="text-[15px] font-semibold text-ink">
                        {l.name}
                      </div>
                      <div className="text-[12.5px] text-ink-3">{l.role}</div>
                      {l.email && (
                        <a
                          href={`mailto:${l.email}`}
                          className="mt-0.5 block break-all text-[13.5px] text-ink-2 transition-colors hover:text-accent"
                        >
                          {l.email}
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>

            <Reveal>
              <div className="border-l-2 border-accent pl-5">
                <div className="eyebrow mb-3">{t(S.iletisim.sosyal)}</div>
                <ul className="space-y-2">
                  {SOCIALS.map((s) => (
                    <li key={s.key}>
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group inline-flex items-center gap-3 text-ink-2 transition-colors hover:text-ink"
                      >
                        <span className="flex size-9 items-center justify-center rounded-full border border-line transition-colors group-hover:border-accent group-hover:text-accent">
                          <SocialIcon name={s.key} size={16} />
                        </span>
                        <span>
                          <span className="block text-[13px] font-semibold text-ink">
                            {s.label}
                          </span>
                          <span className="block text-[12.5px] text-ink-3">
                            {s.handle}
                          </span>
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </div>

          {/* Form */}
          <Reveal>
            <ContactForm />
          </Reveal>
        </div>
      </div>
    </section>
  );
}
