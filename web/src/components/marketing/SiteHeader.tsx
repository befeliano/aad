"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { TurkishFlag } from "@/components/ui/TurkishMarks";
import { UyeMenusu } from "./UyeMenusu";

const NAV = [
  { href: "/filo", label: "Filo" },
  { href: "/#basarilar", label: "Başarılar" },
  { href: "/#departmanlar", label: "Ekip" },
  { href: "/galeri", label: "Galeri" },
  { href: "/sponsorluk", label: "Sponsorluk" },
  { href: "/iletisim", label: "İletişim" },
];

export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${
        scrolled
          ? "border-b border-line bg-bg/75 backdrop-blur-xl"
          : "border-b border-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-5 sm:px-8">
        <Link 
          href="/" 
          aria-label="Ana sayfa"
          onClick={() => {
            if (window.location.pathname === "/") {
              window.scrollTo({ top: 0, behavior: "smooth" });
            }
          }}
        >
          <Logo />
        </Link>

        <nav className="hidden items-center gap-0.5 lg:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="rounded-full px-3.5 py-2 text-sm font-medium text-ink-2 transition-colors hover:bg-bg-2 hover:text-ink"
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <TurkishFlag
            className="hidden h-4 w-6 shrink-0 rounded-[2px] ring-1 ring-black/10 sm:block"
            title="Türkiye"
          />
          <ThemeToggle />
          <UyeMenusu />
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex size-9 items-center justify-center rounded-full border border-line text-ink lg:hidden"
            aria-label="Menü"
            aria-expanded={open}
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-line bg-bg/95 backdrop-blur-xl lg:hidden">
          <nav className="flex flex-col gap-1 px-5 py-4">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-3 text-base font-medium text-ink-2 hover:bg-bg-2 hover:text-ink"
              >
                {n.label}
              </Link>
            ))}
            <UyeMenusu mobil />
          </nav>
        </div>
      )}
    </header>
  );
}
