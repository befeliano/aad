"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Loader2,
  LogIn,
  PhoneOff,
  Radio,
  Users,
  Video,
  VideoOff,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { trimTo, LIMITS } from "@/lib/security";
import { logAction } from "@/lib/audit";
import { useToast } from "@/components/ui/Toast";
import { Button, Card, EmptyState } from "@/components/ui/Kit";
import { PageHeader } from "@/components/panel/PageHeader";

/** Jitsi dış API'sinin kullandığımız kadarı */
interface JitsiApi {
  dispose(): void;
  addListener(event: string, fn: () => void): void;
}
declare global {
  interface Window {
    JitsiMeetExternalAPI?: new (
      domain: string,
      options: Record<string, unknown>
    ) => JitsiApi;
  }
}

interface Meeting {
  id: string;
  room: string;
  title: string | null;
  started_by: string | null;
  started_at: string;
  ended_at: string | null;
}

const JITSI_ORIGIN =
  process.env.NEXT_PUBLIC_JITSI_ORIGIN || "https://meet.jit.si";
const JITSI_DOMAIN = JITSI_ORIGIN.replace(/^https?:\/\//, "");

/** external_api.js'i bir kez yükler, sonraki çağrılarda aynı sözü döndürür */
let scriptPromise: Promise<void> | null = null;
function loadJitsiScript(): Promise<void> {
  if (window.JitsiMeetExternalAPI) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    const el = document.createElement("script");
    el.src = `${JITSI_ORIGIN}/external_api.js`;
    el.async = true;
    el.onload = () => resolve();
    el.onerror = () => {
      scriptPromise = null;
      reject(new Error("Jitsi yüklenemedi"));
    };
    document.head.appendChild(el);
  });
  return scriptPromise;
}

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

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [tableMissing, setTableMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [joined, setJoined] = useState(false);
  const [title, setTitle] = useState("");

  const boxRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<JitsiApi | null>(null);

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

  /* Odaya girildiyse Jitsi'yi kur; çıkışta temizle */
  useEffect(() => {
    if (!joined || !meeting || !boxRef.current) return;
    let iptal = false;

    loadJitsiScript()
      .then(() => {
        if (iptal || !boxRef.current || !window.JitsiMeetExternalAPI) return;
        const api = new window.JitsiMeetExternalAPI(JITSI_DOMAIN, {
          roomName: meeting.room,
          parentNode: boxRef.current,
          width: "100%",
          height: "100%",
          userInfo: { displayName },
          configOverwrite: {
            prejoinPageEnabled: false,
            startWithAudioMuted: true,
          },
          interfaceConfigOverwrite: {
            MOBILE_APP_PROMO: false,
            SHOW_JITSI_WATERMARK: false,
          },
        });
        apiRef.current = api;
        api.addListener("videoConferenceLeft", () => setJoined(false));
        api.addListener("readyToClose", () => setJoined(false));
      })
      .catch(() => {
        toast("Toplantı yüklenemedi. Bağlantınızı kontrol edin.", "error");
        setJoined(false);
      });

    return () => {
      iptal = true;
      apiRef.current?.dispose();
      apiRef.current = null;
    };
  }, [joined, meeting, displayName, toast]);

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
    setMeeting(data as Meeting);
    setJoined(true);
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
    setJoined(false);
    setMeeting(null);
    toast("Toplantı sonlandırıldı.");
  }

  const bitirebilir =
    !!meeting && (isAdmin || meeting.started_by === userId);

  return (
    <>
      <PageHeader
        title="Toplantı Odası"
        desc="Takım içi görüşme ve mülakatlar. Görüntü, ses ve sohbet tarayıcıda; uygulama kurmaya gerek yok."
      >
        {meeting && joined && (
          <Button variant="ghost" onClick={() => setJoined(false)}>
            <VideoOff size={15} />
            Odadan çık
          </Button>
        )}
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
      ) : joined && meeting ? (
        <div
          ref={boxRef}
          className="h-[72vh] w-full overflow-hidden rounded-2xl border border-line bg-black"
        />
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
          <Button className="mt-6" onClick={() => setJoined(true)}>
            <LogIn size={15} />
            Toplantıya katıl
          </Button>
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
