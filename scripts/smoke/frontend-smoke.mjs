#!/usr/bin/env node

import { spawnSync } from "child_process";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";

const REQUIRED_ENV = [
  "AIRBOB_QA_EMAIL",
  "AIRBOB_QA_PASSWORD",
  "GSTACK_BROWSE_BIN",
];

const DEFAULT_FRONTEND_URL = "http://localhost:3000";
const REPORT_ROOT = join(".gstack", "qa-reports");
const SCREENSHOT_ROOT = join(REPORT_ROOT, "screenshots");

const missingEnv = REQUIRED_ENV.filter((name) => !process.env[name]);

if (missingEnv.length > 0) {
  console.error(
    `Missing required environment variables: ${missingEnv.join(", ")}`
  );
  console.error(
    "Set AIRBOB_QA_EMAIL, AIRBOB_QA_PASSWORD, and GSTACK_BROWSE_BIN before running smoke:frontend."
  );
  process.exit(1);
}

const qaEmail = process.env.AIRBOB_QA_EMAIL;
const qaPassword = process.env.AIRBOB_QA_PASSWORD;
const browseBin = process.env.GSTACK_BROWSE_BIN;
const frontendUrl = process.env.AIRBOB_FRONTEND_URL ?? DEFAULT_FRONTEND_URL;
const editAccommodationId =
  process.env.AIRBOB_SMOKE_EDIT_ACCOMMODATION_ID?.trim() || "3";
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const reportPath = join(REPORT_ROOT, `frontend-smoke-${timestamp}.md`);

const VIEWPORTS = [
  { name: "desktop", size: "1280x720" },
  { name: "mobile", size: "375x812" },
];

const ROUTES = [
  {
    name: "home",
    path: "/",
    selector: "#root",
    expectedText: "특별한 숙소",
  },
  {
    name: "search-seoul",
    path: "/search?destination=Seoul&checkIn=2026-07-10&checkOut=2026-07-12&adultOccupancy=1",
    selector: "main, #root",
    expectedText: "숙소",
  },
  {
    name: "wishlist",
    path: "/wishlist",
    selector: "main, #root",
    expectedText: "위시리스트",
  },
  {
    name: "wishlist-recently-viewed",
    path: "/wishlist?view=recently-viewed",
    selector: "main, #root",
    expectedText: "최근",
  },
  {
    name: "profile-host-listings",
    path: "/profile?mode=host&tab=listings",
    selector: "main, #root",
    expectedText: "호스트",
  },
  {
    name: "accommodation-edit",
    path: `/accommodations/${encodeURIComponent(editAccommodationId)}/edit`,
    selector: "main, #root",
    expectedText: "숙소",
  },
];

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const redactionEntries = [
  ["AIRBOB_QA_EMAIL", qaEmail],
  ["AIRBOB_QA_PASSWORD", qaPassword],
].flatMap(([name, value]) => {
  const variants = new Set([
    value,
    encodeURIComponent(value),
    JSON.stringify(value).slice(1, -1),
  ]);

  return Array.from(variants)
    .filter(Boolean)
    .map((variant) => ({
      pattern: new RegExp(escapeRegExp(variant), "g"),
      replacement: `[REDACTED_${name}]`,
    }));
});

const redact = (value) =>
  redactionEntries.reduce(
    (output, entry) => output.replace(entry.pattern, entry.replacement),
    String(value ?? "")
  );

const normalizeBaseUrl = (url) => {
  const parsed = new URL(url);
  parsed.pathname = parsed.pathname.replace(/\/+$/, "");
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString().replace(/\/+$/, "");
};

const baseUrl = normalizeBaseUrl(frontendUrl);
const toAbsoluteUrl = (routePath) => new URL(routePath, `${baseUrl}/`).toString();

const routeAssertion = ({ path, selector, expectedText }) => {
  const expected = new URL(path, `${baseUrl}/`);
  const expectedParams = Array.from(expected.searchParams.entries());

  return `(() => {
    const expectedPath = ${JSON.stringify(expected.pathname)};
    const expectedParams = ${JSON.stringify(expectedParams)};
    const selector = ${JSON.stringify(selector)};
    const expectedText = ${JSON.stringify(expectedText)};
    const timeoutMs = 9000;
    const pollMs = 150;
    const loadingOnlyPattern = /^(?:loading|loading\\.\\.\\.|로딩|로딩\\.\\.\\.|불러오는 중|불러오는중|잠시만 기다려주세요|\\.\\.\\.)$/i;
    const actualUrl = new URL(window.location.href);
    if (actualUrl.pathname !== expectedPath) {
      throw new Error(\`Expected path \${expectedPath}, got \${actualUrl.pathname}\`);
    }
    for (const [key, value] of expectedParams) {
      if (actualUrl.searchParams.get(key) !== value) {
        throw new Error(\`Expected query \${key}=\${value}, got \${actualUrl.searchParams.get(key)}\`);
      }
    }
    return new Promise((resolve, reject) => {
      const startedAt = Date.now();
      const poll = () => {
        const root = document.getElementById("root");
        const rootText = (root?.textContent || "").trim();
        const hasRenderedRootText = rootText.length > 0 && !loadingOnlyPattern.test(rootText);
        const target = document.querySelector(selector);
        const visibleText = target?.textContent || "";

        if (hasRenderedRootText && target && visibleText.includes(expectedText)) {
          resolve(\`loaded \${actualUrl.pathname}\${actualUrl.search} with \${expectedText}\`);
          return;
        }

        if (Date.now() - startedAt >= timeoutMs) {
          if (!root) {
            reject(new Error("React root was not found"));
            return;
          }
          if (!hasRenderedRootText) {
            reject(new Error("React root rendered no visible text beyond loading placeholder"));
            return;
          }
          if (!target) {
            reject(new Error(\`Expected selector \${selector} for route \${expectedPath}\`));
            return;
          }
          reject(new Error(\`Expected selector \${selector} to include text \${expectedText} for route \${expectedPath}\`));
          return;
        }

        setTimeout(poll, pollMs);
      };

      poll();
    });
  })()`.replace(/\s+/g, " ");
};

const loginExpression = `(() => fetch("/api/v1/auth/login", {
  method: "POST",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    email: ${JSON.stringify(qaEmail)},
    password: ${JSON.stringify(qaPassword)}
  })
}).then(async (response) => {
  if (!response.ok) {
    throw new Error(\`QA login failed with status \${response.status}\`);
  }
  return "QA login completed";
}))()`.replace(/\s+/g, " ");

const commands = [
  ["viewport", VIEWPORTS[0].size],
  ["goto", `${baseUrl}/`],
  ["wait", "--load"],
  ["js", loginExpression],
  ["wait", "--networkidle"],
  ["console", "--clear"],
  ["network", "--clear"],
];

const screenshotEntries = [];

for (const viewport of VIEWPORTS) {
  commands.push(["viewport", viewport.size]);

  for (const route of ROUTES) {
    const screenshotPath = join(
      SCREENSHOT_ROOT,
      `frontend-smoke-${timestamp}-${viewport.name}-${route.name}.png`
    );
    const url = toAbsoluteUrl(route.path);

    screenshotEntries.push({
      viewport: viewport.name,
      size: viewport.size,
      route: route.path,
      screenshotPath,
    });

    commands.push(
      ["console", "--clear"],
      ["network", "--clear"],
      ["goto", url],
      ["wait", "--load"],
      ["js", routeAssertion(route)],
      ["screenshot", screenshotPath],
      ["console", "--errors"],
      ["console", "--warnings"],
      ["network"]
    );
  }
}

mkdirSync(SCREENSHOT_ROOT, { recursive: true });

const childEnv = { ...process.env };
delete childEnv.AIRBOB_QA_EMAIL;
delete childEnv.AIRBOB_QA_PASSWORD;

const result = spawnSync(browseBin, ["chain"], {
  input: JSON.stringify(commands),
  encoding: "utf8",
  env: childEnv,
  maxBuffer: 50 * 1024 * 1024,
});

const redactedStdout = redact(result.stdout);
const redactedStderr = redact(result.stderr);
const status = typeof result.status === "number" ? result.status : 1;
const combinedOutput = `${redactedStdout}\n${redactedStderr}`;
const consoleFailurePattern =
  /(?:console\.[a-z]*?(?:error|warn)|type:\s*(?:error|warning)|level:\s*(?:error|warning)|\b(?:error|warning)\b[\s\S]{0,80}\bconsole\b|\bconsole\b[\s\S]{0,80}\b(?:error|warning)\b)/i;
const apiFailurePattern =
  /(?:(?:\/api\/[^\s"'`)]*|https?:\/\/[^\s"'`)]*\/api\/[^\s"'`)]*)[\s\S]{0,160}\b(?:status|statusCode|response|failed|error)?\s*[:=]?\s*(?:4\d\d|5\d\d)\b|\b(?:4\d\d|5\d\d)\b[\s\S]{0,160}(?:\/api\/[^\s"'`)]*|https?:\/\/[^\s"'`)]*\/api\/[^\s"'`)]*))/i;
const browseJsFailurePattern = /(?:\[js\]\s+ERROR:|ERROR:\s+evaluate:)/i;
const isEmptyConsoleSummary = (line) =>
  /\bconsole\b/i.test(line) &&
  /\b(?:error|warning)s?\b/i.test(line) &&
  /(?:\[\s*\]|\(\s*empty\s*\)|\bnone\b|\bno\s+(?:new\s+)?console\b|\b0\b)/i.test(
    line
  );
const hasConsoleFailure = combinedOutput
  .split(/\r?\n/)
  .some((line) => consoleFailurePattern.test(line) && !isEmptyConsoleSummary(line));
const smokeSignalFailure = [
  hasConsoleFailure && "console error/warning output",
  apiFailurePattern.test(combinedOutput) && "API 4xx/5xx network output",
  browseJsFailurePattern.test(combinedOutput) && "browse JS error output",
].filter(Boolean);
const failed =
  Boolean(result.error) || status !== 0 || smokeSignalFailure.length > 0;

if (redactedStdout) {
  process.stdout.write(redactedStdout);
  if (!redactedStdout.endsWith("\n")) {
    process.stdout.write("\n");
  }
}

if (redactedStderr) {
  process.stderr.write(redactedStderr);
  if (!redactedStderr.endsWith("\n")) {
    process.stderr.write("\n");
  }
}

if (result.error) {
  console.error(redact(result.error.message));
}

if (smokeSignalFailure.length > 0) {
  console.error(
    `Smoke failed because redacted browse output contained: ${smokeSignalFailure.join(
      ", "
    )}`
  );
}

const report = [
  "# Frontend Smoke Report",
  "",
  `- Status: ${failed ? "FAIL" : "PASS"}`,
  `- Generated: ${new Date().toISOString()}`,
  `- Frontend URL: ${baseUrl}`,
  `- Browse command: ${redact(browseBin)} chain`,
  `- Credential inputs: AIRBOB_QA_EMAIL and AIRBOB_QA_PASSWORD were supplied via environment variables and redacted from wrapper output.`,
  `- Edit accommodation id source: AIRBOB_SMOKE_EDIT_ACCOMMODATION_ID or fallback ${editAccommodationId}`,
  "",
  "## Route Coverage",
  "",
  ...screenshotEntries.map(
    (entry) =>
      `- ${entry.viewport} ${entry.size} ${entry.route} -> ${entry.screenshotPath}`
  ),
  "",
  "## Process Result",
  "",
  `- Exit status: ${status}`,
  `- Signal: ${result.signal ?? "none"}`,
  `- Spawn error: ${result.error ? redact(result.error.message) : "none"}`,
  `- Output guard failures: ${
    smokeSignalFailure.length > 0 ? smokeSignalFailure.join(", ") : "none"
  }`,
  "",
  "## Redacted Stdout",
  "",
  "```text",
  redactedStdout.trim() || "(empty)",
  "```",
  "",
  "## Redacted Stderr",
  "",
  "```text",
  redactedStderr.trim() || "(empty)",
  "```",
  "",
].join("\n");

writeFileSync(reportPath, report);
console.log(`Smoke report written to ${reportPath}`);

if (failed) {
  process.exit(status === 0 ? 1 : status);
}
