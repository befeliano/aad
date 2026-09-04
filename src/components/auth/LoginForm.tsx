"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/panel";

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* proxy, Supabase env'i eksikse buraya ?hata=yapilandirma ile yönlendirir */
  const configError = params.get("hata") === "yapilandirma";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email"));
    const password = String(fd.get("password"));

    const supabase = createClient();
    const { error: err } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (err) {
      setError(
        err.message === "Invalid login credentials"
          ? "E-posta veya parola hatalı."
          : "Giriş başarısız: " + err.message
      );
      setLoading(false);
      return;
    }

    // Middleware'in yeni session cookie'sini görmesi için tam yönlendirme
    router.refresh();
    router.replace(next);
  }

  return (
    <form onSubmit={handleSubmit} className="mt-7 space-y-4">
      <label className="block">
        <span className="eyebrow mb-2 block">E-posta</span>
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          className="w-full rounded-xl border border-line bg-bg px-4 py-3 text-sm text-ink outline-none transition-colors focus:border-accent"
        />
      </label>

      <label className="block">
        <span className="eyebrow mb-2 block">Parola</span>
        <input
          type="password"
          name="password"
          required
          autoComplete="current-password"
          className="w-full rounded-xl border border-line bg-bg px-4 py-3 text-sm text-ink outline-none transition-colors focus:border-accent"
        />
      </label>

      {configError && !error && (
        <p className="rounded-lg border border-warn/30 bg-warn/10 px-3 py-2.5 text-sm text-warn">
          Sunucu yapılandırması eksik: Supabase ortam değişkenleri tanımlı
          değil. Vercel → Project Settings → Environment Variables bölümünden
          NEXT_PUBLIC_SUPABASE_URL ve NEXT_PUBLIC_SUPABASE_ANON_KEY ekleyip
          yeniden deploy alın.
        </p>
      )}

      {error && (
        <p className="rounded-lg border border-bad/30 bg-bad/10 px-3 py-2.5 text-sm text-bad">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent px-6 py-3.5 text-sm font-semibold text-white transition-transform hover:scale-[1.01] disabled:opacity-60"
      >
        {loading && <Loader2 size={16} className="animate-spin" />}
        {loading ? "Giriş yapılıyor" : "Giriş Yap"}
      </button>
    </form>
  );
}
