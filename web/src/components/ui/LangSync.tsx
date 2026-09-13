"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useLang } from "@/lib/i18n";

/**
 * `<html lang>` ile seçili dili eşitler.
 *
 * Neden gerekli: lang yalnızca düğmeye basıldığında güncelleniyordu, o
 * yüzden sayfa İngilizce tercihiyle yeniden yüklendiğinde "tr" kalıyordu.
 * CSS'in `text-transform: uppercase` kuralı bu özniteliğe bakar
 * (tr: i → İ, en: i → I), yani yanlış lang görünür bir hata demek.
 *
 * Panel her koşulda Türkçe: istemci tarafı gezinmeyle panele geçildiğinde
 * lang geri "tr"ye alınıyor.
 */
export function LangSync() {
  const lang = useLang();
  const pathname = usePathname();

  useEffect(() => {
    const panel = pathname?.startsWith("/panel") ?? false;
    document.documentElement.lang = panel ? "tr" : lang;
  }, [lang, pathname]);

  return null;
}
