"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Plus,
  ChevronRight,
  Search,
  Download,
  Upload,
  Trash2,
  Pencil,
  Minus,
  PackageX,
  TriangleAlert,
  Boxes,
  Wallet,
  CalendarClock,
  BatteryWarning,
} from "lucide-react";
import { useKaliciFiltre } from "@/lib/useKaliciFiltre";
import { createClient } from "@/lib/supabase/client";
import { DEPT_KEYS, DEPT_LABELS } from "@/lib/constants";
import { fmtMoney, toCSV, downloadFile, parseCSV } from "@/lib/format";
import type { StockItem } from "@/lib/types";
import {
  statusOf,
  STATUS_META,
  daysUntil,
  expiryText,
  EXPIRY_WARN_DAYS,
} from "@/lib/stock-health";
import { useToast } from "@/components/ui/Toast";
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Field,
  Modal,
} from "@/components/ui/Kit";
import { PageHeader } from "@/components/panel/PageHeader";

export function EnvanterClient({ userId }: { userId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const { toast } = useToast();

  const [items, setItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useKaliciFiltre("envanter.q", "");
  const [dept, setDept] = useKaliciFiltre("envanter.dept", "");
  const [onlyLow, setOnlyLow] = useKaliciFiltre("envanter.onlyLow", false);
  /* Departmana göre grupla — filtre zaten vardı ama gruplama, hangi
     birimin neye sahip olduğunu tek bakışta gösteriyor. */
  const [grupla, setGrupla] = useState(true);
  const [kapali, setKapali] = useState<Set<string>>(new Set());

  const [editing, setEditing] = useState<StockItem | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [delTarget, setDelTarget] = useState<StockItem | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);

  /* ---------- veri ---------- */
  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("stock")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast("Envanter yüklenemedi: " + error.message, "error");
    } else {
      setItems((data as StockItem[]) || []);
    }
    setLoading(false);
  }, [supabase, toast]);

  useEffect(() => {
    /* load() asenkrondur: setState ancak ağ yanıtı geldikten sonra
       çalışır, dolayısıyla senkron bir render zinciri oluşmaz. */
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const ch = supabase
      .channel("realtime:stock")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "stock" },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [supabase, load]);

  /* ---------- filtre ---------- */
  const filtered = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase("tr");
    return items.filter((s) => {
      if (dept && s.dept !== dept) return false;
      if (onlyLow && statusOf(s) === "ok") return false;
      if (needle) {
        const hay = `${s.name} ${s.location || ""} ${
          DEPT_LABELS[s.dept] || s.dept
        }`.toLocaleLowerCase("tr");
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [items, q, dept, onlyLow]);

  /**
   * Departman grupları. Sıra DEPT_KEYS'e göre; tanımsız departmanlar sonda.
   * Grup başlığında kalem sayısı ve o birimin toplam envanter değeri var.
   */
  const gruplar = useMemo(() => {
    const m = new Map<string, StockItem[]>();
    for (const it of filtered) {
      const k = (it.dept || "").trim() || "ortak";
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(it);
    }
    const sira = [...DEPT_KEYS, "ortak"] as string[];
    return [...m.entries()].sort((a, b) => {
      const ia = sira.indexOf(a[0]);
      const ib = sira.indexOf(b[0]);
      if (ia === -1 && ib === -1) return a[0].localeCompare(b[0], "tr");
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
  }, [filtered]);

  /* ---------- özet ---------- */
  const summary = useMemo(() => {
    const st = items.map(statusOf);
    return {
      total: items.length,
      out: st.filter((x) => x === "out").length,
      critical: st.filter((x) => x === "critical").length,
      expiring: st.filter((x) => x === "expiring").length,
      expired: st.filter((x) => x === "expired" || x === "worn").length,
      value: items.reduce((a, s) => a + Number(s.qty) * Number(s.price || 0), 0),
    };
  }, [items]);

  /* ---------- işlemler ---------- */
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = {
      name: String(fd.get("name") || "").trim(),
      dept: String(fd.get("dept") || ""),
      qty: Number(fd.get("qty") || 0),
      unit: String(fd.get("unit") || "").trim() || null,
      price: Number(fd.get("price") || 0),
      min_stock: Number(fd.get("min_stock") || 0),
      location: String(fd.get("location") || "").trim() || null,
      expiry_date: String(fd.get("expiry_date") || "").trim() || null,
      batch_no: String(fd.get("batch_no") || "").trim() || null,
      cycle_count: fd.get("cycle_count")
        ? Number(fd.get("cycle_count"))
        : null,
      cycle_limit: fd.get("cycle_limit")
        ? Number(fd.get("cycle_limit"))
        : null,
    };
    if (!payload.name || !payload.dept) {
      toast("Malzeme adı ve departman zorunlu.", "error");
      return;
    }

    setSaving(true);
    const { error } = editing
      ? await supabase.from("stock").update(payload).eq("id", editing.id)
      : await supabase.from("stock").insert([{ ...payload, created_by: userId }]);
    setSaving(false);

    if (error) {
      toast("Kaydedilemedi: " + error.message, "error");
      return;
    }
    toast(editing ? "Malzeme güncellendi." : "Malzeme eklendi.");
    setFormOpen(false);
    setEditing(null);
    load();
  }

  /** Hızlı miktar değişimi — iyimser güncelleme */
  async function adjustQty(item: StockItem, delta: number) {
    const next = Math.max(0, Number(item.qty) + delta);
    setItems((v) =>
      v.map((s) => (s.id === item.id ? { ...s, qty: next } : s))
    );
    const { error } = await supabase
      .from("stock")
      .update({ qty: next })
      .eq("id", item.id);
    if (error) {
      toast("Güncellenemedi: " + error.message, "error");
      load();
    }
  }

  async function doDelete() {
    if (!delTarget) return;
    const { error } = await supabase
      .from("stock")
      .delete()
      .eq("id", delTarget.id);
    if (error) toast("Silinemedi: " + error.message, "error");
    else toast(`"${delTarget.name}" silindi.`);
    setDelTarget(null);
    load();
  }

  function exportCSV() {
    const rows = filtered.map((s) => [
      s.name,
      DEPT_LABELS[s.dept] || s.dept,
      s.qty,
      s.unit || "",
      s.price ?? 0,
      Number(s.qty) * Number(s.price || 0),
      s.min_stock ?? 0,
      s.location || "",
      s.expiry_date || "",
      s.batch_no || "",
      s.cycle_limit ? `${s.cycle_count ?? 0}/${s.cycle_limit}` : "",
      STATUS_META[statusOf(s)].label,
    ]);
    const csv = toCSV(
      [
        "Malzeme",
        "Departman",
        "Miktar",
        "Birim",
        "Birim Fiyat",
        "Toplam Değer",
        "Min. Stok",
        "Konum",
        "SKT",
        "Parti No",
        "Şarj Döngüsü",
        "Durum",
      ],
      rows
    );
    downloadFile(
      csv,
      `envanter-${new Date().toISOString().slice(0, 10)}.csv`
    );
    toast(`${rows.length} kayıt dışa aktarıldı.`);
  }

  async function importCSV(file: File) {
    try {
      const rows = parseCSV(await file.text());
      if (rows.length < 2) {
        toast("CSV boş görünüyor.", "error");
        return;
      }
      // Başlık satırını atla; beklenen sıra: Malzeme;Departman;Miktar;Birim;Fiyat;;Min;Konum
      const labelToKey = Object.fromEntries(
        DEPT_KEYS.map((k) => [DEPT_LABELS[k].toLocaleLowerCase("tr"), k])
      );
      const payload = rows.slice(1).flatMap((r) => {
        const name = (r[0] || "").trim();
        if (!name) return [];
        const deptRaw = (r[1] || "").trim().toLocaleLowerCase("tr");
        const deptKey =
          labelToKey[deptRaw] ||
          (DEPT_KEYS as string[]).find((k) => k === deptRaw) ||
          "ortak";
        return [
          {
            name,
            dept: deptKey,
            qty: Number(String(r[2] || "0").replace(",", ".")) || 0,
            unit: (r[3] || "").trim() || null,
            price: Number(String(r[4] || "0").replace(",", ".")) || 0,
            min_stock: Number(String(r[6] || "0").replace(",", ".")) || 0,
            location: (r[7] || "").trim() || null,
            created_by: userId,
          },
        ];
      });
      if (payload.length === 0) {
        toast("İçe aktarılacak geçerli satır bulunamadı.", "error");
        return;
      }
      const { error } = await supabase.from("stock").insert(payload);
      if (error) {
        toast("İçe aktarma hatası: " + error.message, "error");
        return;
      }
      toast(`${payload.length} malzeme içe aktarıldı.`);
      load();
    } catch (ex) {
      toast("Dosya okunamadı: " + (ex as Error).message, "error");
    }
  }


  /** Tek envanter satırı — hem düz listede hem grup içinde kullanılıyor */
  function satir(s: StockItem) {
                  const st = statusOf(s);
                  const meta = STATUS_META[st];
                  const total = Number(s.qty) * Number(s.price || 0);
                  return (
                    <tr
                      key={s.id}
                      className="border-b border-line last:border-0 transition-colors hover:bg-bg-2/60"
                    >
                      <td className="px-4 py-3">
                        <div className="font-semibold text-ink">{s.name}</div>
                        {s.min_stock ? (
                          <div className="mt-0.5 text-[11.5px] text-ink-3">
                            Min. {s.min_stock} {s.unit || ""}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone="info">
                          {DEPT_LABELS[s.dept] || s.dept}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => adjustQty(s, -1)}
                            className="flex size-6 items-center justify-center rounded-md border border-line text-ink-3 transition-colors hover:border-line-2 hover:text-ink"
                            aria-label="Azalt"
                          >
                            <Minus size={12} />
                          </button>
                          <span className="tabular min-w-[3.5rem] text-right font-semibold text-ink">
                            {s.qty} {s.unit || ""}
                          </span>
                          <button
                            type="button"
                            onClick={() => adjustQty(s, 1)}
                            className="flex size-6 items-center justify-center rounded-md border border-line text-ink-3 transition-colors hover:border-line-2 hover:text-ink"
                            aria-label="Artır"
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                      </td>
                      <td className="tabular px-4 py-3 text-right text-ink-2">
                        {s.price ? `${fmtMoney(s.price)} ₺` : "—"}
                      </td>
                      <td className="tabular px-4 py-3 text-right font-semibold text-ink">
                        {total ? `${fmtMoney(total)} ₺` : "—"}
                      </td>
                      <td className="px-4 py-3 text-ink-2">
                        {s.location || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <ExpiryCell item={s} />
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={meta.tone}>{meta.label}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditing(s);
                              setFormOpen(true);
                            }}
                            className="flex size-7 items-center justify-center rounded-md text-ink-3 transition-colors hover:bg-bg-2 hover:text-ink"
                            aria-label="Düzenle"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDelTarget(s)}
                            className="flex size-7 items-center justify-center rounded-md text-ink-3 transition-colors hover:bg-bad/12 hover:text-bad"
                            aria-label="Sil"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
  }

  return (
    <>
      <PageHeader
        title="Envanter"
        desc="Takım malzemelerinin stok takibi. Kritik seviyeye düşenler otomatik işaretlenir."
      >
        <Button variant="outline" size="md" onClick={exportCSV}>
          <Download size={15} />
          CSV indir
        </Button>
        <Button
          variant="outline"
          size="md"
          onClick={() => fileRef.current?.click()}
        >
          <Upload size={15} />
          İçe aktar
        </Button>
        <Button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus size={16} />
          Malzeme Ekle
        </Button>
      </PageHeader>

      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) importCSV(f);
          e.target.value = "";
        }}
      />

      {/* Özet */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <SummaryTile
          icon={<Boxes size={18} />}
          label="Toplam Kalem"
          value={String(summary.total)}
        />
        <SummaryTile
          icon={<TriangleAlert size={18} />}
          label="Kritik Seviye"
          value={String(summary.critical)}
          tone={summary.critical > 0 ? "warn" : undefined}
        />
        <SummaryTile
          icon={<PackageX size={18} />}
          label="Tükenen"
          value={String(summary.out)}
          tone={summary.out > 0 ? "bad" : undefined}
        />
        <SummaryTile
          icon={<CalendarClock size={18} />}
          label={`SKT ${EXPIRY_WARN_DAYS} Gün İçinde`}
          value={String(summary.expiring)}
          tone={summary.expiring > 0 ? "warn" : undefined}
        />
        <SummaryTile
          icon={<BatteryWarning size={18} />}
          label="SKT Geçen / Ömrü Dolan"
          value={String(summary.expired)}
          tone={summary.expired > 0 ? "bad" : undefined}
        />
        <SummaryTile
          icon={<Wallet size={18} />}
          label="Toplam Değer"
          value={`${fmtMoney(summary.value)} ₺`}
        />
      </div>

      {/* Filtreler + tablo */}
      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4">
          <div className="relative min-w-[210px] flex-1">
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3"
            />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Malzeme, konum veya departman ara…"
              className="field !pl-9"
            />
          </div>
          <select
            value={dept}
            onChange={(e) => setDept(e.target.value)}
            className="field !w-auto"
          >
            <option value="">Tüm departmanlar</option>
            {DEPT_KEYS.map((k) => (
              <option key={k} value={k}>
                {DEPT_LABELS[k]}
              </option>
            ))}
          </select>
          <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-ink-2">
            <input
              type="checkbox"
              checked={onlyLow}
              onChange={(e) => setOnlyLow(e.target.checked)}
              className="size-4 accent-[var(--accent)]"
            />
            Sadece dikkat gerektirenler
          </label>
          <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-ink-2">
            <input
              type="checkbox"
              checked={grupla}
              onChange={(e) => setGrupla(e.target.checked)}
              className="size-4 accent-[var(--accent)]"
            />
            Departmana göre grupla
          </label>
          <span className="ml-auto text-xs text-ink-3">
            {filtered.length} / {items.length} kayıt
          </span>
        </div>

        {loading ? (
          <div className="px-5 py-16 text-center text-sm text-ink-3">
            Yükleniyor…
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title={items.length === 0 ? "Envanter boş" : "Sonuç bulunamadı"}
            desc={
              items.length === 0
                ? "İlk malzemeyi ekleyerek stok takibine başlayın."
                : "Filtreleri değiştirmeyi deneyin."
            }
            action={
              items.length === 0 ? (
                <Button
                  onClick={() => {
                    setEditing(null);
                    setFormOpen(true);
                  }}
                >
                  <Plus size={16} />
                  Malzeme Ekle
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px] text-sm">
              <thead>
                <tr className="border-b border-line text-left">
                  {[
                    "Malzeme",
                    "Departman",
                    "Miktar",
                    "Birim Fiyat",
                    "Toplam",
                    "Konum",
                    "SKT / Ömür",
                    "Durum",
                    "",
                  ].map((h, i) => (
                    <th
                      key={h + i}
                      className={`px-4 py-3 text-[11.5px] font-semibold uppercase tracking-wider text-ink-3 ${
                        ["Miktar", "Birim Fiyat", "Toplam"].includes(h)
                          ? "text-right"
                          : ""
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {grupla
                  ? gruplar.map(([anahtar, liste]) => {
                      const acik = !kapali.has(anahtar);
                      const deger = liste.reduce(
                        (t, x) => t + Number(x.qty) * Number(x.price || 0),
                        0
                      );
                      return (
                        <Fragment key={anahtar}>
                          <tr className="border-b border-line bg-bg-2/70">
                            <th colSpan={9} className="px-4 py-2.5 text-left">
                              <button
                                type="button"
                                onClick={() =>
                                  setKapali((v) => {
                                    const n = new Set(v);
                                    if (n.has(anahtar)) n.delete(anahtar);
                                    else n.add(anahtar);
                                    return n;
                                  })
                                }
                                aria-expanded={acik}
                                className="flex w-full items-center gap-2 text-left"
                              >
                                <ChevronRight
                                  size={14}
                                  className={`shrink-0 text-ink-3 transition-transform ${
                                    acik ? "rotate-90" : ""
                                  }`}
                                />
                                <span className="text-[13px] font-semibold text-ink">
                                  {DEPT_LABELS[anahtar] || anahtar}
                                </span>
                                <span className="tabular text-[12px] font-normal text-ink-3">
                                  {liste.length} kalem
                                </span>
                                {deger > 0 && (
                                  <span className="tabular ml-auto text-[12px] font-normal text-ink-3">
                                    {fmtMoney(deger)}
                                  </span>
                                )}
                              </button>
                            </th>
                          </tr>
                          {acik && liste.map(satir)}
                        </Fragment>
                      );
                    })
                  : filtered.map(satir)}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Ekle / düzenle */}
      <Modal
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        title={editing ? "Malzemeyi Düzenle" : "Yeni Malzeme"}
      >
        <form onSubmit={save} className="space-y-4">
          <Field label="Malzeme adı">
            <input
              name="name"
              required
              defaultValue={editing?.name || ""}
              placeholder="örn. Karbon fiber kumaş 200g"
              className="field"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Departman">
              <select
                name="dept"
                required
                defaultValue={editing?.dept || ""}
                className="field"
              >
                <option value="">Seçiniz…</option>
                {DEPT_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {DEPT_LABELS[k]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Konum" hint="Dolap, raf veya oda">
              <input
                name="location"
                defaultValue={editing?.location || ""}
                placeholder="örn. Atölye · Raf B2"
                className="field"
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Miktar">
              <input
                name="qty"
                type="number"
                step="any"
                min="0"
                required
                defaultValue={editing?.qty ?? 0}
                className="field"
              />
            </Field>
            <Field label="Birim">
              <input
                name="unit"
                defaultValue={editing?.unit || ""}
                placeholder="adet, m, kg"
                className="field"
              />
            </Field>
            <Field label="Min. stok" hint="Altına düşünce uyarır">
              <input
                name="min_stock"
                type="number"
                step="any"
                min="0"
                defaultValue={editing?.min_stock ?? 0}
                className="field"
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Birim fiyat (₺)">
              <input
                name="price"
                type="number"
                step="any"
                min="0"
                defaultValue={editing?.price ?? 0}
                className="field"
              />
            </Field>
            <Field label="Parti / lot no" hint="Tedarikçi takibi için">
              <input
                name="batch_no"
                maxLength={80}
                defaultValue={editing?.batch_no || ""}
                className="field"
              />
            </Field>
          </div>

          <div className="rounded-xl border border-line bg-bg-2 p-4">
            <div className="eyebrow mb-3">Ömür takibi</div>

            <Field
              label="Son kullanma tarihi (SKT)"
              hint={`Kompozit reçine, yapıştırıcı vb. ${EXPIRY_WARN_DAYS} gün kala uyarı verilir`}
            >
              <input
                name="expiry_date"
                type="date"
                defaultValue={editing?.expiry_date || ""}
                className="field"
              />
            </Field>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Şarj döngüsü" hint="LiPo bataryalar için">
                <input
                  name="cycle_count"
                  type="number"
                  min="0"
                  placeholder="Mevcut"
                  defaultValue={editing?.cycle_count ?? ""}
                  className="field"
                />
              </Field>
              <Field label="Döngü limiti" hint="Bu sayıya ulaşınca emekli">
                <input
                  name="cycle_limit"
                  type="number"
                  min="0"
                  placeholder="örn. 200"
                  defaultValue={editing?.cycle_limit ?? ""}
                  className="field"
                />
              </Field>
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setFormOpen(false);
                setEditing(null);
              }}
            >
              Vazgeç
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Kaydediliyor…" : editing ? "Güncelle" : "Ekle"}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!delTarget}
        message={`"${delTarget?.name}" envanterden kalıcı olarak silinecek. Bu işlem geri alınamaz.`}
        onConfirm={doDelete}
        onCancel={() => setDelTarget(null)}
      />
    </>
  );
}

function SummaryTile({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: "warn" | "bad";
}) {
  const accent =
    tone === "bad"
      ? "text-bad"
      : tone === "warn"
        ? "text-warn"
        : "text-ink";
  return (
    <div className="rounded-2xl border border-line bg-bg-1 p-5">
      <div className="flex items-center gap-2 text-ink-3">
        {icon}
        <span className="text-[12.5px] font-semibold">{label}</span>
      </div>
      <div className={`display tabular mt-3 text-3xl ${accent}`}>{value}</div>
    </div>
  );
}

/** Tabloda SKT / şarj döngüsü hücresi */
function ExpiryCell({ item }: { item: StockItem }) {
  const days = daysUntil(item.expiry_date);
  const text = expiryText(item);
  const cl = Number(item.cycle_limit || 0);
  const cc = Number(item.cycle_count || 0);

  if (!text && !cl) return <span className="text-ink-3">—</span>;

  return (
    <div className="space-y-1">
      {text && (
        <div>
          <div
            className={`tabular text-[12.5px] font-semibold ${
              days !== null && days < 0
                ? "text-bad"
                : days !== null && days <= EXPIRY_WARN_DAYS
                  ? "text-warn"
                  : "text-ink-2"
            }`}
          >
            {text}
          </div>
          <div className="tabular text-[11px] text-ink-3">
            {item.expiry_date}
          </div>
        </div>
      )}
      {cl > 0 && (
        <div className="tabular text-[11.5px] text-ink-3">
          {cc}/{cl} döngü
        </div>
      )}
    </div>
  );
}
