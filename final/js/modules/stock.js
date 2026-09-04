/* ============================================================
   stock.js — Stok takibi modülü
   ============================================================ */

import { sb } from '../supabase.js';
import { $, escapeHtml, fmtMoney, DEPT_LABELS, warn } from '../utils/helpers.js';
import { showToast, customConfirm, Modal } from '../ui/components.js';
import { logAction } from '../core/audit.js';
import { isAdmin, myDept, getCurrentUser } from '../core/auth.js';

const ALLOWED_DEPTS = ['yazilim','yapisal','kompozit','aviyonik','sponsorluk'];

let _stock = [];

export async function loadStock() {
  if (!isAdmin() && !ALLOWED_DEPTS.includes(myDept())) {
    _stock = []; renderStock(); return;
  }
  const { data, error: e } = await sb.from('stock').select('*')
    .order('created_at', { ascending: false });
  if (e) { warn(e); return; }
  _stock = data || [];
  renderStock();
}

function renderStock() {
  const q = ($('stockSearch')?.value || '').toLowerCase();
  const dept = $('stockFilterDept')?.value || '';
  const onlyLow = $('stockOnlyLow')?.checked || false;

  const filtered = _stock.filter(s => {
    if (q && !s.name.toLowerCase().includes(q)) return false;
    if (dept && s.dept !== dept) return false;
    if (onlyLow && Number(s.qty) > Number(s.min_stock || 0)) return false;
    return true;
  });

  $('stockCount').textContent = `${filtered.length} kayıt`;
  const tbody = $('stockTable');
  if (!tbody) return;
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
    if (qty === 0)        { status = 'TÜKENDİ';  badge = 'bad';  }
    else if (qty <= min)  { status = 'KRİTİK';   badge = 'warn'; }
    else                  { status = 'YETERLİ';  badge = 'ok';   }
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

export function initStock() {
  $('stockForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = getCurrentUser();
    if (!user) return Modal.open('loginModal');
    const fd = new FormData(e.target);
    const payload = {
      name: fd.get('name'),
      dept: fd.get('dept'),
      qty: Number(fd.get('qty')),
      unit: fd.get('unit'),
      price: Number(fd.get('price') || 0),
      min_stock: Number(fd.get('min') || 0),
      location: fd.get('location'),
      created_by: user.id
    };
    const { data, error: e2 } = await sb.from('stock').insert([payload]).select();
    if (e2) return showToast(e2.message, 'error');
    e.target.reset();
    showToast('Malzeme eklendi.');
    logAction('create', 'stock', data?.[0]?.id, { name: payload.name });
  });

  $('stockTable')?.addEventListener('click', async (e) => {
    const id = e.target.dataset.delStock;
    if (!id) return;
    const ok = await customConfirm('Bu stok kaydı silinsin mi?');
    if (!ok) return;
    const { error: e2 } = await sb.from('stock').delete().eq('id', id);
    if (e2) showToast(e2.message, 'error');
    else logAction('delete', 'stock', id, {});
  });

  ['stockSearch', 'stockFilterDept', 'stockOnlyLow'].forEach(id => {
    $(id)?.addEventListener('input', renderStock);
  });
}