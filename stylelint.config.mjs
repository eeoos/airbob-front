import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import recommendedConfig from "stylelint-config-recommended";
import standardConfig from "stylelint-config-standard";
import { createDesignContractPlugins } from "./tests/architecture/support/stylelint-design-contract.mjs";

const require = createRequire(import.meta.url);
const {
  createStylePolicy,
} = require("./scripts/architecture/style-policy.cjs");
const defaultProjectRoot = path.dirname(fileURLToPath(import.meta.url));

const disallowedColorFunctions = [
  "/^(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color)$/i",
];
const projectRules = {
  "airbob/media-breakpoint-scale": [
    true,
    { reportDisables: true, severity: "error" },
  ],
  "airbob/no-protected-design-literal": true,
  "airbob/no-raw-border-radius": true,
  "airbob/no-raw-box-shadow": true,
  "airbob/token-layer-contract": true,
  "airbob/no-unknown-design-reference": true,
  "airbob/vendor-important-disable-scope": [
    true,
    { reportDisables: true, severity: "error" },
  ],
  "color-no-hex": true,
  "color-named": "never",
  "custom-media-pattern": "^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$",
  "custom-property-pattern": "^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$",
  "declaration-no-important": true,
  "function-disallowed-list": [disallowedColorFunctions, {}],
  "keyframes-name-pattern": "^[a-z][a-zA-Z0-9]*(?:-[a-zA-Z0-9]+)*$",
  "media-feature-range-notation": null,
  // CSS Modules state selectors make source-order specificity reports noisy.
  "no-descending-specificity": null,
  "property-no-unknown": [true, { ignoreProperties: ["composes"] }],
  "selector-class-pattern":
    "^[a-z][a-zA-Z0-9]*(?:-[a-zA-Z0-9]+)*$",
  "selector-pseudo-class-no-unknown": [
    true,
    { ignorePseudoClasses: ["global"] },
  ],
  // Existing component geometry deliberately uses four-value corner notation.
  "shorthand-property-no-redundant-values": null,
};

const controlledRuleSetting = (setting, severity) => {
  if (setting === null || setting === undefined) {
    return setting;
  }

  if (Array.isArray(setting)) {
    const [primary, secondary = {}] = setting;

    return [
      primary,
      {
        ...secondary,
        reportDisables: true,
        severity: secondary.severity ?? severity,
      },
    ];
  }

  return [setting, { reportDisables: true, severity }];
};

const activeRules = {
  ...recommendedConfig.rules,
  ...standardConfig.rules,
  ...projectRules,
};
const warningRules = Object.fromEntries(
  Object.entries(activeRules).map(([ruleName, setting]) => [
    ruleName,
    controlledRuleSetting(setting, "warning"),
  ]),
);
const strictRules = Object.fromEntries(
  Object.entries(activeRules).map(([ruleName, setting]) => [
    ruleName,
    controlledRuleSetting(setting, "error"),
  ]),
);

const errorDisableReports = [true, { severity: "error" }];

const absoluteStyleGlob = (projectRoot, styleGlob) => {
  const isNegated = styleGlob.startsWith("!");
  const relativeGlob = isNegated ? styleGlob.slice(1) : styleGlob;
  const absoluteGlob = path.resolve(projectRoot, relativeGlob).replaceAll("\\", "/");

  return isNegated ? `!${absoluteGlob}` : absoluteGlob;
};

export const createStylelintConfig = ({
  projectRoot = defaultProjectRoot,
} = {}) => {
  const {
    canonicalTokenStylePaths,
    primitiveTokenStylePaths,
    protectedDesignLiteralStylePaths,
    strictStyleGlobs,
    vendorImportantOverrideGlobs,
  } = createStylePolicy({ projectRoot });
  const absoluteGlobs = (styleGlobs) =>
    styleGlobs.map((styleGlob) => absoluteStyleGlob(projectRoot, styleGlob));

  return {
    extends: ["stylelint-config-standard"],
    defaultSeverity: "warning",
    plugins: createDesignContractPlugins({ projectRoot }),
    reportDescriptionlessDisables: errorDisableReports,
    reportInvalidScopeDisables: errorDisableReports,
    reportNeedlessDisables: errorDisableReports,
    reportUnscopedDisables: errorDisableReports,
    rules: warningRules,
    overrides: [
      {
        name: "migrated target styles are strict",
        files: absoluteGlobs(strictStyleGlobs),
        defaultSeverity: "error",
        reportDescriptionlessDisables: errorDisableReports,
        reportInvalidScopeDisables: errorDisableReports,
        reportNeedlessDisables: errorDisableReports,
        reportUnscopedDisables: errorDisableReports,
        rules: strictRules,
      },
      {
        name: "pre-existing design literal protection",
        files: absoluteGlobs(protectedDesignLiteralStylePaths),
        rules: {
          "airbob/no-protected-design-literal": [
            true,
            { reportDisables: true, severity: "error" },
          ],
          "airbob/no-unknown-design-reference": [
            true,
            { reportDisables: true, severity: "error" },
          ],
        },
      },
      {
        name: "canonical token declarations own design references",
        files: absoluteGlobs(canonicalTokenStylePaths),
        rules: {
          "airbob/no-protected-design-literal": null,
          "airbob/no-unknown-design-reference": null,
        },
      },
      {
        name: "primitive tokens alone own raw design values",
        files: absoluteGlobs(primitiveTokenStylePaths),
        rules: {
          "color-no-hex": null,
          "color-named": null,
          "function-disallowed-list": null,
        },
      },
      {
        name: "documented vendor important overrides",
        files: absoluteGlobs(vendorImportantOverrideGlobs),
        rules: {
          "declaration-no-important": [
            true,
            { reportDisables: false, severity: "error" },
          ],
        },
      },
    ],
  };
};

export default createStylelintConfig();
