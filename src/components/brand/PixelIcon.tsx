import type { SVGProps } from "react";

/**
 * ALSOS icon set.
 *
 * Drawn here rather than pulled from a library (§5.2): every shape sits on a
 * 16x16 grid at integer coordinates, uses square caps and a 2-unit stroke, and
 * has an optional lit module that switches on in the selected state. A generic
 * icon pack would flatten the whole system back to default SaaS.
 *
 * Geometry is expressed as horizontal/vertical/diagonal runs of modules so the
 * icons stay legible at 16px without hinting.
 */

type IconGeometry = {
  /** Stroke paths, drawn with square caps. */
  paths: readonly string[];
  /** Filled 1x1 modules, always on. */
  dots?: ReadonlyArray<readonly [number, number]>;
  /** Modules that light up only when `selected` — the dot-grammar feedback. */
  lit?: ReadonlyArray<readonly [number, number]>;
};

const ICONS = {
  /** CTA arrow — matches the reference's up-right departure arrow. */
  arrowUpRight: {
    paths: ["M4 12 L12 4", "M5 4 H12 V11"],
  },
  arrowRight: {
    paths: ["M3 8 H12", "M9 5 L12 8 L9 11"],
  },
  arrowDown: {
    paths: ["M8 3 V12", "M5 9 L8 12 L11 9"],
  },
  menu: {
    paths: ["M2 4 H14", "M2 8 H14", "M2 12 H14"],
  },
  close: {
    paths: ["M3 3 L13 13", "M13 3 L3 13"],
  },
  check: {
    paths: ["M3 8 L7 12 L13 4"],
  },
  /** Learning path: a trunk that forks. Roadmap, not a generic map pin. */
  branch: {
    paths: ["M8 14 V7", "M8 9 L4 5", "M8 8 L12 4"],
    dots: [[3, 3], [11, 2]],
    lit: [[7, 5]],
  },
  /** Roots — the roadmap's underground counterpart. */
  roots: {
    paths: ["M8 2 V8", "M8 8 L4 13", "M8 8 L12 13", "M8 8 V14"],
    dots: [[3, 13], [11, 13], [7, 14]],
  },
  /** Lab: a bounded clearing with a cursor inside it, never a flask or skull. */
  clearing: {
    paths: ["M2 3 H6", "M2 3 V13", "M2 13 H6", "M14 3 H10", "M14 3 V13", "M14 13 H10"],
    dots: [[7, 7], [8, 7]],
    lit: [[7, 9], [8, 9]],
  },
  terminal: {
    paths: ["M2 2 H14 V14 H2 Z", "M4 6 L6 8 L4 10"],
    dots: [[8, 9], [9, 9], [10, 9]],
  },
  /** Growth stage / profile tree. */
  tree: {
    paths: ["M8 14 V8", "M8 9 L5 6", "M8 9 L11 6"],
    dots: [[7, 3], [9, 4], [4, 5], [11, 5], [7, 14], [8, 14]],
    lit: [[7, 5], [8, 5]],
  },
  /** Garden: a plot grid with plantings. */
  garden: {
    paths: ["M2 4 H14", "M2 8 H14", "M2 12 H14"],
    dots: [[4, 2], [9, 2], [6, 6], [12, 6], [3, 10], [10, 10]],
  },
  /** Dashboard: a density map, not four rounded rectangles. */
  grid: {
    paths: ["M2 2 H14 V14 H2 Z", "M2 7 H14", "M7 2 V14"],
    lit: [[4, 4], [10, 10]],
  },
  /** Community: connected nodes. */
  nodes: {
    paths: ["M4 4 L12 8", "M12 8 L4 12"],
    dots: [[3, 3], [3, 11], [11, 7]],
    lit: [[11, 7]],
  },
  /** Access state — a boundary with a gap, not a padlock. */
  boundary: {
    paths: ["M3 3 H13 V13 H3 Z"],
    dots: [[7, 2], [8, 2], [7, 13], [8, 13]],
  },
  locked: {
    paths: ["M3 7 H13 V13 H3 Z", "M5 7 V5", "M11 7 V5", "M5 5 H11"],
    dots: [[7, 9], [8, 9]],
  },
  /** XP / spore. */
  spore: {
    paths: [],
    dots: [[7, 3], [10, 6], [4, 6], [7, 7], [11, 10], [3, 10], [7, 12]],
    lit: [[7, 7]],
  },
  ring: {
    paths: ["M5 5 H11 V11 H5 Z", "M3 3 H13 V13 H3 Z"],
    dots: [[7, 7], [8, 7], [7, 8], [8, 8]],
  },
  chevronRight: {
    paths: ["M6 3 L11 8 L6 13"],
  },
  chevronDown: {
    paths: ["M3 6 L8 11 L13 6"],
  },
  external: {
    paths: ["M7 3 H3 V13 H13 V9", "M9 3 H13 V7", "M7 9 L13 3"],
  },
} as const satisfies Record<string, IconGeometry>;

export type PixelIconName = keyof typeof ICONS;

type PixelIconProps = {
  name: PixelIconName;
  /** Lights the icon's accent modules. Pair with text — never colour alone. */
  selected?: boolean;
  size?: number;
  /** Provide when the icon is the only content of a control. */
  label?: string;
} & Omit<SVGProps<SVGSVGElement>, "name">;

export function PixelIcon({ name, selected = false, size = 16, label, ...props }: PixelIconProps) {
  const icon: IconGeometry = ICONS[name];
  const a11y = label
    ? ({ role: "img", "aria-label": label } as const)
    : ({ "aria-hidden": true, focusable: false } as const);

  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="square"
      strokeLinejoin="miter"
      shapeRendering="crispEdges"
      {...a11y}
      {...props}
    >
      {icon.paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
      {icon.dots?.map(([x, y]) => (
        <rect key={`d-${x}-${y}`} x={x} y={y} width={2} height={2} fill="currentColor" stroke="none" />
      ))}
      {icon.lit?.map(([x, y]) => (
        <rect
          key={`l-${x}-${y}`}
          x={x}
          y={y}
          width={2}
          height={2}
          fill="currentColor"
          stroke="none"
          opacity={selected ? 1 : 0}
        />
      ))}
    </svg>
  );
}
