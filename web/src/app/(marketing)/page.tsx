import { HeroScroll } from "@/components/marketing/HeroScroll";
import { heroMedia, heroSlides } from "@/lib/public-assets";
import { FleetSection } from "@/components/marketing/FleetSection";
import { AchievementsSection } from "@/components/marketing/AchievementsSection";
import { DepartmentsSection } from "@/components/marketing/DepartmentsSection";
import { ProcessSection } from "@/components/marketing/ProcessSection";
import { SponsorCTA } from "@/components/marketing/SponsorCTA";
import { ScrollParallax } from "@/components/marketing/ScrollParallax";
import { AtaturkBand } from "@/components/marketing/AtaturkBand";

export default function HomePage() {
  return (
    <>
      <HeroScroll media={heroMedia()} slides={heroSlides()} />
      <ScrollParallax />
      <FleetSection />
      <AchievementsSection />
      <DepartmentsSection />
      <ProcessSection />
      <AtaturkBand />
      <SponsorCTA />
    </>
  );
}
