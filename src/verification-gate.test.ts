import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";

const projectRoot = process.cwd();
const packageJsonPath = path.join(projectRoot, "package.json");
const qaDocPath = path.join(projectRoot, "docs/qa/frontend-architecture-smoke.ko.md");
const frontendSmokePath = path.join(projectRoot, "scripts/smoke/frontend-smoke.mjs");

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

    expect(packageJson.packageManager).toBe("npm@10.7.0");
    expect(packageJson.engines?.node).toBe(">=20.0.0");
    expect(packageJson.scripts["test:ci:no-cache"]).toBe(
      "react-scripts test --watchAll=false --no-cache",
    );
    expect(packageJson.scripts["verify:pre-redesign"]).toBe(
      "npm run typecheck && npm run test:ci:no-cache -- --runInBand && npm run build",
    );
    expect(packageJson.scripts["smoke:frontend"]).toBe(
      "node scripts/smoke/frontend-smoke.mjs",
    );
    expect(packageJson.scripts["smoke:frontend:strict"]).toBe(
      "AIRBOB_SMOKE_STRICT_DYNAMIC_ROUTES=true node scripts/smoke/frontend-smoke.mjs",
    );
    expect(packageJson.scripts["verify:design-ready"]).toBe(
      "npm run verify:pre-redesign && npm run smoke:frontend:strict",
    );
    expect(packageJson.scripts.verify).toContain("npm run typecheck");
    expect(packageJson.scripts.verify).toContain("npm run test:ci:no-cache");
    expect(packageJson.scripts.verify).toContain("npm run build");
  });

  test("frontend smoke enforces route-specific assertions and redacted output guards", () => {
    expect(fs.existsSync(frontendSmokePath)).toBe(true);

    const smokeScript = fs.readFileSync(frontendSmokePath, "utf8");

    [
      "selector",
      "expectedText",
      "Promise",
      "setTimeout",
      "timeout",
      "document.querySelector(selector)",
      "visibleText.includes(expectedText)",
      "consoleFailurePattern",
      "apiFailurePattern",
      "browseJsFailurePattern",
      "redactionEntries",
      "delete childEnv.AIRBOB_QA_EMAIL",
      "delete childEnv.AIRBOB_QA_PASSWORD",
      "AIRBOB_SMOKE_ACCOMMODATION_ID",
      "AIRBOB_SMOKE_RESERVATION_UID",
      "AIRBOB_SMOKE_HOST_RESERVATION_UID",
      'const strictDynamicRoutes = process.env.AIRBOB_SMOKE_STRICT_DYNAMIC_ROUTES === "true";',
      "skippedDynamicRoutes",
      "strictDynamicRoutes && skippedDynamicRoutes.length > 0",
      "Strict dynamic route smoke mode requires stable route ids",
      "Skipped Dynamic Routes",
      "Skipped dynamic smoke routes",
      "Missing required environment variables",
      "missingEnv.join",
      "routeInteractionAssertion",
      "routeInteractionAssertion(route)",
      "Search route interaction assertion failed",
      "Accommodation detail interaction assertion failed",
      "process.exit(status === 0 ? 1 : status)",
    ].forEach((term) => {
      expect(smokeScript).toContain(term);
    });

    [
      'selector: "#root"',
      'expectedText: "특별한 숙소"',
      'expectedText: "숙소"',
      'expectedText: "위시리스트"',
      'expectedText: "최근"',
      'expectedText: "호스트"',
      'name: "accommodation-detail"',
      'pathTemplate: "/accommodations/:id"',
      'name: "reservation-detail"',
      'pathTemplate: "/reservations/:reservationUid"',
      'name: "host-reservation-detail"',
      'pathTemplate: "/profile/host/reservations/:reservationUid"',
    ].forEach((term) => {
      expect(smokeScript).toContain(term);
    });

    expect(smokeScript).not.toMatch(/process\.env\.AIRBOB_QA_(?:EMAIL|PASSWORD)[^;]*console/);
  });

  test("frontend smoke fails when browse exits zero with guarded console and JS error output", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "airbob-smoke-"));
    const fakeBrowsePath = path.join(tempDir, "fake-browse.mjs");

    fs.writeFileSync(
      fakeBrowsePath,
      [
        "#!/usr/bin/env node",
        "process.stdin.resume();",
        "process.stdin.on('end', () => {",
        '  console.log("console.error: React route assertion failed");',
        '  console.log("[js] ERROR: evaluate: Error: route assertion failed");',
        "  process.exit(0);",
        "});",
      ].join("\n"),
      { mode: 0o755 },
    );

    try {
      const result = spawnSync(process.execPath, [frontendSmokePath], {
        cwd: projectRoot,
        encoding: "utf8",
        env: {
          ...process.env,
          AIRBOB_QA_EMAIL: "fake-user@example.invalid",
          AIRBOB_QA_PASSWORD: "fake-password",
          GSTACK_BROWSE_BIN: fakeBrowsePath,
          AIRBOB_FRONTEND_URL: "http://localhost:3000",
        },
        maxBuffer: 10 * 1024 * 1024,
      });
      const output = `${result.stdout}\n${result.stderr}`;
      const reportPathMatch = output.match(/Smoke report written to (.+\.md)/);
      const reportPath = reportPathMatch
        ? path.join(projectRoot, reportPathMatch[1])
        : "";
      const report = reportPath ? fs.readFileSync(reportPath, "utf8") : "";

      if (reportPath) {
        fs.rmSync(reportPath, { force: true });
      }

      expect(result.status).toBe(1);
      expect(report).toContain("- Status: FAIL");
      expect(report).toContain(
        "- Output guard failures: console error/warning output, browse JS error output",
      );
      expect(report).toContain("## Skipped Dynamic Routes");
      expect(report).toContain(
        "- reservation-detail (/reservations/:reservationUid): skipped; set AIRBOB_SMOKE_RESERVATION_UID to cover this route.",
      );
      expect(report).toContain(
        "- host-reservation-detail (/profile/host/reservations/:reservationUid): skipped; set AIRBOB_SMOKE_HOST_RESERVATION_UID to cover this route.",
      );
      expect(output).toContain("Skipped dynamic smoke routes");
      expect(output).toContain("AIRBOB_SMOKE_RESERVATION_UID");
      expect(output).not.toContain("fake-user@example.invalid");
      expect(output).not.toContain("fake-password");
      expect(report).not.toContain("fake-user@example.invalid");
      expect(report).not.toContain("fake-password");
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("frontend smoke strict mode fails before browse when dynamic route UIDs are missing", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "airbob-smoke-"));
    const fakeBrowsePath = path.join(tempDir, "fake-browse.mjs");

    fs.writeFileSync(
      fakeBrowsePath,
      [
        "#!/usr/bin/env node",
        'console.log("fake browse invoked");',
        "process.exit(0);",
      ].join("\n"),
      { mode: 0o755 },
    );

    try {
      const result = spawnSync(process.execPath, [frontendSmokePath], {
        cwd: projectRoot,
        encoding: "utf8",
        env: {
          ...process.env,
          AIRBOB_QA_EMAIL: "fake-user@example.invalid",
          AIRBOB_QA_PASSWORD: "fake-password",
          GSTACK_BROWSE_BIN: fakeBrowsePath,
          AIRBOB_FRONTEND_URL: "http://localhost:3000",
          AIRBOB_SMOKE_STRICT_DYNAMIC_ROUTES: "true",
        },
        maxBuffer: 10 * 1024 * 1024,
      });
      const output = `${result.stdout}\n${result.stderr}`;

      expect(result.status).toBe(1);
      expect(output).toContain(
        "Strict dynamic route smoke mode requires stable route ids",
      );
      expect(output).toContain("AIRBOB_SMOKE_RESERVATION_UID");
      expect(output).toContain("AIRBOB_SMOKE_HOST_RESERVATION_UID");
      expect(output).not.toContain("fake browse invoked");
      expect(output).not.toContain("fake-user@example.invalid");
      expect(output).not.toContain("fake-password");
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
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
      "verify:pre-redesign",
      "verify:design-ready",
      "smoke:frontend:strict",
      "AIRBOB_API_BASE_URL",
      "AIRBOB_FRONTEND_URL",
      "GSTACK_BROWSE_BIN",
      "AIRBOB_QA_EMAIL",
      ': "${AIRBOB_QA_PASSWORD:?Set AIRBOB_QA_PASSWORD in the shell before running smoke}"',
      "AIRBOB_SMOKE_ACCOMMODATION_ID",
      "AIRBOB_SMOKE_RESERVATION_UID",
      "AIRBOB_SMOKE_HOST_RESERVATION_UID",
      "curl -fsS",
      "guest_reservation_uid",
      "host_reservation_uid",
      "npm run smoke:frontend:strict",
      "Skipped Dynamic Routes",
      "Smoke report evidence",
      "2026-07-04 KST Redesign Readiness Smoke Gate",
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
    expect(qaDoc).not.toMatch(
      /(?:^|[^A-Z_])(?:email|password|nickname|member[_ -]?id)\s*[:=]/i,
    );
    expect(qaDoc).not.toMatch(/(?:이메일|비밀번호)\s*[:=：]/);
    expect(qaDoc).not.toContain("Final Verification");
    expect(qaDoc).not.toContain("PASS in final verification");
  });
});
