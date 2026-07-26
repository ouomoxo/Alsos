import { Hero } from "@/components/hero/Hero";
import { FinalCta } from "@/components/sections/FinalCta";
import { GardenMapping } from "@/components/sections/GardenMapping";
import { IdentityGrows } from "@/components/sections/IdentityGrows";
import { LabClearing } from "@/components/sections/LabClearing";
import { RoadmapPreview } from "@/components/sections/RoadmapPreview";
import { RootStructure } from "@/components/sections/RootStructure";
import { Seasons } from "@/components/sections/Seasons";

/**
 * The homepage is one growth narrative, not a stack of feature blocks (§7).
 *
 * Read top to bottom it goes: a seed germinates in a hand, knowledge takes
 * root, roots branch into paths, paths are proven in clearings, proof
 * accumulates into an identity, identity is planted in a garden, the garden
 * moves through seasons — and then the screen returns to darkness with one seed
 * and one invitation.
 *
 * Each section is structurally different by design: a spine diagram, a root
 * network plus list, a workspace still, a progression rail, a legend, a
 * timeline. Repeating one layout would flatten the story into a brochure (§20).
 */
export default function HomePage() {
  return (
    <>
      <Hero />
      <RootStructure />
      <RoadmapPreview />
      <LabClearing />
      <IdentityGrows />
      <GardenMapping />
      <Seasons />
      <FinalCta />
    </>
  );
}
