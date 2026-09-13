import { FLEET } from "@/lib/constants";
import { fleetImage } from "@/lib/public-assets";
import { FleetSectionClient } from "./FleetSectionClient";

/**
 * Ana sayfadaki filo bölümü — ÖZET.
 *
 * Teknik değer kutuları bilerek burada değil: yan yana dizilen dört küçük
 * kutu ana sayfada dağınık duruyordu. Ad, görev ve kısa tanım kalıyor;
 * kutular ve ayrıntılı künye /filo sayfasında.
 *
 * Bu sarmalayıcı sunucuda kalıyor — `fleetImage` dosya sistemini okuyor.
 * Metinler dile bağlı olduğu için gövde istemci bileşeninde.
 */
export function FleetSection() {
  const images = Object.fromEntries(
    FLEET.map((ac) => [ac.slug, fleetImage(ac.slug)])
  );

  return <FleetSectionClient images={images} />;
}
