import type { Metadata, Viewport } from "next";
import { Sora, Inter } from "next/font/google";
import { LangSync } from "@/components/ui/LangSync";
import "./globals.css";

const display = Sora({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  display: "swap",
});

const sans = Inter({
  variable: "--font-sans",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://anatoliaaerodesign.vercel.app"),
  title: {
    default: "Anatolia Aero Design — ESTÜ İHA Takımı",
    template: "%s · Anatolia Aero Design",
  },
  description:
    "Eskişehir Teknik Üniversitesi Anatolia Aero Design İHA Proje Takımı. Teknofest 2022 Savaşan İHA Türkiye 1.'si, Teknofest 2018 UAV Turkey 1.'si.",
  keywords: [
    "Anatolia Aero Design",
    "ESTÜ İHA",
    "insansız hava aracı",
    "Teknofest",
    "Savaşan İHA",
    "Eskişehir Teknik Üniversitesi",
  ],
  icons: { icon: "/logo.jpg", apple: "/logo.jpg" },
  openGraph: {
    title: "Anatolia Aero Design — ESTÜ İHA Takımı",
    description:
      "Teknofest şampiyonu öğrenci İHA takımı. Sponsorluk ve iş birlikleri için.",
    type: "website",
    locale: "tr_TR",
    images: ["/logo.jpg"],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#080b12" },
  ],
  width: "device-width",
  initialScale: 1,
};

/* Tema ve dil flash'ını (FOUC) önler — React hydration'dan önce çalışır.
   Dil yalnızca halka açık sayfalarda uygulanıyor: panel Türkçe kalıyor ve
   <html lang> CSS'in uppercase kuralını belirliyor (tr: i → İ, en: i → I). */
const THEME_SCRIPT = `
(function(){
  try {
    var t = localStorage.getItem('aad-theme');
    if (t === 'dark' || t === 'light') {
      document.documentElement.setAttribute('data-theme', t);
    }
  } catch (e) {}
  try {
    if (localStorage.getItem('aad-lang') === 'en' &&
        location.pathname.indexOf('/panel') !== 0) {
      document.documentElement.lang = 'en';
    }
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="tr"
      className={`${display.variable} ${sans.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col bg-bg text-ink">
        <LangSync />
        {children}
      </body>
    </html>
  );
}
