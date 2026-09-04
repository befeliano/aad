import { HeroScroll } from "@/components/marketing/HeroScroll";
import { heroMedia } from "@/lib/public-assets";
import { FleetSection } from "@/components/marketing/FleetSection";
import { AchievementsSection } from "@/components/marketing/AchievementsSection";
import { DepartmentsSection } from "@/components/marketing/DepartmentsSection";
import { ProcessSection } from "@/components/marketing/ProcessSection";
import { SponsorCTA } from "@/components/marketing/SponsorCTA";

export default function HomePage() {
  return (
    <>
      <HeroScroll media={heroMedia()} />
      <FleetSection />
      <AchievementsSection />
      <DepartmentsSection />
      <ProcessSection />
      <SponsorCTA />
    </>
  );
}
