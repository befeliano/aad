"use client";

import { useState } from "react";
import { Send } from "lucide-react";

import { TEAM } from "@/lib/constants";

const TEAM_EMAIL = TEAM.email;

/**
 * Backend gerektirmeyen iletişim formu: içeriği düzenli bir e-postaya
 * dönüştürüp kullanıcının posta istemcisini açar. İleride bir Supabase
 * `messages` tablosuna insert edilecek şekilde yükseltilebilir.
 */
export function ContactForm() {
  const [sent, setSent] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") || "");
    const email = String(fd.get("email") || "");
    const subject = String(fd.get("subject") || "İletişim Formu");
    const message = String(fd.get("message") || "");

    const body =
      `Ad Soyad: ${name}\n` +
      `E-posta: ${email}\n\n` +
      `${message}`;

    const url = `mailto:${TEAM_EMAIL}?subject=${encodeURIComponent(
      `[Web] ${subject}`
    )}&body=${encodeURIComponent(body)}`;

    window.location.href = url;
    setSent(true);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-line bg-bg-1 p-7 sm:p-9"
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Ad Soyad" name="name" required />
        <Field label="E-posta" name="email" type="email" required />
      </div>
      <div className="mt-5">
        <Field label="Konu" name="subject" />
      </div>
      <div className="mt-5">
        <label className="block">
          <span className="eyebrow mb-2 block">Mesajınız</span>
          <textarea
            name="message"
            rows={5}
            required
            className="w-full resize-y rounded-xl border border-line bg-bg px-4 py-3 text-sm text-ink outline-none transition-colors placeholder:text-ink-3 focus:border-accent"
            placeholder="Nasıl yardımcı olabiliriz?"
          />
        </label>
      </div>

      <button
        type="submit"
        className="mt-7 inline-flex items-center gap-2 rounded-full bg-accent px-7 py-3.5 text-sm font-semibold text-white transition-transform hover:scale-[1.02]"
      >
        <Send size={16} />
        Gönder
      </button>

      {sent && (
        <p className="mt-4 text-sm text-ok">
          Posta uygulamanız açıldı. Açılmadıysa doğrudan{" "}
          <a href={`mailto:${TEAM_EMAIL}`} className="underline">
            {TEAM_EMAIL}
          </a>{" "}
          adresine yazabilirsiniz.
        </p>
      )}
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  required = false,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="eyebrow mb-2 block">{label}</span>
      <input
        type={type}
        name={name}
        required={required}
        className="w-full rounded-xl border border-line bg-bg px-4 py-3 text-sm text-ink outline-none transition-colors placeholder:text-ink-3 focus:border-accent"
      />
    </label>
  );
}
