// The 404's bit of sky: a dashed outline where the page should be, fog that
// drifts over it and thins to show there's nothing inside, and the page itself
// folded into a paper plane at the end of a loopy trail, well out of reach.
// Decoration only: hidden from assistive tech, still under reduced motion.
// Animations live in index.css (.lost-*).

import { PaperPlane } from "./LookUpSkyline";

const INK = "#0B2925";
const MIST = "#C6EFD9";
const CLOUD = "#F1FBF5";

// From the top of the empty frame, a loop, and off towards the rooftops.
const TRAIL = "M-40,-42 C-20,-96 40,-92 30,-52 C22,-20 -14,-46 8,-74 C34,-108 96,-96 128,-82";

export function NotFoundSky({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="-150 -130 320 220" className={`lost-sky overflow-visible ${className}`} aria-hidden="true">
      <defs>
        <filter id="lost-fog-blur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation={9} />
        </filter>
      </defs>

      {/* Where the page should be */}
      <g transform="translate(-62 6) rotate(-6)">
        <rect x={-42} y={-52} width={84} height={104} rx={6} fill={MIST} fillOpacity={0.45} stroke={INK} strokeOpacity={0.45} strokeWidth={2} strokeDasharray="7 6" />
        <circle cx={0} cy={-52} r={4} fill={INK} fillOpacity={0.55} />
      </g>

      {/* Its route out */}
      <path className="lost-trail" d={TRAIL} fill="none" stroke={INK} strokeOpacity={0.4} strokeWidth={2} strokeDasharray="2 7" strokeLinecap="round" />

      <g transform="translate(142 -86) rotate(-14)">
        <g className="lost-plane">
          <g transform="scale(1.6)">
            <PaperPlane />
          </g>
        </g>
      </g>

      {/* Fog over the frame: thick, then thin enough to see it's empty, then thick again */}
      <g className="lost-fog-veil">
        <g className="lost-fog" filter="url(#lost-fog-blur)">
          <ellipse cx={-84} cy={-8} rx={56} ry={34} fill={CLOUD} />
          <ellipse cx={-40} cy={22} rx={60} ry={30} fill={MIST} />
          <ellipse cx={-70} cy={48} rx={50} ry={22} fill={CLOUD} />
          <ellipse cx={-56} cy={-40} rx={40} ry={20} fill={MIST} />
        </g>
      </g>
    </svg>
  );
}
