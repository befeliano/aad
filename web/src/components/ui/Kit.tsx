"use client";

import { useEffect, type ReactNode } from "react";
import { X, Inbox } from "lucide-react";

/* ============================================================
   Badge
   ============================================================ */
type Tone = "ok" | "warn" | "bad" | "info" | "neutral" | "accent";

const TONE: Record<Tone, string> = {
  ok: "bg-ok/12 text-ok",
  warn: "bg-warn/14 text-warn",
  bad: "bg-bad/12 text-bad",
  info: "bg-info/12 text-info",
  accent: "bg-accent/12 text-accent",
  neutral: "bg-bg-3 text-ink-2",
};

export function Badge({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${TONE[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

/* ============================================================
   Button
   ============================================================ */
export function Button({
  children,
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: {
  children: ReactNode;
  variant?: "primary" | "ghost" | "outline" | "danger";
  size?: "sm" | "md";
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const variants = {
    primary: "bg-accent text-white hover:brightness-110",
    outline: "border border-line-2 text-ink hover:border-ink-3",
    ghost: "text-ink-2 hover:bg-bg-2 hover:text-ink",
    danger: "bg-bad/12 text-bad hover:bg-bad/20",
  };
  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2.5 text-sm",
  };
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-55 ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

/* ============================================================
   Panel (kart)
   ============================================================ */
export function Card({
  children,
  className = "",
  title,
  desc,
  actions,
}: {
  children?: ReactNode;
  className?: string;
  title?: string;
  desc?: string;
  actions?: ReactNode;
}) {
  return (
    <section
      className={`rounded-2xl border border-line bg-bg-1 ${className}`}
    >
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            {title && (
              <h2 className="text-[15px] font-bold text-ink">{title}</h2>
            )}
            {desc && <p className="mt-0.5 text-xs text-ink-3">{desc}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

/* ============================================================
   Modal
   ============================================================ */
export function Modal({
  open,
  onClose,
  title,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/55 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative max-h-[88vh] w-full overflow-y-auto rounded-2xl border border-line bg-bg-1 shadow-[var(--shadow-lg)] ${
          wide ? "max-w-3xl" : "max-w-lg"
        }`}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-line bg-bg-1 px-6 py-4">
          <h2 className="text-base font-bold text-ink">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-ink-3 transition-colors hover:bg-bg-2 hover:text-ink"
            aria-label="Kapat"
          >
            <X size={17} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

/* ============================================================
   Onay diyaloğu
   ============================================================ */
export function ConfirmDialog({
  open,
  title = "Emin misiniz?",
  message,
  confirmLabel = "Evet, sil",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal open={open} onClose={onCancel} title={title}>
      <p className="text-sm leading-relaxed text-ink-2">{message}</p>
      <div className="mt-7 flex justify-end gap-2.5">
        <Button variant="outline" onClick={onCancel}>
          Vazgeç
        </Button>
        <Button variant="danger" onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}

/* ============================================================
   Boş durum
   ============================================================ */
export function EmptyState({
  title,
  desc,
  icon,
  action,
}: {
  title: string;
  desc?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="text-ink-3">{icon || <Inbox size={30} />}</div>
      <p className="mt-4 text-sm font-semibold text-ink">{title}</p>
      {desc && <p className="mt-1.5 max-w-sm text-sm text-ink-3">{desc}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* ============================================================
   Form alanı sarmalayıcı
   ============================================================ */
export function Field({
  label,
  children,
  hint,
  className = "",
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[11.5px] text-ink-3">{hint}</span>}
    </label>
  );
}
