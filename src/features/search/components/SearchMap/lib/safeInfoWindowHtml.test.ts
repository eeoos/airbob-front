import { escapeInfoWindowHtml } from "./safeInfoWindowHtml";

describe("safe info-window HTML", () => {
  it("escapes every HTML text and attribute delimiter", () => {
    expect(escapeInfoWindowHtml(`<tag a="b">O'Hare & Mapo</tag>`)).toBe(
      "&lt;tag a=&quot;b&quot;&gt;O&#39;Hare &amp; Mapo&lt;/tag&gt;",
    );
  });
});
