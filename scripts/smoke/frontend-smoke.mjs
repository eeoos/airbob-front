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
const REPORT_ROOT =
  process.env.AIRBOB_SMOKE_REPORT_ROOT?.trim() || join(".gstack", "qa-reports");
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
const strictDynamicRoutes = process.env.AIRBOB_SMOKE_STRICT_DYNAMIC_ROUTES === "true";
const rawGoogleMapsApiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
const googleMapsApiKey = rawGoogleMapsApiKey?.trim() ?? "";
const googleMapsApiKeyReady = Boolean(googleMapsApiKey);
const strictSearchResults =
  process.env.AIRBOB_SMOKE_EXPECT_SEARCH_RESULTS === "true";
const envValue = (name) => process.env[name]?.trim() || "";
const editAccommodationId =
  envValue("AIRBOB_SMOKE_EDIT_ACCOMMODATION_ID") || "3";
const accommodationId =
  envValue("AIRBOB_SMOKE_ACCOMMODATION_ID") || editAccommodationId;
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const reportPath = join(REPORT_ROOT, `frontend-smoke-${timestamp}.md`);

const VIEWPORTS = [
  { name: "desktop", size: "1280x720" },
  { name: "mobile", size: "375x812" },
];

const SEARCH_RESULT_CARD_SELECTORS = [
  "[data-testid='search-result-card']",
  "[data-testid='accommodation-card']",
  "article[aria-label*='숙소']",
];

const buildRoutePath = (pathTemplate, params) =>
  pathTemplate.replace(/:([A-Za-z0-9_]+)/g, (_, key) => {
    const value = params[key];

    if (value === undefined || value === null || String(value).trim() === "") {
      throw new Error(`Missing route param ${key} for ${pathTemplate}`);
    }

    return encodeURIComponent(String(value));
  });

const routeFromTemplate = ({ pathTemplate, params, ...route }) => ({
  ...route,
  pathTemplate,
  path: buildRoutePath(pathTemplate, params),
});

const skippedDynamicRoutes = [];

const dynamicRouteFromEnv = ({ envName, paramName, ...route }) => {
  const value = envValue(envName);

  if (!value) {
    skippedDynamicRoutes.push({
      name: route.name,
      pathTemplate: route.pathTemplate,
      envName,
    });
    return null;
  }

  return routeFromTemplate({
    ...route,
    params: {
      [paramName]: value,
    },
  });
};

const ROUTES = [
  {
    name: "home",
    path: "/",
    selector: "#root",
    expectedText: "특별한 숙소",
  },
  {
    name: "search",
    path: "/search?destination=Albany&checkIn=2026-07-10&checkOut=2026-07-12&adultOccupancy=1",
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
  routeFromTemplate({
    name: "accommodation-detail",
    pathTemplate: "/accommodations/:id",
    params: { id: accommodationId },
    selector: "main, #root",
    expectedText: "예약하기",
  }),
  {
    name: "accommodation-edit",
    path: buildRoutePath("/accommodations/:id/edit", {
      id: editAccommodationId,
    }),
    selector: "main, #root",
    expectedText: "숙소",
  },
  dynamicRouteFromEnv({
    name: "reservation-detail",
    pathTemplate: "/reservations/:reservationUid",
    envName: "AIRBOB_SMOKE_RESERVATION_UID",
    paramName: "reservationUid",
    selector: "main, #root",
    expectedText: "예약",
  }),
  dynamicRouteFromEnv({
    name: "host-reservation-detail",
    pathTemplate: "/profile/host/reservations/:reservationUid",
    envName: "AIRBOB_SMOKE_HOST_RESERVATION_UID",
    paramName: "reservationUid",
    selector: "main, #root",
    expectedText: "예약",
  }),
].filter(Boolean);

const KNOWN_ROUTE_NAMES = [
  "home",
  "search",
  "wishlist",
  "wishlist-recently-viewed",
  "profile-host-listings",
  "accommodation-detail",
  "accommodation-edit",
  "reservation-detail",
  "host-reservation-detail",
];

const registeredRouteNames = new Set([
  ...ROUTES.map((route) => route.name),
  ...skippedDynamicRoutes.map((route) => route.name),
]);
const missingKnownRouteNames = KNOWN_ROUTE_NAMES.filter(
  (name) => !registeredRouteNames.has(name)
);

if (missingKnownRouteNames.length > 0) {
  console.error(
    `Smoke route registry is missing known routes: ${missingKnownRouteNames.join(
      ", "
    )}`
  );
  process.exit(1);
}

const skippedDynamicRouteLines = skippedDynamicRoutes.map(
  ({ name, pathTemplate, envName }) =>
    `- ${name} (${pathTemplate}): skipped; set ${envName} to cover this route.`
);

if (strictDynamicRoutes && skippedDynamicRoutes.length > 0) {
  const missingDynamicEnvNames = skippedDynamicRoutes.map(({ envName }) => envName);

  console.error(
    `Strict dynamic route smoke mode requires stable route ids. Set ${missingDynamicEnvNames.join(
      ", "
    )} before running smoke:frontend:strict.`
  );
  skippedDynamicRoutes.forEach(({ name, pathTemplate, envName }) => {
    console.error(`- ${envName} is required for ${name} (${pathTemplate}).`);
  });
  process.exit(1);
}

if (skippedDynamicRoutes.length > 0) {
  console.warn(
    `Skipped dynamic smoke routes: ${skippedDynamicRoutes
      .map(({ name, envName }) => `${name} (set ${envName})`)
      .join(", ")}`
  );
}

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const redactionEntries = [
  ["AIRBOB_QA_EMAIL", qaEmail],
  ["AIRBOB_QA_PASSWORD", qaPassword],
  ["REACT_APP_GOOGLE_MAPS_API_KEY", rawGoogleMapsApiKey],
  ["REACT_APP_GOOGLE_MAPS_API_KEY", googleMapsApiKey],
].flatMap(([name, value]) => {
  if (!value) {
    return [];
  }

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

const routeInteractionAssertion = ({ name }) => {
  if (name === "search") {
    return `(() => {
      const strictSearchResults = ${JSON.stringify(strictSearchResults)};
      const resultCardSelectors = ${JSON.stringify(SEARCH_RESULT_CARD_SELECTORS)};
      const isVisible = (element) => {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== "none" &&
          style.visibility !== "hidden" &&
          rect.width > 0 &&
          rect.height > 0;
      };
      const labelFor = (button) => [
        button.getAttribute("aria-label"),
        button.getAttribute("title"),
        button.textContent
      ].filter(Boolean).join(" ").replace(/\\s+/g, " ").trim();
      const readState = () => {
        const labels = Array.from(document.querySelectorAll("button")).map(labelFor);
        const pageText = document.body.textContent || "";
        return {
          hasSearchButton: labels.some((label) => label.includes("검색")),
          hasSearchResultCard: resultCardSelectors.some((selector) =>
            Array.from(document.querySelectorAll(selector)).some(isVisible)
          ),
          hasWishlistAction: labels.some((label) =>
            label.includes("위시리스트에 저장") || label.includes("위시리스트에서 제거")
          ),
          hasSearchEmptyState: pageText.includes("검색 결과가 없습니다.")
        };
      };
      const missingFor = (state) => [
        !state.hasSearchButton && "search button",
        strictSearchResults && !state.hasSearchResultCard && "search result card",
        !strictSearchResults &&
          !state.hasSearchResultCard &&
          !state.hasWishlistAction &&
          !state.hasSearchEmptyState &&
          "wishlist/save action, result card, or empty state"
      ].filter(Boolean);
      const timeoutMs = 6000;
      const pollMs = 150;

      return new Promise((resolve, reject) => {
        const startedAt = Date.now();
        const poll = () => {
          const state = readState();
          const missing = missingFor(state);

          if (missing.length === 0) {
            resolve(state.hasSearchResultCard
              ? "search route result card is visible"
              : state.hasWishlistAction
              ? "search route interaction controls are present"
              : "search route empty state is present");
            return;
          }

          if (Date.now() - startedAt >= timeoutMs) {
            if (strictSearchResults && !state.hasSearchResultCard) {
              reject(new Error("Search result fixture was required but no result card was visible"));
              return;
            }

            reject(new Error(\`Search route interaction assertion failed: missing \${missing.join(", ")}\`));
            return;
          }

          setTimeout(poll, pollMs);
        };

        poll();
      });
    })()`.replace(/\s+/g, " ");
  }

  if (name === "accommodation-detail") {
    return `(() => {
      const labelFor = (button) => [
        button.getAttribute("aria-label"),
        button.getAttribute("title"),
        button.textContent
      ].filter(Boolean).join(" ").replace(/\\s+/g, " ").trim();
      const readState = () => {
        const labels = Array.from(document.querySelectorAll("button")).map(labelFor);
        return {
          hasReservationCta: labels.some((label) =>
            label.includes("예약하기") || label.includes("예약 중")
          ),
          hasGalleryTrigger: labels.some((label) =>
            label.includes("사진") && (label.includes("보기") || label.includes("갤러리"))
          )
        };
      };
      const missingFor = (state) => [
        !state.hasReservationCta && "reservation CTA",
        !state.hasGalleryTrigger && "gallery trigger buttons"
      ].filter(Boolean);
      const timeoutMs = 6000;
      const pollMs = 150;

      return new Promise((resolve, reject) => {
        const startedAt = Date.now();
        const poll = () => {
          const state = readState();
          const missing = missingFor(state);

          if (missing.length === 0) {
            resolve("accommodation detail interaction controls are present");
            return;
          }

          if (Date.now() - startedAt >= timeoutMs) {
            reject(new Error(\`Accommodation detail interaction assertion failed: missing \${missing.join(", ")}\`));
            return;
          }

          setTimeout(poll, pollMs);
        };

        poll();
      });
    })()`.replace(/\s+/g, " ");
  }

  return null;
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
      routeName: route.name,
      route: route.path,
      screenshotPath,
    });

    commands.push(
      ["console", "--clear"],
      ["network", "--clear"],
      ["goto", url],
      ["wait", "--load"],
      ["js", routeAssertion(route)]
    );

    const interactionAssertion = routeInteractionAssertion(route);
    if (interactionAssertion) {
      commands.push(["js", interactionAssertion]);
    }

    commands.push(
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
  `- Google Maps API key: ${googleMapsApiKeyReady ? "present" : "missing"}`,
  `- Edit accommodation id source: AIRBOB_SMOKE_EDIT_ACCOMMODATION_ID or fallback ${editAccommodationId}`,
  `- Accommodation detail id source: AIRBOB_SMOKE_ACCOMMODATION_ID or edit-id fallback ${accommodationId}`,
  `- Search result fixture gate: ${
    strictSearchResults
      ? "required via AIRBOB_SMOKE_EXPECT_SEARCH_RESULTS=true"
      : "optional; empty state is accepted until ES data is seeded"
  }.`,
  "- Search route fixture: Albany query; records visible result card state when present, otherwise validates the explicit empty state.",
  "",
  "## Route Coverage",
  "",
  ...screenshotEntries.map(
    (entry) =>
      `- ${entry.viewport} ${entry.size} ${entry.routeName} ${entry.route} -> ${entry.screenshotPath}`
  ),
  "",
  "## Skipped Dynamic Routes",
  "",
  ...(skippedDynamicRouteLines.length > 0
    ? skippedDynamicRouteLines
    : ["- none"]),
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
