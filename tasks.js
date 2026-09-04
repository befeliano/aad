/* ============================================================
   TASKS MODULE — self-contained
   ----------------------------------------------------------------
   Bu dosya kendi başına çalışır. script.js'deki Supabase client
   (window.sb) ve currentUser'ı kullanır. HTML'i tasks.html'den
   fetch eder ve tab içine yerleştirir.
   ============================================================ */

(function() {
  'use strict';

  // script.js'in hazır olmasını bekle (window.sb tanımlı mı?)
  function waitForCore(callback) {
    if (window.sb && window.aadCore) {
      callback();
    } else {
      setTimeout(() => waitForCore(callback), 50);
    }
  }

  waitForCore(init);

  function init() {
    const sb = window.sb;
    const core = window.aadCore;        // { escapeHtml, fmtDate, getCurrentUser, showToast, $ }
    const $ = core.$;

    // --- HTML template'ini yükle ---
    const host = document.querySelector('[data-tab="tasks"]');
    if (!host) {
      console.warn('[tasks] tab container bulunamadı');
      return;
    }

    fetch('tasks.html')
      .then(r => {
        if (!r.ok) throw new Error('tasks.html yüklenemedi: ' + r.status);
        return r.text();
      })
      .then(html => {
        host.innerHTML = html;
        bindAll();
        // Kullanıcı zaten giriş yapmışsa veriyi yükle
        if (core.getCurrentUser()) {
          loadTasks();
          setupRealtime();
        }
      })
      .catch(err => {
        console.error('[tasks] init failed:', err);
        host.innerHTML = `
          <div class="db-banner" style="margin: 24px 0;">
            <strong>Görevler yüklenemedi:</strong> ${err.message}.
            tasks.html dosyasının index.html ile aynı klasörde olduğundan emin olun.
          </div>`;
      });

    // ============================================================
    // STATE
    // ============================================================
    let _tasks = [];
    let _channel = null;

    const STATUS_LABEL = {
      todo: 'Yapılacak', doing: 'Yapılıyor',
      review: 'Test/Kontrol', done: 'Tamamlandı'
    };
    const DEPT_LABEL = {
      yazilim: 'Yazılım', yapisal: 'Yapısal', aviyonik: 'Aviyonik',
      kompozit: 'Kompozit', medya: 'Medya', sponsorluk: 'Sponsorluk',
      ortak: 'Ortak'
    };

    // ============================================================
    // BINDING
    // ============================================================
    function bindAll() {
      // Form
      $('taskForm').addEventListener('submit', onCreateTask);
      // Filtreler
      ['taskSearch', 'taskFilterDept', 'taskOnlyMine'].forEach(id => {
        $(id).addEventListener('input', render);
      });
      // Drag & drop on the board
      bindDragDrop();
      // Card click — silme veya edit
      $('kanbanBoard').addEventListener('click', onBoardClick);
    }

    // ============================================================
    // CRUD
    // ============================================================
    async function loadTasks() {
      const { data, error } = await sb.from('tasks').select('*')
        .order('status').order('position').order('created_at');
      if (error) {
        console.error('[tasks] load error:', error);
        return;
      }
      _tasks = data || [];
      render();
    }

    async function onCreateTask(e) {
      e.preventDefault();
      const user = core.getCurrentUser();
      if (!user) return core.showToast('Önce giriş yap', 'error');

      const fd = new FormData(e.target);
      const status = fd.get('status') || 'todo';
      const maxPos = _tasks
        .filter(t => t.status === status)
        .reduce((m, t) => Math.max(m, t.position || 0), 0);

      const { error } = await sb.from('tasks').insert([{
        title: fd.get('title'),
        description: fd.get('description') || null,
        dept: fd.get('dept'),
        assignee: fd.get('assignee') || null,
        deadline: fd.get('deadline') || null,
        priority: fd.get('priority') || 'medium',
        status: status,
        position: maxPos + 1,
        created_by: user.id
      }]);

      if (error) {
        console.error('[tasks] create error:', error);
        core.showToast('Görev oluşturulamadı: ' + error.message, 'error');
        return;
      }

      e.target.reset();
      core.showToast('Görev oluşturuldu');
      loadTasks();   // realtime gecikebilir, hemen yenile
    }

    async function updateTaskStatus(id, newStatus) {
      const maxPos = _tasks
        .filter(t => t.status === newStatus)
        .reduce((m, t) => Math.max(m, t.position || 0), 0);

      const { error } = await sb.from('tasks')
        .update({ status: newStatus, position: maxPos + 1 })
        .eq('id', id);

      if (error) {
        core.showToast('Güncellenemedi: ' + error.message, 'error');
        loadTasks();   // optimistic değişikliği geri al
      }
    }

    async function deleteTask(id) {
      if (!confirm('Bu görev silinsin mi?')) return;
      const { error } = await sb.from('tasks').delete().eq('id', id);
      if (error) core.showToast('Silinemedi: ' + error.message, 'error');
    }

    // ============================================================
    // RENDER
    // ============================================================
    function render() {
      const q = ($('taskSearch').value || '').toLowerCase();
      const dept = $('taskFilterDept').value;
      const onlyMine = $('taskOnlyMine').checked;
      const user = core.getCurrentUser();
      const myName = (user?.user_metadata?.full_name || user?.email?.split('@')[0] || '').toLowerCase();

      const filtered = _tasks.filter(t => {
        if (q && !(`${t.title} ${t.assignee || ''} ${t.description || ''}`.toLowerCase().includes(q))) return false;
        if (dept && t.dept !== dept) return false;
        if (onlyMine && myName && !(t.assignee || '').toLowerCase().includes(myName)) return false;
        return true;
      });

      $('tasksCount').textContent = `${filtered.length} görev`;

      ['todo', 'doing', 'review', 'done'].forEach(status => {
        const list = document.querySelector(`[data-drop="${status}"]`);
        const items = filtered.filter(t => t.status === status)
                              .sort((a,b) => (a.position || 0) - (b.position || 0));
        document.querySelector(`[data-count="${status}"]`).textContent = items.length;
        list.innerHTML = items.map(taskCardHtml).join('');
      });
    }

    function taskCardHtml(t) {
      const esc = core.escapeHtml;
      const initial = t.assignee ? t.assignee.trim().charAt(0).toUpperCase() : '?';
      const deadlineHtml = renderDeadline(t.deadline);
      const prioChipClass = (t.priority === 'critical' || t.priority === 'high')
        ? `task-card__chip task-card__chip--prio-${t.priority}`
        : 'task-card__chip';
      const prioLabel = { critical: 'KRİTİK', high: 'YÜKSEK', medium: 'ORTA', low: 'DÜŞÜK' }[t.priority] || t.priority;

      return `
        <div class="task-card" draggable="true" data-task-id="${t.id}" data-priority="${t.priority || 'medium'}">
          <div class="task-card__actions">
            <button class="icon-btn" data-del-task="${t.id}" title="Sil">×</button>
          </div>
          <div class="task-card__title">${esc(t.title)}</div>
          <div class="task-card__meta">
            <span class="task-card__chip task-card__chip--dept">${esc(DEPT_LABEL[t.dept] || t.dept)}</span>
            ${(t.priority === 'critical' || t.priority === 'high')
              ? `<span class="${prioChipClass}">${prioLabel}</span>` : ''}
          </div>
          ${t.description ? `<div class="task-card__desc">${esc(t.description)}</div>` : ''}
          <div class="task-card__foot">
            <span class="task-card__assignee" data-initial="${esc(initial)}">${esc(t.assignee || 'Atanmamış')}</span>
            ${deadlineHtml}
          </div>
        </div>`;
    }

    function renderDeadline(d) {
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

    // ============================================================
    // DRAG & DROP
    // ============================================================
    function bindDragDrop() {
      const board = $('kanbanBoard');

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
          // sadece gerçekten dışına çıktıysak kaldır
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
          // Optimistic update
          task.status = newStatus;
          render();
          await updateTaskStatus(taskId, newStatus);
        });
      });
    }

    // ============================================================
    // BOARD CLICK
    // ============================================================
    function onBoardClick(e) {
      const delId = e.target.dataset.delTask;
      if (delId) {
        e.stopPropagation();
        deleteTask(delId);
      }
    }

    // ============================================================
    // REALTIME
    // ============================================================
    function setupRealtime() {
      teardownRealtime();
      _channel = sb.channel('realtime:tasks')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, (payload) => {
          loadTasks();
          if (payload.eventType === 'INSERT' && payload.new?.created_by !== core.getCurrentUser()?.id) {
            core.showToast(`Yeni görev: ${payload.new.title}`);
          }
        })
        .subscribe();
    }

    function teardownRealtime() {
      if (_channel) { sb.removeChannel(_channel); _channel = null; }
    }

    // ============================================================
    // PUBLIC HOOKS — script.js bunları auth değiştiğinde çağırır
    // ============================================================
    window.aadTasks = {
      onLogin: () => { loadTasks(); setupRealtime(); },
      onLogout: () => { _tasks = []; render(); teardownRealtime(); }
    };
  }
})();