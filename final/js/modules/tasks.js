/* ============================================================
   tasks.js — Kanban (Görevler)
   ============================================================ */

import { sb } from '../supabase.js';
import { $, escapeHtml, warn } from '../utils/helpers.js';
import { showToast, customConfirm, Modal } from '../ui/components.js';
import { logAction } from '../core/audit.js';
import { getCurrentUser, getCurrentProfile } from '../core/auth.js';

const DEPT_TASK_LABEL = {
  yazilim: 'Yazılım', yapisal: 'Yapısal', aviyonik: 'Aviyonik',
  kompozit: 'Kompozit', medya: 'Medya', sponsorluk: 'Sponsorluk',
  ortak: 'Ortak'
};

let _tasks = [];

export async function loadTasks() {
  // RLS zaten filtreliyor — sadece kendi departmanını görür
  const { data, error } = await sb.from('tasks').select('*')
    .order('status').order('position').order('created_at');
  if (error) { warn('[tasks] load error:', error); return; }
  _tasks = data || [];
  renderTasks();
}

function renderTasks() {
  const q = ($('taskSearch')?.value || '').toLowerCase();
  const dept = $('taskFilterDept')?.value || '';
  const onlyMine = $('taskOnlyMine')?.checked || false;

  const profile = getCurrentProfile();
  const user = getCurrentUser();
  const myName = (
    profile?.full_name ||
    user?.user_metadata?.full_name ||
    user?.email?.split('@')[0] ||
    ''
  ).toLowerCase();

  const filtered = _tasks.filter(t => {
    if (q && !(`${t.title} ${t.assignee || ''} ${t.description || ''}`.toLowerCase().includes(q))) return false;
    if (dept && t.dept !== dept) return false;
    if (onlyMine && myName && !(t.assignee || '').toLowerCase().includes(myName)) return false;
    return true;
  });

  $('tasksCount').textContent = `${filtered.length} görev`;

  ['todo', 'doing', 'review', 'done'].forEach(status => {
    const list = document.querySelector(`[data-drop="${status}"]`);
    if (!list) return;
    const items = filtered.filter(t => t.status === status)
                          .sort((a,b) => (a.position || 0) - (b.position || 0));
    document.querySelector(`[data-count="${status}"]`).textContent = items.length;
    list.innerHTML = items.map(taskCardHtml).join('');
  });
}

function taskCardHtml(t) {
  const initial = t.assignee ? t.assignee.trim().charAt(0).toUpperCase() : '?';
  const deadlineHtml = renderTaskDeadline(t.deadline);
  const prioChipClass = (t.priority === 'critical' || t.priority === 'high')
    ? `task-card__chip task-card__chip--prio-${t.priority}`
    : 'task-card__chip';
  const prioLabel = {
    critical: 'KRİTİK', high: 'YÜKSEK',
    medium: 'ORTA', low: 'DÜŞÜK'
  }[t.priority] || t.priority;

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
  if (diffDays < 0)        { cls += ' is-overdue'; text = `⚠ ${Math.abs(diffDays)}g geçti`; }
  else if (diffDays === 0) { cls += ' is-soon'; text = 'BUGÜN'; }
  else if (diffDays <= 3)  { cls += ' is-soon'; text = `${diffDays}g kaldı · ${text}`; }
  return `<span class="${cls}">${text}</span>`;
}

/* ============================================================
   DRAG & DROP
   ============================================================ */
function bindDragDrop() {
  const board = $('kanbanBoard');
  if (!board) return;

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
    document.querySelectorAll('.kanban__list')
      .forEach(l => l.classList.remove('is-drop-target'));
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

      const maxPos = _tasks.filter(t => t.status === newStatus)
                           .reduce((m, t) => Math.max(m, t.position || 0), 0);
      const { error } = await sb.from('tasks')
        .update({ status: newStatus, position: maxPos + 1 })
        .eq('id', taskId);
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
   PUBLIC INIT
   ============================================================ */
export function initTasks() {
  $('taskForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = getCurrentUser();
    if (!user) return Modal.open('loginModal');

    const fd = new FormData(e.target);
    const status = fd.get('status') || 'todo';
    const maxPos = _tasks.filter(t => t.status === status)
                         .reduce((m, t) => Math.max(m, t.position || 0), 0);

    const payload = {
      title: fd.get('title'),
      description: fd.get('description') || null,
      dept: fd.get('dept'),
      assignee: fd.get('assignee') || null,
      deadline: fd.get('deadline') || null,
      priority: fd.get('priority') || 'medium',
      status: status,
      position: maxPos + 1,
      created_by: user.id
    };
    const { data, error } = await sb.from('tasks').insert([payload]).select();
    if (error) return showToast('Görev oluşturulamadı: ' + error.message, 'error');
    e.target.reset();
    showToast('Görev oluşturuldu');
    logAction('create', 'tasks', data?.[0]?.id,
      { title: payload.title, dept: payload.dept });
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

  bindDragDrop();
}