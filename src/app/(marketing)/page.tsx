import { Hero } from "@/components/hero/Hero";

/**
 * PR1 — the static hero, and nothing else.
 *
 * The public site's sections (Origin, Learning Method, Growth, Garden,
 * Roadmap, Community, Final CTA) land in a later PR, one at a time, after this
 * frame is signed off against the canonical reference (§26).
 */
export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Read on the server so the flag is part of the rendered tree. Setting it
  // from an inline script before hydration mutates <html> and React reports it
  // as an attribute mismatch.
  const params = await searchParams;
  const visualTest = params.visualTest === "1";

  return <Hero visualTest={visualTest} />;
}
