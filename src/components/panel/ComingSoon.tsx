import { Construction } from "lucide-react";
import { PageHeader } from "./PageHeader";

export function ComingSoon({ title, desc }: { title: string; desc?: string }) {
  return (
    <>
      <PageHeader title={title} desc={desc} />
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line-2 bg-bg-1 py-24 text-center">
        <Construction size={32} className="text-ink-3" />
        <p className="eyebrow mt-4 !text-[10.5px]">
          Bu modül yakında
        </p>
        <p className="mt-2 max-w-sm text-sm text-ink-2">
          Mevcut siteden bu bölüm Next.js&apos;e taşınıyor. Öncelik sırasına göre
          eklenmektedir.
        </p>
      </div>
    </>
  );
}
