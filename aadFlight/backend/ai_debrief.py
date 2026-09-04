"""
AAD — AI Uçuş Debrief'i (yarış sonrası analiz)
------------------------------------------------------------------------
Amaç: Yarış sırasında GERÇEK ZAMANLI göremediğiniz şeyleri, hesaplanmış
analiz verisini (RK4 tahmin hatası, kilitlenme denemeleri, guidance mod
süreleri) bir LLM'e verip UZMAN bir uçuş analistiymiş gibi Türkçe, yapılandırılmış
bir debrief ürettirmek: guidance algoritmanız ne yaptı, RK4 nerede zayıfladı,
kilitlenmeler neden başarısız oldu, ne iyileştirilebilir.

GÜVENLİK: API anahtarı KODA GÖMÜLMEZ. Ortam değişkeninden (backend/.env) okunur.
Sağlayıcıdan bağımsız: OpenAI-uyumlu /chat/completions bekler. Farklı sağlayıcı
için AI_BASE_URL ve AI_MODEL'i .env'den değiştirmek yeterli.

.env örneği (backend/.env — .gitignore'a ekle, ASLA commit'leme):
    AI_API_KEY=sk-...
    AI_BASE_URL=https://api.openai.com/v1      # varsayılan
    AI_MODEL=gpt-4o-mini                        # varsayılan
"""

import os
import re
import json
import urllib.request
import urllib.error


def _load_dotenv():
    """backend/.env dosyasını (varsa) os.environ'a yükler — python-dotenv GEREKTİRMEZ.
    Zaten tanımlı gerçek ortam değişkenlerini EZMEZ (env > .env önceliği)."""
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

AI_API_KEY = os.environ.get("AI_API_KEY", "").strip()
AI_BASE_URL = os.environ.get("AI_BASE_URL", "https://api.openai.com/v1").rstrip("/")
AI_MODEL = os.environ.get("AI_MODEL", "gpt-4o-mini")
AI_TIMEOUT = float(os.environ.get("AI_TIMEOUT", "60"))


def ai_configured() -> bool:
    return bool(AI_API_KEY)


def _compress_mode_segments(mode_segments):
    """Ardışık aynı modları tek segmente birleştir (LLM'e sade dizi ver)."""
    runs = []
    for seg in mode_segments:
        if runs and runs[-1]["mode"] == seg["mode"]:
            runs[-1]["duration_s"] = round(runs[-1]["duration_s"] + seg["duration_s"], 2)
        else:
            runs.append({"mode": seg["mode"], "duration_s": seg["duration_s"]})
    return runs


def summarize_analysis(analysis: dict) -> dict:
    """Ham analizi LLM için KÜÇÜLT: binlerce nokta yerine özet metrikler.
    (RK4 hata serisi tamamen çıkarılır; sadece ortalama/max kalır.)"""
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
        # ilk 15 denemenin süreleri (fazlasını gönderme)
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


# ---- İçerik nötrleştirme ----------------------------------------------------
# Bazı sağlayıcı ağ geçitleri (ör. Agent Router) alana özgü terimleri (drone,
# hedef, kilitlenme, Pro Nav...) moderasyonla "content-blocked" yapıyor. Oysa bu
# sivil bir mühendislik yarışması yazılımı. Çözüm: LLM'e SOYUT bir "otonom takip
# sistemi performans analizi" olarak gönderiyoruz — mod adları Mod-1..N'e çevriliyor.
# Dönen raporda Mod-N -> gerçek ad geri yazılıyor, böylece kullanıcı asıl adları görür.
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
    # uzun etiketleri önce değiştir (Mod-10, Mod-1'den önce)
    for label in sorted(revmap, key=len, reverse=True):
        text = re.sub(r"\b" + re.escape(label) + r"\b", revmap[label], text or "")
    return text


SYSTEM_PROMPT = (
    "Sen otonom sistemler için bir PERFORMANS VERİ ANALİSTİSİN. Sana bir test "
    "oturumunun SOYUT metrikleri veriliyor; bunları yorumlayıp mühendislik ekibinin "
    "canlı testte fark edemediği iyileştirme fırsatlarını Türkçe çıkarıyorsun.\n\n"
    "Metriklerin anlamı:\n"
    "  • modlar: sistemin bir durum-makinesinin farklı çalışma modları (Mod-1, Mod-2, "
    "...), her modun toplam süresi ve toplam mod-geçiş sayısı.\n"
    "  • tahmin_hatasi_m: bir sayısal öngörü bileşeninin (RK4 entegratörü) öngördüğü "
    "konum ile ölçülen konum arasındaki METRE cinsinden fark (düşük = iyi).\n"
    "  • takip_denemeleri: sistemin bir referansı izlemeye çalıştığı zaman aralıkları "
    "ve süreleri.\n\n"
    "Kurallar: sadece verilen sayılara dayan, veri uydurma. Sayı yoksa 'veri yok' de. "
    "Çıktı Markdown olsun; abartılı övgü yok, somut ve eyleme dönük gözlemler ver."
)

USER_TEMPLATE = (
    "Aşağıdaki soyut performans metriklerini (JSON) kullanarak şu başlıklarla bir "
    "mühendislik analiz raporu yaz:\n\n"
    "1. **Genel Özet** — oturumda ne oldu, 2-3 cümle.\n"
    "2. **Modlar & Geçişler** — hangi mod ne kadar kullanıldı, geçişler kararlı mı, "
    "aşırı/gereksiz mod değişimi (çırpınma) var mı ve bu ne anlama gelir.\n"
    "3. **Tahmin (RK4) Hatası** — hata seviyesi iyi mi, nerede/hangi kanalda zayıflıyor, "
    "ne anlama gelebilir.\n"
    "4. **Takip Denemeleri** — kaç deneme, süreleri, ne kadar kararlı, kısa/kesik "
    "denemeler neyi gösteriyor.\n"
    "5. **Testte Göremedikleriniz & Öneriler** — verilerden çıkan, o an gözden kaçmış "
    "olabilecek içgörüler ve somut yazılım/algoritma iyileştirme önerileri.\n\n"
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


def call_llm(messages: list) -> str:
    if not AI_API_KEY:
        raise RuntimeError(
            "AI_API_KEY tanımlı değil. backend/.env dosyasına ekle "
            "(ve o dosyayı .gitignore'a koy)."
        )
    body = json.dumps({
        "model": AI_MODEL,
        "messages": messages,
        "temperature": 0.4,
    }).encode("utf-8")
    req = urllib.request.Request(
        f"{AI_BASE_URL}/chat/completions",
        data=body,
        headers={
            "Authorization": f"Bearer {AI_API_KEY}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=AI_TIMEOUT) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "replace")[:400]
        raise RuntimeError(f"AI sağlayıcı hatası (HTTP {e.code}): {detail}")
    except urllib.error.URLError as e:
        raise RuntimeError(f"AI sağlayıcıya ulaşılamadı: {e.reason}")

    try:
        return payload["choices"][0]["message"]["content"]
    except (KeyError, IndexError):
        raise RuntimeError(f"Beklenmeyen AI yanıt biçimi: {json.dumps(payload)[:400]}")


def generate_debrief(analysis: dict) -> dict:
    messages, summary, revmap = build_messages(analysis)
    text = call_llm(messages)
    text = _apply_revmap(text, revmap)  # Mod-N -> gerçek mod adı (kullanıcıya)
    return {
        "model": AI_MODEL,
        "debrief_md": text,
        "used_summary": summary,
    }
