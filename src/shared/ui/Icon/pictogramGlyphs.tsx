import type { ReactNode } from "react";
import type { IconGlyph } from "./Icon";

const strokeGlyph = (children: ReactNode): IconGlyph => ({
  children,
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
});

const fillGlyph = (children: ReactNode): IconGlyph => ({
  children,
  fill: "currentColor",
  stroke: "none",
});

const alertCircle = strokeGlyph(
  <>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6M12 16h.01" />
  </>
);

/**
 * Domain-neutral SVG glyphs. Product owners map their own codes to these
 * pictograms instead of teaching the shared UI layer about domain taxonomy.
 */
export const pictogramGlyphs = {
  alertCircle,
  wifi: strokeGlyph(
    <>
      <path d="M5 12.55a11 11 0 0 1 14.08 0" />
      <path d="M1.42 9a16 16 0 0 1 21.16 0" />
      <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
      <line x1="12" y1="20" x2="12.01" y2="20" />
    </>
  ),
  airConditioner: strokeGlyph(
    <>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M6 8h12" />
      <path d="M6 12h12" />
      <path d="M6 16h12" />
    </>
  ),
  heating: fillGlyph(
    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  ),
  kitchen: strokeGlyph(
    <path d="M6 2v20M6 2h12M6 6h12M6 10h12M6 14h12" />
  ),
  washer: strokeGlyph(
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  dryer: strokeGlyph(
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M8 12h8" />
    </>
  ),
  parking: fillGlyph(
    <>
      <path d="M9 2h6v20H9z" />
      <path d="M9 2v6h6V2" />
    </>
  ),
  television: strokeGlyph(
    <>
      <rect x="2" y="7" width="20" height="15" rx="2" />
      <path d="M17 2l-5 5-5-5" />
    </>
  ),
  pool: strokeGlyph(
    <>
      <path d="M2 12c0 5.523 4.477 10 10 10s10-4.477 10-10S17.523 2 12 2 2 6.477 2 12z" />
      <path d="M2 12h20" />
      <path d="M12 2v20" />
    </>
  ),
  gym: strokeGlyph(
    <>
      <path d="M6.5 6.5h11v11h-11z" />
      <path d="M6.5 6.5l5.5 5.5M12 12l5.5 5.5" />
    </>
  ),
  hairDryer: strokeGlyph(
    <>
      <path d="M18 12h-8M10 8h6M10 16h6" />
      <circle cx="6" cy="12" r="2" />
    </>
  ),
  iron: strokeGlyph(
    <>
      <path d="M3 12h18M3 6h18M3 18h18" />
      <path d="M6 3v18" />
    </>
  ),
  shampoo: strokeGlyph(
    <path d="M12 2v20M12 2c-2 0-4 2-4 4v2c0 2 2 4 4 4s4-2 4-4V6c0-2-2-4-4-4z" />
  ),
  bedLinens: strokeGlyph(
    <>
      <rect x="3" y="7" width="18" height="12" rx="2" />
      <path d="M3 11h18M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
    </>
  ),
  extraPillows: strokeGlyph(
    <>
      <rect x="3" y="7" width="18" height="12" rx="2" />
      <path d="M3 11h18" />
    </>
  ),
  crib: strokeGlyph(
    <>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M3 10h18M9 6v12M15 6v12" />
    </>
  ),
  highChair: strokeGlyph(
    <>
      <path d="M6 4h12v16H6z" />
      <path d="M6 8h12M6 12h12" />
    </>
  ),
  dishwasher: strokeGlyph(
    <>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  coffeeMachine: strokeGlyph(
    <>
      <path d="M18 8h1a4 4 0 0 1 0 8h-1M2 8h16v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8z" />
      <line x1="6" y1="1" x2="6" y2="4" />
      <line x1="10" y1="1" x2="10" y2="4" />
      <line x1="14" y1="1" x2="14" y2="4" />
    </>
  ),
  microwave: strokeGlyph(
    <>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M6 8h12M6 12h8" />
    </>
  ),
  refrigerator: strokeGlyph(
    <>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M12 4v16" />
    </>
  ),
  elevator: strokeGlyph(
    <>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M8 8h8M8 12h8M8 16h8" />
    </>
  ),
  hotTub: strokeGlyph(
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4" />
    </>
  ),
  fireExtinguisher: strokeGlyph(
    <path d="M12 2v4M12 6c-2 0-4 2-4 4v8c0 2 2 4 4 4s4-2 4-4v-8c0-2-2-4-4-4z" />
  ),
  pet: strokeGlyph(
    <>
      <path d="M12 2c-2.5 0-4.5 2-4.5 4.5 0 1.5 1 2.5 2 3.5v8c0 1.5 1.5 3 3.5 3s3.5-1.5 3.5-3v-8c1-1 2-2 2-3.5C18.5 4 16.5 2 14 2h-2z" />
      <circle cx="9" cy="6.5" r="1" />
      <circle cx="15" cy="6.5" r="1" />
    </>
  ),
  stackedLayers: strokeGlyph(
    <>
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
    </>
  ),
  barbecueGrill: strokeGlyph(
    <>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <path d="M6 10h12M6 14h12" />
    </>
  ),
  balcony: strokeGlyph(
    <>
      <rect x="2" y="8" width="20" height="14" rx="2" />
      <path d="M2 12h20" />
    </>
  ),
} as const satisfies Readonly<Record<string, IconGlyph>>;
