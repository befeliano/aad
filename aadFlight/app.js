/* ============================================================
   AAD Uçuş Analiz Sistemi — Uygulama Mantığı
   ------------------------------------------------------------
   GERÇEK BACKEND'E BAĞLANIR (config.js -> BACKEND_URL).
   İki mod:
     PLAYBACK — dosyanın tamamı bir kere çekilir, scrubber ile
                baştan sona serbestçe gezilir.
     LIVE     — belirli aralıkla (LIVE_POLL_INTERVAL_MS) backend'e
                "son gördüğümden sonrası var mı" diye sorulur,
                gelen yeni veri zaman çizelgesinin sonuna eklenir,
                playhead otomatik en güncel ana kilitlenir.
   ============================================================ */

// ---- Global durum ----
let SOURCE_MODE = 'playback';   // 'playback' | 'live'
let DATA = null;                // build edilmiş zaman serisi (aşağıdaki normalizePayload çıktısı)
let TEAM_COLORS = {};           // takım no -> renk, backend'den öğrenilen takımlara göre kurulur
let TEAM_LIST = [];             // backend'de gerçekten veri gönderen takımlar
let selectedTeam = null;
let curT = 0;
let playing = false;
let speed = 1;
let lastFrameTime = null;
let trailSeconds = 15;
let showGhost = true;
let liveTimer = null;
let liveCheckpoint = null;      // en son alınan timestamp (live polling için)
let sessionStartT = 0, sessionEndT = 0;
let CURRENT_SESSION = null;     // seçili oturumun session_id'si (dosya adı, uzantısız)
let SESSION_LIST = [];          // /sessions'tan gelen liste

// ============================================================
// BACKEND İLETİŞİMİ
// ============================================================
async function fetchJSON(url){
  const res = await fetch(url);
  if(!res.ok){
    const body = await res.text().catch(()=> '');
    throw new Error(`HTTP ${res.status} — ${body.slice(0,200)}`);
  }
  return res.json();
}

async function loadSessions(){
  return fetchJSON(`${BACKEND_URL}/sessions`);
}
async function loadBounds(sessionId){
  return fetchJSON(`${BACKEND_URL}/flight/${encodeURIComponent(sessionId)}/bounds`);
}
async function loadRange(sessionId, start, end){
  return fetchJSON(`${BACKEND_URL}/flight/${encodeURIComponent(sessionId)}/range?start=${start}&end=${end}`);
}
async function loadLatest(sessionId, since){
  return fetchJSON(`${BACKEND_URL}/flight/${encodeURIComponent(sessionId)}/latest?since=${since}`);
}
async function loadAnalysis(sessionId){
  return fetchJSON(`${BACKEND_URL}/flight/${encodeURIComponent(sessionId)}/analysis`);
}
async function loadAiDebrief(sessionId){
  return fetchJSON(`${BACKEND_URL}/flight/${encodeURIComponent(sessionId)}/ai-debrief`);
}
async function loadAiStatus(){
  return fetchJSON(`${BACKEND_URL}/ai-status`);
}

// Küçük + GÜVENLİ markdown -> HTML (LLM çıktısı için). Önce HTML kaçışı yapılır,
// sonra sınırlı bir alt küme (başlık, kalın, liste, kod) dönüştürülür.
function miniMarkdown(md){
  const esc = (s)=> s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const lines = esc(md||'').split('\n');
  let html='', inList=false, inCode=false;
  const inline = (s)=> s
    .replace(/\*\*([^*]+)\*\*/g,'<b>$1</b>')
    .replace(/`([^`]+)`/g,'<code>$1</code>');
  for(let raw of lines){
    if(/^```/.test(raw)){ inCode=!inCode; html += inCode?'<pre class="ai-pre">':'</pre>'; continue; }
    if(inCode){ html += raw+'\n'; continue; }
    const h = raw.match(/^(#{1,4})\s+(.*)$/);
    if(h){ if(inList){html+='</ul>';inList=false;} const lvl=Math.min(h[1].length+2,5); html+=`<h${lvl} class="ai-h">${inline(h[2])}</h${lvl}>`; continue; }
    const li = raw.match(/^\s*[-*]\s+(.*)$/);
    if(li){ if(!inList){html+='<ul class="ai-ul">';inList=true;} html+=`<li>${inline(li[1])}</li>`; continue; }
    if(inList){html+='</ul>';inList=false;}
    if(raw.trim()==='') { html+=''; continue; }
    html += `<p>${inline(raw)}</p>`;
  }
  if(inList) html+='</ul>';
  if(inCode) html+='</pre>';
  return html;
}

// ============================================================
// OTURUM SEÇİCİ (dropdown)
// ============================================================
async function initSessionSelector(){
  const sel = document.getElementById('sessionSelect');
  try{
    const res = await loadSessions();
    SESSION_LIST = res.sessions || [];
    if(SESSION_LIST.length===0){
      sel.innerHTML = `<option value="">Oturum bulunamadı (backend/sessions/ boş)</option>`;
      setLoading(true, null, `backend/sessions/ klasöründe hiç .db dosyası yok.\nKlasör: ${res.sessions_dir}`);
      return;
    }
    sel.innerHTML = SESSION_LIST.map(s=>{
      const dur = s.duration_s!=null ? `${Math.round(s.duration_s)}s` : '?';
      const teams = (s.teams||[]).map(t=>'T'+t).join(',') || 'veri yok';
      return `<option value="${s.session_id}">${s.session_id} — ${dur} — ${teams}</option>`;
    }).join('');
    CURRENT_SESSION = SESSION_LIST[0].session_id;
    sel.value = CURRENT_SESSION;
  } catch(err){
    sel.innerHTML = `<option value="">Bağlanamadı</option>`;
    setLoading(true, null, `Backend'e bağlanılamadı: ${err.message}\n\nKontrol et: uvicorn main:app --port 8010 çalışıyor mu?`);
    throw err;
  }
}

// ============================================================
// VERİ NORMALİZASYONU
// Backend'den gelen ham payload'ı, arayüzün kullandığı iç yapıya çevirir.
// Böylece playback ve live aynı render koduna aynı şekli besler.
// ============================================================
function emptyDataShell(){
  return {
    rival_tracks: {},   // { "2": [ {t, iha_enlem, iha_boylam, iha_irtifa, iha_yonelme, iha_yatis, iha_dikilme, iha_hiz} ] }
    rk4_tracks: {},     // { "2": [ {t, pred_lat, pred_lon, pred_irtifa, pred_yonelme, pred_hiz, iha_ivme, iha_donus_hizi} ] }
    guidance: [],        // [ {t, current_mode, mode_lock, info} ]
    img_proc: [],        // [ {t, target_track_id, iha_kilitlenme, fps} ]
    target_selection: [],// [ {t, hedef_id} ]
    nfz_areas: [],        // [ {t, zone_index, lat, lon, radius} ]
  };
}

function mergePayloadInto(shell, payload){
  Object.entries(payload.rival_tracks || {}).forEach(([team, arr])=>{
    if(!shell.rival_tracks[team]) shell.rival_tracks[team] = [];
    shell.rival_tracks[team].push(...arr);
  });
  Object.entries(payload.rk4_tracks || {}).forEach(([team, arr])=>{
    if(!shell.rk4_tracks[team]) shell.rk4_tracks[team] = [];
    shell.rk4_tracks[team].push(...arr);
  });
  shell.guidance.push(...(payload.guidance||[]));
  shell.img_proc.push(...(payload.img_proc||[]));
  shell.target_selection.push(...(payload.target_selection||[]));
  shell.nfz_areas.push(...(payload.nfz_areas||[]));
  return shell;
}

function finalizeShell(shell){
  // her diziyi zamana göre sırala (garanti olsun diye)
  Object.values(shell.rival_tracks).forEach(a=>a.sort((x,y)=>x.t-y.t));
  Object.values(shell.rk4_tracks).forEach(a=>a.sort((x,y)=>x.t-y.t));
  shell.guidance.sort((a,b)=>a.t-b.t);
  shell.img_proc.sort((a,b)=>a.t-b.t);
  shell.target_selection.sort((a,b)=>a.t-b.t);
  shell.nfz_areas.sort((a,b)=>a.t-b.t);

  // HSS event çiftleri: nfz_areas her zone_index için "aktifleşme anı" tek
  // satır olarak geliyor (şartname: hakem duyurusuyla bir kez çekilir).
  // Kapanış bilgisini ayıramıyorsak (bu şemada yok), varsayılan olarak
  // oturumun sonuna kadar aktif kabul ederiz; gerçek açık/kapa çifti
  // eklenirse burada güncellenecek.
  const zonesSeen = {};
  shell.hssEvents = [];
  shell.nfz_areas.forEach(row=>{
    if(!(row.zone_index in zonesSeen)){
      zonesSeen[row.zone_index] = true;
      shell.hssEvents.push({
        id: row.zone_index, lat: row.lat, lon: row.lon, yaricap: row.radius,
        opened_t: row.t, closed_t: null,
      });
    }
  });

  return shell;
}

function discoverTeams(shell){
  const teams = new Set();
  Object.keys(shell.rival_tracks).forEach(t=>teams.add(t));
  return Array.from(teams).map(Number).sort((a,b)=>a-b);
}

function assignTeamColors(teams){
  TEAM_COLORS = {};
  teams.forEach((team, i)=>{
    TEAM_COLORS[team] = TEAM_COLOR_PALETTE[i % TEAM_COLOR_PALETTE.length];
  });
}

// ============================================================
// BAŞLATMA — PLAYBACK
// ============================================================
async function initPlayback(){
  if(!CURRENT_SESSION){ setLoading(true, null, 'Önce bir oturum seçilmeli.'); return; }
  setLoading(true, 'Oturum sınırları alınıyor…');
  try{
    const bounds = await loadBounds(CURRENT_SESSION);
    sessionStartT = bounds.start;
    sessionEndT = bounds.end;

    setLoading(true, `Veri çekiliyor (${(sessionEndT-sessionStartT).toFixed(0)} sn)…`);
    const payload = await loadRange(CURRENT_SESSION, sessionStartT, sessionEndT);

    const shell = finalizeShell(mergePayloadInto(emptyDataShell(), payload));
    DATA = shell;
    TEAM_LIST = discoverTeams(shell);
    assignTeamColors(TEAM_LIST);
    selectedTeam = TEAM_LIST[0] ?? null;

    curT = sessionStartT;
    setConn(true, `Bağlı — playback (${TEAM_LIST.length} uçak)`);

    afterDataReady();
    setLoading(false);
  } catch(err){
    setLoading(true, null, `Backend'e bağlanılamadı: ${err.message}\n\nKontrol et: uvicorn main:app --port 8010 çalışıyor mu? config.js'deki BACKEND_URL doğru mu?`);
    setConn(false, 'Bağlantı yok');
  }
}

// ============================================================
// BAŞLATMA — LIVE
// ============================================================
async function initLive(){
  if(!CURRENT_SESSION){ setLoading(true, null, 'Önce bir oturum seçilmeli.'); return; }
  setLoading(true, 'Canlı akışa bağlanılıyor…');
  try{
    const bounds = await loadBounds(CURRENT_SESSION);
    sessionStartT = bounds.start;
    sessionEndT = bounds.end; // live modda bu sürekli ilerleyecek

    DATA = emptyDataShell();
    // Geçmişte kalan tüm veriyi bir kerede çekip başlıyoruz (dosyanın o ana kadarki hali)
    const payload = await loadRange(CURRENT_SESSION, sessionStartT, sessionEndT);
    finalizeShell(mergePayloadInto(DATA, payload));
    TEAM_LIST = discoverTeams(DATA);
    assignTeamColors(TEAM_LIST);
    selectedTeam = TEAM_LIST[0] ?? null;

    liveCheckpoint = sessionEndT;
    curT = sessionEndT; // live'da playhead her zaman en güncel ana yapışık
    playing = false; // live'da "oynatma" kavramı yok, veri kendi akıyor

    setConn(true, `Bağlı — LIVE (${LIVE_POLL_INTERVAL_MS}ms polling)`);

    afterDataReady();
    setLoading(false);

    if(liveTimer) clearInterval(liveTimer);
    liveTimer = setInterval(pollLive, LIVE_POLL_INTERVAL_MS);
  } catch(err){
    setLoading(true, null, `Backend'e bağlanılamadı: ${err.message}`);
    setConn(false, 'Bağlantı yok');
  }
}

async function pollLive(){
  try{
    const payload = await loadLatest(CURRENT_SESSION, liveCheckpoint);
    const hadNew = Object.values(payload.rival_tracks||{}).some(a=>a.length>0)
                || (payload.guidance||[]).length>0;
    mergePayloadInto(DATA, payload);
    finalizeShell(DATA);

    const newTeams = discoverTeams(DATA);
    if(newTeams.length !== TEAM_LIST.length){
      TEAM_LIST = newTeams;
      assignTeamColors(TEAM_LIST);
      if(selectedTeam===null) selectedTeam = TEAM_LIST[0] ?? null;
      buildTeamList();
    }

    if(payload.latest_ts) liveCheckpoint = payload.latest_ts;
    sessionEndT = Math.max(sessionEndT, liveCheckpoint);
    curT = sessionEndT; // playhead'i en yeni veriye kilitle

    if(hadNew){ setConn(true, `Bağlı — LIVE (son güncelleme: ${new Date().toLocaleTimeString('tr-TR')})`); }
    buildEventMarkers();
    buildModeStrip();
  } catch(err){
    setConn(false, `Live bağlantı hatası: ${err.message}`);
  }
}

function stopLive(){
  if(liveTimer){ clearInterval(liveTimer); liveTimer=null; }
}

// ============================================================
// UI: yükleniyor / bağlantı durumu
// ============================================================
function setLoading(show, msg, err){
  const el = document.getElementById('loadingOverlay');
  el.style.display = show ? 'flex' : 'none';
  if(msg) document.getElementById('loadingMsg').innerHTML = msg;
  if(err){
    document.getElementById('loadingMsg').innerHTML = `<div class="err">⚠ ${err}</div>`;
  }
}
function setConn(ok, label){
  const pill = document.getElementById('connStatus');
  pill.classList.toggle('offline', !ok);
  document.getElementById('connLabel').textContent = label;
}

// ============================================================
// HARİTA — Leaflet (online) + Canvas offline fallback
// ============================================================
let map, isOffline = false;
let aircraftMarkers = {}, trailPolylines = {}, ghostMarkers = {}, ghostTrails = {};
let hssCircleLayers = {}, mapInited = false;
let CENTER_LAT = 39.82, CENTER_LON = 30.53; // varsayılan; gerçek veri gelince ilk noktaya göre güncellenir

function computeCenterFromData(){
  for(const team of TEAM_LIST){
    const arr = DATA.rival_tracks[team];
    if(arr && arr.length){ return [arr[0].iha_enlem, arr[0].iha_boylam]; }
  }
  return [CENTER_LAT, CENTER_LON];
}

function initMap(){
  const [clat, clon] = computeCenterFromData();
  CENTER_LAT = clat; CENTER_LON = clon;

  map = L.map('map', {zoomControl:false, attributionControl:false, preferCanvas:true})
        .setView([CENTER_LAT, CENTER_LON], 17);

  const sat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19
  });

  let tileFailed = false;
  const failTimer = setTimeout(()=>{ if(!tileFailed){ switchToOffline(); } }, 2500);
  sat.on('load', ()=>{ clearTimeout(failTimer); });
  sat.on('tileerror', ()=>{
    if(!tileFailed){ tileFailed = true; clearTimeout(failTimer); switchToOffline(); }
  });
  sat.addTo(map);
  L.control.zoom({position:'bottomright'}).addTo(map);

  initAircraftMarkersOnline();
  mapInited = true;
}

function switchToOffline(){
  if(isOffline) return;
  isOffline = true;
  document.getElementById('map').style.display='none';
  const canvas = document.getElementById('offlineCanvas');
  canvas.style.display='block';
  document.getElementById('mapModeBadge').innerHTML = 'HARİTA: <b>Çevrimdışı (grid)</b>';
  showToast('Uydu görüntüsü yüklenemedi — çevrimdışı harita moduna geçildi.');
  initOfflineCanvas();
}

function showToast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'), 4000);
}

function aircraftDivIcon(team, heading, isGhost){
  const color = TEAM_COLORS[team] || '#888';
  if(isGhost){
    return L.divIcon({
      className:'',
      html:`<svg width="22" height="22" viewBox="0 0 34 34" style="transform:rotate(${heading}deg);opacity:.85;">
              <polygon points="17,3 24,26 17,21 10,26" fill="none" stroke="#3ba7ff" stroke-width="2.2" stroke-dasharray="3,3"/>
            </svg>`,
      iconSize:[22,22], iconAnchor:[11,11]
    });
  }
  return L.divIcon({
    className:'',
    html:`
      <div style="position:relative;width:34px;height:34px;">
        <svg width="34" height="34" viewBox="0 0 34 34" style="transform:rotate(${heading}deg);filter:drop-shadow(0 0 4px rgba(0,0,0,.7));">
          <polygon points="17,3 24,26 17,21 10,26" fill="${color}" stroke="#0a0e13" stroke-width="1.4"/>
        </svg>
        <div style="position:absolute;top:36px;left:50%;transform:translateX(-50%);font-family:var(--mono);font-size:10px;font-weight:700;color:#fff;text-shadow:0 0 3px #000,0 0 6px #000;white-space:nowrap;">
          T${team}
        </div>
      </div>`,
    iconSize:[34,34], iconAnchor:[17,17]
  });
}

function initAircraftMarkersOnline(){
  TEAM_LIST.forEach(team=>{
    const m = L.marker([CENTER_LAT, CENTER_LON], {icon: aircraftDivIcon(team,0,false), zIndexOffset: 500});
    m.addTo(map);
    aircraftMarkers[team] = m;
    trailPolylines[team] = L.polyline([], {color: TEAM_COLORS[team], weight:3, opacity:.75}).addTo(map);

    if(DATA.rk4_tracks[team] && DATA.rk4_tracks[team].length){
      const g = L.marker([CENTER_LAT, CENTER_LON], {icon: aircraftDivIcon(team,0,true), zIndexOffset: 300, interactive:false});
      g.addTo(map);
      ghostMarkers[team] = g;
      ghostTrails[team] = L.polyline([], {color:'#3ba7ff', weight:1.5, opacity:.5, dashArray:'4,4'}).addTo(map);
    }
  });
}

function syncHSSOnline(t){
  (DATA.hssEvents||[]).forEach(h=>{
    const active = t >= h.opened_t && (h.closed_t===null || t < h.closed_t);
    let entry = hssCircleLayers[h.id];
    if(!entry){
      entry = { layer: L.circle([h.lat,h.lon], {radius:h.yaricap, color:'#ff3b3b', weight:2, fillColor:'#ff3b3b', fillOpacity:.12, dashArray:'6,5'}), added:false };
      hssCircleLayers[h.id] = entry;
    }
    if(active && !entry.added){ entry.layer.addTo(map); entry.added=true; }
    if(!active && entry.added){ map.removeLayer(entry.layer); entry.added=false; }
  });
}

// ---- OFFLINE: Canvas grid renderer ----
let offCtx, offW, offH;
const OFF_SCALE = 55000;
function initOfflineCanvas(){
  const canvas = document.getElementById('offlineCanvas');
  const mainEl = document.querySelector('.main');
  offW = canvas.width = mainEl.clientWidth;
  offH = canvas.height = mainEl.clientHeight;
  offCtx = canvas.getContext('2d');
  window.addEventListener('resize', ()=>{
    offW = canvas.width = mainEl.clientWidth;
    offH = canvas.height = mainEl.clientHeight;
  });
}
function project(lat, lon){
  const x = offW/2 + (lon-CENTER_LON)*OFF_SCALE;
  const y = offH/2 - (lat-CENTER_LAT)*OFF_SCALE;
  return [x,y];
}
function hexToRgba(hex, a){
  const v = hex.replace('#','');
  const r=parseInt(v.substring(0,2),16), g=parseInt(v.substring(2,4),16), b=parseInt(v.substring(4,6),16);
  return `rgba(${r},${g},${b},${a})`;
}
function renderOfflineCanvas(state){
  if(!offCtx) return;
  const ctx = offCtx;
  ctx.clearRect(0,0,offW,offH);
  ctx.fillStyle = '#0a0d10';
  ctx.fillRect(0,0,offW,offH);

  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 1;
  const step = 0.001;
  for(let lon=CENTER_LON-0.01; lon<CENTER_LON+0.01; lon+=step){
    const [x1] = project(0,lon);
    ctx.beginPath(); ctx.moveTo(x1,0); ctx.lineTo(x1,offH); ctx.stroke();
  }
  for(let lat=CENTER_LAT-0.01; lat<CENTER_LAT+0.01; lat+=step){
    const [,y1] = project(lat,0);
    ctx.beginPath(); ctx.moveTo(0,y1); ctx.lineTo(offW,y1); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.beginPath(); ctx.moveTo(offW/2-14,offH/2); ctx.lineTo(offW/2+14,offH/2);
  ctx.moveTo(offW/2,offH/2-14); ctx.lineTo(offW/2,offH/2+14); ctx.stroke();

  const metersPerDeg = 111320;
  const barPx = (100/metersPerDeg)*OFF_SCALE;
  ctx.strokeStyle = '#5c6873'; ctx.lineWidth=2;
  ctx.beginPath(); ctx.moveTo(24, offH-24); ctx.lineTo(24+barPx, offH-24); ctx.stroke();
  ctx.fillStyle = '#9aa7b2'; ctx.font = '10px monospace';
  ctx.fillText('100 m', 24, offH-32);

  ctx.strokeStyle = '#9aa7b2'; ctx.beginPath();
  ctx.moveTo(offW-30, offH-16); ctx.lineTo(offW-30, offH-44);
  ctx.lineTo(offW-24, offH-36); ctx.moveTo(offW-30,offH-44); ctx.lineTo(offW-36,offH-36);
  ctx.stroke();
  ctx.fillText('K', offW-33, offH-48);

  const activeHss = (DATA.hssEvents||[]).filter(h=> state.t>=h.opened_t && (h.closed_t===null || state.t<h.closed_t));
  activeHss.forEach(h=>{
    const [x,y] = project(h.lat, h.lon);
    const r = (h.yaricap/metersPerDeg)*OFF_SCALE;
    ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2);
    ctx.fillStyle='rgba(255,59,59,0.10)'; ctx.fill();
    ctx.strokeStyle='#ff3b3b'; ctx.lineWidth=2; ctx.setLineDash([6,5]); ctx.stroke(); ctx.setLineDash([]);
  });

  TEAM_LIST.forEach(team=>{
    const trail = state.trails[team];
    if(!trail || trail.length<2) return;
    ctx.lineWidth=3;
    for(let i=1;i<trail.length;i++){
      const [x1,y1]=project(trail[i-1].lat, trail[i-1].lon);
      const [x2,y2]=project(trail[i].lat, trail[i].lon);
      const alpha = i/trail.length;
      ctx.strokeStyle = hexToRgba(TEAM_COLORS[team], 0.15+alpha*0.6);
      ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
    }
  });

  if(showGhost){
    TEAM_LIST.forEach(team=>{
      const gt = state.ghostTrails[team];
      if(!gt || gt.length<2) return;
      ctx.setLineDash([4,4]);
      ctx.lineWidth=1.5;
      ctx.strokeStyle = 'rgba(59,167,255,0.55)';
      ctx.beginPath();
      gt.forEach((pt,i)=>{
        const [x,y]=project(pt.lat, pt.lon);
        if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
      });
      ctx.stroke();
      ctx.setLineDash([]);

      const gp = state.ghostPoints[team];
      if(gp){
        const [x,y] = project(gp.lat, gp.lon);
        ctx.beginPath(); ctx.arc(x,y,5,0,Math.PI*2);
        ctx.strokeStyle='#3ba7ff'; ctx.lineWidth=1.8; ctx.stroke();
      }
    });
  }

  TEAM_LIST.forEach(team=>{
    const p = state.points[team];
    if(!p) return;
    const [x,y] = project(p.iha_enlem, p.iha_boylam);
    ctx.save();
    ctx.translate(x,y);
    ctx.rotate((p.iha_yonelme||0)*Math.PI/180);
    ctx.beginPath();
    ctx.moveTo(0,-11); ctx.lineTo(7,10); ctx.lineTo(0,5); ctx.lineTo(-7,10); ctx.closePath();
    ctx.fillStyle = TEAM_COLORS[team];
    ctx.strokeStyle = '#0a0e13'; ctx.lineWidth=1.4;
    ctx.fill(); ctx.stroke();
    ctx.restore();

    ctx.fillStyle='#fff';
    ctx.font='bold 10px monospace';
    ctx.textAlign='center';
    ctx.shadowColor='#000'; ctx.shadowBlur=4;
    ctx.fillText(`T${team}`, x, y+26);
    ctx.shadowBlur=0;
  });
}

// ============================================================
// INTERPOLATION — düzensiz aralıklı gerçek veriden akıcı 60fps
// (gerçek veri 1Hz/10Hz karışık gelebilir; index üzerinden değil,
//  binary-search benzeri en yakın çift üzerinden interpolasyon yapılır)
// ============================================================
function findBracket(arr, t){
  if(!arr || arr.length===0) return null;
  if(t <= arr[0].t) return [arr[0], arr[0], 0];
  if(t >= arr[arr.length-1].t) return [arr[arr.length-1], arr[arr.length-1], 0];
  // basit lineer tarama (veri seti bu boyutta sorun çıkarmaz; büyürse binary search'e çevrilir)
  for(let i=0;i<arr.length-1;i++){
    if(arr[i].t<=t && arr[i+1].t>=t){
      const span = arr[i+1].t-arr[i].t;
      const frac = span>0 ? (t-arr[i].t)/span : 0;
      return [arr[i], arr[i+1], frac];
    }
  }
  return [arr[arr.length-1], arr[arr.length-1], 0];
}

function lerpAngleVal(a,b,frac){
  let da = ((b-a+540)%360)-180;
  return (a+da*frac+360)%360;
}

function interpAt(team, t){
  const arr = DATA.rival_tracks[team];
  const br = findBracket(arr, t);
  if(!br) return null;
  const [a,b,frac] = br;
  return {
    t,
    iha_enlem: a.iha_enlem + (b.iha_enlem-a.iha_enlem)*frac,
    iha_boylam: a.iha_boylam + (b.iha_boylam-a.iha_boylam)*frac,
    iha_irtifa: a.iha_irtifa + (b.iha_irtifa-a.iha_irtifa)*frac,
    iha_dikilme: a.iha_dikilme + (b.iha_dikilme-a.iha_dikilme)*frac,
    iha_yonelme: lerpAngleVal(a.iha_yonelme, b.iha_yonelme, frac),
    iha_yatis: a.iha_yatis + (b.iha_yatis-a.iha_yatis)*frac,
    iha_hiz: a.iha_hiz + (b.iha_hiz-a.iha_hiz)*frac,
    iha_zamanfarki: a.iha_zamanfarki,
  };
}

function interpGhost(team, t){
  const arr = DATA.rk4_tracks[team];
  const br = findBracket(arr, t);
  if(!br) return null;
  const [a,b,frac] = br;
  return {
    lat: a.pred_lat + (b.pred_lat-a.pred_lat)*frac,
    lon: a.pred_lon + (b.pred_lon-a.pred_lon)*frac,
  };
}

function getTrail(team, t){
  const arr = DATA.rival_tracks[team];
  if(!arr || arr.length===0) return [];
  const secs = trailSeconds>=9999 ? (t-sessionStartT) : Math.min(t-sessionStartT, trailSeconds);
  const startT = Math.max(sessionStartT, t-secs);
  const steps = 24;
  const pts=[];
  for(let i=0;i<=steps;i++){
    const tt = startT + (t-startT)*(i/steps);
    const p = interpAt(team, tt);
    if(p) pts.push({lat:p.iha_enlem, lon:p.iha_boylam});
  }
  return pts;
}

function getGhostTrail(team, t){
  const arr = DATA.rk4_tracks[team];
  if(!arr || arr.length===0) return [];
  const secs = 6;
  const startT = Math.max(sessionStartT, t-secs);
  const steps = 10;
  const pts=[];
  for(let i=0;i<=steps;i++){
    const tt = startT + (t-startT)*(i/steps);
    const g = interpGhost(team, tt);
    if(g) pts.push(g);
  }
  return pts;
}

function guidanceModeAt(t){
  const arr = DATA.guidance;
  if(!arr || arr.length===0) return null;
  // "step function": t anındaki en son <= t olan kayıt geçerli mod
  let cur = arr[0];
  for(const row of arr){ if(row.t<=t) cur=row; else break; }
  return cur;
}

function targetSelectionAt(t){
  const arr = DATA.target_selection;
  if(!arr || arr.length===0) return null;
  let cur = arr[0];
  for(const row of arr){ if(row.t<=t) cur=row; else break; }
  return cur;
}

function imgProcAt(t){
  const arr = DATA.img_proc;
  if(!arr || arr.length===0) return null;
  let cur = arr[0];
  for(const row of arr){ if(row.t<=t) cur=row; else break; }
  return cur;
}

// ============================================================
// RENDER LOOP
// ============================================================
function renderFrame(){
  if(!DATA) return;
  const points = {}, trails = {}, ghostPoints = {}, ghostTrails_ = {};
  TEAM_LIST.forEach(team=>{
    points[team] = interpAt(team, curT);
    trails[team] = getTrail(team, curT);
    if(DATA.rk4_tracks[team] && DATA.rk4_tracks[team].length){
      ghostPoints[team] = interpGhost(team, curT);
      ghostTrails_[team] = getGhostTrail(team, curT);
    }
  });

  if(!isOffline && map){
    TEAM_LIST.forEach(team=>{
      const p = points[team];
      if(!p) return;
      const marker = aircraftMarkers[team];
      marker.setLatLng([p.iha_enlem, p.iha_boylam]);
      marker.setIcon(aircraftDivIcon(team, p.iha_yonelme, false));
      trailPolylines[team].setLatLngs(trails[team].map(pt=>[pt.lat,pt.lon]));

      if(ghostMarkers[team]){
        const gp = ghostPoints[team];
        if(gp && showGhost){
          ghostMarkers[team].setLatLng([gp.lat, gp.lon]);
          ghostMarkers[team].setIcon(aircraftDivIcon(team, p.iha_yonelme, true));
          if(!map.hasLayer(ghostMarkers[team])) ghostMarkers[team].addTo(map);
          ghostTrails[team].setLatLngs((ghostTrails_[team]||[]).map(pt=>[pt.lat,pt.lon]));
          if(!map.hasLayer(ghostTrails[team])) ghostTrails[team].addTo(map);
        } else {
          if(map.hasLayer(ghostMarkers[team])) map.removeLayer(ghostMarkers[team]);
          if(map.hasLayer(ghostTrails[team])) map.removeLayer(ghostTrails[team]);
        }
      }
    });
    syncHSSOnline(curT);
  } else {
    renderOfflineCanvas({t:curT, points, trails, ghostPoints, ghostTrails: ghostTrails_});
  }

  updateSidePanel(points);
  updateAlgoPanel(points);
  updateModeOverlay();
  updateTransport();
  updateModeStripPlayhead();
}

function updateSidePanel(points){
  if(selectedTeam===null){
    document.getElementById('teleGrid').innerHTML = `<div style="grid-column:1/-1;color:var(--text-dim);font-family:var(--mono);font-size:11px;">Bu oturumda telemetri gönderen uçak bulunamadı.</div>`;
    document.getElementById('flagRow').innerHTML = '';
    return;
  }
  const p = points[selectedTeam];
  if(!p) return;
  const teleGrid = document.getElementById('teleGrid');
  teleGrid.innerHTML = `
    <div class="tele-item"><div class="label">İrtifa</div><div class="value">${p.iha_irtifa.toFixed(1)}<span class="unit">m</span></div></div>
    <div class="tele-item"><div class="label">Hız</div><div class="value">${p.iha_hiz.toFixed(1)}<span class="unit">m/s</span></div></div>
    <div class="tele-item"><div class="label">Yönelme</div><div class="value">${p.iha_yonelme.toFixed(0)}<span class="unit">°</span></div></div>
    <div class="tele-item"><div class="label">Yatış</div><div class="value">${p.iha_yatis.toFixed(1)}<span class="unit">°</span></div></div>
    <div class="tele-item"><div class="label">Dikilme</div><div class="value">${p.iha_dikilme.toFixed(1)}<span class="unit">°</span></div></div>
    <div class="tele-item"><div class="label">Zaman farkı</div><div class="value">${(p.iha_zamanfarki??0).toFixed(0)}<span class="unit">ms</span></div></div>
  `;
  const flagRow = document.getElementById('flagRow');
  let dist2hss = distanceToNearestActiveHSS(p.iha_enlem, p.iha_boylam, curT);
  const tsel = targetSelectionAt(curT);
  const isTargeted = tsel && tsel.hedef_id === selectedTeam;
  flagRow.innerHTML = `
    ${isTargeted ? `<span class="flag on">● HEDEF SEÇİLİ</span>` : ''}
    ${dist2hss.inside ? `<span class="flag hss-warn">⚠ HSS-${dist2hss.id} İHLALİ</span>` : ''}
  `;
}

function distanceToNearestActiveHSS(lat, lon, t){
  const metersPerDeg = 111320;
  let inside=false, id=null;
  (DATA.hssEvents||[]).filter(h=> t>=h.opened_t && (h.closed_t===null || t<h.closed_t)).forEach(h=>{
    const d = Math.sqrt(Math.pow((lat-h.lat)*metersPerDeg,2)+Math.pow((lon-h.lon)*metersPerDeg*Math.cos(lat*Math.PI/180),2));
    if(d < h.yaricap){ inside=true; id=h.id; }
  });
  return {inside, id};
}

// ---- Guidance / algoritma durum paneli ----
function updateAlgoPanel(points){
  const g = guidanceModeAt(curT);
  const mdef = g ? modeInfo(g.current_mode) : {label:'—', color:'#5c6873', desc:'Bu ana kadar guidance verisi yok'};
  const ip = imgProcAt(curT);
  const tsel = targetSelectionAt(curT);

  const algoBox = document.getElementById('algoBox');
  algoBox.innerHTML = `
    <div class="algo-row"><span class="k">current_mode</span><span class="v mode-chip" style="background:${mdef.color}22;color:${mdef.color};border:1px solid ${mdef.color}55">${mdef.label}</span></div>
    <div class="algo-row"><span class="k">mode_lock</span><span class="v">${g ? (g.mode_lock ? 'KİLİTLİ':'—') : '—'}</span></div>
    <div class="algo-row"><span class="k">info</span><span class="v" style="font-weight:400;color:var(--text-mid);font-size:10.5px;">${g ? g.info : '—'}</span></div>
    <div class="algo-row"><span class="k">hedef_id (target_selection)</span><span class="v">${tsel ? (tsel.hedef_id===-1 ? 'yok' : 'T'+tsel.hedef_id) : '—'}</span></div>
    <div class="algo-row"><span class="k">iha_kilitlenme (img_proc)</span><span class="v">${ip ? (ip.iha_kilitlenme ? 'DENİYOR':'0') : '—'}</span></div>
    <div class="algo-row"><span class="k">img_proc fps</span><span class="v">${ip ? ip.fps : '—'}</span></div>
  `;

  const rk4Diff = document.getElementById('rk4Diff');
  if(selectedTeam!==null && DATA.rk4_tracks[selectedTeam] && DATA.rk4_tracks[selectedTeam].length){
    const ghost = interpGhost(selectedTeam, curT);
    const real = points[selectedTeam];
    if(ghost && real){
      const metersPerDeg = 111320;
      const dLat = (real.iha_enlem-ghost.lat)*metersPerDeg;
      const dLon = (real.iha_boylam-ghost.lon)*metersPerDeg*Math.cos(real.iha_enlem*Math.PI/180);
      const errM = Math.sqrt(dLat*dLat+dLon*dLon);
      rk4Diff.style.display='flex';
      rk4Diff.innerHTML = `<span>RK4 tahmin hatası (T${selectedTeam})</span><span>${errM.toFixed(2)} m</span>`;
    } else { rk4Diff.style.display='none'; }
  } else {
    rk4Diff.style.display='none';
  }
}

function updateModeOverlay(){
  const g = guidanceModeAt(curT);
  const mdef = g ? modeInfo(g.current_mode) : {label:'—', color:'#5c6873'};
  document.getElementById('modeLed').style.background = mdef.color;
  document.getElementById('modeLed').style.boxShadow = `0 0 8px ${mdef.color}`;
  document.getElementById('modeTxt').textContent = mdef.label;
  document.getElementById('modeTxt').style.color = mdef.color;
}

// ============================================================
// MOD ŞERİDİ
// ============================================================
function buildModeStrip(){
  const strip = document.getElementById('modeStrip');
  strip.querySelectorAll('.seg').forEach(e=>e.remove());
  const arr = DATA.guidance;
  if(!arr || arr.length===0) return;
  for(let i=0;i<arr.length;i++){
    const from = arr[i].t;
    const to = (i<arr.length-1) ? arr[i+1].t : sessionEndT;
    const mdef = modeInfo(arr[i].current_mode);
    const left = ((from-sessionStartT)/(sessionEndT-sessionStartT))*100;
    const width = (((to-from))/(sessionEndT-sessionStartT))*100;
    const el = document.createElement('div');
    el.className = 'seg';
    el.style.left = left+'%';
    el.style.width = Math.max(width,0.15)+'%';
    el.style.background = mdef.color;
    el.style.opacity = '0.8';
    el.title = `${mdef.label} — ${fmtTime(from-sessionStartT)}`;
    el.onclick = ()=> seekTo(from+0.05);
    strip.appendChild(el);
  }
}
function updateModeStripPlayhead(){
  const span = sessionEndT-sessionStartT;
  const pct = span>0 ? ((curT-sessionStartT)/span)*100 : 0;
  document.getElementById('modePlayhead').style.left = pct+'%';
}

// ============================================================
// TRANSPORT
// ============================================================
function fmtTime(t){
  const m = Math.floor(t/60);
  const s = (t%60).toFixed(1).padStart(4,'0');
  return `${String(m).padStart(2,'0')}:${s}`;
}
function fmtSessionDur(t){
  const m = Math.floor(t/60), s = Math.floor(t%60);
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function updateTransport(){
  const relT = curT - sessionStartT;
  const dur = sessionEndT - sessionStartT;
  document.getElementById('curTime').textContent = fmtTime(relT);
  document.getElementById('totTime').textContent = fmtTime(dur);
  document.getElementById('sessionDur').textContent = fmtSessionDur(relT);
  const pct = dur>0 ? (relT/dur)*100 : 0;
  document.getElementById('scrubFill').style.width = pct+'%';
  document.getElementById('scrubHandle').style.left = pct+'%';
  document.getElementById('scrubInput').value = dur>0 ? (relT/dur)*1000 : 0;
}

function buildEventMarkers(){
  const container = document.getElementById('eventMarkers');
  container.innerHTML = '';
  const dur = sessionEndT-sessionStartT;
  if(dur<=0) return;
  // kilitlenme denemesi başlangıçları (img_proc.iha_kilitlenme 0->1 geçişleri)
  const arr = DATA.img_proc;
  for(let i=1;i<arr.length;i++){
    if(arr[i].iha_kilitlenme===1 && arr[i-1].iha_kilitlenme===0){
      const pct = ((arr[i].t-sessionStartT)/dur)*100;
      const el = document.createElement('div');
      el.className = 'scrub-marker lock';
      el.style.left = pct+'%';
      el.title = `Kilitlenme denemesi @ ${fmtTime(arr[i].t-sessionStartT)}`;
      el.onclick = (e)=>{ e.stopPropagation(); seekTo(arr[i].t); };
      container.appendChild(el);
    }
  }
}

function seekTo(t){
  if(SOURCE_MODE==='live') return; // live'da manuel scrub yok, playhead her zaman güncel
  curT = Math.max(sessionStartT, Math.min(t, sessionEndT));
  renderFrame();
}

function buildEventList(){
  const el = document.getElementById('eventList');
  let items = [];

  const arr = DATA.img_proc;
  for(let i=1;i<arr.length;i++){
    if(arr[i].iha_kilitlenme===1 && arr[i-1].iha_kilitlenme===0){
      items.push({ t:arr[i].t, html: `
        <div class="ico lock">🔒</div>
        <div class="info"><div class="t">Kilitlenme denemesi başladı</div><div class="m">${fmtTime(arr[i].t-sessionStartT)}</div></div>
      `});
    }
  }
  const g = DATA.guidance;
  for(let i=1;i<g.length;i++){
    if(g[i].current_mode !== g[i-1].current_mode){
      const mdef = modeInfo(g[i].current_mode);
      items.push({ t:g[i].t, html: `
        <div class="ico mode">↻</div>
        <div class="info"><div class="t">Mod değişimi → ${mdef.label}</div><div class="m">${fmtTime(g[i].t-sessionStartT)}</div></div>
      `});
    }
  }
  (DATA.hssEvents||[]).forEach(h=>{
    items.push({ t:h.opened_t, html: `
      <div class="ico hss">▲</div>
      <div class="info"><div class="t">HSS-${h.id} aktif</div><div class="m">${fmtTime(h.opened_t-sessionStartT)} · r=${h.yaricap}m</div></div>
    `});
  });

  items.sort((a,b)=>a.t-b.t);
  if(items.length===0){
    el.innerHTML = `<div style="color:var(--text-dim);font-family:var(--mono);font-size:11px;">Bu oturumda kayda değer olay yok.</div>`;
  } else {
    el.innerHTML = items.map(it=>`<div class="event-item" onclick="seekTo(${it.t})">${it.html}</div>`).join('');
  }
}

function buildTeamList(){
  const el = document.getElementById('teamList');
  if(TEAM_LIST.length===0){
    el.innerHTML = `<div style="color:var(--text-dim);font-family:var(--mono);font-size:11px;">incoming_telemetry tablosunda henüz veri yok.</div>`;
    return;
  }
  el.innerHTML = TEAM_LIST.map(team=>`
    <div class="team-row ${team===selectedTeam?'selected':''}" onclick="selectTeam(${team})">
      <div class="chip" style="background:${TEAM_COLORS[team]}"></div>
      <div class="name">Takım ${team}</div>
      <div class="badge">${DATA.rk4_tracks[team] && DATA.rk4_tracks[team].length ? 'RK4 var' : ''}</div>
    </div>
  `).join('');
}
function selectTeam(team){
  selectedTeam = team;
  buildTeamList();
  renderFrame();
}

function buildHSSList(){
  const el = document.getElementById('hssList');
  if(!DATA.hssEvents || DATA.hssEvents.length===0){
    el.innerHTML = `<span style="color:var(--text-dim);">Bu oturumda HSS bölgesi aktifleşmedi.</span>`;
    return;
  }
  el.innerHTML = DATA.hssEvents.map(h=>{
    const status = curT>=h.opened_t && (h.closed_t===null || curT<h.closed_t) ? 'AKTİF' : (curT<h.opened_t ? 'BEKLEMEDE' : 'KAPALI');
    const color = status==='AKTİF' ? 'var(--hss)' : 'var(--text-dim)';
    return `<div style="display:flex;justify-content:space-between;">
      <span>HSS-${h.id} <span style="color:${color};font-size:9.5px;">${status}</span></span><span>r=${h.yaricap}m</span>
    </div>`;
  }).join('');
}

// ============================================================
// EVENT'LERİN HAZIR OLMASI SONRASI KURULUM
// ============================================================
function afterDataReady(){
  buildTeamList();
  buildEventList();
  buildHSSList();
  buildEventMarkers();
  buildModeStrip();

  if(!mapInited){
    initMap();
  } else {
    // takım listesi live modda değişmiş olabilir, marker'ları yeniden kur
    Object.values(aircraftMarkers).forEach(m=> map && map.removeLayer(m));
    Object.values(trailPolylines).forEach(l=> map && map.removeLayer(l));
    Object.values(ghostMarkers).forEach(m=> map && map.removeLayer(m));
    Object.values(ghostTrails).forEach(l=> map && map.removeLayer(l));
    aircraftMarkers={}; trailPolylines={}; ghostMarkers={}; ghostTrails={};
    if(!isOffline && map) initAircraftMarkersOnline();
  }
  renderFrame();
}

// ============================================================
// PLAYBACK LOOP
// ============================================================
function tick(now){
  if(DATA && SOURCE_MODE==='playback' && playing){
    if(lastFrameTime!=null){
      const dt = (now-lastFrameTime)/1000;
      curT += dt*speed;
      if(curT>=sessionEndT){ curT=sessionEndT; playing=false; updatePlayButton(); }
    }
    lastFrameTime = now;
  } else {
    lastFrameTime = null;
  }
  if(DATA){
    renderFrame();
    buildHSSList();
  }
  requestAnimationFrame(tick);
}

function updatePlayButton(){
  document.getElementById('btnPlay').textContent = playing ? '❚❚' : '▶';
}

// ============================================================
// ANALİZ MODALI — RK4 hata grafiği, kilitlenme istatistikleri, mod süreleri
// ============================================================
async function openAnalysis(){
  if(!CURRENT_SESSION){ return; }
  const overlay = document.getElementById('analysisOverlay');
  const body = document.getElementById('analysisBody');
  document.getElementById('analysisSessionTag').textContent = CURRENT_SESSION;
  overlay.classList.add('show');
  body.innerHTML = `<div class="loading-inline">Analiz hesaplanıyor…</div>`;

  try{
    const a = await loadAnalysis(CURRENT_SESSION);
    body.innerHTML = aiDebriefSectionHTML() + renderAnalysis(a);
    wireAnalysisTeamButtons(a);
    wireAiDebrief();
  } catch(err){
    body.innerHTML = `<div class="loading-inline" style="color:#ff5c5c;">Analiz alınamadı: ${err.message}</div>`;
  }
}

// ---- AI Debrief (yarış sonrası, LLM ile) ----
function aiDebriefSectionHTML(){
  return `
    <div class="analysis-section ai-section">
      <h4>🧠 AI Debrief <span class="tag" id="aiModelTag">yarış sonrası analiz</span></h4>
      <div class="ai-intro">Guidance, RK4 ve kilitlenme metriklerini bir uzman analistmiş gibi
        yorumlar — canlı uçuşta göremediklerinizi çıkarır.</div>
      <button class="btn primary" id="btnAiDebrief" style="margin-top:4px;">✨ Debrief üret</button>
      <div id="aiDebriefOut" class="ai-out" style="display:none;"></div>
    </div>`;
}
function wireAiDebrief(){
  const btn = document.getElementById('btnAiDebrief');
  const out = document.getElementById('aiDebriefOut');
  if(!btn) return;
  // AI yapılandırılmamışsa butonu bilgilendir (anahtar yoksa)
  loadAiStatus().then(s=>{
    document.getElementById('aiModelTag').textContent = s.configured ? s.model : 'anahtar yok';
    if(!s.configured){
      btn.disabled = true;
      out.style.display='block';
      out.innerHTML = `<div class="ai-warn">AI anahtarı tanımlı değil. <code>backend/.env</code> içine
        <code>AI_API_KEY</code> ekleyip backend'i yeniden başlat.</div>`;
    }
  }).catch(()=>{});

  btn.onclick = async ()=>{
    btn.disabled = true;
    const orig = btn.textContent;
    btn.textContent = '⏳ Üretiliyor…';
    out.style.display='block';
    out.innerHTML = `<div class="loading-inline">AI debrief üretiliyor… (birkaç saniye)</div>`;
    try{
      const r = await loadAiDebrief(CURRENT_SESSION);
      document.getElementById('aiModelTag').textContent = r.model || 'AI';
      out.innerHTML = `<div class="ai-md">${miniMarkdown(r.debrief_md)}</div>`;
    }catch(err){
      out.innerHTML = `<div class="ai-warn">Debrief alınamadı: ${err.message}</div>`;
    }finally{
      btn.disabled = false;
      btn.textContent = orig;
    }
  };
}
function closeAnalysis(){
  document.getElementById('analysisOverlay').classList.remove('show');
}

function renderAnalysis(a){
  const rk4Teams = Object.keys(a.rk4_error);
  const kil = a.kilitlenme;
  const modeColors = Object.keys(a.mode_totals_s).reduce((acc,m)=>{ acc[m]=modeInfo(m).color; return acc; },{});
  const totalDur = Object.values(a.mode_totals_s).reduce((s,v)=>s+v,0) || 1;

  return `
    <!-- RK4 tahmin hatası -->
    <div class="analysis-section">
      <h4>RK4 Tahmin Hatası (zaman içinde)</h4>
      ${rk4Teams.length===0 ? `<div style="font-family:var(--mono);font-size:11.5px;color:var(--text-dim);">Bu oturumda RK4 tahmini üretilmiş bir takım yok.</div>` : `
        <div class="team-select-row" id="rk4TeamButtons">
          ${rk4Teams.map((t,i)=>`<button class="team-select-btn ${i===0?'active':''}" data-team="${t}" style="${i===0?`background:${TEAM_COLORS[t]||'#3ba7ff'};border-color:${TEAM_COLORS[t]||'#3ba7ff'}`:''}">Takım ${t}</button>`).join('')}
        </div>
        <div class="analysis-stat-row" id="rk4Stats"></div>
        <div class="chart-wrap" id="rk4Chart"></div>
      `}
    </div>

    <!-- Kilitlenme denemesi istatistikleri -->
    <div class="analysis-section">
      <h4>Kilitlenme Denemesi İstatistikleri <span style="font-weight:400;text-transform:none;font-size:10px;">(img_proc.iha_kilitlenme geçişleri)</span></h4>
      <div class="analysis-stat-row">
        <div class="analysis-stat"><div class="num">${kil.attempt_count}</div><div class="lbl">Toplam deneme</div></div>
        <div class="analysis-stat"><div class="num">${kil.mean_duration_s ?? '—'}</div><div class="lbl">Ort. süre (sn)</div></div>
        <div class="analysis-stat ${kil.max_duration_s>10?'warn':''}"><div class="num">${kil.max_duration_s ?? '—'}</div><div class="lbl">Maks. süre (sn)</div></div>
      </div>
      ${kil.attempts.length>0 ? `
        <table class="attempts-table">
          <thead><tr><th>#</th><th>Başlangıç (oturum içi)</th><th>Süre</th><th>Durum</th></tr></thead>
          <tbody>
            ${kil.attempts.map((att,i)=>`
              <tr>
                <td>${i+1}</td>
                <td>${fmtTime(att.start - a.bounds.start)}</td>
                <td>${att.duration_s}s</td>
                <td class="${att.unfinished?'unfinished':''}">${att.unfinished ? 'Oturum bitene kadar sürdü' : 'Tamamlandı'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : `<div style="font-family:var(--mono);font-size:11.5px;color:var(--text-dim);">Bu oturumda kilitlenme denemesi kaydedilmemiş.</div>`}
    </div>

    <!-- Mod süreleri -->
    <div class="analysis-section">
      <h4>Guidance Mod Süre Dağılımı <span style="font-weight:400;text-transform:none;font-size:10px;">(guidance_info.current_mode)</span></h4>
      <div class="mode-bar-wrap">
        ${Object.entries(a.mode_totals_s).map(([mode,secs])=>{
          const pct = (secs/totalDur)*100;
          return `<div class="mode-bar-seg" style="width:${pct}%;background:${modeColors[mode]}" title="${mode}: ${secs}s">${pct>8 ? mode : ''}</div>`;
        }).join('')}
      </div>
      <div class="mode-bar-legend">
        ${Object.entries(a.mode_totals_s).map(([mode,secs])=>`
          <div class="item"><span class="sw" style="background:${modeColors[mode]}"></span>${mode}: ${secs}s (${((secs/totalDur)*100).toFixed(0)}%)</div>
        `).join('')}
      </div>
    </div>
  `;
}

function wireAnalysisTeamButtons(a){
  const container = document.getElementById('rk4TeamButtons');
  if(!container) return;
  function renderTeam(team){
    const info = a.rk4_error[team];
    document.getElementById('rk4Stats').innerHTML = `
      <div class="analysis-stat"><div class="num">${info.mean_error_m}<span style="font-size:11px;"> m</span></div><div class="lbl">Ortalama hata</div></div>
      <div class="analysis-stat ${info.max_error_m>50?'danger':(info.max_error_m>25?'warn':'')}"><div class="num">${info.max_error_m}<span style="font-size:11px;"> m</span></div><div class="lbl">Maksimum hata</div></div>
      <div class="analysis-stat"><div class="num">${fmtTime(info.max_error_t - a.bounds.start)}</div><div class="lbl">En kötü an</div></div>
    `;
    document.getElementById('rk4Chart').innerHTML = renderLineChartSVG(info.series, a.bounds.start, a.bounds.end);
  }
  container.querySelectorAll('.team-select-btn').forEach(btn=>{
    btn.onclick = ()=>{
      container.querySelectorAll('.team-select-btn').forEach(b=>{ b.classList.remove('active'); b.style.background=''; b.style.borderColor=''; });
      btn.classList.add('active');
      const team = btn.dataset.team;
      btn.style.background = TEAM_COLORS[team] || '#3ba7ff';
      btn.style.borderColor = TEAM_COLORS[team] || '#3ba7ff';
      renderTeam(team);
    };
  });
  renderTeam(container.querySelector('.team-select-btn').dataset.team);
}

// basit, bağımlılıksız SVG çizgi grafiği (harici kütüphane gerektirmez)
function renderLineChartSVG(series, tStart, tEnd){
  if(!series || series.length===0) return `<div style="font-family:var(--mono);font-size:11px;color:var(--text-dim);">Veri yok</div>`;
  const W = 860, H = 150, padL = 36, padR = 10, padT = 10, padB = 20;
  const innerW = W-padL-padR, innerH = H-padT-padB;
  const maxErr = Math.max(...series.map(s=>s.error_m), 1);
  const dur = tEnd - tStart || 1;

  const points = series.map(s=>{
    const x = padL + ((s.t-tStart)/dur)*innerW;
    const y = padT + innerH - (s.error_m/maxErr)*innerH;
    return [x,y];
  });
  const pathD = points.map((p,i)=> (i===0?'M':'L')+p[0].toFixed(1)+','+p[1].toFixed(1)).join(' ');
  const areaD = pathD + ` L${points[points.length-1][0].toFixed(1)},${padT+innerH} L${points[0][0].toFixed(1)},${padT+innerH} Z`;

  // y ekseni etiketleri (0, orta, max)
  const yTicks = [0, maxErr/2, maxErr].map(v=>{
    const y = padT + innerH - (v/maxErr)*innerH;
    return `<text x="${padL-6}" y="${y+3}" text-anchor="end" font-size="9" fill="#5c6873" font-family="monospace">${v.toFixed(0)}m</text>
            <line x1="${padL}" y1="${y}" x2="${padL+innerW}" y2="${y}" stroke="#1e2730" stroke-width="1"/>`;
  }).join('');

  return `
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
      ${yTicks}
      <path d="${areaD}" fill="rgba(59,167,255,0.12)" stroke="none"/>
      <path d="${pathD}" fill="none" stroke="#3ba7ff" stroke-width="1.8"/>
      <text x="${padL}" y="${H-4}" font-size="9" fill="#5c6873" font-family="monospace">0:00</text>
      <text x="${padL+innerW}" y="${H-4}" text-anchor="end" font-size="9" fill="#5c6873" font-family="monospace">${fmtTime(dur)}</text>
    </svg>
  `;
}

// ============================================================
// KAYNAK MODU DEĞİŞTİRME (Playback / Live)
// ============================================================
async function switchSource(mode){
  if(mode===SOURCE_MODE) return;
  SOURCE_MODE = mode;
  document.querySelectorAll('.source-btn').forEach(b=>b.classList.toggle('active', b.dataset.source===mode));
  stopLive();
  playing = false; updatePlayButton();

  document.querySelector('.scrub-track-wrap').style.opacity = mode==='live' ? '0.4' : '1';
  document.getElementById('scrubInput').disabled = (mode==='live');
  document.querySelectorAll('.speed-btn, #btnSkipBack, #btnSkipFwd, #btnPlay').forEach(b=> b.disabled = (mode==='live'));

  if(mode==='playback'){ await initPlayback(); }
  else { await initLive(); }
}

// ============================================================
// EVENT WIRING
// ============================================================
document.getElementById('btnPlay').onclick = ()=>{
  if(SOURCE_MODE==='live') return;
  playing = !playing;
  updatePlayButton();
};
document.getElementById('btnSkipBack').onclick = ()=>{ seekTo(sessionStartT); };
document.getElementById('btnSkipFwd').onclick = ()=>{ seekTo(sessionEndT); };

document.getElementById('scrubInput').addEventListener('input', (e)=>{
  if(SOURCE_MODE==='live') return;
  const frac = e.target.value/1000;
  curT = sessionStartT + frac*(sessionEndT-sessionStartT);
  renderFrame();
});

document.querySelectorAll('.speed-btn').forEach(btn=>{
  btn.onclick = ()=>{
    document.querySelectorAll('.speed-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    speed = parseFloat(btn.dataset.speed);
  };
});

document.getElementById('trailSelect').addEventListener('change', (e)=>{
  trailSeconds = parseInt(e.target.value);
});

document.getElementById('btnToggleGhost').onclick = (e)=>{
  showGhost = !showGhost;
  e.currentTarget.classList.toggle('active', showGhost);
  if(!showGhost && !isOffline && map){
    Object.keys(ghostMarkers).forEach(team=>{
      if(map.hasLayer(ghostMarkers[team])) map.removeLayer(ghostMarkers[team]);
      if(map.hasLayer(ghostTrails[team])) map.removeLayer(ghostTrails[team]);
    });
  }
};

document.querySelectorAll('.source-btn').forEach(btn=>{
  btn.onclick = ()=> switchSource(btn.dataset.source);
});

document.getElementById('sessionSelect').addEventListener('change', async (e)=>{
  const newSession = e.target.value;
  if(!newSession || newSession===CURRENT_SESSION) return;
  CURRENT_SESSION = newSession;
  stopLive();
  playing = false; updatePlayButton();
  if(SOURCE_MODE==='playback'){ await initPlayback(); }
  else { await initLive(); }
});

document.getElementById('btnAnalysis').onclick = openAnalysis;
document.getElementById('btnCloseAnalysis').onclick = closeAnalysis;
document.getElementById('analysisOverlay').addEventListener('click', (e)=>{
  if(e.target.id==='analysisOverlay') closeAnalysis();
});

document.addEventListener('keydown', (e)=>{
  if(e.code==='Escape'){ closeAnalysis(); }
  if(SOURCE_MODE==='live') return;
  if(e.code==='Space'){ e.preventDefault(); playing=!playing; updatePlayButton(); }
  if(e.code==='ArrowRight'){ seekTo(curT+1); }
  if(e.code==='ArrowLeft'){ seekTo(curT-1); }
  if(e.code==='Home'){ seekTo(sessionStartT); }
  if(e.code==='End'){ seekTo(sessionEndT); }
  if(e.key==='j'||e.key==='J'){ speed=Math.max(0.25,speed/2); }
  if(e.key==='l'||e.key==='L'){ speed=Math.min(4,speed*2); }
  if(e.key==='k'||e.key==='K'){ playing=!playing; updatePlayButton(); }
});

document.addEventListener('visibilitychange', ()=>{
  if(document.hidden){ lastFrameTime=null; }
});

// ============================================================
// INIT
// ============================================================
requestAnimationFrame(tick);
(async function boot(){
  await initSessionSelector();
  if(CURRENT_SESSION){ await initPlayback(); }
})();