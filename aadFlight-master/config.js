/* ============================================================
   AAD Uçuş Analiz Sistemi — Konfigürasyon
   ------------------------------------------------------------
   Backend'in çalıştığı adresi burada değiştir. Varsayılan:
   uvicorn main:app --port 8010  (backend/ klasöründe çalıştırılmalı)
   ============================================================ */

const BACKEND_URL = "";

// Renkler artık takım numarasından bağımsız, dinamik atanır
// (bu .db'de Takım 1 hiç telemetri göndermemiş, Takım 2 ve 3 var —
//  hangi takımların gerçekten veri gönderdiği backend'den öğrenilir)
const TEAM_COLOR_PALETTE = ['#22d3c4', '#ff9f1c', '#a78bfa', '#4ade80', '#f472b6'];
const OWN_TEAM_HINT = 1; // "biz" olarak işaretlenecek takım numarası, veri yoksa gösterilmez

// GERÇEK guidance_info.current_mode değerleri (flight_20260806_083857.db'de görülen).
// Yeni bir mod ismi gelirse (henüz görülmemiş), UNKNOWN_MODE_COLOR ile otomatik
// gösterilir — arayüz kilitlenmez, sadece gri bir segment olarak görünür.
const MODES = {
  'Nothing':     { label: 'NOTHING',     color: '#5c6873', desc: 'Guidance aktif değil / hedef yok' },
  'Path Chase':  { label: 'PATH CHASE',  color: '#3ba7ff', desc: 'Rota takibi / hedef kovalama' },
  'Pro Nav':     { label: 'PRO NAV',     color: '#ff3b3b', desc: 'Proportional Navigation — kilitlenme güdümü' },
};
const UNKNOWN_MODE_COLOR = '#e0a83e';
function modeInfo(name){
  return MODES[name] || { label: (name||'—').toUpperCase(), color: UNKNOWN_MODE_COLOR, desc: 'Bilinmeyen mod (yeni eklenmiş olabilir)' };
}

// Live modda kaç saniyede bir yeni veri sorgulanacak (polling aralığı)
const LIVE_POLL_INTERVAL_MS = 1000;