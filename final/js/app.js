/* ============================================================
   app.js — Ana giriş noktası (Orkestra şefi)
   - Tüm modülleri import eder
   - onAuthStateChange'i merkezi olarak yönetir
   - Init sırası bu dosyada tanımlı
   ============================================================ */

import { sb } from './supabase.js';
import { clearStaleAuthLocks, log, warn } from './utils/helpers.js';
import { initWeather } from './utils/weather.js';

/* UI */
import {
  initUIListeners, initNavigation, switchTab,
  showToast
} from './ui/components.js';
import {
  initDeptModal, initContactForm, renderSponsorStrip
} from './ui/renderers.js';

/* Core */
import {
  initAuthUI, refreshAuthState,
  isLoggedIn, canAccessTab, isAdmin
} from './core/auth.js';
import { logAction } from './core/audit.js';
import { setupRealtime, teardownRealtime } from './core/realtime.js';

/* Modules */
import { initStock, loadStock } from './modules/stock.js';
import {
  initEngineering, loadParts, loadFlights, loadNotes, loadTelemetry
} from './modules/engineering.js';
import {
  initSponsorshipModule, loadSponsorship, loadNeeds, loadMedia
} from './modules/sponsorship.js';
import { initTasks, loadTasks } from './modules/tasks.js';
import { initAdmin, loadUserManagement, loadAuditLog } from './modules/admin.js';

import { Modal } from './ui/components.js';

/* ============================================================
   STARTUP HOUSEKEEPING
   ============================================================ */
clearStaleAuthLocks();

/* ============================================================
   ON AUTH STATE CHANGE — MERKEZİ KONTROL
   ============================================================ */
let _dataLoaded = false;

sb.auth.onAuthStateChange(async (event, session) => {
  log(`[auth] event: ${event}`);

  // 1. Auth state'i yenile (profili yükler, UI'ı render eder, RBAC uygular)
  await refreshAuthState(session);

  // 2. ÇIKIŞ
  if (event === 'SIGNED_OUT' || !session?.user) {
    _dataLoaded = false;
    teardownRealtime();
    if (event === 'SIGNED_OUT') {
      switchTab('home', { canAccessTab });
      showToast('Güvenli çıkış yapıldı.');
    }
    return;
  }

  // 3. GİRİŞ (yeni veya persisted)
  if (!_dataLoaded) {
    _dataLoaded = true;

    // Sadece gerçek girişte log + last_seen
    if (event === 'SIGNED_IN') {
      sb.rpc('touch_last_seen').catch(() => {});
      logAction('login', null, null, {});
    }

    // Realtime kanallarını kur
    setupRealtime({
      stock: loadStock,
      sponsorship: loadSponsorship,
      needs: loadNeeds,
      flightsAndNotes: () => loadFlights().then(loadNotes),
      notes: loadNotes,
      parts: loadParts,
      tasks: loadTasks,
      telemetry: loadTelemetry,
      media: loadMedia,
      users: loadUserManagement,
      audit: loadAuditLog
    });

    // Tüm verileri paralel yükle (allSettled — bir hata diğerini etkilemez)
    loadAllData().catch(e => warn('loadAllData hatası:', e));
  }
});

async function loadAllData() {
  const tasksList = [
    ['sponsorship',    loadSponsorship()],
    ['stock',          loadStock()],
    ['needs',          loadNeeds()],
    ['flights+notes',  loadFlights().then(loadNotes)],
    ['parts',          loadParts()],
    ['tasks',          loadTasks()],
    ['telemetry',      loadTelemetry()],
    ['media',          loadMedia()]
  ];
  const results = await Promise.allSettled(tasksList.map(([, p]) => p));
  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      warn(`[loadAllData] ${tasksList[i][0]} failed:`, r.reason);
    }
  });
}

/* ============================================================
   INIT
   ============================================================ */
async function init() {
  // 1. Global UI listenerlar (modal close, theme toggle vs.)
  initUIListeners();

  // 2. Static renderlar (departman modal, contact form)
  initDeptModal();
  initContactForm();

  // 3. Navigation event listenerları
  initNavigation({
    isLoggedIn,
    canAccessTab,
    openLogin: () => Modal.open('loginModal')
  });

  // 4. Tab switch hook'u: admin paneli açılınca lazy-load
  //    (components.js export ettiği onTabSwitch ile)
  const { onTabSwitch } = await import('./ui/components.js');
  onTabSwitch((target) => {
    if (target === 'user-management' && isAdmin()) {
      loadUserManagement();
      loadAuditLog();
    }
  });

  // 5. Auth UI (login/logout butonları)
  initAuthUI();

  // 6. Modüller
  initStock();
  initEngineering();
  initSponsorshipModule();
  initTasks();
  initAdmin();

  // 7. Hava durumu
  initWeather();

  // 8. İlk auth durumunu çek (onAuthStateChange INITIAL_SESSION'ı tetikler)
  //    refreshAuthState çağrısı orada otomatik yapılıyor.
  //    Ama login yoksa sponsor strip için boş ekran:
  if (!isLoggedIn()) {
    renderSponsorStrip([]);
  }
}

init().catch(e => console.error('[init] failed:', e));