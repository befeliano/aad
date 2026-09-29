"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  CloudOff,
  FileText,
  GraduationCap,
  Loader2,
  Mail,
  Pencil,
  Phone,
  Plus,
  TriangleAlert,
  User,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { DEPT_KEYS, DEPT_LABELS } from "@/lib/constants";
import {
  BECERILER,
  DURUMLAR,
  DURUM_META,
  NOT_SINIRI,
  notlariBirlestir,
  sorulariGetir,
  type Durum,
  type Mulakat,
} from "@/lib/interview";
import {
  kunyeAlani,
  telefonBaglantisi,
  telefonGoster,
} from "@/lib/interview-form";
import { fmtDateTime } from "@/lib/format";
import { reqText, trimTo, oneOf, LIMITS } from "@/lib/security";
import { logAction } from "@/lib/audit";
import { useToast } from "@/components/ui/Toast";
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  Field,
  Modal,
} from "@/components/ui/Kit";

/** Son tuş vuruşundan bu kadar sonra not kaydedilir */
const KAYIT_GECIKMESI_MS = 1200;
/** Bağlantı koptuysa yeniden deneme aralığı */
const YENIDEN_DENEME_MS = 5000;

/** Not kaydı sonrası sunucudan geri okunan alanlar */
const NOT_KOLONLARI = "notes, notes_version, updated_at, updated_by";

interface NotSurumu {
  notes: string;
  version: number;
}

interface Cakisma extends NotSurumu {
  kim: string | null;
  ne_zaman: string;
}

export function AdayClient({
  initial,
  userId,
  silebilir,
}: {
  initial: Mulakat;
  userId: string;
  silebilir: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const { toast } = useToast();
  const id = initial.id;

  const [aday, setAday] = useState<Mulakat>(initial);

  /* ---------- Ortak not ----------
     taslak      : textarea'daki metin
     kayitliNot  : sunucudaki metin (ekranda "kaydedildi mi" için)
     sunucuRef   : kaydederken "okuduğum sürüm" — async akışlar için ref */
  const [taslak, setTaslak] = useState(initial.notes ?? "");
  const [kayitliNot, setKayitliNot] = useState(initial.notes ?? "");
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [notHatasi, setNotHatasi] = useState(false);
  const [cakisma, setCakisma] = useState<Cakisma | null>(null);
  const [sonKayit, setSonKayit] = useState<string | null>(null);
  const sunucuRef = useRef<NotSurumu>({
    notes: initial.notes ?? "",
    version: initial.notes_version,
  });
  const taslakRef = useRef(initial.notes ?? "");
  const notAlaniRef = useRef<HTMLTextAreaElement>(null);
  const takildiRef = useRef(true);

  const [duzenleOpen, setDuzenleOpen] = useState(false);
  const [silOpen, setSilOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  /* Son düzenleyenin adı — küçük bir önbellek */
  const isimler = useRef<Map<string, string>>(new Map());
  const [sonDuzenleyen, setSonDuzenleyen] = useState<string | null>(null);

  const isimGetir = useCallback(
    async (uid: string | null): Promise<string | null> => {
      if (!uid) return null;
      if (uid === userId) return "siz";
      const onbellek = isimler.current.get(uid);
      if (onbellek) return onbellek;
      const { data } = await supabase
        .from("profiles")
        .select("full_name, username, email")
        .eq("id", uid)
        .maybeSingle();
      const ad =
        data?.full_name || data?.username || data?.email?.split("@")[0] || null;
      if (ad) isimler.current.set(uid, ad);
      return ad;
    },
    [supabase, userId]
  );

  useEffect(() => {
    let iptal = false;
    void isimGetir(aday.updated_by).then((ad) => {
      if (!iptal) setSonDuzenleyen(ad);
    });
    return () => {
      iptal = true;
    };
  }, [aday.updated_by, isimGetir]);

  function taslakDegis(metin: string) {
    taslakRef.current = metin;
    setTaslak(metin);
  }

  /**
   * Notu kaydeder. Yalnızca okuduğumuz sürüm hâlâ güncelse yazar;
   * arada başkası kaydetmişse iki metni birleştirmeyi dener, olmazsa
   * kullanıcıya sorar. Hiçbir durumda karşı tarafın metnini sessizce ezmez.
   */
  const notuKaydet = useCallback(async () => {
    setKaydediliyor(true);
    for (let deneme = 0; deneme < 3; deneme++) {
      const metin = taslakRef.current;
      const { data, error } = await supabase
        .from("interviews")
        .update({ notes: metin || null })
        .eq("id", id)
        .eq("notes_version", sunucuRef.current.version)
        .select(NOT_KOLONLARI);

      if (error) {
        setNotHatasi(true);
        setKaydediliyor(false);
        return;
      }

      if (data && data.length > 0) {
        const r = data[0] as Pick<
          Mulakat,
          "notes" | "notes_version" | "updated_at" | "updated_by"
        >;
        sunucuRef.current = { notes: r.notes ?? "", version: r.notes_version };
        setKayitliNot(r.notes ?? "");
        setAday((a) => ({ ...a, ...r }));
        setSonKayit(r.updated_at);
        setNotHatasi(false);
        setKaydediliyor(false);
        return;
      }

      /* Sürüm tutmadı: biri bizden önce kaydetti */
      const { data: son } = await supabase
        .from("interviews")
        .select(NOT_KOLONLARI)
        .eq("id", id)
        .maybeSingle();
      if (!son) {
        // Aday silinmiş olabilir
        setNotHatasi(true);
        setKaydediliyor(false);
        return;
      }

      const onlarin: NotSurumu = {
        notes: son.notes ?? "",
        version: son.notes_version,
      };
      const birlesik = notlariBirlestir(
        sunucuRef.current.notes,
        taslakRef.current,
        onlarin.notes
      );

      if (birlesik === null && takildiRef.current) {
        setCakisma({
          ...onlarin,
          kim: await isimGetir(son.updated_by),
          ne_zaman: son.updated_at,
        });
        setKaydediliyor(false);
        return;
      }

      // Birleştirilebildi (ya da sayfa kapanıyor: hiçbir metni kaybetme)
      sunucuRef.current = onlarin;
      const yeni = birlesik ?? `${onlarin.notes}\n\n${taslakRef.current}`;
      taslakRef.current = yeni;
      setTaslak(yeni);
      setKayitliNot(onlarin.notes);
    }
    setNotHatasi(true);
    setKaydediliyor(false);
  }, [supabase, id, isimGetir]);

  const degisti = taslak !== kayitliNot;

  /* Otomatik kayıt: yazmayı bırakınca */
  useEffect(() => {
    if (!degisti || kaydediliyor || cakisma) return;
    const t = setTimeout(
      () => void notuKaydet(),
      notHatasi ? YENIDEN_DENEME_MS : KAYIT_GECIKMESI_MS
    );
    return () => clearTimeout(t);
  }, [taslak, degisti, kaydediliyor, cakisma, notHatasi, notuKaydet]);

  /* Sekme kapanırken kaydedilmemiş not varsa uyar */
  useEffect(() => {
    if (!degisti && !kaydediliyor) return;
    const uyar = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", uyar);
    return () => window.removeEventListener("beforeunload", uyar);
  }, [degisti, kaydediliyor]);

  /* Panel içinde başka sayfaya geçilirse bekleyen notu hemen gönder */
  useEffect(() => {
    takildiRef.current = true;
    return () => {
      takildiRef.current = false;
      // Bilerek güncel değer okunuyor: ayrılma anındaki taslak lazım.
      if (taslakRef.current !== sunucuRef.current.notes) void notuKaydet();
    };
  }, [notuKaydet]);

  /* Canlı: başkası bu adayı güncellerse */
  useEffect(() => {
    const ch = supabase
      .channel(`mulakat-aday-${id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "interviews",
          filter: `id=eq.${id}`,
        },
        (payload) => {
          const yeni = payload.new as Mulakat;
          // Kendi kaydımızın yankısı: cevabı zaten notuKaydet işliyor
          if (yeni.updated_by === userId) return;

          setAday((a) => ({ ...a, ...yeni }));

          if (yeni.notes_version > sunucuRef.current.version) {
            // Yazmıyorsak başkasının notunu hemen göster; yazıyorsak
            // kayıt sırasında birleştirilecek.
            if (taslakRef.current === sunucuRef.current.notes) {
              sunucuRef.current = {
                notes: yeni.notes ?? "",
                version: yeni.notes_version,
              };
              taslakRef.current = yeni.notes ?? "";
              setTaslak(yeni.notes ?? "");
              setKayitliNot(yeni.notes ?? "");
              setSonKayit(null); // durum satırı artık onların düzenlemesini göstersin
            }
          }
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [supabase, id, userId]);

  function cakismayiCoz(secim: "birlestir" | "benimki" | "onlarinki") {
    if (!cakisma) return;
    sunucuRef.current = { notes: cakisma.notes, version: cakisma.version };
    setKayitliNot(cakisma.notes);
    if (secim === "birlestir") {
      taslakDegis(`${cakisma.notes}\n\n${taslakRef.current}`);
    } else if (secim === "onlarinki") {
      taslakDegis(cakisma.notes);
    }
    // "benimki": taslak aynen kalır, güncel sürümün üzerine yazılır
    setCakisma(null);
  }

  /** Soru rehberinden seçilen soruyu notun sonuna başlık olarak ekler */
  function soruyuNotaEkle(soru: string) {
    const mevcut = taslakRef.current;
    const ayrac = mevcut === "" ? "" : mevcut.endsWith("\n") ? "\n" : "\n\n";
    taslakDegis(`${mevcut}${ayrac}▸ ${soru}\n`);
    requestAnimationFrame(() => {
      const el = notAlaniRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
      el.scrollTop = el.scrollHeight;
    });
  }

  /* ---------- Tek tıkla kaydedilen alanlar (durum, puan, beceri, birim) ---------- */
  async function alanKaydet(
    patch: Partial<Pick<Mulakat, "status" | "score" | "skills" | "dept">>,
    kayit?: Record<string, unknown>
  ) {
    const onceki = aday;
    setAday((a) => ({ ...a, ...patch }));
    const { error } = await supabase
      .from("interviews")
      .update(patch)
      .eq("id", id);
    if (error) {
      setAday(onceki);
      toast("Kaydedilemedi: " + error.message, "error");
      return;
    }
    if (kayit) {
      void logAction(supabase, "update", "interviews", id, {
        aday: `${aday.first_name} ${aday.last_name}`.trim(),
        ...kayit,
      });
    }
  }

  function beceriDegis(k: string) {
    const n = new Set(aday.skills || []);
    if (n.has(k)) n.delete(k);
    else n.add(k);
    void alanKaydet({ skills: [...n] });
  }

  async function kunyeKaydet(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const ad = reqText(fd.get("first_name"), LIMITS.name);
    if (!ad) {
      toast("Ad zorunlu.", "error");
      return;
    }
    const yasHam = Number(fd.get("age"));
    const dept = oneOf(fd.get("dept"), ["", ...DEPT_KEYS] as const, "");
    const patch = {
      first_name: ad,
      last_name: reqText(fd.get("last_name"), LIMITS.name),
      phone: trimTo(fd.get("phone"), 40),
      email: trimTo(fd.get("email"), LIMITS.name),
      program: trimTo(fd.get("program"), LIMITS.name),
      age: yasHam >= 15 && yasHam <= 70 ? Math.round(yasHam) : null,
      dept: dept || null,
    };
    setSaving(true);
    const { error } = await supabase
      .from("interviews")
      .update(patch)
      .eq("id", id);
    setSaving(false);
    if (error) {
      toast("Kaydedilemedi: " + error.message, "error");
      return;
    }
    setAday((a) => ({ ...a, ...patch }));
    void logAction(supabase, "update", "interviews", id, {
      aday: `${patch.first_name} ${patch.last_name}`.trim(),
      alan: "künye",
    });
    toast("Bilgiler güncellendi.");
    setDuzenleOpen(false);
  }

  async function sil() {
    const { error } = await supabase.from("interviews").delete().eq("id", id);
    setSilOpen(false);
    if (error) {
      toast("Silinemedi: " + error.message, "error");
      return;
    }
    void logAction(supabase, "delete", "interviews", id, {
      aday: `${aday.first_name} ${aday.last_name}`.trim(),
    });
    // Silinen adayın notunu çıkışta kaydetmeye çalışma
    sunucuRef.current = { ...sunucuRef.current, notes: taslakRef.current };
    toast("Aday silindi.");
    router.push("/panel/mulakat");
  }

  /* Formdaki cevaplar: künye kartında gösterilenler hariç */
  const formCevaplari = useMemo(
    () => (aday.form_data || []).filter((c) => kunyeAlani(c.soru) === null),
    [aday.form_data]
  );
  const dept = aday.dept ?? "";
  const beceriler = BECERILER[dept] || [];
  const sorular = sorulariGetir(dept);
  const eskiCevaplar = Object.entries(aday.answers || {}).filter(
    ([, v]) => v && v.trim()
  );

  const tamAd = `${aday.first_name} ${aday.last_name}`.trim();

  return (
    <>
      {/* Başlık */}
      <div className="mb-6 border-b border-line pb-6">
        <Link
          href="/panel/mulakat"
          className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-3 transition-colors hover:text-ink"
        >
          <ArrowLeft size={15} />
          Tüm adaylar
        </Link>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="display-tight break-words text-3xl text-ink sm:text-4xl">
              {tamAd}
            </h1>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <Badge tone={DURUM_META[aday.status].tone}>
                {DURUM_META[aday.status].etiket}
              </Badge>
              {aday.dept && (
                <Badge tone="neutral">
                  {DEPT_LABELS[aday.dept] || aday.dept}
                </Badge>
              )}
              {aday.source === "form" && (
                <span className="inline-flex items-center gap-1 text-[12px] text-ink-3">
                  <FileText size={12} />
                  Başvuru formu · {fmtDateTime(aday.submitted_at)}
                </span>
              )}
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => setDuzenleOpen(true)}>
            <Pencil size={13} />
            Bilgileri düzenle
          </Button>
        </div>
      </div>

      {/*
        Masaüstünde iki sütun: solda künye → değerlendirme → formdaki
        cevaplar, sağda not (yapışkan: uzun cevapları okurken not kutusu
        görünür kalır). Telefonda sıra: künye → not → değerlendirme →
        cevaplar — görüşme sırasında not kutusu en alta düşmesin.
      */}
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        {/* Künye */}
        <Card title="Başvuru bilgileri" className="lg:col-start-1 lg:row-start-1">
          <dl className="grid gap-x-6 gap-y-4 p-5 sm:grid-cols-2">
            <Bilgi ikon={<Phone size={14} />} etiket="Telefon">
              {aday.phone ? (
                <a
                  href={telefonBaglantisi(aday.phone)}
                  className="tabular text-accent hover:underline"
                >
                  {telefonGoster(aday.phone)}
                </a>
              ) : null}
            </Bilgi>
            <Bilgi ikon={<Mail size={14} />} etiket="E-posta">
              {aday.email ? (
                <a
                  href={`mailto:${aday.email}`}
                  className="break-all text-accent hover:underline"
                >
                  {aday.email}
                </a>
              ) : null}
            </Bilgi>
            <Bilgi
              ikon={<GraduationCap size={14} />}
              etiket="Üniversite / bölüm"
              className="sm:col-span-2"
            >
              {aday.program}
            </Bilgi>
            <Bilgi ikon={<User size={14} />} etiket="Yaş">
              {aday.age ? `${aday.age}` : null}
            </Bilgi>
            <Bilgi ikon={<User size={14} />} etiket="İstediği birim">
              {aday.dept ? DEPT_LABELS[aday.dept] || aday.dept : null}
            </Bilgi>
          </dl>
        </Card>

        {/* Not — masaüstünde sağ sütunda sabit */}
        <div className="lg:sticky lg:top-6 lg:col-start-2 lg:row-span-3 lg:row-start-1">
          <Card
            title="Mülakat notu"
            actions={
              <NotDurumu
                kaydediliyor={kaydediliyor}
                degisti={degisti}
                hata={notHatasi}
                cakisma={!!cakisma}
                kaydedildi={sonKayit}
                sonDuzenleme={
                  aday.updated_by
                    ? { ne_zaman: aday.updated_at, kim: sonDuzenleyen }
                    : null
                }
                tekrarDene={() => void notuKaydet()}
              />
            }
          >
            {cakisma && (
              <div className="border-b border-line bg-warn/10 px-5 py-4">
                <div className="flex items-start gap-2.5">
                  <TriangleAlert size={16} className="mt-0.5 shrink-0 text-warn" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-ink">
                      Bu not siz yazarken{" "}
                      {cakisma.kim ? `${cakisma.kim} tarafından` : "başka birinden"}{" "}
                      değiştirildi ({saatGoster(cakisma.ne_zaman)}).
                    </p>
                    <p className="mt-0.5 text-[12.5px] text-ink-2">
                      Sizin yazdıklarınız kaybolmadı. Onların sürümü:
                    </p>
                    <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg border border-line bg-bg p-3 font-sans text-[12.5px] text-ink-2">
                      {cakisma.notes || "(boş)"}
                    </pre>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => cakismayiCoz("birlestir")}>
                        İkisini birleştir
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => cakismayiCoz("benimki")}
                      >
                        Benimkini kaydet
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => cakismayiCoz("onlarinki")}
                      >
                        Onlarınkini al
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div className="p-5">
              <textarea
                ref={notAlaniRef}
                value={taslak}
                onChange={(e) => taslakDegis(e.target.value)}
                onBlur={() => {
                  if (degisti && !kaydediliyor && !cakisma) void notuKaydet();
                }}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
                    e.preventDefault();
                    if (degisti && !kaydediliyor && !cakisma) void notuKaydet();
                  }
                }}
                maxLength={NOT_SINIRI}
                rows={16}
                aria-label="Mülakat notu"
                placeholder="Görüşme sırasında aklınıza gelenleri buraya yazın. Not siz yazdıkça kaydedilir; paneldeki herkes görüp ekleyebilir."
                className="field min-h-[320px] resize-y text-[14px] leading-relaxed"
              />
              <div className="mt-1.5 text-right text-[11px] text-ink-3 tabular">
                {taslak.length.toLocaleString("tr-TR")} /{" "}
                {NOT_SINIRI.toLocaleString("tr-TR")}
              </div>

              {/* Soru rehberi — tıklanan soru nota başlık olarak eklenir */}
              <details className="mt-3 rounded-xl border border-line bg-bg">
                <summary className="cursor-pointer select-none px-4 py-3 text-[13px] font-semibold text-ink-2">
                  Soru rehberi
                  {!aday.dept && (
                    <span className="font-normal text-ink-3">
                      {" "}
                      · birim seçilince birime özel sorular da çıkar
                    </span>
                  )}
                </summary>
                <ul className="space-y-1 px-2 pb-2">
                  {sorular.map((s) => (
                    <li key={s.key}>
                      <button
                        type="button"
                        onClick={() => soruyuNotaEkle(s.label)}
                        className="flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left text-[13px] text-ink-2 transition-colors hover:bg-bg-2 hover:text-ink"
                      >
                        <Plus size={14} className="mt-0.5 shrink-0 text-accent" />
                        {s.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </details>
            </div>
          </Card>
        </div>

        {/* Değerlendirme — tek tıkla kaydedilir */}
        <div className="space-y-3 lg:col-start-1 lg:row-start-2">
          <Card title="Değerlendirme">
            <div className="space-y-5 p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Durum">
                  <select
                    value={aday.status}
                    onChange={(e) => {
                      const s: Durum = oneOf(e.target.value, DURUMLAR, aday.status);
                      void alanKaydet({ status: s }, { durum: s });
                    }}
                    className="field"
                  >
                    {DURUMLAR.map((d) => (
                      <option key={d} value={d}>
                        {DURUM_META[d].etiket}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Birim">
                  <select
                    value={dept}
                    onChange={(e) => {
                      const d = oneOf(e.target.value, ["", ...DEPT_KEYS] as const, "");
                      // Birim değişince eski birimin becerileri anlamsız kalır
                      void alanKaydet({ dept: d || null, skills: [] }, { birim: d });
                    }}
                    className="field"
                  >
                    <option value="">Seçilmedi</option>
                    {DEPT_KEYS.map((k) => (
                      <option key={k} value={k}>
                        {DEPT_LABELS[k] || k}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <div>
                <div className="mb-1.5 text-[12.5px] font-semibold text-ink-2">
                  Puan{" "}
                  <span className="font-normal text-ink-3">
                    · 1 zayıf, 5 çok iyi
                  </span>
                </div>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      aria-pressed={aday.score === n}
                      aria-label={`Puan ${n}`}
                      onClick={() =>
                        void alanKaydet(
                          { score: aday.score === n ? null : n },
                          { puan: aday.score === n ? null : n }
                        )
                      }
                      className={`flex size-10 items-center justify-center rounded-lg border text-sm font-bold transition-colors ${
                        aday.score !== null && n <= aday.score
                          ? "border-accent bg-accent text-white"
                          : "border-line bg-bg text-ink-3 hover:border-ink-3"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {beceriler.length > 0 && (
                <div>
                  <div className="mb-2 text-[12.5px] font-semibold text-ink-2">
                    Bildiği programlar / beceriler
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {beceriler.map((b) => {
                      const secili = (aday.skills || []).includes(b.key);
                      return (
                        <button
                          key={b.key}
                          type="button"
                          aria-pressed={secili}
                          onClick={() => beceriDegis(b.key)}
                          className={`rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                            secili
                              ? "border-accent bg-accent text-white"
                              : "border-line bg-bg text-ink-2 hover:border-ink-3 hover:text-ink"
                          }`}
                        >
                          {b.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </Card>

          {silebilir && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setSilOpen(true)}
                className="rounded-full px-3 py-1.5 text-[12.5px] font-semibold text-ink-3 transition-colors hover:text-bad"
              >
                Adayı sil
              </button>
            </div>
          )}
        </div>

        {/* Formdaki diğer cevaplar */}
        <Card
          title="Formdaki cevaplar"
          desc={
            aday.source === "form"
              ? "Adayın başvuru formuna yazdıkları — değiştirilemez."
              : "Bu aday elle eklendi, form cevabı yok."
          }
          className="lg:col-start-1 lg:row-start-3"
        >
          {formCevaplari.length > 0 ? (
            <dl className="divide-y divide-line">
              {formCevaplari.map((c, i) => (
                <div key={i} className="px-5 py-4">
                  <dt className="text-[12.5px] font-semibold text-ink-3">
                    {c.soru}
                  </dt>
                  <dd className="mt-1 whitespace-pre-wrap break-words text-[14px] leading-relaxed text-ink">
                    {c.cevap}
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="px-5 py-6 text-sm text-ink-3">—</p>
          )}

          {/* Eski mülakat formundan kalan cevaplar (soru-soru doldurulan sürüm) */}
          {eskiCevaplar.length > 0 && (
            <div className="border-t border-line px-5 py-4">
              <div className="eyebrow mb-3 !text-[10px]">
                Önceki değerlendirme cevapları
              </div>
              <dl className="space-y-3">
                {eskiCevaplar.map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-[12.5px] font-semibold text-ink-3">
                      {sorular.find((s) => s.key === k)?.label ?? k}
                    </dt>
                    <dd className="mt-0.5 whitespace-pre-wrap text-[13.5px] text-ink-2">
                      {v}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </Card>
      </div>

      {/* Künye düzenleme */}
      <Modal
        open={duzenleOpen}
        onClose={() => setDuzenleOpen(false)}
        title="Aday bilgilerini düzenle"
      >
        <form onSubmit={kunyeKaydet} className="space-y-4">
          {aday.source === "form" && (
            <p className="text-[12.5px] text-ink-3">
              Yazım hatalarını düzeltmek için. Formdaki orijinal cevaplar
              değişmez.
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Ad">
              <input
                name="first_name"
                required
                defaultValue={aday.first_name}
                maxLength={LIMITS.name}
                className="field"
              />
            </Field>
            <Field label="Soyad">
              <input
                name="last_name"
                defaultValue={aday.last_name}
                maxLength={LIMITS.name}
                className="field"
              />
            </Field>
            <Field label="Telefon">
              <input
                name="phone"
                type="tel"
                defaultValue={aday.phone || ""}
                maxLength={40}
                className="field"
              />
            </Field>
            <Field label="E-posta">
              <input
                name="email"
                type="email"
                defaultValue={aday.email || ""}
                maxLength={LIMITS.name}
                className="field"
              />
            </Field>
            <Field label="Üniversite / bölüm" className="sm:col-span-2">
              <input
                name="program"
                defaultValue={aday.program || ""}
                maxLength={LIMITS.name}
                className="field"
              />
            </Field>
            <Field label="Yaş">
              <input
                name="age"
                type="number"
                min={15}
                max={70}
                defaultValue={aday.age ?? ""}
                className="field"
              />
            </Field>
            <Field label="Birim">
              <select name="dept" defaultValue={dept} className="field">
                <option value="">Seçilmedi</option>
                {DEPT_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {DEPT_LABELS[k] || k}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="flex justify-end gap-2.5 border-t border-line pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDuzenleOpen(false)}
            >
              Vazgeç
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 size={15} className="animate-spin" />}
              Kaydet
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={silOpen}
        title="Adayı sil"
        message={`${tamAd} ve mülakat notu kalıcı olarak silinecek.`}
        onCancel={() => setSilOpen(false)}
        onConfirm={sil}
      />
    </>
  );
}

function Bilgi({
  ikon,
  etiket,
  children,
  className = "",
}: {
  ikon: React.ReactNode;
  etiket: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-wide text-ink-3">
        {ikon}
        {etiket}
      </dt>
      <dd className="mt-1 text-[14px] text-ink">
        {children || <span className="text-ink-3">—</span>}
      </dd>
    </div>
  );
}

function NotDurumu({
  kaydediliyor,
  degisti,
  hata,
  cakisma,
  kaydedildi,
  sonDuzenleme,
  tekrarDene,
}: {
  kaydediliyor: boolean;
  degisti: boolean;
  hata: boolean;
  cakisma: boolean;
  /** Bu oturumda notu en son kaydettiğimiz an */
  kaydedildi: string | null;
  /** Kayıttaki son değişiklik (not ya da başka alan) */
  sonDuzenleme: { ne_zaman: string; kim: string | null } | null;
  tekrarDene: () => void;
}) {
  const kutu = "inline-flex items-center gap-1.5 text-[12px]";
  if (cakisma) {
    return (
      <span className={`${kutu} font-semibold text-warn`}>
        <TriangleAlert size={13} />
        Karar bekliyor
      </span>
    );
  }
  if (kaydediliyor) {
    return (
      <span className={`${kutu} text-ink-3`}>
        <Loader2 size={13} className="animate-spin" />
        Kaydediliyor…
      </span>
    );
  }
  if (hata) {
    return (
      <button
        type="button"
        onClick={tekrarDene}
        className={`${kutu} font-semibold text-bad hover:underline`}
      >
        <CloudOff size={13} />
        Kaydedilemedi — tekrar dene
      </button>
    );
  }
  if (degisti) {
    return <span className={`${kutu} text-ink-3`}>Yazılıyor…</span>;
  }
  if (kaydedildi) {
    return (
      <span className={`${kutu} text-ink-3`}>
        <Check size={13} className="text-ok" />
        Kaydedildi · {saatGoster(kaydedildi)}
      </span>
    );
  }
  if (!sonDuzenleme) return null;
  return (
    <span className={`${kutu} text-ink-3`}>
      Son düzenleme · {fmtDateTime(sonDuzenleme.ne_zaman)}
      {sonDuzenleme.kim ? ` · ${sonDuzenleme.kim}` : ""}
    </span>
  );
}

/** "14:32" */
function saatGoster(iso: string): string {
  return new Date(iso).toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
