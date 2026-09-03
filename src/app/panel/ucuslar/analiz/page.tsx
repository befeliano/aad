import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { FlightAnalysis } from "@/components/panel/ucuslar/FlightAnalysis";

export const metadata = { title: "Uçuş Analizi" };

export default async function AnalizPage() {
  const session = await getSession();
  if (!session) redirect("/giris?next=/panel/ucuslar/analiz");

  return <FlightAnalysis />;
}
