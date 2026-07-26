import { buildTreeGeometry } from "@/lib/growth/growth-visualization";
import type { GrowthSnapshot } from "@/lib/growth/growth-model";

import styles from "./ProfileTree.module.css";

type Props = {
  snapshot: GrowthSnapshot;
  /** Rendered size in px. The geometry scales to fit. */
  size?: number;
  /** Accessible description. Pass null when a caption already covers it. */
  label?: string | null;
  className?: string;
};

/**
 * The learner's tree, drawn as SVG.
 *
 * SVG rather than canvas because this appears on profiles and dashboards where
 * it must survive 200% zoom, print, and screen readers (§15) — and because at
 * these vertex counts there is nothing to gain from the GPU.
 */
export function ProfileTree({ snapshot, size = 240, label, className }: Props) {
  const geometry = buildTreeGeometry(snapshot);

  // Fit the geometry with a margin, flipping y so the tree grows upward.
  const pad = 8;
  const minX = geometry.bounds.minX - pad;
  const maxX = geometry.bounds.maxX + pad;
  const minY = geometry.bounds.minY - pad;
  const maxY = geometry.bounds.maxY + pad;
  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);

  const a11y =
    label === null
      ? ({ "aria-hidden": true } as const)
      : ({ role: "img", "aria-label": label ?? `${snapshot.stage} 단계 성장 나무` } as const);

  return (
    <svg
      className={`${styles.tree} ${className ?? ""}`}
      width={size}
      height={size}
      viewBox={`${minX} ${-maxY} ${width} ${height}`}
      {...a11y}
    >
      <g className={styles.roots}>
        {geometry.roots.map((r, i) => (
          <line key={`root-${i}`} x1={r.x0} y1={-r.y0} x2={r.x1} y2={-r.y1} strokeWidth={r.width} />
        ))}
      </g>

      {/* Growth rings at the base — one per five completed labs. */}
      <g className={styles.rings}>
        {Array.from({ length: geometry.rings }, (_, i) => (
          <ellipse key={`ring-${i}`} cx={0} cy={0} rx={(i + 1) * 2.4} ry={(i + 1) * 0.9} />
        ))}
      </g>

      <g className={styles.branches}>
        {geometry.branches.map((b, i) => (
          <line
            key={`branch-${i}`}
            x1={b.x0}
            y1={-b.y0}
            x2={b.x1}
            y2={-b.y1}
            strokeWidth={b.width}
            data-domain={b.domain ?? undefined}
          />
        ))}
      </g>

      <g className={styles.leaves}>
        {geometry.leaves.map((l, i) => (
          <circle key={`leaf-${i}`} cx={l.x} cy={-l.y} r={l.r} data-domain={l.domain ?? undefined} />
        ))}
      </g>
    </svg>
  );
}
