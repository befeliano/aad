"use client";

import { useState } from "react";
import { Loader2, Send } from "lucide-react";

import { TEAM } from "@/lib/constants";
import { S, useT } from "@/lib/i18n";
import { createClientSafe } from "@/lib/supabase/client";

const TEAM_EMAIL = TEAM.email;

type Durum = "bos" | "gonderiliyor" | "kaydedildi" | "mailto";

/**
 * İletişim formu.
 *
 * Mesaj `contact_messages` tablosuna yazılır ve panelde Gelen Kutusu'nda
 * görünür. Daha önce yalnızca mailto: bağlantısı açıyordu — yani hiçbir
 * mesaj kaydedilmiyordu ve kimse takip edemiyordu.
 *
 * Kayıt başarısız olursa (tablo yok, ağ hatası) eski davranışa düşer ve
 * posta uygulamasını açar; mesaj hiçbir koşulda kaybolmaz.
 */
export function ContactForm() {
  const t = useT();
  const [durum, setDurum] = useState<Durum>("bos");

  function mailtoAc(
    name: string,
    email: string,
    subject: string,
    message: string
  ) {
    const body = `${t(S.form.adSoyad)}: ${name}\n${t(
      S.form.eposta
    )}: ${email}\n\n${message}`;
    window.location.href = `mailto:${TEAM_EMAIL}?subject=${encodeURIComponent(
      `[Web] ${subject}`
    )}&body=${encodeURIComponent(body)}`;
    setDurum("mailto");
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const name = String(fd.get("name") || "").trim().slice(0, 200);
    const email = String(fd.get("email") || "").trim().slice(0, 200);
    const subject =
      String(fd.get("subject") || "").trim().slice(0, 200) ||
      t(S.form.varsayilanKonu);
    const message = String(fd.get("message") || "").trim().slice(0, 5000);

    if (!message) return;

    setDurum("gonderiliyor");
    const supabase = createClientSafe();

    if (!supabase) {
      mailtoAc(name, email, subject, message);
      return;
    }

    const { error } = await supabase
      .from("contact_messages")
      .insert([{ name, email, subject, message }]);

    if (error) {
      /* Kaydedilemedi — mesajı kaybetmemek için posta uygulamasına düş */
      mailtoAc(name, email, subject, message);
      return;
    }

    form.reset();
    setDurum("kaydedildi");
  }

  const gonderiliyor = durum === "gonderiliyor";

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-line bg-bg-1 p-7 sm:p-9"
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={t(S.form.adSoyad)} name="name" required />
        <Field label={t(S.form.eposta)} name="email" type="email" required />
      </div>
      <div className="mt-5">
        <Field label={t(S.form.konu)} name="subject" />
      </div>
      <div className="mt-5">
        <label className="block">
          <span className="eyebrow mb-2 block">{t(S.form.mesaj)}</span>
          <textarea
            name="message"
            rows={5}
            required
            maxLength={5000}
            className="w-full resize-y rounded-xl border border-line bg-bg px-4 py-3 text-sm text-ink outline-none transition-colors placeholder:text-ink-3 focus:border-accent"
            placeholder={t(S.form.placeholder)}
          />
        </label>
      </div>

      <button
        type="submit"
        disabled={gonderiliyor}
        className="mt-7 inline-flex items-center gap-2 rounded-full bg-accent px-7 py-3.5 text-sm font-semibold text-white transition-transform hover:scale-[1.02] disabled:opacity-60"
      >
        {gonderiliyor ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <Send size={16} />
        )}
        {gonderiliyor ? t(S.form.gonderiliyor) : t(S.form.gonder)}
      </button>

      {durum === "kaydedildi" && (
        <p className="mt-4 text-sm text-ok">{t(S.form.basarili)}</p>
      )}

      {durum === "mailto" && (
        <p className="mt-4 text-sm text-ink-2">
          {t(S.form.mailto1)}{" "}
          <a href={`mailto:${TEAM_EMAIL}`} className="underline">
            {TEAM_EMAIL}
          </a>{" "}
          {t(S.form.mailto2)}
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
        maxLength={200}
        className="w-full rounded-xl border border-line bg-bg px-4 py-3 text-sm text-ink outline-none transition-colors placeholder:text-ink-3 focus:border-accent"
      />
    </label>
  );
}
