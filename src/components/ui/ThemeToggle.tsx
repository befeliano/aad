"use client";

import { useCallback, useSyncExternalStore } from "react";
import { Sun, Moon } from "lucide-react";

type Theme = "light" | "dark";

const EVENT = "aad-theme-change";

/** Dış durum (DOM + localStorage) aboneliği */
function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
    mq.removeEventListener("change", cb);
  };
}

/** Yürürlükteki tema: elle seçim varsa o, yoksa sistem tercihi */
function getSnapshot(): Theme {
  const attr = document.documentElement.getAttribute("data-theme");
  if (attr === "light" || attr === "dark") return attr;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

/** Sunucuda tema bilinemez — ikon hidrasyona kadar gizlenir */
function getServerSnapshot(): Theme | null {
  return null;
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const theme = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot as () => Theme
  );

  const toggle = useCallback(() => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("aad-theme", next);
    } catch {}
    window.dispatchEvent(new Event(EVENT));
  }, [theme]);

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "dark" ? "Aydınlık moda geç" : "Karanlık moda geç"}
      title={theme === "dark" ? "Aydınlık mod" : "Karanlık mod"}
      className={`flex size-9 items-center justify-center rounded-full border border-line text-ink-2 transition-colors hover:border-line-2 hover:text-ink ${className}`}
    >
      {theme === "dark" ? (
        <Sun size={17} />
      ) : theme === "light" ? (
        <Moon size={17} />
      ) : (
        <span className="size-[17px]" />
      )}
    </button>
  );
}
