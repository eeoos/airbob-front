import {
  buildMarkerPriceSvg,
  getMarkerIconModel,
  getMarkerPriceText,
} from "./markerIcon";

describe("marker icon helpers", () => {
  it("formats KRW marker prices with the won symbol", () => {
    expect(getMarkerPriceText({ basePrice: 123456, currency: "KRW" })).toBe(
      "₩123,456"
    );
  });

  it("formats non-KRW marker prices with the currency code", () => {
    expect(getMarkerPriceText({ basePrice: 250, currency: "USD" })).toBe(
      "USD 250"
    );
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
                fill: #ffffff;
                stroke: #dddddd;
                stroke-width: 1;
              }`);
    expect(defaultSvg).toContain(`.price-text {
                fill: #222222;`);
    expect(selectedSvg).toContain("₩123,456");
    expect(selectedSvg).toContain(`.price-bubble {
                fill: #222222;
                stroke: #222222;
                stroke-width: 2;
              }`);
    expect(selectedSvg).toContain(`.price-text {
                fill: #ffffff;`);
  });
});
