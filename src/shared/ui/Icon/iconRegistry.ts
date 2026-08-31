import type { IconGlyph } from "./Icon";

type GlyphMap = Readonly<Record<string, IconGlyph>>;

export const defineIconRegistry = <Glyphs extends GlyphMap>(
  glyphs: Glyphs,
  fallback: IconGlyph,
) => {
  const has = (name: string): name is Extract<keyof Glyphs, string> =>
    Object.prototype.hasOwnProperty.call(glyphs, name);

  return {
    fallback,
    glyphs,
    has,
    resolve: (name: string): IconGlyph => {
      if (!has(name)) return fallback;

      return glyphs[name] ?? fallback;
    },
  };
};
