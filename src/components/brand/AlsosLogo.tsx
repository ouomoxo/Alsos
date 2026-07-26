import type { SVGProps } from "react";

/**
 * The ALSOS mark.
 *
 * Not a tree glued to a shield (§5.1 rules that out explicitly). The symbol is
 * an alpha built as a lapidary staircase — the Greek letterform — with three
 * things folded into it: a solid 2x2 terminal-cursor block anchoring the right
 * foot, a solid crossbar, and two detached modules escaping past the apex.
 * Those two modules are the seed and the single growing branch: the letter is
 * already sprouting out of its own structure.
 *
 * Everything sits on a 12x12 module grid at integer coordinates.
 */

const SYMBOL_MODULES: ReadonlyArray<readonly [number, number]> = [
  // Left leg, climbing.
  [2, 9], [2, 10], [3, 7], [3, 8], [4, 5], [4, 6], [5, 3], [5, 4],
  // Right leg, descending.
  [6, 3], [6, 4], [7, 5], [7, 6], [8, 7], [8, 8], [9, 9], [9, 10],
  // Apex.
  [5, 2], [6, 2],
  // Crossbar.
  [4, 7], [5, 7], [6, 7], [7, 7],
  // Left foot.
  [1, 11], [2, 11],
  // Right foot as a terminal cursor block.
  [9, 11], [10, 11], [10, 10],
];

/** The seed and the branch that has left the letter. Animated on hover. */
const GROWTH_MODULES: ReadonlyArray<readonly [number, number]> = [
  [8, 1],
  [9, 0],
];

/**
 * Custom lettering on a 5x7 module grid — deliberately drawn, not typed. The O
 * carries a seed module at its centre and the A repeats the symbol's flat apex
 * and solid crossbar, so wordmark and symbol are visibly the same alphabet.
 */
const GLYPHS: Record<string, readonly string[]> = {
  A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  L: ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
  S: [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
  O: [".###.", "#...#", "#...#", "#.#.#", "#...#", "#...#", ".###."],
};

const WORD = "ALSOS";
const GLYPH_W = 5;
const GLYPH_H = 7;
const GLYPH_GAP = 2;

type LogoProps = {
  variant?: "symbol" | "horizontal";
  /** Rendered as the accessible name; pass null when the logo is decorative. */
  title?: string | null;
} & Omit<SVGProps<SVGSVGElement>, "title">;

export function AlsosLogo({ variant = "horizontal", title = "ALSOS", ...props }: LogoProps) {
  const a11y =
    title === null
      ? ({ "aria-hidden": true, focusable: false } as const)
      : ({ role: "img", "aria-label": title } as const);

  if (variant === "symbol") {
    return (
      <svg viewBox="0 0 12 12" width="24" height="24" fill="currentColor" {...a11y} {...props}>
        <Modules modules={SYMBOL_MODULES} />
        <g opacity={0.75}>
          <Modules modules={GROWTH_MODULES} />
        </g>
      </svg>
    );
  }

  const wordWidth = WORD.length * GLYPH_W + (WORD.length - 1) * GLYPH_GAP;
  const symbolSpan = 12;
  const gapToWord = 4;
  const totalW = symbolSpan + gapToWord + wordWidth;

  return (
    <svg
      viewBox={`0 0 ${totalW} 12`}
      width={totalW * 2}
      height={24}
      fill="currentColor"
      shapeRendering="crispEdges"
      {...a11y}
      {...props}
    >
      <Modules modules={SYMBOL_MODULES} />
      <g opacity={0.75}>
        <Modules modules={GROWTH_MODULES} />
      </g>
      {/* Wordmark is vertically centred on the 12-unit symbol box. */}
      <g transform={`translate(${symbolSpan + gapToWord}, ${(12 - GLYPH_H) / 2})`}>
        {WORD.split("").map((char, i) => (
          <g key={`${char}-${i}`} transform={`translate(${i * (GLYPH_W + GLYPH_GAP)}, 0)`}>
            <Glyph rows={GLYPHS[char] ?? []} />
          </g>
        ))}
      </g>
    </svg>
  );
}

function Modules({ modules }: { modules: ReadonlyArray<readonly [number, number]> }) {
  return (
    <>
      {modules.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} />
      ))}
    </>
  );
}

function Glyph({ rows }: { rows: readonly string[] }) {
  const rects: React.ReactElement[] = [];
  rows.forEach((row, y) => {
    // Merge horizontal runs so the SVG stays small and edges stay crisp.
    let runStart = -1;
    for (let x = 0; x <= row.length; x++) {
      const on = row[x] === "#";
      if (on && runStart === -1) runStart = x;
      if (!on && runStart !== -1) {
        rects.push(
          <rect key={`${y}-${runStart}`} x={runStart} y={y} width={x - runStart} height={1} />,
        );
        runStart = -1;
      }
    }
  });
  return <>{rects}</>;
}
