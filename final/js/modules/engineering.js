/* ============================================================
   engineering.js — Mühendislik modülleri
   - PARTS (3D parça yönetimi)
   - FLIGHTS (uçuş planlaması)
   - NOTES (uçuş notları)
   - TELEMETRY (API & telemetri kayıtları)
   ============================================================ */

import { sb } from '../supabase.js';
import {
  $, escapeHtml, fmtDate, fmtDateTime, safeUUID,
  DEPT_LABELS, warn, err
} from '../utils/helpers.js';
import { showToast, customConfirm, Modal } from '../ui/components.js';
import { logAction } from '../core/audit.js';
import { isAdmin, myDept, getCurrentUser } from '../core/auth.js';

/* ============================================================
   PARTS
   ============================================================ */
const PARTS_VIEW_DEPTS = ['yazilim','yapisal','kompozit','aviyonik','medya'];
const PARTS_WRITE_DEPTS = ['yazilim','yapisal','kompozit','aviyonik'];
const VIEWABLE_EXTS = ['stl', 'obj', 'glb', 'gltf'];

let _parts = [];
let _selectedPartId = null;

export async function loadParts() {
  if (!isAdmin() && !PARTS_VIEW_DEPTS.includes(myDept())) {
    _parts = []; renderParts(); return;
  }
  const { data, error: e } = await sb.from('parts').select('*')
    .order('created_at', { ascending: false });
  if (e) { warn(e); return; }
  _parts = data || [];
  renderParts();
}

function renderParts() {
  const q = ($('partSearch')?.value || '').toLowerCase();
  const dept = $('partFilterDept')?.value || '';
  const ac = $('partFilterAircraft')?.value || '';
  const onlyView = $('partOnlyViewable')?.checked || false;

  const filtered = _parts.filter(p => {
    if (q && !p.name.toLowerCase().includes(q) &&
        !(p.description || '').toLowerCase().includes(q)) return false;
    if (dept && p.dept !== dept) return false;
    if (ac && p.aircraft !== ac) return false;
    if (onlyView && !p.is_viewable) return false;
    return true;
  });

  $('partsCount').textContent = `${filtered.length} parça`;
  const dom = $('partsList');
  if (!dom) return;
  if (filtered.length === 0) {
    dom.innerHTML = '<div style="text-align:center;padding:40px;color:var(--ink-3);font-family:var(--font-mono);font-size:11px;letter-spacing:1px;">PARÇA BULUNAMADI</div>';
    return;
  }

  // Medya → sadece okuma; silme butonu yok
  const canDelete = isAdmin() || PARTS_WRITE_DEPTS.includes(myDept());

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

function initParts() {
  $('partForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = getCurrentUser();
    if (!user) return Modal.open('loginModal');

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

    submitBtn.disabled = true; spinner.hidden = false;
    label.textContent = 'Yükleniyor';
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

      const { error: upErr } = await sb.storage.from('parts').upload(
        storagePath, file, { cacheControl: '3600', upsert: false }
      );
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
        created_by: user.id
      };
      const { data, error: dbErr } = await sb.from('parts').insert([payload]).select();
      if (dbErr) {
        await sb.storage.from('parts').remove([storagePath]);
        throw dbErr;
      }

      e.target.reset();
      $('fileHint').textContent = 'STL, OBJ, GLB tercih edilir (max 100 MB)';
      $('fileHint').style.color = '';
      setTimeout(() => { progressBox.hidden = true; }, 600);
      showToast(`Parça yüklendi${isViewable ? ' — 3D olarak görüntülenebilir' : ''}`);
      logAction('create', 'parts', data?.[0]?.id, { name: payload.name, ext });
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

  $('partFile')?.addEventListener('change', (e) => {
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

  $('partsList')?.addEventListener('click', async (e) => {
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
      const { data, error: e2 } = await sb.storage.from('parts')
        .createSignedUrl(part.file_path, validity);
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
    $(id)?.addEventListener('input', renderParts);
  });
}

/* ============================================================
   FLIGHTS
   ============================================================ */
let _flights = [];
export const getFlights = () => _flights;

export async function loadFlights() {
  const { data, error: e } = await sb.from('flights').select('*')
    .order('flight_date', { ascending: false })
    .order('flight_time', { ascending: false });
  if (e) { warn(e); return; }
  _flights = data || [];
  renderFlights();
  populateFlightSelects();
}

function populateFlightSelects() {
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
  const upcoming = _flights.filter(f =>
    new Date(f.flight_date + 'T' + f.flight_time) >= now
  ).sort((a,b) =>
    new Date(a.flight_date+'T'+a.flight_time) -
    new Date(b.flight_date+'T'+b.flight_time)
  );
  const past = _flights.filter(f =>
    new Date(f.flight_date + 'T' + f.flight_time) < now
  );

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

function initFlights() {
  $('flightForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = getCurrentUser();
    if (!user) return Modal.open('loginModal');
    const fd = new FormData(e.target);
    const payload = {
      flight_date: fd.get('date'), flight_time: fd.get('time'),
      aircraft: fd.get('aircraft'), pilot: fd.get('pilot'),
      location: fd.get('location'),
      duration: fd.get('duration') ? Number(fd.get('duration')) : null,
      mission: fd.get('mission'),
      created_by: user.id
    };
    const { data, error: e2 } = await sb.from('flights').insert([payload]).select();
    if (e2) return showToast(e2.message, 'error');
    e.target.reset();
    showToast('Uçuş planlandı.');
    logAction('create', 'flights', data?.[0]?.id,
      { aircraft: payload.aircraft, date: payload.flight_date });
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
}

/* ============================================================
   NOTES
   ============================================================ */
const NOTES_DEPTS = ['yazilim','yapisal','kompozit','aviyonik'];
const NOTE_TYPE = {
  observation:'GÖZLEM', issue:'SORUN',
  improvement:'İYİLEŞTİRME', success:'BAŞARI'
};

let _notes = [];

export async function loadNotes() {
  if (!isAdmin() && !NOTES_DEPTS.includes(myDept())) {
    _notes = []; renderNotes(); return;
  }
  const { data, error: e } = await sb.from('notes').select('*')
    .order('created_at', { ascending: false });
  if (e) { warn(e); return; }
  _notes = data || [];
  renderNotes();
}

function renderNotes() {
  $('notesCount').textContent = _notes.length;
  const dom = $('notesList');
  if (!dom) return;
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

function initNotes() {
  $('noteForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = getCurrentUser();
    if (!user) return Modal.open('loginModal');
    const fd = new FormData(e.target);
    const payload = {
      flight_id: fd.get('flightId') || null,
      note_type: fd.get('type'),
      severity: fd.get('severity'),
      text: fd.get('text'),
      created_by: user.id
    };
    const { data, error: e2 } = await sb.from('notes').insert([payload]).select();
    if (e2) return showToast(e2.message, 'error');
    e.target.reset();
    showToast('Not kaydedildi.');
    logAction('create', 'notes', data?.[0]?.id, { type: payload.note_type });
  });

  $('notesList')?.addEventListener('click', async (e) => {
    const id = e.target.dataset.delNote;
    if (!id) return;
    const ok = await customConfirm('Bu not silinsin mi?');
    if (ok) {
      await sb.from('notes').delete().eq('id', id);
      logAction('delete', 'notes', id, {});
    }
  });
}

/* ============================================================
   TELEMETRY
   ============================================================ */
const TELEMETRY_DEPTS = ['yazilim','aviyonik'];
const TELEMETRY_CAT = {
  endpoint: 'API ENDPOINT', log: 'TELEMETRİ LOG',
  dashboard: 'DASHBOARD', docs: 'DOKÜMAN'
};

let _telemetry = [];

export async function loadTelemetry() {
  if (!isAdmin() && !TELEMETRY_DEPTS.includes(myDept())) {
    _telemetry = []; renderTelemetry(); return;
  }
  const { data, error: e } = await sb.from('telemetry').select('*')
    .order('created_at', { ascending: false });
  if (e) { warn(e); return; }
  _telemetry = data || [];
  renderTelemetry();
}

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

function initTelemetry() {
  $('telemetryForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = getCurrentUser();
    if (!user) return Modal.open('loginModal');
    const fd = new FormData(e.target);
    const payload = {
      title: fd.get('title'),
      category: fd.get('category'),
      payload: fd.get('payload'),
      flight_id: fd.get('flightId') || null,
      created_by: user.id
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
}

/* ============================================================
   PUBLIC INIT
   ============================================================ */
export function initEngineering() {
  initParts();
  initFlights();
  initNotes();
  initTelemetry();
}