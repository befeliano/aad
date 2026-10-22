"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Search, Trash2, Pencil, GripVertical, UserCheck } from "lucide-react";
import { useKaliciFiltre } from "@/lib/useKaliciFiltre";
import { createClient } from "@/lib/supabase/client";
import { DEPT_KEYS, DEPT_LABELS } from "@/lib/constants";
import { reqText, trimTo, oneOf, LIMITS } from "@/lib/security";
import { logAction } from "@/lib/audit";
import type { Task, TaskStatus, Priority, Profile } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";
import {
  Badge,
  Button,
  ConfirmDialog,
  Field,
  Modal,
} from "@/components/ui/Kit";
import { PageHeader } from "@/components/panel/PageHeader";

const STATUSES: TaskStatus[] = ["todo", "doing", "review", "done"];
const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "Yapılacak",
  doing: "Yapılıyor",
  review: "İncelemede",
  done: "Bitti",
};
const PRIORITIES = ["critical", "high", "medium", "low"] as const;
const PRIO_LABEL: Record<Priority, string> = {
  critical: "Kritik",
  high: "Yüksek",
  medium: "Orta",
  low: "Düşük",
};
const TASK_DEPTS = [...DEPT_KEYS, "ortak"] as const;

/** Bir profilin görünen adı: tam ad > kullanıcı adı > e-postanın @ öncesi */
export function displayNameOf(p: {
  full_name?: string | null;
  username?: string | null;
  email?: string | null;
}): string {
  return (
    p.full_name?.trim() ||
    p.username?.trim() ||
    p.email?.split("@")[0] ||
    ""
  );
}

export function GorevlerClient({
  userId,
  myName,
  role,
  myDept,
  isAdmin,
}: {
  userId: string;
  myName: string;
  /** admin | vice | captain | member */
  role: string;
  myDept: string;
  /** Takım kaptanı veya yardımcısı — her departmanda tam yetkili */
  isAdmin: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const { toast } = useToast();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useKaliciFiltre("gorevler.q", "");
  const [dept, setDept] = useKaliciFiltre("gorevler.dept", "");
  const [onlyMine, setOnlyMine] = useKaliciFiltre("gorevler.onlyMine", false);
  const [assigneeFilter, setAssigneeFilter] = useKaliciFiltre("gorevler.assigneeFilter", "");

  const [editing, setEditing] = useState<Task | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  /** Sütundaki + ile açılınca formun "Durum"u o sütun olarak gelir */
  const [yeniDurum, setYeniDurum] = useState<TaskStatus>("todo");
  /* Yeni görevde çoklu seçim: her kişiye (yoksa her birime) ayrı görev */
  const [yeniBirimler, setYeniBirimler] = useState<string[]>([]);
  const [yeniKisiler, setYeniKisiler] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [delTarget, setDelTarget] = useState<Task | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<TaskStatus | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .order("status")
      .order("position")
      .order("created_at");
    if (error) toast("Görevler yüklenemedi: " + error.message, "error");
    else setTasks((data as Task[]) || []);
    setLoading(false);
  }, [supabase, toast]);

  /**
   * Atama listesi için takım üyeleri.
   * profiles üzerindeki RLS üyelere tüm listeyi göstermiyorsa boş döner —
   * o durumda atama alanı serbest metne düşer (aşağıda ele alınıyor).
   */
  const loadMembers = useCallback(async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, username, email, department, role, last_seen, created_at")
      .order("full_name");
    setMembers((data as Profile[]) || []);
  }, [supabase]);

  useEffect(() => {
    /* load() asenkrondur: setState ancak ağ yanıtı geldikten sonra çalışır. */
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    loadMembers();
    const ch = supabase
      .channel("realtime:tasks")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks" },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [supabase, load, loadMembers]);

  /** Açılır listede gösterilecek üye adları (tekilleştirilmiş, sıralı) */
  const memberNames = useMemo(() => {
    const names = members.map(displayNameOf).filter(Boolean);
    return [...new Set(names)].sort((a, b) => a.localeCompare(b, "tr"));
  }, [members]);

  /** Yeni görevde seçilebilecek üyeler: seçili birimlerdekiler ("ortak" → herkes) */
  const secilebilirKisiler = useMemo(() => {
    const birimler = isAdmin ? yeniBirimler : myDept ? [myDept] : [];
    const herkes = birimler.includes("ortak") || birimler.length === 0;
    return members
      .filter((m) => displayNameOf(m) && (herkes || birimler.includes(m.department || "")))
      .sort((a, b) => displayNameOf(a).localeCompare(displayNameOf(b), "tr"));
  }, [members, yeniBirimler, isAdmin, myDept]);

  /** profiles listelenemiyorsa (RLS) serbest metne düşeriz */
  const hasMemberList = memberNames.length > 0;

  /** Görünen ad → kullanıcı kimliği. assignee_id'yi doldurmak için. */
  const nameToId = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of members) {
      const ad = displayNameOf(p);
      if (ad && !m.has(ad)) m.set(ad, p.id);
    }
    return m;
  }, [members]);

  /**
   * Bir departmanın görevlerini yönetebilir miyim?
   *
   * Kaptan ve yardımcısı her yerde; birim kaptanı yalnızca kendi
   * biriminde. Üye hiçbir yerde — o sadece kendine atanan görevin
   * durumunu taşıyabilir. Aynı kural veritabanında RLS + tetikleyici
   * ile de uygulanıyor (supabase/gorev-yetkileri.sql); buradaki kontrol
   * yalnızca arayüzü sadeleştirmek için.
   */
  const yonetebilir = useCallback(
    (d?: string | null) =>
      isAdmin || (role === "captain" && !!myDept && d === myDept),
    [isAdmin, role, myDept]
  );

  /** Hiç görev açamayacaksa "Görev Oluştur" düğmesi hiç görünmesin */
  const gorevAcabilir = isAdmin || (role === "captain" && !!myDept);

  /** Kendi görünen adım — "bana atananlar" bununla tam eşleşir */
  const myDisplayName = useMemo(() => {
    const mine = members.find((m) => m.id === userId);
    return (mine ? displayNameOf(mine) : myName).trim();
  }, [members, userId, myName]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase("tr");
    const me = myDisplayName.toLocaleLowerCase("tr");
    return tasks.filter((t) => {
      const assignee = (t.assignee || "").trim();
      if (dept && t.dept !== dept) return false;
      if (assigneeFilter && assignee !== assigneeFilter) return false;
      // Tam eşleşme: aynı isimli iki kişi karışmasın diye alt dize kullanmıyoruz
      if (onlyMine && me && assignee.toLocaleLowerCase("tr") !== me) return false;
      if (
        needle &&
        !`${t.title} ${assignee} ${t.description || ""}`
          .toLocaleLowerCase("tr")
          .includes(needle)
      )
        return false;
      return true;
    });
  }, [tasks, q, dept, onlyMine, assigneeFilter, myDisplayName]);

  /** Bana atanan açık görev sayısı — rozet için */
  const myOpenCount = useMemo(() => {
    const me = myDisplayName.toLocaleLowerCase("tr");
    if (!me) return 0;
    return tasks.filter(
      (t) =>
        t.status !== "done" &&
        (t.assignee || "").trim().toLocaleLowerCase("tr") === me
    ).length;
  }, [tasks, myDisplayName]);

  const byStatus = useCallback(
    (s: TaskStatus) =>
      filtered
        .filter((t) => t.status === s)
        .sort((a, b) => (a.position || 0) - (b.position || 0)),
    [filtered]
  );

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const title = reqText(fd.get("title"), LIMITS.title);
    if (!title) {
      toast("Görev başlığı zorunlu.", "error");
      return;
    }
    const status = oneOf(fd.get("status"), STATUSES, "todo");
    const maxPos = tasks
      .filter((t) => t.status === status)
      .reduce((m, t) => Math.max(m, t.position || 0), 0);

    /* Yeni görev: birden çok birim / kişi seçilebilir. Her kişiye ayrı
       görev açılır (birimi, seçilen birimler içindeyse kişinin birimi);
       kimse seçilmediyse her birime atanmamış bir görev açılır. */
    if (!editing) {
      const birimler = isAdmin ? yeniBirimler : myDept ? [myDept] : [];
      if (birimler.length === 0) {
        toast("En az bir birim seçin.", "error");
        return;
      }
      const ortak = {
        title,
        description: trimTo(fd.get("description"), LIMITS.longText),
        deadline: trimTo(fd.get("deadline"), 20),
        priority: oneOf(fd.get("priority"), PRIORITIES, "medium"),
        status,
        created_by: userId,
      };
      const satirlar = (
        yeniKisiler.length
          ? yeniKisiler.map((id) => {
              const p = members.find((m) => m.id === id);
              const pd = p?.department || "";
              return {
                ...ortak,
                dept: birimler.includes(pd) ? pd : birimler[0],
                assignee: p ? displayNameOf(p) : null,
                assignee_id: id as string | null,
              };
            })
          : birimler.map((b) => ({
              ...ortak,
              dept: b,
              assignee: null as string | null,
              assignee_id: null as string | null,
            }))
      ).map((r, i) => ({ ...r, position: maxPos + 1 + i }));

      setSaving(true);
      const { data, error } = await supabase.from("tasks").insert(satirlar).select("id");
      setSaving(false);
      if (error) {
        toast("Kaydedilemedi: " + error.message, "error");
        return;
      }
      satirlar.forEach((r, i) => {
        logAction(supabase, "create", "tasks", data?.[i]?.id ?? null, {
          title: r.title,
          dept: r.dept,
          assignee: r.assignee,
        });
      });
      toast(
        satirlar.length === 1
          ? "Görev oluşturuldu."
          : `${satirlar.length} görev oluşturuldu.`
      );
      setFormOpen(false);
      load();
      return;
    }

    const payload = {
      title,
      description: trimTo(fd.get("description"), LIMITS.longText),
      dept: oneOf(fd.get("dept"), TASK_DEPTS, "ortak"),
      assignee: trimTo(fd.get("assignee"), LIMITS.name),
      /* Kimliği de yazıyoruz: RLS "bu görev bana mı atanmış" sorusunu
         ada göre değil kimliğe göre cevaplıyor. */
      assignee_id:
        nameToId.get(trimTo(fd.get("assignee"), LIMITS.name) || "") ?? null,
      deadline: trimTo(fd.get("deadline"), 20),
      priority: oneOf(fd.get("priority"), PRIORITIES, "medium"),
      status,
    };

    setSaving(true);
    const { data, error } = editing
      ? await supabase.from("tasks").update(payload).eq("id", editing.id).select()
      : await supabase
          .from("tasks")
          .insert([{ ...payload, position: maxPos + 1, created_by: userId }])
          .select();
    setSaving(false);

    if (error) {
      toast("Kaydedilemedi: " + error.message, "error");
      return;
    }
    logAction(
      supabase,
      editing ? "update" : "create",
      "tasks",
      data?.[0]?.id ?? editing?.id ?? null,
      { title: payload.title, dept: payload.dept, assignee: payload.assignee }
    );
    toast(editing ? "Görev güncellendi." : "Görev oluşturuldu.");
    setFormOpen(false);
    setEditing(null);
    load();
  }

  /** Yeni görev formunu aç — sütundaki + ile gelindiyse durum o sütun */
  function yeniAc(durum: TaskStatus) {
    setEditing(null);
    setYeniDurum(durum);
    setYeniBirimler(isAdmin ? (dept ? [dept] : ["ortak"]) : myDept ? [myDept] : []);
    setYeniKisiler([]);
    setFormOpen(true);
  }

  async function moveTo(taskId: string, status: TaskStatus) {
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === status) return;

    const maxPos = tasks
      .filter((t) => t.status === status)
      .reduce((m, t) => Math.max(m, t.position || 0), 0);

    // İyimser güncelleme
    setTasks((v) =>
      v.map((t) =>
        t.id === taskId ? { ...t, status, position: maxPos + 1 } : t
      )
    );

    const { error } = await supabase
      .from("tasks")
      .update({ status, position: maxPos + 1 })
      .eq("id", taskId);
    if (error) {
      toast("Taşınamadı: " + error.message, "error");
      load();
    } else {
      logAction(supabase, "update", "tasks", taskId, { status });
    }
  }

  async function doDelete() {
    if (!delTarget) return;
    const { error } = await supabase.from("tasks").delete().eq("id", delTarget.id);
    if (error) toast("Silinemedi: " + error.message, "error");
    else {
      logAction(supabase, "delete", "tasks", delTarget.id, {
        title: delTarget.title,
      });
      toast("Görev silindi.");
    }
    setDelTarget(null);
    load();
  }

  return (
    <>
      <PageHeader
        title="Görevler"
        desc="Departman görev panosu. Kartları sürükleyerek durum değiştirin."
      >
        {gorevAcabilir && (
        <Button onClick={() => yeniAc("todo")}>
          <Plus size={16} />
          Görev Oluştur
        </Button>
        )}
      </PageHeader>

      {/* Filtreler */}
      <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-bg-1 px-5 py-4">
        <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3"
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Görev, kişi veya açıklama ara…"
            className="field !pl-9"
          />
        </div>
        <select value={dept} onChange={(e) => setDept(e.target.value)} className="field !w-auto">
          <option value="">Tüm departmanlar</option>
          {TASK_DEPTS.map((k) => (
            <option key={k} value={k}>{DEPT_LABELS[k] || k}</option>
          ))}
        </select>
        {hasMemberList && (
          <select
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
            className="field !w-auto"
            aria-label="Kişiye göre filtrele"
          >
            <option value="">Herkes</option>
            {memberNames.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        )}
        <label
          className={`flex cursor-pointer select-none items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors ${
            onlyMine
              ? "border-accent bg-accent-soft text-accent"
              : "border-line text-ink-2 hover:border-line-2"
          }`}
        >
          <input
            type="checkbox"
            checked={onlyMine}
            onChange={(e) => setOnlyMine(e.target.checked)}
            className="size-4 accent-[var(--accent)]"
          />
          <UserCheck size={14} />
          Bana atananlar
          {myOpenCount > 0 && (
            <span className="tabular rounded-full bg-accent px-1.5 py-0.5 text-[10.5px] font-bold text-white">
              {myOpenCount}
            </span>
          )}
        </label>
        <span className="ml-auto text-xs text-ink-3">{filtered.length} görev</span>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-line bg-bg-1 px-5 py-16 text-center text-sm text-ink-3">
          Yükleniyor…
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-4">
          {STATUSES.map((s) => {
            const items = byStatus(s);
            return (
              <section
                key={s}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverCol(s);
                }}
                onDragLeave={() => setDragOverCol((c) => (c === s ? null : c))}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOverCol(null);
                  const id = dragId || e.dataTransfer.getData("text/plain");
                  if (id) moveTo(id, s);
                  setDragId(null);
                }}
                className={`flex min-h-[220px] flex-col rounded-2xl border bg-bg-1 transition-colors ${
                  dragOverCol === s ? "border-accent bg-accent-soft" : "border-line"
                }`}
              >
                <header className="flex items-center justify-between border-b border-line px-4 py-3">
                  <h2 className="text-[13.5px] font-bold text-ink">
                    {STATUS_LABEL[s]}
                  </h2>
                  <span className="flex items-center gap-1.5">
                    <span className="tabular rounded-full bg-bg-3 px-2 py-0.5 text-[11.5px] font-semibold text-ink-2">
                      {items.length}
                    </span>
                    {gorevAcabilir && (s === "todo" || s === "doing") && (
                      <button
                        type="button"
                        onClick={() => {
                          yeniAc(s);
                        }}
                        aria-label={`${STATUS_LABEL[s]} sütununa görev ekle`}
                        title={`${STATUS_LABEL[s]} olarak görev ekle`}
                        className="flex size-6 items-center justify-center rounded-full text-ink-3 transition-colors hover:bg-accent hover:text-white"
                      >
                        <Plus size={14} />
                      </button>
                    )}
                  </span>
                </header>

                <ul className="flex-1 space-y-2.5 p-3">
                  {items.length === 0 ? (
                    <li className="py-8 text-center text-[12.5px] text-ink-3">
                      Görev yok
                    </li>
                  ) : (
                    items.map((t) => (
                      <li
                        key={t.id}
                        /* Üye yalnızca KENDİNE atanan görevi taşıyabilir;
                           kaptan/yardımcı ve birim kaptanı kendi biriminde
                           serbest. Aynı kural DB tarafında da uygulanıyor. */
                        draggable={
                          yonetebilir(t.dept) || t.assignee_id === userId
                        }
                        onDragStart={(e) => {
                          setDragId(t.id);
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData("text/plain", t.id);
                        }}
                        onDragEnd={() => { setDragId(null); setDragOverCol(null); }}
                        className={`group rounded-xl border border-line bg-bg p-3.5 transition-shadow ${
                          yonetebilir(t.dept) || t.assignee_id === userId
                            ? "cursor-grab active:cursor-grabbing"
                            : "cursor-default"
                        } ${
                          dragId === t.id ? "opacity-45" : "hover:shadow-[var(--shadow-sm)]"
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <GripVertical size={14} className="mt-0.5 shrink-0 text-ink-3" />
                          <span className="flex-1 text-[13.5px] font-semibold leading-snug text-ink">
                            {t.title}
                          </span>
                          {yonetebilir(t.dept) && (
                          <span className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                            <button
                              type="button"
                              onClick={() => { setEditing(t); setFormOpen(true); }}
                              aria-label="Düzenle"
                              className="flex size-6 items-center justify-center rounded text-ink-3 hover:bg-bg-2 hover:text-ink"
                            >
                              <Pencil size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDelTarget(t)}
                              aria-label="Sil"
                              className="flex size-6 items-center justify-center rounded text-ink-3 hover:bg-bad/12 hover:text-bad"
                            >
                              <Trash2 size={12} />
                            </button>
                          </span>
                          )}
                        </div>

                        {t.description && (
                          <p className="mt-2 line-clamp-2 pl-6 text-[12.5px] leading-snug text-ink-3">
                            {t.description}
                          </p>
                        )}

                        <div className="mt-3 flex flex-wrap items-center gap-1.5 pl-6">
                          <Badge tone="neutral">{DEPT_LABELS[t.dept] || t.dept}</Badge>
                          {(t.priority === "critical" || t.priority === "high") && (
                            <Badge tone={t.priority === "critical" ? "bad" : "warn"}>
                              {PRIO_LABEL[t.priority]}
                            </Badge>
                          )}
                          <Deadline value={t.deadline} />
                        </div>

                        <div className="mt-2.5 flex items-center gap-1.5 pl-6">
                          {t.assignee ? (
                            <>
                              <span
                                className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                                  t.assignee.trim().toLocaleLowerCase("tr") ===
                                  myDisplayName.toLocaleLowerCase("tr")
                                    ? "bg-accent text-white"
                                    : "bg-bg-3 text-ink-2"
                                }`}
                              >
                                {t.assignee.trim().charAt(0).toLocaleUpperCase("tr")}
                              </span>
                              <span className="truncate text-[12px] text-ink-2">
                                {t.assignee}
                              </span>
                            </>
                          ) : (
                            <span className="text-[12px] text-ink-3">Atanmamış</span>
                          )}
                        </div>
                      </li>
                    ))
                  )}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      <Modal
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditing(null); }}
        title={editing ? "Görevi Düzenle" : "Yeni Görev"}
      >
        <form onSubmit={save} className="space-y-4">
          <Field label="Görev başlığı">
            <input
              name="title"
              required
              maxLength={LIMITS.title}
              defaultValue={editing?.title || ""}
              placeholder="örn. Sol kanat servo motorlarını lehimle"
              className="field"
            />
          </Field>

          <Field label="Açıklama">
            <textarea
              name="description"
              rows={3}
              maxLength={LIMITS.longText}
              defaultValue={editing?.description || ""}
              className="field resize-y"
            />
          </Field>

          {!editing && (
            <div className="space-y-3 rounded-xl border border-line bg-bg-1 p-3.5">
              <div>
                <div className="mb-1.5 text-[12.5px] font-semibold text-ink-2">Birimler</div>
                {isAdmin ? (
                  <div className="flex flex-wrap gap-1.5">
                    {TASK_DEPTS.map((k) => {
                      const secili = yeniBirimler.includes(k);
                      return (
                        <button
                          key={k}
                          type="button"
                          aria-pressed={secili}
                          onClick={() =>
                            setYeniBirimler((v) =>
                              v.includes(k) ? v.filter((x) => x !== k) : [...v, k]
                            )
                          }
                          className={`rounded-full border px-3 py-1 text-[12.5px] font-semibold transition-colors ${
                            secili
                              ? "border-accent bg-accent text-white"
                              : "border-line-2 text-ink-3 hover:border-ink-3 hover:text-ink"
                          }`}
                        >
                          {DEPT_LABELS[k] || k}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-[12.5px] text-ink-3">
                    {DEPT_LABELS[myDept] || myDept} — birim kaptanı yalnızca kendi birimine görev açar
                  </p>
                )}
              </div>
              {hasMemberList && (
                <div>
                  <div className="mb-1.5 flex items-center justify-between text-[12.5px] font-semibold text-ink-2">
                    <span>Atanacak kişiler</span>
                    <span className="font-normal text-ink-3">{yeniKisiler.length} seçili</span>
                  </div>
                  <ul className="max-h-48 overflow-y-auto rounded-lg border border-line bg-bg p-1">
                    {secilebilirKisiler.map((m) => (
                      <li key={m.id}>
                        <label className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] text-ink hover:bg-bg-2">
                          <input
                            type="checkbox"
                            checked={yeniKisiler.includes(m.id)}
                            onChange={() =>
                              setYeniKisiler((v) =>
                                v.includes(m.id) ? v.filter((x) => x !== m.id) : [...v, m.id]
                              )
                            }
                            className="size-4 accent-[var(--accent)]"
                          />
                          <span className="flex-1">
                            {displayNameOf(m)}
                            {m.id === userId ? " (ben)" : ""}
                          </span>
                          {m.department && (
                            <span className="text-[11.5px] text-ink-3">
                              {DEPT_LABELS[m.department] || m.department}
                            </span>
                          )}
                        </label>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1.5 text-[11.5px] text-ink-3">
                    Her kişiye ayrı bir görev açılır. Kimse seçilmezse her birime atanmamış bir görev açılır.
                  </p>
                </div>
              )}
            </div>
          )}

          {editing && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Departman">
              <select name="dept" defaultValue={editing?.dept || "ortak"} className="field">
                {TASK_DEPTS.map((k) => (
                  <option key={k} value={k}>{DEPT_LABELS[k] || k}</option>
                ))}
              </select>
            </Field>
            <Field
              label="Atanan kişi"
              hint={
                hasMemberList
                  ? "Takım üyeleri listesinden seçin"
                  : "Üye listesi okunamadı — ismi elle yazın"
              }
            >
              {hasMemberList ? (
                <select
                  name="assignee"
                  defaultValue={editing?.assignee || ""}
                  className="field"
                >
                  <option value="">— Atanmamış —</option>
                  {myDisplayName && (
                    <option value={myDisplayName}>{myDisplayName} (ben)</option>
                  )}
                  {memberNames
                    .filter((n) => n !== myDisplayName)
                    .map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  {/* Listede olmayan eski bir atama varsa kaybolmasın */}
                  {editing?.assignee &&
                    !memberNames.includes(editing.assignee) && (
                      <option value={editing.assignee}>
                        {editing.assignee} (listede yok)
                      </option>
                    )}
                </select>
              ) : (
                <input
                  name="assignee"
                  maxLength={LIMITS.name}
                  defaultValue={editing?.assignee || ""}
                  placeholder="Ad Soyad"
                  className="field"
                />
              )}
            </Field>
          </div>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Öncelik">
              <select name="priority" defaultValue={editing?.priority || "medium"} className="field">
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>{PRIO_LABEL[p]}</option>
                ))}
              </select>
            </Field>
            <Field label="Durum">
              <select name="status" defaultValue={editing?.status || yeniDurum} className="field">
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                ))}
              </select>
            </Field>
            <Field label="Son tarih">
              <input
                name="deadline"
                type="date"
                defaultValue={editing?.deadline || ""}
                className="field"
              />
            </Field>
          </div>

          <div className="flex justify-end gap-2.5 pt-1">
            <Button type="button" variant="outline" onClick={() => { setFormOpen(false); setEditing(null); }}>
              Vazgeç
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Kaydediliyor…" : editing ? "Güncelle" : "Oluştur"}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!delTarget}
        message={`"${delTarget?.title}" görevi silinecek. Bu işlem geri alınamaz.`}
        onConfirm={doDelete}
        onCancel={() => setDelTarget(null)}
      />
    </>
  );
}

function Deadline({ value }: { value: string | null }) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(+d)) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((+d - +today) / 86400000);
  const label = d.toLocaleDateString("tr-TR", { day: "2-digit", month: "short" });

  if (days < 0)
    return <Badge tone="bad">{Math.abs(days)}g gecikti</Badge>;
  if (days === 0) return <Badge tone="warn">Bugün</Badge>;
  if (days <= 3) return <Badge tone="warn">{days}g kaldı</Badge>;
  return <Badge tone="neutral">{label}</Badge>;
}
