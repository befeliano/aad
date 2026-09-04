import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { DEPT_LABELS } from "@/lib/constants";
import { PageHeader } from "./PageHeader";

/**
 * Yetkisiz erişim ekranı. Asıl koruma Supabase RLS'te; bu katman
 * kullanıcıya neden göremediğini anlatan arayüz tarafıdır.
 */
export function AccessDenied({
  title,
  allowed,
  adminOnly = false,
}: {
  title: string;
  allowed?: string[];
  adminOnly?: boolean;
}) {
  return (
    <>
      <PageHeader title={title} />
      <div className="flex flex-col items-center justify-center rounded-2xl border border-line bg-bg-1 px-6 py-20 text-center">
        <ShieldAlert size={32} className="text-warn" />
        <h2 className="mt-5 text-lg font-bold text-ink">
          Bu bölüme erişiminiz yok
        </h2>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-2">
          {adminOnly ? (
            <>Bu sayfa yalnızca takım kaptanına (admin) açıktır.</>
          ) : (
            <>
              Bu bölüm{" "}
              <strong className="text-ink">
                {(allowed || [])
                  .map((d) => DEPT_LABELS[d] || d)
                  .join(", ")}
              </strong>{" "}
              departmanlarına açıktır. Departmanınız hatalıysa takım kaptanına
              başvurun.
            </>
          )}
        </p>
        <Link
          href="/panel"
          className="mt-7 rounded-full border border-line-2 px-6 py-3 text-sm font-semibold text-ink transition-colors hover:border-ink-3"
        >
          Panele dön
        </Link>
      </div>
    </>
  );
}
