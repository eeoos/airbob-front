import { readFileSync } from "fs";
import { join } from "path";

describe("api client source contracts", () => {
  it("does not log client configuration during module import", () => {
    const source = readFileSync(join(process.cwd(), "src/api/client.ts"), "utf8");

    expect(source).not.toContain("console.log");
    expect(source).not.toContain("[axios client]");
  });
});
