/* ============================================================
   AAD Uçuş Analiz Sistemi — Uygulama Mantığı (2D / 3D Hibrit)
   ------------------------------------------------------------
   GERÇEK BACKEND'E BAĞLANIR (config.js -> BACKEND_URL).
   İki mod: PLAYBACK / LIVE
   İki görünüm: 2D (Leaflet) / 3D (CesiumJS)
   ============================================================ */

// ---- Global durum ----
let SOURCE_MODE = 'playback';   // 'playback' | 'live'
let VIEW_DIMENSION = '2D';      // '2D' | '3D'
let DATA = null;
let TEAM_COLORS = {};
let TEAM_LIST = [];
let selectedTeam = null;
let curT = 0;
let playing = false;
let speed = 1;
let lastFrameTime = null;
let trailSeconds = 15;
let showGhost = true;
let liveTimer = null;
let liveCheckpoint = null;
let sessionStartT = 0, sessionEndT = 0;
let CURRENT_SESSION = null;
let SESSION_LIST = [];
let wasdInitialized = false;
let tpsControlsInitialized = false;

let lastValidGroundHeights = {};

let isCesiumLocked = false; // TPS Takip modu bayrağı
// TPS Serbest Bakış (Orbit) Değişkenleri
let tpsHeadingOffset = 0.0;                       // Yatay dönme ofseti (Radyan)
let tpsPitchOffset = Cesium.Math.toRadians(-12);  // Dikey bakış açısı (-12 derece)
let tpsDistance = 35.0;                           // Uçağa olan mesafe (Metre)

let isDraggingCesium = false;
let lastMouseX = 0;
let lastMouseY = 0;


const ENABLE_SMOOTHING = true;
const smoothRotations = {};
let smoothCameraHeading = null;


// Taktik Görselleştirme Varlıkları
let cesiumLockLineEntity = null; // Kilitlenme lazeri & mesafe etiketi
let cesiumGhostEntities = {};    // 3D RK4 Hayalet uçak modelleri
let cesiumFovEntities = {};      // Kamera görüş konisi (FOV Frustum)

let cesiumGhostTrails = {};

// Mod tanımlayıcısı
function modeInfo(mode){
  const m = String(mode || '').toLowerCase();
  if(m.includes('kilit')) return { label: 'KİLİTLENME', color: 'var(--accent)' };
  if(m.includes('kamikaze')) return { label: 'KAMİKAZE', color: 'var(--accent-hi)' };
  if(m.includes('takip')) return { label: 'TAKİP', color: '#cccccc' };
  if(m.includes('kacinma')) return { label: 'KAÇINMA', color: '#ffffff' };
  return { label: mode || 'ARAMA', color: '#666666' };
}

// ============================================================
// BACKEND İLETİŞİMİ
// ============================================================
async function fetchJSON(url){
  const res = await fetch(url);
  if(!res.ok){
    const body = await res.text().catch(()=> '');
    throw new Error(`HTTP ${res.status} —${body.slice(0,200)}`);
  }
  return res.json();
}

async function loadSessions(){ return fetchJSON(`${BACKEND_URL}/sessions`); }
async function loadBounds(sessionId){ return fetchJSON(`${BACKEND_URL}/flight/${encodeURIComponent(sessionId)}/bounds`); }
async function loadRange(sessionId, start, end){ return fetchJSON(`${BACKEND_URL}/flight/${encodeURIComponent(sessionId)}/range?start=${start}&end=${end}`); }
async function loadLatest(sessionId, since){ return fetchJSON(`${BACKEND_URL}/flight/${encodeURIComponent(sessionId)}/latest?since=${since}`); }
async function loadAnalysis(sessionId){ return fetchJSON(`${BACKEND_URL}/flight/${encodeURIComponent(sessionId)}/analysis`); }
async function loadAiDebrief(sessionId) {
  const customKey = (localStorage.getItem('AAD_GEMINI_KEY') || '').trim();

  try {
    const res = await fetch(`${BACKEND_URL}/flight/${encodeURIComponent(sessionId)}/ai-debrief`, {
      headers: {
        'x-api-key': customKey
      }
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    console.error('Debrief alınamadı:', err);
    throw err;
  }
}
async function loadAiStatus(){ return fetchJSON(`${BACKEND_URL}/ai-status`); }

function miniMarkdown(md){
  const esc = (s)=> s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const lines = esc(md||'').split('\n');
  let html='', inList=false, inCode=false;
  const inline = (s)=> s.replace(/\*\*([^*]+)\*\*/g,'<b>$1</b>').replace(/`([^`]+)`/g,'<code>$1</code>');
  for(let raw of lines){
    if(/^```/.test(raw)){ inCode=!inCode; html += inCode?'<pre class="ai-pre">':'</pre>'; continue; }
    if(inCode){ html += raw+'\n'; continue; }
    const h = raw.match(/^(#{1,4})\s+(.*)$/);
    if(h){ if(inList){html+='</ul>';inList=false;} const lvl=Math.min(h[1].length+2,5); html+=`<h${lvl} class="ai-h">${inline(h[2])}</h${lvl}>`; continue; }
    const li = raw.match(/^\s*[-*]\s+(.*)$/);
    if(li){ if(!inList){html+='<ul class="ai-ul">';inList=true;} html+=`<li>${inline(li[1])}</li>`; continue; }
    if(inList){html+='</ul>';inList=false;}
    if(raw.trim()==='') { continue; }
    html += `<p>${inline(raw)}</p>`;
  }
  if(inList) html+='</ul>';
  if(inCode) html+='</pre>';
  return html;
}

// ============================================================
// OTURUM SEÇİCİ
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
// ============================================================
function emptyDataShell(){
  return {
    rival_tracks: {},
    rk4_tracks: {},
    guidance: [],
    img_proc: [],
    target_selection: [],
    nfz_areas: [],
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
  Object.values(shell.rival_tracks).forEach(a=>a.sort((x,y)=>x.t-y.t));
  Object.values(shell.rk4_tracks).forEach(a=>a.sort((x,y)=>x.t-y.t));
  shell.guidance.sort((a,b)=>a.t-b.t);
  shell.img_proc.sort((a,b)=>a.t-b.t);
  shell.target_selection.sort((a,b)=>a.t-b.t);
  shell.nfz_areas.sort((a,b)=>a.t-b.t);

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
  const palette = ['#E60000', '#ffffff', '#888888', '#FF4D4D', '#ffaa00', '#00e5ff'];
  teams.forEach((team, i)=>{
    TEAM_COLORS[team] = palette[i % palette.length];
  });
}

// ============================================================
// BAŞLATMA — PLAYBACK / LIVE
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
    setLoading(true, null, `Backend'e bağlanılamadı: ${err.message}\n\nKontrol et: uvicorn main:app --port 8010 çalışıyor mu?`);
    setConn(false, 'Bağlantı yok');
  }
}

async function initLive(){
  if(!CURRENT_SESSION){ setLoading(true, null, 'Önce bir oturum seçilmeli.'); return; }
  setLoading(true, 'Canlı akışa bağlanılıyor…');
  try{
    const bounds = await loadBounds(CURRENT_SESSION);
    sessionStartT = bounds.start;
    sessionEndT = bounds.end;

    DATA = emptyDataShell();
    const payload = await loadRange(CURRENT_SESSION, sessionStartT, sessionEndT);
    finalizeShell(mergePayloadInto(DATA, payload));
    TEAM_LIST = discoverTeams(DATA);
    assignTeamColors(TEAM_LIST);
    selectedTeam = TEAM_LIST[0] ?? null;

    liveCheckpoint = sessionEndT;
    curT = sessionEndT;
    playing = false;

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
    const hadNew = Object.values(payload.rival_tracks||{}).some(a=>a.length>0) || (payload.guidance||[]).length>0;
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
    curT = sessionEndT;

    if(hadNew){ setConn(true, `Bağlı — LIVE (${new Date().toLocaleTimeString('tr-TR')})`); }
    buildEventMarkers();
    buildModeStrip();
  } catch(err){
    setConn(false, `Live bağlantı hatası: ${err.message}`);
  }
}

function stopLive(){
  if(liveTimer){ clearInterval(liveTimer); liveTimer=null; }
}

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
// 2D HARİTA — Leaflet (online) + Canvas offline fallback
// ============================================================
let map, isOffline = false;
let aircraftMarkers = {}, trailPolylines = {}, ghostMarkers = {}, ghostTrails = {};
let hssCircleLayers = {}, mapInited = false;
let CENTER_LAT = 39.82, CENTER_LON = 30.53;

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

  // ArcGIS Uydu Görüntüsü
  const sat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { 
    maxZoom: 19,
    timeout: 10000 // 10 saniye bekleme süresi tanı
  });

  let tileFailed = false;
  // 2.5 sn çok dar olduğu için süreyi 8 saniyeye çıkarıyoruz
  const failTimer = setTimeout(()=>{ 
    if(!tileFailed && !map.hasLayer(sat)){ 
      switchToOffline(); 
    } 
  }, 8000);

  sat.on('load', ()=>{ 
    clearTimeout(failTimer); 
  });

  sat.on('tileerror', (e)=>{ 
    console.warn("Tile yükleme hatası:", e);
    // Tek bir tile hata verince hemen tüm haritayı kapatmasın
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
  showToast('Uydu görüntüsü yüklenemedi — çevrimdışı moda geçildi.');
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
              <polygon points="17,3 24,26 17,21 10,26" fill="none" stroke="#ffffff" stroke-width="2" stroke-dasharray="3,3"/>
            </svg>`,
      iconSize:[22,22], iconAnchor:[11,11]
    });
  }
  return L.divIcon({
    className:'',
    html:`
      <div style="position:relative;width:34px;height:34px;">
        <svg width="34" height="34" viewBox="0 0 34 34" style="transform:rotate(${heading}deg);filter:drop-shadow(0 0 4px rgba(0,0,0,.9));">
          <polygon points="17,3 24,26 17,21 10,26" fill="${color}" stroke="#000000" stroke-width="1.5"/>
        </svg>
        <div style="position:absolute;top:36px;left:50%;transform:translateX(-50%);font-family:var(--mono);font-size:10px;font-weight:700;color:#fff;text-shadow:0 0 3px #000;white-space:nowrap;">
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
    trailPolylines[team] = L.polyline([], {color: TEAM_COLORS[team], weight:3, opacity:.8}).addTo(map);

    if(DATA.rk4_tracks[team] && DATA.rk4_tracks[team].length){
      const g = L.marker([CENTER_LAT, CENTER_LON], {icon: aircraftDivIcon(team,0,true), zIndexOffset: 300, interactive:false});
      g.addTo(map);
      ghostMarkers[team] = g;
      ghostTrails[team] = L.polyline([], {color:'#ffffff', weight:1.5, opacity:.6, dashArray:'4,4'}).addTo(map);
    }
  });
}

function syncHSSOnline(t){
  (DATA.hssEvents||[]).forEach(h=>{
    const active = t >= h.opened_t && (h.closed_t===null || t < h.closed_t);
    let entry = hssCircleLayers[h.id];
    if(!entry){
      entry = { layer: L.circle([h.lat,h.lon], {radius:h.yaricap, color:'#FF0000', weight:2, fillColor:'#FF0000', fillOpacity:.15, dashArray:'6,5'}), added:false };
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
  return [offW/2 + (lon-CENTER_LON)*OFF_SCALE, offH/2 - (lat-CENTER_LAT)*OFF_SCALE];
}
function hexToRgba(hex, a){
  const v = hex.replace('#','');
  return `rgba(${parseInt(v.substring(0,2),16)},${parseInt(v.substring(2,4),16)},${parseInt(v.substring(4,6),16)},${a})`;
}
function renderOfflineCanvas(state){
  if(!offCtx) return;
  const ctx = offCtx;
  ctx.clearRect(0,0,offW,offH);
  ctx.fillStyle = '#050505';
  ctx.fillRect(0,0,offW,offH);

  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 1;
  
  const step = 0.001;
  for(let lon = CENTER_LON - 0.01; lon < CENTER_LON + 0.01; lon += step){
    const [x1] = project(0, lon);
    ctx.beginPath(); ctx.moveTo(x1, 0); ctx.lineTo(x1, offH); ctx.stroke();
  }
  for(let lat = CENTER_LAT - 0.01; lat < CENTER_LAT + 0.01; lat += step){
    const [, y1] = project(lat, 0);
    ctx.beginPath(); ctx.moveTo(0, y1); ctx.lineTo(offW, y1); ctx.stroke();
  }

  const metersPerDeg = 111320;
  const activeHss = (DATA.hssEvents || []).filter(h => state.t >= h.opened_t && (h.closed_t === null || state.t < h.closed_t));
  activeHss.forEach(h=>{
    const [x,y] = project(h.lat, h.lon);
    const r = (h.yaricap/metersPerDeg)*OFF_SCALE;
    ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2);
    ctx.fillStyle='rgba(255,0,0,0.12)'; ctx.fill();
    ctx.strokeStyle='#FF0000'; ctx.lineWidth=2; ctx.stroke();
  });

  TEAM_LIST.forEach(team=>{
    const trail = state.trails[team];
    if(!trail || trail.length<2) return;
    ctx.lineWidth=3;
    for(let i=1;i<trail.length;i++){
      const [x1,y1]=project(trail[i-1].lat, trail[i-1].lon);
      const [x2,y2]=project(trail[i].lat, trail[i].lon);
      ctx.strokeStyle = hexToRgba(TEAM_COLORS[team]||'#ffffff', 0.2 + (i/trail.length)*0.7);
      ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
    }
  });

  TEAM_LIST.forEach(team=>{
    const p = state.points[team];
    if(!p) return;
    const [x,y] = project(p.iha_enlem, p.iha_boylam);
    ctx.save();
    ctx.translate(x,y);
    ctx.rotate((p.iha_yonelme||0)*Math.PI/180);
    ctx.beginPath();
    ctx.moveTo(0,-11); ctx.lineTo(7,10); ctx.lineTo(0,5); ctx.lineTo(-7,10); ctx.closePath();
    ctx.fillStyle = TEAM_COLORS[team] || '#fff';
    ctx.strokeStyle = '#000000'; ctx.lineWidth=1.4;
    ctx.fill(); ctx.stroke();
    ctx.restore();

    ctx.fillStyle='#fff';
    ctx.font='bold 10px monospace';
    ctx.textAlign='center';
    ctx.fillText(`T${team}`, x, y+26);
  });
}

// ============================================================
// 3D HARİTA — CesiumJS Entegrasyonu
// ============================================================
let cesiumViewer = null;
let cesiumEntities = {}, cesiumTrails = {}, cesiumHssEntities = {};




async function initCesium(){
  if(cesiumViewer) return;
  if(typeof Cesium === 'undefined'){
    showToast('Cesium kütüphanesi yüklenemedi!');
    return;
  }

  // Cesium Ion Access Token
  Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub25jZSI6ImpLVGZsM3U1MmxNMzdrTGUiLCJqdGkiOiIwMmMyNzM2Ny04MzgwLTRjNjQtYTlkZS0wMWM1YjBhMTMxMzYiLCJpZCI6NDgwMzQ2LCJpc3MiOiJodHRwczovL2FwaS5jZXNpdW0uY29tIiwiYXVkIjoidW5kZWZpbmVkX2RlZmF1bHQiLCJpYXQiOjE3ODg0ODYzOTR9.QTnjud2xN--ZQQ7_dVE72RFnHnUUFZSVfsdOAsjD0mU';

  // 1. ArcGIS Uydu Katmanı
  const esriProvider = await Cesium.ArcGisMapServerImageryProvider.fromUrl(
    'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer',
    { enablePickFeatures: false }
  );

  // 2. 3D Arazi (Terrain)
  const terrainProvider = await Cesium.createWorldTerrainAsync({
    requestVertexNormals: true
  });

  // 3. Cesium Viewer Kurulumu
  cesiumViewer = new Cesium.Viewer('cesiumContainer', {
    baseLayer: new Cesium.ImageryLayer(esriProvider),
    terrainProvider: terrainProvider,
    terrainExaggeration: 3.0,
    animation: false,
    timeline: false,
    baseLayerPicker: false,
    geocoder: false,
    homeButton: false,
    sceneModePicker: false,
    navigationHelpButton: false,
    infoBox: false,
    selectionIndicator: false
  });

  cesiumViewer.scene.globe.depthTestAgainstTerrain = true;

  // 4. 3D OSM Binaları
  try {
    const buildings = await Cesium.createOsmBuildingsAsync();
    cesiumViewer.scene.primitives.add(buildings);
  } catch(e) {
    console.warn("Bina katmanı yüklenemedi:", e);
  }

  // 5. Takım İHA'ları ve HSS Varlıklarını Kur
  setupCesiumEntities();

  // 6. Serbest Kamera Başlangıcı
  cesiumViewer.trackedEntity = undefined;
  const [clat, clon] = computeCenterFromData();
  const startGroundH = cesiumViewer.scene.globe.getHeight(Cesium.Cartographic.fromDegrees(clon, clat)) || 785;

  cesiumViewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(clon, clat - 0.003, startGroundH + 120),
    orientation: {
      heading: Cesium.Math.toRadians(0),
      pitch: Cesium.Math.toRadians(-20),
      roll: 0.0
    },
    duration: 1
  });

  // 7. Kontrol Dinleyicileri
  setupCesiumWASD();
  setupTPSCameraControls();
}

function setupCesiumEntities(){
  if(!cesiumViewer || !DATA) return;

  cesiumViewer.entities.removeAll();
  cesiumEntities = {};
  cesiumTrails = {};
  cesiumHssEntities = {};
  cesiumGhostEntities = {};
  cesiumGhostTrails = {};
  cesiumFovEntities = {};

  // 1. Model Konfigürasyonları (Dosya yolu, özel ölçek ve eksen düzeltmesi)
  const TEAM_CONFIGS = [
    { 
      uri: '/models/Shadowmk.glb', 
      scale: 0.005, 
      pitchOffset: 0.0 // Shadowmk5 düzgün duruyor
    },
    { 
      uri: '/models/kartal.glb',    
    scale: 0.005, 
    headingOffset: -Cesium.Math.PI_OVER_TWO, // Burnunu iz yönüne 90° çevirir
    pitchOffset: 0,
    rollOffset: Cesium.Math.PI_OVER_TWO     // Kanat yatıklığını 90° düzeltir
    },
    { 
      uri: '/models/dorje.glb',    
      scale: 0.005, 
      pitchOffset: -Cesium.Math.PI_OVER_TWO // Burnunu 90° aşağı indirir (-90°)
    }
  ];

  // 2. Kilitlenme Vektörü
  cesiumLockLineEntity = cesiumViewer.entities.add({
    name: 'Kilitlenme Hattı',
    polyline: {
      positions: [],
      width: 2.5,
      material: new Cesium.PolylineDashMaterialProperty({
        color: Cesium.Color.RED,
        dashLength: 16.0
      })
    },
    label: {
      text: '',
      font: 'bold 12px monospace',
      fillColor: Cesium.Color.RED,
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 3,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      pixelOffset: new Cesium.Cartesian2(0, -10),
      showBackground: true,
      backgroundColor: new Cesium.Color(0, 0, 0, 0.6)
    },
    show: false
  });

  // 3. Takım Varlıkları
  TEAM_LIST.forEach((team, idx) => {
    const colorHex = TEAM_COLORS[team] || '#ffffff';
    const cColor = Cesium.Color.fromCssColorString(colorHex);

    // Takıma göre model konfigürasyonunu seç (Modülo ile döner)
    const config = TEAM_CONFIGS[(Number(team) - 1) % TEAM_CONFIGS.length] || TEAM_CONFIGS[idx % TEAM_CONFIGS.length];

    // Başlangıç konumu ve düzeltilmiş yönelim hesabı
    const initialPos = Cesium.Cartesian3.fromDegrees(CENTER_LON, CENTER_LAT, 100);
    const initialHpr = new Cesium.HeadingPitchRoll(0.0, config.pitchOffset, 0.0);
    const initialOrientation = Cesium.Transforms.headingPitchRollQuaternion(initialPos, initialHpr);

    // Gerçek 3D Uçak Modeli
    cesiumEntities[team] = cesiumViewer.entities.add({
      name: `Takım ${team}`,
      position: initialPos,
      orientation: initialOrientation,
      model: {
        uri: config.uri,
        minimumPixelSize: 16,
        maximumScale: 2,
        scale: config.scale,
        runAnimations: true,
        shadows: Cesium.ShadowMode.ENABLED,
        heightReference: Cesium.HeightReference.NONE
      },
      label: {
        text: `T${team}`,
        font: '11px monospace',
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -18),
        heightReference: Cesium.HeightReference.NONE,
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      }
    });

    // Gerçek Uçuş İzi
    cesiumTrails[team] = cesiumViewer.entities.add({
      polyline: {
        positions: new Cesium.CallbackProperty(() => {
          const tPts = getTrail(team, curT);
          if(!tPts || tPts.length < 2) return [];
          const baseH = lastValidGroundHeights[team] ?? 785;
          return tPts.map(pt => Cesium.Cartesian3.fromDegrees(pt.lon, pt.lat, baseH + Math.max(pt.alt || 5, 2)));
        }, false),
        width: 3,
        material: cColor
      }
    });

    // 3D RK4 Hayalet Uçak Modeli
    if(DATA.rk4_tracks[team] && DATA.rk4_tracks[team].length){
      cesiumGhostEntities[team] = cesiumViewer.entities.add({
        name: `RK4 Hayalet T${team}`,
        position: initialPos,
        orientation: initialOrientation,
        model: {
          uri: config.uri,
          minimumPixelSize: 16,
          maximumScale: 2,
          scale: config.scale,
          color: Cesium.Color.WHITE.withAlpha(0.4),
          colorBlendMode: Cesium.ColorBlendMode.MIX,
          colorBlendAmount: 0.8,
          heightReference: Cesium.HeightReference.NONE
        },
        label: {
          text: `T${team} [RK4]`,
          font: '9px monospace',
          fillColor: Cesium.Color.CYAN,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new Cesium.Cartesian2(0, -14),
          disableDepthTestDistance: Number.POSITIVE_INFINITY
        },
        show: false
      });

      // 3D RK4 Kesikli Hayalet İzi
      cesiumGhostTrails[team] = cesiumViewer.entities.add({
        polyline: {
          positions: new Cesium.CallbackProperty(() => {
            if(team === selectedTeam || !showGhost) return [];
            const gPts = getGhostTrail(team, curT);
            if(!gPts || gPts.length < 2) return [];
            const baseH = lastValidGroundHeights[team] ?? 785;
            return gPts.map(pt => Cesium.Cartesian3.fromDegrees(pt.lon, pt.lat, baseH + Math.max(pt.alt || 5, 2)));
          }, false),
          width: 2,
          material: new Cesium.PolylineDashMaterialProperty({
            color: Cesium.Color.WHITE.withAlpha(0.6),
            dashLength: 8.0
          })
        },
        show: showGhost
      });
    }

    // Görüş Konisi (FOV)
    cesiumFovEntities[team] = cesiumViewer.entities.add({
      name: `FOV T${team}`,
      position: initialPos,
      cylinder: {
        length: 50.0,
        topRadius: 0.0,
        bottomRadius: 18.0,
        material: Cesium.Color.fromCssColorString(colorHex).withAlpha(0.12),
        outline: true,
        outlineColor: Cesium.Color.fromCssColorString(colorHex).withAlpha(0.4)
      },
      show: false
    });
  });

  // 4. HSS Bölgeleri
  (DATA.hssEvents || []).forEach(h => {
    cesiumHssEntities[h.id] = cesiumViewer.entities.add({
      position: Cesium.Cartesian3.fromDegrees(h.lon, h.lat, 935),
      cylinder: {
        length: 300.0,
        topRadius: h.yaricap,
        bottomRadius: h.yaricap,
        material: Cesium.Color.RED.withAlpha(0.25),
        outline: true,
        outlineColor: Cesium.Color.RED
      },
      show: false
    });
  });
}

function syncCesium(points){
  if(!cesiumViewer) return;

  const currentPositions = {};
  const tsel = targetSelectionAt(curT);

  // Hedef Kontrolü: hedef_id tanımsız, -1 veya geçersizse null yap
  let lockedTargetId = null;
  if(tsel && tsel.hedef_id !== undefined && tsel.hedef_id !== null && tsel.hedef_id !== -1){
    // Eğer hedef ID takım listesinde varsa ve KENDİ UÇAĞIMIZ DEĞİLSE geçerli hedeftir
    if(TEAM_LIST.includes(tsel.hedef_id) && tsel.hedef_id !== selectedTeam){
      lockedTargetId = tsel.hedef_id;
    }
  }

  // 1. Takım İHA'ları, Oryantasyon, FOV ve Rakiplerin RK4'ü
  TEAM_LIST.forEach(team => {
    const p = points[team];
    const ent = cesiumEntities[team];
    if(!p || !ent) return;

    // Zemin Kotu & İrtifa Hesabı
    const carto = Cesium.Cartographic.fromDegrees(p.iha_boylam, p.iha_enlem);
    const sampleH = cesiumViewer.scene.globe.getHeight(carto);
    if(sampleH !== undefined && sampleH !== null){
      lastValidGroundHeights[team] = sampleH;
    }
    const groundH = lastValidGroundHeights[team] ?? 785;
    const actualAlt = groundH + Math.max(p.iha_irtifa || 0, 1.5);

    const pos = Cesium.Cartesian3.fromDegrees(p.iha_boylam, p.iha_enlem, actualAlt);
    ent.position = pos;
    currentPositions[team] = pos;

    // Telemetri Açıları
    const heading = Cesium.Math.toRadians((p.iha_yonelme || 0) - 90);
    const pitch = Cesium.Math.toRadians(p.iha_dikilme || 0);
    const roll = Cesium.Math.toRadians(p.iha_yatis || 0);
    const hpr = new Cesium.HeadingPitchRoll(heading, pitch, roll);
    const targetQuat = Cesium.Transforms.headingPitchRollQuaternion(pos, hpr);

    const activeQuat = calculateSmoothOrientation(team, targetQuat);
    ent.orientation = activeQuat;

    // Görüş Konisi (Yalnızca menüden seçilen bizim uçakta açık)
    const fovEnt = cesiumFovEntities[team];
    if(fovEnt){
      if(team === selectedTeam){
        fovEnt.show = true;
        fovEnt.position = pos;
        const forwardOffset = new Cesium.HeadingPitchRoll(heading, pitch - Cesium.Math.toRadians(90), roll);
        fovEnt.orientation = Cesium.Transforms.headingPitchRollQuaternion(pos, forwardOffset);
      } else {
        fovEnt.show = false;
      }
    }

    // 3D RK4 Hayalet Modeli: Seçili takım HARİÇ diğer tüm rakiplerde çizilir
    const ghostEnt = cesiumGhostEntities[team];
    if(ghostEnt){
      const isRival = (team !== selectedTeam);
      const ghostData = interpGhost(team, curT);

      if(isRival && ghostData && showGhost){
        const ghostGroundH = lastValidGroundHeights[team] ?? 785;
        const gPos = Cesium.Cartesian3.fromDegrees(
          ghostData.lon, 
          ghostData.lat, 
          ghostGroundH + Math.max(ghostData.alt || 5, 2)
        );
        ghostEnt.position = gPos;
        ghostEnt.orientation = activeQuat;
        ghostEnt.show = true;
      } else {
        ghostEnt.show = false;
      }
    }
  });

  // 2. Kilitlenme Hattı (Laser Boresight) ve Mesafe Etiketi
  if(cesiumLockLineEntity){
    const ip = imgProcAt(curT);
    const isLocking = (ip && ip.iha_kilitlenme === 1) || (lockedTargetId !== null);

    // Kendimizden farklı, gerçek ve sahnede konumu olan bir rakip varsa çizgiyi çiz
    if(isLocking && selectedTeam !== null && lockedTargetId !== null && 
       selectedTeam !== lockedTargetId && 
       currentPositions[selectedTeam] && currentPositions[lockedTargetId]){

      const myPos = currentPositions[selectedTeam];
      const enemyPos = currentPositions[lockedTargetId];

      cesiumLockLineEntity.show = true;
      cesiumLockLineEntity.polyline.positions = [myPos, enemyPos];

      const distM = Cesium.Cartesian3.distance(myPos, enemyPos);
      const isHardLock = (ip && ip.iha_kilitlenme === 1);

      // Etiketi iki uçağın tam ortasına yerleştir
      const midPos = Cesium.Cartesian3.midpoint(myPos, enemyPos, new Cesium.Cartesian3());
      cesiumLockLineEntity.position = midPos;
      cesiumLockLineEntity.label.text = `${isHardLock ? '🔒 KİLİTLİ' : '🎯 HEDEF'}: ${distM.toFixed(0)}m`;
      cesiumLockLineEntity.label.fillColor = isHardLock ? Cesium.Color.RED : Cesium.Color.YELLOW;
      cesiumLockLineEntity.polyline.material.color = isHardLock ? Cesium.Color.RED : Cesium.Color.YELLOW;
    } else {
      // Hedef yoksa veya mesafe 0 ise etiketi ve çizgiyi tamamen gizle
      cesiumLockLineEntity.show = false;
      cesiumLockLineEntity.polyline.positions = [];
    }
  }

  // 3. TPS Takip Kamerası
  if(isCesiumLocked && selectedTeam !== null && points[selectedTeam]){
    const selP = points[selectedTeam];
    const groundH = lastValidGroundHeights[selectedTeam] ?? 785;
    const actualAlt = groundH + Math.max(selP.iha_irtifa || 0, 1.5);
    const targetPos = Cesium.Cartesian3.fromDegrees(selP.iha_boylam, selP.iha_enlem, actualAlt);

    const rawHeadingRad = Cesium.Math.toRadians(selP.iha_yonelme || 0);
    const activeHeading = calculateSmoothCameraHeading(rawHeadingRad);
    const finalHeading = activeHeading + tpsHeadingOffset;

    cesiumViewer.camera.lookAt(
      targetPos,
      new Cesium.HeadingPitchRange(
        finalHeading,
        tpsPitchOffset,
        tpsDistance
      )
    );
  }

  // 4. HSS Bölgeleri
  (DATA.hssEvents || []).forEach(h => {
    const active = curT >= h.opened_t && (h.closed_t === null || curT < h.closed_t);
    if(cesiumHssEntities[h.id]){
      cesiumHssEntities[h.id].show = active;
    }
  });
}


async function toggleDimension(){
  const map2d = document.getElementById('map');
  const map3d = document.getElementById('cesiumContainer');
  const badge = document.getElementById('mapModeBadge');
  const btn = document.getElementById('btnViewDimension');

  if(VIEW_DIMENSION === '2D'){
    VIEW_DIMENSION = '3D';
    map2d.style.display = 'none';
    map3d.style.display = 'block';
    badge.innerHTML = 'HARİTA: <b>3D Görünüm (Cesium)</b>';
    btn.textContent = '🗺️ 2D MODA GEÇ';
    if(!cesiumViewer) {
      await initCesium();
    } else {
      cesiumViewer.resize();
    }
  } else {
    VIEW_DIMENSION = '2D';
    map3d.style.display = 'none';
    map2d.style.display = 'block';
    badge.innerHTML = 'HARİTA: <b>Uydu görüntüsü (2D)</b>';
    btn.textContent = '🌐 3D MODA GEÇ';
    if(map) map.invalidateSize();
  }
}

// ============================================================
// INTERPOLATION & HESAPLAMA
// ============================================================
function findBracket(arr, t){
  if(!arr || arr.length===0) return null;
  if(t <= arr[0].t) return [arr[0], arr[0], 0];
  if(t >= arr[arr.length-1].t) return [arr[arr.length-1], arr[arr.length-1], 0];
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
    alt: (a.pred_irtifa||50) + ((b.pred_irtifa||50)-(a.pred_irtifa||50))*frac
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
    if(p) pts.push({lat:p.iha_enlem, lon:p.iha_boylam, alt:p.iha_irtifa});
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

  if(VIEW_DIMENSION === '3D'){
    syncCesium(points);
  } else {
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
  document.getElementById('teleGrid').innerHTML = `
    <div class="tele-item"><div class="label">İrtifa</div><div class="value">${p.iha_irtifa.toFixed(1)}<span class="unit">m</span></div></div>
    <div class="tele-item"><div class="label">Hız</div><div class="value">${p.iha_hiz.toFixed(1)}<span class="unit">m/s</span></div></div>
    <div class="tele-item"><div class="label">Yönelme</div><div class="value">${p.iha_yonelme.toFixed(0)}<span class="unit">°</span></div></div>
    <div class="tele-item"><div class="label">Yatış</div><div class="value">${p.iha_yatis.toFixed(1)}<span class="unit">°</span></div></div>
    <div class="tele-item"><div class="label">Dikilme</div><div class="value">${p.iha_dikilme.toFixed(1)}<span class="unit">°</span></div></div>
    <div class="tele-item"><div class="label">Zaman farkı</div><div class="value">${(p.iha_zamanfarki??0).toFixed(0)}<span class="unit">ms</span></div></div>
  `;
  const dist2hss = distanceToNearestActiveHSS(p.iha_enlem, p.iha_boylam, curT);
  const tsel = targetSelectionAt(curT);
  document.getElementById('flagRow').innerHTML = `
    ${(tsel && tsel.hedef_id === selectedTeam) ? `<span class="flag on">● HEDEF SEÇİLİ</span>` : ''}
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

function updateAlgoPanel(points){
  const g = guidanceModeAt(curT);
  const mdef = g ? modeInfo(g.current_mode) : { label: '—', color: '#666666' };
  const ip = imgProcAt(curT);
  const tsel = targetSelectionAt(curT);

  document.getElementById('algoBox').innerHTML = `
    <div class="algo-row"><span class="k">current_mode</span><span class="v mode-chip" style="background:#111;color:${mdef.color};border:1px solid #333">${mdef.label}</span></div>
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
  const mdef = g ? modeInfo(g.current_mode) : { label: '—', color: '#666666' };
  document.getElementById('modeLed').style.background = mdef.color;
  document.getElementById('modeLed').style.boxShadow = `0 0 8px ${mdef.color}`;
  document.getElementById('modeTxt').textContent = mdef.label;
  document.getElementById('modeTxt').style.color = mdef.color;
}

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
  if(SOURCE_MODE==='live') return;
  curT = Math.max(sessionStartT, Math.min(t, sessionEndT));
  renderFrame();
}

function buildEventList(){
  const el = document.getElementById('eventList');
  let items = [];
  const arr = DATA.img_proc;
  for(let i=1;i<arr.length;i++){
    if(arr[i].iha_kilitlenme===1 && arr[i-1].iha_kilitlenme===0){
      items.push({ t:arr[i].t, html: `<div class="ico lock">🔒</div><div class="info"><div class="t">Kilitlenme denemesi başladı</div><div class="m">${fmtTime(arr[i].t-sessionStartT)}</div></div>`});
    }
  }
  const g = DATA.guidance;
  for(let i=1;i<g.length;i++){
    if(g[i].current_mode !== g[i-1].current_mode){
      const mdef = modeInfo(g[i].current_mode);
      items.push({ t:g[i].t, html: `<div class="ico mode">↻</div><div class="info"><div class="t">Mod değişimi → ${mdef.label}</div><div class="m">${fmtTime(g[i].t-sessionStartT)}</div></div>`});
    }
  }
  (DATA.hssEvents||[]).forEach(h=>{
    items.push({ t:h.opened_t, html: `<div class="ico hss">▲</div><div class="info"><div class="t">HSS-${h.id} aktif</div><div class="m">${fmtTime(h.opened_t-sessionStartT)} · r=${h.yaricap}m</div></div>`});
  });

  items.sort((a,b)=>a.t-b.t);
  el.innerHTML = items.length===0 ? `<div style="color:var(--text-dim);font-family:var(--mono);font-size:11px;">Bu oturumda kayda değer olay yok.</div>`
    : items.map(it=>`<div class="event-item" onclick="seekTo(${it.t})">${it.html}</div>`).join('');
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
  
  // Takım değiştiğinde kamerayı yeni uçağın doğrudan arkasına hizala
  tpsHeadingOffset = 0.0;
  tpsPitchOffset = Cesium.Math.toRadians(-12);
  resetSmoothingState();
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

function afterDataReady(){
  buildTeamList();
  buildEventList();
  buildHSSList();
  buildEventMarkers();
  buildModeStrip();

  // Cesium sahnede açıksa yeni oturumun uçak modellerini yükle
  if(cesiumViewer){
    setupCesiumEntities();
  }

  if(!mapInited){
    initMap();
  } else {
    Object.values(aircraftMarkers).forEach(m=> map && map.removeLayer(m));
    Object.values(trailPolylines).forEach(l=> map && map.removeLayer(l));
    Object.values(ghostMarkers).forEach(m=> map && map.removeLayer(m));
    Object.values(ghostTrails).forEach(l=> map && map.removeLayer(l));
    aircraftMarkers={}; trailPolylines={}; ghostMarkers={}; ghostTrails={};
    if(!isOffline && map) initAircraftMarkersOnline();
  }
  renderFrame();
}
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
// ANALİZ MODAL
// ============================================================
async function openAnalysis(){
  if(!CURRENT_SESSION) return;
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

function aiDebriefSectionHTML(){
  return `
    <div class="analysis-section ai-section">
      <h4>🧠 AI Debrief <span class="tag" id="aiModelTag">yarış sonrası analiz</span></h4>
      <div class="ai-intro">Guidance, RK4 ve kilitlenme metriklerini bir uzman analistmiş gibi yorumlar.</div>
      <button class="btn primary" id="btnAiDebrief" style="margin-top:4px;">✨ Debrief üret</button>
      <div id="aiDebriefOut" class="ai-out" style="display:none;"></div>
    </div>`;
}

function wireAiDebrief(){
  const btn = document.getElementById('btnAiDebrief');
  const out = document.getElementById('aiDebriefOut');
  const tag = document.getElementById('aiModelTag');
  const keyInput = document.getElementById('userApiKeyInput');
  const btnSaveKey = document.getElementById('btnSaveApiKey');

  if(!btn) return;

  // Arayüzü güncelleyen çekirdek kontrol
  function syncStatus(serverConfigured = false, serverModel = 'AI') {
  const localKey = (localStorage.getItem('AAD_GEMINI_KEY') || '').trim();
  const isReady = serverConfigured || Boolean(localKey);

  if (isReady) {
    btn.disabled = false;
    if (tag) {
      tag.textContent = localKey
        ? (localKey.startsWith('AQ') || localKey.startsWith('AIzaSy')
            ? 'gemini-3.6-flash'
            : 'özel anahtar')
        : serverModel;
    }
    if (out && out.innerHTML.includes('AI anahtarı tanımlı değil')) {
      out.style.display = 'none';
      out.innerHTML = '';
    }
  } else {
    btn.disabled = false; // Kullanıcı offline analiz alabilsin diye kilitlemiyoruz
    if (tag) tag.textContent = 'anahtar yok';
    if (out) {
      out.style.display = 'block';
      out.innerHTML = `<div class="ai-warn">AI anahtarı tanımlı değil. Üstteki kutudan Gemini API anahtarınızı girip KAYDET butonuna basabilirsiniz.</div>`;
    }
  }
}

  // Modal içindeki Kaydet butonu dinleyicisi
  if (btnSaveKey && keyInput) {
    keyInput.value = localStorage.getItem('AAD_GEMINI_KEY') || '';
    btnSaveKey.onclick = () => {
      const val = keyInput.value.trim();
      localStorage.setItem('AAD_GEMINI_KEY', val);
      showToast(val ? 'API Anahtarı tarayıcıya kaydedildi' : 'API Anahtarı temizlendi');
      syncStatus(false);
    };
  }

  // Sunucu durumunu sorgula
  loadAiStatus().then(s => {
    syncStatus(s.configured, s.model);
  }).catch(() => {
    syncStatus(false);
  });

  // Debrief Üret Butonu
  btn.onclick = async ()=>{
    btn.disabled = true;
    const orig = btn.textContent;
    btn.textContent = '⏳ Üretiliyor…';
    out.style.display = 'block';
    out.innerHTML = `<div class="loading-inline">AI debrief üretiliyor…</div>`;
    try{
      const r = await loadAiDebrief(CURRENT_SESSION);
      if (tag) tag.textContent = r.model || 'AI';
      out.innerHTML = `<div class="ai-md">${miniMarkdown(r.debrief_md)}</div>`;
    }catch(err){
      out.innerHTML = `<div class="ai-warn">Debrief alınamadı: ${err.message}</div>`;
    }finally{
      btn.disabled = false;
      btn.textContent = orig;
    }
  };
}

function closeAnalysis(){ document.getElementById('analysisOverlay').classList.remove('show'); }

function renderAnalysis(a){
  const rk4Teams = Object.keys(a.rk4_error);
  const kil = a.kilitlenme;
  const totalDur = Object.values(a.mode_totals_s).reduce((s,v)=>s+v,0) || 1;

  return `
    <div class="analysis-section">
      <h4>RK4 Tahmin Hatası (zaman içinde)</h4>
      ${rk4Teams.length===0 ? `<div style="font-family:var(--mono);font-size:11.5px;color:var(--text-dim);">Bu oturumda RK4 tahmini üretilmiş bir takım yok.</div>` : `
        <div class="team-select-row" id="rk4TeamButtons">
          ${rk4Teams.map((t,i)=>`<button class="team-select-btn ${i===0?'active':''}" data-team="${t}" style="${i===0?`background:${TEAM_COLORS[t]||'#fff'};color:#000;`:''}">Takım ${t}</button>`).join('')}
        </div>
        <div class="analysis-stat-row" id="rk4Stats"></div>
        <div class="chart-wrap" id="rk4Chart"></div>
      `}
    </div>
    <div class="analysis-section">
      <h4>Kilitlenme Denemesi İstatistikleri</h4>
      <div class="analysis-stat-row">
        <div class="analysis-stat"><div class="num">${kil.attempt_count}</div><div class="lbl">Toplam deneme</div></div>
        <div class="analysis-stat"><div class="num">${kil.mean_duration_s ?? '—'}</div><div class="lbl">Ort. süre (sn)</div></div>
        <div class="analysis-stat ${kil.max_duration_s>10?'warn':''}"><div class="num">${kil.max_duration_s ?? '—'}</div><div class="lbl">Maks. süre (sn)</div></div>
      </div>
    </div>
    <div class="analysis-section">
      <h4>Guidance Mod Süre Dağılımı</h4>
      <div class="mode-bar-wrap">
        ${Object.entries(a.mode_totals_s).map(([mode,secs])=>`<div class="mode-bar-seg" style="width:${(secs/totalDur)*100}%;background:var(--accent)" title="${mode}: ${secs}s"></div>`).join('')}
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
      container.querySelectorAll('.team-select-btn').forEach(b=>{ b.classList.remove('active'); b.style.background=''; b.style.color=''; });
      btn.classList.add('active');
      const team = btn.dataset.team;
      btn.style.background = TEAM_COLORS[team] || '#fff';
      btn.style.color = '#000';
      renderTeam(team);
    };
  });
  renderTeam(container.querySelector('.team-select-btn').dataset.team);
}

function renderLineChartSVG(series, tStart, tEnd){
  if(!series || series.length===0) return `<div style="font-family:var(--mono);font-size:11px;color:var(--text-dim);">Veri yok</div>`;
  const W = 860, H = 150, padL = 36, padR = 10, padT = 10, padB = 20;
  const innerW = W-padL-padR, innerH = H-padT-padB;
  const maxErr = Math.max(...series.map(s=>s.error_m), 1);
  const dur = tEnd - tStart || 1;

  const points = series.map(s=> [padL + ((s.t-tStart)/dur)*innerW, padT + innerH - (s.error_m/maxErr)*innerH]);
  const pathD = points.map((p,i)=> (i===0?'M':'L')+p[0].toFixed(1)+','+p[1].toFixed(1)).join(' ');
  const areaD = pathD + ` L${points[points.length-1][0].toFixed(1)},${padT+innerH} L${points[0][0].toFixed(1)},${padT+innerH} Z`;

  return `
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
      <path d="${areaD}" fill="rgba(230,0,0,0.15)" stroke="none"/>
      <path d="${pathD}" fill="none" stroke="#E60000" stroke-width="1.8"/>
      <text x="${padL}" y="${H-4}" font-size="9" fill="#666" font-family="monospace">0:00</text>
      <text x="${padL+innerW}" y="${H-4}" text-anchor="end" font-size="9" fill="#666" font-family="monospace">${fmtTime(dur)}</text>
    </svg>
  `;
}

// ============================================================
// EVENT WIRING & KONTROLLER
// ============================================================
document.getElementById('btnViewDimension').onclick = toggleDimension;

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

document.getElementById('trailSelect').addEventListener('change', (e)=>{ trailSeconds = parseInt(e.target.value); });
document.getElementById('btnToggleGhost').onclick = (e)=>{
  showGhost = !showGhost;
  e.currentTarget.classList.toggle('active', showGhost);
  
  // 3D Hayalet modellerini ve izlerini aç/kapat
  Object.keys(cesiumGhostEntities).forEach(team => {
    if(team === String(selectedTeam)){
      if(cesiumGhostEntities[team]) cesiumGhostEntities[team].show = false;
      if(cesiumGhostTrails[team]) cesiumGhostTrails[team].show = false;
    } else {
      if(cesiumGhostEntities[team]) cesiumGhostEntities[team].show = showGhost;
      if(cesiumGhostTrails[team]) cesiumGhostTrails[team].show = showGhost;
    }
  });
};

document.querySelectorAll('.source-btn').forEach(btn=>{
  btn.onclick = async ()=>{
    const mode = btn.dataset.source;
    if(mode===SOURCE_MODE) return;
    SOURCE_MODE = mode;
    document.querySelectorAll('.source-btn').forEach(b=>b.classList.toggle('active', b.dataset.source===mode));
    stopLive();
    playing = false; updatePlayButton();
    if(mode==='playback'){ await initPlayback(); } else { await initLive(); }
  };
});

document.getElementById('sessionSelect').addEventListener('change', async (e)=>{
  const newSession = e.target.value;
  if(!newSession || newSession===CURRENT_SESSION) return;
  CURRENT_SESSION = newSession;
  stopLive();
  playing = false; updatePlayButton();
  if(cesiumViewer){
    cesiumViewer.entities.removeAll();
    cesiumEntities={}; cesiumTrails={}; cesiumHssEntities={};
  }
  if(SOURCE_MODE==='playback'){ await initPlayback(); } else { await initLive(); }
});

document.getElementById('btnAnalysis').onclick = openAnalysis;
document.getElementById('btnCloseAnalysis').onclick = closeAnalysis;
document.getElementById('analysisOverlay').addEventListener('click', (e)=>{ if(e.target.id==='analysisOverlay') closeAnalysis(); });

document.addEventListener('keydown', (e)=>{
  if(e.code==='Escape'){ closeAnalysis(); }
  if(SOURCE_MODE==='live') return;
  if(e.code==='Space'){ e.preventDefault(); playing=!playing; updatePlayButton(); }
  if(e.code==='ArrowRight'){ seekTo(curT+1); }
  if(e.code==='ArrowLeft'){ seekTo(curT-1); }
});

// ============================================================
// BOOTSTRAP
// ============================================================
requestAnimationFrame(tick);
(async function boot(){
  await initSessionSelector();
  if(CURRENT_SESSION){ await initPlayback(); }
})();

// TPS Kilitleme Geçiş Fonksiyonu
function toggleCesiumLock(){
  if(VIEW_DIMENSION !== '3D' || !cesiumViewer) return;

  isCesiumLocked = !isCesiumLocked;
  const sscController = cesiumViewer.scene.screenSpaceCameraController;

  if(!isCesiumLocked){
    sscController.enableRotate = true;
    sscController.enableTranslate = true;
    sscController.enableZoom = true;
    sscController.enableTilt = true;
    cesiumViewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
    resetSmoothingState();
    showToast('Kamera Serbest Moda Geçti');
  } else {
    sscController.enableRotate = false;
    sscController.enableTranslate = false;
    sscController.enableTilt = false;
    resetSmoothingState();
    showToast('Kamera Uçağa Kilitlendi (TPS Modu)');
  }
}

// C Tuşuna Basınca Kilitle/Bırak
window.addEventListener('keydown', (e)=>{
  if(e.code === 'KeyC' || e.key === 'c' || e.key === 'C'){
    // Input alanlarına yazı yazarken tetiklenmesin
    if(['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
    toggleCesiumLock();
  }
});

// WASD Kamera Kontrol Durumları
const keyStates = {
  KeyW: false,
  KeyS: false,
  KeyA: false,
  KeyD: false,
  KeyQ: false, // İsteğe bağlı: Yukarı yükselme
  KeyE: false  // İsteğe bağlı: Aşağı alçalma
};

// Tuşa basıldığında durumu true yap
window.addEventListener('keydown', (e) => {
  if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
  if (keyStates.hasOwnProperty(e.code)) {
    keyStates[e.code] = true;
  }
});

// Tuş bırakıldığında durumu false yap
window.addEventListener('keyup', (e) => {
  if (keyStates.hasOwnProperty(e.code)) {
    keyStates[e.code] = false;
  }
});

// Cesium Render Döngüsünde Kamerayı WASD ile Hareket Ettir
function setupCesiumWASD() {
  if (!cesiumViewer || wasdInitialized) return;
  wasdInitialized = true;
  

  cesiumViewer.scene.preRender.addEventListener(() => {
    // TPS kilit modundaysa WASD kamerayı yerinden oynatmasın
    if (isCesiumLocked) return;

    const camera = cesiumViewer.camera;
    // Kameranın yerden yüksekliğine göre hareket hızını dinamik ayarla (Yakındayken yavaş, uzaktayken hızlı)
    const height = camera.positionCartographic.height;
    const moveRate = Math.max(height * 0.05, 3.0); // Minimum 5 metre/frame

    if (keyStates.KeyW) {
      camera.moveForward(moveRate);
    }
    if (keyStates.KeyS) {
      camera.moveBackward(moveRate);
    }
    if (keyStates.KeyA) {
      camera.moveLeft(moveRate);
    }
    if (keyStates.KeyD) {
      camera.moveRight(moveRate);
    }
    if (keyStates.KeyQ) {
      camera.moveUp(moveRate);
    }
    if (keyStates.KeyE) {
      camera.moveDown(moveRate);
    }
  });
}

function setupTPSCameraControls() {
  
  const container = document.getElementById('cesiumContainer');
  if (!container) return;
  if (tpsControlsInitialized) return;
  tpsControlsInitialized = true;

  // Fareye basıldığında sürüklemeyi başlat
  container.addEventListener('mousedown', (e) => {
    if (!isCesiumLocked || e.button !== 0) return;
    isDraggingCesium = true;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
  });

  // Fare sürüklendikçe etrafa bakma açılarını güncelle
  window.addEventListener('mousemove', (e) => {
    if (!isCesiumLocked || !isDraggingCesium) return;

    const deltaX = e.clientX - lastMouseX;
    const deltaY = e.clientY - lastMouseY;

    lastMouseX = e.clientX;
    lastMouseY = e.clientY;

    const sensitivity = 0.005;
    tpsHeadingOffset += deltaX * sensitivity;
    tpsPitchOffset -= deltaY * sensitivity;

    // Baş aşağı dönmeyi engellemek için dikey bakış sınırları (-85° ile +10°)
    tpsPitchOffset = Cesium.Math.clamp(
      tpsPitchOffset, 
      Cesium.Math.toRadians(-85), 
      Cesium.Math.toRadians(15)
    );
  });

  // Fare bırakıldığında sürüklemeyi bitir
  window.addEventListener('mouseup', () => {
    isDraggingCesium = false;
  });

  // Fare tekerleği ile uçağa yakınlaşma / uzaklaşma
  container.addEventListener('wheel', (e) => {
    if (!isCesiumLocked) return;
    e.preventDefault();

    const zoomSpeed = 2.5;
    if (e.deltaY > 0) {
      tpsDistance = Math.min(tpsDistance + zoomSpeed, 150); // Maksimum 150m uzaklık
    } else {
      tpsDistance = Math.max(tpsDistance - zoomSpeed, 5);   // Minimum 5m yakınlık
    }
  }, { passive: false });
}

function resetSmoothingState() {
  smoothCameraHeading = null;
  for (const k in smoothRotations) delete smoothRotations[k];
}

function calculateSmoothOrientation(team, targetQuat) {
  if (!ENABLE_SMOOTHING) return targetQuat;

  if (!smoothRotations[team]) {
    smoothRotations[team] = targetQuat.clone();
  } else {
    // 0.12: Dönüş tepki katsayısı (0-1 arası, yükseldikçe sertleşir)
    Cesium.Quaternion.slerp(smoothRotations[team], targetQuat, 0.12, smoothRotations[team]);
  }
  return smoothRotations[team];
}

function calculateSmoothCameraHeading(rawHeadingRad) {
  if (!ENABLE_SMOOTHING) return rawHeadingRad;

  if (smoothCameraHeading === null) {
    smoothCameraHeading = rawHeadingRad;
  } else {
    // Açı atlamalarını önleyen en kısa yay farkı
    const diff = ((rawHeadingRad - smoothCameraHeading + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    // 0.08: Kamera takip yay katsayısı
    smoothCameraHeading += diff * 0.08;
  }
  return smoothCameraHeading;
}



