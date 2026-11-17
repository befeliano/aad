import { connection } from "next/server";
import { FLEET } from "@/lib/constants";
import { fleetImage, versionedPublicUrl } from "@/lib/public-assets";
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
export async function FleetSection() {
  /* Statik sayfa önbelleği görsel adresini dondurmasın */
  await connection();
  const images = Object.fromEntries(
    FLEET.map((ac) => [ac.slug, versionedPublicUrl(fleetImage(ac.slug))])
  );

  return <FleetSectionClient images={images} />;
}
