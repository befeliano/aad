/* ============================================================
   auth.js — Auth state, profil, RBAC
   ============================================================ */

import { sb } from '../supabase.js';
import { $, escapeHtml, warn } from '../utils/helpers.js';
import { Modal, showToast, customConfirm, switchTab } from '../ui/components.js';
import { logAction } from './audit.js';

/* ============================================================
   STATE
   ============================================================ */
let currentUser = null;
let currentProfile = null;

export const getCurrentUser    = () => currentUser;
export const getCurrentProfile = () => currentProfile;
export const isLoggedIn        = () => !!currentUser;
export const isAdmin           = () => currentProfile?.role === 'admin';
export const myDept            = () => currentProfile?.department || '';

/* ============================================================
   RBAC HELPERS
   ============================================================ */

/**
 * Bir element'in (nav link, tab) erişimini kontrol et.
 * data-public, data-allowed-depts, data-role attribute'larına bakar.
 */
export function canAccessElement(el) {
  if (el.dataset.public !== undefined) return true;
  if (!currentUser) return false;
  if (isAdmin()) return true;
  if (el.dataset.role === 'admin') return false;

  const allowedRaw = el.dataset.allowedDepts;
  if (allowedRaw) {
    const allowed = allowedRaw.split(',').map(s => s.trim());
    return allowed.includes(myDept());
  }
  return true;
}

export function canAccessTab(tabName) {
  const link = document.querySelector(`.nav__link[data-tab="${tabName}"]`);
  if (!link) return true; // bilinmeyen tab — bloke etme
  return canAccessElement(link);
}

/**
 * Nav linklerini ve dropdown'ları RBAC'a göre filtrele.
 */
export function applyRBACToNav() {
  document.querySelectorAll('.nav__link').forEach(link => {
    const accessible = canAccessElement(link);
    link.style.display = accessible ? '' : 'none';
  });

  document.querySelectorAll('.nav__dropdown').forEach(dd => {
    const allLinks = dd.querySelectorAll('.nav__link');
    let visibleCount = 0;
    allLinks.forEach(l => {
      if (l.style.display !== 'none') visibleCount++;
    });
    dd.style.display = (visibleCount === 0 && !canAccessElement(dd)) ? 'none' : '';
  });

  // [data-write-only="dept1,dept2"] paneller (örn parts upload)
  document.querySelectorAll('[data-write-only]').forEach(panel => {
    const allowed = panel.dataset.writeOnly.split(',').map(s => s.trim());
    const canWrite = isAdmin() || allowed.includes(myDept());
    panel.style.display = canWrite ? '' : 'none';
  });

  // Aktif tab erişilebilir değilse → ana sayfaya
  const activeTab = document.querySelector('.tab.is-active');
  if (activeTab && !canAccessTab(activeTab.dataset.tab)) {
    switchTab('home', { canAccessTab });
  }
}

/* ============================================================
   PROFILE LOAD + AUTH UI RENDER
   ============================================================ */
async function loadProfile(userId) {
  const { data, error: e } = await sb
    .from('profiles').select('*').eq('id', userId).maybeSingle();
  if (e) { warn('profile load error', e); return null; }
  return data;
}

function renderAuthUI() {
  const buttons = $('authButtons');
  if (!buttons) return;

  if (currentUser) {
    document.body.classList.add('is-authenticated');
    const displayName = currentProfile?.full_name
      || currentProfile?.username
      || currentUser.email?.split('@')[0]
      || 'Üye';
    const dept = currentProfile?.department
      ? ` · ${currentProfile.department.toUpperCase()}`
      : ' · (DEPT YOK)';
    const role = isAdmin() ? ' 👑' : '';
    buttons.innerHTML = `
      <span class="user-chip"><span class="user-chip__dot"></span>${escapeHtml(displayName)}${escapeHtml(dept)}${role}</span>
      <button class="btn btn--small" id="logoutBtn" type="button">Çıkış</button>
    `;
  } else {
    document.body.classList.remove('is-authenticated');
    buttons.innerHTML = `
      <button class="btn btn--primary btn--small" id="loginBtn" type="button">Takım Girişi</button>
    `;
  }
}

/* ============================================================
   LOGIN / LOGOUT EVENT BINDINGS
   ============================================================ */
export function initAuthUI() {
  $('authButtons')?.addEventListener('click', async (e) => {
    if (e.target.closest('#loginBtn')) {
      Modal.open('loginModal');
    } else if (e.target.closest('#logoutBtn')) {
      const ok = await customConfirm('Oturumu kapatmak istediğine emin misin?');
      if (!ok) return;
      await sb.auth.signOut();
      switchTab('home', { canAccessTab });
    }
  });

  $('loginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const email = fd.get('email');
    const password = fd.get('password');
    const errEl = $('loginError');
    const btn = $('loginSubmit');
    const spinner = btn.querySelector('.btn__spinner');
    const label = btn.querySelector('.btn__label');

    errEl.hidden = true;
    btn.disabled = true; spinner.hidden = false;
    label.textContent = 'Giriş yapılıyor';

    try {
      const { error: e2 } = await sb.auth.signInWithPassword({ email, password });
      if (e2) {
        errEl.textContent = e2.message === 'Invalid login credentials'
          ? 'E-posta veya parola hatalı.'
          : 'Giriş başarısız: ' + e2.message;
        errEl.hidden = false;
        return;
      }
      e.target.reset();
      Modal.close('loginModal');
      showToast('Hoş geldin!');
    } catch (ex) {
      errEl.textContent = 'Beklenmedik hata: ' + (ex?.message || ex);
      errEl.hidden = false;
    } finally {
      btn.disabled = false;
      spinner.hidden = true;
      label.textContent = 'Giriş Yap';
    }
  });
}

/**
 * Auth state'i yenile, profili getir, UI'ı güncelle.
 * app.js'in onAuthStateChange callback'inden çağrılır.
 */
export async function refreshAuthState(session) {
  currentUser = session?.user || null;
  currentProfile = currentUser
    ? await loadProfile(currentUser.id).catch(() => null)
    : null;
  renderAuthUI();
  applyRBACToNav();
  return currentUser;
}

/* Login modal'ını dışarıdan açabilmek için (navigation'dan) */
export function openLogin() {
  Modal.open('loginModal');
}