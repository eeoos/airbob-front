import { readFileSync } from "fs";
import { join } from "path";

type ManifestIcon = {
  readonly sizes: `${number}x${number}`;
  readonly src: string;
  readonly type: "image/png" | "image/x-icon";
};

type WebAppManifest = {
  readonly background_color: string;
  readonly icons: readonly ManifestIcon[];
  readonly theme_color: string;
};

const publicRoot = join(process.cwd(), "public");
const documentSource = readFileSync(join(process.cwd(), "index.html"), "utf8");
const manifest = JSON.parse(
  readFileSync(join(publicRoot, "manifest.json"), "utf8"),
) as WebAppManifest;

const declaredDimensions = (sizes: ManifestIcon["sizes"]) =>
  sizes.split("x").map(Number) as [number, number];

const pngDimensions = (asset: Buffer): [number, number] => {
  const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  expect(asset.subarray(0, pngSignature.length)).toEqual(pngSignature);

  return [asset.readUInt32BE(16), asset.readUInt32BE(20)];
};

const icoDimensions = (asset: Buffer): [number, number] => {
  expect(asset.readUInt16LE(0)).toBe(0);
  expect(asset.readUInt16LE(2)).toBe(1);
  expect(asset.readUInt16LE(4)).toBeGreaterThan(0);

  return [asset[6] || 256, asset[7] || 256];
};

describe("public app asset contracts", () => {
  it("blocks callback credentials from becoming document referrers", () => {
    expect(documentSource).toContain(
      '<meta name="referrer" content="no-referrer" />',
    );
  });

  it("keeps document and install metadata on the same theme", () => {
    const themeMeta = documentSource.match(
      /<meta\s+name=["']theme-color["']\s+content=["']([^"']+)["']\s*\/?>/i,
    );

    expect(themeMeta?.[1]).toBe(manifest.theme_color);
    expect(manifest.background_color).toBe(manifest.theme_color);
  });

  it("references public app assets through the Vite base URL", () => {
    expect(documentSource).toContain(
      '<link rel="icon" href="%BASE_URL%favicon.ico" />',
    );
    expect(documentSource).toContain(
      '<link rel="apple-touch-icon" href="%BASE_URL%logo192.png" />',
    );
    expect(documentSource).toContain(
      '<link rel="manifest" href="%BASE_URL%manifest.json" />',
    );
  });

  it.each(manifest.icons)(
    "ships $src with its declared media type and dimensions",
    ({ sizes, src, type }) => {
      const asset = readFileSync(join(publicRoot, src));
      const actualDimensions =
        type === "image/png" ? pngDimensions(asset) : icoDimensions(asset);

      expect(actualDimensions).toEqual(declaredDimensions(sizes));
    },
  );
});
