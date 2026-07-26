"use client";

import dynamic from "next/dynamic";

/**
 * Client boundary that keeps the WebGL scene out of the initial bundle.
 *
 * `ssr: false` cannot be used from a Server Component, so this thin wrapper
 * exists purely to own that call. The loading state is deliberately `null`:
 * §11.2 forbids a preloader, and the poster underneath is already the finished
 * hero, so there is nothing to spin over.
 */
const HeroScene = dynamic(() => import("./HeroScene.client"), {
  ssr: false,
  loading: () => null,
});

export function HeroSceneMount() {
  return <HeroScene />;
}
