/* ============================================================
   ANATOLIA AERO DESIGN — script.js (v4 — RBAC tam sürüm)
   v3'e göre değişiklikler:
   - Kanban (görevler) artık index.html içinde, ayrı tasks.js yok
   - RBAC: data-allowed-depts, data-role attribute'larıyla menü/tab filtreleme
   - 3 yeni modül: telemetry, media_assets, user_management
   - Audit log: tüm CRUD işlemleri kayda geçer
   - touch_last_seen RPC ile kullanıcı son giriş zamanı güncellenir
   ============================================================ */

const SUPABASE_URL = 'https://hcqyqkugyreankkeldfl.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_twWFFp4N1A26acww4dQjEw_r0yNY9SL';

const DEBUG = false;
const log  = (...a) => { if (DEBUG) console.log(...a); };
const warn = (...a) => console.warn(...a);
const err  = (...a) => console.error(...a);

/* ============================================================
   STALE LOCK CLEANUP — eski Supabase lock'ları temizle
   ============================================================ */
(function clearStaleAuthLocks() {
  try {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (key.includes('lock:sb-') || key.startsWith('lock-sb-')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(k => {
      log('[auth-guard] Stale lock cleared:', k);
      localStorage.removeItem(k);
    });
  } catch (e) {
    warn('[auth-guard] cleanup failed:', e);
  }
})();

/* ============================================================
   SUPABASE CLIENT
   ============================================================ */
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storage: window.localStorage,
    detectSessionInUrl: false,
    lock: async (name, acquireTimeout, fn) => {
      if (typeof navigator !== 'undefined' && navigator.locks?.request) {
        try {
          return await navigator.locks.request(
            name, { mode: 'exclusive', ifAvailable: false }, fn
          );
        } catch (e) {
          warn('[auth] lock fallback:', e?.message);
          return fn();
        }
      }
      return fn();
    }
  },
  realtime: {
    params: { eventsPerSecond: 10 }
  }
});

window.sb = sb;

/* ============================================================
   UTILS
   ============================================================ */
const $ = (id) => document.getElementById(id);
const fmtMoney = (n) => new Intl.NumberFormat('tr-TR').format(Math.round(n || 0));
const fmtDate = (d) => new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
const fmtDateTime = (d) => new Date(d).toLocaleString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

function showToast(msg, type = 'success') {
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
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity 240ms'; }, 2400);
  setTimeout(() => t.remove(), 2800);
}

function customConfirm(message, title = 'Onay') {
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

function setConnStatus(state, text) {
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
   THEME
   ============================================================ */
const Theme = {
  get() { return document.documentElement.getAttribute('data-theme') || 'light'; },
  set(t) {
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem('aad_theme', t); } catch(e){}
  },
  toggle() { this.set(this.get() === 'light' ? 'dark' : 'light'); }
};
$('themeToggle')?.addEventListener('click', () => Theme.toggle());

/* ============================================================
   MODAL
   ============================================================ */
const Modal = {
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

document.addEventListener('click', (e) => {
  if (e.target.dataset.modalClose !== undefined) Modal.closeAll();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') Modal.closeAll();
});

/* ============================================================
   AUTH STATE & RBAC HELPERS
   ============================================================ */
let currentUser = null;
let currentProfile = null;

function isAdmin() { return currentProfile?.role === 'admin'; }
function myDept()  { return currentProfile?.department || ''; }

/**
 * Bir element'in (nav link veya tab) erişimini kontrol et.
 */
function canAccessElement(el) {
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

function canAccessTab(tabName) {
  const link = document.querySelector(`.nav__link[data-tab="${tabName}"]`);
  if (!link) return true; // bilinmeyen tab → bloke etme
  return canAccessElement(link);
}

async function loadProfile(userId) {
  const { data, error: e } = await sb.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (e) { warn('profile load error', e); return null; }
  return data;
}

async function refreshAuthState() {
  const { data: { session }, error: e } = await sb.auth.getSession();

  if (e) {
    console.warn('[auth] Oturum alınırken hata oluştu:', e);
  }

  currentUser = session?.user || null;
  currentProfile = currentUser ? await loadProfile(currentUser.id).catch(() => null) : null;
  renderAuthUI();
  applyRBACToNav();
  return currentUser;
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

/**
 * Nav linklerini ve dropdown menülerini RBAC'a göre filtrele.
 */
function applyRBACToNav() {
  document.querySelectorAll('.nav__link').forEach(link => {
    const accessible = canAccessElement(link);
    link.style.display = accessible ? '' : 'none';
  });

  // Dropdown trigger: içinde görünür link kalmadıysa trigger'ı da gizle
  document.querySelectorAll('.nav__dropdown').forEach(dd => {
    const allLinks = dd.querySelectorAll('.nav__link');
    let visibleCount = 0;
    allLinks.forEach(l => {
      if (l.style.display !== 'none') visibleCount++;
    });
    dd.style.display = (visibleCount === 0 && !canAccessElement(dd)) ? 'none' : '';
  });

  // [data-write-only="dept1,dept2"] paneller: yazma yetkisi olmayanlara gizle
  document.querySelectorAll('[data-write-only]').forEach(panel => {
    const allowed = panel.dataset.writeOnly.split(',').map(s => s.trim());
    const canWrite = isAdmin() || allowed.includes(myDept());
    panel.style.display = canWrite ? '' : 'none';
  });

  // Aktif tab erişilebilir değilse → ana sayfaya
  const activeTab = document.querySelector('.tab.is-active');
  if (activeTab && !canAccessTab(activeTab.dataset.tab)) {
    switchTab('home');
  }
}

window.aadCore = {
  $, escapeHtml, fmtDate, fmtDateTime, fmtMoney, showToast, customConfirm,
  getCurrentUser: () => currentUser,
  getCurrentProfile: () => currentProfile,
  isAdmin, myDept, canAccessTab
};

/* ============================================================
   AUDIT LOG
   ============================================================ */
async function logAction(action, table, recordId, details = {}) {
  if (!currentUser) return;
  try {
    await sb.from('audit_log').insert([{
      user_id: currentUser.id,
      user_name: currentProfile?.full_name || currentProfile?.username || currentUser.email,
      user_dept: myDept(),
      action: action,
      table_name: table,
      record_id: recordId ? String(recordId) : null,
      details: details
    }]);
  } catch (e) {
    log('[audit] log failed (non-critical):', e);
  }
}

/* ============================================================
   LOGIN / LOGOUT
   ============================================================ */
$('authButtons').addEventListener('click', async (e) => {
  if (e.target.closest('#loginBtn')) {
    Modal.open('loginModal');
  } else if (e.target.closest('#logoutBtn')) {
    const ok = await customConfirm('Oturumu kapatmak istediğine emin misin?');
    if (!ok) return;
    await sb.auth.signOut();
    switchTab('home');
  }
});

$('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const email = fd.get('email');
  const password = fd.get('password');
  const errEl = $('loginError');
  const btn = $('loginSubmit');
  const spinner = btn.querySelector('.btn__spinner');
  const label = btn.querySelector('.btn__label');

  errEl.hidden = true;
  btn.disabled = true; spinner.hidden = false; label.textContent = 'Giriş yapılıyor';

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

/* ============================================================
   AUTH STATE CHANGE — MERKEZİ KONTROL
   ============================================================ */
let _dataLoaded = false;

sb.auth.onAuthStateChange(async (event, session) => {
  log(`[auth] Olay: ${event}`);

  // 1. Değişkenleri anlık güncelle (Session yoksa otomatik null olur)
  currentUser = session?.user || null;

  // 2. ÇIKIŞ DURUMU (SIGNED_OUT)
  if (event === 'SIGNED_OUT' || !currentUser) {
    currentUser = null;
    currentProfile = null;
    _dataLoaded = false;
    
    teardownRealtime(); // Canlı bağlantıları kopar
    renderAuthUI();     // Giriş butonunu geri getir
    applyRBACToNav();   // Menüleri yetkisiz moda çek
    
    // Çıkış yapınca ana sayfaya at (opsiyonel)
    if (event === 'SIGNED_OUT') {
      switchTab('home');
      showToast('Güvenli çıkış yapıldı.');
    }
    return; // Aşağıdaki giriş işlemlerine devam etme
  }

  // 3. GİRİŞ VEYA OTURUM BAŞLATMA (SIGNED_IN / INITIAL_SESSION)
  if (currentUser) {
    // Eğer profil henüz yüklenmediyse yükle
    if (!currentProfile) {
      currentProfile = await loadProfile(currentUser.id).catch(() => null);
    }

    // Arayüzü hemen güncelle (profil gelince isim görünsün)
    renderAuthUI();
    applyRBACToNav();

    // Veri yükleme mantığı
    if (!_dataLoaded) {
      _dataLoaded = true;

      // Sadece gerçek girişte (login) log tut ve last_seen güncelle
      if (event === 'SIGNED_IN') {
        await sb.rpc('touch_last_seen');
        logAction('login', null, null, {});
      }

      setupRealtime();
      loadAllData().catch(e => warn('loadAllData hatası:', e));
    }
  }

  // 4. TOKEN YENİLEME
  if (event === 'TOKEN_REFRESHED') {
    log('[auth] Token tazelendi');
  }
});

/* ============================================================
   NAVIGATION
   ============================================================ */
const tabs = document.querySelectorAll('.tab');

function switchTab(target) {
  // Erişim kontrolü
  if (target !== 'home' && target !== 'access-denied' && target !== 'contact') {
    if (!canAccessTab(target)) {
      target = 'access-denied';
    }
  }

  document.querySelectorAll('.nav__link').forEach(l => l.classList.toggle('is-active', l.dataset.tab === target));
  tabs.forEach(t => t.classList.toggle('is-active', t.dataset.tab === target));

  document.querySelectorAll('.nav__dropdown').forEach(dd => {
    const trigger = dd.querySelector('.nav__dropdown-trigger');
    if (!trigger) return;
    const hasActive = dd.querySelector('.nav__link.is-active') !== null;
    trigger.classList.toggle('has-active', hasActive);
    dd.classList.remove('is-open');
  });

  $('primaryNav').classList.remove('is-open');
  $('menuToggle')?.setAttribute('aria-expanded', 'false');
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Admin sayfası lazy load
  if (target === 'user-management' && isAdmin()) {
    loadUserManagement();
    loadAuditLog();
  }
}

$('primaryNav').addEventListener('click', (e) => {
  const link = e.target.closest('.nav__link');
  if (!link) return;
  const target = link.dataset.tab;
  const isPrivate = link.dataset.private !== undefined;
  if (isPrivate && !currentUser) { Modal.open('loginModal'); return; }
  switchTab(target);
});

document.addEventListener('click', (e) => {
  const trigger = e.target.closest('.nav__dropdown-trigger');
  if (trigger) {
    e.stopPropagation();
    const dropdown = trigger.parentElement;
    if (trigger.dataset.private !== undefined && !currentUser) {
      Modal.open('loginModal');
      return;
    }
    document.querySelectorAll('.nav__dropdown').forEach(d => {
      if (d !== dropdown) d.classList.remove('is-open');
    });
    dropdown.classList.toggle('is-open');
    return;
  }
  if (!e.target.closest('.nav__dropdown')) {
    document.querySelectorAll('.nav__dropdown').forEach(d => d.classList.remove('is-open'));
  }
});

$('menuToggle').addEventListener('click', () => {
  const nav = $('primaryNav');
  const open = nav.classList.toggle('is-open');
  $('menuToggle').setAttribute('aria-expanded', open ? 'true' : 'false');
});

// "Ana Sayfaya Dön" butonu (access-denied sayfası)
$('goHomeFromDenied')?.addEventListener('click', () => switchTab('home'));

/* ============================================================
   DEPARTMENT MODAL
   ============================================================ */
const DEPT_DETAILS = {
  yazilim: { num: '01', name: 'Yazılım',
    lead: 'Otopilot, görev yönetimi ve yer kontrol istasyonu yazılımları üzerine çalışan ekibimiz.',
    body: `Yazılım departmanı, İHA'larımızın "beyni" olan otopilot sistemlerini, görev planlama yazılımlarını ve yer istasyonu arayüzlerini geliştirir.`,
    tasks: [
      { t: 'Otopilot Geliştirme', d: 'PX4 / ArduPilot tabanlı otonom uçuş kontrolü' },
      { t: 'Görev Yazılımı', d: 'Waypoint navigasyonu, otomatik iniş-kalkış' },
      { t: 'Yer İstasyonu', d: 'Telemetri görselleştirme ve komuta arayüzü' },
      { t: 'Görüntü İşleme', d: 'OpenCV ile nesne tespiti ve takip algoritmaları' }
    ]},
  yapisal: { num: '02', name: 'Yapısal',
    lead: 'Mekanik tasarım, montaj süreçleri ve dayanım analizi ile uçaklarımızın iskeletini şekillendiriyoruz.',
    body: `CAD modelleme, sonlu elemanlar analizi (FEA), aerodinamik hesaplamalar ve montaj süreçleri bu departmanın sorumluluğundadır.`,
    tasks: [
      { t: '3D CAD Tasarım', d: 'Tüm gövde, kanat ve kuyruk yapılarının modellenmesi' },
      { t: 'Yapısal Analiz', d: 'FEA ile dayanım, titreşim, yorgunluk testleri' },
      { t: 'Aerodinamik', d: 'Kanat profili seçimi, CFD doğrulamaları' },
      { t: 'Montaj & Üretim', d: 'Atölyede son ürün haline getirme süreci' }
    ]},
  aviyonik: { num: '03', name: 'Aviyonik',
    lead: 'İHA üzerindeki tüm elektronik beyin ve sinir sistemi: sensörler, telemetri ve güç dağıtımı.',
    body: `Uçuş kontrolcüsünden GPS'e, telemetri modülünden batarya yönetim sistemine kadar tüm elektronik altyapı aviyonik departmanının sorumluluğundadır.`,
    tasks: [
      { t: 'Uçuş Kontrolcü', d: 'Pixhawk, Cube ve diğer FCU\'ların entegrasyonu' },
      { t: 'Sensör Entegrasyonu', d: 'IMU, GPS, hava hızı, lidar, kamera' },
      { t: 'Güç Sistemi', d: 'BEC, ESC, batarya seçimi ve yönetimi' },
      { t: 'Telemetri & RC', d: 'Veri linki ve kontrol kanallarının ayarı' }
    ]},
  kompozit: { num: '04', name: 'Kompozit',
    lead: 'Karbon fiber, cam fiber ve epoksi reçine ile hafif ama dayanıklı yapılar üretiriz.',
    body: `Kalıp hazırlama, vakum bagging, infüzyon süreçleri ile uçaklarımızın ana yapı parçalarını üretiyoruz.`,
    tasks: [
      { t: 'Kalıp Üretimi', d: 'Pozitif/negatif kalıpların hazırlanması' },
      { t: 'Laminasyon', d: 'Karbon/cam fiber katmanlama, vakum bagging' },
      { t: 'İnfüzyon', d: 'Reçine infüzyonu ile yüksek kaliteli parçalar' },
      { t: 'Yüzey İşleme', d: 'Zımpara, dolgu ve boya süreci' }
    ]},
  sponsorluk: { num: '05', name: 'Sponsorluk',
    lead: 'Kurumsal ilişkiler, finansman, sözleşme yönetimi ve sponsor geri dönüşleri.',
    body: `Şirketlerle iletişim, sponsorluk paketleri, sözleşmeler ve sponsor görünürlüğünün takibi bu departmanda yapılır.`,
    tasks: [
      { t: 'Kurumsal İletişim', d: 'Potansiyel sponsorlarla görüşmeler' },
      { t: 'Sponsorluk Paketleri', d: 'Bronz, Gümüş, Altın, Platin paketler' },
      { t: 'Bütçe Yönetimi', d: 'Departmanlar arası kaynak dağılımı' },
      { t: 'Geri Dönüş Takibi', d: 'Sponsor görünürlüğü ve raporlama' }
    ]},
  medya: { num: '06', name: 'Medya & Tanıtım',
    lead: 'Takımın yüzü ve sesi: içerik, fotoğraf, video, sosyal medya ve etkinlik.',
    body: `Profesyonel fotoğraf çekimi, video prodüksiyonu, sosyal medya yönetimi ve takımın görsel kimliğinin tasarımı bu departmanın sorumluluğundadır.`,
    tasks: [
      { t: 'İçerik Üretimi', d: 'Sosyal medya postları, hikayeler' },
      { t: 'Fotoğraf & Video', d: 'Test uçuşları, yarışmalar, atölye süreçleri' },
      { t: 'Marka Kimliği', d: 'Logo, şablonlar, sunum tasarımları' },
      { t: 'Etkinlik & PR', d: 'Tanıtım günleri, fuarlar, basın bülten' }
    ]}
};

$('deptGrid').addEventListener('click', (e) => {
  const card = e.target.closest('.dept-card');
  if (!card) return;
  const d = DEPT_DETAILS[card.dataset.dept];
  if (!d) return;
  $('deptModalNum').textContent = d.num;
  $('deptTitle').textContent = d.name;
  $('deptModalBody').innerHTML = `
    <p class="modal__lead">${escapeHtml(d.lead)}</p>
    <p>${escapeHtml(d.body)}</p>
    <ul class="modal__list">
      ${d.tasks.map(t => `<li><strong>${escapeHtml(t.t)}</strong>${escapeHtml(t.d)}</li>`).join('')}
    </ul>
  `;
  Modal.open('deptModal');
});

/* ============================================================
   CONTACT FORM
   ============================================================ */
$('contactForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const { error: e2 } = await sb.from('contact_messages').insert([{
    name: fd.get('name'), email: fd.get('email'),
    subject: fd.get('subject'), message: fd.get('message')
  }]);
  if (e2) {
    showToast('Mesaj gönderilemedi: ' + e2.message, 'error');
    return;
  }
  e.target.reset();
  showToast('Mesajınız iletildi. Teşekkürler!');
});

/* ============================================================
   WEATHER (Open-Meteo)
   ============================================================ */
let windUnit = 'kmh';
let weatherCache = null;
let currentLocation = { name: 'Eskişehir', lat: 39.7767, lon: 30.5206 };

const WMO = {
  0:  { icon: '☀',  text: 'Açık' }, 1:  { icon: '🌤', text: 'Az bulutlu' },
  2:  { icon: '⛅', text: 'Parçalı bulutlu' }, 3:  { icon: '☁',  text: 'Kapalı' },
  45: { icon: '🌫', text: 'Sisli' }, 48: { icon: '🌫', text: 'Don sisli' },
  51: { icon: '🌦', text: 'Hafif çisenti' }, 53: { icon: '🌦', text: 'Çisenti' },
  55: { icon: '🌦', text: 'Yoğun çisenti' }, 61: { icon: '🌧', text: 'Hafif yağmur' },
  63: { icon: '🌧', text: 'Yağmur' }, 65: { icon: '🌧', text: 'Şiddetli yağmur' },
  71: { icon: '🌨', text: 'Hafif kar' }, 73: { icon: '🌨', text: 'Kar' },
  75: { icon: '❄',  text: 'Yoğun kar' }, 77: { icon: '🌨', text: 'Kar taneleri' },
  80: { icon: '🌦', text: 'Sağanak' }, 81: { icon: '🌧', text: 'Sağanak yağış' },
  82: { icon: '⛈', text: 'Şiddetli sağanak' }, 85: { icon: '🌨', text: 'Kar sağanağı' },
  86: { icon: '🌨', text: 'Yoğun kar sağanağı' }, 95: { icon: '⛈', text: 'Gök gürültülü fırtına' },
  96: { icon: '⛈', text: 'Dolu eşliğinde fırtına' }, 99: { icon: '⛈', text: 'Şiddetli fırtına' }
};
const wmo = (c) => WMO[c] || { icon: '🌡', text: 'Bilinmiyor' };
const degToCompass = (deg) => {
  if (deg == null || isNaN(deg)) return '—';
  const dirs = ['K','KKD','KD','DKD','D','DGD','GD','GGD','G','GGB','GB','BGB','B','BKB','KB','KKB'];
  return dirs[Math.round(deg / 22.5) % 16];
};
const formatWind = (kmh) => kmh == null ? '--' : (windUnit === 'kn' ? (kmh * 0.539957).toFixed(1) : kmh.toFixed(1));
const interp50m = (v10, v80) => (v10 == null || v80 == null) ? v10 : v10 + (v80 - v10) * ((50 - 10) / (80 - 10));

async function geocode(q) {
  const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1&language=tr&format=json`);
  const d = await r.json();
  if (d.results?.[0]) {
    const x = d.results[0];
    return { name: x.name + (x.admin1 ? ', ' + x.admin1 : ''), lat: x.latitude, lon: x.longitude };
  }
  return null;
}

async function fetchWeather(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m` +
    `&hourly=temperature_2m,weather_code,wind_speed_10m,wind_direction_10m,wind_speed_80m,wind_direction_80m,relative_humidity_2m` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,wind_speed_10m_max,wind_direction_10m_dominant,precipitation_sum` +
    `&wind_speed_unit=kmh&timezone=auto&forecast_days=5`;
  const data = await (await fetch(url)).json();
  data._fetchedAt = Date.now();
  return data;
}

function updateWeatherBar(data) {
  if (!data?.current) return;
  const c = data.current; const w = wmo(c.weather_code);
  $('wx-icon').textContent = w.icon;
  $('wx-cond').textContent = w.text;
  $('wx-temp').textContent = Math.round(c.temperature_2m);
  $('wx-humidity').textContent = Math.round(c.relative_humidity_2m);
  $('wx-loc').textContent = currentLocation.name;
  $('wx-wind-ground').textContent = formatWind(c.wind_speed_10m);
  $('wx-wind-ground-unit').textContent = windUnit === 'kn' ? 'kn' : 'km/h';
  $('wx-wind-ground-dir').textContent = degToCompass(c.wind_direction_10m);
  let wind50 = null, dir50 = null;
  if (data.hourly) {
    const idx = Math.max(0, data.hourly.time.findIndex(t => new Date(t) >= new Date()) - 1);
    wind50 = interp50m(data.hourly.wind_speed_10m[idx], data.hourly.wind_speed_80m[idx]);
    dir50  = data.hourly.wind_direction_80m[idx] ?? data.hourly.wind_direction_10m[idx];
  }
  $('wx-wind-50').textContent = formatWind(wind50);
  $('wx-wind-50-unit').textContent = windUnit === 'kn' ? 'kn' : 'km/h';
  $('wx-wind-50-dir').textContent = degToCompass(dir50);
}

function renderForecast(data) {
  if (!data?.daily) return;
  const days = data.daily;
  $('forecast').innerHTML = days.time.map((dt, i) => {
    const d = new Date(dt); const w = wmo(days.weather_code[i]);
    return `
      <div class="fc-card${i === 0 ? ' is-today' : ''}">
        <div class="fc-day">${i === 0 ? 'BUGÜN' : d.toLocaleDateString('tr-TR',{weekday:'long'})}</div>
        <div class="fc-date">${d.getDate()} ${d.toLocaleDateString('tr-TR',{month:'short'})}</div>
        <div class="fc-icon">${w.icon}</div>
        <div class="fc-temp">${Math.round(days.temperature_2m_max[i])}°<span class="fc-temp__low">${Math.round(days.temperature_2m_min[i])}°</span></div>
        <div class="fc-cond">${w.text}</div>
        <div class="fc-detail"><span>RÜZGAR</span><span>${formatWind(days.wind_speed_10m_max[i])} ${windUnit==='kn'?'kn':'km/h'} ${degToCompass(days.wind_direction_10m_dominant[i])}</span></div>
        <div class="fc-detail"><span>YAĞIŞ</span><span>${(days.precipitation_sum[i]||0).toFixed(1)} mm</span></div>
      </div>`;
  }).join('');
}

function renderHourly(data) {
  if (!data?.hourly) return;
  const h = data.hourly;
  const start = h.time.findIndex(t => new Date(t) >= new Date());
  const slice = Array.from({length:24}, (_,k) => start+k).filter(i => i < h.time.length);
  $('hourly').innerHTML = slice.map(i => {
    const t = new Date(h.time[i]); const w = wmo(h.weather_code[i]);
    return `
      <div class="h-cell">
        <div class="h-time">${t.getHours().toString().padStart(2,'0')}:00</div>
        <div class="h-icon">${w.icon}</div>
        <div class="h-temp">${Math.round(h.temperature_2m[i])}°</div>
        <div class="h-wind">${formatWind(h.wind_speed_10m[i])} ${degToCompass(h.wind_direction_10m[i])}</div>
      </div>`;
  }).join('');
}

async function loadWeather() {
  try {
    weatherCache = await fetchWeather(currentLocation.lat, currentLocation.lon);
    updateWeatherBar(weatherCache);
    renderForecast(weatherCache);
    renderHourly(weatherCache);
  } catch (e) {
    warn('weather fetch failed:', e);
    $('wx-cond').textContent = 'Veri alınamadı';
  }
}

document.querySelectorAll('.unit-toggle__btn').forEach(b => {
  b.addEventListener('click', () => {
    document.querySelectorAll('.unit-toggle__btn').forEach(x => x.classList.toggle('is-active', x === b));
    windUnit = b.dataset.unit;
    if (weatherCache) { updateWeatherBar(weatherCache); renderForecast(weatherCache); renderHourly(weatherCache); }
  });
});

$('locSearch').addEventListener('click', async () => {
  const q = $('locInput').value.trim(); if (!q) return;
  const loc = await geocode(q);
  if (loc) { currentLocation = loc; loadWeather(); }
  else { showToast('Konum bulunamadı', 'error'); }
});

$('locMe').addEventListener('click', () => {
  if (!navigator.geolocation) {
    return showToast('Tarayıcınız konum servisini desteklemiyor', 'error');
  }
  if (location.protocol === 'http:' && location.hostname !== 'localhost') {
    return showToast('Konum servisi sadece HTTPS üzerinde çalışır', 'error');
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      currentLocation = { name: 'Mevcut Konum', lat: pos.coords.latitude, lon: pos.coords.longitude };
      loadWeather();
    },
    (e) => {
      const msg = e.code === 1 ? 'Konum izni reddedildi'
                : e.code === 2 ? 'Konum belirlenemedi'
                : e.code === 3 ? 'Konum isteği zaman aşımına uğradı'
                : 'Konum alınamadı';
      showToast(msg, 'error');
    },
    { timeout: 10000, maximumAge: 60000 }
  );
});

document.addEventListener('visibilitychange', () => {
  if (!document.hidden && weatherCache) {
    const ageMs = Date.now() - (weatherCache._fetchedAt || 0);
    if (ageMs > 5 * 60 * 1000) loadWeather();
  }
});

/* ============================================================
   DEPARTMENT LABELS
   ============================================================ */
const DEPT_LABELS = {
  yazilim: 'Yazılım', yapisal: 'Yapısal', aviyonik: 'Aviyonik',
  kompozit: 'Kompozit', sponsorluk: 'Sponsorluk',
  medya: 'Medya & Tanıtım', ortak: 'Ortak'
};

/* ============================================================
   SPONSORS & ALLOCATIONS
   ============================================================ */
let _sponsors = [];
let _allocations = [];

async function loadSponsorship() {
  if (!isAdmin() && myDept() !== 'sponsorluk') {
    _sponsors = []; _allocations = [];
    renderSponsorship();
    return;
  }
  const [sp, al] = await Promise.all([
    sb.from('sponsors').select('*').order('date', { ascending: false }),
    sb.from('allocations').select('*').order('created_at', { ascending: false })
  ]);
  if (sp.error) warn(sp.error); else _sponsors = sp.data || [];
  if (al.error) warn(al.error); else _allocations = al.data || [];
  renderSponsorship();
}

function renderSponsorship() {
  const total     = _sponsors.reduce((a,b) => a + Number(b.amount || 0), 0);
  const allocated = _allocations.reduce((a,b) => a + Number(b.amount || 0), 0);

  $('totalBudget').textContent = fmtMoney(total);
  $('allocated').textContent   = fmtMoney(allocated);
  $('remaining').textContent   = fmtMoney(total - allocated);

  const tbody = $('sponsorTable');
  if (_sponsors.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty">Henüz sponsorluk kaydı yok.</td></tr>';
  } else {
    tbody.innerHTML = _sponsors.map(s => `
      <tr>
        <td><strong>${escapeHtml(s.name)}</strong></td>
        <td class="num">${fmtMoney(s.amount)} ₺</td>
        <td class="num">${fmtDate(s.date)}</td>
        <td>${escapeHtml(s.note || '')}</td>
        <td><button class="icon-btn" data-del-sponsor="${s.id}" title="Sil" type="button">×</button></td>
      </tr>
    `).join('');
  }

  const deptTotals = {};
  _allocations.forEach(a => { deptTotals[a.dept] = (deptTotals[a.dept] || 0) + Number(a.amount || 0); });
  const max = Math.max(1, ...Object.values(deptTotals));
  const depts = ['yazilim','yapisal','aviyonik','kompozit','sponsorluk','medya'];
  $('deptBudgets').innerHTML = depts.map(d => {
    const v = deptTotals[d] || 0;
    return `
      <div class="dept-budget">
        <div class="dept-budget__name">${DEPT_LABELS[d]}</div>
        <div class="dept-budget__amt">${fmtMoney(v)} ₺</div>
        <div class="dept-budget__bar"><span style="width:${(v/max)*100}%"></span></div>
      </div>`;
  }).join('');

  renderSponsorStrip(_sponsors);
}

function renderSponsorStrip(sponsors) {
  const items = sponsors.length > 0
    ? [...new Set(sponsors.map(s => s.name))]
    : ['Anatolia Aero Design', 'Eskişehir Teknik Üniversitesi', 'ETİ', 'Teknofest', 'ESTÜ'];
  $('sponsorTrack').innerHTML = [...items, ...items]
    .map(n => `<span class="sponsor-chip">${escapeHtml(n)}</span>`).join('');
}

$('sponsorForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentUser) return Modal.open('loginModal');
  const fd = new FormData(e.target);
  const payload = {
    name: fd.get('name'),
    amount: Number(fd.get('amount')),
    date: fd.get('date'),
    note: fd.get('note'),
    created_by: currentUser.id
  };
  const { data, error: e2 } = await sb.from('sponsors').insert([payload]).select();
  if (e2) return showToast(e2.message, 'error');
  e.target.reset();
  showToast('Sponsor kaydedildi.');
  logAction('create', 'sponsors', data?.[0]?.id, { name: payload.name });
});

$('allocForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentUser) return Modal.open('loginModal');
  const fd = new FormData(e.target);
  const total = _sponsors.reduce((a,b) => a + Number(b.amount), 0);
  const used = _allocations.reduce((a,b) => a + Number(b.amount), 0);
  const want = Number(fd.get('amount'));
  if (used + want > total) {
    const ok = await customConfirm(
      `Tahsis edilebilir bütçeyi (${fmtMoney(total - used)} ₺) aşıyorsun. Devam edilsin mi?`,
      'Bütçe aşımı'
    );
    if (!ok) return;
  }
  const payload = {
    dept: fd.get('dept'), amount: want,
    purpose: fd.get('purpose'),
    created_by: currentUser.id
  };
  const { data, error: e2 } = await sb.from('allocations').insert([payload]).select();
  if (e2) return showToast(e2.message, 'error');
  e.target.reset();
  showToast('Tahsis kaydedildi.');
  logAction('create', 'allocations', data?.[0]?.id, payload);
});

$('sponsorTable').addEventListener('click', async (e) => {
  const id = e.target.dataset.delSponsor;
  if (!id) return;
  const ok = await customConfirm('Bu sponsorluk kaydı silinsin mi?');
  if (!ok) return;
  const { error: e2 } = await sb.from('sponsors').delete().eq('id', id);
  if (e2) showToast(e2.message, 'error');
  else logAction('delete', 'sponsors', id, {});
});

/* ============================================================
   STOCK
   ============================================================ */
let _stock = [];

async function loadStock() {
  if (!isAdmin() && !['yazilim','yapisal','kompozit','aviyonik','sponsorluk'].includes(myDept())) {
    _stock = []; renderStock(); return;
  }
  const { data, error: e } = await sb.from('stock').select('*').order('created_at', { ascending: false });
  if (e) { warn(e); return; }
  _stock = data || [];
  renderStock();
}

function renderStock() {
  const q = ($('stockSearch').value || '').toLowerCase();
  const dept = $('stockFilterDept').value;
  const onlyLow = $('stockOnlyLow').checked;

  const filtered = _stock.filter(s => {
    if (q && !s.name.toLowerCase().includes(q)) return false;
    if (dept && s.dept !== dept) return false;
    if (onlyLow && Number(s.qty) > Number(s.min_stock || 0)) return false;
    return true;
  });

  $('stockCount').textContent = `${filtered.length} kayıt`;
  const tbody = $('stockTable');
  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty">Stok kaydı bulunamadı.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(s => {
    const min = Number(s.min_stock || 0);
    const qty = Number(s.qty);
    const price = Number(s.price || 0);
    const total = qty * price;
    let status, badge;
    if (qty === 0)        { status = 'TÜKENDİ';  badge = 'bad'; }
    else if (qty <= min)  { status = 'KRİTİK';   badge = 'warn'; }
    else                  { status = 'YETERLİ';  badge = 'ok'; }
    return `
      <tr data-row-id="${s.id}">
        <td><strong>${escapeHtml(s.name)}</strong></td>
        <td><span class="badge badge--info">${DEPT_LABELS[s.dept] || s.dept}</span></td>
        <td class="num">${qty} ${escapeHtml(s.unit || '')}</td>
        <td class="num">${price ? fmtMoney(price) + ' ₺' : '—'}</td>
        <td class="num">${total ? fmtMoney(total) + ' ₺' : '—'}</td>
        <td>${escapeHtml(s.location || '—')}</td>
        <td><span class="badge badge--${badge}">${status}</span></td>
        <td><button class="icon-btn" data-del-stock="${s.id}" title="Sil" type="button">×</button></td>
      </tr>`;
  }).join('');
}

$('stockForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentUser) return Modal.open('loginModal');
  const fd = new FormData(e.target);
  const payload = {
    name: fd.get('name'),
    dept: fd.get('dept'),
    qty: Number(fd.get('qty')),
    unit: fd.get('unit'),
    price: Number(fd.get('price') || 0),
    min_stock: Number(fd.get('min') || 0),
    location: fd.get('location'),
    created_by: currentUser.id
  };
  const { data, error: e2 } = await sb.from('stock').insert([payload]).select();
  if (e2) return showToast(e2.message, 'error');
  e.target.reset();
  showToast('Malzeme eklendi.');
  logAction('create', 'stock', data?.[0]?.id, { name: payload.name });
});

$('stockTable').addEventListener('click', async (e) => {
  const id = e.target.dataset.delStock;
  if (!id) return;
  const ok = await customConfirm('Bu stok kaydı silinsin mi?');
  if (!ok) return;
  const { error: e2 } = await sb.from('stock').delete().eq('id', id);
  if (e2) showToast(e2.message, 'error');
  else logAction('delete', 'stock', id, {});
});

['stockSearch', 'stockFilterDept', 'stockOnlyLow'].forEach(id => {
  $(id).addEventListener('input', renderStock);
});

/* ============================================================
   NEEDS
   ============================================================ */
let _needs = [];
async function loadNeeds() {
  const { data, error: e } = await sb.from('needs').select('*').order('created_at', { ascending: false });
  if (e) { warn(e); return; }
  _needs = data || [];
  renderNeeds();
}
function renderNeeds() {
  $('needsCount').textContent = _needs.filter(n => !n.done).length;
  const tbody = $('needsTable');
  if (_needs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty">Henüz ihtiyaç talebi yok.</td></tr>';
    return;
  }
  const prio = { critical:['KRİTİK','bad'], high:['YÜKSEK','warn'], medium:['ORTA','info'], low:['DÜŞÜK','ok'] };
  tbody.innerHTML = _needs.map(n => {
    const [pl, pb] = prio[n.priority] || prio.medium;
    return `
      <tr style="${n.done ? 'opacity:0.5;text-decoration:line-through;' : ''}">
        <td><strong>${escapeHtml(n.item)}</strong>${n.reason ? `<br><small style="color:var(--ink-3)">${escapeHtml(n.reason)}</small>` : ''}</td>
        <td><span class="badge badge--info">${DEPT_LABELS[n.dept] || n.dept}</span></td>
        <td class="num">${n.qty}</td>
        <td class="num">${n.cost ? fmtMoney(n.cost) + ' ₺' : '—'}</td>
        <td><span class="badge badge--${pb}">${pl}</span></td>
        <td><span class="badge badge--${n.done ? 'ok' : 'accent'}">${n.done ? 'TAMAMLANDI' : 'AÇIK'}</span></td>
        <td>
          <button class="btn btn--small" data-toggle-need="${n.id}" data-current="${n.done}" type="button">${n.done ? 'Aç' : 'Kapat'}</button>
          <button class="icon-btn" data-del-need="${n.id}" type="button">×</button>
        </td>
      </tr>`;
  }).join('');
}

$('needForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentUser) return Modal.open('loginModal');
  const fd = new FormData(e.target);
  const payload = {
    item: fd.get('item'), dept: fd.get('dept'),
    qty: Number(fd.get('qty')), cost: Number(fd.get('cost') || 0),
    priority: fd.get('priority'), reason: fd.get('reason'),
    created_by: currentUser.id
  };
  const { data, error: e2 } = await sb.from('needs').insert([payload]).select();
  if (e2) return showToast(e2.message, 'error');
  e.target.reset();
  showToast('Talep oluşturuldu.');
  logAction('create', 'needs', data?.[0]?.id, { item: payload.item });
});

$('needsTable').addEventListener('click', async (e) => {
  const t = e.target.dataset.toggleNeed;
  const d = e.target.dataset.delNeed;
  if (t) {
    const cur = e.target.dataset.current === 'true';
    await sb.from('needs').update({ done: !cur }).eq('id', t);
    logAction('update', 'needs', t, { done: !cur });
  }
  if (d) {
    const ok = await customConfirm('Bu talep silinsin mi?');
    if (ok) {
      await sb.from('needs').delete().eq('id', d);
      logAction('delete', 'needs', d, {});
    }
  }
});

/* ============================================================
   FLIGHTS
   ============================================================ */
let _flights = [];
async function loadFlights() {
  const { data, error: e } = await sb.from('flights').select('*')
    .order('flight_date', { ascending: false }).order('flight_time', { ascending: false });
  if (e) { warn(e); return; }
  _flights = data || [];
  renderFlights();
  populateFlightSelects();
}

function populateFlightSelects() {
  // notes ve telemetry dropdownları için
  ['noteFlightSelect', 'telemetryFlightSelect'].forEach(id => {
    const sel = $(id);
    if (!sel) return;
    const cur = sel.value;
    const placeholder = id === 'telemetryFlightSelect' ? '—' : '— Bağımsız not —';
    sel.innerHTML = `<option value="">${placeholder}</option>` +
      _flights.map(f =>
        `<option value="${f.id}">${fmtDate(f.flight_date)} · ${escapeHtml(f.aircraft)} · ${f.flight_time.slice(0,5)}</option>`
      ).join('');
    sel.value = cur;
  });
}

function renderFlights() {
  const now = new Date();
  const upcoming = _flights.filter(f => new Date(f.flight_date + 'T' + f.flight_time) >= now)
                          .sort((a,b) => new Date(a.flight_date+'T'+a.flight_time) - new Date(b.flight_date+'T'+b.flight_time));
  const past     = _flights.filter(f => new Date(f.flight_date + 'T' + f.flight_time) < now);

  $('upcomingCount').textContent = upcoming.length;
  $('pastCount').textContent = past.length;

  const buildItem = (f, isPast) => {
    const d = new Date(f.flight_date);
    return `
      <div class="flight-item${isPast ? ' is-past' : ''}">
        <div class="flight-date">
          ${d.getDate()}
          <span class="flight-date__m">${d.toLocaleDateString('tr-TR',{month:'short'}).toUpperCase()}</span>
        </div>
        <div class="flight-info">
          <strong>${escapeHtml(f.aircraft)} · ${f.flight_time.slice(0,5)}</strong>
          ${escapeHtml(f.mission || '')}
          <small>${escapeHtml(f.location || '')} · Pilot: ${escapeHtml(f.pilot || '—')}${f.duration ? ` · ${f.duration} dk` : ''}</small>
        </div>
        <div class="flight-actions">
          <button class="icon-btn" data-del-flight="${f.id}" type="button">×</button>
        </div>
      </div>`;
  };

  $('upcomingFlights').innerHTML = upcoming.length
    ? upcoming.map(f => buildItem(f, false)).join('')
    : '<div style="text-align:center;padding:30px;color:var(--ink-3);font-style:italic;">Planlanmış uçuş yok.</div>';

  $('pastFlights').innerHTML = past.length
    ? past.slice(0, 20).map(f => buildItem(f, true)).join('')
    : '<div style="text-align:center;padding:30px;color:var(--ink-3);font-style:italic;">Geçmiş uçuş kaydı yok.</div>';
}

$('flightForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentUser) return Modal.open('loginModal');
  const fd = new FormData(e.target);
  const payload = {
    flight_date: fd.get('date'), flight_time: fd.get('time'),
    aircraft: fd.get('aircraft'), pilot: fd.get('pilot'),
    location: fd.get('location'),
    duration: fd.get('duration') ? Number(fd.get('duration')) : null,
    mission: fd.get('mission'),
    created_by: currentUser.id
  };
  const { data, error: e2 } = await sb.from('flights').insert([payload]).select();
  if (e2) return showToast(e2.message, 'error');
  e.target.reset();
  showToast('Uçuş planlandı.');
  logAction('create', 'flights', data?.[0]?.id, { aircraft: payload.aircraft, date: payload.flight_date });
});

document.addEventListener('click', async (e) => {
  const id = e.target.dataset.delFlight;
  if (!id) return;
  const ok = await customConfirm('Bu uçuş kaydı silinsin mi?');
  if (ok) {
    await sb.from('flights').delete().eq('id', id);
    logAction('delete', 'flights', id, {});
  }
});

/* ============================================================
   NOTES
   ============================================================ */
let _notes = [];
const NOTE_TYPE = { observation:'GÖZLEM', issue:'SORUN', improvement:'İYİLEŞTİRME', success:'BAŞARI' };

async function loadNotes() {
  if (!isAdmin() && !['yazilim','yapisal','kompozit','aviyonik'].includes(myDept())) {
    _notes = []; renderNotes(); return;
  }
  const { data, error: e } = await sb.from('notes').select('*').order('created_at', { ascending: false });
  if (e) { warn(e); return; }
  _notes = data || [];
  renderNotes();
}

function renderNotes() {
  $('notesCount').textContent = _notes.length;
  const dom = $('notesList');
  if (_notes.length === 0) {
    dom.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--ink-3);font-style:italic;">Henüz not yok.</div>';
    return;
  }
  dom.innerHTML = _notes.map(n => {
    const f = _flights.find(x => x.id === n.flight_id);
    const flightLabel = f ? `${fmtDate(f.flight_date)} · ${f.aircraft}` : 'Bağımsız';
    return `
      <div class="note note--${n.note_type}">
        <div class="note__head">
          <span class="note__type">${NOTE_TYPE[n.note_type] || n.note_type}</span>
          <span>${new Date(n.created_at).toLocaleDateString('tr-TR')}</span>
        </div>
        <div class="note__text">${escapeHtml(n.text)}</div>
        <div class="note__foot">
          <span>✈ ${escapeHtml(flightLabel)}</span>
          <button class="icon-btn" data-del-note="${n.id}" type="button">×</button>
        </div>
      </div>`;
  }).join('');
}

$('noteForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentUser) return Modal.open('loginModal');
  const fd = new FormData(e.target);
  const payload = {
    flight_id: fd.get('flightId') || null,
    note_type: fd.get('type'),
    severity: fd.get('severity'),
    text: fd.get('text'),
    created_by: currentUser.id
  };
  const { data, error: e2 } = await sb.from('notes').insert([payload]).select();
  if (e2) return showToast(e2.message, 'error');
  e.target.reset();
  showToast('Not kaydedildi.');
  logAction('create', 'notes', data?.[0]?.id, { type: payload.note_type });
});

$('notesList').addEventListener('click', async (e) => {
  const id = e.target.dataset.delNote;
  if (!id) return;
  const ok = await customConfirm('Bu not silinsin mi?');
  if (ok) {
    await sb.from('notes').delete().eq('id', id);
    logAction('delete', 'notes', id, {});
  }
});

/* ============================================================
   PARTS — 3D CAD
   ============================================================ */
let _parts = [];
let _selectedPartId = null;

const VIEWABLE_EXTS = ['stl', 'obj', 'glb', 'gltf'];

async function loadParts() {
  if (!isAdmin() && !['yazilim','yapisal','kompozit','aviyonik','medya'].includes(myDept())) {
    _parts = []; renderParts(); return;
  }
  const { data, error: e } = await sb.from('parts').select('*').order('created_at', { ascending: false });
  if (e) { warn(e); return; }
  _parts = data || [];
  renderParts();
}

function renderParts() {
  const q = ($('partSearch').value || '').toLowerCase();
  const dept = $('partFilterDept').value;
  const ac = $('partFilterAircraft').value;
  const onlyView = $('partOnlyViewable').checked;

  const filtered = _parts.filter(p => {
    if (q && !p.name.toLowerCase().includes(q) && !(p.description || '').toLowerCase().includes(q)) return false;
    if (dept && p.dept !== dept) return false;
    if (ac && p.aircraft !== ac) return false;
    if (onlyView && !p.is_viewable) return false;
    return true;
  });

  $('partsCount').textContent = `${filtered.length} parça`;
  const dom = $('partsList');
  if (filtered.length === 0) {
    dom.innerHTML = '<div style="text-align:center;padding:40px;color:var(--ink-3);font-family:var(--font-mono);font-size:11px;letter-spacing:1px;">PARÇA BULUNAMADI</div>';
    return;
  }

  // Medya → sadece okuma; silme butonu yok
  const canDelete = isAdmin() || ['yazilim','yapisal','kompozit','aviyonik'].includes(myDept());

  dom.innerHTML = filtered.map(p => {
    const sizeMb = p.file_size ? (p.file_size / 1048576).toFixed(2) + ' MB' : '—';
    return `
      <div class="part-item ${p.is_viewable ? 'is-viewable' : ''} ${p.id === _selectedPartId ? 'is-selected' : ''}"
           data-part-id="${p.id}">
        <div class="part-item__head">
          <div class="part-item__name">${escapeHtml(p.name)}</div>
          <span class="part-item__ext">${escapeHtml(p.file_ext)}</span>
        </div>
        <div class="part-item__meta">
          ${p.aircraft ? `<span>✈ ${escapeHtml(p.aircraft)}</span>` : ''}
          ${p.dept ? `<span>${escapeHtml(DEPT_LABELS[p.dept] || p.dept)}</span>` : ''}
          ${p.version ? `<span>${escapeHtml(p.version)}</span>` : ''}
        </div>
        ${p.description ? `<div class="part-item__desc">${escapeHtml(p.description)}</div>` : ''}
        <div class="part-item__foot">
          <span>${sizeMb} · ${fmtDate(p.created_at)}</span>
          <div class="part-item__actions">
            <button class="icon-btn" data-download-part="${p.id}" title="İndir" type="button">↓</button>
            ${canDelete ? `<button class="icon-btn" data-del-part="${p.id}" title="Sil" type="button">×</button>` : ''}
          </div>
        </div>
      </div>`;
  }).join('');
}

function safeUUID() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

$('partForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentUser) return Modal.open('loginModal');

  const fd = new FormData(e.target);
  const file = $('partFile').files[0];
  if (!file) return showToast('Dosya seçilmedi', 'error');

  const ext = file.name.split('.').pop().toLowerCase();
  const isViewable = VIEWABLE_EXTS.includes(ext);
  const fileId = safeUUID();
  const storagePath = `parts/${fileId}.${ext}`;

  const submitBtn = $('partSubmit');
  const spinner = submitBtn.querySelector('.btn__spinner');
  const label = submitBtn.querySelector('.btn__label');
  const progressBox = $('uploadProgress');
  const progressBar = $('uploadProgressBar');
  const progressText = $('uploadProgressText');

  submitBtn.disabled = true; spinner.hidden = false; label.textContent = 'Yükleniyor';
  progressBox.hidden = false;
  progressBar.style.width = '0%';
  progressText.textContent = '0%';

  let progressInterval = null;

  try {
    let progress = 0;
    progressInterval = setInterval(() => {
      progress = Math.min(90, progress + Math.random() * 15);
      progressBar.style.width = progress + '%';
      progressText.textContent = Math.round(progress) + '%';
    }, 400);

    const { error: upErr } = await sb.storage.from('parts').upload(storagePath, file, {
      cacheControl: '3600',
      upsert: false
    });

    if (upErr) throw upErr;

    progressBar.style.width = '100%';
    progressText.textContent = '100%';

    const payload = {
      name: fd.get('name'),
      dept: fd.get('dept'),
      aircraft: fd.get('aircraft'),
      version: fd.get('version') || 'v1',
      description: fd.get('description'),
      file_path: storagePath,
      file_name: file.name,
      file_ext: ext,
      file_size: file.size,
      is_viewable: isViewable,
      created_by: currentUser.id
    };
    const { data: insertedData, error: dbErr } = await sb.from('parts').insert([payload]).select();

    if (dbErr) {
      await sb.storage.from('parts').remove([storagePath]);
      throw dbErr;
    }

    e.target.reset();
    $('fileHint').textContent = 'STL, OBJ, GLB tercih edilir (max 100 MB)';
    $('fileHint').style.color = '';
    setTimeout(() => { progressBox.hidden = true; }, 600);
    showToast(`Parça yüklendi${isViewable ? ' — 3D olarak görüntülenebilir' : ''}`);
    logAction('create', 'parts', insertedData?.[0]?.id, { name: payload.name, ext });

    await loadParts();

  } catch (ex) {
    err('Upload failed:', ex);
    showToast('Yükleme hatası: ' + (ex?.message || 'Bilinmeyen hata'), 'error');
    progressBox.hidden = true;
  } finally {
    if (progressInterval) clearInterval(progressInterval);
    submitBtn.disabled = false;
    spinner.hidden = true;
    label.textContent = 'Yükle';
  }
});

$('partFile').addEventListener('change', (e) => {
  const f = e.target.files[0];
  const hint = $('fileHint');
  if (!f) {
    hint.textContent = 'STL, OBJ, GLB tercih edilir (max 100 MB)';
    hint.style.color = '';
    return;
  }
  const ext = f.name.split('.').pop().toLowerCase();
  const sizeMb = (f.size / 1048576).toFixed(1);
  if (f.size > 100 * 1048576) {
    hint.textContent = `⚠ Dosya çok büyük (${sizeMb} MB) — max 100 MB`;
    hint.style.color = 'var(--bad)';
    return;
  }
  if (VIEWABLE_EXTS.includes(ext)) {
    hint.textContent = `✓ ${ext.toUpperCase()} · ${sizeMb} MB · 3D görüntülenebilir`;
    hint.style.color = 'var(--ok)';
  } else {
    hint.textContent = `${ext.toUpperCase()} · ${sizeMb} MB · 3D görüntülenemez (sadece indirme)`;
    hint.style.color = 'var(--warn)';
  }
});

$('partsList').addEventListener('click', async (e) => {
  const delId = e.target.dataset.delPart;
  if (delId) {
    e.stopPropagation();
    const ok = await customConfirm('Bu parça ve dosyası silinsin mi?');
    if (!ok) return;
    const part = _parts.find(p => p.id === delId);
    if (part) {
      await sb.storage.from('parts').remove([part.file_path]);
      await sb.from('parts').delete().eq('id', delId);
      logAction('delete', 'parts', delId, { name: part.name });
      if (_selectedPartId === delId) {
        _selectedPartId = null;
        window.dispatchEvent(new CustomEvent('clear-viewer'));
      }
    }
    return;
  }

  const dlId = e.target.dataset.downloadPart;
  if (dlId) {
    e.stopPropagation();
    const part = _parts.find(p => p.id === dlId);
    if (!part) return;
    const validity = Math.max(120, Math.ceil((part.file_size || 0) / 1048576 * 15));
    const { data, error: e2 } = await sb.storage.from('parts').createSignedUrl(part.file_path, validity);
    if (e2) return showToast('İndirme linki oluşturulamadı', 'error');
    const a = document.createElement('a');
    a.href = data.signedUrl;
    a.download = part.file_name;
    document.body.appendChild(a); a.click(); a.remove();
    return;
  }

  const card = e.target.closest('.part-item');
  if (!card) return;
  const id = card.dataset.partId;
  const part = _parts.find(p => p.id === id);
  if (!part) return;

  _selectedPartId = id;
  document.querySelectorAll('.part-item').forEach(el => {
    el.classList.toggle('is-selected', el.dataset.partId === id);
  });

  window.dispatchEvent(new CustomEvent('load-part', { detail: part }));
});

['partSearch', 'partFilterDept', 'partFilterAircraft', 'partOnlyViewable'].forEach(id => {
  $(id).addEventListener('input', renderParts);
});

window._getPartUrl = async function(filePath) {
  const { data, error: e } = await sb.storage.from('parts').createSignedUrl(filePath, 600);
  if (e) throw e;
  return data.signedUrl;
};

/* ============================================================
   GÖREVLER (KANBAN)
   ============================================================ */
let _tasks = [];
const DEPT_TASK_LABEL = { yazilim: 'Yazılım', yapisal: 'Yapısal', aviyonik: 'Aviyonik', kompozit: 'Kompozit', medya: 'Medya', sponsorluk: 'Sponsorluk', ortak: 'Ortak' };

async function loadTasks() {
  // RLS zaten filtreliyor (sadece kendi departmanını görür) — frontend bonus check yok
  const { data, error } = await sb.from('tasks').select('*').order('status').order('position').order('created_at');
  if (error) { warn('[tasks] load error:', error); return; }
  _tasks = data || [];
  renderTasks();
}

function renderTasks() {
  const q = ($('taskSearch').value || '').toLowerCase();
  const dept = $('taskFilterDept').value;
  const onlyMine = $('taskOnlyMine').checked;
  const myName = (currentProfile?.full_name || currentUser?.user_metadata?.full_name || currentUser?.email?.split('@')[0] || '').toLowerCase();

  const filtered = _tasks.filter(t => {
    if (q && !(`${t.title} ${t.assignee || ''} ${t.description || ''}`.toLowerCase().includes(q))) return false;
    if (dept && t.dept !== dept) return false;
    if (onlyMine && myName && !(t.assignee || '').toLowerCase().includes(myName)) return false;
    return true;
  });

  $('tasksCount').textContent = `${filtered.length} görev`;

  ['todo', 'doing', 'review', 'done'].forEach(status => {
    const list = document.querySelector(`[data-drop="${status}"]`);
    if(!list) return;
    const items = filtered.filter(t => t.status === status).sort((a,b) => (a.position || 0) - (b.position || 0));
    document.querySelector(`[data-count="${status}"]`).textContent = items.length;
    list.innerHTML = items.map(taskCardHtml).join('');
  });
}

function taskCardHtml(t) {
  const initial = t.assignee ? t.assignee.trim().charAt(0).toUpperCase() : '?';
  const deadlineHtml = renderTaskDeadline(t.deadline);
  const prioChipClass = (t.priority === 'critical' || t.priority === 'high') ? `task-card__chip task-card__chip--prio-${t.priority}` : 'task-card__chip';
  const prioLabel = { critical: 'KRİTİK', high: 'YÜKSEK', medium: 'ORTA', low: 'DÜŞÜK' }[t.priority] || t.priority;

  return `
    <div class="task-card" draggable="true" data-task-id="${t.id}" data-priority="${t.priority || 'medium'}">
      <div class="task-card__actions">
        <button class="icon-btn" data-del-task="${t.id}" title="Sil" type="button">×</button>
      </div>
      <div class="task-card__title">${escapeHtml(t.title)}</div>
      <div class="task-card__meta">
        <span class="task-card__chip task-card__chip--dept">${escapeHtml(DEPT_TASK_LABEL[t.dept] || t.dept)}</span>
        ${(t.priority === 'critical' || t.priority === 'high') ? `<span class="${prioChipClass}">${prioLabel}</span>` : ''}
      </div>
      ${t.description ? `<div class="task-card__desc">${escapeHtml(t.description)}</div>` : ''}
      <div class="task-card__foot">
        <span class="task-card__assignee" data-initial="${escapeHtml(initial)}">${escapeHtml(t.assignee || 'Atanmamış')}</span>
        ${deadlineHtml}
      </div>
    </div>`;
}

function renderTaskDeadline(d) {
  if (!d) return '<span class="task-card__deadline">—</span>';
  const date = new Date(d);
  const today = new Date(); today.setHours(0,0,0,0);
  const diffDays = Math.round((date - today) / 86400000);
  let cls = 'task-card__deadline';
  let text = date.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' });
  if (diffDays < 0) { cls += ' is-overdue'; text = `⚠ ${Math.abs(diffDays)}g geçti`; }
  else if (diffDays === 0) { cls += ' is-soon'; text = 'BUGÜN'; }
  else if (diffDays <= 3) { cls += ' is-soon'; text = `${diffDays}g kaldı · ${text}`; }
  return `<span class="${cls}">${text}</span>`;
}

$('taskForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentUser) return Modal.open('loginModal');

  const fd = new FormData(e.target);
  const status = fd.get('status') || 'todo';
  const maxPos = _tasks.filter(t => t.status === status).reduce((m, t) => Math.max(m, t.position || 0), 0);

  const payload = {
    title: fd.get('title'),
    description: fd.get('description') || null,
    dept: fd.get('dept'),
    assignee: fd.get('assignee') || null,
    deadline: fd.get('deadline') || null,
    priority: fd.get('priority') || 'medium',
    status: status,
    position: maxPos + 1,
    created_by: currentUser.id
  };
  const { data, error } = await sb.from('tasks').insert([payload]).select();

  if (error) return showToast('Görev oluşturulamadı: ' + error.message, 'error');
  e.target.reset();
  showToast('Görev oluşturuldu');
  logAction('create', 'tasks', data?.[0]?.id, { title: payload.title, dept: payload.dept });
  loadTasks();
});

$('kanbanBoard')?.addEventListener('click', async (e) => {
  const delId = e.target.dataset.delTask;
  if (delId) {
    e.stopPropagation();
    const ok = await customConfirm('Bu görev silinsin mi?');
    if (ok) {
       const { error } = await sb.from('tasks').delete().eq('id', delId);
       if (error) showToast('Silinemedi: ' + error.message, 'error');
       else logAction('delete', 'tasks', delId, {});
    }
  }
});

['taskSearch', 'taskFilterDept', 'taskOnlyMine'].forEach(id => {
  $(id)?.addEventListener('input', renderTasks);
});

// Sürükle-bırak
function bindDragDrop() {
  const board = $('kanbanBoard');
  if(!board) return;

  board.addEventListener('dragstart', (e) => {
    const card = e.target.closest('.task-card');
    if (!card) return;
    card.classList.add('is-dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', card.dataset.taskId);
  });

  board.addEventListener('dragend', (e) => {
    const card = e.target.closest('.task-card');
    if (card) card.classList.remove('is-dragging');
    document.querySelectorAll('.kanban__list').forEach(l => l.classList.remove('is-drop-target'));
  });

  document.querySelectorAll('.kanban__list').forEach(list => {
    list.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      list.classList.add('is-drop-target');
    });
    list.addEventListener('dragleave', (e) => {
      if (!list.contains(e.relatedTarget)) list.classList.remove('is-drop-target');
    });
    list.addEventListener('drop', async (e) => {
      e.preventDefault();
      list.classList.remove('is-drop-target');
      const taskId = e.dataTransfer.getData('text/plain');
      const newStatus = list.dataset.drop;
      if (!taskId || !newStatus) return;
      const task = _tasks.find(t => t.id === taskId);
      if (!task || task.status === newStatus) return;

      task.status = newStatus;
      renderTasks();

      const maxPos = _tasks.filter(t => t.status === newStatus).reduce((m, t) => Math.max(m, t.position || 0), 0);
      const { error } = await sb.from('tasks').update({ status: newStatus, position: maxPos + 1 }).eq('id', taskId);
      if (error) {
        showToast('Güncellenemedi: ' + error.message, 'error');
        loadTasks();
      } else {
        logAction('update', 'tasks', taskId, { status: newStatus });
      }
    });
  });
}

/* ============================================================
   TELEMETRY (YENİ — Yazılım + Aviyonik)
   ============================================================ */
let _telemetry = [];

async function loadTelemetry() {
  if (!isAdmin() && !['yazilim','aviyonik'].includes(myDept())) {
    _telemetry = []; renderTelemetry(); return;
  }
  const { data, error: e } = await sb.from('telemetry').select('*').order('created_at', { ascending: false });
  if (e) { warn(e); return; }
  _telemetry = data || [];
  renderTelemetry();
}

const TELEMETRY_CAT = {
  endpoint: 'API ENDPOINT', log: 'TELEMETRİ LOG',
  dashboard: 'DASHBOARD', docs: 'DOKÜMAN'
};

function renderTelemetry() {
  const cat = $('telemetryFilterCategory')?.value || '';
  const filtered = _telemetry.filter(t => !cat || t.category === cat);
  $('telemetryCount').textContent = filtered.length;

  const dom = $('telemetryList');
  if (!dom) return;
  if (filtered.length === 0) {
    dom.innerHTML = '<div style="text-align:center;padding:40px;color:var(--ink-3);font-style:italic;">Kayıt yok.</div>';
    return;
  }

  dom.innerHTML = filtered.map(t => {
    const f = _flights.find(x => x.id === t.flight_id);
    return `<div style="border:1px solid var(--line); border-radius: 6px; padding: 14px; margin-bottom: 10px; background: var(--bg-2);">
      <div style="display:flex; justify-content:space-between; align-items:center; gap: 10px; margin-bottom: 8px;">
        <strong style="font-size: 14px;">${escapeHtml(t.title)}</strong>
        <span class="badge badge--info">${TELEMETRY_CAT[t.category] || t.category}</span>
      </div>
      ${t.payload ? `<pre style="background: var(--bg-3); padding: 10px; border-radius: 4px; font-family: var(--font-mono); font-size: 11px; overflow-x: auto; margin: 8px 0; max-height: 300px;">${escapeHtml(t.payload)}</pre>` : ''}
      <div style="display:flex; justify-content:space-between; font-size: 11px; color: var(--ink-3); font-family: var(--font-mono);">
        <span>${f ? `✈ ${escapeHtml(f.aircraft)} · ${fmtDate(f.flight_date)}` : 'Bağımsız'}</span>
        <span>${fmtDateTime(t.created_at)} · <button class="icon-btn" data-del-tel="${t.id}" type="button">×</button></span>
      </div>
    </div>`;
  }).join('');
}

$('telemetryForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentUser) return Modal.open('loginModal');
  const fd = new FormData(e.target);
  const payload = {
    title: fd.get('title'),
    category: fd.get('category'),
    payload: fd.get('payload'),
    flight_id: fd.get('flightId') || null,
    created_by: currentUser.id
  };
  const { data, error: e2 } = await sb.from('telemetry').insert([payload]).select();
  if (e2) return showToast(e2.message, 'error');
  e.target.reset();
  showToast('Telemetri kaydedildi.');
  logAction('create', 'telemetry', data?.[0]?.id, { title: payload.title });
});

$('telemetryFilterCategory')?.addEventListener('input', renderTelemetry);

$('telemetryList')?.addEventListener('click', async (e) => {
  const id = e.target.dataset.delTel;
  if (!id) return;
  const ok = await customConfirm('Bu telemetri kaydı silinsin mi?');
  if (ok) {
    await sb.from('telemetry').delete().eq('id', id);
    logAction('delete', 'telemetry', id, {});
  }
});

/* ============================================================
   MEDIA ASSETS (YENİ — Sponsorluk + Medya)
   ============================================================ */
let _media = [];

async function loadMedia() {
  if (!isAdmin() && !['sponsorluk','medya'].includes(myDept())) {
    _media = []; renderMedia(); return;
  }
  const { data, error: e } = await sb.from('media_assets').select('*').order('created_at', { ascending: false });
  if (e) { warn(e); return; }
  _media = data || [];
  renderMedia();
}

const MEDIA_CAT = {
  logo: 'Logo', sunum: 'Sunum', foto: 'Fotoğraf', video: 'Video',
  sablon: 'Şablon', sozlesme: 'Sözleşme', diger: 'Diğer'
};

function renderMedia() {
  const cat = $('mediaFilterCategory')?.value || '';
  const filtered = _media.filter(m => !cat || m.category === cat);
  $('mediaCount').textContent = filtered.length;

  const dom = $('mediaList');
  if (!dom) return;
  if (filtered.length === 0) {
    dom.innerHTML = '<div style="text-align:center;padding:40px;color:var(--ink-3);font-style:italic;">Materyal yok.</div>';
    return;
  }

  dom.innerHTML = filtered.map(m => {
    const sizeMb = m.file_size ? (m.file_size / 1048576).toFixed(2) + ' MB' : '';
    const hasFile = !!m.file_path, hasUrl = !!m.external_url;
    return `<div class="part-item">
      <div class="part-item__head">
        <div class="part-item__name">${escapeHtml(m.title)}</div>
        <span class="part-item__ext">${escapeHtml(MEDIA_CAT[m.category] || m.category)}</span>
      </div>
      ${m.description ? `<div class="part-item__desc">${escapeHtml(m.description)}</div>` : ''}
      <div class="part-item__foot">
        <span>${sizeMb || (hasUrl ? '🔗 Harici Link' : '—')} · ${fmtDate(m.created_at)}</span>
        <div class="part-item__actions">
          ${hasFile ? `<button class="icon-btn" data-dl-media="${m.id}" title="İndir" type="button">↓</button>` : ''}
          ${hasUrl ? `<button class="icon-btn" data-open-media="${m.id}" title="Aç" type="button">↗</button>` : ''}
          <button class="icon-btn" data-del-media="${m.id}" title="Sil" type="button">×</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

$('mediaForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentUser) return Modal.open('loginModal');
  const fd = new FormData(e.target);
  const file = $('mediaFile').files[0];
  const url = fd.get('external_url');
  if (!file && !url) return showToast('Dosya veya link gerekli', 'error');

  const submitBtn = $('mediaSubmit');
  const spinner = submitBtn.querySelector('.btn__spinner');
  const label = submitBtn.querySelector('.btn__label');
  submitBtn.disabled = true; spinner.hidden = false; label.textContent = 'Yükleniyor';

  try {
    let storagePath = null, fileName = null, fileExt = null, fileSize = null;
    if (file) {
      if (file.size > 50 * 1048576) throw new Error('Dosya çok büyük (max 50 MB)');
      fileExt = file.name.split('.').pop().toLowerCase();
      storagePath = `media/${safeUUID()}.${fileExt}`;
      fileName = file.name; fileSize = file.size;
      const { error: upErr } = await sb.storage.from('media').upload(storagePath, file, { upsert: false });
      if (upErr) throw upErr;
    }
    const payload = {
      title: fd.get('title'),
      category: fd.get('category'),
      description: fd.get('description'),
      external_url: url || null,
      file_path: storagePath, file_name: fileName, file_ext: fileExt, file_size: fileSize,
      created_by: currentUser.id
    };
    const { data, error: dbErr } = await sb.from('media_assets').insert([payload]).select();
    if (dbErr) {
      if (storagePath) await sb.storage.from('media').remove([storagePath]);
      throw dbErr;
    }
    e.target.reset();
    showToast('Materyal eklendi.');
    logAction('create', 'media_assets', data?.[0]?.id, { title: payload.title });
    await loadMedia();
  } catch (ex) {
    showToast('Hata: ' + (ex.message || ex), 'error');
  } finally {
    submitBtn.disabled = false; spinner.hidden = true; label.textContent = 'Yükle';
  }
});

$('mediaFilterCategory')?.addEventListener('input', renderMedia);

$('mediaList')?.addEventListener('click', async (e) => {
  const dlId = e.target.dataset.dlMedia;
  if (dlId) {
    const m = _media.find(x => x.id === dlId);
    if (!m?.file_path) return;
    const { data, error: e2 } = await sb.storage.from('media').createSignedUrl(m.file_path, 300);
    if (e2) return showToast('İndirme hatası', 'error');
    const a = document.createElement('a');
    a.href = data.signedUrl; a.download = m.file_name || 'dosya';
    document.body.appendChild(a); a.click(); a.remove();
    return;
  }
  const openId = e.target.dataset.openMedia;
  if (openId) {
    const m = _media.find(x => x.id === openId);
    if (m?.external_url) window.open(m.external_url, '_blank', 'noopener');
    return;
  }
  const delId = e.target.dataset.delMedia;
  if (delId) {
    const ok = await customConfirm('Bu materyal silinsin mi?');
    if (!ok) return;
    const m = _media.find(x => x.id === delId);
    if (m?.file_path) await sb.storage.from('media').remove([m.file_path]);
    await sb.from('media_assets').delete().eq('id', delId);
    logAction('delete', 'media_assets', delId, {});
  }
});

/* ============================================================
   USER MANAGEMENT (YENİ — Sadece Admin)
   ============================================================ */
let _users = [];

async function loadUserManagement() {
  if (!isAdmin()) return;
  const { data, error: e } = await sb.from('profiles').select('*').order('created_at', { ascending: false });
  if (e) { warn('users load:', e); return; }
  _users = data || [];
  renderUsers();
}

function renderUsers() {
  const q = ($('userSearch')?.value || '').toLowerCase();
  const filtered = _users.filter(u => {
    if (!q) return true;
    return (u.full_name || '').toLowerCase().includes(q)
      || (u.email || '').toLowerCase().includes(q)
      || (u.username || '').toLowerCase().includes(q)
      || (u.department || '').toLowerCase().includes(q);
  });

  $('usersCount').textContent = `${filtered.length} üye`;
  const tbody = $('userManagementTable');
  if (!tbody) return;
  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty">Üye bulunamadı.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(u => {
    const isMe = u.id === currentUser?.id;
    return `<tr ${isMe ? 'style="background: var(--accent-soft);"' : ''}>
      <td>
        <strong>${escapeHtml(u.full_name || '(İsim yok)')}</strong>
        ${isMe ? '<small style="color:var(--accent);"> · sen</small>' : ''}
        <br><small style="color:var(--ink-3);">@${escapeHtml(u.username || '?')}</small>
      </td>
      <td><small>${escapeHtml(u.email || '—')}</small></td>
      <td>
        <select data-user-update="department" data-user-id="${u.id}">
          <option value="">— Atanmamış —</option>
          <option value="yazilim" ${u.department === 'yazilim' ? 'selected' : ''}>Yazılım</option>
          <option value="yapisal" ${u.department === 'yapisal' ? 'selected' : ''}>Yapısal</option>
          <option value="aviyonik" ${u.department === 'aviyonik' ? 'selected' : ''}>Aviyonik</option>
          <option value="kompozit" ${u.department === 'kompozit' ? 'selected' : ''}>Kompozit</option>
          <option value="sponsorluk" ${u.department === 'sponsorluk' ? 'selected' : ''}>Sponsorluk</option>
          <option value="medya" ${u.department === 'medya' ? 'selected' : ''}>Medya</option>
        </select>
      </td>
      <td>
        <select data-user-update="role" data-user-id="${u.id}" ${isMe ? 'disabled title="Kendi rolünü değiştiremezsin"' : ''}>
          <option value="member" ${u.role === 'member' ? 'selected' : ''}>Üye</option>
          <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Kaptan (Admin)</option>
        </select>
      </td>
      <td><small>${u.last_seen ? fmtDateTime(u.last_seen) : '—'}</small></td>
      <td>
        ${!isMe ? `<button class="icon-btn" data-del-user="${u.id}" data-name="${escapeHtml(u.full_name || u.username)}" type="button" title="Üyeyi sil">×</button>` : ''}
      </td>
    </tr>`;
  }).join('');
}

$('userSearch')?.addEventListener('input', renderUsers);

$('userManagementTable')?.addEventListener('change', async (e) => {
  const field = e.target.dataset.userUpdate;
  const userId = e.target.dataset.userId;
  if (!field || !userId) return;
  const value = e.target.value;
  const { error: e2 } = await sb.from('profiles').update({ [field]: value }).eq('id', userId);
  if (e2) {
    showToast('Güncellenemedi: ' + e2.message, 'error');
    await loadUserManagement();
    return;
  }
  showToast(`${field === 'role' ? 'Rol' : 'Departman'} güncellendi`);
  logAction('update', 'profiles', userId, { [field]: value });
});

$('userManagementTable')?.addEventListener('click', async (e) => {
  const userId = e.target.dataset.delUser;
  if (!userId) return;
  const name = e.target.dataset.name;
  const ok = await customConfirm(
    `"${name}" üyesini silmek üzeresin. Profili silinecek AMA Supabase Auth kaydı kalacak (Dashboard'dan elle sil). Devam?`,
    'Üye Silme'
  );
  if (!ok) return;
  const { error: e2 } = await sb.from('profiles').delete().eq('id', userId);
  if (e2) return showToast(e2.message, 'error');
  showToast('Üye profili silindi.');
  logAction('delete', 'profiles', userId, { name });
  await loadUserManagement();
});

/* ============================================================
   AUDIT LOG VIEWER
   ============================================================ */
let _audit = [];

async function loadAuditLog() {
  if (!isAdmin()) return;
  const tableFilter = $('auditFilterTable')?.value || '';
  const actionFilter = $('auditFilterAction')?.value || '';

  let q = sb.from('audit_log').select('*').order('created_at', { ascending: false }).limit(200);
  if (tableFilter)  q = q.eq('table_name', tableFilter);
  if (actionFilter) q = q.eq('action', actionFilter);

  const { data, error: e } = await q;
  if (e) { warn('audit load:', e); return; }
  _audit = data || [];
  renderAudit();
}

const ACTION_LABEL = { create: 'Oluşturma', update: 'Güncelleme', delete: 'Silme', login: 'Giriş' };
const ACTION_BADGE = { create: 'ok', update: 'info', delete: 'bad', login: 'accent' };

function renderAudit() {
  $('auditCount').textContent = `${_audit.length} kayıt`;
  const tbody = $('auditTable');
  if (!tbody) return;
  if (_audit.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty">Kayıt yok.</td></tr>';
    return;
  }
  tbody.innerHTML = _audit.map(a => {
    const detailsStr = a.details && Object.keys(a.details).length
      ? Object.entries(a.details).map(([k,v]) => `<code>${escapeHtml(k)}=${escapeHtml(String(v).slice(0, 40))}</code>`).join(' ')
      : '—';
    return `<tr>
      <td><small>${fmtDateTime(a.created_at)}</small></td>
      <td>
        <strong>${escapeHtml(a.user_name || '?')}</strong>
        ${a.user_dept ? `<br><small style="color:var(--ink-3);">${escapeHtml(a.user_dept)}</small>` : ''}
      </td>
      <td><span class="badge badge--${ACTION_BADGE[a.action] || 'info'}">${ACTION_LABEL[a.action] || a.action}</span></td>
      <td><code>${escapeHtml(a.table_name || '—')}</code></td>
      <td style="font-size: 11px;">${detailsStr}</td>
    </tr>`;
  }).join('');
}

$('auditFilterTable')?.addEventListener('input', loadAuditLog);
$('auditFilterAction')?.addEventListener('input', loadAuditLog);

/* ============================================================
   REALTIME
   ============================================================ */
let realtimeChannels = [];

function setupRealtime() {
  teardownRealtime();
  setConnStatus('warn', 'Canlı bağlantı kuruluyor...');

  const tables = [
    { name: 'stock',        reload: loadStock },
    { name: 'sponsors',     reload: loadSponsorship },
    { name: 'allocations',  reload: loadSponsorship },
    { name: 'needs',        reload: loadNeeds },
    { name: 'flights',      reload: () => loadFlights().then(loadNotes) },
    { name: 'notes',        reload: loadNotes },
    { name: 'parts',        reload: loadParts },
    { name: 'tasks',        reload: loadTasks },
    { name: 'telemetry',    reload: loadTelemetry },
    { name: 'media_assets', reload: loadMedia },
    { name: 'profiles',     reload: () => isAdmin() && loadUserManagement() },
    { name: 'audit_log',    reload: () => isAdmin() && loadAuditLog() }
  ];

  tables.forEach(({ name, reload }) => {
    const channel = sb
      .channel(`realtime:${name}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: name }, async (payload) => {
        await reload();
        if (payload.eventType === 'INSERT' && payload.new?.created_by !== currentUser?.id) {
          showToast(`Yeni ${labelTable(name)} eklendi`);
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setConnStatus('ok', 'Canlı bağlantı aktif');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setConnStatus('error', 'Bağlantı hatası');
        }
      });
    realtimeChannels.push(channel);
  });
}

function labelTable(t) {
  return ({
    stock:'malzeme', sponsors:'sponsor', allocations:'tahsis',
    needs:'ihtiyaç', flights:'uçuş', notes:'not', parts:'parça',
    tasks: 'görev', telemetry: 'telemetri', media_assets: 'materyal',
    profiles: 'üye', audit_log: 'log'
  }[t] || t);
}

function teardownRealtime() {
  realtimeChannels.forEach(c => sb.removeChannel(c));
  realtimeChannels = [];
}

/* ============================================================
   LOAD ALL DATA
   ============================================================ */
async function loadAllData() {
  const tasksList = [
    ['sponsorship', loadSponsorship()],
    ['stock', loadStock()],
    ['needs', loadNeeds()],
    ['flights+notes', loadFlights().then(loadNotes)],
    ['parts', loadParts()],
    ['tasks', loadTasks()],
    ['telemetry', loadTelemetry()],
    ['media', loadMedia()]
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
  loadWeather();
  setInterval(loadWeather, 10 * 60 * 1000);
  
  if (!currentUser) renderSponsorStrip([]);
  bindDragDrop();
}

init();