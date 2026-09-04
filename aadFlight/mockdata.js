/* ============================================================
   AAD Uçuş Analiz Sistemi — Mock Veri Üreteci
   ------------------------------------------------------------
   Bu dosya, gerçek backend (FastAPI + SQLite) hazır olana kadar
   arayüzü test etmek için kullanılan sahte veri kaynağıdır.

   ŞARTNAMEYLE UYUMLU ALANLAR (TEKNOFEST 2026 Haberleşme Dokümanı):
     iha_enlem, iha_boylam, iha_irtifa, iha_dikilme, iha_yonelme,
     iha_yatis, iha_hiz, iha_batarya, iha_otonom, iha_kilitlenme,
     hedef_merkez_X/Y, hedef_genislik/yukseklik

   Not (Erdeniz, 06.08.2026): iha_kilitlenme değişkeni kilitlendiğimiz
   anı değil, kilitlenmeye ÇALIŞTIĞIMIZ anı ifade eder. Ayrı ve
   bağımsız bir sinyaldir — /api/kilitlenme_bilgisi ile karıştırılmaz.

   Not (Erdeniz, 06.08.2026): HSS bölgeleri hakemden bir kez çekilip
   ROS'ta nfz_areas topiğine publish edilir. Logger bunu AÇILIŞTA bir
   kez, KAPANIŞTA bir kez kaydeder — sürekli polling değil, event
   tabanlıdır. Bu mock veri de bu modeli yansıtıyor (hss_events).

   TAHMİNİ ŞEMA (ROS tarafı — Erdeniz & Mehmet netleştirecek):
   Aşağıdaki "algorithm_state" ve "rk4_predictions" alanları henüz
   kesinleşmemiş, mantıklı bir varsayımla dolduruldu. Gerçek tablo
   şeması geldiğinde yalnızca bu dosyadaki üretim mantığının backend
   fetch'e devredilmesi yeterli olacak; app.js'in geri kalanı
   değişmeden çalışır.
   ============================================================ */

const TEAM_COLORS = { 1: '#22d3c4', 2: '#ff9f1c', 3: '#a78bfa' };
const TEAM_NAMES  = { 1: 'Takım 1 (Biz)', 2: 'Takım 2', 3: 'Takım 3' };
const OWN_TEAM = 1;

const CENTER_LAT = 41.5118, CENTER_LON = 36.1193;

// Algoritma modları — tahmini durum makinesi (ROS tarafı netleştirecek)
const MODES = {
  ARAMA:      { label: 'ARAMA',      color: 'var(--mode-arama)',      desc: 'Hedef taranıyor' },
  TAKIP:      { label: 'TAKİP',      color: 'var(--mode-takip)',      desc: 'Hedef takip ediliyor (PN guidance)' },
  KILITLENME: { label: 'KİLİTLENME', color: 'var(--mode-kilitlenme)', desc: 'Kilitlenmeye çalışılıyor' },
  KAMIKAZE:   { label: 'KAMİKAZE',   color: 'var(--mode-kamikaze)',   desc: 'QR hedefine iniş' },
  KACINMA:    { label: 'KAÇINMA',    color: 'var(--mode-kacinma)',    desc: 'HSS bölgesinden kaçınma manevrası' },
};

function generateMockData(){
  const DURATION = 90; // saniye
  const HZ = 1;
  const tracks = {1: [], 2: [], 3: []};
  const rk4 = {1: [], 2: [], 3: []}; // RK4 tahmini konum (yalnızca rakipler için anlamlı)

  function pathFn(team, t){
    const speedFactor = {1:1, 2:0.85, 3:1.15}[team];
    const radius = {1:0.0028, 2:0.0021, 3:0.0035}[team];
    const phase = {1:0, 2:2.1, 3:4.2}[team];
    const angle = phase + t*0.09*speedFactor;
    const wobble = Math.sin(t*0.3+phase)*0.0006;
    const lat = CENTER_LAT + Math.sin(angle)*radius + wobble;
    const lon = CENTER_LON + Math.cos(angle)*radius*1.3;
    const irtifa = 35 + Math.sin(t*0.15+phase)*12 + team*3;
    const yonelme = ((angle*180/Math.PI)+90+360)%360;
    const yatis = Math.sin(t*0.2+phase)*25;
    const dikilme = Math.sin(t*0.25+phase)*6;
    const hiz = 26 + Math.sin(t*0.4+phase)*6 + team*2;
    return {lat, lon, irtifa, yonelme, yatis, dikilme, hiz};
  }

  // Kendi İHA'mızın (Takım 1) mod zaman çizelgesi
  const ownModeTimeline = [
    { from: 0,  to: 12, mode: 'ARAMA' },
    { from: 12, to: 27, mode: 'TAKIP' },
    { from: 27, to: 35, mode: 'KILITLENME' },
    { from: 35, to: 48, mode: 'ARAMA' },
    { from: 48, to: 58, mode: 'KACINMA' },      // HSS'e yaklaşma
    { from: 58, to: 63, mode: 'TAKIP' },
    { from: 63, to: 70, mode: 'KILITLENME' },
    { from: 70, to: 84, mode: 'KAMIKAZE' },
    { from: 84, to: DURATION, mode: 'ARAMA' },
  ];
  function modeAt(t){
    for(const seg of ownModeTimeline){ if(t>=seg.from && t<seg.to) return seg.mode; }
    return 'ARAMA';
  }

  for(let t=0; t<=DURATION; t+=1/HZ){
    [1,2,3].forEach(team=>{
      const p = pathFn(team, t);
      const point = {
        t: t,
        iha_enlem: p.lat,
        iha_boylam: p.lon,
        iha_irtifa: p.irtifa,
        iha_dikilme: p.dikilme,
        iha_yonelme: p.yonelme,
        iha_yatis: p.yatis,
        iha_hiz: p.hiz,
        iha_batarya: Math.max(15, 90 - t*0.5 - team*3),
        iha_otonom: t>15 ? 1 : 0,
        iha_kilitlenme: (team===OWN_TEAM && (modeAt(t)==='KILITLENME')) ? 1 : 0,
        hedef_merkez_x: (team===OWN_TEAM && modeAt(t)==='KILITLENME') ? 300+Math.sin(t)*40 : null,
        hedef_merkez_y: (team===OWN_TEAM && modeAt(t)==='KILITLENME') ? 230+Math.cos(t)*20 : null,
      };
      tracks[team].push(point);

      // RK4 tahmini: rakip uçaklar için ~0.6-1.2s ileriye dönük konum tahmini,
      // gerçek konuma göre küçük bir sapma (tahmin hatası) eklenmiş
      if(team !== OWN_TEAM){
        const lead = 0.8; // saniye ileri tahmin
        const pf = pathFn(team, t+lead);
        const noise = 0.00006; // ~6-7m tahmini hata payı
        rk4[team].push({
          t,
          pred_lat: pf.lat + (Math.sin(t*7+team)*noise),
          pred_lon: pf.lon + (Math.cos(t*5+team)*noise),
        });
      }
    });
  }

  const kilitlenmeler = [
    { t: 33.1, otonom: 1, hedef: 2 },
    { t: 68.4, otonom: 0, hedef: 3 }
  ];
  const kamikazeler = [
    { start: 70, end: 84, qr: 'teknofest2025' }
  ];

  // HSS event-tabanlı: hakem duyurusuyla AÇILIR, sonra KAPANIR (sürekli polling değil)
  const hssEvents = [
    { id:0, lat: CENTER_LAT+0.0018, lon: CENTER_LON-0.0022, yaricap: 55, opened_t: 44,  closed_t: 78 },
    { id:1, lat: CENTER_LAT-0.0012, lon: CENTER_LON+0.0031, yaricap: 45, opened_t: 0,   closed_t: null }, // oturum başından beri aktif
    { id:2, lat: CENTER_LAT+0.0030, lon: CENTER_LON+0.0009, yaricap: 70, opened_t: 20,  closed_t: 60 },
    { id:3, lat: CENTER_LAT-0.0026, lon: CENTER_LON-0.0006, yaricap: 90, opened_t: 50,  closed_t: null },
  ];

  const qrTarget = { lat: CENTER_LAT+0.0008, lon: CENTER_LON+0.0018 };

  return {
    duration: DURATION, tracks, rk4,
    kilitlenmeler, kamikazeler, hssEvents, qrTarget,
    ownModeTimeline
  };
}

function hssActiveAt(hssEvents, t){
  return hssEvents.filter(h => t >= h.opened_t && (h.closed_t===null || t < h.closed_t));
}