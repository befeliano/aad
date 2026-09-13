"use client";

import { useCallback, useSyncExternalStore } from "react";

/* ============================================================
   Dil paketi — yalnızca halka açık site.
   Panel Türkçe kalıyor: sponsorlar ve yabancı ziyaretçiler siteyi
   görüyor, paneli değil.

   TEK ADRES + DÜĞME: /en/... gibi ayrı adresler yok. Dil istemcide
   seçiliyor ve localStorage'da saklanıyor, böylece sayfalar statik
   kalmaya devam ediyor. Bedeli: arama motoru yalnızca varsayılan dili
   (Türkçe) dizine alır.
   ============================================================ */

export type Lang = "tr" | "en";

const KEY = "aad-lang";
const EVENT = "aad-lang-change";

/* ---------- dış durum aboneliği (ThemeToggle ile aynı desen) ---------- */

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

function getSnapshot(): Lang {
  try {
    return localStorage.getItem(KEY) === "en" ? "en" : "tr";
  } catch {
    return "tr";
  }
}

/** Sunucu her zaman Türkçe üretir — hidrasyon uyuşmazlığını önler */
function getServerSnapshot(): Lang {
  return "tr";
}

export function useLang(): Lang {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function setLang(next: Lang) {
  try {
    localStorage.setItem(KEY, next);
  } catch {
    /* gizli sekme: seçim kalıcı olmaz ama sayfa yine değişir */
  }
  /* <html lang> güncelleniyor: CSS text-transform: uppercase dil
     kurallarına bakar. Türkçe'de i → İ, İngilizce'de i → I. */
  document.documentElement.lang = next;
  window.dispatchEvent(new Event(EVENT));
}

/** Çeviri seçici — `const t = useT(); t(S.nav.filo)` */
export function useT() {
  const lang = useLang();
  return useCallback(
    (pair: readonly [string, string]) => pair[lang === "en" ? 1 : 0],
    [lang]
  );
}

/* ============================================================
   Metinler — [Türkçe, İngilizce]
   Yeni bir metin eklerken iki dili birden yazın; tek dilli giriş
   TypeScript hatası verir.

   Uzun içerik (filo künyeleri, sponsorluk seviyeleri, departman
   açıklamaları) burada değil — onlar constants-en.ts'te, kaynaktaki
   kimliklere bağlı olarak duruyor.
   ============================================================ */
type M = readonly [string, string];

export const S = {
  nav: {
    filo: ["Filo", "Fleet"] as M,
    basarilar: ["Başarılar", "Achievements"] as M,
    ekip: ["Ekip", "Team"] as M,
    galeri: ["Galeri", "Gallery"] as M,
    sponsorluk: ["Sponsorluk", "Sponsorship"] as M,
    katil: ["Katıl", "Join"] as M,
    iletisim: ["İletişim", "Contact"] as M,
    giris: ["Takım Girişi", "Team Login"] as M,
    panel: ["Panel", "Dashboard"] as M,
    profil: ["Profilim", "My Profile"] as M,
    cikis: ["Çıkış", "Sign out"] as M,
    hosgeldin: ["Hoş geldin,", "Welcome,"] as M,
    menu: ["Menü", "Menu"] as M,
  },

  hero: {
    kurulus: ["EST.", "EST."] as M,
    universite: [
      "Eskişehir Teknik Üniversitesi",
      "Eskişehir Technical University",
    ] as M,
    baslik1: ["Gökyüzünü", "We design"] as M,
    baslik2: ["tasarlıyoruz.", "the sky."] as M,
    sponsorOl: ["Sponsor Ol", "Become a Sponsor"] as M,
    filoyuKesfet: ["Filoyu Keşfet", "Explore the Fleet"] as M,
    kaydir: ["Kaydır", "Scroll"] as M,
    gorselAlt: ["gün batımında test uçuşu", "test flight at sunset"] as M,
    medyaAlani: ["Hero görseli · medya alanı", "Hero image · media slot"] as M,
    sampiyonluk: ["Şampiyonluk", "Championships"] as M,
    uye: ["Takım Üyesi", "Team Members"] as M,
    mezun: ["Mezun", "Alumni"] as M,
    kurulusYili: ["Kuruluş", "Founded"] as M,
    rozet1: [
      "Teknofest 2022 · Türkiye 1.",
      "Teknofest 2022 · 1st in Türkiye",
    ] as M,
    rozet2: [
      "SAE Aero Design 2017 · Dünya 1.",
      "SAE Aero Design 2017 · 1st Worldwide",
    ] as M,
    rozet3: [
      "Teknofest 2018 · Türkiye 1.",
      "Teknofest 2018 · 1st in Türkiye",
    ] as M,
  },

  filo: {
    baslik: ["Filo", "Fleet"] as M,
    kicker: [
      "2011'den bugüne tasarlayıp ürettiğimiz platformlar",
      "The platforms we have designed and built since 2011",
    ] as M,
    tanim1: [
      "Filomuz sabit kanat savaşan İHA'lardan hidrojen yakıt hücresi Ar-Ge platformuna kadar uzanıyor. Her uçak bir öncekinin birikimiyle tasarlandı: aerodinamik form, kompozit gövde, aviyonik entegrasyonu ve otonom uçuş yazılımının tamamı takım içinde üretiliyor.",
      "Our fleet ranges from fixed-wing combat UAVs to a hydrogen fuel-cell R&D platform. Each aircraft builds on what the previous one taught us: aerodynamic design, composite airframes, avionics integration and autonomous flight software are all produced in-house.",
    ] as M,
    tanim2: [
      "Aşağıda güncel platformların kısa künyesi var. Teknik değerler, görev profilleri ve arşivdeki uçaklar için filo sayfasına geçin.",
      "Below is a short profile of each active platform. For technical figures, mission profiles and archived aircraft, visit the fleet page.",
    ] as M,
    tumFilo: ["Tüm filoyu incele", "Explore the full fleet"] as M,
    arsiv: ["Arşiv · geçmiş platformlarımız", "Archive · our past platforms"] as M,
    amiralGemisi: ["Amiral Gemisi", "Flagship"] as M,
    ihaAlt: ["insansız hava aracı", "unmanned aerial vehicle"] as M,
    /* /filo sayfası başlığı */
    sayfaBaslik1: ["2011'den bugüne", "Everything we have built"] as M,
    sayfaBaslik2: ["ürettiğimiz platformlar", "since 2011"] as M,
    sayfaLead: [
      "Her platform bir öncekinin mühendislik birikimi üzerine kuruldu. Sabit kanat gövdelerden hidrojen yakıt hücresi Ar-Ge'sine kadar tasarım, üretim ve uçuş testlerinin tamamı takım içinde yapılıyor.",
      "Every platform is built on the engineering the last one left behind. From fixed-wing airframes to hydrogen fuel-cell research, design, manufacturing and flight testing all happen inside the team.",
    ] as M,
  },

  basarilar: {
    baslik: ["Başarılar", "Achievements"] as M,
    kicker: [
      "2013'ten bugüne ulusal ve uluslararası derecelerimiz",
      "Our national and international results since 2013",
    ] as M,
    ulusal: ["Ulusal", "National"] as M,
    uluslararasi: ["Uluslararası", "International"] as M,
    sampiyonluk: ["Şampiyonluk", "Championship"] as M,
  },

  ekip: {
    baslik: ["Ekip", "Team"] as M,
    kicker: ["Altı alt ekip, tek uçak", "Six sub-teams, one aircraft"] as M,
    aktifUye: ["Aktif Üye", "Active Members"] as M,
    brans: ["Mühendislik Branşı", "Engineering Disciplines"] as M,
    mezun: ["Sektörde Mezun", "Alumni in Industry"] as M,
    kurulus: ["Kuruluş", "Founded"] as M,
    mezunNot: [
      "Mezunlarımız bugün TUSAŞ, BAYKAR ve ASELSAN gibi sektör liderlerinde kilit roller üstleniyor.",
      "Our alumni hold key roles at industry leaders such as TUSAŞ, BAYKAR and ASELSAN.",
    ] as M,
    danismanlar: ["Akademik danışmanlarımız", "Our academic advisors"] as M,
    fotoAlt: ["Anatolia Aero Design ekibi", "The Anatolia Aero Design team"] as M,
  },

  surec: {
    baslik: ["Süreç", "Process"] as M,
    kicker: ["Fikirden uçuşa", "From idea to flight"] as M,
  },

  ataturk: {
    soz: ["İstikbal göklerdedir.", "The future lies in the skies."] as M,
    ad: ["Mustafa Kemal Atatürk", "Mustafa Kemal Atatürk"] as M,
  },

  serit: {
    kicker: ["Filomuz havada", "Our fleet in the air"] as M,
    baslik1: ["Gökyüzü", "The sky is"] as M,
    baslik2: ["bizim alanımız.", "our domain."] as M,
    metin: [
      "2011'den bu yana tasarlayıp ürettiğimiz her platform, bir sonrakinin mühendislik temelini attı. Aşağı kaydırın — filomuz sayfa boyunca sizinle uçuyor.",
      "Every platform we have designed and built since 2011 laid the engineering groundwork for the next. Keep scrolling — our fleet flies with you down the page.",
    ] as M,
  },

  cta: {
    kicker: ["Birlikte daha yükseğe", "Higher, together"] as M,
    baslik1: ["Markanızı gökyüzüne", "Let's take your brand"] as M,
    baslik2: ["taşıyalım.", "to the sky."] as M,
    metin: [
      "Teknofest Türkiye birincisi bir takımın parçası olun. Sponsorluk paketlerimizle markanız uçaklarımızda, tanıtım materyallerimizde ve dijital kanallarımızda yerini alır.",
      "Become part of a team that finished first in Türkiye at Teknofest. With our sponsorship packages your brand takes its place on our aircraft, in our promotional material and across our digital channels.",
    ] as M,
    paketler: ["Sponsorluk Paketleri", "Sponsorship Packages"] as M,
    iletisim: ["İletişime Geç", "Get in Touch"] as M,
    sponsorOl: ["Sponsor Ol", "Become a Sponsor"] as M,
  },

  footer: {
    site: ["Site", "Site"] as M,
    iletisim: ["İletişim", "Contact"] as M,
    sosyal: ["Sosyal Medya", "Social Media"] as M,
    haklar: ["Tüm hakları saklıdır.", "All rights reserved."] as M,
    universite: [
      "Eskişehir Teknik Üniversitesi İnsansız Hava Araçları Takımı",
      "Eskişehir Technical University Unmanned Aerial Vehicle Team",
    ] as M,
    aciklama: [
      "Eskişehir Teknik Üniversitesi insansız hava aracı tasarım, üretim ve test takımı. Teknofest Savaşan İHA ve UAV Turkey Türkiye birincisi.",
      "The unmanned aerial vehicle design, manufacturing and test team of Eskişehir Technical University. First in Türkiye at Teknofest Combat UAV and UAV Turkey.",
    ] as M,
    sehir: ["Eskişehir, Türkiye", "Eskişehir, Türkiye"] as M,
  },

  galeri: {
    eyebrow: ["Galeri", "Gallery"] as M,
    baslik: ["Sahadan kareler.", "Frames from the field."] as M,
    lead: [
      "Test uçuşları, atölye çalışmaları ve yarışma anları. Takımın hikâyesi burada.",
      "Test flights, workshop sessions and competition moments. The team's story lives here.",
    ] as M,
    bosBaslik: ["Galeri yakında dolacak", "The gallery is filling up soon"] as M,
    bosMetin: [
      "Takım fotoğraf ve videoları panelden yüklendiğinde burada görünecek. Şimdilik en güncel içeriklerimizi Instagram'da bulabilirsiniz.",
      "Team photos and videos will appear here as they are uploaded from the panel. For now you can find our latest content on Instagram.",
    ] as M,
    instagram: ["Instagram'da gör", "See it on Instagram"] as M,
    kapat: ["Kapat", "Close"] as M,
  },

  iletisim: {
    eyebrow: ["İletişim", "Contact"] as M,
    baslik: ["Konuşalım.", "Let's talk."] as M,
    lead: [
      "Sponsorluk, iş birliği ya da merak ettikleriniz için bize yazın. Sponsorluk taleplerinde takımı anlatan detaylı sunumumuzu paylaşabiliriz.",
      "Write to us about sponsorship, collaboration or anything you are curious about. For sponsorship enquiries we can share the detailed deck that introduces the team.",
    ] as M,
    adres: ["Adres", "Address"] as M,
    eposta: ["E-posta", "Email"] as M,
    yonetim: ["Takım Yönetimi", "Team Leadership"] as M,
    sosyal: ["Sosyal Medya", "Social Media"] as M,
  },

  form: {
    adSoyad: ["Ad Soyad", "Full Name"] as M,
    eposta: ["E-posta", "Email"] as M,
    konu: ["Konu", "Subject"] as M,
    mesaj: ["Mesajınız", "Your Message"] as M,
    placeholder: ["Nasıl yardımcı olabiliriz?", "How can we help?"] as M,
    gonder: ["Gönder", "Send"] as M,
    gonderiliyor: ["Gönderiliyor…", "Sending…"] as M,
    basarili: [
      "Mesajınız iletildi. En kısa sürede dönüş yapacağız.",
      "Your message is with us. We will get back to you shortly.",
    ] as M,
    mailto1: ["Posta uygulamanız açıldı. Açılmadıysa doğrudan", "Your mail app should have opened. If it did not, you can write to"] as M,
    mailto2: ["adresine yazabilirsiniz.", "directly."] as M,
    varsayilanKonu: ["İletişim Formu", "Contact Form"] as M,
  },

  katil: {
    eyebrow: ["Başvuru", "Application"] as M,
    baslik1: ["Takıma", "Join"] as M,
    baslik2: ["katıl.", "the team."] as M,
    p1a: ["2011'den bu yana", "Since 2011 we have won"] as M,
    p1b: [
      "şampiyonluk kazandık ve her yıl sıfırdan bir insansız hava aracı tasarlayıp üretiyoruz. Tecrübe şart değil — öğrenmeye istekli olman yeterli. Eğitimi biz veriyoruz.",
      "championships, and every year we design and build an unmanned aerial vehicle from scratch. Experience is not required — being willing to learn is enough. We provide the training.",
    ] as M,
    p2: [
      "Hafta sonları ESTÜ'deki atölyemizde çalışıyoruz. Başvurunu aldıktan sonra seni mülakata davet ediyoruz.",
      "We work at our ESTÜ workshop on weekends. Once we receive your application we will invite you to an interview.",
    ] as M,
    formBaslik: ["Başvuru Formu", "Application Form"] as M,
    formAlt: [
      "Formu doldurup gönder; dönüşü e-posta ile yapıyoruz.",
      "Fill in the form and send it; we reply by email.",
    ] as M,
    yeniSekme: ["Yeni sekmede aç", "Open in a new tab"] as M,
    yukleniyor: ["Yükleniyor…", "Loading…"] as M,
    gorunmuyor1: ["Form görünmüyorsa", "If the form does not appear,"] as M,
    baglanti: ["bu bağlantıdan", "use this link"] as M,
    gorunmuyor2: ["doğrudan açabilirsin.", "to open it directly."] as M,
  },

  sponsor: {
    eyebrow: ["Sponsorluk · 2026–2027", "Sponsorship · 2026–2027"] as M,
    baslik1: ["Markanız bizimle", "Let your brand"] as M,
    baslik2: ["havalansın.", "take off with us."] as M,
    lead: [
      "Logonuz uçaklarımızda, takım kıyafetlerimizde ve dijital kanallarımızda yer alır. Ürünlerinizi gerçek uçuş koşullarında test eder, teknik raporunu size sunarız.",
      "Your logo goes on our aircraft, our team apparel and our digital channels. We test your products under real flight conditions and hand you the technical report.",
    ] as M,
    gorusmeTalep: ["Görüşme Talep Et", "Request a Meeting"] as M,
    dosyaIste: ["Sponsorluk Dosyası İste", "Request the Sponsorship Deck"] as M,
    mailKonu: ["Sponsorluk Görüşmesi", "Sponsorship Meeting"] as M,

    sampiyonluk: ["Şampiyonluk", "Championships"] as M,
    uye: ["Takım Üyesi", "Team Members"] as M,
    mezun: ["Sektörde Mezun", "Alumni in Industry"] as M,
    kurulus: ["Kuruluş", "Founded"] as M,

    nedenBaslik: ["Neden Katkı Yapmalısınız?", "Why Support Us?"] as M,
    nedenKicker: ["Desteğinizin karşılığı", "What your support returns"] as M,

    gorunurlukBaslik: [
      "Logonuz Nerede Görünür?",
      "Where Does Your Logo Appear?",
    ] as M,
    gorunurlukKicker: [
      "Destek karşılığında somut olarak ne aldığınız",
      "What you concretely receive in return",
    ] as M,
    gorunurluk1t: ["Uçak gövdesinde", "On the airframe"] as M,
    gorunurluk1d: [
      "Logonuz yarışmaya giden platformun gövdesinde yer alır. TEKNOFEST saha yayınlarında ve fotoğraflarda uçakla birlikte görünür.",
      "Your logo sits on the airframe of the platform that goes to the competition, appearing alongside the aircraft in TEKNOFEST broadcasts and photographs.",
    ] as M,
    gorunurluk2t: ["Takım kıyafetlerinde", "On team apparel"] as M,
    gorunurluk2d: [
      "Yarışma ve etkinlik tişörtlerinde logonuz basılı olur; 40 kişilik ekip sahada bunu taşır.",
      "Your logo is printed on our competition and event shirts; a 40-person team carries it in the field.",
    ] as M,
    gorunurluk3t: ["Sosyal medyada", "On social media"] as M,
    gorunurluk3d: [
      "Uçuş testleri, üretim aşamaları ve yarışma paylaşımlarında etiketlenir; sezon boyunca düzenli görünürlük sağlanır.",
      "You are tagged across flight tests, build updates and competition posts, giving steady visibility through the season.",
    ] as M,
    gorunurluk4t: ["Tanıtım ve raporlarda", "In decks and reports"] as M,
    gorunurluk4d: [
      "Tanıtım dosyası, teknik raporlar, standımız ve üniversite etkinliklerinde destekçi olarak yer alırsınız.",
      "You appear as a supporter in our introductory deck, technical reports, exhibition stand and university events.",
    ] as M,
    gorunurlukNot: [
      "Hangi seviyede neyin dâhil olduğunu sayfanın altındaki karşılaştırma tablosunda görebilir, ayrıntılar için sponsorluk dosyamızı indirebilirsiniz.",
      "You can see exactly what each tier includes in the comparison table further down the page, and download our sponsorship deck for the details.",
    ] as M,

    basariSerit: [
      "Desteğiniz sonuç üreten bir takıma gidiyor",
      "Your support goes to a team that delivers results",
    ] as M,

    destekciBaslik: ["Destekçilerimiz", "Our Supporters"] as M,
    destekciKicker: ["Bize güvenen markalar", "The brands that back us"] as M,

    seviyeBaslik: ["Seviyeler", "Tiers"] as M,
    seviyeKicker: [
      "Size uygun katkı düzeyi",
      "The level of support that fits you",
    ] as M,
    enUst: ["En Üst Seviye", "Top Tier"] as M,
    nakitVeyaMalzeme: [
      "nakit veya malzeme desteği",
      "cash or in-kind support",
    ] as M,
    teklifAl: ["Teklif Al", "Request an Offer"] as M,

    haklarBaslik: ["Haklar ve Avantajlar", "Rights and Benefits"] as M,
    haklarKicker: ["Seviyelerin karşılaştırması", "Tier comparison"] as M,

    kapanisBaslik: [
      "Bir görüşmeyle başlayalım.",
      "Let's start with a conversation.",
    ] as M,
    kapanisMetin: [
      "Sponsorluk dosyamızı gönderelim, ihtiyaçlarınıza göre birlikte bir iş birliği kurgulayalım.",
      "Let us send you our sponsorship deck and shape a partnership around what you need.",
    ] as M,
    dosyaIndir: [
      "Sponsorluk dosyasını indir",
      "Download the sponsorship deck",
    ] as M,
  },

  giris: {
    eyebrow: ["Takım Paneli", "Team Panel"] as M,
    baslik: ["Giriş Yap", "Sign In"] as M,
    alt: ["Yalnızca takım üyeleri içindir.", "For team members only."] as M,
    eposta: ["E-posta", "Email"] as M,
    parola: ["Parola", "Password"] as M,
    girisYap: ["Giriş Yap", "Sign In"] as M,
    girisYapiliyor: ["Giriş yapılıyor", "Signing in"] as M,
    hataKimlik: [
      "E-posta veya parola hatalı.",
      "Incorrect email or password.",
    ] as M,
    hataGenel: ["Giriş başarısız: ", "Sign-in failed: "] as M,
    anaSayfa: ["← Ana sayfaya dön", "← Back to the homepage"] as M,
    anaSayfaEtiket: ["Ana sayfa", "Homepage"] as M,
  },
} as const;
