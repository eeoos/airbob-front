import js from "@eslint/js";
import vitest from "@vitest/eslint-plugin";
import { defineConfig, globalIgnores } from "eslint/config";
import importPlugin from "eslint-plugin-import";
import jestDom from "eslint-plugin-jest-dom";
import jsxA11y from "eslint-plugin-jsx-a11y";
import playwright from "eslint-plugin-playwright";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import testingLibrary from "eslint-plugin-testing-library";
import globals from "globals";
import tseslint from "typescript-eslint";

const sourceFiles = ["src/**/*.{js,jsx,mjs,ts,tsx}"];
const sourceTypeScriptFiles = ["src/**/*.{ts,tsx}"];
const sourceReactFiles = ["src/**/*.{js,jsx,mjs,tsx}"];
const testFiles = [
  "src/test/**/*.{js,jsx,mjs,ts,tsx}",
  "src/**/__tests__/**/*.{js,jsx,mjs,ts,tsx}",
  "src/**/__mocks__/**/*.{js,jsx,mjs,ts,tsx}",
  "src/**/*.{test,spec}.{js,jsx,mjs,ts,tsx}",
];
const e2eTypeScriptFiles = ["playwright.config.ts", "tests/e2e/**/*.ts"];
const nodeEsmFiles = [
  "eslint.config.mjs",
  "stylelint.config.mjs",
  "scripts/**/*.{mjs,js}",
  "tests/architecture/**/*.mjs",
  "tests/e2e/support/**/*.mjs",
];
const nodeCommonJsFiles = [".dependency-cruiser.cjs", "**/*.cjs"];
const toolingTypeScriptFiles = ["vite.config.ts", "vitest.config.ts"];

const computedBrowserCapabilityRestriction = {
  selector:
    "MemberExpression[object.name='window'][computed=true], MemberExpression[object.name='globalThis'][computed=true], MemberExpression[object.name='self'][computed=true], MemberExpression[object.name='globalThis'][property.name='window'], VariableDeclarator[init.name='window'], VariableDeclarator[init.name='globalThis'], VariableDeclarator[init.name='self'], AssignmentPattern[right.name='window'], AssignmentPattern[right.name='globalThis'], AssignmentPattern[right.name='self'], AssignmentExpression[right.name='window'], AssignmentExpression[right.name='globalThis'], AssignmentExpression[right.name='self'], CallExpression[callee.object.name='Reflect'][callee.property.name='get'][arguments.0.name='window'], CallExpression[callee.object.name='Reflect'][callee.property.name='get'][arguments.0.name='globalThis'], CallExpression[callee.object.name='Reflect'][callee.property.name='get'][arguments.0.name='self'], CallExpression[callee.object.name='Reflect'][callee.property.name='get'][arguments.1.value='createElement'], CallExpression[callee.object.name='document'][callee.property.name='createElement'][arguments.0.type!='Literal'], CallExpression[callee.object.name='document'][callee.property.value='createElement'][arguments.0.type!='Literal'], ObjectPattern > Property[key.name='createElement'], ObjectPattern > Property[key.value='createElement'], VariableDeclarator[init.name='document'], AssignmentExpression[right.name='document']",
  message:
    "Computed or aliased browser capability access is forbidden; use a static owning platform adapter.",
};

const browserStorageRestriction = {
  selector:
    "Identifier[name='sessionStorage'], Identifier[name='localStorage'], MemberExpression[property.value='sessionStorage'], MemberExpression[property.value='localStorage'], ObjectPattern > Property[key.value='sessionStorage'], ObjectPattern > Property[key.value='localStorage'], CallExpression[callee.object.name='Reflect'][callee.property.name='get'][arguments.1.value='sessionStorage'], CallExpression[callee.object.name='Reflect'][callee.property.name='get'][arguments.1.value='localStorage']",
  message:
    "Direct browser storage access belongs only in src/platform/storage.",
};

const externalSdkGlobalRestriction = {
  selector:
    "MemberExpression[property.name='google'], MemberExpression[property.value='google'], MemberExpression[property.name='daum'], MemberExpression[property.value='daum'], MemberExpression[property.name='TossPayments'], MemberExpression[property.value='TossPayments'], MemberExpression[object.name='google'][property.name='maps'], MemberExpression[object.name='google'][property.value='maps'], ObjectPattern > Property[key.name='google'], ObjectPattern > Property[key.value='google'], ObjectPattern > Property[key.name='daum'], ObjectPattern > Property[key.value='daum'], ObjectPattern > Property[key.name='TossPayments'], ObjectPattern > Property[key.value='TossPayments'], CallExpression[callee.object.name='Reflect'][callee.property.name='get'][arguments.1.value='google'], CallExpression[callee.object.name='Reflect'][callee.property.name='get'][arguments.1.value='daum'], CallExpression[callee.object.name='Reflect'][callee.property.name='get'][arguments.1.value='TossPayments']",
  message:
    "Direct external SDK global access belongs only in src/platform/integrations.",
};

const externalScriptRestriction = {
  selector:
    "ImportDeclaration[source.value='react'] > ImportSpecifier[imported.name='createElement'], JSXOpeningElement[name.name='script'], CallExpression[callee.name='createElement'][arguments.0.value=/^script$/i], CallExpression[callee.type='MemberExpression'][callee.property.name='createElement'][arguments.0.value=/^script$/i], CallExpression[callee.type='MemberExpression'][callee.property.value='createElement'][arguments.0.value=/^script$/i], CallExpression[callee.type='MemberExpression'][callee.property.name='createElementNS'][arguments.0.value='http://www.w3.org/1999/xhtml'][arguments.1.value=/^script$/i], CallExpression[callee.type='MemberExpression'][callee.property.value='createElementNS'][arguments.0.value='http://www.w3.org/1999/xhtml'][arguments.1.value=/^script$/i], CallExpression[callee.type='MemberExpression'][callee.property.name='bind'][callee.object.type='MemberExpression'][callee.object.property.name='createElement'], CallExpression[callee.type='MemberExpression'][callee.property.value='bind'][callee.object.type='MemberExpression'][callee.object.property.value='createElement'], VariableDeclarator[init.type='MemberExpression'][init.property.name='createElement'], VariableDeclarator[init.type='MemberExpression'][init.property.value='createElement']",
  message:
    "External script ownership belongs only in src/platform/integrations.",
};

const dynamicAxiosRestriction = {
  selector:
    "ImportExpression[source.value=/^axios/], CallExpression[callee.type='Import'][arguments.0.value=/^axios/], CallExpression[callee.name='require'][arguments.0.value=/^axios/], CallExpression[callee.name='require'][arguments.0.type!='Literal'], VariableDeclarator[init.name='require'], AssignmentPattern[right.name='require'], AssignmentExpression[right.name='require']",
  message:
    "Dynamic Axios loading is forbidden; use the native platform HTTP boundary.",
};

const browserHttpTransportRestriction = {
  selector:
    "CallExpression[callee.name='fetch'], MemberExpression[object.name=/^(?:globalThis|window|self)$/][property.name=/^(?:fetch|XMLHttpRequest)$/], MemberExpression[object.name=/^(?:globalThis|window|self)$/][property.value=/^(?:fetch|XMLHttpRequest)$/], MemberExpression[object.name=/^(?:fetch|XMLHttpRequest)$/], NewExpression[callee.name='XMLHttpRequest'], VariableDeclarator[init.name=/^(?:fetch|XMLHttpRequest)$/], AssignmentPattern[right.name=/^(?:fetch|XMLHttpRequest)$/], AssignmentExpression[right.name=/^(?:fetch|XMLHttpRequest)$/], ObjectPattern > Property[key.name=/^(?:fetch|XMLHttpRequest)$/], ObjectPattern > Property[key.value=/^(?:fetch|XMLHttpRequest)$/]",
  message:
    "Direct browser HTTP transport belongs only in src/platform/http; consume the typed request boundary elsewhere.",
};

const allCapabilityRestrictions = [
  computedBrowserCapabilityRestriction,
  browserStorageRestriction,
  externalSdkGlobalRestriction,
  externalScriptRestriction,
  browserHttpTransportRestriction,
  dynamicAxiosRestriction,
];

const tossSdkImportRestriction = {
  name: "@tosspayments/tosspayments-sdk",
  message:
    "The official Toss SDK is private to src/platform/integrations. Consume PaymentGatewayPort elsewhere.",
};
const axiosImportRestriction = {
  name: "axios",
  message: "Axios is retired; use the native platform HTTP boundary instead.",
};
const axiosSubpathRestriction = {
  group: ["axios/*"],
  message: "Axios subpaths are retired with the Axios runtime.",
};

export default defineConfig([
  globalIgnores([
    "build/**",
    "coverage/**",
    "node_modules/**",
    "playwright-report/**",
    "test-results/**",
  ]),
  {
    name: "airbob/linter-policy",
    linterOptions: {
      reportUnusedDisableDirectives: "error",
      reportUnusedInlineConfigs: "error",
    },
  },
  {
    name: "airbob/source-javascript",
    files: sourceFiles,
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: "latest",
      globals: globals.browser,
      sourceType: "module",
    },
    plugins: {
      import: importPlugin,
    },
    rules: {
      "import/first": "error",
      "import/no-amd": "error",
      "import/no-anonymous-default-export": "warn",
      "import/no-webpack-loader-syntax": "error",
    },
  },
  {
    name: "airbob/source-typescript",
    files: sourceTypeScriptFiles,
    extends: [tseslint.configs.recommended],
    rules: {
      "@typescript-eslint/consistent-type-assertions": "warn",
      "@typescript-eslint/no-unused-expressions": [
        "error",
        {
          allowShortCircuit: true,
          allowTaggedTemplates: true,
          allowTernary: true,
        },
      ],
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { args: "none", ignoreRestSiblings: true },
      ],
      "@typescript-eslint/no-use-before-define": [
        "warn",
        {
          classes: false,
          functions: false,
          typedefs: false,
          variables: false,
        },
      ],
    },
  },
  {
    name: "airbob/react",
    files: sourceReactFiles,
    extends: [
      react.configs.flat.recommended,
      react.configs.flat["jsx-runtime"],
      jsxA11y.flatConfigs.recommended,
    ],
    settings: {
      react: { version: "detect" },
    },
    rules: {
      "react/jsx-pascal-case": ["warn", { allowAllCaps: true }],
      "react/prop-types": "off",
    },
  },
  {
    name: "airbob/react-hooks",
    files: sourceFiles,
    extends: [reactHooks.configs.flat.recommended],
    rules: {
      // These compiler-adoption rules require semantic rewrites of the
      // established overlay/session/payment runtimes. Keep the stable Hooks
      // correctness rules active without coupling that separate migration to
      // the ESLint ownership cutover.
      "react-hooks/preserve-manual-memoization": "off",
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    name: "airbob/vitest-react-testing-library",
    files: testFiles,
    extends: [
      vitest.configs.recommended,
      testingLibrary.configs["flat/react"],
      jestDom.configs["flat/recommended"],
    ],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.nodeBuiltin,
        ...vitest.environments.env.globals,
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "jsx-a11y/no-autofocus": "off",
      "jsx-a11y/no-static-element-interactions": "off",
      "react-hooks/globals": "off",
      "react-hooks/immutability": "off",
      "vitest/expect-expect": [
        "error",
        { assertFunctionNames: ["expect", "expect*"] },
      ],
    },
  },
  {
    name: "airbob/test-harness-dom-owner",
    files: ["src/test/**/*.{js,jsx,mjs,ts,tsx}"],
    rules: {
      "testing-library/no-node-access": "off",
      "testing-library/render-result-naming-convention": "off",
    },
  },
  {
    name: "airbob/tooling-typescript",
    files: [...toolingTypeScriptFiles, ...e2eTypeScriptFiles],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: "latest",
      globals: globals.nodeBuiltin,
      sourceType: "module",
    },
  },
  {
    name: "airbob/playwright",
    files: e2eTypeScriptFiles,
    extends: [playwright.configs["flat/recommended"]],
  },
  {
    name: "airbob/node-esm-tools",
    files: nodeEsmFiles,
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: "latest",
      globals: globals.nodeBuiltin,
      sourceType: "module",
    },
  },
  {
    name: "airbob/node-commonjs-tools",
    files: nodeCommonJsFiles,
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: "latest",
      globals: globals.node,
      sourceType: "commonjs",
    },
  },
  {
    name: "airbob/production-environment-owner",
    files: sourceFiles,
    ignores: ["src/platform/config/env.ts", ...testFiles],
    rules: {
      "no-restricted-globals": [
        "error",
        {
          name: "process",
          message:
            "Only src/platform/config/env.ts may read the browser build environment.",
        },
      ],
      "no-restricted-properties": [
        "error",
        {
          message:
            "Browser process access belongs only in src/platform/config/env.ts.",
          object: "globalThis",
          property: "process",
        },
        {
          message:
            "Browser process access belongs only in src/platform/config/env.ts.",
          object: "window",
          property: "process",
        },
        {
          message:
            "Browser process access belongs only in src/platform/config/env.ts.",
          object: "self",
          property: "process",
        },
      ],
    },
  },
  {
    name: "airbob/non-platform-capabilities",
    files: sourceFiles,
    ignores: ["src/platform/**/*.{js,jsx,mjs,ts,tsx}", ...testFiles],
    rules: {
      "no-restricted-syntax": ["error", ...allCapabilityRestrictions],
    },
  },
  {
    name: "airbob/platform-capabilities",
    files: ["src/platform/**/*.{js,jsx,mjs,ts,tsx}"],
    ignores: testFiles,
    rules: {
      "no-restricted-syntax": ["error", ...allCapabilityRestrictions],
    },
  },
  {
    name: "airbob/platform-storage-capabilities",
    files: ["src/platform/storage/**/*.{js,jsx,mjs,ts,tsx}"],
    ignores: testFiles,
    rules: {
      "no-restricted-syntax": [
        "error",
        computedBrowserCapabilityRestriction,
        externalSdkGlobalRestriction,
        externalScriptRestriction,
        browserHttpTransportRestriction,
        dynamicAxiosRestriction,
      ],
    },
  },
  {
    name: "airbob/non-http-production-imports",
    files: sourceFiles,
    ignores: ["src/platform/http/**/*.{js,jsx,mjs,ts,tsx}", ...testFiles],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [tossSdkImportRestriction, axiosImportRestriction],
          patterns: [axiosSubpathRestriction],
        },
      ],
    },
  },
  {
    name: "airbob/platform-integrations-capabilities",
    files: ["src/platform/integrations/**/*.{js,jsx,mjs,ts,tsx}"],
    ignores: testFiles,
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              ...axiosImportRestriction,
              message:
                "Axios is retired; use the native platform HTTP boundary from an integration adapter.",
            },
          ],
          patterns: [axiosSubpathRestriction],
        },
      ],
      "no-restricted-syntax": [
        "error",
        computedBrowserCapabilityRestriction,
        browserStorageRestriction,
        browserHttpTransportRestriction,
        dynamicAxiosRestriction,
      ],
    },
  },
  {
    name: "airbob/platform-http-capabilities",
    files: ["src/platform/http/**/*.{js,jsx,mjs,ts,tsx}"],
    ignores: testFiles,
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [tossSdkImportRestriction, axiosImportRestriction],
          patterns: [axiosSubpathRestriction],
        },
      ],
      "no-restricted-syntax": [
        "error",
        computedBrowserCapabilityRestriction,
        browserStorageRestriction,
        externalSdkGlobalRestriction,
        externalScriptRestriction,
        dynamicAxiosRestriction,
      ],
    },
  },
]);
