"""
AAD — AI Uçuş Debrief'i (yarış sonrası analiz)
------------------------------------------------------------------------
Amaç: Yarış sırasında GERÇEK ZAMANLI göremediğiniz şeyleri, hesaplanmış
analiz verisini (RK4 tahmin hatası, kilitlenme denemeleri, guidance mod
süreleri) bir LLM'e verip UZMAN bir uçuş analistiymiş gibi Türkçe, yapılandırılmış
bir debrief ürettirmek.

GÜVENLİK VE UYUMLULUK:
  - Gemini anahtarları (AQ... veya AIzaSy...) girildiğinde otomatik olarak
    Google Gemini OpenAI-uyumlu endpoint'ine (/v1beta/openai) bağlanır.
  - OpenAI anahtarları (sk-...) girildiğinde standart OpenAI endpoint'ine gider.
  - API anahtarı yoksa sistemi çökertmez, kural tabanlı özet rapor üretir.
"""

import os
import re
import json
import urllib.request
import urllib.error


def _load_dotenv():
    """backend/.env dosyasını (varsa) os.environ'a yükler — python-dotenv GEREKTİRMEZ."""
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
    if not os.path.isfile(path):
        return
    try:
        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                k, v = k.strip(), v.strip().strip('"').strip("'")
                if k and k not in os.environ:
                    os.environ[k] = v
    except Exception:
        pass


_load_dotenv()

# .env üzerinden zorlanmış yapılandırmalar (varsa)
AI_BASE_URL_DEFAULT = os.environ.get("AI_BASE_URL", "").rstrip("/")
AI_MODEL_DEFAULT = os.environ.get("AI_MODEL", "")
AI_TIMEOUT = float(os.environ.get("AI_TIMEOUT", "60"))


def get_active_api_key(custom_key: str | None = None) -> str:
    """Öncelik UI'dan (header) gelen anahtardadır. Yoksa .env'ye bakar."""
    if custom_key and str(custom_key).strip():
        return str(custom_key).strip()
    return os.environ.get("AI_API_KEY", "").strip()


def ai_configured(custom_key: str | None = None) -> bool:
    return bool(get_active_api_key(custom_key))


def resolve_provider_config(api_key: str):
    if AI_BASE_URL_DEFAULT and AI_MODEL_DEFAULT:
        return AI_BASE_URL_DEFAULT, AI_MODEL_DEFAULT

    # Google Gemini API Anahtarı
    if api_key.startswith("AQ") or api_key.startswith("AIzaSy"):
        base_url = "https://generativelanguage.googleapis.com/v1beta"
        model = "gemini-3.6-flash"  # <-- Güncellendi
        return base_url, model

    # Standart OpenAI
    base_url = AI_BASE_URL_DEFAULT or "https://api.openai.com/v1"
    model = AI_MODEL_DEFAULT or "gpt-4o-mini"
    return base_url, model

def _compress_mode_segments(mode_segments):
    """Ardışık aynı modları tek segmente birleştir."""
    runs = []
    for seg in mode_segments or []:
        if runs and runs[-1]["mode"] == seg["mode"]:
            runs[-1]["duration_s"] = round(runs[-1]["duration_s"] + seg["duration_s"], 2)
        else:
            runs.append({"mode": seg["mode"], "duration_s": seg["duration_s"]})
    return runs


def summarize_analysis(analysis: dict) -> dict:
    """Ham analizi LLM için özet metrik JSON'ına küçült."""
    b = analysis.get("bounds") or {}
    duration = round((b.get("end", 0) - b.get("start", 0)), 1) if b else None

    rk4 = {}
    for team, d in (analysis.get("rk4_error") or {}).items():
        rk4[team] = {
            "mean_error_m": d.get("mean_error_m"),
            "max_error_m": d.get("max_error_m"),
            "ornek_sayisi": len(d.get("series") or []),
        }

    kil = analysis.get("kilitlenme") or {}
    attempts = kil.get("attempts") or []
    kil_summary = {
        "deneme_sayisi": kil.get("attempt_count"),
        "ort_sure_s": kil.get("mean_duration_s"),
        "max_sure_s": kil.get("max_duration_s"),
        "bitmeyen_var": any(a.get("unfinished") for a in attempts),
        "deneme_sureleri_s": [a.get("duration_s") for a in attempts[:15]],
    }

    runs = _compress_mode_segments(analysis.get("mode_segments") or [])
    mode_summary = {
        "toplam_sure_s": analysis.get("mode_totals_s") or {},
        "gecis_sayisi": max(0, len(runs) - 1),
        "mod_dizisi": [f"{r['mode']} ({r['duration_s']}s)" for r in runs[:40]],
    }

    return {
        "oturum": analysis.get("session_id"),
        "sure_s": duration,
        "rk4_tahmin_hatasi": rk4,
        "kilitlenme": kil_summary,
        "guidance_modlari": mode_summary,
    }


def _neutralize_summary(summary: dict):
    gm = summary.get("guidance_modlari", {}) or {}
    totals = gm.get("toplam_sure_s") or {}
    modemap, revmap = {}, {}
    for i, m in enumerate(totals.keys(), 1):
        label = f"Mod-{i}"
        modemap[m] = label
        revmap[label] = m

    def relabel(seq):
        out = []
        for s in seq or []:
            for m, lbl in modemap.items():
                if s.startswith(m + " "):
                    out.append(lbl + s[len(m):])
                    break
            else:
                out.append(s)
        return out

    neutral = {
        "oturum_id": summary.get("oturum"),
        "sure_s": summary.get("sure_s"),
        "tahmin_hatasi_m": summary.get("rk4_tahmin_hatasi"),
        "takip_denemeleri": summary.get("kilitlenme"),
        "modlar": {
            "toplam_sure_s": {modemap.get(k, k): v for k, v in totals.items()},
            "gecis_sayisi": gm.get("gecis_sayisi"),
            "mod_dizisi": relabel(gm.get("mod_dizisi")),
        },
    }
    return neutral, revmap


def _apply_revmap(text: str, revmap: dict) -> str:
    for label in sorted(revmap, key=len, reverse=True):
        text = re.sub(r"\b" + re.escape(label) + r"\b", revmap[label], text or "")
    return text


SYSTEM_PROMPT = (
    "Sen otonom sistemler ve İHA taktik uçuşları için bir PERFORMANS VERİ ANALİSTİSİN. "
    "Sana bir test oturumunun SOYUT metrikleri veriliyor; bunları yorumlayıp mühendislik ekibinin "
    "canlı testte fark edemediği iyileştirme fırsatlarını Türkçe çıkarıyorsun.\n\n"
    "Kurallar: sadece verilen sayılara dayan, veri uydurma. Çıktı Markdown olsun."
)

USER_TEMPLATE = (
    "Aşağıdaki soyut performans metriklerini (JSON) kullanarak şu başlıklarla bir "
    "mühendislik analiz raporu yaz:\n\n"
    "1. **Genel Özet** — oturumda ne oldu, 2-3 cümle.\n"
    "2. **Modlar & Geçişler** — hangi mod ne kadar kullanıldı, aşırı çırpınma var mı.\n"
    "3. **Tahmin (RK4) Hatası** — hata seviyesi iyi mi, nerede zayıflıyor.\n"
    "4. **Takip Denemeleri** — kilitlenme kararlılığı ve süreleri.\n"
    "5. **Testte Göremedikleriniz & Öneriler** — somut yazılım/algoritma iyileştirme önerileri.\n\n"
    "METRİKLER:\n```json\n{data}\n```"
)


def build_messages(analysis: dict):
    summary = summarize_analysis(analysis)
    neutral, revmap = _neutralize_summary(summary)
    data = json.dumps(neutral, ensure_ascii=False, indent=2)
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": USER_TEMPLATE.format(data=data)},
    ]
    return messages, summary, revmap


def _generate_fallback_debrief(summary: dict) -> str:
    """API anahtarı olmadığında sistemin kural tabanlı ürettiği yerel özet."""
    sid = summary.get("oturum", "Bilinmiyor")
    dur = summary.get("sure_s", 0)
    kil = summary.get("kilitlenme", {})
    attempts = kil.get("deneme_sayisi", 0)
    mean_dur = kil.get("ort_sure_s", 0)

    rk4_txt = []
    for team, r in (summary.get("rk4_tahmin_hatasi") or {}).items():
        rk4_txt.append(f"  * **Takım {team}:** Ortalama hata: `{r.get('mean_error_m', 0)}m`, Maks: `{r.get('max_error_m', 0)}m`")
    rk4_block = "\n".join(rk4_txt) if rk4_txt else "  * RK4 hata verisi bulunamadı."

    return f"""### ⚠ Çevrimdışı Kural Tabanlı Analiz (API Key Yok)
> **Bilgi:** Sistemde tanımlı bir API anahtarı bulunamadı. Üstteki giriş alanına Gemini API anahtarınızı girerek LLM debrief'ini alabilirsiniz.

1. **Genel Özet**
   `{sid}` oturumu toplam `{dur}` saniye sürdü.

2. **Tahmin (RK4) Hatası**
{rk4_block}

3. **Takip & Kilitlenme Performansı**
   * Toplam deneme: **{attempts}**
   * Ortalama takip süresi: **{mean_dur} sn**
"""


def call_llm(messages: list, api_key: str) -> str:
    # 1. Google Gemini Anahtarı (AQ... veya AIzaSy...)
    if api_key.startswith("AQ") or api_key.startswith("AIzaSy"):
        full_prompt = "\n\n".join([m["content"] for m in messages])
        
        headers = {
            "x-goog-api-key": api_key,
            "Content-Type": "application/json",
            "User-Agent": "AAD-Flight-Debrief/1.0"
        }

        body = json.dumps({
            "contents": [{
                "parts": [{"text": full_prompt}]
            }],
            "generationConfig": {
                "temperature": 0.4
            }
        }).encode("utf-8")

        # Google'ın önerdiği güncel modeller sırasıyla denenir
        candidate_models = [
            "gemini-3.6-flash",
            "gemini-2.5-flash",
            "gemini-1.5-flash"
        ]

        last_error = None
        for model_name in candidate_models:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent"
            req = urllib.request.Request(url, data=body, headers=headers, method="POST")
            try:
                with urllib.request.urlopen(req, timeout=AI_TIMEOUT) as resp:
                    payload = json.loads(resp.read().decode("utf-8"))
                return payload["candidates"][0]["content"]["parts"][0]["text"]
            except urllib.error.HTTPError as e:
                detail = e.read().decode("utf-8", "replace")[:300]
                last_error = f"HTTP {e.code} ({model_name}): {detail}"
                # 404 ise sıradaki modeli dene
                if e.code == 404:
                    continue
                raise RuntimeError(f"Gemini API Hatası: {last_error}")
            except urllib.error.URLError as e:
                raise RuntimeError(f"Gemini Sunucusuna Ulaşılamadı: {e.reason}")

        raise RuntimeError(f"Kullanılabilir model bulunamadı. Son hata: {last_error}")

    # 2. Standart OpenAI Anahtarı (sk-...)
    base_url = AI_BASE_URL_DEFAULT or "https://api.openai.com/v1"
    model = AI_MODEL_DEFAULT or "gpt-4o-mini"

    body = json.dumps({
        "model": model,
        "messages": messages,
        "temperature": 0.4,
    }).encode("utf-8")

    req = urllib.request.Request(
        f"{base_url}/chat/completions",
        data=body,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=AI_TIMEOUT) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
        return payload["choices"][0]["message"]["content"]
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "replace")[:400]
        raise RuntimeError(f"OpenAI API Hatası (HTTP {e.code}): {detail}")
    except urllib.error.URLError as e:
        raise RuntimeError(f"OpenAI Sunucusuna Ulaşılamadı: {e.reason}")




def generate_debrief(analysis: dict, api_key: str | None = None, *args, **kwargs) -> dict:
    """
    Tek noktadan debrief üretici.
    Esnek argüman yapısı ile hem tekli hem ikili positional çağrıları kabul eder.
    """
    messages, summary, revmap = build_messages(analysis)

    passed_key = api_key or kwargs.get("custom_api_key") or kwargs.get("x_api_key")
    if not passed_key and args:
        passed_key = args[0]
    active_key = get_active_api_key(passed_key)

    if not active_key:
        return {
            "model": "Kural Tabanlı (Çevrimdışı)",
            "debrief_md": _generate_fallback_debrief(summary),
            "used_summary": summary,
        }

    try:
        text = call_llm(messages, active_key)
        text = _apply_revmap(text, revmap)
        _, model = resolve_provider_config(active_key)
        return {
            "model": model,          # <-- Frontend'e doğru model adı (gemini-3.6-flash) gider
            "debrief_md": text,
            "used_summary": summary,
        }
    except Exception as e:
        return {
            "model": "Hata",
            "debrief_md": f"### ❌ Yapay Zeka Servis Hatası\n\n> **Ayrıntı:** `{str(e)}`\n\n---\n" + _generate_fallback_debrief(summary),
            "used_summary": summary,
        }
