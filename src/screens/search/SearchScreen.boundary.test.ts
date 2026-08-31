import { readFileSync } from "fs";
import path from "path";

describe("SearchScreen dependency boundary", () => {
  it("keeps route, transport, query-client and vendor ownership outside the screen", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/screens/search/SearchScreen.tsx"),
      "utf8",
    );

    expect(source).not.toContain("react-router");
    expect(source).not.toMatch(/from ["'][^"']*\/api(?:\/|["'])/);
    expect(source).not.toContain("contracts");
    expect(source).not.toContain("QueryClient");
    expect(source).not.toContain("google.maps");
    expect(source).not.toContain("window.open");
  });
});
