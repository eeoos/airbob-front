import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const require = createRequire(import.meta.url);
const {
  isProductionSourcePath,
} = require("../../scripts/architecture/source-policy.cjs");
const architectureDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(architectureDirectory, "../..");
const eslintBinary = path.join(projectRoot, "node_modules/.bin/eslint");
const environmentAdapterPath = path.join(
  projectRoot,
  "src/platform/config/env.ts",
);
const rootIndexPath = path.join(projectRoot, "index.html");
const allowedEnvironmentProperties = new Set([
  "NODE_ENV",
  "REACT_APP_API_URL",
  "REACT_APP_GOOGLE_MAPS_API_KEY",
  "REACT_APP_TOSS_CLIENT_KEY",
  "REACT_APP_CLOUDFRONT_DOMAIN",
]);

const lintSource = ({ filename, source }) => {
  const result = spawnSync(
    eslintBinary,
    ["--stdin", "--stdin-filename", filename, "--format", "json"],
    {
      cwd: projectRoot,
      encoding: "utf8",
      input: source,
    },
  );

  if (result.error) throw result.error;

  let report;
  try {
    report = JSON.parse(result.stdout)[0];
  } catch {
    throw new Error(
      `ESLint did not return a JSON platform-boundary report: ${result.stdout || result.stderr}`,
    );
  }

  return {
    status: result.status,
    messages: report?.messages ?? [],
  };
};

const invalidScenarios = [
  {
    name: "MJS production capability access",
    filename: "src/features/platform-boundary-fixture.mjs",
    source: "export const value = window.google;",
    expectedMessage: "src/platform/integrations",
  },
  {
    name: "environment access",
    source: "export const value = process.env.REACT_APP_QA_PASSWORD;",
    expectedMessage: "src/platform/config",
  },
  {
    name: "environment object destructuring",
    source: "const { env } = process; export const value = env;",
    expectedMessage: "src/platform/config",
  },
  {
    name: "global browser process access",
    source:
      "export const value = globalThis.process.env.REACT_APP_QA_PASSWORD;",
    expectedMessage: "src/platform/config",
  },
  {
    name: "environment access outside its platform owner",
    filename: "src/platform/http/rogue-environment.ts",
    source: "export const value = process.env.REACT_APP_API_URL;",
    expectedMessage: "src/platform/config",
  },
  {
    name: "session storage access",
    source: 'export const value = sessionStorage.getItem("owned-key");',
    expectedMessage: "src/platform/storage",
  },
  {
    name: "local storage access",
    source: 'export const value = localStorage.getItem("owned-key");',
    expectedMessage: "src/platform/storage",
  },
  {
    name: "integration adapter crossing into storage",
    filename: "src/platform/integrations/rogue-storage.ts",
    source: 'export const value = window.sessionStorage.getItem("owned-key");',
    expectedMessage: "src/platform/storage",
  },
  {
    name: "configuration adapter crossing into storage",
    filename: "src/platform/config/rogue-storage.ts",
    source: "export const value = window.localStorage.length;",
    expectedMessage: "src/platform/storage",
  },
  {
    name: "Google global access",
    source: "export const value = window.google;",
    expectedMessage: "src/platform/integrations",
  },
  {
    name: "computed external global access",
    source: 'export const value = globalThis["google"];',
    expectedMessage: "Computed or aliased browser capability",
  },
  {
    name: "aliased external global access",
    source: "const sdk = window; export const value = sdk.google;",
    expectedMessage: "Computed or aliased browser capability",
  },
  {
    name: "Google namespace access",
    source: "export const value = google.maps.event;",
    expectedMessage: "src/platform/integrations",
  },
  {
    name: "Daum global access",
    source: "export const value = window.daum;",
    expectedMessage: "src/platform/integrations",
  },
  {
    name: "Toss global access",
    source: "export const value = window.TossPayments;",
    expectedMessage: "src/platform/integrations",
  },
  {
    name: "self SDK global access",
    source: "export const value = self.google;",
    expectedMessage: "src/platform/integrations",
  },
  {
    name: "nested Window SDK global access",
    source: "export const value = window.window.google;",
    expectedMessage: "src/platform/integrations",
  },
  {
    name: "defaultView SDK global access",
    source: "export const value = document.defaultView?.google;",
    expectedMessage: "src/platform/integrations",
  },
  {
    name: "coerced Window SDK global access",
    source: "export const value = Object(window).TossPayments;",
    expectedMessage: "src/platform/integrations",
  },
  {
    name: "destructured Google SDK global access",
    source: "const { google: sdk } = self; export const value = sdk.maps;",
    expectedMessage: "src/platform/integrations",
  },
  {
    name: "destructured Daum SDK global access",
    source:
      "const { daum: postal } = self; export const value = postal.Postcode;",
    expectedMessage: "src/platform/integrations",
  },
  {
    name: "destructured Toss SDK global access",
    source: "const { TossPayments: pay } = self; export const value = pay;",
    expectedMessage: "src/platform/integrations",
  },
  {
    name: "reflected SDK global access",
    source: 'export const value = Reflect.get(self, "google");',
    expectedMessage: "src/platform/integrations",
  },
  {
    name: "computed session storage access",
    source: 'export const value = self["sessionStorage"].length;',
    expectedMessage: "src/platform/storage",
  },
  {
    name: "computed defaultView local storage access",
    source:
      'export const value = document.defaultView?.["localStorage"].length;',
    expectedMessage: "src/platform/storage",
  },
  {
    name: "storage adapter crossing into an external SDK",
    filename: "src/platform/storage/rogue-sdk.ts",
    source: "export const value = window.google;",
    expectedMessage: "src/platform/integrations",
  },
  {
    name: "configuration adapter crossing into an external SDK",
    filename: "src/platform/config/rogue-sdk.ts",
    source: "export const value = window.TossPayments;",
    expectedMessage: "src/platform/integrations",
  },
  {
    name: "external script insertion",
    source: 'export const value = document.createElement("script");',
    expectedMessage: "script ownership",
  },
  {
    name: "declarative external script insertion",
    filename: "src/features/platform-boundary-fixture.tsx",
    source:
      'export const value = <script src="https://maps.googleapis.com/maps/api/js" />;',
    expectedMessage: "script ownership",
  },
  {
    name: "React createElement external script insertion",
    filename: "src/features/platform-boundary-fixture.tsx",
    source:
      'import { createElement } from "react"; export const value = createElement("script", { src: "https://maps.googleapis.com/maps/api/js" });',
    expectedMessage: "script ownership",
  },
  {
    name: "aliased React createElement import",
    filename: "src/features/platform-boundary-fixture.tsx",
    source:
      'import { createElement as h } from "react"; export const value = h("script", { src: "https://maps.googleapis.com/maps/api/js" });',
    expectedMessage: "script ownership",
  },
  {
    name: "HTML namespace script insertion",
    source:
      'export const value = document.createElementNS("http://www.w3.org/1999/xhtml", "script");',
    expectedMessage: "script ownership",
  },
  {
    name: "case-insensitive external script insertion",
    source: 'export const value = document.createElement("SCRIPT");',
    expectedMessage: "script ownership",
  },
  {
    name: "dynamic external script insertion",
    source:
      'const tagName = "script"; export const value = document.createElement(tagName);',
    expectedMessage: "Computed or aliased browser capability",
  },
  {
    name: "aliased document script insertion",
    source:
      'const browserDocument = document; export const value = browserDocument.createElement("script");',
    expectedMessage: "Computed or aliased browser capability",
  },
  {
    name: "bound document script insertion",
    source:
      'export const createScript = document.createElement.bind(document); createScript("script");',
    expectedMessage: "script ownership",
  },
  {
    name: "reflected document script insertion",
    source:
      'export const createScript = Reflect.get(document, "createElement");',
    expectedMessage: "Computed or aliased browser capability",
  },
  {
    name: "storage adapter crossing into external script ownership",
    filename: "src/platform/storage/rogue-script.ts",
    source: 'export const value = document.createElement("script");',
    expectedMessage: "src/platform/integrations",
  },
  {
    name: "configuration adapter crossing into external script ownership",
    filename: "src/platform/config/rogue-script.ts",
    source: 'export const value = document.createElement("script");',
    expectedMessage: "src/platform/integrations",
  },
  {
    name: "feature Axios import",
    source: 'import axios from "axios"; export const value = axios;',
    expectedMessage: "platform HTTP boundary",
  },
  {
    name: "retired API root Axios import",
    filename: "src/api/client.ts",
    source: 'import axios from "axios"; export const value = axios;',
    expectedMessage: "platform HTTP boundary",
  },
  {
    name: "retired utils root Axios type import",
    filename: "src/utils/error.ts",
    source:
      'import type { AxiosError } from "axios"; export type Failure = AxiosError;',
    expectedMessage: "platform HTTP boundary",
  },
  {
    name: "Axios subpath import",
    filename: "src/components/rogue-axios.ts",
    source:
      'import axios from "axios/dist/browser/axios.cjs"; export const value = axios;',
    expectedMessage: "retired",
  },
  {
    name: "dynamic Axios import",
    source: 'export const value = import("axios");',
    expectedMessage: "Dynamic Axios",
  },
  {
    name: "Axios require",
    source: 'export const value = require("axios/dist/browser/axios.cjs");',
    expectedMessage: "Dynamic Axios",
  },
  {
    name: "Axios template require",
    source: "export const value = require(`axios`);",
    expectedMessage: "Dynamic Axios",
  },
  {
    name: "aliased Axios require",
    source: 'const load = require; export const value = load("axios");',
    expectedMessage: "Dynamic Axios",
  },
  {
    name: "integration adapter crossing into HTTP ownership",
    filename: "src/platform/integrations/rogue-http.ts",
    source: 'import axios from "axios"; export const value = axios;',
    expectedMessage: "platform HTTP boundary",
  },
  {
    name: "workflow importing the Toss SDK directly",
    filename: "src/workflows/rogue-toss-sdk.ts",
    source:
      'import { loadTossPayments } from "@tosspayments/tosspayments-sdk"; export const value = loadTossPayments;',
    expectedMessage: "src/platform/integrations",
  },
  {
    name: "HTTP adapter importing the Toss SDK directly",
    filename: "src/platform/http/rogue-toss-sdk.ts",
    source:
      'import { loadTossPayments } from "@tosspayments/tosspayments-sdk"; export const value = loadTossPayments;',
    expectedMessage: "src/platform/integrations",
  },
  {
    name: "storage adapter crossing into dynamic HTTP ownership",
    filename: "src/platform/storage/rogue-http.ts",
    source: 'export const value = import("axios");',
    expectedMessage: "Dynamic Axios",
  },
  {
    name: "feature direct fetch",
    source: 'export const value = fetch("/api/v1/listings");',
    expectedMessage: "Direct browser HTTP transport",
  },
  {
    name: "feature direct XMLHttpRequest",
    source: "export const value = new XMLHttpRequest();",
    expectedMessage: "Direct browser HTTP transport",
  },
  {
    name: "feature self fetch",
    source: 'export const value = self.fetch("/api/v1/listings");',
    expectedMessage: "Direct browser HTTP transport",
  },
  {
    name: "feature qualified XMLHttpRequest",
    source: "export const value = new window.XMLHttpRequest();",
    expectedMessage: "Direct browser HTTP transport",
  },
  {
    name: "feature qualified fetch alias",
    source:
      'const request = window.fetch; export const value = request("/api/v1/listings");',
    expectedMessage: "Direct browser HTTP transport",
  },
  {
    name: "feature qualified fetch call",
    source:
      'export const value = globalThis.fetch.call(globalThis, "/api/v1/listings");',
    expectedMessage: "Direct browser HTTP transport",
  },
  {
    name: "feature qualified fetch bind",
    source:
      'const request = self.fetch.bind(self); export const value = request("/api/v1/listings");',
    expectedMessage: "Direct browser HTTP transport",
  },
  {
    name: "feature aliased browser global",
    source:
      'const browserRuntime = self; export const value = browserRuntime.fetch("/api/v1/listings");',
    expectedMessage: "Computed or aliased browser capability access",
  },
  {
    name: "integration adapter crossing into browser HTTP ownership",
    filename: "src/platform/integrations/rogue-fetch.ts",
    source: 'export const value = globalThis.fetch("/api/v1/listings");',
    expectedMessage: "Direct browser HTTP transport",
  },
];

for (const scenario of invalidScenarios) {
  const result = lintSource({
    filename: scenario.filename ?? "src/features/platform-boundary-fixture.ts",
    source: scenario.source,
  });
  const expectedFinding = result.messages.some(
    (message) =>
      (message.ruleId === "no-restricted-globals" ||
        message.ruleId === "no-restricted-properties" ||
        message.ruleId === "no-restricted-syntax" ||
        message.ruleId === "no-restricted-imports") &&
      message.message.includes(scenario.expectedMessage),
  );

  if (result.status === 0 || !expectedFinding) {
    throw new Error(
      `${scenario.name} bypassed the platform boundary: ${JSON.stringify(result.messages)}`,
    );
  }
}

const validScenarios = [
  {
    filename: "src/platform/integrations/platform-boundary-fixture.ts",
    source:
      'export const values = [window.google, document.createElement("script")];',
  },
  {
    filename:
      "src/platform/integrations/alternate-platform-boundary-fixture.ts",
    source:
      'export const values = [self.google, document.createElement.bind(document)("script")];',
  },
  {
    filename:
      "src/platform/integrations/declarative-platform-boundary-fixture.tsx",
    source:
      'export const value = <script src="https://maps.googleapis.com/maps/api/js" />;',
  },
  {
    filename: "src/platform/integrations/react-platform-boundary-fixture.tsx",
    source:
      'import { createElement } from "react"; export const value = createElement("script", { src: "https://maps.googleapis.com/maps/api/js" });',
  },
  {
    filename:
      "src/platform/integrations/react-alias-platform-boundary-fixture.tsx",
    source:
      'import { createElement as h } from "react"; export const values = [h("script", { src: "https://maps.googleapis.com/maps/api/js" }), document.createElementNS("http://www.w3.org/1999/xhtml", "script")];',
  },
  {
    filename: "src/platform/storage/platform-boundary-fixture.ts",
    source:
      "export const values = [window.sessionStorage.length, window.localStorage.length];",
  },
  {
    filename: "src/platform/config/env.ts",
    source: "export const value = process.env.REACT_APP_API_URL;",
  },
  {
    filename: "src/platform/http/platform-boundary-fixture.ts",
    source:
      'export const request = () => globalThis.fetch("/api/v1/health"); export const create = () => new XMLHttpRequest();',
  },
  {
    filename: "src/platform/integrations/toss-platform-boundary-fixture.ts",
    source:
      'import { loadTossPayments } from "@tosspayments/tosspayments-sdk"; export const value = loadTossPayments;',
  },
  {
    filename: "src/features/platform-boundary-fixture.ts",
    source:
      'export const values = [window.open, document.createElement("button")];',
  },
];

for (const scenario of validScenarios) {
  const result = lintSource(scenario);

  if (result.status !== 0) {
    throw new Error(
      `Valid platform boundary source was rejected: ${JSON.stringify(result.messages)}`,
    );
  }
}

const canonicalModuleEntry = Object.freeze({
  src: "/src/index.tsx",
  type: "module",
});
const withoutHtmlComments = (html) => html.replaceAll(/<!--[\s\S]*?-->/g, "");
const collectScriptElements = (html) => {
  const source = withoutHtmlComments(html);
  const openingTags = [...source.matchAll(/<script\b([^>]*)>/gi)];
  const closingTags = [...source.matchAll(/<\/script\s*>/gi)];

  const elements = openingTags.map((openingTag, index) => {
    const attributes = new Map();
    const attributeNames = [];
    const attributeSource = openingTag[1];
    const attributePattern =
      /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
    let attributeMatch;

    while ((attributeMatch = attributePattern.exec(attributeSource)) !== null) {
      const [, rawName, doubleQuoted, singleQuoted, unquoted] = attributeMatch;
      attributeNames.push(rawName.toLowerCase());
      attributes.set(
        rawName.toLowerCase(),
        doubleQuoted ?? singleQuoted ?? unquoted ?? "",
      );
    }

    const contentStart = (openingTag.index ?? 0) + openingTag[0].length;
    const elementEnd = closingTags[index]?.index;
    const content =
      elementEnd === undefined || elementEnd < contentStart
        ? null
        : source.slice(contentStart, elementEnd);

    return { attributeNames, attributes, content };
  });

  return { closingTagCount: closingTags.length, elements };
};
const validateDocumentScriptOwnership = (html) => {
  const { closingTagCount, elements: scripts } = collectScriptElements(html);

  if (scripts.length !== 1 || closingTagCount !== 1) {
    return `expected exactly one complete script entry, received ${scripts.length} opening and ${closingTagCount} closing tags`;
  }

  const [{ attributeNames, attributes, content }] = scripts;
  if (
    attributeNames.length !== 2 ||
    new Set(attributeNames).size !== attributeNames.length ||
    attributes.size !== 2 ||
    attributes.get("type") !== canonicalModuleEntry.type ||
    attributes.get("src") !== canonicalModuleEntry.src
  ) {
    return "only the first-party Vite module entry is allowed";
  }
  if (content === null || content.trim() !== "") {
    return "the first-party module entry must not contain executable inline code";
  }

  return null;
};

const rootIndexSource = await readFile(rootIndexPath, "utf8");
const rootDocumentScriptViolation =
  validateDocumentScriptOwnership(rootIndexSource);
if (rootDocumentScriptViolation !== null) {
  throw new Error(
    `index.html bypassed platform script ownership: ${rootDocumentScriptViolation}.`,
  );
}

const invalidDocumentScriptFixtures = [
  '<script src="https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js"></script>',
  '<script type="module" src="/src/index.tsx"></script><script>alert(1)</script>',
  '<script type="module" src="/src/index.tsx">alert(1)</script>',
  '<script type="module" src="/src/alternate-entry.tsx"></script>',
  '<script type="module" src="https://evil.invalid/app.js" src="/src/index.tsx"></script>',
  '<script type="module" src="/src/index.tsx" onload="alert(1)"></script>',
  '<script type="module" src="/src/index.tsx"></script></script>',
  '</script><script type="module" src="/src/index.tsx">',
];
if (
  invalidDocumentScriptFixtures.some(
    (fixture) => validateDocumentScriptOwnership(fixture) === null,
  )
) {
  throw new Error("An executable HTML script bypassed platform ownership.");
}

const collectHtmlPlaceholders = (html) =>
  [...html.matchAll(/%([A-Za-z][A-Za-z0-9_]*)%/g)].map((match) =>
    match[1].toUpperCase(),
  );
const publicHtmlPlaceholders = collectHtmlPlaceholders(rootIndexSource);
const unknownHtmlPlaceholders = publicHtmlPlaceholders.filter(
  (placeholder) => placeholder !== "BASE_URL",
);
if (
  unknownHtmlPlaceholders.length > 0 ||
  publicHtmlPlaceholders.filter((placeholder) => placeholder === "BASE_URL")
    .length !== 3
) {
  throw new Error(
    `index.html must use only the three owned Vite BASE_URL asset placeholders: ${publicHtmlPlaceholders.sort().join(", ")}`,
  );
}
[
  "%BASE_URL%favicon.ico",
  "%BASE_URL%logo192.png",
  "%BASE_URL%manifest.json",
].forEach((assetReference) => {
  if (!rootIndexSource.includes(assetReference)) {
    throw new Error(
      `index.html lost its owned public asset reference: ${assetReference}.`,
    );
  }
});
if (
  collectHtmlPlaceholders('<meta content="%React_App_New_Secret%" />')
    .length !== 1
) {
  throw new Error(
    "The public HTML environment-placeholder fixture is invalid.",
  );
}

const environmentSource = await readFile(environmentAdapterPath, "utf8");
const environmentAst = ts.createSourceFile(
  environmentAdapterPath,
  environmentSource,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TS,
);
const environmentReads = new Set();
const unsafeEnvironmentReads = [];
const localProcessDeclarations = [];

const isProcessEnvironment = (node) =>
  ts.isPropertyAccessExpression(node) &&
  ts.isIdentifier(node.expression) &&
  node.expression.text === "process" &&
  node.name.text === "env";

const isLocalAmbientProcessDeclaration = (node) => {
  const declaration = node.parent;
  const declarationList = declaration.parent;
  const statement = declarationList.parent;

  return (
    ts.isVariableDeclaration(declaration) &&
    declaration.name === node &&
    declaration.initializer === undefined &&
    ts.isVariableDeclarationList(declarationList) &&
    ts.isVariableStatement(statement) &&
    statement.modifiers?.some(
      (modifier) => modifier.kind === ts.SyntaxKind.DeclareKeyword,
    ) === true
  );
};

const inspectEnvironmentNode = (node) => {
  if (ts.isIdentifier(node) && node.text === "process") {
    if (isLocalAmbientProcessDeclaration(node)) {
      localProcessDeclarations.push(node.getText(environmentAst));
    } else {
      const environmentAccess = node.parent;
      const publicProperty = environmentAccess.parent;
      if (
        !ts.isPropertyAccessExpression(environmentAccess) ||
        environmentAccess.expression !== node ||
        environmentAccess.name.text !== "env" ||
        !ts.isPropertyAccessExpression(publicProperty) ||
        publicProperty.expression !== environmentAccess ||
        !allowedEnvironmentProperties.has(publicProperty.name.text)
      ) {
        unsafeEnvironmentReads.push(node.getText(environmentAst));
      }
    }
  }

  if (
    (ts.isPropertyAccessExpression(node) ||
      ts.isElementAccessExpression(node)) &&
    node.getText(environmentAst).startsWith("globalThis.process")
  ) {
    unsafeEnvironmentReads.push(node.getText(environmentAst));
  }

  if (isProcessEnvironment(node)) {
    const parent = node.parent;
    if (
      ts.isPropertyAccessExpression(parent) &&
      parent.expression === node &&
      allowedEnvironmentProperties.has(parent.name.text)
    ) {
      environmentReads.add(parent.name.text);
    } else {
      unsafeEnvironmentReads.push(node.getText(environmentAst));
    }
  }

  ts.forEachChild(node, inspectEnvironmentNode);
};

inspectEnvironmentNode(environmentAst);

const missingEnvironmentReads = [...allowedEnvironmentProperties].filter(
  (name) => !environmentReads.has(name),
);
const unknownEnvironmentReads = [...environmentReads].filter(
  (name) => !allowedEnvironmentProperties.has(name),
);

if (
  unsafeEnvironmentReads.length > 0 ||
  localProcessDeclarations.length !== 1 ||
  missingEnvironmentReads.length > 0 ||
  unknownEnvironmentReads.length > 0
) {
  throw new Error(
    "The browser environment adapter must read exactly the five approved direct properties.",
  );
}

const isAxiosModuleSpecifier = (moduleSpecifier) =>
  ts.isStringLiteral(moduleSpecifier) &&
  moduleSpecifier.text.startsWith("axios");
const productionSourceFiles = ts.sys
  .readDirectory(
    path.join(projectRoot, "src"),
    [".js", ".jsx", ".mjs", ".ts", ".tsx"],
    undefined,
    ["**/*"],
  )
  .map((absolutePath) => ({
    absolutePath,
    projectPath: path.relative(projectRoot, absolutePath).replaceAll("\\", "/"),
  }))
  .filter(({ projectPath }) => isProductionSourcePath(projectPath));
const productionBoundaryViolations = [];

const collectAxiosBoundaryViolations = ({ sourceFile, projectPath }) => {
  return sourceFile.statements.flatMap((statement) => {
    if (
      ts.isImportDeclaration(statement) &&
      isAxiosModuleSpecifier(statement.moduleSpecifier)
    ) {
      return [`${projectPath}:runtime-axios-import`];
    }

    if (
      ts.isExportDeclaration(statement) &&
      statement.moduleSpecifier &&
      isAxiosModuleSpecifier(statement.moduleSpecifier)
    ) {
      return [`${projectPath}:runtime-axios-export`];
    }

    return [];
  });
};

const isDynamicImportCall = (node) =>
  ts.isCallExpression(node) &&
  node.expression.kind === ts.SyntaxKind.ImportKeyword;

const getStaticDynamicImportSpecifier = (node) => {
  if (!isDynamicImportCall(node) || node.arguments.length !== 1) {
    return null;
  }

  const [moduleSpecifier] = node.arguments;
  return ts.isStringLiteralLike(moduleSpecifier) ||
    ts.isNoSubstitutionTemplateLiteral(moduleSpecifier)
    ? moduleSpecifier.text
    : null;
};

const collectDynamicImportBoundaryViolations = ({
  sourceFile,
  projectPath,
}) => {
  const violations = [];
  const inspectNode = (node) => {
    const moduleSpecifier = getStaticDynamicImportSpecifier(node);

    if (
      isDynamicImportCall(node) &&
      moduleSpecifier === null &&
      !projectPath.startsWith("src/platform/integrations/")
    ) {
      violations.push(`${projectPath}:runtime-nonliteral-dynamic-import`);
    }

    if (moduleSpecifier?.startsWith("axios")) {
      violations.push(`${projectPath}:runtime-axios-dynamic-import`);
    }
    if (
      /^(?:(?:https?:)?\/\/|data:|blob:)/i.test(moduleSpecifier ?? "") &&
      !projectPath.startsWith("src/platform/integrations/")
    ) {
      violations.push(`${projectPath}:runtime-external-code-import`);
    }

    ts.forEachChild(node, inspectNode);
  };

  inspectNode(sourceFile);
  return violations;
};

const collectImportMetaViolations = ({ sourceFile, projectPath }) => {
  const violations = [];
  const inspectNode = (node) => {
    if (
      ts.isMetaProperty(node) &&
      node.keywordToken === ts.SyntaxKind.ImportKeyword &&
      !(
        ts.isPropertyAccessExpression(node.parent) &&
        node.parent.expression === node &&
        node.parent.name.text === "url"
      )
    ) {
      violations.push(`${projectPath}:runtime-import-meta`);
    }

    ts.forEachChild(node, inspectNode);
  };

  inspectNode(sourceFile);
  return violations;
};

const axiosReExportFixturePath = "src/api/client.ts";
const axiosReExportFixture = ts.createSourceFile(
  axiosReExportFixturePath,
  'export { default as rogueAxios } from "axios";',
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TS,
);
if (
  !collectAxiosBoundaryViolations({
    sourceFile: axiosReExportFixture,
    projectPath: axiosReExportFixturePath,
  }).includes(`${axiosReExportFixturePath}:runtime-axios-export`)
) {
  throw new Error("A retired global root allowed an Axios runtime re-export.");
}

{
  const projectPath = "src/features/import-meta-url-fixture.ts";
  const sourceFile = ts.createSourceFile(
    projectPath,
    'export const value = new URL("./asset.svg", import.meta.url);',
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  if (collectImportMetaViolations({ sourceFile, projectPath }).length > 0) {
    throw new Error(
      "The canonical Vite import.meta.url asset pattern was rejected.",
    );
  }
}

const dynamicBoundaryFixtures = [
  {
    projectPath: "src/features/axios-template-fixture.ts",
    source: "export const value = import(`axios`);",
    expectedViolation: "runtime-axios-dynamic-import",
  },
  {
    projectPath: "src/features/external-import-fixture.ts",
    source:
      'export const value = import(/* webpackIgnore: true */ "https://evil.invalid/x.js");',
    expectedViolation: "runtime-external-code-import",
  },
  {
    projectPath: "src/features/protocol-relative-import-fixture.ts",
    source:
      'export const value = import(/* webpackIgnore: true */ "//evil.invalid/x.js");',
    expectedViolation: "runtime-external-code-import",
  },
  {
    projectPath: "src/features/data-import-fixture.ts",
    source:
      'export const value = import(/* webpackIgnore: true */ "data:text/javascript,export default 1");',
    expectedViolation: "runtime-external-code-import",
  },
  {
    projectPath: "src/features/blob-import-fixture.ts",
    source:
      'export const value = import(/* webpackIgnore: true */ "blob:https://app.example.invalid/id");',
    expectedViolation: "runtime-external-code-import",
  },
  {
    projectPath: "src/features/nonliteral-import-fixture.ts",
    source:
      'const sdkUrl = "https://evil.invalid/x.js"; export const value = import(/* webpackIgnore: true */ sdkUrl);',
    expectedViolation: "runtime-nonliteral-dynamic-import",
  },
];

for (const fixture of dynamicBoundaryFixtures) {
  const sourceFile = ts.createSourceFile(
    fixture.projectPath,
    fixture.source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const expectedViolation = `${fixture.projectPath}:${fixture.expectedViolation}`;
  if (
    !collectDynamicImportBoundaryViolations({
      sourceFile,
      projectPath: fixture.projectPath,
    }).includes(expectedViolation)
  ) {
    throw new Error(
      `Dynamic import escaped the platform boundary: ${fixture.projectPath}`,
    );
  }
}

for (const source of [
  "export const value = import.meta.env.REACT_APP_API_URL;",
  'export const value = import.meta["env"].REACT_APP_API_URL;',
  "const { env } = import.meta; export const value = env;",
  "const meta = import.meta; export const value = meta.env;",
  'export const value = Reflect.get(import.meta, "env");',
]) {
  const projectPath = "src/features/import-meta-env-fixture.ts";
  const sourceFile = ts.createSourceFile(
    projectPath,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  if (
    !collectImportMetaViolations({ sourceFile, projectPath }).includes(
      `${projectPath}:runtime-import-meta`,
    )
  ) {
    throw new Error(
      "import.meta.env escaped the exact browser environment owner.",
    );
  }
}

for (const { absolutePath, projectPath } of productionSourceFiles) {
  const source = await readFile(absolutePath, "utf8");
  const sourceExtension = path.extname(absolutePath);
  const scriptKind =
    sourceExtension === ".tsx"
      ? ts.ScriptKind.TSX
      : sourceExtension === ".jsx"
        ? ts.ScriptKind.JSX
        : sourceExtension === ".js" || sourceExtension === ".mjs"
          ? ts.ScriptKind.JS
          : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(
    absolutePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKind,
  );

  productionBoundaryViolations.push(
    ...collectAxiosBoundaryViolations({ sourceFile, projectPath }),
    ...collectDynamicImportBoundaryViolations({ sourceFile, projectPath }),
    ...collectImportMetaViolations({ sourceFile, projectPath }),
  );

  const inspectProductionNode = (node) => {
    if (ts.isIdentifier(node) && node.text === "require") {
      productionBoundaryViolations.push(`${projectPath}:runtime-require`);
    }

    const isLegacyStorageIdentifier =
      ts.isIdentifier(node) &&
      node.text === "legacySessionStorageCompatibility";
    const isComputedLegacyStorageAccess =
      ts.isElementAccessExpression(node) &&
      ts.isStringLiteralLike(node.argumentExpression) &&
      node.argumentExpression.text === "legacySessionStorageCompatibility";
    if (
      (isLegacyStorageIdentifier || isComputedLegacyStorageAccess) &&
      !projectPath.startsWith("src/platform/storage/")
    ) {
      productionBoundaryViolations.push(
        `${projectPath}:unowned-legacy-storage-import`,
      );
    }

    if (
      ts.isIdentifier(node) &&
      (node.text === "sessionStorageDriver" ||
        node.text === "createSessionStorageDriver") &&
      !projectPath.startsWith("src/platform/storage/")
    ) {
      productionBoundaryViolations.push(
        `${projectPath}:private-raw-storage-driver`,
      );
    }

    ts.forEachChild(node, inspectProductionNode);
  };

  inspectProductionNode(sourceFile);
}

if (productionBoundaryViolations.length > 0) {
  throw new Error(
    `Production platform boundary violations:\n${[
      ...new Set(productionBoundaryViolations),
    ]
      .sort()
      .join("\n")}`,
  );
}

process.stdout.write(
  `Platform boundary fixtures passed (${invalidScenarios.length + validScenarios.length + dynamicBoundaryFixtures.length + 11} scenarios).\n`,
);
