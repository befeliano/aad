import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/LoginForm";
import { Logo } from "@/components/ui/Logo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

export const metadata: Metadata = {
  title: "Takım Girişi",
  robots: { index: false },
};

export default function GirisPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-16">
      <div className="absolute right-5 top-5 z-10">
        <ThemeToggle />
      </div>
      <div className="absolute inset-0" style={{background:"radial-gradient(ellipse 90% 70% at 50% 0%, var(--hero-glow), transparent 62%)"}} />
      <div className="grid-texture absolute inset-0" />

      <div className="relative w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Link href="/" aria-label="Ana sayfa">
            <Logo size={40} />
          </Link>
        </div>

        <div className="rounded-2xl border border-line bg-bg-1/80 p-8 backdrop-blur-xl">
          <div className="eyebrow mb-2">Takım Paneli</div>
          <h1 className="display-tight text-3xl text-ink">Giriş Yap</h1>
          <p className="mt-2 text-sm text-ink-2">
            Yalnızca takım üyeleri içindir.
          </p>

          <Suspense>
            <LoginForm />
          </Suspense>
        </div>

        <p className="mt-6 text-center text-sm text-ink-3">
          <Link href="/" className="hover:text-ink">
            ← Ana sayfaya dön
          </Link>
        </p>
      </div>
    </main>
  );
}
