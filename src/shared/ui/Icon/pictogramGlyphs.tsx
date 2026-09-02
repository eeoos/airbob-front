import type { ReactNode } from "react";
import type { IconGlyph } from "./Icon";

const strokeGlyph = (children: ReactNode): IconGlyph => ({
  children: (
    <g strokeLinecap="round" strokeLinejoin="round">
      {children}
    </g>
  ),
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
});

const alertCircle = strokeGlyph(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v6M12 17h.01" />
  </>,
);

/**
 * Domain-neutral 24px outline pictograms. Product owners map their own codes
 * to these glyphs instead of teaching the shared UI layer domain taxonomy.
 */
export const pictogramGlyphs = {
  alertCircle,
  feature: strokeGlyph(
    <>
      <path d="m12 3 1.3 3.7L17 8l-3.7 1.3L12 13l-1.3-3.7L7 8l3.7-1.3L12 3Z" />
      <path d="m18.5 13 .8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z" />
      <path d="m5.5 13 .7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8Z" />
    </>,
  ),
  wifi: strokeGlyph(
    <>
      <path d="M4.9 10.8a10.5 10.5 0 0 1 14.2 0" />
      <path d="M8 14a6 6 0 0 1 8 0" />
      <path d="M10.8 17.2a1.8 1.8 0 0 1 2.4 0" />
      <circle cx="12" cy="19" r=".6" fill="currentColor" stroke="none" />
    </>,
  ),
  airConditioner: strokeGlyph(
    <>
      <rect x="3" y="5" width="18" height="9" rx="2" />
      <path d="M7 10h10M8 17c0 1-1 1-1 2M12 17v3M16 17c0 1 1 1 1 2" />
    </>,
  ),
  heating: strokeGlyph(
    <>
      <path d="M14 14.8V6a3 3 0 0 0-6 0v8.8a5 5 0 1 0 6 0Z" />
      <path d="M11 7v10M17.5 7.5c1 1 1 2 0 3M20 6c1.8 2 1.8 4 0 6" />
    </>,
  ),
  kitchen: strokeGlyph(
    <>
      <path d="M5 10h14v8a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-8ZM8 10V8h8v2M3 12h2M19 12h2" />
      <path d="M10 5h4" />
    </>,
  ),
  washer: strokeGlyph(
    <>
      <rect x="4" y="2.5" width="16" height="19" rx="2" />
      <path d="M4 7h16" />
      <circle cx="12" cy="14" r="5" />
      <path d="M8.5 14c1.5-1.4 2.6 1.2 5 0 1-.5 1.5-1.1 2-1.7" />
    </>,
  ),
  dryer: strokeGlyph(
    <>
      <rect x="4" y="2.5" width="16" height="19" rx="2" />
      <path d="M4 7h16" />
      <circle cx="12" cy="14" r="5" />
      <path d="M9.5 16c-1-1-.8-2 .2-3s1.2-2 .2-3M13.5 17c-1-1-.8-2 .2-3s1.2-2 .2-3" />
    </>,
  ),
  parking: strokeGlyph(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M10 17V7h3.3a3.2 3.2 0 0 1 0 6.4H10M10 13.4h3.2" />
    </>,
  ),
  television: strokeGlyph(
    <>
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="m8 2 4 4 4-4M8 22h8" />
    </>,
  ),
  pool: strokeGlyph(
    <>
      <path d="M5 12V5a2 2 0 0 1 4 0M5 8h5M17 12V5a2 2 0 0 1 4 0M17 8h4" />
      <path d="M3 14c1.5 0 1.5 1 3 1s1.5-1 3-1 1.5 1 3 1 1.5-1 3-1 1.5 1 3 1 1.5-1 3-1M3 18c1.5 0 1.5 1 3 1s1.5-1 3-1 1.5 1 3 1 1.5-1 3-1 1.5 1 3 1 1.5-1 3-1" />
    </>,
  ),
  gym: strokeGlyph(
    <>
      <path d="M6 8v8M3.5 10v4M18 8v8M20.5 10v4M6 12h12" />
    </>,
  ),
  hairDryer: strokeGlyph(
    <>
      <path d="M4 7h9a4 4 0 0 1 0 8H9l-5 3V7Z" />
      <path d="m10 15 2 6h4l-2-6M17 9l4-2M17 12h4M17 15l4 2" />
    </>,
  ),
  iron: strokeGlyph(
    <>
      <path d="M4 18h16l-2.5-7.5H9A5 5 0 0 0 4 15v3Z" />
      <path d="M9 10.5V7h5a3 3 0 0 1 3 3v.5M4 18v2h16" />
    </>,
  ),
  shampoo: strokeGlyph(
    <>
      <path d="M9 7h7M11 7V4h5l2 2M8 10h9a2 2 0 0 1 2 2v8H6v-8a2 2 0 0 1 2-2Z" />
      <path d="M10 14h5" />
    </>,
  ),
  bedLinens: strokeGlyph(
    <>
      <path d="M3 19v-9h18v9M3 15h18M7 10V7h5a3 3 0 0 1 3 3M3 19v2M21 19v2" />
    </>,
  ),
  extraPillows: strokeGlyph(
    <>
      <rect x="4" y="7" width="13" height="10" rx="3" />
      <rect x="8" y="4" width="12" height="10" rx="3" />
      <path d="M7 10c1 1 1 3 0 4M17 7c-1 1-1 3 0 4" />
    </>,
  ),
  crib: strokeGlyph(
    <>
      <path d="M4 5v15M20 5v15M4 8h16v9H4M8 8v9M12 8v9M16 8v9M3 20h3M18 20h3" />
    </>,
  ),
  highChair: strokeGlyph(
    <>
      <path d="M8 4h8v8H8zM6 12h12M9 12 7 21M15 12l2 9M8 17h8" />
    </>,
  ),
  dishwasher: strokeGlyph(
    <>
      <rect x="4" y="2.5" width="16" height="19" rx="2" />
      <path d="M4 7h16M8 11h8M9 17c1-3 2-3 3 0s2 3 3 0" />
    </>,
  ),
  coffeeMachine: strokeGlyph(
    <>
      <path d="M5 5h12v15H5zM8 8h6M8 12h6M7 20h12" />
      <path d="M17 9h1a3 3 0 0 1 0 6h-1M9 2v3M13 2v3" />
    </>,
  ),
  microwave: strokeGlyph(
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M7 9h8v6H7zM18 9h.01M18 12h.01M18 15h.01" />
      <path d="M9 12c.8-1 1.4-1 2.2 0s1.4 1 2.2 0" />
    </>,
  ),
  refrigerator: strokeGlyph(
    <>
      <rect x="6" y="2.5" width="12" height="19" rx="2" />
      <path d="M6 9h12M9 6v1M9 12v3" />
    </>,
  ),
  elevator: strokeGlyph(
    <>
      <rect x="5" y="4" width="14" height="17" rx="1" />
      <path d="M12 4v17M9 2l-2 2M9 2l2 2M15 2l-2 2M15 2l2 2" />
      <path d="m8 10 2-2 2 2M16 15l-2 2-2-2" />
    </>,
  ),
  hotTub: strokeGlyph(
    <>
      <path d="M4 11h16v5a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4v-5ZM2 11h20M7 20v2M17 20v2" />
      <path d="M8 8c-1-1-1-2 0-3s1-2 0-3M12 8c-1-1-1-2 0-3s1-2 0-3M16 8c-1-1-1-2 0-3s1-2 0-3" />
    </>,
  ),
  smokeAlarm: strokeGlyph(
    <>
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="1.5" />
      <path d="M8.5 8.5h7M8.5 15.5h7M4.5 8.5c-1.3 2.2-1.3 4.8 0 7M19.5 8.5c1.3 2.2 1.3 4.8 0 7" />
    </>,
  ),
  carbonMonoxideAlarm: strokeGlyph(
    <>
      <rect x="4" y="4" width="16" height="16" rx="4" />
      <path d="M10 9H8.5a3 3 0 0 0 0 6H10M15.5 9a3 3 0 1 0 0 6 3 3 0 1 0 0-6ZM8 18h8" />
    </>,
  ),
  fireExtinguisher: strokeGlyph(
    <>
      <path d="M9 8h6a2 2 0 0 1 2 2v10H7V10a2 2 0 0 1 2-2ZM10 8V5h4v3M9 5h7l3 2M17 11h2v5" />
      <path d="M10 13h4" />
    </>,
  ),
  pet: strokeGlyph(
    <>
      <circle cx="6.5" cy="8" r="2" />
      <circle cx="11" cy="5.5" r="2" />
      <circle cx="15.5" cy="6" r="2" />
      <circle cx="18.5" cy="9.5" r="2" />
      <path d="M12 10c-3.5 0-6 2.7-6 5.5 0 2.1 1.7 3.5 3.7 3.5.9 0 1.5-.5 2.3-.5s1.4.5 2.3.5c2 0 3.7-1.4 3.7-3.5 0-2.8-2.5-5.5-6-5.5Z" />
    </>,
  ),
  stackedLayers: strokeGlyph(
    <>
      <circle cx="18" cy="6" r="2" />
      <path d="M5 21V10M3 10h8L7 3 3 10ZM7 21v-4M13 21v-7M11 14h8l-4-7-4 7ZM15 21v-3" />
    </>,
  ),
  barbecueGrill: strokeGlyph(
    <>
      <path d="M4 10h16a8 8 0 0 1-16 0ZM8 17l-2 5M16 17l2 5M7 20h10" />
      <path d="M8 7c-1-1-1-2 0-3M12 7c-1-1-1-2 0-3M16 7c-1-1-1-2 0-3" />
    </>,
  ),
  balcony: strokeGlyph(
    <>
      <path d="M5 3h14v8H5zM3 11h18M4 15h16M5 11v10M10 11v10M14 11v10M19 11v10M3 21h18" />
    </>,
  ),
} as const satisfies Readonly<Record<string, IconGlyph>>;
