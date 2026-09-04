import { SiteHeader } from "@/components/marketing/SiteHeader";
import { SiteFooter } from "@/components/marketing/SiteFooter";
import { PageAircraft } from "@/components/marketing/PageAircraft";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <SiteHeader />
      <PageAircraft />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </>
  );
}
