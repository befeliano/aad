"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Megaphone, Send, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { DEPT_KEYS, DEPT_LABELS } from "@/lib/constants";
import { DUYURU_RENK, BIRIM_RENK, notRengi } from "@/lib/birim-renk";
import { logAction } from "@/lib/audit";
import { useToast } from "@/components/ui/Toast";

interface Not {
  id: string;
  day: string;
  body: string;
  hedef: string[];
  yazan_birim: string | null;
  created_by: string | null;
  created_at: string;
}

const NOT_SINIRI = 1000;

/**
 * Seçili günün notları — birime özel.
 *
 * Görünürlük RLS'te (takvim-notlari.sql): tam yetkililer hepsini,
 * diğerleri "herkes" notlarını ve kendi birimine yazılanları görür.
 * Yazma: tam yetkililer hedefi seçer (herkes = duyuru, ya da birimler);
 * birim kaptanı yalnızca kendi birimine yazar. Üye okur.
 */
export function GunNotlari({
  gun,
  userId,
  isAdmin,
  role,
  myDept,
  onDegisti,
}: {
  gun: string;
  userId: string;
  isAdmin: boolean;
  role: string;
  myDept: string;
  onDegisti: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const { toast } = useToast();

  const [notlar, setNotlar] = useState<Not[]>([]);
  const [isimler, setIsimler] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [tabloYok, setTabloYok] = useState(false);
  const [metin, setMetin] = useState("");
  const [saving, setSaving] = useState(false);

  const yazabilir = isAdmin || (role === "captain" && !!myDept);
  /* Tam yetkilinin hedef seçimi; varsayılan: kendi birimi, yoksa herkes */
  const [hedef, setHedef] = useState<string[]>(() =>
    isAdmin ? (myDept ? [myDept] : ["herkes"]) : [myDept]
  );

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("calendar_notes")
      .select("*")
      .eq("day", gun)
      .order("created_at");
    if (error) {
      setTabloYok(true);
      setLoading(false);
      return;
    }
    setTabloYok(false);
    const liste = (data as Not[]) || [];
    setNotlar(liste);
    const ids = [...new Set(liste.map((n) => n.created_by).filter((x): x is string => !!x))];
    if (ids.length) {
      const { data: p } = await supabase
        .from("profiles")
        .select("id, full_name, username, email")
        .in("id", ids);
      const m: Record<string, string> = {};
      for (const x of (p as { id: string; full_name: string | null; username: string | null; email: string | null }[]) || []) {
        m[x.id] = x.full_name?.trim() || x.username?.trim() || x.email?.split("@")[0] || "Üye";
      }
      setIsimler(m);
    }
    setLoading(false);
  }, [supabase, gun]);

  useEffect(() => {
    // load() asenkrondur: setState ağ yanıtından sonra çalışır.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  function hedefDegis(k: string) {
    setHedef((v) => {
      if (k === "herkes") return v.includes("herkes") ? [] : ["herkes"];
      const birimler = v.filter((x) => x !== "herkes");
      return birimler.includes(k) ? birimler.filter((x) => x !== k) : [...birimler, k];
    });
  }

  async function ekle() {
    const body = metin.trim().slice(0, NOT_SINIRI);
    if (!body) return;
    const h = isAdmin ? hedef : [myDept];
    if (h.length === 0) {
      toast("Notu kimin göreceğini seçin.", "error");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("calendar_notes")
      .insert([{ day: gun, body, hedef: h }]);
    setSaving(false);
    if (error) {
      toast("Not eklenemedi: " + error.message, "error");
      return;
    }
    void logAction(supabase, "create", "calendar_notes", null, { gun, hedef: h.join(",") });
    setMetin("");
    void load();
    onDegisti();
  }

  async function sil(n: Not) {
    const { error } = await supabase.from("calendar_notes").delete().eq("id", n.id);
    if (error) {
      toast("Silinemedi: " + error.message, "error");
      return;
    }
    void logAction(supabase, "delete", "calendar_notes", n.id, { gun });
    setNotlar((v) => v.filter((x) => x.id !== n.id));
    onDegisti();
  }

  const hedefYaz = (h: string[]) =>
    h.includes("herkes") ? "Herkes" : h.map((k) => DEPT_LABELS[k] || k).join(", ");

  return (
    <div className="mt-4 rounded-xl border border-line bg-bg-2 p-3">
      <div className="eyebrow mb-2 !text-[9.5px]">Notlar</div>

      {tabloYok ? (
        <p className="text-[12px] leading-relaxed text-ink-3">
          Birime özel notlar henüz kurulmadı: Supabase SQL Editor&apos;da{" "}
          <code>supabase/takvim-notlari.sql</code> çalıştırılmalı.
        </p>
      ) : loading ? (
        <p className="flex items-center gap-2 text-[12.5px] text-ink-3">
          <Loader2 size={13} className="animate-spin" />
          Yükleniyor…
        </p>
      ) : (
        <>
          {notlar.length === 0 ? (
            <p className="text-[12.5px] text-ink-3">Bu gün için not yok.</p>
          ) : (
            <ul className="space-y-2">
              {notlar.map((n) => {
                const renk = notRengi(n.hedef, n.yazan_birim);
                const silebilir = isAdmin || n.created_by === userId;
                return (
                  <li
                    key={n.id}
                    className="rounded-lg border border-line bg-bg p-2.5"
                    style={{ borderLeft: `4px solid ${renk}` }}
                  >
                    <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-ink">
                      {n.body}
                    </p>
                    <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px] text-ink-3">
                      <span className="min-w-0 truncate">
                        {n.hedef.includes("herkes") && (
                          <Megaphone size={11} className="mr-1 inline" style={{ color: DUYURU_RENK }} />
                        )}
                        {(n.created_by && isimler[n.created_by]) || "Üye"}
                        {n.yazan_birim ? ` · ${DEPT_LABELS[n.yazan_birim] || n.yazan_birim}` : ""}
                        {" → "}
                        <b className="font-semibold">{hedefYaz(n.hedef)}</b>
                      </span>
                      {silebilir && (
                        <button
                          type="button"
                          onClick={() => void sil(n)}
                          aria-label="Notu sil"
                          className="shrink-0 rounded p-1 text-ink-3 hover:bg-bad/12 hover:text-bad"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {yazabilir && (
            <div className="mt-3 space-y-2 border-t border-line pt-3">
              <textarea
                value={metin}
                onChange={(e) => setMetin(e.target.value)}
                rows={2}
                maxLength={NOT_SINIRI}
                placeholder="Bu güne not ekle…"
                aria-label="Yeni not"
                className="field resize-y text-[13px]"
              />
              {isAdmin ? (
                <div>
                  <div className="mb-1.5 text-[11.5px] font-semibold text-ink-3">Kim görsün?</div>
                  <div className="flex flex-wrap gap-1.5">
                    {["herkes", ...DEPT_KEYS].map((k) => {
                      const secili = hedef.includes(k);
                      const renk = k === "herkes" ? DUYURU_RENK : BIRIM_RENK[k];
                      return (
                        <button
                          key={k}
                          type="button"
                          aria-pressed={secili}
                          onClick={() => hedefDegis(k)}
                          className="rounded-full border px-2.5 py-1 text-[11.5px] font-semibold transition-colors"
                          style={
                            secili
                              ? { background: renk, borderColor: renk, color: "#fff" }
                              : { borderColor: "var(--line-2)" }
                          }
                        >
                          {k === "herkes" ? "Herkes" : DEPT_LABELS[k] || k}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <p className="text-[11.5px] text-ink-3">
                  Bu not yalnızca <b>{DEPT_LABELS[myDept] || myDept}</b> birimine görünür.
                </p>
              )}
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => void ekle()}
                  disabled={saving || !metin.trim()}
                  className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3.5 py-1.5 text-[12.5px] font-semibold text-white transition-all hover:brightness-110 disabled:opacity-55"
                >
                  {saving ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                  Ekle
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
