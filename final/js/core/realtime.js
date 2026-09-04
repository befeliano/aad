/* ============================================================
   realtime.js — Supabase realtime kanalları
   ============================================================ */

import { sb } from '../supabase.js';
import { setConnStatus, showToast } from '../ui/components.js';
import { getCurrentUser, isAdmin } from './auth.js';

let realtimeChannels = [];

const TABLE_LABELS = {
  stock: 'malzeme', sponsors: 'sponsor', allocations: 'tahsis',
  needs: 'ihtiyaç', flights: 'uçuş', notes: 'not', parts: 'parça',
  tasks: 'görev', telemetry: 'telemetri', media_assets: 'materyal',
  profiles: 'üye', audit_log: 'log'
};

/**
 * Realtime kanallarını kur.
 * @param {object} reloaders — { stock: fn, sponsors: fn, ... }
 * Her tablo için bir reload fonksiyonu alır.
 */
export function setupRealtime(reloaders) {
  teardownRealtime();
  setConnStatus('warn', 'Canlı bağlantı kuruluyor...');

  const tables = [
    { name: 'stock',        reload: reloaders.stock },
    { name: 'sponsors',     reload: reloaders.sponsorship },
    { name: 'allocations',  reload: reloaders.sponsorship },
    { name: 'needs',        reload: reloaders.needs },
    { name: 'flights',      reload: reloaders.flightsAndNotes },
    { name: 'notes',        reload: reloaders.notes },
    { name: 'parts',        reload: reloaders.parts },
    { name: 'tasks',        reload: reloaders.tasks },
    { name: 'telemetry',    reload: reloaders.telemetry },
    { name: 'media_assets', reload: reloaders.media },
    { name: 'profiles',     reload: () => isAdmin() && reloaders.users?.() },
    { name: 'audit_log',    reload: () => isAdmin() && reloaders.audit?.() }
  ];

  tables.forEach(({ name, reload }) => {
    if (!reload) return;
    const channel = sb
      .channel(`realtime:${name}`)
      .on('postgres_changes',
          { event: '*', schema: 'public', table: name },
          async (payload) => {
            await reload();
            const me = getCurrentUser();
            if (payload.eventType === 'INSERT' &&
                payload.new?.created_by !== me?.id) {
              showToast(`Yeni ${TABLE_LABELS[name] || name} eklendi`);
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

export function teardownRealtime() {
  realtimeChannels.forEach(c => sb.removeChannel(c));
  realtimeChannels = [];
}