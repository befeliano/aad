/* ============================================================
   components.js — UI bileşenleri (Modal, Theme, Toast, vb.)
   ============================================================ */

import { $ } from '../utils/helpers.js';

/* ============================================================
   THEME
   ============================================================ */
export const Theme = {
  get() {
    return document.documentElement.getAttribute('data-theme') || 'light';
  },
  set(t) {
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem('aad_theme', t); } catch(e){}
  },
  toggle() {
    this.set(this.get() === 'light' ? 'dark' : 'light');
  }
};

/* ============================================================
   MODAL
   ============================================================ */
export const Modal = {
  open(id) {
    const m = $(id);
    if (!m) return;
    m.classList.add('is-open');
    m.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
  },
  close(id) {
    const m = $(id);
    if (!m) return;
    m.classList.remove('is-open');
    m.setAttribute('aria-hidden', 'true');
    if (!document.querySelector('.modal.is-open')) {
      document.body.classList.remove('modal-open');
    }
  },
  closeAll() {
    document.querySelectorAll('.modal.is-open').forEach(m => {
      m.classList.remove('is-open');
      m.setAttribute('aria-hidden', 'true');
    });
    document.body.classList.remove('modal-open');
  }
};

/* ============================================================
   TOAST
   ============================================================ */
export function showToast(msg, type = 'success') {
  const t = document.createElement('div');
  t.textContent = msg;
  const color = type === 'error' ? 'var(--bad)' : 'var(--accent)';
  t.style.cssText = `
    position:fixed; bottom:80px; left:50%; transform:translateX(-50%);
    background:${color}; color:#fff;
    padding:12px 22px; border-radius:8px;
    font-family:var(--font-mono); font-size:12px;
    letter-spacing:1px; z-index:2000;
    box-shadow:0 8px 28px rgba(0,0,0,0.3);
    animation: fadeUp 320ms ease;
  `;
  document.body.appendChild(t);
  setTimeout(() => {
    t.style.opacity = '0';
    t.style.transition = 'opacity 240ms';
  }, 2400);
  setTimeout(() => t.remove(), 2800);
}

/* ============================================================
   CUSTOM CONFIRM (Promise-based modal)
   ============================================================ */
export function customConfirm(message, title = 'Onay') {
  return new Promise(resolve => {
    $('confirmTitle').textContent = title;
    $('confirmMessage').textContent = message;
    const okBtn = $('confirmOk');
    const cancelBtn = $('confirmCancel');

    const cleanup = () => {
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
      Modal.close('confirmModal');
    };
    const onOk     = () => { cleanup(); resolve(true);  };
    const onCancel = () => { cleanup(); resolve(false); };

    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
    Modal.open('confirmModal');
    setTimeout(() => okBtn.focus(), 80);
  });
}

/* ============================================================
   CONNECTION STATUS
   ============================================================ */
export function setConnStatus(state, text) {
  const el = $('connStatus');
  if (!el) return;
  el.hidden = false;
  el.classList.remove('is-ok', 'is-error');
  if (state === 'ok')    el.classList.add('is-ok');
  if (state === 'error') el.classList.add('is-error');
  el.querySelector('.conn-status__text').textContent = text;
  if (state === 'ok') {
    setTimeout(() => { el.hidden = true; }, 2000);
  }
}

/* ============================================================
   GLOBAL UI EVENT LISTENERS
   - Modal close (data-modal-close + Escape)
   - Theme toggle button
   ============================================================ */
export function initUIListeners() {
  document.addEventListener('click', (e) => {
    if (e.target.dataset.modalClose !== undefined) Modal.closeAll();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') Modal.closeAll();
  });
  $('themeToggle')?.addEventListener('click', () => Theme.toggle());
}

/* ============================================================
   NAVIGATION (switchTab + dropdown + mobile menu)
   - canAccessTab → auth.js'den geliyor (callback olarak alıyoruz)
   ============================================================ */
let _switchTabHooks = [];

/**
 * Bir tab'a geçildiğinde çalışacak callback ekle.
 * Örn: admin paneli açılınca user listesini yükle.
 */
export function onTabSwitch(fn) {
  _switchTabHooks.push(fn);
}

export function switchTab(target, { canAccessTab } = {}) {
  // Erişim kontrolü
  if (canAccessTab && target !== 'home' && target !== 'access-denied' && target !== 'contact') {
    if (!canAccessTab(target)) {
      target = 'access-denied';
    }
  }

  document.querySelectorAll('.nav__link').forEach(l =>
    l.classList.toggle('is-active', l.dataset.tab === target)
  );
  document.querySelectorAll('.tab').forEach(t =>
    t.classList.toggle('is-active', t.dataset.tab === target)
  );

  document.querySelectorAll('.nav__dropdown').forEach(dd => {
    const trigger = dd.querySelector('.nav__dropdown-trigger');
    if (!trigger) return;
    const hasActive = dd.querySelector('.nav__link.is-active') !== null;
    trigger.classList.toggle('has-active', hasActive);
    dd.classList.remove('is-open');
  });

  $('primaryNav')?.classList.remove('is-open');
  $('menuToggle')?.setAttribute('aria-expanded', 'false');
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Hooks
  _switchTabHooks.forEach(fn => {
    try { fn(target); } catch (e) { console.warn(e); }
  });
}

/**
 * Navigation event listenerlarını bağla.
 * @param {object} ctx { isLoggedIn, canAccessTab, openLogin }
 */
export function initNavigation(ctx) {
  $('primaryNav')?.addEventListener('click', (e) => {
    const link = e.target.closest('.nav__link');
    if (!link) return;
    const target = link.dataset.tab;
    const isPrivate = link.dataset.private !== undefined;
    if (isPrivate && !ctx.isLoggedIn()) {
      ctx.openLogin();
      return;
    }
    switchTab(target, { canAccessTab: ctx.canAccessTab });
  });

  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('.nav__dropdown-trigger');
    if (trigger) {
      e.stopPropagation();
      const dropdown = trigger.parentElement;
      if (trigger.dataset.private !== undefined && !ctx.isLoggedIn()) {
        ctx.openLogin();
        return;
      }
      document.querySelectorAll('.nav__dropdown').forEach(d => {
        if (d !== dropdown) d.classList.remove('is-open');
      });
      dropdown.classList.toggle('is-open');
      return;
    }
    if (!e.target.closest('.nav__dropdown')) {
      document.querySelectorAll('.nav__dropdown').forEach(d =>
        d.classList.remove('is-open')
      );
    }
  });

  $('menuToggle')?.addEventListener('click', () => {
    const nav = $('primaryNav');
    const open = nav.classList.toggle('is-open');
    $('menuToggle').setAttribute('aria-expanded', open ? 'true' : 'false');
  });

  $('goHomeFromDenied')?.addEventListener('click', () =>
    switchTab('home', { canAccessTab: ctx.canAccessTab })
  );
}