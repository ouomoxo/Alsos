import { GROWTH_STAGES, type DomainId, type GrowthStage } from "@/lib/content/curriculum";

/**
 * The learner's growth state.
 *
 * `visualSeed` is a server-issued identifier, never the user id (§8.5) — the
 * tree is public on a profile, so seeding it from the account id would leak
 * that id into rendered geometry. XP and unlock decisions are likewise the
 * server's: everything here only *describes* state it was handed (§17).
 */
export type GrowthSnapshot = {
  totalXp: number;
  stage: GrowthStage;
  visualSeed: string;
  domainProgress: Partial<Record<DomainId, number>>;
  completedLabIds: string[];
  unlockedGardenItemIds: string[];
  titleIds: string[];
  /** ISO timestamp of the last activity that changed this snapshot. */
  updatedAt: string;
};

export function stageForXp(totalXp: number): GrowthStage {
  let current: GrowthStage = "seed";
  for (const stage of GROWTH_STAGES) {
    if (totalXp >= stage.minXp) current = stage.id;
  }
  return current;
}

export function stageIndex(stage: GrowthStage): number {
  return GROWTH_STAGES.findIndex((s) => s.id === stage);
}

/** Progress toward the next stage, 0..1. Returns 1 at the final stage. */
export function stageProgress(totalXp: number): number {
  const index = stageIndex(stageForXp(totalXp));
  const next = GROWTH_STAGES[index + 1];
  if (!next) return 1;
  const current = GROWTH_STAGES[index]!;
  const span = next.minXp - current.minXp;
  if (span <= 0) return 1;
  return Math.min(1, Math.max(0, (totalXp - current.minXp) / span));
}

export function nextStageXp(totalXp: number): number | null {
  const index = stageIndex(stageForXp(totalXp));
  return GROWTH_STAGES[index + 1]?.minXp ?? null;
}

/**
 * A snapshot for a given stage, used by marketing to illustrate progression.
 * Explicitly synthetic and never presented as a real learner (§3.2).
 */
export function exampleSnapshot(stage: GrowthStage): GrowthSnapshot {
  const spec = GROWTH_STAGES[stageIndex(stage)]!;
  const next = GROWTH_STAGES[stageIndex(stage) + 1];
  const xp = next ? Math.round((spec.minXp + next.minXp) / 2) : spec.minXp * 1.4;

  // Domain spread widens with stage: a seed has no specialisation, a grove has
  // all of it. This is what makes the illustrations structurally different
  // rather than the same tree at six sizes (§7 Section 05).
  const depth = stageIndex(stage) / (GROWTH_STAGES.length - 1);
  return {
    totalXp: Math.round(xp),
    stage,
    visualSeed: `alsos-example-${stage}`,
    domainProgress: {
      foundations: Math.min(1, 0.25 + depth * 0.85),
      "web-security": Math.max(0, depth * 0.9 - 0.1),
      "network-security": Math.max(0, depth * 0.8 - 0.15),
      cryptography: Math.max(0, depth * 0.7 - 0.3),
      "reverse-engineering": Math.max(0, depth * 0.65 - 0.4),
      "digital-forensics": Math.max(0, depth * 0.6 - 0.45),
      "cloud-security": Math.max(0, depth * 0.55 - 0.5),
    },
    completedLabIds: Array.from({ length: Math.round(depth * 40) }, (_, i) => `example-lab-${i}`),
    unlockedGardenItemIds: [],
    titleIds: [],
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}
