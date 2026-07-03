import fs from "fs";
import path from "path";

const projectRoot = process.cwd();
const packageJsonPath = path.join(projectRoot, "package.json");
const qaDocPath = path.join(projectRoot, "docs/qa/frontend-architecture-smoke.ko.md");

const getSection = (content: string, heading: string, level = 2) => {
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const headingPrefix = "#".repeat(level);
  const section = content.match(
    new RegExp(
      `${headingPrefix} ${escapedHeading}\\n([\\s\\S]*?)(?=\\n${headingPrefix} |$)`,
    ),
  );

  expect(section).not.toBeNull();

  return section?.[1] ?? "";
};

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
      "Recording",
      "failed step",
      "console error",
      "network failed request",
      "screenshot path",
    ];
    const desktopSection = getSection(qaDoc, "Desktop 1280px 체크리스트");
    const desktopTerms = [
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
      "AccommodationEdit",
      "image upload",
      "publish",
      "Toss",
      "PaymentSuccess",
      "ReservationDetail",
      "Host reservation detail",
      "Wishlist",
      "Profile guest tab",
      "host tab",
      "Host listing",
    ];
    const mobileSection = getSection(qaDoc, "Mobile 375px 체크리스트");
    const mobileTerms = [
      "Home search",
      "Search mobile bottom sheet",
      "bottom sheet",
      "closed",
      "half",
      "full",
      "Detail booking panel",
      "booking panel",
      "Reservation confirm",
      "Wishlist",
      "Profile guest tab",
      "host tab",
      "Host listing",
      "auth modal",
    ];
    const architectureSection = getSection(qaDoc, "Architecture Checkpoints");
    const architectureCheckpoints = [
      {
        heading: "query route contract",
        expectedTerms: [
          "/profile?mode=host&tab=reservations",
          "/wishlist?view=recently-viewed",
          "browser back/forward",
        ],
      },
      {
        heading: "server-state auth boundary",
        expectedTerms: ["login", "logout", "401 handling"],
      },
      {
        heading: "components ownership boundary",
        expectedTerms: ["shared UI primitives", "workflow containers"],
      },
      {
        heading: "design system entry contracts",
        expectedTerms: ["src/styles/design-system-contracts.test.ts", "screenshot path"],
      },
    ];

    requiredTerms.forEach((term) => {
      expect(qaDoc).toContain(term);
    });
    desktopTerms.forEach((term) => {
      expect(desktopSection).toContain(term);
    });
    mobileTerms.forEach((term) => {
      expect(mobileSection).toContain(term);
    });
    architectureCheckpoints.forEach(({ heading, expectedTerms }) => {
      const checkpoint = getSection(architectureSection, heading, 3);

      expect(checkpoint).toContain("Steps:");
      expect(checkpoint).toContain("Expected:");
      expect(checkpoint).toContain("Evidence:");
      expectedTerms.forEach((term) => {
        expect(checkpoint).toContain(term);
      });
    });

    expect(qaDoc).not.toMatch(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    expect(qaDoc).not.toMatch(/(?:email|password|member[_ -]?id)\s*[:=]/i);
    expect(qaDoc).not.toMatch(/(?:이메일|비밀번호)\s*[:=：]/);
  });
});
