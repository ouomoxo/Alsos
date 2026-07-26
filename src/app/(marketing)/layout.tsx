import { Footer } from "@/components/layout/Footer";
import { SiteHeader } from "@/components/layout/SiteHeader";

/**
 * Marketing shell. Visual intensity 9/10 (§1) — this is the brand theatre.
 * The product shell under /dashboard is deliberately much quieter.
 */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main id="main">{children}</main>
      <Footer />
    </>
  );
}
