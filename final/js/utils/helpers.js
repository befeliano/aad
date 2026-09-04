/* ============================================================
   helpers.js — Genel yardımcı fonksiyonlar
   ============================================================ */

export const DEBUG = false;

export const log  = (...a) => { if (DEBUG) console.log(...a); };
export const warn = (...a) => console.warn(...a);
export const err  = (...a) => console.error(...a);

/* DOM kısayolu */
export const $ = (id) => document.getElementById(id);

/* Tarih/para formatları */
export const fmtMoney = (n) =>
  new Intl.NumberFormat('tr-TR').format(Math.round(n || 0));

export const fmtDate = (d) =>
  new Date(d).toLocaleDateString('tr-TR', {
    day: '2-digit', month: 'short', year: 'numeric'
  });

export const fmtDateTime = (d) =>
  new Date(d).toLocaleString('tr-TR', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });

/* HTML escape */
export function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

/* Crypto-safe UUID with fallback */
export function safeUUID() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/* Departman label tablosu — modüller bunu import eder */
export const DEPT_LABELS = {
  yazilim: 'Yazılım', yapisal: 'Yapısal', aviyonik: 'Aviyonik',
  kompozit: 'Kompozit', sponsorluk: 'Sponsorluk',
  medya: 'Medya & Tanıtım', ortak: 'Ortak'
};

/* Eski Supabase auth lock'larını temizle (browser tab race conditionları için) */
export function clearStaleAuthLocks() {
  try {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (key.includes('lock:sb-') || key.startsWith('lock-sb-')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
  } catch (e) {
    warn('[auth-guard] cleanup failed:', e);
  }
}