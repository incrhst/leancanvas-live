// Small pieces of the hero's sky, drifting in the margins further down the page.
// Decoration only: hidden from assistive tech, wide screens only, still under
// reduced motion. Animations live in index.css (.sky-accent-*).

import { Balloon, Bird, Cloud, FLOCK, PaperPlane } from "./LookUpSkyline";

type Kind = "cloud" | "flock" | "paper" | "balloon";

// On the light page the hero's near-white cloud disappears, so it takes the sky's mint.
const MINT = "#C6EFD9";

export function SkyAccent({ kind, className = "" }: { kind: Kind; className?: string }) {
  return (
    <svg
      viewBox={VIEW[kind]}
      className={`hidden lg:block pointer-events-none overflow-visible ${className}`}
      aria-hidden="true"
    >
      {kind === "cloud" && (
        <g className="sky-accent-cloud">
          <Cloud scale={0.9} fill={MINT} />
        </g>
      )}
      {kind === "flock" && (
        <g className="sky-accent-flock">
          {FLOCK.map(([x, y, k], i) => (
            <Bird key={i} x={x} y={y} scale={k} delay={i * 0.13} wingClass="sky-accent-wing" />
          ))}
        </g>
      )}
      {kind === "paper" && (
        <g className="sky-accent-paper">
          <g transform="scale(1.4)">
            <PaperPlane />
          </g>
        </g>
      )}
      {kind === "balloon" && (
        <g className="sky-accent-balloon">
          <g transform="scale(1.3)">
            <Balloon />
          </g>
        </g>
      )}
    </svg>
  );
}

const VIEW: Record<Kind, string> = {
  cloud: "-90 -60 180 90",
  flock: "-60 -40 120 80",
  paper: "-30 -20 60 40",
  balloon: "-20 -24 40 92",
};
