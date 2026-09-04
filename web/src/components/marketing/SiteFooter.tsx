import Link from "next/link";
import { Mail, MapPin } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { SocialIcon } from "@/components/ui/SocialIcon";
import { TEAM, SOCIALS } from "@/lib/constants";

export function SiteFooter() {
  return (
    <footer className="relative border-t border-line bg-bg-1">
      <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
        <div className="grid gap-12 md:grid-cols-[1.6fr_1fr_1.2fr]">
          <div>
            <Logo size={36} />
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-ink-2">
              {TEAM.university} insansız hava aracı tasarım, üretim ve test
              takımı. Teknofest Savaşan İHA ve UAV Turkey Türkiye birincisi.
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
            <div className="eyebrow mb-4">Site</div>
            <ul className="space-y-2.5 text-sm text-ink-2">
              <li><Link href="/#filo" className="hover:text-ink">Filo</Link></li>
              <li><Link href="/#basarilar" className="hover:text-ink">Başarılar</Link></li>
              <li><Link href="/galeri" className="hover:text-ink">Galeri</Link></li>
              <li><Link href="/sponsorluk" className="hover:text-ink">Sponsorluk</Link></li>
              <li><Link href="/iletisim" className="hover:text-ink">İletişim</Link></li>
              <li><Link href="/giris" className="hover:text-ink">Takım Girişi</Link></li>
            </ul>
          </div>

          <div>
            <div className="eyebrow mb-4">İletişim</div>
            <ul className="space-y-3.5 text-sm text-ink-2">
              <li className="flex gap-2.5">
                <MapPin size={16} className="mt-0.5 shrink-0 text-ink-3" />
                <span>
                  {TEAM.university}
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
            © {new Date().getFullYear()} {TEAM.name} · {TEAM.university}
          </span>
          <span>EST. {TEAM.founded} · Eskişehir, Türkiye</span>
        </div>
      </div>
    </footer>
  );
}
