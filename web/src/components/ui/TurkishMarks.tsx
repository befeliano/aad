/* ============================================================
   Türk bayrağı ve Atatürk imzası
   ============================================================ */

/** Türk bayrağı — oranlar bayrak kanununa uygun (2:3) */
export function TurkishFlag({
  className = "",
  title = "Türkiye",
}: {
  className?: string;
  title?: string;
}) {
  /* Resmi bayrak dosyası public/images/Flag_of_Turkey.svg
     (oran 2:3 — genişliği yükseklikten türetiyoruz) */
  return (
    <span
      role="img"
      aria-label={title}
      title={title}
      className={className}
      style={{
        display: "inline-block",
        aspectRatio: "3 / 2",
        backgroundImage: "url(/images/Flag_of_Turkey.svg)",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    />
  );
}

/**
 * Atatürk imzası.
 * Kaynak SVG siyah dolguludur; CSS maskesi olarak kullanarak
 * bulunduğu yerin metin rengini almasını sağlıyoruz — böylece
 * hem aydınlık hem karanlık temada doğru görünür.
 */
export function AtaturkSignature({
  className = "",
}: {
  className?: string;
}) {
  return (
    <span
      role="img"
      aria-label="Mustafa Kemal Atatürk imzası"
      className={className}
      style={{
        display: "block",
        backgroundColor: "currentColor",
        WebkitMaskImage: "url(/images/ataturk-imza.svg)",
        maskImage: "url(/images/ataturk-imza.svg)",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
        WebkitMaskSize: "contain",
        maskSize: "contain",
        aspectRatio: "572 / 205",
      }}
    />
  );
}
