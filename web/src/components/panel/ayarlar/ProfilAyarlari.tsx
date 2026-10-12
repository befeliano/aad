"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { KeyRound, Loader2, Mail, Save, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { trimTo, LIMITS } from "@/lib/security";
import { logAction } from "@/lib/audit";
import { useToast } from "@/components/ui/Toast";
import { Button, Card, Field } from "@/components/ui/Kit";
import { PageHeader } from "@/components/panel/PageHeader";
import { DEPT_LABELS, ROLE_LABELS } from "@/lib/constants";

/** Supabase varsayılan alt sınırı 6; biraz daha sıkı tutuyoruz */
const MIN_SIFRE = 8;

/**
 * Üyenin kendi profilini düzenlediği sayfa.
 *
 * Şu an panelde isim yoksa e-postanın "@" öncesi kullanılıyor; bu gerçek ad
 * olmadığı için üye buradan kendi adını yazabiliyor. Departman ve rol
 * yalnızca gösteriliyor — onları kaptan Üye Yönetimi'nden değiştirir.
 */
export function ProfilAyarlari({
  userId,
  email,
}: {
  userId: string;
  email: string | null;
}) {
  const supabase = useMemo(() => createClient(), []);
  const { toast } = useToast();

  const [fullName, setFullName] = useState("");
  const [dept, setDept] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  /* Bildirim e-postası — giriş adresi gerçek kutu olmayabilir */
  const [bildirimEposta, setBildirimEposta] = useState("");
  const [bildirimTabloYok, setBildirimTabloYok] = useState(false);
  const [bildirimKaydediliyor, setBildirimKaydediliyor] = useState(false);

  /* Parola değiştirme — kaptanın verdiği geçici parolayı üye kendisi değiştirir */
  const [sifre, setSifre] = useState("");
  const [sifre2, setSifre2] = useState("");
  const [sifreKaydediliyor, setSifreKaydediliyor] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("full_name, department, role")
      .eq("id", userId)
      .maybeSingle();

    if (!error && data) {
      setFullName(data.full_name ?? "");
      setDept(data.department ?? null);
      setRole(data.role ?? null);
    }

    const { data: n, error: nErr } = await supabase
      .from("notification_prefs")
      .select("email")
      .eq("user_id", userId)
      .maybeSingle();
    setBildirimTabloYok(!!nErr);
    setBildirimEposta(n?.email ?? "");
    setLoading(false);
  }, [supabase, userId]);

  useEffect(() => {
    // load() asenkrondur: setState ağ yanıtından sonra çalışır.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const temiz = trimTo(fullName, LIMITS.name);
    setSaving(true);

    const { error } = await supabase
      .from("profiles")
      .update({ full_name: temiz })
      .eq("id", userId);

    setSaving(false);

    if (error) {
      toast("Kaydedilemedi: " + error.message, "error");
      return;
    }

    void logAction(supabase, "update", "profiles", userId, {
      alan: "full_name",
    });
    toast("İsminiz güncellendi.");
    // Panel başlığı sunucudan geliyor; tazelemek için sayfayı yenile
    window.location.reload();
  }

  async function bildirimKaydet(e: React.FormEvent) {
    e.preventDefault();
    const temiz = bildirimEposta.trim().slice(0, 200);
    if (temiz && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(temiz)) {
      toast("Geçerli bir e-posta adresi yazın.", "error");
      return;
    }
    setBildirimKaydediliyor(true);
    const { error } = await supabase
      .from("notification_prefs")
      .upsert([{ user_id: userId, email: temiz || null }], {
        onConflict: "user_id",
      });
    setBildirimKaydediliyor(false);
    if (error) {
      toast("Kaydedilemedi: " + error.message, "error");
      return;
    }
    // Adresin kendisi loglanmaz — kişisel veri
    void logAction(supabase, "update", "notification_prefs", userId, {
      alan: "bildirim_eposta",
      dolu: !!temiz,
    });
    setBildirimEposta(temiz);
    toast(
      temiz
        ? "Bildirimler artık bu adrese gelecek."
        : "Bildirim e-postası kaldırıldı; bildirimler yalnızca panelde görünecek."
    );
  }

  async function sifreDegistir(e: React.FormEvent) {
    e.preventDefault();

    if (sifre.length < MIN_SIFRE) {
      toast(`Parola en az ${MIN_SIFRE} karakter olmalı.`, "error");
      return;
    }
    if (sifre !== sifre2) {
      toast("Parolalar birbiriyle eşleşmiyor.", "error");
      return;
    }

    setSifreKaydediliyor(true);
    const { error } = await supabase.auth.updateUser({ password: sifre });
    setSifreKaydediliyor(false);

    if (error) {
      toast("Parola değiştirilemedi: " + error.message, "error");
      return;
    }

    // Parolanın kendisi ASLA loglanmaz — yalnızca değiştirildiği bilgisi
    void logAction(supabase, "update", "profiles", userId, {
      alan: "parola",
    });
    setSifre("");
    setSifre2("");
    toast("Parolanız güncellendi.");
  }

  const fallback = email?.split("@")[0] || "Üye";

  return (
    <>
      <PageHeader
        title="Profilim"
        desc="Panelde görünen adınızı buradan değiştirebilirsiniz."
      />

      <Card className="max-w-xl p-6">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-ink-3">
            <Loader2 size={15} className="animate-spin" />
            Yükleniyor…
          </div>
        ) : (
          <form onSubmit={save} className="space-y-5">
            <Field
              label="Ad Soyad"
              hint={
                fullName.trim()
                  ? "Görevlerde, uçuş kayıtlarında ve üye listesinde bu isim görünür."
                  : `Şu an "${fallback}" görünüyor — bu e-postanızdan türetilmiş geçici bir ad.`
              }
            >
              <input
                className="field"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                maxLength={LIMITS.name}
                placeholder="örn. Burak Şahin"
                autoComplete="name"
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="E-posta" hint="Değiştirilemez">
                <input className="field" value={email ?? ""} disabled readOnly />
              </Field>
              <Field label="Departman" hint="Kaptan atar">
                <input
                  className="field"
                  value={dept ? DEPT_LABELS[dept] || dept : "— Atanmamış —"}
                  disabled
                  readOnly
                />
              </Field>
            </div>

            <div className="flex items-center gap-3 border-t border-line pt-5">
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Save size={15} />
                )}
                Kaydet
              </Button>
              <span className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-3">
                <UserRound size={13} />
                {ROLE_LABELS[role ?? "member"] || "Üye"}
              </span>
            </div>
          </form>
        )}
      </Card>

      {/* --- Bildirim e-postası --- */}
      <Card className="mt-6 max-w-xl p-6">
        <div className="mb-2 flex items-center gap-2">
          <Mail size={16} className="text-ink-3" />
          <h2 className="text-[15px] font-semibold text-ink">Bildirim e-postası</h2>
        </div>
        <p className="mb-5 text-[13px] leading-relaxed text-ink-2">
          Panelden sana bir bildirim gidecekse (ör. yoklama hatırlatması) bu
          adrese gelir. Giriş adresin gerçek bir kutu değilse buraya her gün
          baktığın e-postanı yaz. Bu adresi yalnızca sen ve takım kaptanları
          görür.
        </p>
        {bildirimTabloYok ? (
          <p className="text-[12.5px] text-ink-3">
            Henüz kurulmadı: Supabase SQL Editor&apos;da{" "}
            <code>supabase/bildirim-eposta.sql</code> çalıştırılmalı.
          </p>
        ) : (
          <form onSubmit={bildirimKaydet} className="space-y-5">
            <Field label="E-posta" hint="Boş bırakırsan e-posta gitmez, bildirimler yalnızca paneldeki zilde görünür.">
              <input
                type="email"
                className="field"
                value={bildirimEposta}
                onChange={(e) => setBildirimEposta(e.target.value)}
                maxLength={200}
                placeholder="ornek@gmail.com"
                autoComplete="email"
              />
            </Field>
            <div className="border-t border-line pt-5">
              <Button type="submit" disabled={bildirimKaydediliyor || loading}>
                {bildirimKaydediliyor ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Save size={15} />
                )}
                Kaydet
              </Button>
            </div>
          </form>
        )}
      </Card>

      {/* --- Parola --- */}
      <Card className="mt-6 max-w-xl p-6">
        <div className="mb-5 flex items-center gap-2">
          <KeyRound size={16} className="text-ink-3" />
          <h2 className="text-[15px] font-semibold text-ink">Parolamı Değiştir</h2>
        </div>

        <form onSubmit={sifreDegistir} className="space-y-5">
          <Field
            label="Yeni parola"
            hint={`En az ${MIN_SIFRE} karakter. Size verilen geçici parolayı burada değiştirin.`}
          >
            <input
              type="password"
              className="field"
              value={sifre}
              onChange={(e) => setSifre(e.target.value)}
              autoComplete="new-password"
              minLength={MIN_SIFRE}
            />
          </Field>

          <Field label="Yeni parola (tekrar)">
            <input
              type="password"
              className="field"
              value={sifre2}
              onChange={(e) => setSifre2(e.target.value)}
              autoComplete="new-password"
              minLength={MIN_SIFRE}
            />
          </Field>

          <div className="border-t border-line pt-5">
            <Button type="submit" disabled={sifreKaydediliyor || !sifre}>
              {sifreKaydediliyor ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <KeyRound size={15} />
              )}
              Parolayı güncelle
            </Button>
          </div>
        </form>
      </Card>
    </>
  );
}
