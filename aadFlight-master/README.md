# aadFlight

## Hakkında
AAD Uçuş Analiz Sistemi, uçuş loglarını (SQLite veritabanı formatında) harita ve grafikler üzerinden görselleştirmek için geliştirilmiş bir web uygulamasıdır. Hem tamamlanmış uçuşları baştan sona oynatma (Playback), hem de o an kaydedilmekte olan verileri canlı takip etme (Live) özelliklerine sahiptir.

## Nasıl Başlatılır

Sistem, veri sağlayan bir Python sunucusu (FastAPI) ve bu veriyi görselleştiren bir web arayüzünden oluşmaktadır.

### 0.AI_Debrief çalışmak istemiyor
Kendisi şu an biraz hayata küsmüş durumda ve sanıyoruz ki canı istemediği için çalışmıyor.  Dokunmayın, üzerine gitmeyin; gururunu incitmeden tamir edebilen bir babayiğit çıkana kadar sistemin geri kalanıyla devam ediyoruz. Ama siz yine de bi deneyin keyfi yerindeyse çalışıyor da olabilir.

### 1. Gereksinimleri Yükleme
Öncelikle sistemdeki kütüphanelerin çakışmasını önlemek için ayrı bir sanal ortam (virtual environment) oluşturup aktifleştirin:
```bash
python3 -m venv venv
source venv/bin/activate
```
Ardından API sunucusu için gerekli Python paketlerini sanal ortama kurun:
```bash
pip install -r requirements.txt
```

### 2. Backend Sunucusunu Çalıştırma
Terminalde projenin bulunduğu dizinde aşağıdaki komutu çalıştırarak sunucuyu ayağa kaldırın:
```bash
uvicorn backend.main:app --reload --port 8010

```
*(Sunucu varsayılan olarak dizindeki uçuş veritabanı dosyasını okuyacaktır).*

### 3. Arayüzü Açma
Sunucu çalıştıktan sonra, projenin ana dizininde yer alan `index.html` dosyasını tarayıcınızda (Google Chrome, Firefox vb.) açmanız yeterlidir. Sağ üst menüden **Playback** veya **Live** modunu seçerek verileri izlemeye başlayabilirsiniz.
