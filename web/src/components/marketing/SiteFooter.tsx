"use client";

import Link from "next/link";
import { Mail, MapPin } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { SocialIcon } from "@/components/ui/SocialIcon";
import { TEAM, SOCIALS } from "@/lib/constants";
import { S, useT } from "@/lib/i18n";

/**
 * Altbilgi.
 *
 * `yil` sunucudan geliyor: bileşen istemci tarafında çalıştığı için
 * render sırasında `new Date()` çağırmak hem react-hooks/purity
 * kuralına takılır hem de sunucu/istemci çıktısını ayırabilir.
 */
export function SiteFooter({ yil }: { yil: number }) {
  const t = useT();

  return (
    <footer className="relative border-t border-line bg-bg-1">
      <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
        <div className="grid gap-12 md:grid-cols-[1.6fr_1fr_1.2fr]">
          <div>
            <Logo size={36} />
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-ink-2">
              {t(S.footer.aciklama)}
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {SOCIALS.map((s) => (
                <a
                  key={s.key}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  title={`${s.label} · ${s.handle}`}
                  className="flex size-10 items-center justify-center rounded-full border border-line text-ink-2 transition-colors hover:border-accent hover:text-accent"
                >
                  <SocialIcon name={s.key} size={17} />
                </a>
              ))}
            </div>
          </div>

          <div>
            <div className="eyebrow mb-4">{t(S.footer.site)}</div>
            <ul className="space-y-2.5 text-sm text-ink-2">
              <li><Link href="/#filo" className="hover:text-ink">{t(S.nav.filo)}</Link></li>
              <li><Link href="/#basarilar" className="hover:text-ink">{t(S.nav.basarilar)}</Link></li>
              <li><Link href="/galeri" className="hover:text-ink">{t(S.nav.galeri)}</Link></li>
              <li><Link href="/sponsorluk" className="hover:text-ink">{t(S.nav.sponsorluk)}</Link></li>
              <li><Link href="/katil" className="hover:text-ink">{t(S.nav.katil)}</Link></li>
              <li><Link href="/iletisim" className="hover:text-ink">{t(S.nav.iletisim)}</Link></li>
              <li><Link href="/giris" className="hover:text-ink">{t(S.nav.giris)}</Link></li>
            </ul>
          </div>

          <div>
            <div className="eyebrow mb-4">{t(S.footer.iletisim)}</div>
            <ul className="space-y-3.5 text-sm text-ink-2">
              <li className="flex gap-2.5">
                <MapPin size={16} className="mt-0.5 shrink-0 text-ink-3" />
                <span>
                  {t(S.hero.universite)}
                  <br />
                  {TEAM.address}
                </span>
              </li>
              <li className="flex gap-2.5">
                <Mail size={16} className="mt-0.5 shrink-0 text-ink-3" />
                <a href={`mailto:${TEAM.email}`} className="hover:text-ink">
                  {TEAM.email}
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-14 flex flex-col items-start justify-between gap-3 border-t border-line pt-6 text-xs text-ink-3 sm:flex-row sm:items-center">
          <span>
            © {yil} {TEAM.name} · {t(S.hero.universite)}
          </span>
          <span>
            {t(S.hero.kurulus)} {TEAM.founded} · {t(S.footer.sehir)}
          </span>
        </div>
      </div>
    </footer>
  );
}
