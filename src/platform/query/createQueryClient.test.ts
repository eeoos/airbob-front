import { readFileSync } from "fs";
import { join } from "path";
import { createQueryClient } from "./createQueryClient";

describe("createQueryClient", () => {
  it("preserves the production query and mutation defaults", () => {
    const defaults = createQueryClient().getDefaultOptions();

    expect(defaults.queries).toMatchObject({
      retry: 1,
      refetchOnWindowFocus: false,
    });
    expect(defaults.mutations).toMatchObject({ retry: false });
  });

  it("allows a test harness to override defaults without dropping production safeguards", () => {
    const defaults = createQueryClient({
      defaultOptions: {
        queries: { retry: false, staleTime: Infinity },
      },
    }).getDefaultOptions();

    expect(defaults.queries).toMatchObject({
      retry: false,
      staleTime: Infinity,
      refetchOnWindowFocus: false,
    });
    expect(defaults.mutations).toMatchObject({ retry: false });
  });

  it("keeps the session runtime bound to the platform-owned factory", () => {
    const sessionRuntimeSource = readFileSync(
      join(process.cwd(), "src/app/session/useSessionQueryLifetime.ts"),
      "utf8",
    );

    expect(sessionRuntimeSource).toMatch(
      /from ["']\.\.\/\.\.\/platform\/query\/createQueryClient["'];/,
    );
    expect(sessionRuntimeSource).not.toContain("src/query");
  });
});
