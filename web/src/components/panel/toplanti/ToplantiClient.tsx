"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ExternalLink,
  Loader2,
  PhoneOff,
  Radio,
  Users,
  Video,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { trimTo, LIMITS } from "@/lib/security";
import { logAction } from "@/lib/audit";
import { useToast } from "@/components/ui/Toast";
import { Button, Card, EmptyState } from "@/components/ui/Kit";
import { PageHeader } from "@/components/panel/PageHeader";

interface Meeting {
  id: string;
  room: string;
  title: string | null;
  started_by: string | null;
  started_at: string;
  ended_at: string | null;
}

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
}: {
  userId: string;
  displayName: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const { toast } = useToast();

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [tableMissing, setTableMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("meetings")
      .select("*")
      .is("ended_at", null)
      .order("started_at", { ascending: false })
      .limit(1);

    if (error) {
      setTableMissing(true);
      setMeeting(null);
    } else {
      setTableMissing(false);
      setMeeting(((data as Meeting[]) || [])[0] ?? null);
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

  /** Odayı yeni sekmede açar — görünen ad adres satırından geçiriliyor */
  function odayaGit(m: Meeting) {
    const u = new URL(odaAdresi(m.room));
    u.searchParams.set("userInfo.displayName", displayName);
    window.open(u.toString(), "_blank", "noopener");
  }

  async function baslat() {
    setBusy(true);
    // Oda adı tahmin edilemez olmalı — odayı bilen herkes girebiliyor
    const room = `aad-${crypto.randomUUID()}`;
    const { data, error } = await supabase
      .from("meetings")
      .insert({
        room,
        title: trimTo(title, LIMITS.title),
        started_by: userId,
      })
      .select()
      .maybeSingle();
    setBusy(false);

    if (error) {
      toast("Toplantı başlatılamadı: " + error.message, "error");
      return;
    }
    void logAction(supabase, "create", "meetings", data?.id ?? null, {
      baslik: title,
    });
    setTitle("");
    const yeni = data as Meeting;
    setMeeting(yeni);
    odayaGit(yeni);
  }

  async function bitir() {
    if (!meeting) return;
    setBusy(true);
    const { error } = await supabase
      .from("meetings")
      .update({ ended_at: new Date().toISOString() })
      .eq("id", meeting.id);
    setBusy(false);

    if (error) {
      toast("Toplantı bitirilemedi: " + error.message, "error");
      return;
    }
    void logAction(supabase, "update", "meetings", meeting.id, {
      durum: "bitirildi",
    });
    setMeeting(null);
    toast("Toplantı sonlandırıldı.");
  }

  /* RLS herkese açık: toplantıyı başlatan da başkası da bitirebilir */
  const bitirebilir = !!meeting;

  return (
    <>
      <PageHeader
        title="Toplantı Odası"
        desc="Takım içi görüşme ve mülakatlar. Görüntü, ses ve sohbet tarayıcıda; uygulama kurmaya gerek yok."
      >
        {bitirebilir && (
          <Button variant="danger" onClick={bitir} disabled={busy}>
            <PhoneOff size={15} />
            Toplantıyı bitir
          </Button>
        )}
      </PageHeader>

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
      ) : meeting ? (
        <Card className="p-8 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-ok/15 text-ok">
            <Users size={22} />
          </div>
          <h2 className="display mt-4 text-xl text-ink">
            {meeting.title || "Aktif toplantı var"}
          </h2>
          <p className="mt-2 text-sm text-ink-2">
            {new Date(meeting.started_at).toLocaleString("tr-TR")} itibarıyla
            devam ediyor.
          </p>
          <Button className="mt-6" onClick={() => odayaGit(meeting)}>
            <ExternalLink size={15} />
            Toplantıya katıl
          </Button>
          <p className="mt-3 text-[12.5px] text-ink-3">
            Yeni sekmede açılır. Görüntü, ses ve sohbet orada.
          </p>
        </Card>
      ) : (
        <Card className="p-8 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-bg-2 text-ink-3">
            <Video size={22} />
          </div>
          <h2 className="display mt-4 text-xl text-ink">
            Şu an açık toplantı yok
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-ink-2">
            Toplantıyı sen başlatabilirsin; başlattığın anda paneldeki herkes
            &quot;katıl&quot; düğmesini görür.
          </p>
          <div className="mx-auto mt-6 flex max-w-md flex-col gap-3 sm:flex-row">
            <input
              className="field"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={LIMITS.title}
              placeholder="Toplantı başlığı (örn. Haftalık değerlendirme)"
            />
            <Button onClick={baslat} disabled={busy}>
              {busy ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Video size={15} />
              )}
              Başlat
            </Button>
          </div>
        </Card>
      )}
    </>
  );
}
