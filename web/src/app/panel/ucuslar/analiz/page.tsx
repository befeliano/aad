import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { FlightAnalysis } from "@/components/panel/ucuslar/FlightAnalysis";

export const metadata = { title: "Uçuş Analizi" };

export default async function AnalizPage() {
  const session = await getSession();
  if (!session) redirect("/giris?next=/panel/ucuslar/analiz");

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
