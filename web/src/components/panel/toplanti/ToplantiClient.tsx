"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ExternalLink,
  Loader2,
  Lock,
  PhoneOff,
  Radio,
  Search,
  Users,
  Video,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { trimTo, LIMITS } from "@/lib/security";
import { logAction } from "@/lib/audit";
import { useToast } from "@/components/ui/Toast";
import { Badge, Button, Card, EmptyState } from "@/components/ui/Kit";
import { PageHeader } from "@/components/panel/PageHeader";
import { DEPT_LABELS } from "@/lib/constants";

interface Meeting {
  id: string;
  room: string;
  title: string | null;
  started_by: string | null;
  started_at: string;
  ended_at: string | null;
  /** toplanti-ozel.sql çalıştırılmadıysa gelmez */
  is_private?: boolean;
  invitees?: string[];
}

interface Uye {
  id: string;
  full_name: string | null;
  username: string | null;
  email: string | null;
  department: string | null;
}

const uyeAdi = (u: Uye) =>
  u.full_name?.trim() || u.username?.trim() || u.email?.split("@")[0] || "Üye";

/**
 * Toplantı odası adresi.
 *
 * GÖMMEK YERİNE YENİ SEKME: meet.jit.si gömülü kullanıldığında
 * "Embedding meet.jit.si is only meant for demo purposes" uyarısı
 * veriyor ve görüşmeyi 5 DAKİKADA kesiyor. Sınır yalnızca gömmede;
 * yeni sekmede açıldığında süre sınırı yok ve ücretsiz.
 *
 * Kendi Jitsi sunucunuza ya da JaaS'a geçerseniz yalnızca
 * NEXT_PUBLIC_JITSI_ORIGIN değerini değiştirmeniz yeterli.
 */
const JITSI_ORIGIN =
  process.env.NEXT_PUBLIC_JITSI_ORIGIN || "https://meet.jit.si";

const odaAdresi = (room: string) => `${JITSI_ORIGIN}/${room}`;

export function ToplantiClient({
  userId,
  displayName,
  isAdmin,
}: {
  userId: string;
  displayName: string;
  isAdmin: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const { toast } = useToast();

  const [toplantilar, setToplantilar] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableMissing, setTableMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");

  /* Özel oda */
  const [ozel, setOzel] = useState(false);
  const [davetli, setDavetli] = useState<Set<string>>(new Set());
  const [uyeler, setUyeler] = useState<Uye[]>([]);
  const [uyeAra, setUyeAra] = useState("");

  const load = useCallback(async () => {
    // RLS özel odaları zaten süzüyor: burada görünen her oda bize açık
    const { data, error } = await supabase
      .from("meetings")
      .select("*")
      .is("ended_at", null)
      .order("started_at", { ascending: false });

    if (error) {
      setTableMissing(true);
      setToplantilar([]);
    } else {
      setTableMissing(false);
      setToplantilar((data as Meeting[]) || []);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    // load() asenkrondur: setState ağ yanıtından sonra çalışır.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  /* Başka biri toplantı başlatınca/bitirince anında görelim */
  useEffect(() => {
    const ch = supabase
      .channel("meetings-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "meetings" },
        () => void load()
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [supabase, load]);

  /* Üye listesi yalnızca "özel" seçilince çekilir */
  useEffect(() => {
    if (!ozel || uyeler.length > 0) return;
    let iptal = false;
    void supabase
      .from("profiles")
      .select("id, full_name, username, email, department")
      .then(({ data }) => {
        if (iptal) return;
        setUyeler(
          ((data as Uye[]) || [])
            .filter((u) => u.id !== userId)
            .sort((a, b) => uyeAdi(a).localeCompare(uyeAdi(b), "tr"))
        );
      });
    return () => {
      iptal = true;
    };
  }, [ozel, uyeler.length, supabase, userId]);

  const uyeListesi = useMemo(() => {
    const n = uyeAra.trim().toLocaleLowerCase("tr");
    if (!n) return uyeler;
    return uyeler.filter((u) =>
      `${uyeAdi(u)} ${DEPT_LABELS[u.department || ""] || ""}`
        .toLocaleLowerCase("tr")
        .includes(n)
    );
  }, [uyeler, uyeAra]);

  function davetliDegis(id: string) {
    setDavetli((v) => {
      const n = new Set(v);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  /** Odayı yeni sekmede açar — görünen ad adres satırından geçiriliyor */
  function odayaGit(m: Meeting) {
    const u = new URL(odaAdresi(m.room));
    u.searchParams.set("userInfo.displayName", displayName);
    window.open(u.toString(), "_blank", "noopener");
  }

  async function baslat() {
    if (ozel && davetli.size === 0) {
      toast("Özel oda için en az bir kişi seçin.", "error");
      return;
    }
    setBusy(true);
    // Oda adı tahmin edilemez olmalı — odayı bilen herkes girebiliyor
    const room = `aad-${crypto.randomUUID()}`;
    const payload: Record<string, unknown> = {
      room,
      title: trimTo(title, LIMITS.title),
      started_by: userId,
    };
    // Kolonlar yalnızca özel odada gönderilir: SQL çalıştırılmadıysa
    // genel toplantı yine açılabilsin
    if (ozel) {
      payload.is_private = true;
      payload.invitees = [...davetli];
    }
    const { data, error } = await supabase
      .from("meetings")
      .insert(payload)
      .select()
      .maybeSingle();
    setBusy(false);

    if (error) {
      toast(
        "Toplantı başlatılamadı: " +
          error.message +
          (ozel ? " (supabase/toplanti-ozel.sql çalıştırıldı mı?)" : ""),
        "error"
      );
      return;
    }
    void logAction(supabase, "create", "meetings", data?.id ?? null, {
      baslik: title,
      ozel,
      davetli: davetli.size,
    });
    setTitle("");
    setOzel(false);
    setDavetli(new Set());
    const yeni = data as Meeting;
    setToplantilar((v) => [yeni, ...v]);
    odayaGit(yeni);
  }

  async function bitir(m: Meeting) {
    setBusy(true);
    const { error } = await supabase
      .from("meetings")
      .update({ ended_at: new Date().toISOString() })
      .eq("id", m.id);
    setBusy(false);

    if (error) {
      toast("Toplantı bitirilemedi: " + error.message, "error");
      return;
    }
    void logAction(supabase, "update", "meetings", m.id, {
      durum: "bitirildi",
    });
    setToplantilar((v) => v.filter((x) => x.id !== m.id));
    toast("Toplantı sonlandırıldı.");
  }

  /* RLS: toplantıyı açan kişi ya da kaptan/yardımcı bitirir */
  const bitirebilir = (m: Meeting) => m.started_by === userId || isAdmin;

  return (
    <>
      <PageHeader
        title="Toplantı Odası"
        desc="Takım içi görüşme ve mülakatlar. Görüntü, ses ve sohbet tarayıcıda; uygulama kurmaya gerek yok."
      />

      {tableMissing ? (
        <Card className="p-6">
          <EmptyState
            icon={<Radio size={22} />}
            title="Toplantı tablosu yok"
            desc="supabase/toplanti.sql dosyasını Supabase SQL Editor'da çalıştırın."
          />
        </Card>
      ) : loading ? (
        <Card className="flex items-center gap-2 p-6 text-sm text-ink-3">
          <Loader2 size={15} className="animate-spin" />
          Yükleniyor…
        </Card>
      ) : (
        <div className="space-y-5">
          {/* Açık toplantılar */}
          {toplantilar.map((m) => (
            <Card key={m.id} className="flex flex-wrap items-center gap-4 p-5">
              <div
                className={`flex size-11 shrink-0 items-center justify-center rounded-full ${
                  m.is_private ? "bg-warn/15 text-warn" : "bg-ok/15 text-ok"
                }`}
              >
                {m.is_private ? <Lock size={19} /> : <Users size={20} />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-[15px] font-semibold text-ink">
                    {m.title || "Toplantı"}
                  </h2>
                  {m.is_private ? (
                    <Badge tone="warn">
                      Özel · {(m.invitees?.length ?? 0) + 1} kişi
                    </Badge>
                  ) : (
                    <Badge tone="ok">Herkese açık</Badge>
                  )}
                </div>
                <p className="mt-1 text-[12.5px] text-ink-3">
                  {new Date(m.started_at).toLocaleString("tr-TR", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  itibarıyla açık
                  {m.started_by === userId ? " · sen açtın" : ""}
                </p>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => odayaGit(m)}>
                  <ExternalLink size={15} />
                  Katıl
                </Button>
                {bitirebilir(m) && (
                  <Button
                    variant="danger"
                    onClick={() => void bitir(m)}
                    disabled={busy}
                  >
                    <PhoneOff size={15} />
                    Bitir
                  </Button>
                )}
              </div>
            </Card>
          ))}

          {/* Yeni toplantı */}
          <Card className="p-6 sm:p-8">
            {toplantilar.length === 0 && (
              <div className="mb-6 text-center">
                <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-bg-2 text-ink-3">
                  <Video size={22} />
                </div>
                <h2 className="display mt-4 text-xl text-ink">
                  Şu an açık toplantı yok
                </h2>
              </div>
            )}
            <p className="mx-auto max-w-md text-center text-sm text-ink-2">
              {ozel
                ? "Özel odayı yalnızca seçtiğin kişiler panelde görür."
                : "Başlattığın anda paneldeki herkes \"katıl\" düğmesini görür."}
            </p>

            <div className="mx-auto mt-5 max-w-md space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  className="field"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={LIMITS.title}
                  placeholder="Toplantı başlığı (örn. Haftalık değerlendirme)"
                  aria-label="Toplantı başlığı"
                />
                <Button onClick={baslat} disabled={busy}>
                  {busy ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : ozel ? (
                    <Lock size={15} />
                  ) : (
                    <Video size={15} />
                  )}
                  Başlat
                </Button>
              </div>

              <label className="flex cursor-pointer select-none items-center gap-2.5 rounded-xl border border-line bg-bg px-3.5 py-2.5 text-[13.5px] text-ink-2">
                <input
                  type="checkbox"
                  checked={ozel}
                  onChange={(e) => setOzel(e.target.checked)}
                  className="size-4 accent-[var(--accent)]"
                />
                <Lock size={14} />
                Özel oda — kimlerin göreceğini ben seçeyim
              </label>

              {ozel && (
                <div className="rounded-xl border border-line bg-bg">
                  <div className="flex items-center justify-between gap-3 border-b border-line px-3.5 py-2.5">
                    <div className="relative flex-1">
                      <Search
                        size={14}
                        className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3"
                      />
                      <input
                        value={uyeAra}
                        onChange={(e) => setUyeAra(e.target.value)}
                        placeholder="Üye ara…"
                        aria-label="Üye ara"
                        className="field !py-1.5 !pl-8 text-[13px]"
                      />
                    </div>
                    <span className="shrink-0 text-[12px] font-semibold text-ink-3">
                      {davetli.size} seçili
                    </span>
                  </div>
                  <ul className="max-h-64 overflow-y-auto p-1.5">
                    {uyeler.length === 0 ? (
                      <li className="flex items-center gap-2 px-2 py-3 text-[13px] text-ink-3">
                        <Loader2 size={14} className="animate-spin" />
                        Üyeler yükleniyor…
                      </li>
                    ) : (
                      uyeListesi.map((u) => (
                        <li key={u.id}>
                          <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 text-[13.5px] text-ink-2 hover:bg-bg-2">
                            <input
                              type="checkbox"
                              checked={davetli.has(u.id)}
                              onChange={() => davetliDegis(u.id)}
                              className="size-4 accent-[var(--accent)]"
                            />
                            <span className="flex-1 text-ink">{uyeAdi(u)}</span>
                            {u.department && (
                              <span className="text-[11.5px] text-ink-3">
                                {DEPT_LABELS[u.department] || u.department}
                              </span>
                            )}
                          </label>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
