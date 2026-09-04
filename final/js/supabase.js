/* ============================================================
   supabase.js — Supabase client tanımı
   ============================================================ */

import { warn } from './utils/helpers.js';

const SUPABASE_URL = 'https://hcqyqkugyreankkeldfl.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_twWFFp4N1A26acww4dQjEw_r0yNY9SL';

/* window.supabase global'i (CDN'den yüklenir) */
export const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storage: window.localStorage,
    detectSessionInUrl: false,
    /* Multi-tab güvenli refresh için Web Locks API */
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

/* viewer.js'in işine yarayan global helper */
window._getPartUrl = async function(filePath) {
  const { data, error: e } = await sb.storage
    .from('parts')
    .createSignedUrl(filePath, 600);
  if (e) throw e;
  return data.signedUrl;
};

/* Diğer modüller window.sb'a düşmesin diye export */
window.sb = sb;