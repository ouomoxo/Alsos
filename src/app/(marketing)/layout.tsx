import { SiteHeader } from "@/components/navigation/SiteHeader";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main id="main">{children}</main>
    </>
  );
}
