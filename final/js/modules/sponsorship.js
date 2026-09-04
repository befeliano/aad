/* ============================================================
   sponsorship.js — Sponsorluk ekosistemi
   - SPONSORS (sponsorluk kayıtları)
   - ALLOCATIONS (bütçe tahsisleri)
   - NEEDS (ihtiyaç tablosu — herkese açık)
   - MEDIA (tanıtım materyalleri)
   ============================================================ */

import { sb } from '../supabase.js';
import {
  $, escapeHtml, fmtDate, fmtMoney, safeUUID,
  DEPT_LABELS, warn
} from '../utils/helpers.js';
import { showToast, customConfirm, Modal } from '../ui/components.js';
import { renderSponsorStrip } from '../ui/renderers.js';
import { logAction } from '../core/audit.js';
import { isAdmin, myDept, getCurrentUser } from '../core/auth.js';

/* ============================================================
   SPONSORS & ALLOCATIONS
   ============================================================ */
let _sponsors = [];
let _allocations = [];

export async function loadSponsorship() {
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
  if (tbody) {
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
  }

  const deptTotals = {};
  _allocations.forEach(a => {
    deptTotals[a.dept] = (deptTotals[a.dept] || 0) + Number(a.amount || 0);
  });
  const max = Math.max(1, ...Object.values(deptTotals));
  const depts = ['yazilim','yapisal','aviyonik','kompozit','sponsorluk','medya'];
  const dom = $('deptBudgets');
  if (dom) {
    dom.innerHTML = depts.map(d => {
      const v = deptTotals[d] || 0;
      return `
        <div class="dept-budget">
          <div class="dept-budget__name">${DEPT_LABELS[d]}</div>
          <div class="dept-budget__amt">${fmtMoney(v)} ₺</div>
          <div class="dept-budget__bar"><span style="width:${(v/max)*100}%"></span></div>
        </div>`;
    }).join('');
  }

  renderSponsorStrip(_sponsors);
}

function initSponsorship() {
  $('sponsorForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = getCurrentUser();
    if (!user) return Modal.open('loginModal');
    const fd = new FormData(e.target);
    const payload = {
      name: fd.get('name'),
      amount: Number(fd.get('amount')),
      date: fd.get('date'),
      note: fd.get('note'),
      created_by: user.id
    };
    const { data, error: e2 } = await sb.from('sponsors').insert([payload]).select();
    if (e2) return showToast(e2.message, 'error');
    e.target.reset();
    showToast('Sponsor kaydedildi.');
    logAction('create', 'sponsors', data?.[0]?.id, { name: payload.name });
  });

  $('allocForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = getCurrentUser();
    if (!user) return Modal.open('loginModal');
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
      dept: fd.get('dept'),
      amount: want,
      purpose: fd.get('purpose'),
      created_by: user.id
    };
    const { data, error: e2 } = await sb.from('allocations').insert([payload]).select();
    if (e2) return showToast(e2.message, 'error');
    e.target.reset();
    showToast('Tahsis kaydedildi.');
    logAction('create', 'allocations', data?.[0]?.id, payload);
  });

  $('sponsorTable')?.addEventListener('click', async (e) => {
    const id = e.target.dataset.delSponsor;
    if (!id) return;
    const ok = await customConfirm('Bu sponsorluk kaydı silinsin mi?');
    if (!ok) return;
    const { error: e2 } = await sb.from('sponsors').delete().eq('id', id);
    if (e2) showToast(e2.message, 'error');
    else logAction('delete', 'sponsors', id, {});
  });
}

/* ============================================================
   NEEDS — herkese açık
   ============================================================ */
let _needs = [];

export async function loadNeeds() {
  const { data, error: e } = await sb.from('needs').select('*')
    .order('created_at', { ascending: false });
  if (e) { warn(e); return; }
  _needs = data || [];
  renderNeeds();
}

function renderNeeds() {
  $('needsCount').textContent = _needs.filter(n => !n.done).length;
  const tbody = $('needsTable');
  if (!tbody) return;
  if (_needs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty">Henüz ihtiyaç talebi yok.</td></tr>';
    return;
  }
  const prio = {
    critical:['KRİTİK','bad'], high:['YÜKSEK','warn'],
    medium:['ORTA','info'], low:['DÜŞÜK','ok']
  };
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

function initNeeds() {
  $('needForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = getCurrentUser();
    if (!user) return Modal.open('loginModal');
    const fd = new FormData(e.target);
    const payload = {
      item: fd.get('item'), dept: fd.get('dept'),
      qty: Number(fd.get('qty')), cost: Number(fd.get('cost') || 0),
      priority: fd.get('priority'), reason: fd.get('reason'),
      created_by: user.id
    };
    const { data, error: e2 } = await sb.from('needs').insert([payload]).select();
    if (e2) return showToast(e2.message, 'error');
    e.target.reset();
    showToast('Talep oluşturuldu.');
    logAction('create', 'needs', data?.[0]?.id, { item: payload.item });
  });

  $('needsTable')?.addEventListener('click', async (e) => {
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
}

/* ============================================================
   MEDIA ASSETS (Sponsorluk + Medya)
   ============================================================ */
const MEDIA_DEPTS = ['sponsorluk','medya'];
const MEDIA_CAT = {
  logo: 'Logo', sunum: 'Sunum', foto: 'Fotoğraf', video: 'Video',
  sablon: 'Şablon', sozlesme: 'Sözleşme', diger: 'Diğer'
};

let _media = [];

export async function loadMedia() {
  if (!isAdmin() && !MEDIA_DEPTS.includes(myDept())) {
    _media = []; renderMedia(); return;
  }
  const { data, error: e } = await sb.from('media_assets').select('*')
    .order('created_at', { ascending: false });
  if (e) { warn(e); return; }
  _media = data || [];
  renderMedia();
}

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

function initMedia() {
  $('mediaForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = getCurrentUser();
    if (!user) return Modal.open('loginModal');
    const fd = new FormData(e.target);
    const file = $('mediaFile').files[0];
    const url = fd.get('external_url');
    if (!file && !url) return showToast('Dosya veya link gerekli', 'error');

    const submitBtn = $('mediaSubmit');
    const spinner = submitBtn.querySelector('.btn__spinner');
    const label = submitBtn.querySelector('.btn__label');
    submitBtn.disabled = true; spinner.hidden = false;
    label.textContent = 'Yükleniyor';

    try {
      let storagePath = null, fileName = null, fileExt = null, fileSize = null;
      if (file) {
        if (file.size > 50 * 1048576) throw new Error('Dosya çok büyük (max 50 MB)');
        fileExt = file.name.split('.').pop().toLowerCase();
        storagePath = `media/${safeUUID()}.${fileExt}`;
        fileName = file.name;
        fileSize = file.size;
        const { error: upErr } = await sb.storage.from('media').upload(
          storagePath, file, { upsert: false }
        );
        if (upErr) throw upErr;
      }
      const payload = {
        title: fd.get('title'),
        category: fd.get('category'),
        description: fd.get('description'),
        external_url: url || null,
        file_path: storagePath, file_name: fileName,
        file_ext: fileExt, file_size: fileSize,
        created_by: user.id
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
      submitBtn.disabled = false;
      spinner.hidden = true;
      label.textContent = 'Yükle';
    }
  });

  $('mediaFilterCategory')?.addEventListener('input', renderMedia);

  $('mediaList')?.addEventListener('click', async (e) => {
    const dlId = e.target.dataset.dlMedia;
    if (dlId) {
      const m = _media.find(x => x.id === dlId);
      if (!m?.file_path) return;
      const { data, error: e2 } = await sb.storage.from('media')
        .createSignedUrl(m.file_path, 300);
      if (e2) return showToast('İndirme hatası', 'error');
      const a = document.createElement('a');
      a.href = data.signedUrl;
      a.download = m.file_name || 'dosya';
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
}

/* ============================================================
   PUBLIC INIT
   ============================================================ */
export function initSponsorshipModule() {
  initSponsorship();
  initNeeds();
  initMedia();
}