/* Panel navigasyon yapısı — erişim kuralları eski RBAC ile birebir */
import { LEADERSHIP_ROLES } from "@/lib/constants";

export interface NavEntry {
  href: string;
  label: string;
  icon: string; // lucide ikon adı
  allowedDepts?: string[];
  adminOnly?: boolean;
  /** Tam rol eşleşmesi — bkz. canAccess */
  exactRoles?: string[];
}

export interface NavGroup {
  title: string;
  items: NavEntry[];
}

export const PANEL_NAV: NavGroup[] = [
  {
    title: "Genel",
    items: [
      { href: "/panel", label: "Genel Bakış", icon: "LayoutDashboard" },
      { href: "/panel/gorevler", label: "Görevler", icon: "KanbanSquare" },
      { href: "/panel/ihtiyaclar", label: "İhtiyaç Tablosu", icon: "ClipboardList" },
      { href: "/panel/takvim", label: "Çalışma Takvimi", icon: "CalendarDays" },
      { href: "/panel/yoklama", label: "Yoklama Kayıtları", icon: "ClipboardCheck" },
      { href: "/panel/toplanti", label: "Toplantı Odası", icon: "Video" },
      { href: "/panel/ayarlar/profil", label: "Profilim", icon: "UserRound" },
    ],
  },
  {
    title: "Operasyon",
    items: [
      {
        href: "/panel/envanter",
        label: "Envanter",
        icon: "Boxes",
        allowedDepts: ["yazilim", "tasarim", "yapisal", "kompozit", "aviyonik", "sponsorluk"],
      },
      { href: "/panel/ucuslar", label: "Uçuş Kayıtları", icon: "Plane" },
      { href: "/panel/hava-durumu", label: "Hava Durumu", icon: "CloudSun" },
      {
        // Medya & Sponsorluk'a kapalı — telemetri ham verisi teknik bir konu
        href: "/panel/ucuslar/analiz",
        label: "Uçuş Analizi",
        icon: "Activity",
        allowedDepts: ["yazilim", "tasarim", "yapisal", "kompozit", "aviyonik"],
      },
      {
        href: "/panel/notlar",
        label: "Uçuş Notları",
        icon: "NotebookPen",
        allowedDepts: ["yazilim", "tasarim", "yapisal", "kompozit", "aviyonik"],
      },
      {
        href: "/panel/arizalar",
        label: "Arıza Günlüğü",
        icon: "Wrench",
      },
      {
        href: "/panel/telemetri",
        label: "API & Telemetri",
        icon: "Radio",
        allowedDepts: ["yazilim", "aviyonik"],
      },
    ],
  },
  {
    title: "Arşiv",
    items: [
      {
        href: "/panel/materyaller",
        label: "Medya & Materyaller",
        icon: "Images",
      },
      {
        // 3D parçaları tüm takım görebilir; yükleme/silme yetkisi
        // PARTS_WRITE_DEPTS ile modül içinde sınırlanır.
        href: "/panel/parcalar",
        label: "Parçalar (3D)",
        icon: "Box",
      },
    ],
  },
  {
    title: "Sponsorluk",
    items: [
      {
        href: "/panel/sponsorluk",
        label: "Bütçe & Sponsor",
        icon: "HandCoins",
        allowedDepts: ["sponsorluk"],
      },
      {
        href: "/panel/mesajlar",
        label: "Gelen Kutusu",
        icon: "Mail",
        allowedDepts: ["sponsorluk"],
      },
    ],
  },
  {
    title: "Yönetim",
    items: [
      { href: "/panel/uyeler", label: "Üye Yönetimi", icon: "Users", adminOnly: true },
      {
        href: "/panel/mulakat",
        label: "Mülakatlar",
        icon: "UserPlus",
      },
      {
        href: "/panel/ayarlar/checklist",
        label: "Kontrol Listesi",
        icon: "ListChecks",
        adminOnly: true,
      },
      {
        // Yalnızca takım kaptanı ve yazılım ekibi — kaptan yardımcısı dâhil
        // değil. Denetim günlüğü teknik bir araç, yönetsel değil.
        href: "/panel/kayitlar",
        label: "İşlem Kayıtları",
        icon: "ScrollText",
        exactRoles: [...LEADERSHIP_ROLES],
        allowedDepts: ["yazilim"],
      },
    ],
  },
];
