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
    baslik2: ["tasarlıyoruz", "the sky"] as M,
    sponsorOl: ["Sponsorluk Bilgisi", "Sponsorship Information"] as M,
    takimaKatil: ["Takıma Katıl", "Join the Team"] as M,
    filoyuKesfet: ["Filo Hakkında", "About the Fleet"] as M,
    kaydir: ["Kaydır", "Scroll"] as M,
    gorselAlt: ["gün batımında test uçuşu", "test flight at sunset"] as M,
    medyaAlani: ["Hero görseli · medya alanı", "Hero image · media slot"] as M,
    birincilik: ["Birincilik", "First Place"] as M,
    derece: ["Derece", "Competition Results"] as M,
    uye: ["Takım Üyesi", "Team Members"] as M,
    mezun: ["Mezun Sayısı", "Alumni"] as M,
    kurulusYili: ["Kuruluş", "Founded"] as M,
    rozet1: [
      "TEKNOFEST Savaşan İHA · 2022 · Birincilik",
      "TEKNOFEST Combat UAV · 2022 · First Place",
    ] as M,
    rozet2: [
      "SAE Aero Design East · 2017 · Birincilik",
      "SAE Aero Design East · 2017 · First Place",
    ] as M,
    rozet3: [
      "TEKNOFEST TÜBİTAK Uluslararası İHA · 2018 · Birincilik",
      "TEKNOFEST TÜBİTAK International UAV · 2018 · First Place",
    ] as M,
  },

  filo: {
    baslik: ["Filo", "Fleet"] as M,
    kicker: [
      "2011'den bugüne geliştirilen platformlar",
      "Platforms developed since 2011",
    ] as M,
    tanim1: [
      "Filo, sabit kanatlı savaşan İHA'lardan hidrojen yakıt hücreli Ar-Ge hava aracına kadar farklı platformlardan oluşur. Aerodinamik tasarım, kompozit gövde, aviyonik entegrasyonu ve otonom uçuş yazılımı ekip bünyesinde geliştirilir.",
      "The fleet includes a range of platforms, from fixed-wing combat UAVs to a hydrogen fuel-cell R&D aircraft. Aerodynamic design, composite airframes, avionics integration and autonomous flight software are developed by the team.",
    ] as M,
    tanim2: [
      "Aşağıda platformların kısa künyeleri yer alır. Teknik değerler, görev profilleri ve arşivdeki hava araçları için filo sayfasını inceleyebilirsiniz.",
      "Brief profiles of the platforms are listed below. Visit the fleet page for technical specifications, mission profiles and archived aircraft.",
    ] as M,
    tumFilo: ["Tüm filo", "Full fleet"] as M,
    ihaAlt: ["insansız hava aracı", "unmanned aerial vehicle"] as M,
    specOzellik: ["Özellik", "Specification"] as M,
    specDeger: ["Değer", "Value"] as M,
    /* /filo sayfası başlığı */
    sayfaBaslik1: ["2011'den bugüne", "Everything we have built"] as M,
    sayfaBaslik2: ["geliştirilen platformlar", "since 2011"] as M,
    sayfaLead: [
      "Her platform önceki çalışmaların mühendislik birikimi üzerine kurulur. Sabit kanatlı hava araçlarından hidrojen yakıt hücresi Ar-Ge'sine kadar tasarım, üretim ve uçuş testleri ekip bünyesinde gerçekleştirilir.",
      "Each platform builds on the engineering work that came before it. From fixed-wing aircraft to hydrogen fuel-cell research, design, manufacturing and flight testing are carried out by the team.",
    ] as M,
  },

  basarilar: {
    baslik: ["Başarılar", "Achievements"] as M,
    kicker: [
      "2013'ten bugüne yarışmalarda elde edilen dereceler",
      "Competition results since 2013",
    ] as M,
    ulusal: ["Ulusal", "National"] as M,
    uluslararasi: ["Uluslararası", "International"] as M,
    birincilik: ["Birincilik", "First Place"] as M,
    derece: ["Derece", "Competition Results"] as M,
  },

  ekip: {
    baslik: ["Ekip", "Team"] as M,
    kicker: ["Altı alt ekip, tek hava aracı", "Six sub-teams, one aircraft"] as M,
    aktifUye: ["Aktif Üye", "Active Members"] as M,
    brans: ["Disiplin Sayısı", "Discipline Count"] as M,
    mezun: ["Mezun Sayısı", "Alumni"] as M,
    kurulus: ["Kuruluş", "Founded"] as M,
    mezunNot: [
      "Mezunlarımız savunma sanayinde ve farklı sektörlerde görev almaktadır.",
      "Our graduates work in the defense industry and across other sectors.",
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
    baslik2: ["bizim alanımız", "our domain"] as M,
    metin: [
      "2011'den bu yana geliştirilen her platform, sonraki tasarım çalışmalarına mühendislik temeli oluşturdu. Sayfayı kaydırdıkça filodaki hava araçlarını görebilirsiniz.",
      "Each platform developed since 2011 has informed the engineering of those that followed. Scroll down to explore the aircraft in our fleet.",
    ] as M,
  },

  cta: {
    kicker: ["Birlikte daha yükseğe", "Higher, together"] as M,
    baslik1: ["Markanızı gökyüzüne", "Let's take your brand"] as M,
    baslik2: ["taşınsın", "to the sky"] as M,
    metin: [
      "Sponsorluk ve iş birliği konularını görüşmek için bizimle iletişime geçebilirsiniz.",
      "Please contact us to discuss sponsorship and collaboration.",
    ] as M,
    iletisim: ["İletişim", "Contact"] as M,
    sponsorOl: ["Sponsorluk Bilgisi", "Sponsorship Information"] as M,
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
      "Eskişehir Teknik Üniversitesi insansız hava aracı tasarım, üretim ve test takımı. TEKNOFEST Savaşan İHA ve TÜBİTAK Uluslararası İHA Yarışmalarında derece sahibi.",
      "The unmanned aerial vehicle design, manufacturing and test team of Eskişehir Technical University, with results in the TEKNOFEST Combat UAV and TÜBİTAK International UAV competitions.",
    ] as M,
    sehir: ["Eskişehir, Türkiye", "Eskişehir, Türkiye"] as M,
  },

  galeri: {
    eyebrow: ["Galeri", "Gallery"] as M,
    baslik: ["Sahadan kareler", "Frames from the field"] as M,
    lead: [
      "Test uçuşları, atölye çalışmaları ve yarışma anları. Takımın hikâyesi burada.",
      "Test flights, workshop sessions and competition moments. The team's story lives here.",
    ] as M,
    bosBaslik: ["Galeri yakında dolacak", "The gallery is filling up soon"] as M,
    bosMetin: [
      "Takım fotoğraf ve videoları panelden yüklendiğinde burada görünecek. Şimdilik en güncel içeriklerimizi Instagram'da bulabilirsiniz.",
      "Team photos and videos will appear here as they are uploaded from the panel. For now you can find our latest content on Instagram.",
    ] as M,
    instagram: ["Instagram içerikleri", "Instagram posts"] as M,
    kapat: ["Kapat", "Close"] as M,
  },

  iletisim: {
    eyebrow: ["İletişim", "Contact"] as M,
    baslik: ["Bizimle iletişime geçin!", "Contact us!"] as M,
    lead: [
      "Sponsorluk, iş birliği ve diğer konular için bizimle iletişime geçebilirsiniz. Sponsorluk taleplerinde takım tanıtım dosyası paylaşılabilir.",
      "Contact us about sponsorship, collaboration or other enquiries. We can share the team information pack for sponsorship requests.",
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
      "Mesajınız iletilmiştir. En kısa sürede tarafınıza dönüş sağlanacaktır.",
      "Your message has been received. A reply will be sent as soon as possible.",
    ] as M,
    mailto1: ["Posta uygulamanız açıldı. Açılmadıysa doğrudan", "Your mail app should have opened. If it did not, you can write to"] as M,
    mailto2: ["adresine yazabilirsiniz.", "directly."] as M,
    varsayilanKonu: ["İletişim Formu", "Contact Form"] as M,
  },

  katil: {
    eyebrow: ["Başvuru", "Application"] as M,
    baslik1: ["Takımımıza", "Team"] as M,
    baslik2: ["Katılım", "Application"] as M,
    p1: [
      "Anatolia Aero Design ekibi olarak 2011 yılından bu yana insansız hava araçları üzerine çalışan genç ve dinamik bir ekibiz. Daha önce çeşitli ulusal ve uluslararası yarışmalara katıldık, hem mühendislik alanında hem de takım çalışmasında önemli tecrübeler kazandık. Geliştirdiğimiz çeşitli sistemler ve insansız hava araçları ile kendimizi sürekli geliştirmeye devam ediyoruz.",
      "Anatolia Aero Design is a young and dynamic team that has been working on unmanned aerial vehicles since 2011. We have participated in national and international competitions, gaining valuable experience in engineering and teamwork. We continue to develop ourselves through the systems and unmanned aerial vehicles we build.",
    ] as M,
    basarilarBaslik: ["Başarılarımızdan bazıları;", "Some of our achievements:"] as M,
    basari1: ["2015 SAE Dünya 3.'lüğü", "2015 SAE 3rd Place Worldwide"] as M,
    basari2: ["2016 SAE Dünya 1.'liği", "2016 SAE 1st Place Worldwide"] as M,
    basari3: [
      "2018 TÜBİTAK Sabit Kanat Kategorisi 1.'liği",
      "2018 TÜBİTAK Fixed-Wing Category 1st Place",
    ] as M,
    basari4: ["2022 Savaşan İHA 1.'liği", "2022 Combat UAV 1st Place"] as M,
    p2: [
      "Bu başvuru formunun asıl amacı sizlerin teknik yeterliliğini ölçmek değil; öğrenmeye olan isteğinizi, takım çalışmasına yatkınlığınızı ve problem çözme yaklaşımınızı görmektir. Bizim için en önemli kriterler, zorluklar karşısında vazgeçmemeniz ve hevesli olmanızdır. Soruları cevaplarken araştırmaktan çekinmeyiniz.",
      "The main purpose of this application form is not to measure your technical qualifications, but to understand your willingness to learn, your approach to teamwork and problem solving. The most important criteria for us are perseverance in the face of challenges and enthusiasm. Please feel free to research the questions as you answer them.",
    ] as M,
    p3: [
      "Başvurunuz incelendikten sonra, değerlendirmenin olumlu sonuçlanması durumunda mülakat süreci için sizlerle iletişime geçilecektir.",
      "After your application is reviewed, you will be contacted about an interview if the evaluation is positive.",
    ] as M,
    formBaslik: ["Başvuru Formu", "Application Form"] as M,
    formAlt: [
      "Formu doldurup gönderebilirsiniz; dönüş e-posta ile iletilecektir.",
      "Please complete and submit the form. A reply will be sent by email.",
    ] as M,
    yeniSekme: ["Yeni sekmede form", "Form in a new tab"] as M,
    yukleniyor: ["Yükleniyor…", "Loading…"] as M,
    gorunmuyor1: ["Form görüntülenmiyorsa", "If the form does not appear,"] as M,
    baglanti: ["bu bağlantıdan", "use this link"] as M,
    gorunmuyor2: ["doğrudan açabilirsiniz.", "to open it directly."] as M,
  },

  sponsor: {
    eyebrow: ["Sponsorluk · 2026–2027", "Sponsorship · 2026–2027"] as M,
    baslik1: ["Markanız bizimle", "Let your brand"] as M,
    baslik2: ["havalansın", "take off with us"] as M,
    lead: [
      "Logonuz hava araçlarımızda, takım kıyafetlerinde ve dijital kanallarda yer alır. Ürünleriniz gerçek uçuş koşullarında test edilir; teknik rapor hazırlanarak paylaşılır.",
      "Your logo is featured on our aircraft, team apparel and digital channels. Your products are tested under real flight conditions, and a technical report is prepared and shared.",
    ] as M,
    gorusmeTalep: ["Görüşme Talebi", "Meeting Request"] as M,
    dosyaIste: ["Sponsorluk Dosyası", "Sponsorship Deck"] as M,
    mailKonu: ["Sponsorluk Görüşmesi", "Sponsorship Meeting"] as M,

    birincilik: ["Birincilik", "First Place"] as M,
    derece: ["Derece", "Competition Results"] as M,
    uye: ["Takım Üyesi", "Team Members"] as M,
    mezun: ["Mezun Sayısı", "Alumni"] as M,
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
      "Logonuz yarışmaya katılan hava aracının gövdesinde yer alır; TEKNOFEST yayınlarında ve fotoğraflarında görünür.",
      "Your logo appears on the airframe of the aircraft entered in the competition, including in TEKNOFEST broadcasts and photographs.",
    ] as M,
    gorunurluk2t: ["Takım kıyafetlerinde", "On team apparel"] as M,
    gorunurluk2d: [
      "Yarışma ve etkinlik tişörtlerinde logonuz basılı olur; 40 kişilik ekip sahada bu kıyafetleri giyer.",
      "Your logo is printed on competition and event shirts worn by the 40-person team.",
    ] as M,
    gorunurluk3t: ["Sosyal medyada", "On social media"] as M,
    gorunurluk3d: [
      "Uçuş testleri, üretim aşamaları ve yarışma paylaşımlarında etiketlenir; sezon boyunca düzenli görünürlük sağlanır.",
      "You are tagged across flight tests, build updates and competition posts, giving steady visibility through the season.",
    ] as M,
    gorunurluk4t: ["Tanıtım ve raporlarda", "In decks and reports"] as M,
    gorunurluk4d: [
      "Tanıtım dosyalarında, teknik raporlarda, etkinlik standında ve üniversite etkinliklerinde destekçi olarak yer alırsınız.",
      "Your support is acknowledged in team information packs, technical reports, event stands and university events.",
    ] as M,
    basariSerit: [
      "Desteğiniz sonuç üreten bir takıma gidiyor",
      "Your support goes to a team that delivers results",
    ] as M,

    destekciBaslik: ["Destekçilerimiz", "Our Supporters"] as M,
    destekciKicker: ["Bize güvenen markalar", "The brands that back us"] as M,

    kapanisBaslik: [
      "Bir görüşmeyle başlayalım.",
      "Let's start with a conversation.",
    ] as M,
    kapanisMetin: [
      "Sponsorluk ve iş birliği seçeneklerini görüşmek için bizimle iletişime geçebilirsiniz.",
      "Please contact us to discuss sponsorship and collaboration opportunities.",
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
