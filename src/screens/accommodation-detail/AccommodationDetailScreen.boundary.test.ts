import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("AccommodationDetailScreen boundary", () => {
  it("does not own routing, HTTP, or QueryClient access", () => {
    const source = readFileSync(
      join(__dirname, "AccommodationDetailScreen.tsx"),
      "utf8",
    );

    expect(source).not.toMatch(/react-router-dom/);
    expect(source).not.toMatch(/useQueryClient|useQuery|useInfiniteQuery/);
    expect(source).not.toMatch(/platform\/http|\/api\//);
  });
});
