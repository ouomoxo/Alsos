import { DOMAINS, type DomainId } from "@/lib/content/curriculum";

import styles from "./RootMap.module.css";

/**
 * The learning paths drawn as a root network.
 *
 * Purely decorative and `aria-hidden` — §7 Section 03 and §8.2 both require the
 * navigable roadmap to exist as a real DOM list, so this diagram never carries
 * information that is not also in `AccessibleRoadmapList`. A canvas-only
 * roadmap is listed under §20's outright prohibitions.
 */

const VIEW = { width: 1000, height: 560 };

/** Deterministic layout: tier decides depth, order decides horizontal spread. */
function layout() {
  const byTier = new Map<number, DomainId[]>();
  for (const domain of DOMAINS) {
    const list = byTier.get(domain.tier) ?? [];
    list.push(domain.id);
    byTier.set(domain.tier, list);
  }

  const positions = new Map<DomainId, { x: number; y: number }>();
  for (const [tier, ids] of byTier) {
    // Roots descend: tier 1 sits at the surface, tier 3 deepest.
    const y = 70 + (tier - 1) * 200;
    ids.forEach((id, index) => {
      const spread = (index + 1) / (ids.length + 1);
      // Deeper tiers fan wider, as roots do.
      const inset = 0.5 - (0.5 - spread) * (0.45 + tier * 0.2);
      positions.set(id, { x: inset * VIEW.width, y });
    });
  }
  return positions;
}

export function RootMap() {
  const positions = layout();

  return (
    <svg
      className={styles.map}
      viewBox={`0 0 ${VIEW.width} ${VIEW.height}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      <g className={styles.links}>
        {DOMAINS.flatMap((domain) =>
          domain.requires.map((requirement) => {
            const from = positions.get(requirement);
            const to = positions.get(domain.id);
            if (!from || !to) return null;
            // A vertical-tangent cubic reads as a root splitting, where a
            // straight line would read as a flowchart edge.
            const midY = (from.y + to.y) / 2;
            return (
              <path
                key={`${requirement}-${domain.id}`}
                d={`M${from.x} ${from.y} C ${from.x} ${midY}, ${to.x} ${midY}, ${to.x} ${to.y}`}
              />
            );
          }),
        )}
      </g>

      <g className={styles.nodes}>
        {DOMAINS.map((domain) => {
          const position = positions.get(domain.id);
          if (!position) return null;
          return (
            <g key={domain.id} transform={`translate(${position.x} ${position.y})`}>
              {/* 4px node in the dot grammar: an important junction (§2.3). */}
              <rect x={-4} y={-4} width={8} height={8} />
              <text className={styles.nodeLabel} x={0} y={26} textAnchor="middle">
                {domain.name}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
