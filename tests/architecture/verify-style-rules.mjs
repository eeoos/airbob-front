import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import stylelint from "stylelint";

const require = createRequire(import.meta.url);
const { protectedDesignLiteralStylePaths, strictStyleGlobs } = require(
  "../../scripts/architecture/style-policy.cjs",
);
const architectureDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(architectureDirectory, "../..");
const configFile = path.join(projectRoot, "stylelint.config.mjs");
const { createStylelintConfig, default: styleConfig } = await import(
  pathToFileURL(configFile)
);

const lint = async (relativePath, code) => {
  const result = await stylelint.lint({
    code,
    codeFilename: path.join(projectRoot, relativePath),
    configFile,
  });

  return result.results.flatMap((fileResult) => fileResult.warnings);
};

const assertError = async ({ name, path: relativePath, code, rule }) => {
  const warnings = await lint(relativePath, code);
  const matchingError = warnings.some(
    (warning) => warning.rule === rule && warning.severity === "error",
  );

  if (!matchingError) {
    throw new Error(
      `${name} did not trigger ${rule} as an error. Received: ${warnings
        .map((warning) => `${warning.rule}:${warning.severity}`)
        .join(", ")}`,
    );
  }
};

const strictFixturePath = (name) =>
  `src/shared/__architecture__/${name}.module.css`;

const invalidCases = [
  {
    name: "standard rule violation",
    path: strictFixturePath("standard-rule"),
    code: ".fixture {}",
    rule: "block-no-empty",
  },
  {
    name: "raw color",
    path: strictFixturePath("raw-color"),
    code: ".fixture { color: #fff; }",
    rule: "color-no-hex",
  },
  {
    name: "raw radius",
    path: strictFixturePath("raw-radius"),
    code: ".fixture { border-radius: 8px; }",
    rule: "airbob/no-raw-border-radius",
  },
  {
    name: "raw shadow",
    path: strictFixturePath("raw-shadow"),
    code: ".fixture { box-shadow: 0 2px 8px rgb(0 0 0 / 15%); }",
    rule: "airbob/no-raw-box-shadow",
  },
  {
    name: "semantic raw color token",
    path: "src/shared/styles/tokens/semantic.css",
    code: ":root { --color-text-primary: #fff; }",
    rule: "airbob/token-layer-contract",
  },
  {
    name: "component raw shadow token",
    path: "src/shared/styles/tokens/components.css",
    code: ":root { --shadow-control: 0 2px 8px var(--palette-black-a15); }",
    rule: "airbob/token-layer-contract",
  },
  {
    name: "primitive backward token reference",
    path: "src/shared/styles/tokens/primitive.css",
    code: ":root { --palette-neutral-0: var(--color-text-primary); }",
    rule: "airbob/token-layer-contract",
  },
  {
    name: "semantic backward token reference",
    path: "src/shared/styles/tokens/semantic.css",
    code: ":root { --color-text-primary: var(--control-height-sm); }",
    rule: "airbob/token-layer-contract",
  },
  {
    name: "same-layer forward token reference",
    path: "src/shared/styles/tokens/primitive.css",
    code: ":root { --palette-neutral-1000: var(--palette-neutral-950); --palette-neutral-950: #222; }",
    rule: "airbob/token-layer-contract",
  },
  {
    name: "unknown canonical token reference",
    path: "src/shared/styles/tokens/semantic.css",
    code: ":root { --color-text-primary: var(--palette-does-not-exist); }",
    rule: "airbob/token-layer-contract",
  },
  {
    name: "semantic color swapped into primitive owner",
    path: "src/shared/styles/tokens/primitive.css",
    code: ":root { --color-text-primary: #222; }",
    rule: "airbob/token-layer-contract",
  },
  {
    name: "semantic color swapped into component owner",
    path: "src/shared/styles/tokens/components.css",
    code: ":root { --color-text-primary: var(--palette-neutral-950); }",
    rule: "airbob/token-layer-contract",
  },
  {
    name: "component layout swapped into primitive owner",
    path: "src/shared/styles/tokens/primitive.css",
    code: ":root { --layout-page-max-width: 1120px; }",
    rule: "airbob/token-layer-contract",
  },
  {
    name: "component layout swapped into semantic owner",
    path: "src/shared/styles/tokens/semantic.css",
    code: ":root { --layout-page-max-width: var(--size-px-1120); }",
    rule: "airbob/token-layer-contract",
  },
  {
    name: "raw breakpoint",
    path: "src/features/legacy/RawBreakpoint.module.css",
    code: "@media (max-width: 900px) { .fixture { display: block; } }",
    rule: "airbob/media-breakpoint-scale",
  },
  {
    name: "pre-existing protected design literal",
    path: "src/shared/ui/DatePicker/DatePicker.module.css",
    code: ".fixture { color: #222222; }",
    rule: "airbob/no-protected-design-literal",
  },
  {
    name: "pre-existing protected circular radius",
    path: "src/shared/ui/DatePicker/DatePicker.module.css",
    code: ".fixture { border-radius: 50%; }",
    rule: "airbob/no-protected-design-literal",
  },
  {
    name: "unknown custom property",
    path: strictFixturePath("unknown-property"),
    code: ".fixture { color: var(--color-does-not-exist); }",
    rule: "airbob/no-unknown-design-reference",
  },
  {
    name: "unknown custom media",
    path: strictFixturePath("unknown-media"),
    code: "@media (--viewport-does-not-exist) { .fixture { display: block; } }",
    rule: "airbob/no-unknown-design-reference",
  },
  {
    name: "local custom radius alias",
    path: strictFixturePath("local-radius-alias"),
    code: ".fixture { --local-shape: 8px; border-radius: var(--local-shape); }",
    rule: "airbob/no-unknown-design-reference",
  },
  {
    name: "local custom shadow alias",
    path: strictFixturePath("local-shadow-alias"),
    code: ".fixture { --local-elevation: 0 2px 8px var(--color-text-primary); box-shadow: var(--local-elevation); }",
    rule: "airbob/no-unknown-design-reference",
  },
  {
    name: "local custom aspect-ratio alias",
    path: "src/shared/ui/DatePicker/DatePicker.module.css",
    code: ".fixture { --local-ratio: 1 / 1; aspect-ratio: var(--local-ratio); }",
    rule: "airbob/no-unknown-design-reference",
  },
  {
    name: "protected aspect-ratio fallback",
    path: "src/shared/ui/DatePicker/DatePicker.module.css",
    code: ".fixture { aspect-ratio: var(--card-media-ratio, 1 / 1); }",
    rule: "airbob/no-protected-design-literal",
  },
  {
    name: "local custom media alias",
    path: strictFixturePath("local-media-alias"),
    code: "@custom-media --local-wide (max-width: 900px); @media (--local-wide) { .fixture { display: block; } }",
    rule: "airbob/media-breakpoint-scale",
  },
  {
    name: "on-scale local custom media owner",
    path: strictFixturePath("local-media-owner"),
    code: "@custom-media --local-tablet (max-width: 768px); @media (--local-tablet) { .fixture { display: block; } }",
    rule: "airbob/no-unknown-design-reference",
  },
  {
    name: "non-canonical custom property name",
    path: strictFixturePath("non-canonical-custom-property"),
    code: ".fixture { --local_shape: 8px; border-radius: var(--local_shape); }",
    rule: "custom-property-pattern",
  },
  {
    name: "important override",
    path: strictFixturePath("important"),
    code: ".fixture { color: var(--color-text-primary) !important; }",
    rule: "declaration-no-important",
  },
  {
    name: "descriptionless disable",
    path: strictFixturePath("descriptionless-disable"),
    code: `
      /* stylelint-disable color-no-hex */
      .fixture { color: #fff; }
      /* stylelint-enable color-no-hex */
    `,
    rule: "--report-descriptionless-disables",
  },
  {
    name: "unscoped disable",
    path: strictFixturePath("unscoped-disable"),
    code: `
      /* stylelint-disable -- architecture fixture */
      .fixture { color: #fff; }
      /* stylelint-enable */
    `,
    rule: "--report-unscoped-disables",
  },
  {
    name: "non-vendor described disable",
    path: strictFixturePath("described-disable"),
    code: `
      /* stylelint-disable color-no-hex -- architecture fixture */
      .fixture { color: #fff; }
      /* stylelint-enable color-no-hex */
    `,
    rule: "reportDisables",
  },
  {
    name: "legacy breakpoint described disable",
    path: "src/features/legacy/HiddenBreakpoint.module.css",
    code: `
      /* stylelint-disable airbob/media-breakpoint-scale -- architecture fixture */
      @media (max-width: 900px) { .fixture { display: block; } }
      /* stylelint-enable airbob/media-breakpoint-scale */
    `,
    rule: "reportDisables",
  },
  {
    name: "invalid disable scope",
    path: strictFixturePath("invalid-scope-disable"),
    code: `
      /* stylelint-disable airbob/not-a-rule -- architecture fixture */
      .fixture { color: var(--color-text-primary); }
      /* stylelint-enable airbob/not-a-rule */
    `,
    rule: "--report-invalid-scope-disables",
  },
  {
    name: "needless disable",
    path: strictFixturePath("needless-disable"),
    code: `
      /* stylelint-disable color-no-hex -- architecture fixture */
      .fixture { color: var(--color-text-primary); }
      /* stylelint-enable color-no-hex */
    `,
    rule: "--report-needless-disables",
  },
  {
    name: "vendor raw-color disable",
    path: "src/platform/integrations/maps/RawColor.vendor.css",
    code: `
      /* stylelint-disable color-no-hex -- vendor does not own product colors */
      .vendorChrome { color: #fff; }
      /* stylelint-enable color-no-hex */
    `,
    rule: "reportDisables",
  },
  {
    name: "vendor file-wide important disable",
    path: "src/platform/integrations/maps/FileWide.vendor.css",
    code: `
      /* stylelint-disable declaration-no-important -- too broad */
      .vendorChrome { z-index: var(--z-local-raised) !important; }
      /* stylelint-enable declaration-no-important */
    `,
    rule: "airbob/vendor-important-disable-scope",
  },
  {
    name: "vendor multiline important disable",
    path: "src/platform/integrations/maps/Multiline.vendor.css",
    code: `
      /* stylelint-disable
       declaration-no-important -- still too broad */
      .vendorChrome { z-index: var(--z-local-raised) !important; }
      /* stylelint-enable declaration-no-important */
    `,
    rule: "airbob/vendor-important-disable-scope",
  },
  {
    name: "vendor one-line multi-declaration disable",
    path: "src/platform/integrations/maps/MultiDeclaration.vendor.css",
    code: `
      .vendorChrome {
        /* stylelint-disable-next-line declaration-no-important -- vendor line still owns too much. */
        z-index: var(--z-local-raised) !important; color: var(--color-text-primary) !important;
      }
    `,
    rule: "airbob/vendor-important-disable-scope",
  },
];

for (const invalidCase of invalidCases) {
  await assertError(invalidCase);
}

const strictOverride = styleConfig.overrides.find(
  ({ name }) => name === "migrated target styles are strict",
);
if (!strictOverride) {
  throw new Error("Strict Stylelint override is missing.");
}

for (const [ruleName, setting] of Object.entries(styleConfig.rules)) {
  if (setting === null) {
    continue;
  }

  if (!Array.isArray(setting) || setting[1]?.reportDisables !== true) {
    throw new Error(`Stylelint rule ${ruleName} may not allow hidden debt.`);
  }
}

for (const [ruleName, setting] of Object.entries(strictOverride.rules)) {
  if (setting === null) {
    continue;
  }

  if (
    !Array.isArray(setting) ||
    setting[1]?.severity !== "error" ||
    setting[1]?.reportDisables !== true
  ) {
    throw new Error(
      `Strict Stylelint rule ${ruleName} must be error-level and non-disableable.`,
    );
  }
}

for (const reportName of [
  "reportDescriptionlessDisables",
  "reportInvalidScopeDisables",
  "reportNeedlessDisables",
  "reportUnscopedDisables",
]) {
  const setting = strictOverride[reportName];

  if (
    !Array.isArray(setting) ||
    setting[0] !== true ||
    setting[1]?.severity !== "error"
  ) {
    throw new Error(`${reportName} must be error-level in strict styles.`);
  }

  const rootSetting = styleConfig[reportName];
  if (
    !Array.isArray(rootSetting) ||
    rootSetting[0] !== true ||
    rootSetting[1]?.severity !== "error"
  ) {
    throw new Error(`${reportName} must be error-level globally.`);
  }
}

const vendorOverride = styleConfig.overrides.find(
  ({ name }) => name === "documented vendor important overrides",
);
const vendorRuleEntries = Object.entries(vendorOverride?.rules ?? {});
if (
  vendorRuleEntries.length !== 1 ||
  vendorRuleEntries[0][0] !== "declaration-no-important" ||
  vendorRuleEntries[0][1]?.[1]?.reportDisables !== false
) {
  throw new Error(
    "The documented vendor important rule must be the only disable exception.",
  );
}

const validWarnings = await lint(
  strictFixturePath("valid-token"),
  `.fixture {
    --component-radius: var(--radius-md);
    --component-shadow: var(--shadow-md), var(--focus-ring);

    border-radius: var(--component-radius);
    box-shadow: var(--component-shadow);
    color: var(--color-text-primary);
    padding: var(--space-2);
  }

  @media (max-width: 768px) {
    .fixture { display: block; }
  }`,
);
if (validWarnings.some((warning) => warning.severity === "error")) {
  throw new Error(
    `Valid target tokens failed: ${validWarnings
      .map((warning) => warning.text)
      .join(", ")}`,
  );
}

const vendorWarnings = await lint(
  "src/platform/integrations/maps/InfoWindow.vendor.css",
  `
    .vendorChrome {
      /* stylelint-disable-next-line declaration-no-important -- Google Maps owns the inline InfoWindow chrome. */
      z-index: var(--z-local-raised) !important;
    }
  `,
);
if (vendorWarnings.some((warning) => warning.severity === "error")) {
  throw new Error(
    `Documented vendor override failed: ${vendorWarnings
      .map((warning) => warning.text)
      .join(", ")}`,
  );
}

const canonicalTokenWarnings = await lint(
  "src/shared/styles/tokens/primitive.css",
  `:root {
    --palette-neutral-0: #fff;
    --elevation-2: 0 2px 8px rgb(0 0 0 / 15%);
  }`,
);
if (canonicalTokenWarnings.some((warning) => warning.severity === "error")) {
  throw new Error(
    `Primitive token values were reported as consumer debt: ${canonicalTokenWarnings
      .map((warning) => warning.text)
      .join(", ")}`,
  );
}

const legacyWarnings = await lint(
  "src/features/legacy/Legacy.module.css",
  ".legacy { border-radius: 8px; color: #fff !important; }",
);
if (
  legacyWarnings.some((warning) => warning.severity === "error") ||
  !legacyWarnings.some((warning) => warning.severity === "warning")
) {
  throw new Error("Legacy style debt is not operating as a warning ratchet.");
}

const temporaryProjectRoot = fs.mkdtempSync(
  path.join(os.tmpdir(), "airbob-style-policy-"),
);

try {
  const searchRoot = path.join(
    temporaryProjectRoot,
    "src/features/search",
  );
  const legacyRoot = path.join(
    temporaryProjectRoot,
    "src/features/legacy",
  );
  const accommodationsRoot = path.join(
    temporaryProjectRoot,
    "src/features/accommodations",
  );
  const editorRoot = path.join(accommodationsRoot, "edit");
  fs.mkdirSync(searchRoot, { recursive: true });
  fs.mkdirSync(legacyRoot, { recursive: true });
  fs.mkdirSync(editorRoot, { recursive: true });
  fs.writeFileSync(
    path.join(temporaryProjectRoot, "architecture-ratchet.json"),
    `${JSON.stringify({ migratedFeatures: ["accommodations", "search"] }, null, 2)}\n`,
  );
  fs.writeFileSync(
    path.join(searchRoot, "SearchRoute.tsx"),
    "export const SearchRoute = () => null;\n",
  );
  fs.writeFileSync(
    path.join(legacyRoot, "LegacyRoute.tsx"),
    "export const LegacyRoute = () => null;\n",
  );
  fs.writeFileSync(
    path.join(accommodationsRoot, "AccommodationRoute.tsx"),
    "export const AccommodationRoute = () => null;\n",
  );
  fs.writeFileSync(
    path.join(editorRoot, "EditRoute.tsx"),
    "export const EditRoute = () => null;\n",
  );
  const searchStylePath = path.join(searchRoot, "SearchRoute.module.css");
  const legacyStylePath = path.join(legacyRoot, "LegacyRoute.module.css");
  const accommodationsStylePath = path.join(
    accommodationsRoot,
    "AccommodationRoute.module.css",
  );
  const editorStylePath = path.join(editorRoot, "EditRoute.module.css");
  fs.writeFileSync(searchStylePath, ".search { color: #fff; }\n");
  fs.writeFileSync(legacyStylePath, ".legacy { color: #fff; }\n");
  fs.writeFileSync(
    accommodationsStylePath,
    ".accommodation { color: #fff; }\n",
  );
  fs.writeFileSync(editorStylePath, ".edit { color: #fff; }\n");

  const temporaryStyleConfig = createStylelintConfig({
    projectRoot: temporaryProjectRoot,
  });
  const temporaryResult = await stylelint.lint({
    config: temporaryStyleConfig,
    configBasedir: projectRoot,
    files: [
      searchStylePath,
      legacyStylePath,
      accommodationsStylePath,
      editorStylePath,
    ],
  });
  const warningsFor = (filePath) =>
    temporaryResult.results
      .find(({ source }) => source === filePath)
      ?.warnings.filter(({ rule }) => rule === "color-no-hex") ?? [];
  const migratedWarnings = warningsFor(searchStylePath);
  const unmigratedWarnings = warningsFor(legacyStylePath);
  const parentWarnings = warningsFor(accommodationsStylePath);
  const editorWarnings = warningsFor(editorStylePath);

  if (
    !migratedWarnings.some(({ severity }) => severity === "error") ||
    !parentWarnings.some(({ severity }) => severity === "error")
  ) {
    throw new Error("Registered feature CSS did not become strict.");
  }

  if (
    unmigratedWarnings.some(({ severity }) => severity === "error") ||
    !unmigratedWarnings.some(({ severity }) => severity === "warning")
  ) {
    throw new Error("Unregistered feature CSS did not remain warning-only.");
  }
  if (
    editorWarnings.some(({ severity }) => severity === "error") ||
    !editorWarnings.some(({ severity }) => severity === "warning")
  ) {
    throw new Error("Parent feature promotion swallowed its nested editor scope.");
  }
} finally {
  fs.rmSync(temporaryProjectRoot, { force: true, recursive: true });
}

const strictSourceResult = await stylelint.lint({
  allowEmptyInput: true,
  configFile,
  cwd: projectRoot,
  files: [...strictStyleGlobs, ...protectedDesignLiteralStylePaths],
});
const strictSourceErrors = strictSourceResult.results.flatMap((fileResult) =>
  fileResult.warnings.filter((warning) => warning.severity === "error"),
);
if (strictSourceErrors.length > 0) {
  throw new Error(
    `Current strict CSS has errors: ${strictSourceErrors
      .map((warning) => warning.text)
      .join(", ")}`,
  );
}

process.stdout.write(
  `Style architecture fixtures passed (${invalidCases.length + 8} scenarios).\n`,
);
