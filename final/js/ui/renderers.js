/* ============================================================
   renderers.js — Sayfa içi statik render'lar
   - Departman modal
   - Sponsor strip
   - Contact form
   ============================================================ */

import { $, escapeHtml } from '../utils/helpers.js';
import { Modal, showToast } from './components.js';
import { sb } from '../supabase.js';

/* ============================================================
   DEPARTMAN MODAL
   ============================================================ */
const DEPT_DETAILS = {
  yazilim: { num: '01', name: 'Yazılım',
    lead: 'Otopilot, görev yönetimi ve yer kontrol istasyonu yazılımları üzerine çalışan ekibimiz.',
    body: `Yazılım departmanı, İHA'larımızın "beyni" olan otopilot sistemlerini, görev planlama yazılımlarını ve yer istasyonu arayüzlerini geliştirir.`,
    tasks: [
      { t: 'Otopilot Geliştirme', d: 'PX4 / ArduPilot tabanlı otonom uçuş kontrolü' },
      { t: 'Görev Yazılımı', d: 'Waypoint navigasyonu, otomatik iniş-kalkış' },
      { t: 'Yer İstasyonu', d: 'Telemetri görselleştirme ve komuta arayüzü' },
      { t: 'Görüntü İşleme', d: 'OpenCV ile nesne tespiti ve takip algoritmaları' }
    ]},
  yapisal: { num: '02', name: 'Yapısal',
    lead: 'Mekanik tasarım, montaj süreçleri ve dayanım analizi ile uçaklarımızın iskeletini şekillendiriyoruz.',
    body: `CAD modelleme, sonlu elemanlar analizi (FEA), aerodinamik hesaplamalar ve montaj süreçleri bu departmanın sorumluluğundadır.`,
    tasks: [
      { t: '3D CAD Tasarım', d: 'Tüm gövde, kanat ve kuyruk yapılarının modellenmesi' },
      { t: 'Yapısal Analiz', d: 'FEA ile dayanım, titreşim, yorgunluk testleri' },
      { t: 'Aerodinamik', d: 'Kanat profili seçimi, CFD doğrulamaları' },
      { t: 'Montaj & Üretim', d: 'Atölyede son ürün haline getirme süreci' }
    ]},
  aviyonik: { num: '03', name: 'Aviyonik',
    lead: 'İHA üzerindeki tüm elektronik beyin ve sinir sistemi: sensörler, telemetri ve güç dağıtımı.',
    body: `Uçuş kontrolcüsünden GPS'e, telemetri modülünden batarya yönetim sistemine kadar tüm elektronik altyapı aviyonik departmanının sorumluluğundadır.`,
    tasks: [
      { t: 'Uçuş Kontrolcü', d: 'Pixhawk, Cube ve diğer FCU\'ların entegrasyonu' },
      { t: 'Sensör Entegrasyonu', d: 'IMU, GPS, hava hızı, lidar, kamera' },
      { t: 'Güç Sistemi', d: 'BEC, ESC, batarya seçimi ve yönetimi' },
      { t: 'Telemetri & RC', d: 'Veri linki ve kontrol kanallarının ayarı' }
    ]},
  kompozit: { num: '04', name: 'Kompozit',
    lead: 'Karbon fiber, cam fiber ve epoksi reçine ile hafif ama dayanıklı yapılar üretiriz.',
    body: `Kalıp hazırlama, vakum bagging, infüzyon süreçleri ile uçaklarımızın ana yapı parçalarını üretiyoruz.`,
    tasks: [
      { t: 'Kalıp Üretimi', d: 'Pozitif/negatif kalıpların hazırlanması' },
      { t: 'Laminasyon', d: 'Karbon/cam fiber katmanlama, vakum bagging' },
      { t: 'İnfüzyon', d: 'Reçine infüzyonu ile yüksek kaliteli parçalar' },
      { t: 'Yüzey İşleme', d: 'Zımpara, dolgu ve boya süreci' }
    ]},
  sponsorluk: { num: '05', name: 'Sponsorluk',
    lead: 'Kurumsal ilişkiler, finansman, sözleşme yönetimi ve sponsor geri dönüşleri.',
    body: `Şirketlerle iletişim, sponsorluk paketleri, sözleşmeler ve sponsor görünürlüğünün takibi bu departmanda yapılır.`,
    tasks: [
      { t: 'Kurumsal İletişim', d: 'Potansiyel sponsorlarla görüşmeler' },
      { t: 'Sponsorluk Paketleri', d: 'Bronz, Gümüş, Altın, Platin paketler' },
      { t: 'Bütçe Yönetimi', d: 'Departmanlar arası kaynak dağılımı' },
      { t: 'Geri Dönüş Takibi', d: 'Sponsor görünürlüğü ve raporlama' }
    ]},
  medya: { num: '06', name: 'Medya & Tanıtım',
    lead: 'Takımın yüzü ve sesi: içerik, fotoğraf, video, sosyal medya ve etkinlik.',
    body: `Profesyonel fotoğraf çekimi, video prodüksiyonu, sosyal medya yönetimi ve takımın görsel kimliğinin tasarımı bu departmanın sorumluluğundadır.`,
    tasks: [
      { t: 'İçerik Üretimi', d: 'Sosyal medya postları, hikayeler' },
      { t: 'Fotoğraf & Video', d: 'Test uçuşları, yarışmalar, atölye süreçleri' },
      { t: 'Marka Kimliği', d: 'Logo, şablonlar, sunum tasarımları' },
      { t: 'Etkinlik & PR', d: 'Tanıtım günleri, fuarlar, basın bülten' }
    ]}
};

export function initDeptModal() {
  $('deptGrid')?.addEventListener('click', (e) => {
    const card = e.target.closest('.dept-card');
    if (!card) return;
    const d = DEPT_DETAILS[card.dataset.dept];
    if (!d) return;
    $('deptModalNum').textContent = d.num;
    $('deptTitle').textContent = d.name;
    $('deptModalBody').innerHTML = `
      <p class="modal__lead">${escapeHtml(d.lead)}</p>
      <p>${escapeHtml(d.body)}</p>
      <ul class="modal__list">
        ${d.tasks.map(t => `<li><strong>${escapeHtml(t.t)}</strong>${escapeHtml(t.d)}</li>`).join('')}
      </ul>
    `;
    Modal.open('deptModal');
  });
}

/* ============================================================
   SPONSOR STRIP (footer'daki kayan band)
   ============================================================ */
export function renderSponsorStrip(sponsors) {
  const items = sponsors && sponsors.length > 0
    ? [...new Set(sponsors.map(s => s.name))]
    : ['Anatolia Aero Design', 'Eskişehir Teknik Üniversitesi', 'ETİ', 'Teknofest', 'ESTÜ'];
  const track = $('sponsorTrack');
  if (!track) return;
  track.innerHTML = [...items, ...items]
    .map(n => `<span class="sponsor-chip">${escapeHtml(n)}</span>`).join('');
}

/* ============================================================
   CONTACT FORM
   ============================================================ */
export function initContactForm() {
  $('contactForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const { error: e2 } = await sb.from('contact_messages').insert([{
      name: fd.get('name'),
      email: fd.get('email'),
      subject: fd.get('subject'),
      message: fd.get('message')
    }]);
    if (e2) {
      showToast('Mesaj gönderilemedi: ' + e2.message, 'error');
      return;
    }
    e.target.reset();
    showToast('Mesajınız iletildi. Teşekkürler!');
  });
}