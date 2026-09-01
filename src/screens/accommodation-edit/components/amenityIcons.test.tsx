import { render, screen } from "@testing-library/react";
import {
  accommodationAmenityCatalog,
  type AccommodationAmenityCode,
} from "../../../features/accommodations/public";
import { accommodationEditAmenityIconRegistry } from "./amenityIconRegistry";
import { AmenityIcon } from "./amenityIcons";

const geometrySignature = (svg: SVGSVGElement): string =>
  // SVG geometry is the behavior under contract, so direct child inspection is intentional.
  // eslint-disable-next-line testing-library/no-node-access
  Array.from(svg.children)
    .map((child) => {
      const attributes = Array.from(child.attributes)
        .map(({ name, value }) => `${name}=${value}`)
        .sort()
        .join(",");

      return `${child.tagName.toLowerCase()}(${attributes})`;
    })
    .join("|");

const editorAmenityGeometry = {
  WIFI: "path(d=M5 12.55a11 11 0 0 1 14.08 0)|path(d=M1.42 9a16 16 0 0 1 21.16 0)|path(d=M8.53 16.11a6 6 0 0 1 6.95 0)|line(x1=12,x2=12.01,y1=20,y2=20)",
  AIR_CONDITIONER:
    "rect(height=18,rx=2,width=18,x=3,y=3)|line(x1=3,x2=21,y1=9,y2=9)|circle(cx=8,cy=6,r=1)|circle(cx=16,cy=6,r=1)",
  HEATING: "circle(cx=12,cy=12,r=10)|path(d=M12 2v4M12 18v4M2 12h4M18 12h4)",
  KITCHEN:
    "rect(height=18,rx=2,width=18,x=3,y=3)|line(x1=3,x2=21,y1=9,y2=9)|line(x1=9,x2=9,y1=3,y2=21)|circle(cx=15,cy=15,r=2)",
  WASHER: "circle(cx=12,cy=12,r=8)|circle(cx=12,cy=12,r=4)",
  DRYER: "rect(height=18,rx=2,width=18,x=3,y=3)|circle(cx=12,cy=12,r=4)",
  PARKING:
    "rect(height=16,rx=2,width=18,x=3,y=4)|path(d=M7 8h10M7 12h10M7 16h6)",
  TV: "rect(height=12,rx=2,width=20,x=2,y=7)|path(d=M17 2l-5 5-5-5)",
  HAIR_DRYER: "path(d=M18 12h-6M12 6v12)|circle(cx=12,cy=12,r=2)",
  IRON: "path(d=M3 12h18M12 3v18)|path(d=M6 6l12 12M18 6L6 18)",
  SHAMPOO: "rect(height=20,rx=2,width=8,x=8,y=2)|path(d=M8 6h8M8 10h8)",
  BED_LINENS: "rect(height=12,rx=2,width=18,x=3,y=8)|path(d=M3 12h18M3 16h18)",
  EXTRA_PILLOWS: "rect(height=12,rx=2,width=16,x=4,y=6)|path(d=M8 10h8M8 14h8)",
  CRIB: "rect(height=12,rx=2,width=18,x=3,y=6)|path(d=M3 12h18)",
  HIGH_CHAIR:
    "rect(height=16,rx=2,width=12,x=6,y=4)|path(d=M6 8h12M6 12h12)|path(d=M9 20v-4M15 20v-4)",
  DISHWASHER:
    "rect(height=16,rx=2,width=18,x=3,y=4)|circle(cx=12,cy=12,r=3)|path(d=M3 8h18M3 16h18)",
  COFFEE_MACHINE:
    "rect(height=16,rx=2,width=16,x=4,y=4)|path(d=M8 8h8M8 12h8)|circle(cx=12,cy=16,r=2)",
  MICROWAVE:
    "rect(height=16,rx=2,width=18,x=3,y=4)|path(d=M3 10h18M3 16h18)|circle(cx=12,cy=13,r=2)",
  REFRIGERATOR:
    "rect(height=20,rx=2,width=16,x=4,y=2)|path(d=M4 8h16M4 14h16)|circle(cx=8,cy=11,r=1)",
  ELEVATOR:
    "rect(height=20,rx=2,width=14,x=5,y=2)|path(d=M5 8h14M5 16h14)|circle(cx=12,cy=12,r=2)",
  POOL: "path(d=M3 12h18M3 16h18M3 8h18)|circle(cx=6,cy=12,r=2)|circle(cx=18,cy=12,r=2)",
  HOT_TUB:
    "circle(cx=12,cy=12,r=10)|circle(cx=12,cy=12,r=6)|circle(cx=12,cy=12,r=2)",
  GYM: "rect(height=18,rx=2,width=18,x=3,y=3)|path(d=M12 3v18M3 12h18)|circle(cx=8,cy=8,r=1)|circle(cx=16,cy=16,r=1)",
  SMOKE_ALARM:
    "circle(cx=12,cy=12,r=10)|circle(cx=12,cy=12,r=6)|path(d=M12 2v4M12 18v4M2 12h4M18 12h4)",
  CARBON_MONOXIDE_ALARM:
    "circle(cx=12,cy=12,r=10)|circle(cx=12,cy=12,r=6)|path(d=M12 2v4M12 18v4M2 12h4M18 12h4)",
  FIRE_EXTINGUISHER:
    "rect(height=18,rx=2,width=8,x=8,y=2)|path(d=M8 6h8M8 10h8)|circle(cx=12,cy=16,r=2)",
  PETS_ALLOWED:
    "circle(cx=9,cy=9,r=3)|circle(cx=15,cy=9,r=3)|path(d=M9 12v6M15 12v6)|path(d=M6 15h12)",
  OUTDOOR_SPACE:
    "path(d=M3 12h18M12 3v18)|circle(cx=6,cy=6,r=2)|circle(cx=18,cy=18,r=2)|circle(cx=18,cy=6,r=2)|circle(cx=6,cy=18,r=2)",
  BBQ_GRILL:
    "rect(height=12,rx=2,width=18,x=3,y=6)|path(d=M3 10h18M3 14h18)|circle(cx=8,cy=12,r=1)|circle(cx=16,cy=12,r=1)",
  BALCONY:
    "rect(height=12,rx=2,width=18,x=3,y=8)|path(d=M3 12h18M3 16h18)|path(d=M6 20v-4M18 20v-4)",
} as const satisfies Record<AccommodationAmenityCode, string>;

const fallbackGeometry =
  "rect(height=18,rx=2,width=18,x=3,y=3)|path(d=M3 9h18M9 3v18)";

describe("accommodation edit AmenityIcon", () => {
  it("maps every amenity option exposed by the editor", () => {
    const optionCodes = accommodationAmenityCatalog.knownAmenities
      .map(({ code }) => code)
      .sort();
    const mappedCodes = Object.keys(
      accommodationEditAmenityIconRegistry.glyphs,
    ).sort();

    expect(mappedCodes).toEqual(optionCodes);
    expect(
      optionCodes.filter(
        (code) => !accommodationEditAmenityIconRegistry.has(code),
      ),
    ).toEqual([]);
  });

  it.each(accommodationAmenityCatalog.knownAmenities)(
    "preserves the pre-refactor $code SVG geometry",
    ({ code }) => {
      const { container } = render(<AmenityIcon type={code} />);
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const icon = container.querySelector("svg");

      expect(icon).not.toBeNull();
      expect(geometrySignature(icon as SVGSVGElement)).toBe(
        editorAmenityGeometry[code],
      );
    },
  );

  it("fills its existing icon frame and remains decorative inside the named option", () => {
    const { container } = render(<AmenityIcon type="WIFI" />);
    // The parent amenity option owns the accessible name.
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    const icon = container.querySelector("svg");

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(icon).toHaveAttribute("aria-hidden", "true");
    expect(icon).toHaveAttribute("fill", "none");
    expect(icon).toHaveAttribute("stroke", "currentColor");
    expect(icon).toHaveAttribute("stroke-width", "1.5");
    expect(icon).toHaveStyle({ width: "100%", height: "100%" });
  });

  it("keeps every editor pictogram stroke-based with an explicit empty fill", () => {
    const { container } = render(<AmenityIcon type="PARKING" />);
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    const icon = container.querySelector("svg");

    expect(icon).toHaveAttribute("fill", "none");
    expect(icon).toHaveAttribute("stroke", "currentColor");
    expect(icon).toHaveAttribute("stroke-width", "1.5");
  });

  it("keeps rendering the shared fallback for unknown amenity values", () => {
    const { container } = render(<AmenityIcon type="UNKNOWN_AMENITY" />);
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    const icon = container.querySelector("svg");

    expect(icon).toHaveAttribute("fill", "none");
    expect(icon).toHaveAttribute("stroke", "currentColor");
    expect(geometrySignature(icon as SVGSVGElement)).toBe(fallbackGeometry);
  });
});
