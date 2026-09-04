"""
AAD Uçuş Analiz Sistemi — Playback + Live + Çoklu Oturum + Analiz API
------------------------------------------------------------------------
GERÇEK VERİYLE ÇALIŞACAK ŞEKİLDE YAZILDI (flight_YYYYMMDD_HHMMSS.db şemasına göre).

YENİ (bu sürümde):
  - Çoklu oturum desteği: backend/sessions/ klasöründeki TÜM .db dosyaları
    otomatik keşfedilir, frontend'de dropdown ile seçilir. Eskiden tek bir
    DB_PATH sabitti; artık her istek bir session_id (dosya adı) taşır.
  - /sessions              -> mevcut tüm oturumları listeler
  - /flight/{sid}/analysis -> RK4 tahmin hatası zaman serisi + kilitlenme
    denemesi istatistikleri + mod geçiş süreleri (tek seferde hesaplanır,
    playback sırasında tekrar tekrar hesaplamak yerine bir kere sorulur)

Tablolar (gerçek loglama sisteminden — Erdeniz & Mehmet):
  incoming_telemetry(timestamp, takim_numarasi, iha_enlem, iha_boylam, iha_irtifa,
                      iha_dikilme, iha_yonelme, iha_yatis, iha_hiz, iha_zamanfarki)
  rk4_predictions(timestamp, takim_numarasi, marked, iha_enlem, iha_boylam, iha_irtifa,
                   iha_dikilme, iha_yonelme, iha_yatis, iha_hiz, iha_ivme,
                   iha_donus_hizi, iha_zamanfarki)
  guidance_info(timestamp, current_mode, mode_lock, info)
      -> current_mode gözlenen değerler: "Nothing", "Path Chase", "Pro Nav"
         (yarışma ilerledikçe yeni mod isimleri de gelebilir, sabit liste değil)
  img_proc(timestamp, target_track_id, iha_kilitlenme, fps)
  img_proc_planes(timestamp, track_id, bbox_x, bbox_y, bbox_w, bbox_h,
                   ucak_buyuklugu, kitlenme_dortgeni, merkez_hatasi_x,
                   merkez_hatasi_y, kitlenme_suresi, kilitlenme_durumu)
  target_selection(timestamp, hedef_id)   -- hedef_id=-1 -> hedef seçili değil
  nfz_areas(timestamp, zone_index, latitude, longitude, radius)   -- HSS bölgeleri
  session_config(id, timestamp, filename, content)   -- YAML config dump, playback dışı

ÜÇ ÇALIŞMA MODU:
  1) PLAYBACK — /flight/{sid}/range: tamamlanmış bir .db dosyasını baştan
     sona oynatmak için. Frontend bir kere tüm aralığı çeker.
  2) LIVE — /flight/{sid}/latest: dosya hâlâ yazılırken (WAL modunda)
     polling ile yalnızca yeni satırları çeker.
  3) ANALYSIS — /flight/{sid}/analysis: tüm oturumu tek seferde tarayıp
     RK4 hata istatistiği, kilitlenme başarı oranı, mod süreleri hesaplar.

Klasör yapısı:
  backend/
    main.py
    sessions/
      flight_20260806_083857.db
      flight_20260807_140212.db
      ...

Çalıştırma:
    pip install fastapi uvicorn --break-system-packages
    uvicorn main:app --reload --port 8010

Not (WAL modu): Test edildi — logger WAL modunda yazarken bu API'nin ayrı
bağlantıyla eşzamanlı okuma yapması sorun çıkarmıyor (bkz. proje notları).
"""

import sqlite3
import os
import glob
from contextlib import contextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

# Tüm .db dosyaları bu klasörde aranır. Yoksa otomatik oluşturulur.
SESSIONS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sessions")
os.makedirs(SESSIONS_DIR, exist_ok=True)

app = FastAPI(title="AAD Uçuş Analiz — Playback + Live + Analiz API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def resolve_db_path(session_id: str) -> str:
    """session_id, sessions/ klasöründeki bir dosya adı (uzantısız da olabilir)."""
    # Path traversal koruması: yalnızca dosya adı, klasör gezinmesi yok
    safe_name = os.path.basename(session_id)
    candidate = os.path.join(SESSIONS_DIR, safe_name)
    if not candidate.endswith(".db"):
        candidate += ".db"
    if not os.path.isfile(candidate):
        raise HTTPException(status_code=404, detail=f"Oturum bulunamadı: {session_id}")
    return candidate


@contextmanager
def get_conn(session_id: str):
    db_path = resolve_db_path(session_id)
    # check_same_thread=False: FastAPI istekleri farklı thread'lerden gelebilir
    conn = sqlite3.connect(db_path, timeout=5, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


def rows_to_dicts(rows):
    return [dict(r) for r in rows]


def fetch_range(conn, table: str, columns: str, start: float, end: float, extra_where: str = ""):
    where = f"timestamp BETWEEN ? AND ?"
    if extra_where:
        where += f" AND {extra_where}"
    q = f"SELECT {columns} FROM {table} WHERE {where} ORDER BY timestamp"
    return rows_to_dicts(conn.execute(q, (start, end)).fetchall())


def fetch_range_decimated(conn, table: str, columns: str, start: float, end: float,
                          max_points: int, extra_where: str = "", partition: str = "takim_numarasi"):
    """Aynı fetch_range gibi ama satır sayısı max_points'i aşıyorsa SEYRELTİR.
    Neden: incoming_telemetry gibi tablolar 1239 sn'lik uçuşta 5.9 MİLYON satıra
    ulaşabiliyor (logger saniyede binlerce satır yazıyor). Haritada saniyede
    ~10-20 nokta yeterli; hepsini çekmek 2 dk sürüyor.

    ÖNEMLİ (bug düzeltmesi): Seyreltme HER AKIŞ KENDİ İÇİNDE, zaman sırasına göre
    yapılmalı. Naif `rowid % stride` yöntemi, aynı tabloda birden çok takımın
    satırları iç içe geçtiği için bir takımın izini bozup zigzag'a yol açıyordu
    (ölçüldü: 7° → 128° dönüş açısı). Bunun yerine ROW_NUMBER() ile her takımı
    (partition) kendi zaman sıralı dizisi içinde her N'inci satırdan örnekliyoruz;
    böylece uçuş izinin şekli korunur, sadece nokta yoğunluğu düşer.

    partition: iç içe akışları ayıran sütun (ör. takim_numarasi). Tek akışlı
    tablolarda (img_proc, target_selection) None verilir.

    Not: playback (bitmiş dosya) için idealdir. Ham veri hâlâ .db'de durur —
    burada sadece görselleştirme için örnekliyoruz, analiz endpoint'i tüm satırı kullanır.
    """
    import math
    where = "timestamp BETWEEN ? AND ?"
    if extra_where:
        where += f" AND {extra_where}"
    cnt = conn.execute(f"SELECT COUNT(*) FROM {table} WHERE {where}", (start, end)).fetchone()[0]
    if cnt == 0:
        return []
    stride = max(1, math.ceil(cnt / max_points)) if max_points and max_points > 0 else 1
    if stride == 1:
        q = f"SELECT {columns} FROM {table} WHERE {where} ORDER BY timestamp"
        return rows_to_dicts(conn.execute(q, (start, end)).fetchall())
    # ÖNEMLİ: rowid'e göre sırala, timestamp'e göre DEĞİL. Bu loglarda timestamp
    # çok kaba (yüzlerce ardışık satır aynı timestamp değerini paylaşıyor — tek bir
    # timestamp bazen tüm bir yay/dönüşü kapsıyor). Gerçek uçuş sırası rowid'dir;
    # timestamp'e göre sıralamak eş-zaman gruplarını rastgele karıştırıp seyreltmede
    # zigzag'a yol açıyor.
    part = f"PARTITION BY {partition} " if partition else ""
    q = (f"SELECT * FROM ("
         f"  SELECT {columns}, ROW_NUMBER() OVER ({part}ORDER BY rowid) AS _rn "
         f"  FROM {table} WHERE {where}"
         f") WHERE _rn % {stride} = 0 ORDER BY _rn")
    rows = conn.execute(q, (start, end)).fetchall()
    out = []
    for r in rows:
        d = dict(r)
        d.pop("_rn", None)
        out.append(d)
    return out


# Playback'te her tablo için üst nokta sınırı.
# 0 = seyreltme YOK (tüm ham veri) — GÜVENLİ VARSAYILAN.
#
# NEDEN 0: Bu logların şeması "her nokta = bir konum" DEĞİL. Her timestamp'te
# ~60 satırlık bir uzamsal "yelpaze" (214×300m) var (10Hz, tahmini-yol/buffer
# dökümü olabilir). Naif seyreltme (rowid/timestamp/stride) bu yelpazeler arasında
# rastgele örnekleyip uçuş izini ZİGZAG'a çeviriyor (ölçüldü: 7° → 128°).
# Doğru seyreltme, "gerçek konum hangi satır?" bilgisini (logger şeması) gerektirir;
# o netleşene kadar tam ham veri döndürülür ki görüntü "eski akıcı hali" ile birebir olsun.
# Makinery aşağıda hazır: doğru temsilci satır belli olunca max_points > 0 yapılabilir.
DEFAULT_MAX_POINTS = 0


def build_payload(conn, start: float, end: float, max_points: int = 0):
    own_track = []  # own_telemetry tablosu henüz yok; şema netleşince eklenecek.

    rival_rows = fetch_range_decimated(
        conn, "incoming_telemetry",
        "timestamp AS t, takim_numarasi, iha_enlem, iha_boylam, iha_irtifa, "
        "iha_dikilme, iha_yonelme, iha_yatis, iha_hiz, iha_zamanfarki",
        start, end, max_points,
    )
    rival_tracks = {}
    for row in rival_rows:
        tn = str(row.pop("takim_numarasi"))
        rival_tracks.setdefault(tn, []).append(row)

    rk4_rows = fetch_range_decimated(
        conn, "rk4_predictions",
        "timestamp AS t, takim_numarasi, marked, iha_enlem AS pred_lat, "
        "iha_boylam AS pred_lon, iha_irtifa AS pred_irtifa, iha_yonelme AS pred_yonelme, "
        "iha_hiz AS pred_hiz, iha_ivme, iha_donus_hizi",
        start, end, max_points,
    )
    rk4_tracks = {}
    for row in rk4_rows:
        tn = str(row.pop("takim_numarasi"))
        rk4_tracks.setdefault(tn, []).append(row)

    guidance = fetch_range(
        conn, "guidance_info",
        "timestamp AS t, current_mode, mode_lock, info",
        start, end,
    )

    img_proc = fetch_range_decimated(
        conn, "img_proc",
        "timestamp AS t, target_track_id, iha_kilitlenme, fps",
        start, end, max_points, partition=None,
    )

    target_selection = fetch_range_decimated(
        conn, "target_selection",
        "timestamp AS t, hedef_id",
        start, end, max_points, partition=None,
    )

    nfz = fetch_range(
        conn, "nfz_areas",
        "timestamp AS t, zone_index, latitude AS lat, longitude AS lon, radius",
        start, end,
    )

    return {
        "own_track": own_track,
        "rival_tracks": rival_tracks,
        "rk4_tracks": rk4_tracks,
        "guidance": guidance,
        "img_proc": img_proc,
        "target_selection": target_selection,
        "nfz_areas": nfz,
    }


def get_bounds(conn):
    mins, maxs = [], []
    for t in ["incoming_telemetry", "rk4_predictions", "guidance_info", "img_proc", "target_selection"]:
        row = conn.execute(f"SELECT MIN(timestamp), MAX(timestamp) FROM {t}").fetchone()
        if row[0] is not None:
            mins.append(row[0]); maxs.append(row[1])
    if not mins:
        return None
    return {"start": min(mins), "end": max(maxs)}


# ============================================================
# OTURUM LİSTELEME (dosya seçici için)
# ============================================================
@app.get("/sessions")
def list_sessions():
    """sessions/ klasöründeki tüm .db dosyalarını, temel bilgileriyle listeler.
    Frontend bunu bir dropdown'a doldurur."""
    files = sorted(glob.glob(os.path.join(SESSIONS_DIR, "*.db")), reverse=True)
    result = []
    for f in files:
        name = os.path.basename(f)
        session_id = name[:-3] if name.endswith(".db") else name
        entry = {
            "session_id": session_id,
            "filename": name,
            "size_kb": round(os.path.getsize(f) / 1024, 1),
            "modified": os.path.getmtime(f),
        }
        try:
            conn = sqlite3.connect(f, timeout=2)
            conn.row_factory = sqlite3.Row
            bounds = get_bounds(conn)
            entry["bounds"] = bounds
            entry["duration_s"] = round(bounds["end"] - bounds["start"], 1) if bounds else None
            teams = [r[0] for r in conn.execute(
                "SELECT DISTINCT takim_numarasi FROM incoming_telemetry"
            ).fetchall()]
            entry["teams"] = teams
            conn.close()
        except Exception as e:
            entry["error"] = str(e)
        result.append(entry)
    return {"sessions": result, "sessions_dir": SESSIONS_DIR}


# ============================================================
# PLAYBACK
# ============================================================
@app.get("/flight/{session_id}/bounds")
def get_flight_bounds(session_id: str):
    with get_conn(session_id) as conn:
        try:
            bounds = get_bounds(conn)
            if bounds is None:
                raise HTTPException(status_code=404, detail="Veritabanında hiç veri yok")
            return bounds
        except sqlite3.OperationalError as e:
            raise HTTPException(status_code=500, detail=f"Tablo bulunamadı / şema uyuşmazlığı: {e}")


@app.get("/flight/{session_id}/range")
def get_flight_range(
    session_id: str,
    start: float = Query(..., description="Epoch saniye, aralık başlangıcı"),
    end: float = Query(..., description="Epoch saniye, aralık bitişi"),
    max_points: int = Query(DEFAULT_MAX_POINTS, description="Tablo başına üst nokta sınırı; "
                            "aşılırsa seyreltilir. 0 = seyreltme yok (tüm ham veri)."),
):
    with get_conn(session_id) as conn:
        try:
            return build_payload(conn, start, end, max_points=max_points)
        except sqlite3.OperationalError as e:
            raise HTTPException(status_code=500, detail=f"Tablo bulunamadı / şema uyuşmazlığı: {e}")


# ============================================================
# LIVE
# ============================================================
@app.get("/flight/{session_id}/latest")
def get_flight_latest(
    session_id: str,
    since: float = Query(..., description="Bu epoch saniyesinden SONRAKİ yeni satırları getir"),
):
    with get_conn(session_id) as conn:
        try:
            far_future = since + 3600
            payload = build_payload(conn, since, far_future)
            all_ts = []
            for arr in payload["rival_tracks"].values():
                all_ts += [r["t"] for r in arr]
            for arr in payload["rk4_tracks"].values():
                all_ts += [r["t"] for r in arr]
            all_ts += [r["t"] for r in payload["guidance"]]
            all_ts += [r["t"] for r in payload["img_proc"]]
            all_ts += [r["t"] for r in payload["target_selection"]]
            payload["latest_ts"] = max(all_ts) if all_ts else since
            return payload
        except sqlite3.OperationalError as e:
            raise HTTPException(status_code=500, detail=f"Tablo bulunamadı / şema uyuşmazlığı: {e}")


# ============================================================
# ANALİZ — RK4 hatası, kilitlenme istatistikleri, mod süreleri
# Tek seferde tüm oturum taranır (playback'ten bağımsız, scrub sırasında
# tekrar tekrar hesaplanmaz).
# ============================================================
def haversine_meters(lat1, lon1, lat2, lon2):
    import math
    R = 6371000
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lon2 - lon1)
    a = math.sin(dphi/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(dlmb/2)**2
    return 2 * R * math.asin(min(1, math.sqrt(a)))


@app.get("/flight/{session_id}/analysis")
def get_flight_analysis(session_id: str):
    with get_conn(session_id) as conn:
        try:
            bounds = get_bounds(conn)
            if bounds is None:
                raise HTTPException(status_code=404, detail="Veritabanında hiç veri yok")

            # ---- 1) RK4 tahmin hatası zaman serisi ----
            # Her rk4_predictions satırını, aynı takımın en yakın zamanlı
            # gerçek incoming_telemetry satırıyla eşleştirip mesafe hatası hesaplanır.
            rk4_error_series = {}
            teams_with_rk4 = [r[0] for r in conn.execute(
                "SELECT DISTINCT takim_numarasi FROM rk4_predictions"
            ).fetchall()]

            for team in teams_with_rk4:
                preds = conn.execute(
                    "SELECT timestamp, iha_enlem, iha_boylam FROM rk4_predictions "
                    "WHERE takim_numarasi=? ORDER BY timestamp", (team,)
                ).fetchall()
                reals = conn.execute(
                    "SELECT timestamp, iha_enlem, iha_boylam FROM incoming_telemetry "
                    "WHERE takim_numarasi=? ORDER BY timestamp", (team,)
                ).fetchall()
                if not reals:
                    continue
                real_ts = [r["timestamp"] for r in reals]

                series = []
                j = 0
                for p in preds:
                    # en yakın gerçek zaman damgasını bul (basit ileri tarama, veri sıralı)
                    while j < len(real_ts)-1 and real_ts[j+1] <= p["timestamp"]:
                        j += 1
                    real = reals[j]
                    err_m = haversine_meters(p["iha_enlem"], p["iha_boylam"], real["iha_enlem"], real["iha_boylam"])
                    series.append({"t": p["timestamp"], "error_m": round(err_m, 2)})

                errs = [s["error_m"] for s in series]
                rk4_error_series[str(team)] = {
                    "series": series,
                    "mean_error_m": round(sum(errs)/len(errs), 2) if errs else None,
                    "max_error_m": round(max(errs), 2) if errs else None,
                    "max_error_t": series[errs.index(max(errs))]["t"] if errs else None,
                }

            # ---- 2) Kilitlenme denemesi istatistikleri ----
            # img_proc.iha_kilitlenme 0->1 geçişleri = deneme başlangıcı, 1->0 = bitiş
            img_rows = conn.execute(
                "SELECT timestamp, iha_kilitlenme FROM img_proc ORDER BY timestamp"
            ).fetchall()
            attempts = []
            attempt_start = None
            prev = 0
            for row in img_rows:
                cur = row["iha_kilitlenme"]
                if cur == 1 and prev == 0:
                    attempt_start = row["timestamp"]
                if cur == 0 and prev == 1 and attempt_start is not None:
                    attempts.append({"start": attempt_start, "end": row["timestamp"],
                                      "duration_s": round(row["timestamp"]-attempt_start, 2)})
                    attempt_start = None
                prev = cur
            if attempt_start is not None and img_rows:
                # oturum bitince hâlâ kilitlenmeye çalışıyorsa açık uçlu kaydet
                attempts.append({"start": attempt_start, "end": img_rows[-1]["timestamp"],
                                  "duration_s": round(img_rows[-1]["timestamp"]-attempt_start, 2),
                                  "unfinished": True})

            durations = [a["duration_s"] for a in attempts]
            kilitlenme_stats = {
                "attempt_count": len(attempts),
                "attempts": attempts,
                "mean_duration_s": round(sum(durations)/len(durations), 2) if durations else None,
                "max_duration_s": round(max(durations), 2) if durations else None,
            }

            # ---- 3) Mod geçişleri ve süreleri ----
            g_rows = conn.execute(
                "SELECT timestamp, current_mode FROM guidance_info ORDER BY timestamp"
            ).fetchall()
            mode_segments = []
            for i, row in enumerate(g_rows):
                start_t = row["timestamp"]
                end_t = g_rows[i+1]["timestamp"] if i < len(g_rows)-1 else bounds["end"]
                mode_segments.append({
                    "mode": row["current_mode"],
                    "start": start_t, "end": end_t,
                    "duration_s": round(end_t-start_t, 2),
                })
            mode_totals = {}
            for seg in mode_segments:
                mode_totals.setdefault(seg["mode"], 0)
                mode_totals[seg["mode"]] += seg["duration_s"]
            mode_totals = {k: round(v, 2) for k, v in mode_totals.items()}

            return {
                "session_id": session_id,
                "bounds": bounds,
                "rk4_error": rk4_error_series,
                "kilitlenme": kilitlenme_stats,
                "mode_segments": mode_segments,
                "mode_totals_s": mode_totals,
            }
        except sqlite3.OperationalError as e:
            raise HTTPException(status_code=500, detail=f"Tablo bulunamadı / şema uyuşmazlığı: {e}")


# ============================================================
# AI DEBRIEF — yarış sonrası, LLM ile doğal dil analizi
# Mevcut /analysis metriklerini bir LLM'e verip uzman debrief ürettirir.
# API anahtarı backend/.env'den (AI_API_KEY) okunur; koda gömülmez.
# ============================================================
@app.get("/flight/{session_id}/ai-debrief")
def get_ai_debrief(session_id: str):
    import ai_debrief
    if not ai_debrief.ai_configured():
        raise HTTPException(
            status_code=503,
            detail="AI_API_KEY tanımlı değil. backend/.env dosyasına ekleyip "
                   "backend'i yeniden başlat (ve .env'i .gitignore'a koy).",
        )
    # Mevcut analiz hesabını doğrudan yeniden kullan (kendi bağlantısını açar).
    analysis = get_flight_analysis(session_id)
    try:
        return ai_debrief.generate_debrief(analysis)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))


@app.get("/ai-status")
def ai_status():
    import ai_debrief
    return {
        "configured": ai_debrief.ai_configured(),
        "model": ai_debrief.AI_MODEL,
        "base_url": ai_debrief.AI_BASE_URL,
    }


@app.get("/health")
def health():
    dbs = glob.glob(os.path.join(SESSIONS_DIR, "*.db"))
    return {"status": "ok", "sessions_dir": SESSIONS_DIR, "session_count": len(dbs)}