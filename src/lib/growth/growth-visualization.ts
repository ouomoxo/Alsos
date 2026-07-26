import { DOMAINS, type DomainId } from "@/lib/content/curriculum";
import { clamp01, lerp, makeRng } from "@/lib/rng";

import { stageIndex, type GrowthSnapshot } from "./growth-model";

/**
 * Turns a growth snapshot into drawable geometry.
 *
 * Two properties matter more than anything aesthetic here:
 *
 *   1. Determinism. The same snapshot must always produce the same tree (§8.5).
 *      Every random draw comes from `visualSeed`, and nothing reads the clock.
 *   2. Structure, not scale. Stages differ in root count, branch direction,
 *      leaf density and ring count — a learner who specialises in forensics
 *      grows a visibly different tree from one who specialises in web (§7).
 */

export type TreeBranch = {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  width: number;
  level: number;
  /** Which domain drove this branch, when one did. */
  domain: DomainId | null;
};

export type TreeLeaf = { x: number; y: number; r: number; domain: DomainId | null };

export type TreeGeometry = {
  branches: TreeBranch[];
  roots: TreeBranch[];
  leaves: TreeLeaf[];
  /** Concentric rings at the trunk base — one per XP milestone reached. */
  rings: number;
  /** Overall extent, for viewBox fitting. */
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
};

/** Each domain owns a fixed direction, so a profile is readable at a glance. */
const DOMAIN_ANGLES: Record<DomainId, number> = {
  foundations: 0,
  "web-security": -0.85,
  "network-security": 0.85,
  cryptography: -0.42,
  "reverse-engineering": 0.42,
  "digital-forensics": 1.15,
  "cloud-security": -1.15,
};

export function buildTreeGeometry(snapshot: GrowthSnapshot): TreeGeometry {
  const rng = makeRng(snapshot.visualSeed);
  const stage = stageIndex(snapshot.stage);
  const maturity = stage / 5;

  const branches: TreeBranch[] = [];
  const roots: TreeBranch[] = [];
  const leaves: TreeLeaf[] = [];
  const bounds = { minX: 0, maxX: 0, minY: 0, maxY: 0 };

  const track = (x: number, y: number) => {
    bounds.minX = Math.min(bounds.minX, x);
    bounds.maxX = Math.max(bounds.maxX, x);
    bounds.minY = Math.min(bounds.minY, y);
    bounds.maxY = Math.max(bounds.maxY, y);
  };

  /* ------------------------------------------------------------- roots --- */

  // Root spread is the Foundations track made visible: without groundwork the
  // tree is literally unstable.
  const foundations = clamp01(snapshot.domainProgress.foundations ?? 0);
  const rootCount = Math.max(2, Math.round(lerp(2, 9, foundations)));
  const rootLength = lerp(6, 26, foundations) * lerp(0.7, 1.2, maturity);

  for (let i = 0; i < rootCount; i++) {
    const spreadT = rootCount === 1 ? 0.5 : i / (rootCount - 1);
    const angle = lerp(Math.PI * 0.68, Math.PI * 1.32, spreadT) + (rng() - 0.5) * 0.18;
    const length = rootLength * lerp(0.7, 1.15, rng());
    const x1 = Math.sin(angle) * length;
    const y1 = Math.cos(angle) * length;
    roots.push({ x0: 0, y0: 0, x1, y1, width: lerp(0.7, 2.2, foundations), level: 0, domain: "foundations" });
    track(x1, y1);
  }

  /* ------------------------------------------------------------- trunk --- */

  // Trunk height reads total XP; the log keeps a 40k-XP learner from being ten
  // times taller than a 4k-XP one.
  const trunkHeight = lerp(10, 78, clamp01(Math.log10(snapshot.totalXp + 1) / Math.log10(60000)));
  const trunkWidth = lerp(1.4, 7, maturity);
  branches.push({ x0: 0, y0: 0, x1: 0, y1: trunkHeight, width: trunkWidth, level: 0, domain: null });
  track(0, trunkHeight);

  /* ---------------------------------------------------------- branches --- */

  // One primary limb per domain the learner has actually touched. Direction is
  // fixed per domain; length and subdivision follow progress.
  const active = DOMAINS.map((d) => ({
    id: d.id,
    progress: clamp01(snapshot.domainProgress[d.id] ?? 0),
  })).filter((d) => d.id !== "foundations" && d.progress > 0.02);

  const forkStart = trunkHeight * 0.42;

  for (const domain of active) {
    const baseAngle = DOMAIN_ANGLES[domain.id];
    const attach = lerp(forkStart, trunkHeight * 0.96, rng() * 0.65 + domain.progress * 0.35);
    growLimb(0, attach, baseAngle, trunkHeight * lerp(0.22, 0.62, domain.progress), trunkWidth * 0.55, 1, domain.id, domain.progress);
  }

  function growLimb(
    x: number,
    y: number,
    angle: number,
    length: number,
    width: number,
    level: number,
    domain: DomainId,
    progress: number,
  ) {
    const x1 = x + Math.sin(angle) * length;
    const y1 = y + Math.cos(angle) * length;
    branches.push({ x0: x, y0: y, x1, y1, width, level, domain });
    track(x1, y1);

    // Subdivision depth is capped by progress: an untouched domain is a stub,
    // a mastered one branches three deep.
    const maxLevel = 1 + Math.round(progress * 3);
    if (level >= maxLevel || length < 4) {
      const leafCount = Math.round(lerp(1, 7, progress) * lerp(0.6, 1.4, maturity));
      for (let i = 0; i < leafCount; i++) {
        const spread = length * 0.5;
        leaves.push({
          x: x1 + (rng() - 0.5) * spread,
          y: y1 + (rng() - 0.5) * spread * 0.8,
          r: lerp(0.7, 1.7, rng()),
          domain,
        });
      }
      return;
    }

    const forks = 2;
    for (let i = 0; i < forks; i++) {
      const offset = (i === 0 ? -1 : 1) * lerp(0.25, 0.6, rng());
      growLimb(x1, y1, angle + offset, length * lerp(0.58, 0.74, rng()), width * 0.62, level + 1, domain, progress);
    }
  }

  /* ------------------------------------------------------------- rings --- */

  // One ring per completed lab batch — the "every lesson leaves a ring" line
  // has to be literally true somewhere in the product.
  const rings = Math.min(9, Math.floor(snapshot.completedLabIds.length / 5));

  return { branches, roots, leaves, rings, bounds };
}
