/**
 * CesiumJS'in çalışma zamanı varlıklarını (Workers, Assets, Widgets)
 * node_modules'ten public/cesium'a kopyalar.
 *
 * Neden: Cesium'u CDN'den yüklemek CSP'de script-src'ye üçüncü taraf host
 * eklemeyi gerektirirdi. Kendi sunucumuzdan servis edince CSP 'self'
 * kalıyor. public/cesium git'e girmez (.gitignore), her build'de üretilir.
 */
import { cp, mkdir, stat } from "node:fs/promises";
import path from "node:path";

const src = path.join(process.cwd(), "node_modules", "cesium", "Build", "Cesium");
const dest = path.join(process.cwd(), "public", "cesium");

try {
  await stat(src);
} catch {
  console.error("[cesium] node_modules/cesium bulunamadı — 'npm install' çalıştırın.");
  process.exit(1);
}

// Zaten kopyalanmışsa tekrar kopyalama (dev'de her başlatmada beklemeyelim)
try {
  await stat(path.join(dest, "Cesium.js"));
  console.log("[cesium] public/cesium zaten hazır, atlanıyor.");
  process.exit(0);
} catch {
  /* yok — kopyala */
}

await mkdir(dest, { recursive: true });
await cp(src, dest, { recursive: true });
console.log("[cesium] public/cesium'a kopyalandı.");
