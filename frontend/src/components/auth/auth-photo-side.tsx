import Link from "next/link";
import type { CSSProperties } from "react";

import { LogoMark } from "@/components/brand/logo";
import { messages } from "@/messages";


/** The sloping roof plane as four corners (lower left, lower right, upper right, upper left); the panels sit on a grid inside it. */
const ROOF = [
  { x: 112, y: 188 },
  { x: 372, y: 188 },
  { x: 440, y: 104 },
  { x: 180, y: 104 },
] as const;
const COLUMNS = 5;
const ROWS = 2;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** A point on the roof plane at u across (0 to 1) and v up the slope (0 to 1). */
const onRoof = (u: number, v: number) => {
  const bottom = { x: lerp(ROOF[0].x, ROOF[1].x, u), y: lerp(ROOF[0].y, ROOF[1].y, u) };
  const top = { x: lerp(ROOF[3].x, ROOF[2].x, u), y: lerp(ROOF[3].y, ROOF[2].y, u) };
  return { x: +lerp(bottom.x, top.x, v).toFixed(1), y: +lerp(bottom.y, top.y, v).toFixed(1) };
};

const PANELS = Array.from({ length: COLUMNS * ROWS }, (_, index) => {
  const column = index % COLUMNS;
  const row = Math.floor(index / COLUMNS);
  const gap = 0.035;
  const u0 = column / COLUMNS + gap;
  const u1 = (column + 1) / COLUMNS - gap;
  const v0 = row / ROWS + gap * 1.6;
  const v1 = (row + 1) / ROWS - gap * 1.6;
  const corners = [onRoof(u0, v0), onRoof(u1, v0), onRoof(u1, v1), onRoof(u0, v1)];
  return { index, points: corners.map((corner) => `${corner.x},${corner.y}`).join(" ") };
});

/** How many of the house's ten roof panels are filled on the sign-up page; the rest stay dashed outlines to finish. */
const HOUSE_FILLED = 6;

const draw = (delay: number): CSSProperties => ({ "--delay": `${delay}s` }) as CSSProperties;

/** Twelve rays around the top of the bulb, each from the glass outward, that appear once it switches on. */
const BULB_RAYS = Array.from({ length: 13 }, (_, index) => {
  const angle = ((200 + (140 / 12) * index) * Math.PI) / 180;
  const long = index % 2 === 0;
  return { index, x1: +(240 + 104 * Math.cos(angle)).toFixed(1), y1: +(130 + 104 * Math.sin(angle)).toFixed(1), x2: +(240 + (long ? 142 : 128) * Math.cos(angle)).toFixed(1), y2: +(130 + (long ? 142 : 128) * Math.sin(angle)).toFixed(1) };
});

/** The sign-in drawing: a light bulb drawn in line art with a small sun for its filament; it draws itself, then switches on with a warm orange glow and rays. */
function BulbDrawing() {
  return (
    <svg aria-hidden viewBox="0 0 480 330" className="w-full overflow-visible text-ink" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <defs>
        <radialGradient id="auth-bulb-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--ds-orange)" stopOpacity="0.55" />
          <stop offset="55%" stopColor="var(--ds-orange)" stopOpacity="0.18" />
          <stop offset="100%" stopColor="var(--ds-orange)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="240" cy="130" r="170" fill="url(#auth-bulb-glow)" className="bulb-glow" />
      <g stroke="var(--ds-orange)" strokeWidth="3">
        {BULB_RAYS.map((ray) => (
          <line key={ray.index} x1={ray.x1} y1={ray.y1} x2={ray.x2} y2={ray.y2} className="panel-in" style={draw(2.3 + ray.index * 0.07)} />
        ))}
      </g>
      <g stroke="currentColor" strokeWidth="3" strokeOpacity="0.85">
        <path pathLength={1} d="M205 224 C205 196 158 180 158 130 A82 82 0 0 1 322 130 C322 180 275 196 275 224" className="line-draw" style={draw(0)} />
        <path pathLength={1} d="M205 224 H275" className="line-draw" style={draw(0.5)} />
        <path pathLength={1} d="M210 242 H270 M214 260 H266 M222 278 H258" className="line-draw" style={draw(0.7)} />
        <path pathLength={1} d="M226 224 C226 194 232 172 238 152 M254 224 C254 194 248 172 242 152" className="line-draw" style={draw(1)} />
      </g>
      <g className="panel-in" style={draw(1.8)} stroke="var(--ds-orange)" strokeWidth="3">
        <circle cx="240" cy="130" r="17" fill="var(--ds-orange)" />
        {Array.from({ length: 8 }, (_, ray) => {
          const angle = (ray * 45 * Math.PI) / 180;
          return <line key={ray} x1={240 + 25 * Math.cos(angle)} y1={130 + 25 * Math.sin(angle)} x2={240 + 36 * Math.cos(angle)} y2={130 + 36 * Math.sin(angle)} />;
        })}
      </g>
    </svg>
  );
}

/** The sign-up drawing: a house with a sloping roof whose ten panels are only partly filled, so the plan looks ready to finish. */
function HouseDrawing() {
  return (
        <svg aria-hidden viewBox="0 0 480 330" className="w-full overflow-visible text-ink" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <g className="sun-rise" stroke="var(--ds-orange)" strokeWidth="3">
        <circle cx="400" cy="52" r="20" fill="var(--ds-orange)" fillOpacity="0.25" />
        {Array.from({ length: 8 }, (_, ray) => {
          const angle = (ray * 45 * Math.PI) / 180;
          return <line key={ray} x1={400 + 30 * Math.cos(angle)} y1={52 + 30 * Math.sin(angle)} x2={400 + 40 * Math.cos(angle)} y2={52 + 40 * Math.sin(angle)} />;
        })}
      </g>
      <g stroke="currentColor" strokeWidth="3" strokeOpacity="0.85">
        <path pathLength={1} d="M40 300 H440" className="line-draw" style={draw(0)} />
        <path pathLength={1} d="M126 300 V188 H358 V300" className="line-draw" style={draw(0.2)} />
        <polygon pathLength={1} points={ROOF.map((corner) => `${corner.x},${corner.y}`).join(" ")} className="line-draw" style={draw(0.5)} />
        <path pathLength={1} d="M226 300 V236 H268 V300" className="line-draw" style={draw(0.9)} />
        <rect pathLength={1} x="146" y="216" width="52" height="44" rx="4" className="line-draw" style={draw(1.1)} />
        <rect pathLength={1} x="296" y="216" width="46" height="44" rx="4" className="line-draw" style={draw(1.25)} />
      </g>
      <g stroke="var(--ds-orange)" strokeWidth="2.5">
        {PANELS.map((panel) =>
          panel.index < HOUSE_FILLED ? (
            <polygon key={panel.index} points={panel.points} fill="var(--ds-orange)" className="panel-in" style={draw(1.8 + panel.index * 0.16)} />
          ) : (
            <polygon key={panel.index} points={panel.points} strokeDasharray="5 6" strokeOpacity="0.7" className="panel-in" style={draw(1.8 + panel.index * 0.16)} />
          ),
        )}
      </g>
    </svg>
  );
}

/** The photo side of sign-in and sign-up: on a warm wall that follows the theme, a line drawing (a light bulb with a sun filament that switches on for sign-in, a house for sign-up) draws itself, then its solar panels fill in one by one under a rising sun, and a small figure counts the system size; the logo sits above and one sentence for the page below. */
export function AuthPhotoSide({ photo, quote }: { photo: "signIn" | "signUp"; quote: string }) {
  return (
    <div className="relative hidden overflow-hidden bg-gradient-to-b from-paper-2 via-paper-2 to-orange-tint lg:order-1 lg:flex lg:flex-col lg:items-center lg:justify-between lg:gap-8 lg:px-12 lg:py-12" data-auth-photo>
      <div aria-hidden className="pointer-events-none absolute top-[12%] left-1/2 aspect-square w-[80%] -translate-x-1/2 rounded-full bg-orange/15 blur-3xl" />
      <Link href="/" className="relative z-10 inline-flex items-center gap-3 self-start text-ink" aria-label={messages.app.name} data-auth-brand>
        <LogoMark size={44} />
        <span className="font-heading text-2xl font-semibold tracking-tight">{messages.app.name}</span>
      </Link>
      <div className="relative z-10 flex w-[min(100%,34rem,92svh)] flex-col items-center gap-6" data-auth-house>
        {photo === "signIn" ? <BulbDrawing /> : <HouseDrawing />}
      </div>
      <p className="footer-lede relative z-10 max-w-md text-center">{quote}</p>
    </div>
  );
}
