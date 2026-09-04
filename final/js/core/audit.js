/* ============================================================
   audit.js — Audit log yazıcı
   ============================================================ */

import { sb } from '../supabase.js';
import { log } from '../utils/helpers.js';
import { getCurrentUser, getCurrentProfile, myDept } from './auth.js';

/**
 * Bir CRUD aksiyonunu audit_log tablosuna yaz.
 * Hata durumunda sessiz fail (kullanıcıyı yormaz).
 *
 * @param {'create'|'update'|'delete'|'login'} action
 * @param {string|null} table   - tablo adı (null olabilir, örn login için)
 * @param {string|null} recordId
 * @param {object} details      - jsonb extra info
 */
export async function logAction(action, table, recordId, details = {}) {
  const user = getCurrentUser();
  const profile = getCurrentProfile();
  if (!user) return;
  try {
    await sb.from('audit_log').insert([{
      user_id: user.id,
      user_name: profile?.full_name || profile?.username || user.email,
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