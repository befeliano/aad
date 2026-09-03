import type { Metadata } from "next";
import { ContactForm } from "@/components/marketing/ContactForm";
import { Reveal } from "@/components/ui/Reveal";
import { SocialIcon } from "@/components/ui/SocialIcon";
import { TEAM, SOCIALS } from "@/lib/constants";

export const metadata: Metadata = {
  title: "İletişim",
  description:
    "Anatolia Aero Design ile iletişime geçin — sponsorluk, iş birliği ve sorularınız için.",
};

export default function IletisimPage() {
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
          <div className="eyebrow mb-4">İletişim</div>
          <h1 className="display-tight text-5xl text-ink sm:text-7xl">
            Konuşalım.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-ink-2">
            Sponsorluk, iş birliği ya da merak ettikleriniz için bize yazın.
            Sponsorluk taleplerinde takımı anlatan detaylı sunumumuzu
            paylaşabiliriz.
          </p>
        </Reveal>

        <div className="mt-16 grid gap-12 lg:grid-cols-[1fr_1.2fr]">
          {/* Bilgiler */}
          <div className="space-y-8">
            <Reveal>
              <div className="border-l-2 border-accent pl-5">
                <div className="eyebrow mb-2">Adres</div>
                <p className="text-lg leading-relaxed text-ink">
                  {TEAM.university}
                  <br />
                  {TEAM.address}
                </p>
              </div>
            </Reveal>

            <Reveal>
              <div className="border-l-2 border-accent pl-5">
                <div className="eyebrow mb-2">E-posta</div>
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
                <div className="eyebrow mb-3">Sosyal Medya</div>
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
