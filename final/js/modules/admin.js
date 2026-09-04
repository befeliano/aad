/* ============================================================
   admin.js — Admin paneli
   - USER MANAGEMENT (üye listesi, rol/dept değiştirme)
   - AUDIT LOG VIEWER
   ============================================================ */

import { sb } from '../supabase.js';
import { $, escapeHtml, fmtDateTime, warn } from '../utils/helpers.js';
import { showToast, customConfirm } from '../ui/components.js';
import { logAction } from '../core/audit.js';
import { isAdmin, getCurrentUser } from '../core/auth.js';

/* ============================================================
   USER MANAGEMENT
   ============================================================ */
let _users = [];

export async function loadUserManagement() {
  if (!isAdmin()) return;
  const { data, error: e } = await sb.from('profiles').select('*')
    .order('created_at', { ascending: false });
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

  const me = getCurrentUser();
  tbody.innerHTML = filtered.map(u => {
    const isMe = u.id === me?.id;
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

function initUserManagement() {
  $('userSearch')?.addEventListener('input', renderUsers);

  $('userManagementTable')?.addEventListener('change', async (e) => {
    const field = e.target.dataset.userUpdate;
    const userId = e.target.dataset.userId;
    if (!field || !userId) return;
    const value = e.target.value;
    const { error: e2 } = await sb.from('profiles')
      .update({ [field]: value }).eq('id', userId);
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
}

/* ============================================================
   AUDIT LOG VIEWER
   ============================================================ */
let _audit = [];

const ACTION_LABEL = {
  create: 'Oluşturma', update: 'Güncelleme',
  delete: 'Silme', login: 'Giriş'
};
const ACTION_BADGE = {
  create: 'ok', update: 'info',
  delete: 'bad', login: 'accent'
};

export async function loadAuditLog() {
  if (!isAdmin()) return;
  const tableFilter = $('auditFilterTable')?.value || '';
  const actionFilter = $('auditFilterAction')?.value || '';

  let q = sb.from('audit_log').select('*')
    .order('created_at', { ascending: false }).limit(200);
  if (tableFilter)  q = q.eq('table_name', tableFilter);
  if (actionFilter) q = q.eq('action', actionFilter);

  const { data, error: e } = await q;
  if (e) { warn('audit load:', e); return; }
  _audit = data || [];
  renderAudit();
}

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
      ? Object.entries(a.details).map(([k,v]) =>
          `<code>${escapeHtml(k)}=${escapeHtml(String(v).slice(0, 40))}</code>`
        ).join(' ')
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

function initAuditViewer() {
  $('auditFilterTable')?.addEventListener('input', loadAuditLog);
  $('auditFilterAction')?.addEventListener('input', loadAuditLog);
}

/* ============================================================
   PUBLIC INIT
   ============================================================ */
export function initAdmin() {
  initUserManagement();
  initAuditViewer();
}