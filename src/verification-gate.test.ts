import fs from "fs";
import path from "path";

const projectRoot = process.cwd();
const packageJsonPath = path.join(projectRoot, "package.json");
const qaDocPath = path.join(projectRoot, "docs/qa/frontend-architecture-smoke.ko.md");

describe("frontend verification gate", () => {
  test("package scripts run typecheck, no-cache CI tests, and build", () => {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

    expect(packageJson.scripts["test:ci:no-cache"]).toBe(
      "react-scripts test --watchAll=false --no-cache",
    );
    expect(packageJson.scripts.verify).toContain("npm run typecheck");
    expect(packageJson.scripts.verify).toContain("npm run test:ci:no-cache");
    expect(packageJson.scripts.verify).toContain("npm run build");
  });

  test("QA smoke document covers required browser checkpoints without credentials", () => {
    expect(fs.existsSync(qaDocPath)).toBe(true);

    const qaDoc = fs.readFileSync(qaDocPath, "utf8");
    const requiredTerms = [
      "목적",
      "Airbnb 디자인 리팩터",
      "환경",
      "http://localhost:3000",
      "http://localhost:8080",
      "QA 계정",
      "Desktop 1280px",
      "Home search",
      "/search",
      "Search list",
      "page query",
      "map marker",
      "bounds",
      "Accommodation detail",
      "coupon",
      "reservation button",
      "Reservation confirm",
      "Wishlist",
      "Profile guest tab",
      "host tab",
      "Host listing",
      "Mobile 375px",
      "bottom sheet",
      "closed",
      "half",
      "full",
      "booking panel",
      "auth modal",
      "Recording",
      "failed step",
      "console error",
      "network failed request",
      "screenshot path",
    ];

    requiredTerms.forEach((term) => {
      expect(qaDoc).toContain(term);
    });

    ["qa@etl.airbob.local", "airbob1234", "Airbob QA", "2573"].forEach(
      (credential) => {
        expect(qaDoc).not.toContain(credential);
      },
    );
  });
});
