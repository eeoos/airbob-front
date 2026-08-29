import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";

const projectRoot = process.cwd();
const packageJsonPath = path.join(projectRoot, "package.json");
const frontendWorkflowPath = path.join(
  projectRoot,
  ".github/workflows/frontend.yml",
);
const qaDocPath = path.join(projectRoot, "docs/qa/frontend-architecture-smoke.ko.md");
const architectureDocPath = path.join(
  projectRoot,
  "docs/architecture/frontend-structure-refactor.md",
);
const currentArchitectureDocPath = path.join(
  projectRoot,
  "docs/architecture/current-frontend-architecture.md",
);
const migrationRulesDocPath = path.join(
  projectRoot,
  "docs/architecture/frontend-migration-rules.md",
);
const ownershipMatrixDocPath = path.join(
  projectRoot,
  "docs/architecture/frontend-ownership-matrix.md",
);
const architectureRulesDocPath = path.join(
  projectRoot,
  "tests/architecture/dependency-rules.md",
);
const dependencyCruiserConfigPath = path.join(
  projectRoot,
  ".dependency-cruiser.cjs",
);
const knipConfigPath = path.join(projectRoot, "knip.json");
const stylelintConfigPath = path.join(projectRoot, "stylelint.config.mjs");
const architectureRatchetPath = path.join(
  projectRoot,
  "architecture-ratchet.json",
);
const architectureFreezeDocPath = path.join(
  projectRoot,
  "docs/architecture/frontend-architecture-freeze.ko.md",
);
const envExamplePath = path.join(projectRoot, ".env.example");
const frontendSmokePath = path.join(projectRoot, "scripts/smoke/frontend-smoke.mjs");
const sourceRoot = path.join(projectRoot, "src");

const productionSourceExtensions = new Set([
  ".js",
  ".jsx",
  ".mjs",
  ".ts",
  ".tsx",
]);
const rawConsoleAllowlist = new Set(["src/utils/clientLogger.ts"]);
const dynamicInlineStyleAllowlist = [
  {
    filePath: "src/features/accommodations/edit/components/PhotosStep.tsx",
    pattern: /style=\{\{\s*width:\s*`\$\{uploadProgress\}%`\s*\}\}/,
  },
  {
    filePath: "src/features/accommodations/components/AccommodationHero.tsx",
    pattern:
      /style=\{\{\s*transform:\s*`translateX\(-\$\{mobileSlideIndex \* 100\}%\)`\s*\}\}/,
  },
];

const toProjectPath = (filePath: string) =>
  path.relative(projectRoot, filePath).split(path.sep).join("/");

const getFiles = (directory: string): string[] =>
  fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return getFiles(entryPath);
    }

    return entry.isFile() ? [entryPath] : [];
  });

const isProductionSourceFile = (filePath: string) => {
  const relativePath = toProjectPath(filePath);
  const extension = path.extname(filePath);

  if (!relativePath.startsWith("src/")) {
    return false;
  }

  if (!productionSourceExtensions.has(extension)) {
    return false;
  }

  return !(
    relativePath.endsWith(".d.ts") ||
    relativePath === "src/setupTests.ts" ||
    relativePath.includes("/__mocks__/") ||
    relativePath.includes("/__tests__/") ||
    /\.(?:test|spec)\.(?:mjs|[jt]sx?)$/.test(relativePath)
  );
};

const getProductionSourceFiles = () =>
  getFiles(sourceRoot).filter(isProductionSourceFile).sort();

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

const isolatedSmokeSubprocessEnv = (
  overrides: Record<string, string | undefined> = {},
) => {
  const env = { ...process.env };

  [
    "AIRBOB_SMOKE_RESERVATION_UID",
    "AIRBOB_SMOKE_HOST_RESERVATION_UID",
    "AIRBOB_SMOKE_ACCOMMODATION_ID",
    "AIRBOB_SMOKE_EDIT_ACCOMMODATION_ID",
    "AIRBOB_SMOKE_EXPECT_SEARCH_RESULTS",
    "AIRBOB_SMOKE_REPORT_ROOT",
    "AIRBOB_SMOKE_STRICT_DYNAMIC_ROUTES",
    "AIRBOB_API_BASE_URL",
  ].forEach((key) => {
    delete env[key];
  });

  return { ...env, ...overrides };
};

const readDirectoryEntries = (directory: string) =>
  fs.existsSync(directory) ? fs.readdirSync(directory).sort() : null;

const toSmokeReportPath = (reportedPath: string) =>
  path.isAbsolute(reportedPath)
    ? reportedPath
    : path.join(projectRoot, reportedPath);

const removeNewDirectoryEntries = (
  directory: string,
  previousEntries: string[] | null,
) => {
  if (!fs.existsSync(directory)) {
    return;
  }

  if (previousEntries === null) {
    fs.rmSync(directory, { recursive: true, force: true });
    return;
  }

  const previousEntrySet = new Set(previousEntries);

  fs.readdirSync(directory)
    .filter((entry) => !previousEntrySet.has(entry))
    .forEach((entry) => {
      fs.rmSync(path.join(directory, entry), { recursive: true, force: true });
    });
};

type PreflightFetchFixture = { status: number } | { error: true };

const writePreflightFetchMock = (
  directory: string,
  fixtures: Record<string, PreflightFetchFixture>,
) => {
  const fetchMockPath = path.join(directory, "fetch-mock.cjs");

  fs.writeFileSync(
    fetchMockPath,
    [
      `const fixtures = ${JSON.stringify(fixtures)};`,
      "global.fetch = async (input) => {",
      "  const url = String(input);",
      "  const fixture = fixtures[url];",
      "  if (!fixture) {",
      "    throw new Error('Unexpected preflight URL: ' + url);",
      "  }",
      "  if (fixture.error) {",
      "    throw new Error('fetch failed for ' + url);",
      "  }",
      "  return new Response(null, { status: fixture.status });",
      "};",
    ].join("\n"),
  );

  return fetchMockPath;
};

describe("frontend verification gate", () => {
  test("query error toast handling uses the shared query hook", () => {
    const productionFiles = getProductionSourceFiles()
      .map(toProjectPath)
      .filter((relativePath) => relativePath.startsWith("src/features/"));

    const violations = productionFiles.filter((relativePath) => {
      const source = fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
      return /handledErrorUpdatedAtRef/.test(source);
    });

    expect(violations).toEqual([]);
  });

  test("smoke subprocess env removes parent smoke vars unless explicitly overridden", () => {
    const previousReportRoot = process.env.AIRBOB_SMOKE_REPORT_ROOT;
    const previousEditAccommodationId =
      process.env.AIRBOB_SMOKE_EDIT_ACCOMMODATION_ID;

    process.env.AIRBOB_SMOKE_REPORT_ROOT = "/tmp/airbob-parent-smoke";
    process.env.AIRBOB_SMOKE_EDIT_ACCOMMODATION_ID = "parent-id";

    try {
      const defaultEnv = isolatedSmokeSubprocessEnv();

      expect(
        defaultEnv.AIRBOB_SMOKE_REPORT_ROOT,
      ).toBeUndefined();
      expect(defaultEnv.AIRBOB_SMOKE_EDIT_ACCOMMODATION_ID).toBeUndefined();

      const overrideEnv = isolatedSmokeSubprocessEnv({
        AIRBOB_SMOKE_REPORT_ROOT: "/tmp/airbob-override-smoke",
        AIRBOB_SMOKE_EDIT_ACCOMMODATION_ID: "override-id",
      });

      expect(overrideEnv.AIRBOB_SMOKE_REPORT_ROOT).toBe(
        "/tmp/airbob-override-smoke",
      );
      expect(overrideEnv.AIRBOB_SMOKE_EDIT_ACCOMMODATION_ID).toBe("override-id");
    } finally {
      if (previousReportRoot === undefined) {
        delete process.env.AIRBOB_SMOKE_REPORT_ROOT;
      } else {
        process.env.AIRBOB_SMOKE_REPORT_ROOT = previousReportRoot;
      }

      if (previousEditAccommodationId === undefined) {
        delete process.env.AIRBOB_SMOKE_EDIT_ACCOMMODATION_ID;
      } else {
        process.env.AIRBOB_SMOKE_EDIT_ACCOMMODATION_ID =
          previousEditAccommodationId;
      }
    }
  });

  test("production source routes warn/error logging and static inline styles through guardrails", () => {
    const rawConsoleViolations: string[] = [];
    const staticInlineStyleViolations: string[] = [];

    getProductionSourceFiles().forEach((filePath) => {
      const relativePath = toProjectPath(filePath);
      const source = fs.readFileSync(filePath, "utf8");

      if (!rawConsoleAllowlist.has(relativePath)) {
        Array.from(source.matchAll(/\bconsole\.(?:warn|error)\s*\(/g)).forEach(
          (match) => {
            rawConsoleViolations.push(`${relativePath}: ${match[0]}`);
          },
        );
      }

      Array.from(source.matchAll(/style=\{\{[\s\S]*?\}\}/g)).forEach(
        (match) => {
          const styleSource = match[0].replace(/\s+/g, " ").trim();
          const isAllowedDynamicStyle = dynamicInlineStyleAllowlist.some(
            (allowed) =>
              allowed.filePath === relativePath && allowed.pattern.test(match[0]),
          );

          if (isAllowedDynamicStyle) {
            return;
          }

          if (
            /\bdisplay\s*:\s*["']none["']/.test(match[0]) ||
            /\bborder\s*:\s*0\b/.test(match[0])
          ) {
            staticInlineStyleViolations.push(`${relativePath}: ${styleSource}`);
          }
        },
      );

      if (/\bbuttonResetStyle\b/.test(source)) {
        staticInlineStyleViolations.push(
          `${relativePath}: buttonResetStyle static reset object`,
        );
      }
    });

    expect(rawConsoleViolations).toEqual([]);
    expect(staticInlineStyleViolations).toEqual([]);
  });

  test("package scripts run typecheck, no-cache CI tests, and build", () => {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

    expect(packageJson.packageManager).toBe("npm@10.7.0");
    expect(packageJson.engines?.node).toBe(
      "^20.12.0 || ^22.0.0 || ^24.0.0",
    );
    expect(packageJson.scripts["test:ci:no-cache"]).toBe(
      "react-scripts test --watchAll=false --no-cache",
    );
    expect(packageJson.scripts["test:e2e:characterization"]).toBe(
      "playwright test --project=chromium",
    );
    expect(packageJson.scripts["test:e2e:artifact-policy"]).toBe(
      "node tests/e2e/support/scan-artifacts.mjs --self-test",
    );
    expect(packageJson.scripts["typecheck:e2e"]).toBe(
      "tsc --noEmit -p tsconfig.e2e.json",
    );
    expect(packageJson.scripts["lint:e2e"]).toBe(
      "eslint playwright.config.ts tests/e2e --ext .mjs,.ts --max-warnings=0",
    );
    expect(packageJson.scripts["test:architecture-rules"]).toContain(
      "verify-dependency-rules.mjs",
    );
    expect(packageJson.scripts["test:architecture-rules"]).toContain(
      "verify-architecture-ratchet.mjs",
    );
    expect(packageJson.scripts["test:architecture-rules"]).toContain(
      "verify-registry-rules.mjs",
    );
    expect(packageJson.scripts["test:architecture-rules"]).toContain(
      "verify-git-baselines.mjs",
    );
    expect(packageJson.scripts["test:architecture-rules"]).toContain(
      "verify-knip-reachability.mjs",
    );
    expect(packageJson.scripts["test:architecture-rules"]).toContain(
      "verify-style-rules.mjs",
    );
    expect(packageJson.scripts["lint:architecture"]).toBe(
      "node scripts/architecture/run-dependency-cruiser.mjs",
    );
    expect(packageJson.scripts["lint:dead-code"]).toContain(
      "knip-target-ratchet.mjs",
    );
    expect(packageJson.scripts["lint:dead-code"]).toContain(
      "verify-unused-dependency-ratchet.mjs",
    );
    expect(packageJson.scripts["lint:styles"]).toBe(
      'stylelint "src/**/*.css" --quiet',
    );
    expect(packageJson.scripts["verify:architecture"]).toBe(
      "npm run test:architecture-rules && npm run lint:architecture && npm run lint:dead-code && npm run lint:styles && npm run lint:architecture-tools",
    );
    expect(packageJson.devDependencies).toMatchObject({
      "dependency-cruiser": "17.4.3",
      knip: "2.43.0",
      stylelint: "16.23.1",
      "stylelint-config-recommended": "17.0.0",
      "stylelint-config-standard": "39.0.0",
    });
    expect(packageJson.scripts.lint).toBe(
      "eslint src --ext .js,.jsx,.mjs,.ts,.tsx",
    );
    expect(packageJson.scripts.build).toBe(
      "node scripts/architecture/validate-public-build-env.mjs && react-scripts build",
    );
    expect(packageJson.scripts["lint:strict"]).toBe(
      "eslint src --ext .js,.jsx,.mjs,.ts,.tsx --max-warnings=0",
    );
    expect(packageJson.scripts["verify:structure"]).toBe(
      "npm run typecheck && npm run verify:architecture && npm run test:public-config-build && npm run test:ci:no-cache -- --runInBand && npm run lint:strict",
    );
    expect(packageJson.scripts["test:public-config-build"]).toBe(
      "node scripts/architecture/verify-public-config-build.mjs",
    );
    expect(packageJson.scripts["verify:pre-redesign"]).toBe(
      "npm run typecheck && npm run test:ci:no-cache -- --runInBand && npm run build",
    );
    expect(packageJson.scripts["smoke:frontend"]).toBe(
      "node scripts/smoke/frontend-smoke.mjs",
    );
    expect(packageJson.scripts["smoke:frontend:preflight"]).toBe(
      "node scripts/smoke/frontend-smoke.mjs --preflight",
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
    expect(packageJson.scripts.verify).not.toContain("npm run lint");
    expect(packageJson.scripts.verify).not.toContain("lint:strict");
  });

  test("frontend CI runs static and deterministic browser gates on Node 20", () => {
    expect(fs.existsSync(frontendWorkflowPath)).toBe(true);

    const workflow = fs.readFileSync(frontendWorkflowPath, "utf8");

    [
      "fetch-depth: 0",
      "node-version: 20",
      "run: npm ci",
      "run: npx playwright install --with-deps chromium",
      "run: npm run test:e2e:artifact-policy",
      "run: npm run typecheck",
      "run: npm run typecheck:e2e",
      "run: npm run verify:architecture",
      "run: npm run test:public-config-build",
      "AIRBOB_PUSH_BEFORE_SHA: $" +
        "{{ github.event_name == 'push' && github.event.before || '' }}",
      "run: npm run test:ci:no-cache -- --runInBand",
      "run: npm run build",
      "run: npm run test:e2e:characterization",
      "run: npm run lint:strict",
      "run: npm run lint:e2e",
    ].forEach((term) => {
      expect(workflow).toContain(term);
    });

    const commandOrder = [
      "run: npm ci",
      "run: npx playwright install --with-deps chromium",
      "run: npm run test:e2e:artifact-policy",
      "run: npm run typecheck",
      "run: npm run typecheck:e2e",
      "run: npm run verify:architecture",
      "run: npm run test:public-config-build",
      "run: npm run test:ci:no-cache -- --runInBand",
      "run: npm run build",
      "REACT_APP_API_URL: https://api.example.invalid",
      "run: npm run test:e2e:characterization",
      "run: npm run lint:strict",
      "run: npm run lint:e2e",
    ].map((term) => workflow.indexOf(term));

    expect(commandOrder.every((index) => index >= 0)).toBe(true);
    expect(commandOrder).toEqual([...commandOrder].sort((a, b) => a - b));
  });

  test("canonical frontend architecture docs and placeholder env example are present", () => {
    expect(fs.existsSync(architectureDocPath)).toBe(true);
    expect(fs.existsSync(currentArchitectureDocPath)).toBe(true);
    expect(fs.existsSync(migrationRulesDocPath)).toBe(true);
    expect(fs.existsSync(ownershipMatrixDocPath)).toBe(true);
    expect(fs.existsSync(architectureRulesDocPath)).toBe(true);
    expect(fs.existsSync(dependencyCruiserConfigPath)).toBe(true);
    expect(fs.existsSync(knipConfigPath)).toBe(true);
    expect(fs.existsSync(stylelintConfigPath)).toBe(true);
    expect(fs.existsSync(architectureRatchetPath)).toBe(true);
    expect(fs.existsSync(envExamplePath)).toBe(true);

    const historicalArchitectureDoc = fs.readFileSync(
      architectureDocPath,
      "utf8",
    );
    const currentArchitectureDoc = fs.readFileSync(
      currentArchitectureDocPath,
      "utf8",
    );
    const migrationRulesDoc = fs.readFileSync(migrationRulesDocPath, "utf8");
    const ownershipMatrixDoc = fs.readFileSync(ownershipMatrixDocPath, "utf8");
    const architectureRulesDoc = fs.readFileSync(
      architectureRulesDocPath,
      "utf8",
    );
    const architectureRatchet = JSON.parse(
      fs.readFileSync(architectureRatchetPath, "utf8"),
    );
    const envExample = fs.readFileSync(envExamplePath, "utf8");

    [
      "Status: canonical current-state source of truth",
      "Backend endpoints, request/response fields, cookie semantics, database",
      "server authorization are outside frontend ownership.",
      "There must be one active writer for every mutable workflow.",
      "All 15 entries are lazy.",
      "src/app/router/lazyRoutes.tsx",
      "src/app/shells/**",
      "The rollback-only route chain is",
      "Still-active compatibility",
      "Airbnb visual redesign begins only after the architecture design-entry gate",
      "When documents disagree about the current frontend, this document wins.",
    ].forEach((term) => {
      expect(currentArchitectureDoc).toContain(term);
    });

    expect(historicalArchitectureDoc).toContain("superseded on 2026-08-29");
    expect(historicalArchitectureDoc).toContain("current-frontend-architecture.md");
    expect(migrationRulesDoc).toContain("Keep one active writer");
    expect(migrationRulesDoc).toContain("Do not weaken a gate to make a unit green.");
    expect(ownershipMatrixDoc).toContain(
      "**Active** is the only production route entry",
    );
    expect(ownershipMatrixDoc).toContain(
      "Current cutover state: U6 app Router",
    );
    expect(ownershipMatrixDoc).toContain(
      "app adapter → current/old body",
    );
    expect(ownershipMatrixDoc).toContain("U10/U11 payment compatibility matrix");
    expect(architectureRulesDoc).toContain("Single rule owners");
    expect(architectureRulesDoc).toContain("sixteen cross-feature compatibility edges");
    expect(architectureRulesDoc).toContain("Strict design-policy errors are zero");
    expect(Array.isArray(architectureRatchet.migratedFeatures)).toBe(true);
    expect(new Set(architectureRatchet.migratedFeatures).size).toBe(
      architectureRatchet.migratedFeatures.length,
    );
    expect(architectureRatchet.migratedFeatures).toEqual(
      [...architectureRatchet.migratedFeatures].sort(),
    );

    [
      "REACT_APP_API_URL=http://localhost:8080",
      "REACT_APP_GOOGLE_MAPS_API_KEY=replace-with-local-dev-key",
      "AIRBOB_QA_EMAIL=qa@example.com",
      "AIRBOB_QA_PASSWORD=replace-with-local-qa-password",
      "AIRBOB_SMOKE_REPORT_ROOT=.gstack/qa-reports",
      "AIRBOB_SMOKE_RESERVATION_UID=replace-with-stable-reservation-uid",
    ].forEach((term) => {
      expect(envExample).toContain(term);
    });
  });

  test("historical frontend freeze points to the canonical migration registry", () => {
    expect(fs.existsSync(architectureFreezeDocPath)).toBe(true);

    const freezeDoc = fs.readFileSync(architectureFreezeDocPath, "utf8");

    [
      "2026-08-29 superseded",
      "current-frontend-architecture.md",
      "frontend-migration-rules.md",
      "frontend-ownership-matrix.md",
      "appShell.ts`와 `publicCache.ts`는 목표 구조가 아니라",
      "과거 통과 기록이나 skip은 현재 검증을 대신하지 않습니다.",
    ].forEach((term) => {
      expect(freezeDoc).toContain(term);
    });
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
      "AIRBOB_SMOKE_EDIT_ACCOMMODATION_ID",
      "AIRBOB_SMOKE_RESERVATION_UID",
      "AIRBOB_SMOKE_HOST_RESERVATION_UID",
      "AIRBOB_API_BASE_URL",
      "isPreflightMode",
      "runPreflight",
      "sanitizeUrlForDisplay",
      "sanitizeReachabilityMessage",
      "Frontend smoke preflight failed",
      "GSTACK_BROWSE_BIN must point to an existing executable file",
      "response.status < 200 || response.status >= 400",
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
      "rawGoogleMapsApiKey",
      'const googleMapsApiKey = rawGoogleMapsApiKey?.trim() ?? "";',
      "googleMapsApiKeyReady",
      "Google Maps API key:",
      "AIRBOB_SMOKE_EXPECT_SEARCH_RESULTS",
      "Search result fixture was required but no result card was visible",
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

    const accommodationDetailRoute = smokeScript.match(
      /routeFromTemplate\(\{\s*name:\s*"accommodation-detail",[\s\S]*?\n\s*\}\),/,
    );
    expect(accommodationDetailRoute?.[0]).toContain('expectedText: "예약하기"');

    expect(smokeScript).not.toMatch(/process\.env\.AIRBOB_QA_(?:EMAIL|PASSWORD)[^;]*console/);
  });

  test("frontend smoke preflight rejects 4xx services and strips URL credentials", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "airbob-preflight-"));
    const fakeBrowsePath = path.join(tempDir, "fake-browse.mjs");
    const reportRoot = path.join(tempDir, "reports");
    const frontendUrl =
      "http://frontend-user:frontend-secret@frontend.invalid";
    const backendUrl = "http://backend.invalid";
    const fetchMockPath = writePreflightFetchMock(tempDir, {
      [frontendUrl]: { status: 204 },
      [backendUrl]: { status: 404 },
    });

    fs.writeFileSync(
      fakeBrowsePath,
      ["#!/usr/bin/env node", 'console.log("browse should not run");'].join("\n"),
      { mode: 0o755 },
    );

    try {
      const result = spawnSync(
        process.execPath,
        ["--require", fetchMockPath, frontendSmokePath, "--preflight"],
        {
          cwd: projectRoot,
          encoding: "utf8",
          env: isolatedSmokeSubprocessEnv({
            AIRBOB_API_BASE_URL: backendUrl,
            AIRBOB_FRONTEND_URL: frontendUrl,
            AIRBOB_QA_EMAIL: "fake-user@example.invalid",
            AIRBOB_QA_PASSWORD: "fake-password",
            AIRBOB_SMOKE_ACCOMMODATION_ID: "3",
            AIRBOB_SMOKE_EDIT_ACCOMMODATION_ID: "3",
            AIRBOB_SMOKE_HOST_RESERVATION_UID: "host-reservation-uid",
            AIRBOB_SMOKE_REPORT_ROOT: reportRoot,
            AIRBOB_SMOKE_RESERVATION_UID: "guest-reservation-uid",
            GSTACK_BROWSE_BIN: fakeBrowsePath,
          }),
          maxBuffer: 10 * 1024 * 1024,
        },
      );
      const output = `${result.stdout}\n${result.stderr}`;

      expect(result.status).toBe(1);
      expect(output).toContain("Frontend smoke preflight failed");
      expect(output).toContain("Backend responded with HTTP 404");
      expect(output).toContain(backendUrl);
      expect(output).not.toContain("browse should not run");
      expect(output).not.toContain("frontend-user");
      expect(output).not.toContain("frontend-secret");
      expect(output).not.toContain("fake-user@example.invalid");
      expect(output).not.toContain("fake-password");
      expect(fs.existsSync(reportRoot)).toBe(false);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("frontend smoke preflight passes against controlled reachable services without invoking browse", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "airbob-preflight-"));
    const fakeBrowsePath = path.join(tempDir, "fake-browse.mjs");
    const reportRoot = path.join(tempDir, "reports");
    const frontendUrl = "http://frontend.invalid";
    const backendUrl = "http://backend.invalid";
    const fetchMockPath = writePreflightFetchMock(tempDir, {
      [frontendUrl]: { status: 204 },
      [backendUrl]: { status: 204 },
    });

    fs.writeFileSync(
      fakeBrowsePath,
      ["#!/usr/bin/env node", 'console.log("browse should not run");'].join("\n"),
      { mode: 0o755 },
    );

    try {
      const result = spawnSync(
        process.execPath,
        ["--require", fetchMockPath, frontendSmokePath, "--preflight"],
        {
          cwd: projectRoot,
          encoding: "utf8",
          env: isolatedSmokeSubprocessEnv({
            AIRBOB_API_BASE_URL: backendUrl,
            AIRBOB_FRONTEND_URL: frontendUrl,
            AIRBOB_QA_EMAIL: "fake-user@example.invalid",
            AIRBOB_QA_PASSWORD: "fake-password",
            AIRBOB_SMOKE_ACCOMMODATION_ID: "3",
            AIRBOB_SMOKE_EDIT_ACCOMMODATION_ID: "3",
            AIRBOB_SMOKE_HOST_RESERVATION_UID: "host-reservation-uid",
            AIRBOB_SMOKE_REPORT_ROOT: reportRoot,
            AIRBOB_SMOKE_RESERVATION_UID: "guest-reservation-uid",
            GSTACK_BROWSE_BIN: fakeBrowsePath,
          }),
          maxBuffer: 10 * 1024 * 1024,
        },
      );
      const output = `${result.stdout}\n${result.stderr}`;

      expect(result.status).toBe(0);
      expect(output).toContain("Frontend smoke preflight passed.");
      expect(output).toContain(`Frontend reachable: ${frontendUrl}`);
      expect(output).toContain(`Backend reachable: ${backendUrl}`);
      expect(output).not.toContain("browse should not run");
      expect(output).not.toContain("fake-user@example.invalid");
      expect(output).not.toContain("fake-password");
      expect(fs.existsSync(reportRoot)).toBe(false);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("frontend smoke preflight strips backend URL credentials from reachability errors", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "airbob-preflight-"));
    const fakeBrowsePath = path.join(tempDir, "fake-browse.mjs");
    const reportRoot = path.join(tempDir, "reports");
    const frontendUrl = "http://frontend.invalid";
    const backendUrl = "http://backend-user:backend-secret@backend.invalid";
    const displayedBackendUrl = "http://backend.invalid";
    const fetchMockPath = writePreflightFetchMock(tempDir, {
      [frontendUrl]: { status: 204 },
      [backendUrl]: { error: true },
    });

    fs.writeFileSync(
      fakeBrowsePath,
      ["#!/usr/bin/env node", 'console.log("browse should not run");'].join("\n"),
      { mode: 0o755 },
    );

    try {
      const result = spawnSync(
        process.execPath,
        ["--require", fetchMockPath, frontendSmokePath, "--preflight"],
        {
          cwd: projectRoot,
          encoding: "utf8",
          env: isolatedSmokeSubprocessEnv({
            AIRBOB_API_BASE_URL: backendUrl,
            AIRBOB_FRONTEND_URL: frontendUrl,
            AIRBOB_QA_EMAIL: "fake-user@example.invalid",
            AIRBOB_QA_PASSWORD: "fake-password",
            AIRBOB_SMOKE_ACCOMMODATION_ID: "3",
            AIRBOB_SMOKE_EDIT_ACCOMMODATION_ID: "3",
            AIRBOB_SMOKE_HOST_RESERVATION_UID: "host-reservation-uid",
            AIRBOB_SMOKE_REPORT_ROOT: reportRoot,
            AIRBOB_SMOKE_RESERVATION_UID: "guest-reservation-uid",
            GSTACK_BROWSE_BIN: fakeBrowsePath,
          }),
          maxBuffer: 10 * 1024 * 1024,
        },
      );
      const output = `${result.stdout}\n${result.stderr}`;

      expect(result.status).toBe(1);
      expect(output).toContain("Frontend smoke preflight failed");
      expect(output).toContain(
        `Backend is not reachable at ${displayedBackendUrl}`,
      );
      expect(output).toContain(`fetch failed for ${displayedBackendUrl}`);
      expect(output).not.toContain("browse should not run");
      expect(output).not.toContain("backend-user");
      expect(output).not.toContain("backend-secret");
      expect(output).not.toContain("fake-user@example.invalid");
      expect(output).not.toContain("fake-password");
      expect(fs.existsSync(reportRoot)).toBe(false);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("frontend smoke writes reports under an override root during harness tests", () => {
    const tempReportRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), "airbob-smoke-report-"),
    );
    const defaultReportRoot = path.join(projectRoot, ".gstack", "qa-reports");
    const defaultReportEntriesBefore = readDirectoryEntries(defaultReportRoot);

    try {
      const result = spawnSync("node", [frontendSmokePath], {
        cwd: projectRoot,
        encoding: "utf8",
        env: isolatedSmokeSubprocessEnv({
          AIRBOB_FRONTEND_URL: "http://127.0.0.1:9",
          AIRBOB_QA_EMAIL: "fake-user@example.invalid",
          AIRBOB_QA_PASSWORD: "fake-password",
          AIRBOB_SMOKE_REPORT_ROOT: tempReportRoot,
          GSTACK_BROWSE_BIN: "node",
        }),
      });
      const defaultReportEntriesAfter = readDirectoryEntries(defaultReportRoot);
      const overrideReportEntries = fs.readdirSync(tempReportRoot);

      expect(result.status).not.toBe(0);
      expect(fs.existsSync(tempReportRoot)).toBe(true);
      expect(
        overrideReportEntries.some((entry) =>
          /^frontend-smoke-.+\.md$/.test(entry),
        ),
      ).toBe(true);
      expect(defaultReportEntriesAfter).toEqual(defaultReportEntriesBefore);
      expect(
        defaultReportEntriesBefore !== null || !fs.existsSync(defaultReportRoot),
      ).toBe(true);
    } finally {
      removeNewDirectoryEntries(defaultReportRoot, defaultReportEntriesBefore);
      fs.rmSync(tempReportRoot, { recursive: true, force: true });
    }
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
        '  console.log("fake-google-maps-key");',
        '  console.log("  fake-google-maps-key  ");',
        "  process.exit(0);",
        "});",
      ].join("\n"),
      { mode: 0o755 },
    );

    try {
      const result = spawnSync(process.execPath, [frontendSmokePath], {
        cwd: projectRoot,
        encoding: "utf8",
        env: isolatedSmokeSubprocessEnv({
          AIRBOB_QA_EMAIL: "fake-user@example.invalid",
          AIRBOB_QA_PASSWORD: "fake-password",
          GSTACK_BROWSE_BIN: fakeBrowsePath,
          AIRBOB_FRONTEND_URL: "http://localhost:3000",
          REACT_APP_GOOGLE_MAPS_API_KEY: "  fake-google-maps-key  ",
        }),
        maxBuffer: 10 * 1024 * 1024,
      });
      const output = `${result.stdout}\n${result.stderr}`;
      const reportPathMatch = output.match(/Smoke report written to (.+\.md)/);
      const reportPath = reportPathMatch
        ? toSmokeReportPath(reportPathMatch[1])
        : "";
      const report = reportPath ? fs.readFileSync(reportPath, "utf8") : "";

      if (reportPath) {
        fs.rmSync(reportPath, { force: true });
      }

      expect(result.status).toBe(1);
      expect(report).toContain("- Status: FAIL");
      expect(report).toContain("- Google Maps API key: present");
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
      expect(output).not.toContain("fake-google-maps-key");
      expect(report).not.toContain("fake-user@example.invalid");
      expect(report).not.toContain("fake-password");
      expect(report).not.toContain("fake-google-maps-key");
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
        env: isolatedSmokeSubprocessEnv({
          AIRBOB_QA_EMAIL: "fake-user@example.invalid",
          AIRBOB_QA_PASSWORD: "fake-password",
          GSTACK_BROWSE_BIN: fakeBrowsePath,
          AIRBOB_FRONTEND_URL: "http://localhost:3000",
          AIRBOB_SMOKE_STRICT_DYNAMIC_ROUTES: "true",
        }),
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
      "ES Search Fixture Gate",
      "AIRBOB_SMOKE_EXPECT_SEARCH_RESULTS",
      "Google Maps API key: present",
      "AIRBOB_API_BASE_URL",
      "AIRBOB_FRONTEND_URL",
      "AIRBOB_SMOKE_REPORT_ROOT",
      "GSTACK_BROWSE_BIN",
      "AIRBOB_QA_EMAIL",
      ': "' +
        "$" +
        "{AIRBOB_QA_PASSWORD:?Set AIRBOB_QA_PASSWORD in the shell before running smoke}" +
        '"',
      "AIRBOB_SMOKE_ACCOMMODATION_ID",
      "AIRBOB_SMOKE_RESERVATION_UID",
      "AIRBOB_SMOKE_HOST_RESERVATION_UID",
      "curl -fsS",
      "profile/guest/reservations?filterType=PAST&size=1",
      "profile/host/reservations?filterType=PAST&size=1",
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
      "Wishlist/Auth/Review",
      "dialog",
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
        expectedTerms: ["shared UI primitives", "route/screen/workflow owner"],
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
