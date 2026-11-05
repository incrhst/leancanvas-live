"use client";

// Hero backdrop: looking straight up between towers at an opening of sky,
// with canvas notes drifting through it. Everything converges on the
// vanishing point, so the headline placed there is where the eye lands.
// Fog sits in layers above the towers and moves at different rates with the
// pointer and scroll, so the street feels deep.

import { useEffect, useId, useRef, useState, type CSSProperties, type RefObject } from "react";
import { motion, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform, type MotionValue } from "framer-motion";

const W = 1440;
const H = 900;
const VX = W / 2;
const VY = H / 2;
// The sky opening's radii. Notes, sun and fog are placed for this size and
// stretch with a sky of another shape.
const SKY = { rx: 530, ry: 345 };
const FAR = 2200;
const FLOOR_STEP = 1.17;

const C = {
  night: "#0F3A33",
  litFace: "#17493F",
  darkFace: "#0B2925",
  edge: "#34B585",
  window: "#3FC08F",
  sky: "#9FE0C2",
  skyLight: "#C6EFD9",
  sun: "#EAF6CB",
  cloud: "#F1FBF5",
  balloon: "#C8352D",
};

type Pt = [number, number];
type WindowStyle = "grid" | "bands" | "lit";

const r1 = (n: number) => Math.round(n * 10) / 10;
const polar = (deg: number, r: number): Pt => {
  const t = (deg * Math.PI) / 180;
  return [r1(VX + r * Math.cos(t)), r1(VY + r * Math.sin(t))];
};
// Scale a point away from the vanishing point: same vertical edge, higher floor.
const lift = ([x, y]: Pt, s: number): Pt => [r1(VX + (x - VX) * s), r1(VY + (y - VY) * s)];
const dist = ([x, y]: Pt) => Math.hypot(x - VX, y - VY);
const pts = (list: Pt[]) => list.map((p) => p.join(",")).join(" ");
type Sky = typeof SKY;
const skyRadius = (deg: number, { rx, ry }: Sky) => {
  const t = (deg * Math.PI) / 180;
  return (rx * ry) / Math.hypot(ry * Math.cos(t), rx * Math.sin(t));
};

// Each tower: angular span (degrees, clockwise from 3 o'clock), how far its
// roof sits from the sky's edge, where its nearest corner falls, and its windows.
const TOWERS: { from: number; to: number; reach: number; corner: number; style: WindowStyle; edge?: boolean }[] = [
  { from: -9, to: 13, reach: 1.02, corner: 0.4, style: "bands" },
  { from: 14.5, to: 37, reach: 1.08, corner: 0.55, style: "grid", edge: true },
  { from: 39, to: 58, reach: 0.99, corner: 0.35, style: "lit" },
  { from: 59.5, to: 82, reach: 1.06, corner: 0.6, style: "grid" },
  { from: 84, to: 103, reach: 1.0, corner: 0.45, style: "bands", edge: true },
  { from: 104.5, to: 127, reach: 1.1, corner: 0.5, style: "grid" },
  { from: 129, to: 149, reach: 1.01, corner: 0.6, style: "lit", edge: true },
  { from: 150.5, to: 172, reach: 1.07, corner: 0.4, style: "grid" },
  { from: 174, to: 197, reach: 0.98, corner: 0.55, style: "bands" },
  { from: 198.5, to: 219, reach: 1.05, corner: 0.45, style: "lit" },
  { from: 221, to: 241, reach: 1.0, corner: 0.6, style: "grid", edge: true },
  { from: 242.5, to: 262, reach: 1.09, corner: 0.4, style: "bands" },
  { from: 264, to: 284, reach: 1.01, corner: 0.5, style: "grid" },
  { from: 285.5, to: 307, reach: 1.06, corner: 0.55, style: "lit", edge: true },
  { from: 309, to: 330, reach: 0.99, corner: 0.4, style: "grid" },
  { from: 331.5, to: 349.5, reach: 1.04, corner: 0.6, style: "bands" },
];

// The notes that float in the sky, offset from the vanishing point.
const NOTES = [
  { x: -455, y: -150, size: 46, rot: -12, fill: "rgb(var(--note-yellow))", delay: 0 },
  { x: -470, y: 115, size: 36, rot: 9, fill: "rgb(var(--note-pink))", delay: 1.6 },
  { x: -300, y: -265, size: 28, rot: 18, fill: "rgb(var(--note-green))", delay: 3.1 },
  { x: 440, y: -170, size: 40, rot: 14, fill: "rgb(var(--note-blue))", delay: 0.8 },
  { x: 470, y: 110, size: 44, rot: -7, fill: "rgb(var(--note-green))", delay: 2.4 },
  { x: 300, y: 270, size: 26, rot: -16, fill: "rgb(var(--note-yellow))", delay: 3.8 },
  { x: -290, y: 275, size: 30, rot: 6, fill: "rgb(var(--note-blue))", delay: 1.1 },
];

function floorsFor(top: [Pt, Pt]) {
  const floors: number[] = [];
  const nearest = Math.min(dist(top[0]), dist(top[1]));
  for (let s = FLOOR_STEP; nearest * s < FAR; s *= FLOOR_STEP) floors.push(s);
  return floors;
}

function Face({ top, fill, style, seed }: { top: [Pt, Pt]; fill: string; style: WindowStyle; seed: number }) {
  const [a, b] = top;
  const far = FAR / Math.min(dist(a), dist(b));
  const floors = floorsFor(top);
  const cols = 4;
  const colTops: Pt[] = Array.from({ length: cols + 1 }, (_, j) => [
    r1(a[0] + ((b[0] - a[0]) * j) / cols),
    r1(a[1] + ((b[1] - a[1]) * j) / cols),
  ]);

  return (
    <g>
      <polygon points={pts([a, b, lift(b, far), lift(a, far)])} fill={fill} />
      {style !== "lit" &&
        floors.map((s, k) => (
          <line
            key={`f${k}`}
            x1={lift(a, s)[0]}
            y1={lift(a, s)[1]}
            x2={lift(b, s)[0]}
            y2={lift(b, s)[1]}
            stroke={C.window}
            strokeOpacity={style === "bands" ? 0.55 : 0.3}
            strokeWidth={style === "bands" ? 3 : 1.5}
          />
        ))}
      {style === "grid" &&
        colTops.slice(1, -1).map((p, j) => (
          <line
            key={`c${j}`}
            x1={p[0]}
            y1={p[1]}
            x2={lift(p, far)[0]}
            y2={lift(p, far)[1]}
            stroke={C.window}
            strokeOpacity={0.3}
            strokeWidth={1.5}
          />
        ))}
      {style === "lit" &&
        floors.slice(0, -1).flatMap((s, k) =>
          colTops.slice(0, -1).map((p, j) => {
            const q = colTops[j + 1];
            const s2 = floors[k + 1];
            // Inset each pane so lit windows read as separate diamonds of light.
            const mid = (lo: number, hi: number) => lo + (hi - lo) * 0.18;
            const sA = mid(s, s2);
            const sB = mid(s2, s);
            const pA: Pt = [r1(p[0] + (q[0] - p[0]) * 0.18), r1(p[1] + (q[1] - p[1]) * 0.18)];
            const pB: Pt = [r1(q[0] + (p[0] - q[0]) * 0.18), r1(q[1] + (p[1] - q[1]) * 0.18)];
            const on = (k * 7 + j * 13 + seed * 5) % 5 !== 0;
            return (
              <polygon
                key={`w${k}-${j}`}
                points={pts([lift(pA, sA), lift(pB, sA), lift(pB, sB), lift(pA, sB)])}
                fill={on ? C.window : C.night}
                fillOpacity={on ? 0.55 : 0.6}
              />
            );
          }),
        )}
    </g>
  );
}

function Tower({ from, to, reach, corner, style, edge, index, sky }: (typeof TOWERS)[number] & { index: number; sky: Sky }) {
  const mid = from + (to - from) * corner;
  const rFrom = skyRadius(from, sky) * reach;
  const rTo = skyRadius(to, sky) * reach;
  // The corner nearest the sky pokes inwards, which is what makes it read as a box.
  const rMid = Math.min(rFrom, rTo) * 0.94;
  const pFrom = polar(from, rFrom);
  const pMid = polar(mid, rMid);
  const pTo = polar(to, rTo);
  const lightFirst = index % 2 === 0;

  return (
    <g>
      <Face top={[pFrom, pMid]} fill={lightFirst ? C.litFace : C.darkFace} style={style} seed={index} />
      <Face top={[pMid, pTo]} fill={lightFirst ? C.darkFace : C.litFace} style={style} seed={index + 3} />
      {edge && (
        <polygon
          points={pts([polar(mid - 0.7, rMid), polar(mid + 0.7, rMid), polar(mid + 0.7, FAR + 200), polar(mid - 0.7, FAR + 200)])}
          fill={C.edge}
        />
      )}
    </g>
  );
}

const skyPath = (sky: Sky) => {
  const steps = 48;
  const ring = Array.from({ length: steps }, (_, i) => {
    const deg = (360 * i) / steps;
    const wobble = 1.08 + 0.05 * Math.sin(i * 1.7) + 0.03 * Math.cos(i * 3.1);
    return polar(deg, skyRadius(deg, sky) * wobble);
  });
  return `M${ring.map((p) => p.join(",")).join("L")}Z`;
};

// Things that happen in the sky. Each crosses on its own cycle, and the cycles
// don't divide into each other, so the sky never looks like it's on a loop.
// Positions are offsets for the default sky (stretched like the notes); the towers
// are drawn over all of it, so things appear and vanish between the rooftops.
const CLOUDS = [
  { y: -230, scale: 1.3, duration: 95, delay: 10 },
  { y: -60, scale: 0.9, duration: 70, delay: 48 },
  { y: 120, scale: 1.1, duration: 120, delay: 85 },
  { y: 250, scale: 0.7, duration: 64, delay: 22 },
];

// The sky's shapes, also used as small accents further down the page (SkyAccent).
export function Cloud({ scale = 1, fill = C.cloud }: { scale?: number; fill?: string }) {
  return (
    <g transform={`scale(${scale})`}>
      <rect x={-70} y={-6} width={140} height={26} rx={13} fill={fill} />
      <circle cx={-32} cy={-6} r={24} fill={fill} />
      <circle cx={6} cy={-18} r={32} fill={fill} />
      <circle cx={42} cy={-2} r={20} fill={fill} />
    </g>
  );
}

export const FLOCK = [
  [0, 0, 1],
  [-26, 14, 0.8],
  [-18, -16, 0.85],
  [-48, 4, 0.7],
  [-44, 28, 0.6],
] as const;

export function Bird({ x, y, scale, delay, wingClass }: { x: number; y: number; scale: number; delay: number; wingClass: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <path
        className={wingClass}
        style={{ animationDelay: `-${delay}s` }}
        d="M-12,0 Q-6,-8 0,0 Q6,-8 12,0"
        fill="none"
        stroke={C.darkFace}
        strokeWidth={2.5}
        strokeLinecap="round"
      />
    </g>
  );
}

/** A note folded into a paper plane, nose pointing right. */
export function PaperPlane() {
  return (
    <g>
      <path d="M-16,-6 L18,0 L-16,8 L-8,1 Z" fill="rgb(var(--note-yellow))" />
      <path d="M-8,1 L18,0 L-12,12 Z" fill="rgb(var(--note-yellow-edge))" />
    </g>
  );
}

/** A balloon centred on its middle, string trailing down to y=50. */
export function Balloon() {
  return (
    <g>
      <path d="M0,16 Q-4,26 2,34 Q6,42 0,50" fill="none" stroke={C.darkFace} strokeWidth={1.5} opacity={0.6} />
      <ellipse cx={0} cy={0} rx={13} ry={16} fill={C.balloon} />
      <path d="M-3,15 L3,15 L0,19 Z" fill={C.balloon} />
    </g>
  );
}

function SkyLife({ sky, at }: { sky: Sky; at: (dx: number, dy: number) => Pt }) {
  // How far things travel to cross the opening edge to edge, hidden behind towers at both ends.
  const span = sky.rx * 1.35;
  const lift = sky.ry * 1.35;
  const vars = (v: Record<string, string>) => v as CSSProperties;

  return (
    <g>
      {CLOUDS.map((c, i) => (
        <g key={i} transform={`translate(${at(0, c.y).join(" ")})`}>
          <g
            className="lookup-cloud"
            style={vars({ "--span": `${span}px`, animationDuration: `${c.duration}s`, animationDelay: `-${c.delay}s` })}
          >
            <Cloud scale={c.scale} />
          </g>
        </g>
      ))}

      {/* A flock, flying up and across */}
      <g transform={`translate(${at(0, 60).join(" ")})`}>
        <g className="lookup-once lookup-flock" style={vars({ "--span": `${span}px`, "--lift": `${sky.ry * 0.5}px` })}>
          {FLOCK.map(([x, y, k], i) => (
            <Bird key={i} x={x} y={y} scale={k} delay={i * 0.13} wingClass="lookup-wing" />
          ))}
        </g>
      </g>

      {/* A plane high up, dragging a contrail */}
      <g transform={`translate(${at(0, -170).join(" ")}) rotate(-8)`}>
        <g className="lookup-once lookup-plane" style={vars({ "--span": `${span}px` })}>
          <rect x={-210} y={-1.5} width={200} height={3} rx={1.5} fill={C.cloud} opacity={0.8} />
          <path d="M-8,0 L14,-2 L18,0 L14,2 Z M2,-1 L-4,-10 L0,-10 L8,-1 Z M2,1 L-4,10 L0,10 L8,1 Z" fill={C.darkFace} />
        </g>
      </g>

      {/* A note folded into a paper plane, swooping the other way */}
      <g transform={`translate(${at(0, 30).join(" ")})`}>
        <g className="lookup-once lookup-paper" style={vars({ "--span": `${span}px`, "--lift": `${sky.ry * 0.35}px` })}>
          <g transform="scale(-1 1)">
            <PaperPlane />
          </g>
        </g>
      </g>

      {/* A balloon someone let go of, drifting up through the gap */}
      <g transform={`translate(${at(-140, 0).join(" ")})`}>
        <g className="lookup-once lookup-balloon" style={vars({ "--lift": `${lift}px` })}>
          <Balloon />
        </g>
      </g>
    </g>
  );
}

// Each fog layer: how strongly it follows the pointer and scroll (nearer is
// stronger), how fast it drifts on its own, and its puffs as offsets from the
// vanishing point. Near fog hugs the rooftops; far fog hangs in the sky.
const FOG = [
  {
    depth: 0.25,
    drift: 70,
    opacity: 0.35,
    blur: 30,
    puffs: [[-260, -40, 230, 60], [240, 60, 260, 55], [20, -200, 200, 45], [-60, 210, 240, 50]],
  },
  {
    depth: 0.6,
    drift: 50,
    opacity: 0.4,
    blur: 24,
    puffs: [[-520, -230, 260, 70], [520, -250, 240, 65], [-560, 250, 280, 75], [540, 270, 250, 70], [0, -380, 300, 60], [-20, 390, 320, 60]],
  },
  {
    depth: 1,
    drift: 36,
    opacity: 0.5,
    blur: 18,
    puffs: [[-700, -60, 220, 120], [700, 40, 230, 130], [-360, -440, 300, 80], [380, 450, 320, 85], [-400, 430, 260, 70], [420, -430, 260, 70]],
  },
];

function FogLayer({
  layer,
  index,
  px,
  py,
  rise,
  box,
  at,
  uid,
}: {
  layer: (typeof FOG)[number];
  index: number;
  px: MotionValue<number>;
  py: MotionValue<number>;
  rise: MotionValue<number>;
  box: string;
  at: (dx: number, dy: number) => Pt;
  uid: string;
}) {
  const x = useTransform(px, (v) => v * 40 * layer.depth);
  const y = useTransform(py, (v) => v * 28 * layer.depth);
  // Looking up while scrolling down feels like rising: near fog rushes outwards.
  const scale = useTransform(rise, (v) => 1 + v * 0.45 * layer.depth);
  const opacity = useTransform(rise, (v) => layer.opacity * (1 - v * 0.6));

  return (
    <motion.svg
      viewBox={box}
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 h-full w-full pointer-events-none"
      style={{ x, y, scale, opacity }}
      aria-hidden="true"
    >
      <defs>
        <filter id={`${uid}-fog-${index}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation={layer.blur} />
        </filter>
      </defs>
      <g
        className="lookup-fog"
        style={{ animationDuration: `${layer.drift}s`, animationDelay: `-${index * 11}s` }}
        filter={`url(#${uid}-fog-${index})`}
      >
        {layer.puffs.map(([dx, dy, rx, ry], i) => (
          <ellipse key={i} cx={at(dx, dy)[0]} cy={at(dx, dy)[1]} rx={rx} ry={ry} fill={C.skyLight} />
        ))}
      </g>
    </motion.svg>
  );
}

// zoom > 1 pulls back so the sky opening takes less of a tall box; aspect is the
// box's width over height, and sky reshapes the opening (tall for phones).
// track is the element whose scroll drives the fog and whose visibility keeps
// it drawing; pass the hero when the skyline is pinned and never moves itself.
export function LookUpSkyline({
  className,
  zoom = 1,
  aspect = W / H,
  sky = SKY,
  track,
}: {
  className?: string;
  zoom?: number;
  aspect?: number;
  sky?: Sky;
  track?: RefObject<HTMLElement | null>;
}) {
  const uid = useId().replace(/:/g, "");
  const boxW = W * zoom;
  const boxH = boxW / aspect;
  const box = `${r1(VX - boxW / 2)} ${r1(VY - boxH / 2)} ${r1(boxW)} ${r1(boxH)}`;
  // Place something given as an offset for the default sky into this sky.
  const at = (dx: number, dy: number): Pt => [r1(VX + (dx * sky.rx) / SKY.rx), r1(VY + (dy * sky.ry) / SKY.ry)];
  const sun = at(255, -205);
  const ref = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const px = useSpring(pointerX, { stiffness: 40, damping: 18 });
  const py = useSpring(pointerY, { stiffness: 40, damping: 18 });
  const target = track ?? ref;
  const { scrollYProgress } = useScroll({ target, offset: ["start start", "end start"] });
  // Start drawn: the hero is on screen at load, and the observer can be slow to say so.
  const [inView, setInView] = useState(true);
  useEffect(() => {
    const el = target.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, [target]);
  const rise = useSpring(scrollYProgress, { stiffness: 80, damping: 24 });
  const towersScale = useTransform(rise, (v) => 1 + v * 0.08);
  const still = useMotionValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    const onMove = (e: PointerEvent) => {
      // -1..1 from the centre of the window; fog leans the opposite way.
      pointerX.set(-((e.clientX / window.innerWidth) * 2 - 1));
      pointerY.set(-((e.clientY / window.innerHeight) * 2 - 1));
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, [reduceMotion, pointerX, pointerY]);

  return (
    <div ref={ref} className={className} style={{ visibility: inView ? "visible" : "hidden" }} aria-hidden="true">
      <motion.svg
        viewBox={box}
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 h-full w-full"
        style={reduceMotion ? undefined : { scale: towersScale }}
      >
        <style>{`
          @keyframes lookup-drift {
            0%, 100% { transform: translateY(0) rotate(0deg); }
            50% { transform: translateY(-14px) rotate(4deg); }
          }
          @keyframes lookup-fog-drift {
            0%, 100% { transform: translateX(-40px); }
            50% { transform: translateX(40px); }
          }
          @keyframes lookup-cross {
            from { transform: translateX(calc(var(--span) * -1)); }
            to { transform: translateX(var(--span)); }
          }
          @keyframes lookup-flock {
            0% { transform: translate(calc(var(--span) * -1), var(--lift)); }
            40%, 100% { transform: translate(var(--span), calc(var(--lift) * -1)); }
          }
          @keyframes lookup-plane {
            0% { transform: translateX(calc(var(--span) * -1)); }
            55%, 100% { transform: translateX(var(--span)); }
          }
          @keyframes lookup-paper {
            0% { transform: translate(var(--span), 0) rotate(0deg); }
            15% { transform: translate(calc(var(--span) * 0.4), calc(var(--lift) * -1)) rotate(-14deg); }
            30% { transform: translate(calc(var(--span) * -0.2), calc(var(--lift) * 0.4)) rotate(10deg); }
            50%, 100% { transform: translate(calc(var(--span) * -1), calc(var(--lift) * -0.6)) rotate(-6deg); }
          }
          @keyframes lookup-balloon {
            0% { transform: translate(0, var(--lift)); }
            25% { transform: translate(24px, calc(var(--lift) * 0.4)); }
            50% { transform: translate(-12px, calc(var(--lift) * -0.3)); }
            70%, 100% { transform: translate(18px, calc(var(--lift) * -1)); }
          }
          @keyframes lookup-flap {
            0%, 100% { transform: scaleY(1); }
            50% { transform: scaleY(-0.5); }
          }
          .lookup-cloud { animation: lookup-cross linear infinite; }
          .lookup-once { animation-timing-function: ease-in-out; animation-iteration-count: infinite; }
          .lookup-flock { animation-name: lookup-flock; animation-duration: 29s; animation-delay: -4s; animation-timing-function: linear; }
          .lookup-plane { animation-name: lookup-plane; animation-duration: 43s; animation-delay: -30s; animation-timing-function: linear; }
          .lookup-paper { animation-name: lookup-paper; animation-duration: 37s; animation-delay: -12s; }
          .lookup-balloon { animation-name: lookup-balloon; animation-duration: 53s; animation-delay: -40s; }
          .lookup-wing { transform-box: fill-box; transform-origin: center; animation: lookup-flap 0.6s ease-in-out infinite; }
          .lookup-note { transform-box: fill-box; transform-origin: center; animation: lookup-drift 9s ease-in-out infinite; }
          .lookup-fog { animation: lookup-fog-drift 50s ease-in-out infinite; }
          @media (prefers-reduced-motion: reduce) {
            .lookup-note, .lookup-fog, .lookup-cloud, .lookup-wing { animation: none; }
            .lookup-once { display: none; }
          }
        `}</style>

        <rect x={-W} y={-H} width={W * 3} height={H * 3} fill={C.night} />
        <path d={skyPath(sky)} fill={C.sky} />
        <ellipse cx={at(-120, 40)[0]} cy={at(-120, 40)[1]} rx={300} ry={150} fill={C.skyLight} opacity={0.55} />

        <circle cx={sun[0]} cy={sun[1]} r={62} fill={C.sun} />
        {[88, 116, 146].map((r, i) => (
          <circle key={r} cx={sun[0]} cy={sun[1]} r={r} fill="none" stroke={C.sun} strokeWidth={2} opacity={0.7 - i * 0.2} />
        ))}

        <SkyLife sky={sky} at={at} />

        {NOTES.map((n, i) => (
          <g key={i} transform={`translate(${at(n.x, n.y).join(" ")}) rotate(${n.rot})`}>
            <g className="lookup-note" style={{ animationDelay: `-${n.delay}s` }}>
              <rect x={-n.size / 2} y={-n.size / 2} width={n.size} height={n.size} rx={3} fill={n.fill} />
              <line x1={-n.size * 0.3} y1={-n.size * 0.12} x2={n.size * 0.3} y2={-n.size * 0.12} stroke={C.darkFace} strokeOpacity={0.25} strokeWidth={2} />
              <line x1={-n.size * 0.3} y1={n.size * 0.08} x2={n.size * 0.12} y2={n.size * 0.08} stroke={C.darkFace} strokeOpacity={0.25} strokeWidth={2} />
            </g>
          </g>
        ))}

        {TOWERS.map((t, i) => (
          <Tower key={i} {...t} index={i} sky={sky} />
        ))}
      </motion.svg>

      {FOG.map((layer, i) => (
        <FogLayer key={i} layer={layer} index={i} px={px} py={py} rise={reduceMotion ? still : rise} box={box} at={at} uid={uid} />
      ))}
    </div>
  );
}
