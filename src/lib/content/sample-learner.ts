import type { NodeState } from "@/components/roadmap/AccessibleRoadmapList";
import type { DomainId } from "@/lib/content/curriculum";
import type { GrowthSnapshot } from "@/lib/growth/growth-model";

/**
 * A demonstration learner.
 *
 * The product screens need *some* state to show shape and hierarchy. This is
 * clearly-labelled sample data living in one file, never presented as platform
 * statistics (§3.2) and never mixed into marketing copy. When the API exists,
 * these two exports are what the loaders replace — nothing else changes.
 */
export const SAMPLE_LEARNER = {
  username: "alsos",
  displayName: "샘플 학습자",
  joinedAt: "2025-11-04T00:00:00.000Z",
  isSample: true,
} as const;

export const SAMPLE_SNAPSHOT: GrowthSnapshot = {
  totalXp: 8420,
  stage: "sapling",
  // Server-issued, deliberately unrelated to any account id (§8.5).
  visualSeed: "vs_7c1e93a4f2",
  domainProgress: {
    foundations: 1,
    "web-security": 0.62,
    "network-security": 0.34,
    cryptography: 0.18,
  },
  completedLabIds: Array.from({ length: 23 }, (_, i) => `lab-${i + 1}`),
  unlockedGardenItemIds: ["moss-plate", "vine-arch", "ring-stone"],
  titleIds: ["first-root", "web-initiate"],
  updatedAt: "2026-07-20T09:30:00.000Z",
};

export const SAMPLE_ROADMAP_STATE: Partial<Record<DomainId, NodeState>> = {
  foundations: "mastered",
  "web-security": "in-progress",
  "network-security": "in-progress",
  cryptography: "available",
  "reverse-engineering": "locked",
  "digital-forensics": "locked",
  "cloud-security": "locked",
};

export const SAMPLE_CONTINUE = {
  domain: "web-security",
  labId: "session-fixation",
  labNumber: 14,
  title: "세션 고정 공격",
  step: 3,
  totalSteps: 4,
} as const;
