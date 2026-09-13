import { teamPhotos } from "@/lib/public-assets";
import { DepartmentsSectionClient } from "./DepartmentsSectionClient";

/**
 * Ekip bölümü. Fotoğraflar dosya sisteminden okunduğu için bu sarmalayıcı
 * sunucuda kalıyor; dile bağlı gövde istemci bileşeninde.
 */
export function DepartmentsSection() {
  return <DepartmentsSectionClient photos={teamPhotos()} />;
}
