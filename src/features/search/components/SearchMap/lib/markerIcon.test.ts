import { buildMarkerPriceSvg, getMarkerIconModel } from "./markerIcon";

describe("marker icon helpers", () => {
  it.each([
    [undefined, undefined, "₩123,456"],
    ["2026-09-20", undefined, "₩123,456"],
    ["2026-09-20", "2026-09-21", "₩123,456"],
    ["2026-09-20", "2026-09-23", "₩370,368"],
    ["2026-09-30", "2026-10-02", "₩246,912"],
  ])(
    "prices the searched stay from %s to %s",
    (checkIn, checkOut, expected) => {
      const model = getMarkerIconModel(
        { basePrice: 123456, currency: "KRW" },
        checkIn,
        checkOut,
      );
      expect(model.priceText).toBe(expected);
      for (const state of ["default", "selected", "hovered"] as const) {
        expect(buildMarkerPriceSvg(model, state)).toContain(expected);
      }
    },
  );

  it("sizes long-stay markers for the total price", () => {
    const nightly = getMarkerIconModel({ basePrice: 99000, currency: "KRW" });
    const total = getMarkerIconModel(
      { basePrice: 99000, currency: "KRW" },
      "2026-09-01",
      "2026-09-30",
    );
    expect(total.priceText).toBe("₩2,871,000");
    expect(total.totalWidth).toBeGreaterThan(nightly.totalWidth);
  });

  it("formats KRW marker prices with the won symbol", () => {
    expect(
      getMarkerIconModel({ basePrice: 123456, currency: "KRW" }).priceText,
    ).toBe("₩123,456");
  });

  it("formats non-KRW marker prices with the currency code", () => {
    expect(
      getMarkerIconModel({ basePrice: 250, currency: "USD" }).priceText,
    ).toBe("USD 250");
  });

  it("keeps a minimum bubble width for short price text", () => {
    const model = getMarkerIconModel({ basePrice: 1, currency: "KRW" });

    expect(model.bubbleHeight).toBe(28);
    expect(model.totalWidth).toBe(84);
    expect(model.anchor).toEqual({
      x: 42,
      y: 28,
    });
  });

  it("expands the bubble width for long price text", () => {
    const model = getMarkerIconModel({ basePrice: 123456789, currency: "KRW" });

    expect(model.totalWidth).toBeGreaterThan(84);
  });

  it("builds default and active state SVGs with the same text and dimensions", () => {
    const model = getMarkerIconModel({ basePrice: 123456, currency: "KRW" });
    const defaultSvg = buildMarkerPriceSvg(model, "default");
    const selectedSvg = buildMarkerPriceSvg(model, "selected");

    expect(defaultSvg).toContain(`width="${model.totalWidth}"`);
    expect(defaultSvg).toContain("₩123,456");
    expect(defaultSvg).toContain(`.price-bubble {
                fill: #fff;
                stroke: #ddd;
                stroke-width: 1;
              }`);
    expect(defaultSvg).toContain(`.price-text {
                fill: #222;`);
    expect(selectedSvg).toContain("₩123,456");
    expect(selectedSvg).toContain(`.price-bubble {
                fill: #222;
                stroke: #222;
                stroke-width: 2;
              }`);
    expect(selectedSvg).toContain(`.price-text {
                fill: #fff;`);
  });
});
