import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession, canAccess } from "@/lib/auth";
import { FlightAnalysis } from "@/components/panel/ucuslar/FlightAnalysis";
import { AccessDenied } from "@/components/panel/AccessDenied";

export const metadata = { title: "Uçuş Analizi" };

/** Telemetri ham verisi teknik birimlere açık; Medya & Sponsorluk'a kapalı. */
const ALLOWED = ["yazilim", "tasarim", "yapisal", "kompozit", "aviyonik"];

export default async function AnalizPage() {
  const session = await getSession();
  if (!session) redirect("/giris?next=/panel/ucuslar/analiz");
  if (!canAccess(session, { allowedDepts: ALLOWED })) {
    return <AccessDenied title="Uçuş Analizi" allowed={ALLOWED} />;
  }

  // useSearchParams (?flight=) Suspense sınırı gerektirir
  return (
    <Suspense
      fallback={
        <div className="rounded-2xl border border-line bg-bg-1 px-5 py-20 text-center text-sm text-ink-3">
          Yükleniyor…
        </div>
      }
    >
      <FlightAnalysis />
    </Suspense>
  );
}
