import { readFileSync } from "fs";
import { join } from "path";

describe("api client source contracts", () => {
  it("does not log client configuration during module import", () => {
    const source = readFileSync(join(process.cwd(), "src/api/client.ts"), "utf8");

    expect(source).not.toContain("console.log");
    expect(source).not.toContain("[axios client]");
  });

  it("keeps Axios construction in the platform singleton only", () => {
    const legacySource = readFileSync(
      join(process.cwd(), "src/api/client.ts"),
      "utf8",
    );
    const platformSource = readFileSync(
      join(process.cwd(), "src/platform/http/client.ts"),
      "utf8",
    );

    expect(legacySource).not.toMatch(/axios\.create\s*\(/);
    expect(legacySource).not.toContain("clientV2");
    expect(legacySource).not.toContain("interceptors.response");
    expect(platformSource.match(/axios\.create\s*\(/g)).toHaveLength(1);
    expect(platformSource).toContain("interceptors.response.use");
    expect(platformSource).toMatch(/import axios from ["']axios["'];/);
    expect(platformSource).not.toContain("axios/dist/");
  });
});
